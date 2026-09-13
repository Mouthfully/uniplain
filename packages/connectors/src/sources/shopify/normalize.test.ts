import { describe, expect, it } from "vitest";

import {
  SHOPIFY_CANCELLED_ORDER,
  SHOPIFY_EVENING_ORDER,
  SHOPIFY_ORDERS,
  SHOPIFY_PLAIN_ORDER,
  SHOPIFY_REFUNDED_ORDER,
  SHOPIFY_TEST_ORDER,
} from "./fixtures.ts";
import {
  ShopifyNormalizeError,
  normalizeShopifyOrders,
  parseShopifyAmount,
  shopifyDate,
  shopifyNumericId,
} from "./normalize.ts";

const BASE = {
  shopDomain: "example.myshopify.com",
  timezone: "Asia/Bangkok",
  fetchedAt: "2026-09-13T02:00:00.000Z",
  firstSeenAt: "2026-09-13T02:00:00.000Z",
};

function normalize(orders: Parameters<typeof normalizeShopifyOrders>[0]["orders"]) {
  return normalizeShopifyOrders({ ...BASE, orders });
}

describe("the field that makes revenue honest", () => {
  /**
   * THE ASSERTION THIS WHOLE CONNECTOR TURNS ON.
   *
   * Shopify documents the `current*` money fields as reflecting "returns, refunds, order edits, and
   * cancellations". `totalPriceSet` is what the buyer was charged at checkout and it does not move
   * when half the order comes back a week later.
   *
   * Reading the wrong one gives a number that is plausible, stable, and wrong in the one direction
   * a merchant would never question -- their revenue looking better than it is.
   */
  it("reads revenue from currentTotalPriceSet, not from totalPriceSet", () => {
    const [row] = normalize([SHOPIFY_REFUNDED_ORDER]);
    expect(row?.metrics.revenue).toBe(1000);
    // The fixture's pre-refund total, asserted explicitly so this test states what it is rejecting.
    expect(SHOPIFY_REFUNDED_ORDER.totalPriceSet?.shopMoney?.amount).toBe("2000.00");
  });

  /**
   * A REFUNDED ORDER IS STILL AN ORDER. Setting `orders` to 0 would answer "how many orders did I
   * take?" with a number that quietly rewrites history every time somebody returns something.
   */
  it("still counts a refunded order as an order", () => {
    const [row] = normalize([SHOPIFY_REFUNDED_ORDER]);
    expect(row?.metrics.orders).toBe(1);
  });

  it("counts a cancelled order too, with whatever money is left", () => {
    const [row] = normalize([SHOPIFY_CANCELLED_ORDER]);
    expect(row?.metrics.orders).toBe(1);
    expect(row?.metrics.revenue).toBe(0);
  });

  /**
   * THE ONE ORDER IT IS SAFE TO DROP, and the only one. A test order is a developer pressing
   * buttons with the gateway in test mode; it never existed commercially, and this fixture's
   * 999,999 is what it would do to a day's takings.
   */
  it("drops a test order, and nothing else", () => {
    const rows = normalize(SHOPIFY_ORDERS);
    expect(rows).toHaveLength(SHOPIFY_ORDERS.length - 1);
    for (const row of rows) {
      expect(row.entity.native_id).not.toBe(shopifyNumericId(SHOPIFY_TEST_ORDER.id));
    }
  });
});

describe("the date a row belongs to", () => {
  /**
   * 2026-09-11T18:30:00Z is 2026-09-12 01:30 in Asia/Bangkok. Bucketing on the UTC date moves a
   * Thai shop's late-evening takings into the previous day -- for the orders near the boundary
   * only, which is the hardest kind of wrong number to notice.
   */
  it("is computed in the shop's timezone, not the runtime's", () => {
    const [row] = normalize([SHOPIFY_EVENING_ORDER]);
    expect(row?.dimensions.date).toBe("2026-09-12");
    expect(shopifyDate(SHOPIFY_EVENING_ORDER.createdAt, "createdAt", "UTC")).toBe("2026-09-11");
  });

  it("refuses an empty timezone rather than assuming UTC", () => {
    expect(() =>
      normalizeShopifyOrders({ ...BASE, timezone: "  ", orders: [SHOPIFY_PLAIN_ORDER] }),
    ).toThrow(ShopifyNormalizeError);
  });

  it("refuses a timezone this runtime does not know", () => {
    expect(() =>
      normalizeShopifyOrders({ ...BASE, timezone: "Mars/Olympus", orders: [SHOPIFY_PLAIN_ORDER] }),
    ).toThrow(/not an IANA timezone/);
  });
});

describe("what it refuses rather than repairs", () => {
  /**
   * `Number("")` IS 0, AND THAT IS THE WHOLE PROBLEM. An absent amount becoming zero reports a free
   * order -- a measurement -- where there was no measurement at all. CLAUDE.md's `?? 0` rule, one
   * layer down.
   */
  it("refuses an absent amount instead of reading it as zero", () => {
    expect(() => parseShopifyAmount(undefined, "amount")).toThrow(/is not zero/);
    expect(() => parseShopifyAmount("", "amount")).toThrow(/is not zero/);
    // And a real zero still parses, because "the order was free" is a thing that can be true.
    expect(parseShopifyAmount("0.00", "amount")).toBe(0);
  });

  it("refuses an amount that is not a plain decimal", () => {
    for (const bad of ["1,250.00", "฿1250", "1250.00 THB", "NaN"]) {
      expect(() => parseShopifyAmount(bad, "amount"), bad).toThrow(/not a plain decimal/);
    }
  });

  it("refuses an order with no currency rather than labelling the money wrongly", () => {
    expect(() =>
      normalize([
        {
          ...SHOPIFY_PLAIN_ORDER,
          currentTotalPriceSet: { shopMoney: { amount: "10.00" } },
        },
      ]),
    ).toThrow(/carries no currency/);
  });

  /**
   * REFUSING IS THE POINT. A connector that skipped this order would produce a day's takings that
   * are quietly too low -- the failure this product is sold against -- and nothing downstream could
   * tell that a row was missing rather than absent.
   */
  it("refuses an order with no currentTotalPriceSet rather than falling back to totalPriceSet", () => {
    expect(() => normalize([{ ...SHOPIFY_PLAIN_ORDER, currentTotalPriceSet: undefined }])).toThrow(
      /not a substitute/,
    );
  });

  it("refuses an id that is not a Shopify order gid", () => {
    for (const bad of ["", "450789469", "gid://shopify/Order/", "gid://shopify/Product/1"]) {
      expect(() => shopifyNumericId(bad || undefined), JSON.stringify(bad)).toThrow(
        ShopifyNormalizeError,
      );
    }
  });
});

describe("the shape of a row", () => {
  it("keys the entity on the numeric id a merchant can look up, not on the gid", () => {
    const [row] = normalize([SHOPIFY_PLAIN_ORDER]);
    expect(row?.entity.native_id).toBe("450789469");
    expect(row?.entity.id).toBe("shopify_450789469");
    // The gid is our plumbing. A merchant asked to check it against their orders page has been
    // handed the wrong reference.
    expect(JSON.stringify(row?.entity)).not.toContain("gid://");
  });

  it("carries the shop as the account and never a presentment currency", () => {
    const [row] = normalize([SHOPIFY_PLAIN_ORDER]);
    expect(row?.entity.account_id).toBe("example.myshopify.com");
    expect(row?.dimensions.currency).toBe("THB");
  });

  /**
   * NO WINDOW, AND THE ENVELOPE PERMITS IT ONLY BECAUSE THIS IS AN `order` ENTITY. A shop's own
   * order is attributed to nothing, so a window here would be a label with nothing to label.
   */
  it("carries no attribution window", () => {
    const [row] = normalize([SHOPIFY_PLAIN_ORDER]);
    expect(row?.dimensions.attribution_window).toBeNull();
  });

  /**
   * NO ROW IS EVER FINAL. An order can be refunded, edited or cancelled at any remove and Shopify's
   * own `current*` fields reflect all three, so there is no point at which it stops being able to
   * move. `restatesUntil` returns null and every row stays provisional, which is the honest answer.
   */
  it("marks every row provisional, because no window ever closes", () => {
    for (const row of normalize(SHOPIFY_ORDERS)) {
      expect(row.restates_until).toBeNull();
      expect(row.is_provisional).toBe(true);
    }
  });

  it("reports the per-order updatedAt, which is what the incremental pull filters on", () => {
    const [row] = normalize([SHOPIFY_REFUNDED_ORDER]);
    expect(row?.source_updated_at).toBe("2026-09-16T09:00:00.000Z");
  });

  it("converts nothing, and says so by leaving every fx field null", () => {
    const [row] = normalize([SHOPIFY_PLAIN_ORDER]);
    expect(row?.fx_source).toBeNull();
    expect(row?.fx_rate).toBeNull();
    expect(row?.fx_rate_date).toBeNull();
    expect(row?.fx_base).toBeNull();
  });

  it("names only metrics the dictionary has", () => {
    for (const row of normalize(SHOPIFY_ORDERS)) {
      expect(Object.keys(row.metrics).sort()).toEqual(["orders", "revenue"]);
    }
  });
});
