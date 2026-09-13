import { optionalClaim } from "../_content";

/**
 * EVERY PUBLIC PAGE, ONCE, SO THE FOUR THINGS THAT DESCRIBE THIS SITE CANNOT DISAGREE.
 *
 * The sitemap, `llms.txt`, the per-page markdown and the `rel="alternate"` links are four
 * statements about the same set of pages, written for four different readers. Before this module
 * they were going to be four hand-kept lists, which is the arrangement that produced the defect
 * this file was written after: `sitemap.ts` listed EIGHT of the fourteen indexable routes, and the
 * six it omitted included five of the six connector pages -- exactly the pages an agent asked "does
 * this product read Google Ads?" needs to find. Nothing failed, because nothing compared the list
 * to the filesystem.
 *
 * `registry.test.ts` now does compare it, in both directions, against `app/**` on disk. A route
 * added without an entry fails; an entry naming a route that does not exist fails; an entry for a
 * page carrying `robots: { index: false }` fails, because a private page in a machine-readable
 * index is worse than an absent one.
 *
 * WHY CAPABILITIES ARE CLAIM IDS AND NOT SENTENCES. This is the part that matters more than the
 * file format. `llms.txt` is a summary of the product written to be read by machines and quoted by
 * them, which makes it the single easiest place in this repository to restate a promise the
 * capability gate is deliberately withholding -- the same hole `withheld-claims.test.tsx` exists to
 * close one level up, where a withheld claim was rewritten as hand-typed section copy and rendered
 * anyway. So no capability is ever typed here. Each is an id into `@repo/brand`'s claim table, read
 * through `optionalClaim`, which returns null for a claim whose supporting capability has not
 * launched. A withheld claim therefore disappears from the machine-readable surface by the same
 * mechanism, and on the same day, as it disappears from the page.
 *
 * `summary` IS PROSE AND IS ALLOWED TO BE. It describes what a page IS, not what the product can
 * do -- "the pricing page and what each plan includes" is navigation, not a promise. The moment a
 * summary starts making a capability claim it belongs in `CLAIMS` instead, and the test that scans
 * this file for `FORBIDDEN_CLAIMS` is what catches the drift.
 */
export interface AgentPage {
  /** The route as it is served, with no trailing slash. `/` is the home page. */
  readonly path: string;
  /** The H1 of the markdown rendering, and the link text in `llms.txt`. */
  readonly title: string;
  /** One sentence saying what the page is. Navigation, never a capability promise. */
  readonly summary: string;
  /** Claim ids from `@repo/brand`. Withheld claims are dropped, never substituted. */
  readonly claims: readonly string[];
  /** Sitemap hints. Coarse on purpose; see `sitemap.ts` on why priority is not invented per page. */
  readonly changeFrequency: "weekly" | "monthly" | "yearly";
  readonly priority: number;
}

export const AGENT_PAGES: readonly AgentPage[] = [
  {
    path: "/",
    title: "Overview",
    summary:
      "What this product does, who it is for, and the four steps from a connected account to a decision.",
    claims: ["tagline", "positioning", "connectors", "reconcile", "diagnose", "verified-alerts"],
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/pricing",
    title: "Pricing",
    summary: "The plans, what each one includes, and how usage is counted.",
    claims: ["pricing-two-units", "billing-fairness"],
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: "/integrations",
    title: "Integrations",
    summary: "The platforms this product can read, and what it reads from each.",
    claims: ["connectors", "byoc", "read-only-oauth"],
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/envelope",
    title: "The row shape",
    summary:
      "The single normalised shape every connected platform's data is turned into, field by field.",
    claims: ["one-shape", "freshness-fields", "fx-on-row", "attribution-required"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/docs",
    title: "Documentation",
    summary: "How to connect an account, what happens on each nightly read, and the API surface.",
    claims: ["one-shape"],
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/fields/google-ads",
    title: "Google Ads fields",
    summary: "Every Google Ads field this product reads, and the normalised field it becomes.",
    claims: ["byoc", "attribution-required"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/ga4",
    title: "Google Analytics 4 connector",
    summary: "What this product reads from a Google Analytics 4 property, and how it connects.",
    claims: ["byoc", "read-only-oauth"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/google-ads",
    title: "Google Ads connector",
    summary: "What this product reads from a Google Ads account, and how it connects.",
    claims: ["byoc", "read-only-oauth"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/meta-ads",
    title: "Meta Ads connector",
    summary: "What this product reads from a Meta ad account, and how it connects.",
    claims: ["byoc", "read-only-oauth"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/search-console",
    title: "Search Console connector",
    summary: "What this product reads from a Search Console property, and how it connects.",
    claims: ["byoc", "read-only-oauth"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/shopify",
    title: "Shopify connector",
    summary: "What this product reads from a Shopify store, and how it connects.",
    claims: ["byoc"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/connectors/woocommerce",
    title: "WooCommerce connector",
    summary: "What this product reads from a WooCommerce store, and how it connects.",
    claims: ["byoc"],
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/terms",
    title: "Terms of service",
    summary: "The contract between this company and a customer of the product.",
    claims: [],
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/privacy",
    title: "Privacy notice",
    summary:
      "What personal data this company holds, on what basis, where it goes, and how to ask about it.",
    claims: ["tenant-isolation", "no-pooling", "no-training"],
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

/**
 * The claim sentences a page may publish, with withheld ones dropped.
 *
 * DROPPED AND NOT SUBSTITUTED. `optionalClaim` returns null for a claim whose capability has not
 * launched, and the null is filtered out rather than replaced by a softer sentence -- a softer
 * sentence is the withheld claim with the gate routed around it.
 */
export function publishableClaims(page: AgentPage): readonly string[] {
  return page.claims.map((id) => optionalClaim(id)).filter((text): text is string => text !== null);
}

/** The `.md` twin of a route, per the llms.txt convention: extension replaced, or appended to `/`. */
export function markdownPath(path: string): string {
  return path === "/" ? "/index.md" : `${path}.md`;
}
