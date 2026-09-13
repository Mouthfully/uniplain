import { IMPLEMENTED_SOURCE_IDS, type ImplementedSourceId, SOURCE_LABELS } from "@repo/brand";

/**
 * WHICH CONNECTOR A FIGURE CAME FROM, AND THE ARTWORK FOR IT WHERE ARTWORK EXISTS.
 *
 * The action cards state an impact and a one-line provenance note -- "From your own prices and last
 * month's volume". That sentence is the right claim and it is prose: nothing checks it, and nothing
 * stops the next person writing a note that names a connector this product cannot read. Showing the
 * SOURCES as ids turns the same claim into something `source-marks.test.tsx` can hold against
 * `IMPLEMENTED_SOURCE_IDS`, which `check-capabilities.mjs` already holds against the source tree.
 *
 * SO THE RULE IS: A SOURCE ON A CARD IS AN ID, NEVER A TYPED NAME. The label comes from
 * `SOURCE_LABELS` in `@repo/brand` -- the same map the connector claim is built from -- so a card
 * cannot name a platform the claim gate would withhold.
 *
 * WHY THIS IS NOT §5.1's BANNED LOGO ROW. `docs/marketplane/58-plan-reconciliation.md` section 5.1
 * says to stop listing FoodStory, Ocha, StoreHub, GrabFood, foodpanda, LINE MAN, Booking.com,
 * K PLUS, SCB, Shopee, Lazada and TikTok Shop as sources "in any form -- logo, chip, 'planned' row
 * or FAQ sentence -- unless each is explicitly marked as not built and not reachable". Every one of
 * those is a connector that does not exist. The ban is on advertising reach the product does not
 * have; it is not a ban on saying where a figure came from. The type here is
 * `ImplementedSourceId`, so a banned platform cannot be expressed, and the test asserts the set
 * rather than trusting the type to survive a cast.
 *
 * ARTWORK IS OPTIONAL AND ITS ABSENCE IS THE INTERESTING CASE. Four of the seven implemented
 * sources have a file in `public/platforms`; Loyverse, Search Console and WooCommerce do not.
 * A placeholder mark for those three would be artwork this repository invented for somebody else's
 * trademark, so they render as a label with no mark -- which is the same refusal the rest of the
 * codebase makes about a figure it cannot trace. `sourceMark` returns `null` for the slug rather
 * than a default, and the test proves a missing file is caught rather than rendered as a broken
 * image.
 */

export interface SourceMark {
  readonly id: ImplementedSourceId;
  /** The name a customer recognises, from the same map the connector claim is built from. */
  readonly label: string;
  /**
   * The artwork file's basename in `public/platforms`, or `null` where none ships.
   *
   * NOT DERIVED FROM THE ID. `ga4` is `googleanalytics.svg` and `meta_ads` is `meta.svg`; a rule
   * that stripped underscores would find neither, and one that guessed would produce a 404 at the
   * moment a visitor is being asked to trust the provenance.
   */
  readonly slug: string | null;
}

/**
 * Artwork for the sources that ship with a file. Absent means absent, not "not looked up yet".
 *
 * `Partial` on purpose: adding an entry here for a file that does not exist fails the test, and so
 * does shipping a file for a source and forgetting to list it.
 */
const SOURCE_ARTWORK: Partial<Record<ImplementedSourceId, string>> = {
  ga4: "googleanalytics",
  google_ads: "googleads",
  meta_ads: "meta",
  shopify: "shopify",
};

export function sourceMark(id: ImplementedSourceId): SourceMark {
  return { id, label: SOURCE_LABELS[id], slug: SOURCE_ARTWORK[id] ?? null };
}

/**
 * Narrow a figure's sources to the connectors this product actually reads.
 *
 * `Figure.sources` is typed `Source`, and `SOURCES` in `@repo/contract` is a WIDER union than
 * `IMPLEMENTED_SOURCE_IDS` -- it carries `impact`, `awin`, `cj`, `partnerstack`, `dataforseo_serp`
 * and `ai_answers`, none of which is a built connector. A figure legitimately computed from
 * `dataforseo_serp` would therefore hand this module a source that must never render as a chip,
 * and §5.1's ban is on exactly that: a platform advertised as a source before it exists.
 *
 * So the narrowing DROPS rather than passes through, and `source-marks.test.tsx` proves the drop
 * with a source that is in `SOURCES` and not in `IMPLEMENTED_SOURCE_IDS`. A filter that silently
 * let one through would put an unbuilt platform's name on the home page.
 */
export function implementedSources(sources: readonly string[]): readonly ImplementedSourceId[] {
  const allowed = IMPLEMENTED_SOURCE_IDS as readonly string[];
  return sources.filter((s): s is ImplementedSourceId => allowed.includes(s));
}

/** Every source the artwork map claims a file for, so a test can check each one exists on disk. */
export function artworkSlugs(): readonly string[] {
  return Object.values(SOURCE_ARTWORK);
}
