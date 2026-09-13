import type { ShopifyOrder } from "./normalize.ts";

/**
 * THE SHOPIFY GRAPHQL ADMIN CLIENT, AND THE TRAP THAT MAKES IT UNLIKE EVERY OTHER CONNECTOR HERE.
 *
 * ================================================================================================
 * AN ERROR ARRIVES AS `200 OK`
 * ================================================================================================
 *
 * This is GraphQL, so a failed query is a successful HTTP request with an `errors` array in the
 * body. Shopify's own documentation shows it: a query that costs more than the single-query
 * maximum returns 200 with `errors[0].extensions.code = "MAX_COST_EXCEEDED"`.
 *
 * Every other connector in this repository can lean on `response.ok`. This one CANNOT, and the
 * failure mode if it did is the worst available: `res.ok` is true, `data.orders` is undefined, the
 * page walker sees no orders, and the backfill records a day on which the shop sold nothing. A
 * refusal would have been obvious; a quiet zero is indistinguishable from a quiet Tuesday.
 *
 * So the body is checked before the status, and `errors` is a refusal whatever the status says.
 *
 * ================================================================================================
 * THE RATE LIMIT IS A COST BUDGET, NOT A REQUEST COUNT
 * ================================================================================================
 *
 * Shopify prices each query by the maximum number of fields it COULD return and refuses anything
 * over the single-query maximum, which its documentation gives as 1000. `first: N` multiplies the
 * cost of everything inside the connection, so the page size is the cost lever and is set low
 * deliberately: `PAGE_SIZE` of 100 against a node of eight scalar fields leaves generous headroom,
 * and the alternative -- a bigger page that occasionally trips MAX_COST_EXCEEDED -- converts a
 * throughput decision into an outage on exactly the shops with the most orders.
 *
 * THE API VERSION IS PINNED AND IS NOT A DEFAULT. Shopify versions its API in the URL path and
 * retires versions on a published schedule. A client that reached for an unversioned or "latest"
 * path would change behaviour underneath this connector without a deploy -- which is how a field
 * this normaliser depends on disappears on a Tuesday.
 */

/** The Admin API version this connector is written against. Pinned; see the module note. */
export const SHOPIFY_API_VERSION = "2026-01";

/**
 * How many orders to ask for per page.
 *
 * A COST LEVER RATHER THAN A THROUGHPUT ONE -- see the module note. Raising it raises the query's
 * calculated cost proportionally and brings MAX_COST_EXCEEDED closer, on the shops that can least
 * afford a failed sync.
 */
export const PAGE_SIZE = 100;

/**
 * The fields asked for, and nothing else.
 *
 * NO `email`, NO `customer`, NO `shippingAddress`, NO `lineItems`. The envelope carries identifiers,
 * amounts, quantities, dates, a currency and a timezone; a buyer's name and address are not part of
 * that and must not arrive in a payload, a log or a model prompt. `/privacy` says the buyer "
 * contributes nothing", and this constant is where that is true or false.
 *
 * `totalPriceSet` IS REQUESTED AND NEVER SUMMED. It is here so the normaliser can see that it
 * differs from `currentTotalPriceSet` -- which is the whole reason trap 1 exists.
 */
export const ORDER_FIELDS = `
  id
  name
  createdAt
  updatedAt
  cancelledAt
  test
  displayFinancialStatus
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  totalPriceSet { shopMoney { amount currencyCode } }
`;

export const ORDERS_QUERY = `
query Orders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
    edges { cursor node { ${ORDER_FIELDS} } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export type ShopifyClientCode =
  | "graphql_error"
  | "throttled"
  | "cost_exceeded"
  | "unauthorized"
  | "transport"
  | "malformed";

export class ShopifyClientError extends Error {
  readonly code: ShopifyClientCode;
  /** Shopify's own code, where it gave one. Never shown to a customer; kept for a support trail. */
  readonly upstream: string | null;
  constructor(message: string, code: ShopifyClientCode, upstream: string | null = null) {
    super(message);
    this.name = "ShopifyClientError";
    this.code = code;
    this.upstream = upstream;
  }
}

export interface ShopifyPage {
  readonly orders: readonly ShopifyOrder[];
  readonly cursor: string | null;
}

export interface ShopifyFetchOptions {
  /** The shop's myshopify domain, e.g. "example.myshopify.com". */
  readonly shopDomain: string;
  readonly accessToken: string;
  /** RFC3339 lower bound. Orders UPDATED at or after this, which is what catches a restatement. */
  readonly updatedSince: string;
  readonly after?: string | null;
  readonly fetch: typeof globalThis.fetch;
}

export function shopifyEndpoint(shopDomain: string): string {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    throw new ShopifyClientError(
      `shopify: ${JSON.stringify(shopDomain)} is not a myshopify domain. The endpoint is built ` +
        "from it, so accepting anything else would let a connection point this client at a host " +
        "the merchant never authorised.",
      "malformed",
    );
  }
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

/**
 * A shop's orders, one page at a time.
 *
 * THE BODY IS CHECKED BEFORE THE STATUS. See the module note: on this API a refusal is a 200.
 */
export async function fetchShopifyOrders(options: ShopifyFetchOptions): Promise<ShopifyPage> {
  const endpoint = shopifyEndpoint(options.shopDomain);

  let response: Response;
  try {
    response = await options.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Shopify's own header name. Not `Authorization: Bearer`.
        "X-Shopify-Access-Token": options.accessToken,
      },
      body: JSON.stringify({
        query: ORDERS_QUERY,
        variables: {
          first: PAGE_SIZE,
          after: options.after ?? null,
          // The documented filter syntax on this connection. `>=` rather than `>` so a restatement
          // landing on the same second as the watermark is not skipped.
          query: `updated_at:>=${options.updatedSince}`,
        },
      }),
    });
  } catch (cause) {
    // The cause is NOT attached. A fetch error's `cause` is one hop from carrying the request, and
    // the request carries the access token.
    throw new ShopifyClientError("shopify: the request did not complete.", "transport");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShopifyClientError("shopify: the response was not JSON.", "malformed");
  }

  const errors = (
    body as { errors?: readonly { message?: string; extensions?: { code?: string } }[] }
  ).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const code = errors[0]?.extensions?.code ?? null;
    if (code === "MAX_COST_EXCEEDED") {
      throw new ShopifyClientError(
        "shopify: the query cost more than a single query may. PAGE_SIZE is the lever.",
        "cost_exceeded",
        code,
      );
    }
    if (code === "THROTTLED") {
      throw new ShopifyClientError("shopify: throttled.", "throttled", code);
    }
    throw new ShopifyClientError("shopify: the API refused the query.", "graphql_error", code);
  }

  // Only now does the status matter -- 401 and 402 arrive without an `errors` array.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ShopifyClientError(
        "shopify: the credential was refused. It has been revoked, or its scopes changed.",
        "unauthorized",
      );
    }
    throw new ShopifyClientError(`shopify: HTTP ${response.status}.`, "transport");
  }

  const connection = (body as { data?: { orders?: { edges?: unknown; pageInfo?: unknown } } }).data
    ?.orders;

  // ABSENT IS NOT EMPTY. A missing `orders` connection on a response that carried no errors means
  // the shape changed underneath us, and reading it as "no orders" is precisely the quiet zero this
  // module's note is about.
  if (connection === undefined || !Array.isArray(connection.edges)) {
    throw new ShopifyClientError(
      "shopify: the response carried no orders connection. That is not the same as no orders.",
      "malformed",
    );
  }

  const page = connection.pageInfo as { hasNextPage?: boolean; endCursor?: string } | undefined;

  return {
    orders: (connection.edges as { node?: ShopifyOrder }[]).map((edge) => edge.node ?? {}),
    // The cursor is returned only when there IS a next page, so a caller cannot loop for ever on a
    // stale cursor that Shopify keeps echoing back.
    cursor: page?.hasNextPage === true ? (page.endCursor ?? null) : null,
  };
}
