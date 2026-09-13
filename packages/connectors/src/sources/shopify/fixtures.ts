import type { ShopifyOrder } from "./normalize.ts";

/**
 * Fixtures, shaped exactly as the GraphQL Admin API returns them.
 *
 * THE ORDER NAMES CARRY A PREFIX, AND THAT IS NOT DECORATION. Shopify's default order name is
 * a hash and four digits -- indistinguishable from a colour literal to any
 * scanner, and `check-tokens.mjs` duly failed the build on it. Weakening a colour guard to
 * accommodate a fixture is the wrong trade: the guard cannot tell them apart and should not have to
 * try. A merchant-set prefix is a real Shopify feature, so the fixtures use one.
 *
 * EVERY ONE OF THESE IS A CASE THE NORMALISER MUST GET RIGHT, not a happy path with variations.
 * The gid form, the decimal-string money, the shop/presentment split, the `current*` divergence
 * after a refund and the `test` flag are all real properties of the API rather than invented
 * awkwardness -- which is why the traps in `normalize.ts` cite the documentation for each.
 */

/** An ordinary paid order. Nothing has moved since it was placed, so current equals total. */
export const SHOPIFY_PLAIN_ORDER: ShopifyOrder = {
  id: "gid://shopify/Order/450789469",
  name: "#TH1001",
  createdAt: "2026-09-10T04:30:00Z",
  updatedAt: "2026-09-10T04:30:00Z",
  cancelledAt: null,
  test: false,
  displayFinancialStatus: "PAID",
  currentTotalPriceSet: { shopMoney: { amount: "1250.00", currencyCode: "THB" } },
  totalPriceSet: { shopMoney: { amount: "1250.00", currencyCode: "THB" } },
};

/**
 * THE ONE THAT MATTERS. Half of it was refunded a week after the sale.
 *
 * `totalPriceSet` still reads 2000 -- that is what the buyer was charged and it never moves.
 * `currentTotalPriceSet` reads 1000, because Shopify documents the `current*` family as reflecting
 * "returns, refunds, order edits, and cancellations". A connector reading the first would report
 * this shop's revenue as 2000 for ever.
 */
export const SHOPIFY_REFUNDED_ORDER: ShopifyOrder = {
  id: "gid://shopify/Order/450789470",
  name: "#TH1002",
  createdAt: "2026-09-09T11:05:00Z",
  updatedAt: "2026-09-16T09:00:00Z",
  cancelledAt: null,
  test: false,
  displayFinancialStatus: "PARTIALLY_REFUNDED",
  currentTotalPriceSet: { shopMoney: { amount: "1000.00", currencyCode: "THB" } },
  totalPriceSet: { shopMoney: { amount: "2000.00", currencyCode: "THB" } },
};

/** Placed, then cancelled. It still happened, so it is still an order; the money is already nil. */
export const SHOPIFY_CANCELLED_ORDER: ShopifyOrder = {
  id: "gid://shopify/Order/450789471",
  name: "#TH1003",
  createdAt: "2026-09-08T02:00:00Z",
  updatedAt: "2026-09-08T06:00:00Z",
  cancelledAt: "2026-09-08T06:00:00Z",
  test: false,
  displayFinancialStatus: "REFUNDED",
  currentTotalPriceSet: { shopMoney: { amount: "0.00", currencyCode: "THB" } },
  totalPriceSet: { shopMoney: { amount: "780.00", currencyCode: "THB" } },
};

/** A developer pressing buttons with the gateway in test mode. It never existed commercially. */
export const SHOPIFY_TEST_ORDER: ShopifyOrder = {
  id: "gid://shopify/Order/450789472",
  name: "#TH1004",
  createdAt: "2026-09-10T05:00:00Z",
  updatedAt: "2026-09-10T05:00:00Z",
  cancelledAt: null,
  test: true,
  displayFinancialStatus: "PAID",
  currentTotalPriceSet: { shopMoney: { amount: "999999.00", currencyCode: "THB" } },
  totalPriceSet: { shopMoney: { amount: "999999.00", currencyCode: "THB" } },
};

/**
 * LATE ENOUGH IN UTC TO BE THE NEXT DAY IN BANGKOK, AND EARLY ENOUGH TO BE THE PREVIOUS ONE.
 * 2026-09-11T18:30:00Z is 2026-09-12 01:30 in Asia/Bangkok. A connector bucketing on the UTC date
 * moves this shop's late-evening takings into the wrong day, for the orders near the boundary only.
 */
export const SHOPIFY_EVENING_ORDER: ShopifyOrder = {
  id: "gid://shopify/Order/450789473",
  name: "#TH1005",
  createdAt: "2026-09-11T18:30:00Z",
  updatedAt: "2026-09-11T18:30:00Z",
  cancelledAt: null,
  test: false,
  displayFinancialStatus: "PAID",
  currentTotalPriceSet: { shopMoney: { amount: "430.50", currencyCode: "THB" } },
  totalPriceSet: { shopMoney: { amount: "430.50", currencyCode: "THB" } },
};

export const SHOPIFY_ORDERS: readonly ShopifyOrder[] = [
  SHOPIFY_PLAIN_ORDER,
  SHOPIFY_REFUNDED_ORDER,
  SHOPIFY_CANCELLED_ORDER,
  SHOPIFY_TEST_ORDER,
  SHOPIFY_EVENING_ORDER,
];
