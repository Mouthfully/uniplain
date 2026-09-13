import { AGENT_PAGES } from "./_agent/registry";

/**
 * THE FOOTER'S LINK COLUMNS, BUILT FROM THE ROUTE REGISTRY RATHER THAN KEPT BY HAND.
 *
 * Every hand-kept list of routes in this repository has drifted, and each one drifted the same way:
 * it was written when it was true, pages shipped beside it, and nothing compared the list to the
 * filesystem. `sitemap.ts` listed eight of fourteen indexable routes. `robots.ts` disallowed two of
 * seven private ones. The footer itself linked `/terms` and `/privacy` while `/dpa`,
 * `/processing` and `/sub-processors` shipped unlinked -- underneath a comment saying a policy
 * reachable only by typing its URL is not published in any sense a regulator would accept.
 *
 * `AGENT_PAGES` is the list `registry.test.ts` already holds against `app/**` in both directions, so
 * a route added without an entry fails the build. Grouping THAT list, rather than writing a sixth
 * one, means a new public page cannot be unlinked from the footer without a named test going red:
 * `FOOTER_GROUPS` must account for every registry path exactly once.
 *
 * A PAGE MAY BE LEFT OUT, BUT ONLY IN WRITING. `FOOTER_UNLISTED` is the escape hatch and it is
 * empty today. An omission belongs there with its reason beside it, because the failure this whole
 * module is about is an omission nobody made a decision about.
 *
 * LABELS ARE THE PAGES' OWN TITLES. Not retyped here, not written twice. A retyped label is a
 * second thing to keep in step with the page it points at, and the drift it produces is silent: the
 * link still works, it just describes a page that has since been renamed. `trimSuffix` may remove a
 * word the column heading already supplies -- "Google Ads connector" under "Connectors" -- and may
 * only remove, never add or replace, so every rendered label is a prefix of the title it came from.
 * `footer-links.test.tsx` asserts that property rather than trusting the helper.
 */
export interface FooterLink {
  readonly href: string;
  readonly label: string;
}

export interface FooterGroup {
  readonly id: string;
  /** A column heading. A noun phrase, so `check-copy` has nothing to refuse. */
  readonly heading: string;
  /** Registry paths, in the order they should read. Labels come from the registry, not from here. */
  readonly paths: readonly string[];
  /** Removed from the end of a title when present. Only ever removes; see the note above. */
  readonly trimSuffix?: string;
  /**
   * Routes with no `page.tsx` and therefore no registry entry: the machine-readable files. These
   * ARE hand-written, because a filename is its own label and there is no title to draw on. The
   * test checks the route module exists and that none of them points at a signed-in surface.
   */
  readonly files?: readonly FooterLink[];
}

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    id: "product",
    heading: "Product",
    paths: ["/", "/pricing", "/integrations"],
  },
  {
    id: "connectors",
    heading: "Connectors",
    // Six titles ending in the word the heading already says. Removed, not rewritten.
    trimSuffix: " connector",
    paths: [
      "/connectors/ga4",
      "/connectors/google-ads",
      "/connectors/meta-ads",
      "/connectors/search-console",
      "/connectors/shopify",
      "/connectors/woocommerce",
    ],
  },
  {
    id: "reference",
    heading: "Reference",
    paths: ["/docs", "/envelope", "/fields/google-ads"],
    // THE MACHINE-READABLE SURFACE, LINKED WHERE A PERSON CAN SEE IT TOO. `llms.txt` and the two
    // generated files are the pages an agent reads, and they were reachable only by knowing the
    // convention. A human evaluating whether this site is legible to an agent has no way to check
    // that from the site; now they do.
    files: [
      { href: "/llms.txt", label: "llms.txt" },
      { href: "/sitemap.xml", label: "sitemap.xml" },
      { href: "/robots.txt", label: "robots.txt" },
    ],
  },
  {
    id: "segments",
    heading: "By business",
    paths: ["/for/cafe", "/for/online-shop", "/for/salon"],
  },
  {
    id: "legal",
    heading: "Trust and legal",
    // THE COLUMN A REVIEWER OPENS BEFORE A PURCHASE, and the reason this file's predecessor was
    // written. `/dpa` is the one whose absence costs the sale outright: PDPA s.40 puts the duty to
    // hold a processor agreement on the CUSTOMER, and a reviewer who cannot find one concludes this
    // vendor cannot be appointed at all.
    paths: ["/security", "/processing", "/sub-processors", "/dpa", "/terms", "/privacy"],
  },
];

/**
 * Registry pages deliberately kept out of the footer, each with the reason it is out.
 *
 * Empty, and that is the honest state: every public page this product has is worth linking from
 * every page of it. The constant exists so that leaving one out is a decision somebody wrote down
 * rather than a gap nobody noticed.
 */
export const FOOTER_UNLISTED: readonly string[] = [];

/**
 * The links a column renders.
 *
 * THROWS on a path with no registry entry rather than skipping it. A skipped link is the defect
 * this module exists to prevent, arrived at from the other direction: the column renders, the page
 * is missing from it, and nothing says so. `AGENT_PAGES` is a build-time constant, so this throws
 * during the build -- which is where a mistake in a list of routes should stop.
 */
export function footerLinks(group: FooterGroup): readonly FooterLink[] {
  const fromRegistry = group.paths.map((path) => {
    const page = AGENT_PAGES.find((entry) => entry.path === path);
    if (page === undefined) {
      throw new Error(`footer group "${group.id}" lists ${path}, which is not a registered page`);
    }
    const suffix = group.trimSuffix;
    const label =
      suffix !== undefined && page.title.endsWith(suffix)
        ? page.title.slice(0, -suffix.length)
        : page.title;
    return { href: page.path, label };
  });
  return [...fromRegistry, ...(group.files ?? [])];
}

/** Every href the footer renders, columns and files alike. */
export function footerHrefs(): readonly string[] {
  return FOOTER_GROUPS.flatMap((group) => footerLinks(group).map((link) => link.href));
}
