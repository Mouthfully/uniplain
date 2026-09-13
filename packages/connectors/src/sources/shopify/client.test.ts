import { describe, expect, it } from "vitest";

import { SHOPIFY_PLAIN_ORDER } from "./fixtures.ts";
import {
  ORDER_FIELDS,
  PAGE_SIZE,
  SHOPIFY_API_VERSION,
  ShopifyClientError,
  fetchShopifyOrders,
  shopifyEndpoint,
} from "./client.ts";

const BASE = {
  shopDomain: "example.myshopify.com",
  accessToken: "shpat_NOTAREALTOKEN",
  updatedSince: "2026-09-01T00:00:00Z",
};

/** A fetch that answers once with whatever body and status a test needs. */
function answering(body: unknown, status = 200, capture?: { request?: RequestInit }) {
  return (async (_url: string, init?: RequestInit) => {
    if (capture) capture.request = init;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;
}

function page(orders: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return {
    data: {
      orders: {
        edges: orders.map((node, index) => ({ cursor: `c${index}`, node })),
        pageInfo: { hasNextPage, endCursor },
      },
    },
  };
}

describe("the trap that makes this client unlike the others", () => {
  /**
   * ON THIS API A REFUSAL IS A 200.
   *
   * Shopify's documentation shows MAX_COST_EXCEEDED arriving as `200 OK` with an `errors` array.
   * A client that trusted `response.ok` would see success, find no `orders`, and report a day on
   * which the shop sold nothing. A refusal is obvious; a quiet zero is indistinguishable from a
   * quiet Tuesday, which is the failure this product is sold against.
   */
  it("refuses a GraphQL error that arrived as 200 OK", async () => {
    const body = {
      errors: [
        {
          message: "Query cost is 2003, which exceeds the single query max cost limit (1000).",
          extensions: { code: "MAX_COST_EXCEEDED", cost: 2003, maxCost: 1000 },
        },
      ],
    };
    await expect(fetchShopifyOrders({ ...BASE, fetch: answering(body, 200) })).rejects.toThrow(
      ShopifyClientError,
    );
    await expect(
      fetchShopifyOrders({ ...BASE, fetch: answering(body, 200) }),
    ).rejects.toMatchObject({ code: "cost_exceeded", upstream: "MAX_COST_EXCEEDED" });
  });

  it("tells a throttle apart from a cost refusal, because the remedies differ", async () => {
    const body = { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] };
    await expect(
      fetchShopifyOrders({ ...BASE, fetch: answering(body, 200) }),
    ).rejects.toMatchObject({ code: "throttled" });
  });

  /**
   * ABSENT IS NOT EMPTY. A response that carried no errors and no `orders` connection means the
   * shape changed underneath us. Reading it as "no orders" is the same quiet zero one layer along.
   */
  it("refuses a response with no orders connection rather than reading it as no orders", async () => {
    await expect(
      fetchShopifyOrders({ ...BASE, fetch: answering({ data: {} }, 200) }),
    ).rejects.toMatchObject({ code: "malformed" });
  });

  it("returns an empty page when the shop genuinely has no orders", async () => {
    const result = await fetchShopifyOrders({ ...BASE, fetch: answering(page([]), 200) });
    expect(result.orders).toEqual([]);
    expect(result.cursor).toBeNull();
  });
});

describe("what the client asks for", () => {
  /**
   * NO BUYER, ANYWHERE IN THE SELECTION SET.
   *
   * The envelope carries identifiers, amounts, quantities, dates, a currency and a timezone.
   * `/privacy` says the person behind an order "contributes nothing", and this constant is where
   * that sentence is true or false. Shopify's Order object offers every one of these fields; not
   * asking is the whole control.
   */
  it("asks for no field that carries a buyer", () => {
    for (const field of [
      "email",
      "phone",
      "customer",
      "shippingAddress",
      "billingAddress",
      "customerJourney",
      "clientIp",
      "lineItems",
      "note",
    ]) {
      expect(ORDER_FIELDS, `${field} is in the selection set`).not.toContain(field);
    }
  });

  it("asks for both totals, because seeing them differ is the point", () => {
    expect(ORDER_FIELDS).toContain("currentTotalPriceSet");
    expect(ORDER_FIELDS).toContain("totalPriceSet");
    // Shop money only. Presentment is what the buyer saw in their own currency, and keeping both
    // invites a reader to sum the wrong one.
    expect(ORDER_FIELDS).not.toContain("presentmentMoney");
  });

  it("filters on updated_at, which is what catches a restatement", async () => {
    const capture: { request?: RequestInit } = {};
    await fetchShopifyOrders({ ...BASE, fetch: answering(page([]), 200, capture) });
    const body = JSON.parse(String(capture.request?.body));
    expect(body.variables.query).toBe("updated_at:>=2026-09-01T00:00:00Z");
    expect(body.variables.first).toBe(PAGE_SIZE);
  });

  it("sends the token in Shopify's own header, not as a bearer", async () => {
    const capture: { request?: RequestInit } = {};
    await fetchShopifyOrders({ ...BASE, fetch: answering(page([]), 200, capture) });
    const headers = capture.request?.headers as Record<string, string>;
    expect(headers["X-Shopify-Access-Token"]).toBe(BASE.accessToken);
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("the endpoint", () => {
  it("is built from the shop domain and pins the API version", () => {
    expect(shopifyEndpoint("example.myshopify.com")).toBe(
      `https://example.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    );
  });

  /**
   * A DOMAIN THAT IS NOT A MYSHOPIFY DOMAIN IS A HOST THE MERCHANT NEVER AUTHORISED. The endpoint
   * is built from stored connection state, and an unchecked value there points this client --
   * carrying the access token -- wherever that value says.
   */
  it("refuses anything that is not a myshopify domain", () => {
    for (const bad of [
      "evil.test",
      "example.myshopify.com.evil.test",
      "https://example.myshopify.com",
      "example.myshopify.com/admin",
      "",
    ]) {
      expect(() => shopifyEndpoint(bad), JSON.stringify(bad)).toThrow(ShopifyClientError);
    }
  });
});

describe("paging", () => {
  it("returns a cursor only when there is another page", async () => {
    const more = await fetchShopifyOrders({
      ...BASE,
      fetch: answering(page([SHOPIFY_PLAIN_ORDER], true, "abc"), 200),
    });
    expect(more.cursor).toBe("abc");

    // Shopify keeps echoing `endCursor` on the last page. Returning it would loop for ever.
    const last = await fetchShopifyOrders({
      ...BASE,
      fetch: answering(page([SHOPIFY_PLAIN_ORDER], false, "abc"), 200),
    });
    expect(last.cursor).toBeNull();
  });
});

describe("what never reaches an error", () => {
  it("does not put the token or the response in the message it throws", async () => {
    const failing = (async () => {
      throw new Error(`connect ECONNREFUSED, token=${BASE.accessToken}`);
    }) as unknown as typeof globalThis.fetch;

    const error = await fetchShopifyOrders({ ...BASE, fetch: failing }).catch((e) => e);
    expect(error).toBeInstanceOf(ShopifyClientError);
    expect(JSON.stringify({ message: error.message, cause: error.cause })).not.toContain(
      BASE.accessToken,
    );
  });
});
