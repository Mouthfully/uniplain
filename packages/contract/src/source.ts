/**
 * Every source the envelope can carry a row from.
 *
 * Scope is section 11.9's narrowing, not the artboard's twenty-two: Google Ads, GA4, Search Console,
 * Meta and one affiliate network, with SERP bought wholesale from DataForSEO. There is deliberately
 * no `market` source -- section 11.5 drops that module -- and no TikTok, Microsoft or Amazon, which
 * section 9's exclusion list defers.
 */
export const SOURCES = [
  "google_ads",
  "meta_ads",
  "ga4",
  "search_console",
  "impact",
  "awin",
  "cj",
  "partnerstack",
  "dataforseo_serp",
  "ai_answers",

  // 11A.14 substituted the LAUNCH SET, not the vocabulary. `woocommerce` is APPENDED, never
  // inserted, and nothing above it is removed: Postgres orders an enum by definition order, so a
  // mid-list insert would silently rewrite every ORDER BY on the column, and dropping a value is
  // a migration hazard with no upside. Google Ads, Meta and Search Console stay in the dictionary
  // and move behind the fifth-connector gate -- a build order is not a vocabulary.
  "woocommerce",

  // APPENDED AGAIN, under the same rule and for the same reason. `loyverse` is the pilot
  // point-of-sale: of every POS the plan names, it is the only one a Thai owner-operator can
  // authorise themselves today, under granular `*_READ` OAuth scopes
  // (`58-plan-reconciliation.md` sections 1.5 and 2.1). Appended last, never inserted -- see the
  // note above. `app.envelope_source` is altered to match in
  // `20260913000300_loyverse_provider.sql`.
  "loyverse",

  // APPENDED AGAIN, under the same rule and for the same reason as the two above -- an enum is
  // ordered by definition order in Postgres, so a mid-list insert silently rewrites every ORDER BY
  // on the column.
  //
  // `shopify` was slot 3 of 11A.14's launch set all along -- `metrics.ts` names it in the comment
  // that introduced the commerce grain, beside WooCommerce and a payment gateway. What made it
  // urgent is that `/connectors/shopify` has been a full landing page since the site shipped --
  // headline, feature grid and a connect button -- for a platform nothing in this repository could
  // read. A page
  // that invites a merchant to connect something the product cannot read is the worst kind of
  // claim there is: it ends in a button.
  "shopify",
] as const;

export type Source = (typeof SOURCES)[number];
