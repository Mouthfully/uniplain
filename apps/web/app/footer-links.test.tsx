import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AGENT_PAGES, PRIVATE_PATHS } from "./_agent/registry";
import {
  FOOTER_GROUPS,
  FOOTER_UNLISTED,
  type FooterGroup,
  footerHrefs,
  footerLinks,
} from "./_footer-links";

/**
 * THE SIXTH HAND-KEPT LIST OF ROUTES, AND WHY IT IS NOT ONE.
 *
 * Five have drifted in this repository and every one drifted identically. `sitemap.ts` listed eight
 * of fourteen indexable routes and the six it omitted were mostly connector pages. `robots.ts`
 * disallowed two of seven private ones. `IntegrationsStrip` lists nine platforms this product does
 * not read. The footer linked two policies while three shipped beside them unlinked. None of them
 * was wrong when it was written; each was compared to nothing afterwards.
 *
 * So the assertion that matters is the FIRST one below, and it is the only reason this file exists:
 * every registry page is in a footer column or is written down as deliberately left out. A new
 * public page added to `AGENT_PAGES` -- which `registry.test.ts` already forces on anyone adding a
 * route -- goes red here until somebody decides where it belongs. The decision is the point. The
 * defect was never a missing link; it was a link nobody chose not to add.
 *
 * The rest hold the mechanism to the standard the register claims for itself: labels come from the
 * pages rather than being retyped, every href is a route that exists, and no column reaches a
 * signed-in surface.
 */

const registryPaths = new Set(AGENT_PAGES.map((page) => page.path));
const grouped = FOOTER_GROUPS.flatMap((group) => group.paths);

describe("the footer accounts for every public page", () => {
  it("has columns and pages to compare, so the assertions below are not vacuous", () => {
    expect(FOOTER_GROUPS.length).toBeGreaterThan(1);
    expect(AGENT_PAGES.length).toBeGreaterThan(10);
  });

  it("puts every registered page in a column or writes down why it is out", () => {
    // THE ASSERTION THIS FILE EXISTS FOR.
    const accounted = new Set([...grouped, ...FOOTER_UNLISTED]);
    const missing = [...registryPaths].filter((path) => !accounted.has(path));
    expect(
      missing,
      `these public pages are linked from no column and named in no exception: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("names no page twice, so a column is not quietly a duplicate of another", () => {
    const seen = grouped.filter((path, index) => grouped.indexOf(path) !== index);
    expect(seen, `listed in more than one column: ${seen.join(", ")}`).toEqual([]);
  });

  it("names no page that is not registered", () => {
    // `footerLinks` throws on one rather than dropping it. Asserted through the helper because the
    // throw IS the behaviour: a column that silently renders one link short is the original defect.
    const unknown: FooterGroup = { id: "test", heading: "Test", paths: ["/not-a-page"] };
    expect(() => footerLinks(unknown)).toThrow(/not a registered page/);
  });

  it("keeps the exception list a decision rather than a dumping ground", () => {
    for (const path of FOOTER_UNLISTED) {
      expect(registryPaths, `${path} is excepted from a list it was never on`).toContain(path);
    }
  });
});

describe("a link says what the page it points at says", () => {
  it("draws every label from the page's own title", () => {
    // A retyped label drifts silently: the link still works and describes a page that was renamed.
    // `trimSuffix` may only REMOVE from the end, so a label is always a prefix of the real title --
    // which is the property asserted, rather than trusting the helper to have only removed.
    for (const group of FOOTER_GROUPS) {
      for (const path of group.paths) {
        const page = AGENT_PAGES.find((entry) => entry.path === path);
        const link = footerLinks(group).find((candidate) => candidate.href === path);
        expect(link, `${path} renders no link`).toBeDefined();
        expect(
          page?.title.startsWith(link?.label ?? ""),
          `"${link?.label}" is not what "${page?.title}" says; it was written rather than derived`,
        ).toBe(true);
        expect(link?.label.length, `${path} renders an empty label`).toBeGreaterThan(0);
      }
    }
  });

  it("leaves a title alone when the suffix it would trim is not there", () => {
    const connectors = FOOTER_GROUPS.find((group) => group.id === "connectors");
    expect(connectors?.trimSuffix).toBeDefined();
    expect(footerLinks({ ...(connectors as FooterGroup), paths: ["/pricing"] })[0]?.label).toBe(
      "Pricing",
    );
  });
});

describe("every href is a route that exists", () => {
  it("links a page.tsx for every registry path", () => {
    // A footer link to a 404 is worse than no link: it reads as a document that was withdrawn.
    for (const path of grouped) {
      const page = new URL(`.${path === "/" ? "" : path}/page.tsx`, import.meta.url).pathname;
      expect(existsSync(page), `the footer links ${path}, which has no page.tsx`).toBe(true);
    }
  });

  it("links a route module for every machine-readable file", () => {
    // These bypass the registry -- they have no page.tsx and so no entry -- which is exactly why
    // they need checking here. `/sitemap.xml` and `/robots.txt` are emitted by `sitemap.ts` and
    // `robots.ts`; `/llms.txt` is a route handler.
    const modules: Readonly<Record<string, string>> = {
      "/llms.txt": "./llms.txt/route.ts",
      "/sitemap.xml": "./sitemap.ts",
      "/robots.txt": "./robots.ts",
    };
    const files = FOOTER_GROUPS.flatMap((group) => group.files ?? []);
    expect(files.length, "no machine-readable file is linked").toBeGreaterThan(0);
    for (const file of files) {
      const module = modules[file.href];
      expect(
        module,
        `${file.href} is linked and this test does not know what emits it`,
      ).toBeDefined();
      expect(
        existsSync(new URL(module as string, import.meta.url).pathname),
        `the footer links ${file.href}, which nothing emits`,
      ).toBe(true);
    }
  });

  it("reaches no signed-in surface", () => {
    // Asserted over the RENDERED hrefs rather than over `paths`, because `files` bypasses the
    // registry check that would otherwise make this unreachable. A hand-written entry is the only
    // way `/keys` or `/brief` could get into this footer, and it is the way one would.
    for (const href of footerHrefs()) {
      expect(PRIVATE_PATHS, `the footer links ${href}, which is a signed-in surface`).not.toContain(
        href,
      );
    }
  });
});
