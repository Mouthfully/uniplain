import { type EnvelopeRow, type MetricName, isProvisional, restatesUntil } from "@repo/contract";

/**
 * SHOPIFY ORDERS -> ENVELOPE ROWS.
 *
 * Every field name, argument and behaviour below was read out of Shopify's own GraphQL Admin API
 * reference for the version this connector pins, not recalled. The citations are in the traps.
 *
 * ================================================================================================
 * TRAP 1: `totalPriceSet` IS THE WRONG FIELD, AND IT IS THE OBVIOUS ONE
 * ================================================================================================
 *
 * Shopify's Order carries both `totalPriceSet` and `currentTotalPriceSet`, and the documentation is
 * explicit about the difference: the `current*` family "represent values AFTER accounting for
 * returns, refunds, order edits, and cancellations".
 *
 * So `totalPriceSet` is what the customer was charged at checkout, and it does not move when half
 * the order is refunded a week later. A connector that read it would report a shop's revenue as
 * whatever was rung up, for ever, with refunds invisible -- a number that is plausible, stable, and
 * wrong in exactly the direction a merchant would never question.
 *
 * `revenue` therefore comes from `currentTotalPriceSet`, and `totalPriceSet` is READ AND KEPT for
 * the sole purpose of noticing that the two differ. It is never summed.
 *
 * ================================================================================================
 * TRAP 2: MONEY IS A STRING, AND THE CURRENCY COMES WITH IT
 * ================================================================================================
 *
 * `MoneyV2` is `{ amount: String, currencyCode: CurrencyCode }`. The amount is a decimal string
 * precisely so it does not go through a float on the way to you, and this module keeps that
 * discipline: it refuses anything that is not a plain decimal rather than coercing it.
 *
 * `shopMoney` and NOT `presentmentMoney`. Presentment is what the buyer saw in their own currency;
 * shop money is the merchant's own books, which is what an owner reconciles against. Mixing the two
 * across rows would produce a currency column that is sometimes one and sometimes the other.
 *
 * ================================================================================================
 * TRAP 3: A CANCELLED ORDER IS STILL AN ORDER, AND A TEST ORDER IS NOT
 * ================================================================================================
 *
 * `cancelledAt` is a timestamp on an order that was placed and then cancelled. The money is already
 * handled -- `currentTotalPriceSet` accounts for cancellations -- so the honest row is one with
 * `orders: 1` and whatever money remains, exactly as for a refund. A cancelled order did happen.
 *
 * `test: true` is different in kind. A test order is a developer pressing buttons with a gateway in
 * test mode; it never existed commercially and counting it inflates both metrics. It is DROPPED,
 * and dropping it is safe in a way dropping a real order never is.
 */

/** Money as Shopify returns it. */
export interface ShopifyMoney {
  readonly amount?: string;
  readonly currencyCode?: string;
}

export interface ShopifyMoneyBag {
  readonly shopMoney?: ShopifyMoney;
}

/** The Order fields this connector asks for. Nothing else is requested; see `ORDER_FIELDS`. */
export interface ShopifyOrder {
  readonly id?: string;
  readonly name?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly cancelledAt?: string | null;
  readonly test?: boolean;
  readonly displayFinancialStatus?: string | null;
  readonly currentTotalPriceSet?: ShopifyMoneyBag;
  readonly totalPriceSet?: ShopifyMoneyBag;
}

export type ShopifyNormalizeCode =
  | "missing_id"
  | "missing_currency"
  | "missing_total"
  | "bad_amount"
  | "bad_timestamp"
  | "bad_timezone";

export class ShopifyNormalizeError extends Error {
  readonly code: ShopifyNormalizeCode;
  constructor(message: string, code: ShopifyNormalizeCode) {
    super(message);
    this.name = "ShopifyNormalizeError";
    this.code = code;
  }
}

/**
 * A Shopify global id is `gid://shopify/Order/1234567890`.
 *
 * The NUMERIC part is what a merchant sees in their own admin and what support will ask for, so it
 * is what goes in `native_id`. The whole gid is not thrown away -- it is what the API addresses the
 * order by -- but a merchant asked to check "gid://shopify/Order/450789469" against their orders
 * page has been handed our plumbing instead of their reference.
 */
export function shopifyNumericId(gid: string | undefined): string {
  if (typeof gid !== "string" || gid === "") {
    throw new ShopifyNormalizeError(
      "shopify: an order carries no id. Every envelope row is keyed on an entity id and the upsert " +
        "key requires one.",
      "missing_id",
    );
  }
  // THE WHOLE FORM IS MATCHED, NOT JUST THE TAIL, and a test is why.
  //
  // The first version took everything after the last slash and accepted it if it was digits. That
  // accepts a bare "450789469" -- which the API never returns -- and, worse, it accepts
  // "gid://shopify/Product/1": a PRODUCT id, silently keyed into the envelope as an order. The
  // laxness costs nothing to remove and the thing it lets through is a row about the wrong object.
  const match = gid.match(/^gid:\/\/shopify\/Order\/(\d+)$/);
  if (match === null) {
    throw new ShopifyNormalizeError(
      `shopify: order id ${JSON.stringify(gid)} is not a gid of the form ` +
        "gid://shopify/Order/<digits>.",
      "missing_id",
    );
  }
  return match[1] as string;
}

/**
 * Parse a Shopify decimal string.
 *
 * REFUSES RATHER THAN COERCES. `Number("")` is 0 and `Number("1,234.00")` is NaN, and the first of
 * those is the dangerous one: an empty amount would become a zero, and a zero is a MEASUREMENT --
 * "this order was free" -- rather than the absence of one. CLAUDE.md's rule about `?? 0` is the
 * same rule, one layer down.
 */
export function parseShopifyAmount(value: string | undefined, field: string): number {
  if (value === undefined || value === null || value.trim() === "") {
    throw new ShopifyNormalizeError(
      `shopify: ${field} is absent. An absent amount is not zero, and treating it as zero would ` +
        "report a free order.",
      "bad_amount",
    );
  }
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new ShopifyNormalizeError(
      `shopify: ${field} is ${JSON.stringify(value)}, which is not a plain decimal.`,
      "bad_amount",
    );
  }
  return Number(value);
}

/**
 * The calendar date an order belongs to, IN THE SHOP'S OWN TIMEZONE.
 *
 * `createdAt` is RFC3339 with an offset. An order placed at 06:30 UTC is the previous evening in
 * Bangkok, so bucketing on the UTC date would move a Thai shop's late-evening takings into the
 * next day -- silently, and only for the orders near the boundary, which is the hardest kind of
 * wrong number to notice.
 *
 * There is NO DEFAULT. `public.connections.timezone` is where this comes from, and a null there
 * means nobody has told us, which the backfill must refuse rather than guess at.
 */
export function shopifyDate(value: string | undefined, field: string, timezone: string): string {
  if (timezone.trim() === "") {
    throw new ShopifyNormalizeError(
      "shopify: no timezone. The date a row belongs to is computed in the shop's zone and there is " +
        "no default -- see 20260912000400's rule about coalesce(timezone, 'UTC').",
      "bad_timezone",
    );
  }
  if (value === undefined || value.trim() === "") {
    throw new ShopifyNormalizeError(`shopify: ${field} is absent.`, "bad_timestamp");
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    throw new ShopifyNormalizeError(
      `shopify: ${field} is ${JSON.stringify(value)}, which is not a timestamp.`,
      "bad_timestamp",
    );
  }
  try {
    // `en-CA` yields YYYY-MM-DD, which is the envelope's date format and not a locale accident:
    // `formatToParts` would be the alternative and this is the same answer with less ceremony.
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
  } catch {
    throw new ShopifyNormalizeError(
      `shopify: ${JSON.stringify(timezone)} is not an IANA timezone this runtime knows.`,
      "bad_timezone",
    );
  }
}

export interface ShopifyNormalizeOptions {
  readonly orders: readonly ShopifyOrder[];
  /** The shop's myshopify domain, e.g. "example.myshopify.com". The account this row belongs to. */
  readonly shopDomain: string;
  /** IANA timezone the shop reports in. The envelope requires one and there is no default. */
  readonly timezone: string;
  /** RFC3339. When this pull happened. */
  readonly fetchedAt: string;
  /** RFC3339. Immutable per row; see @repo/contract's restatement note. */
  readonly firstSeenAt: string;
}

/**
 * One row per order, for the reason WooCommerce gives: a refund restates ONE order and the
 * envelope's upsert key can address it, where a daily aggregate would have to be recomputed from a
 * re-pull of the whole day to move by one refund. The aggregate can be built from these rows later;
 * it cannot be decomposed back the other way.
 *
 * THROWS RATHER THAN SKIPS. A connector that silently drops an order produces a number that is
 * quietly too low, which is the failure this product is sold against. The ONE exception is a test
 * order, which never existed commercially -- see trap 3.
 */
export function normalizeShopifyOrders(options: ShopifyNormalizeOptions): EnvelopeRow[] {
  const rows: EnvelopeRow[] = [];

  for (const order of options.orders) {
    if (order.test === true) continue;

    const numericId = shopifyNumericId(order.id);
    const current = order.currentTotalPriceSet?.shopMoney;

    if (current === undefined) {
      throw new ShopifyNormalizeError(
        `shopify: order ${numericId} carries no currentTotalPriceSet.shopMoney. That is the only ` +
          "field that accounts for refunds, edits and cancellations, and totalPriceSet is not a " +
          "substitute for it -- see trap 1.",
        "missing_total",
      );
    }
    if (!current.currencyCode) {
      throw new ShopifyNormalizeError(
        `shopify: order ${numericId} carries no currency. Defaulting it would mislabel every ` +
          "monetary value on the row.",
        "missing_currency",
      );
    }

    const date = shopifyDate(order.createdAt, `order ${numericId} createdAt`, options.timezone);
    const revenue = parseShopifyAmount(
      current.amount,
      `order ${numericId} currentTotalPriceSet.shopMoney.amount`,
    );

    const metrics: Partial<Record<MetricName, number>> = {
      // A CANCELLED OR REFUNDED ORDER IS STILL AN ORDER. It was placed; the money moved back, and
      // `revenue` above is where that shows. Setting this to 0 would answer "how many orders did I
      // take?" with a number that quietly re-writes history every time somebody returns something.
      orders: 1,
      revenue,
    };

    const restates = restatesUntil({
      source: "shopify",
      date,
      firstSeenAt: options.firstSeenAt,
    });

    rows.push({
      source: "shopify",
      entity: {
        type: "order",
        id: `shopify_${numericId}`,
        account_id: options.shopDomain,
        native_entity_type: "shop_order",
        native_id: numericId,
      },
      dimensions: {
        date,
        currency: current.currencyCode,
        timezone: options.timezone,
        // Null for the reason the WooCommerce normaliser gives: a shop's own order is attributed to
        // nothing, so a window here would be a label with nothing to label.
        attribution_window: null,
      },
      metrics,
      fetched_at: options.fetchedAt,
      // Shopify publishes a per-order `updatedAt`, and it is the field the incremental pull filters
      // on. Reporting it is what lets a reader see that a row moved.
      source_updated_at: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,
      restates_until: restates,
      is_provisional: isProvisional(restates, new Date(options.fetchedAt)),
      first_seen_at: options.firstSeenAt,
      // The shop reports in its own currency and this connector converts nothing.
      fx_source: null,
      fx_rate_date: null,
      fx_rate: null,
      fx_base: null,
      raw: order,
    });
  }

  return rows;
}
