import { readdirSync, readFileSync, statSync } from "node:fs";
import { allowedClaims, withheldClaims } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { AGENT_PAGES, markdownPath } from "./registry";
import { llmsTxt, pageMarkdown } from "./render";

const APP = new URL("../", import.meta.url).pathname;

/**
 * THE GUARD THAT WOULD HAVE CAUGHT THE DEFECT THIS DIRECTORY WAS WRITTEN AFTER.
 *
 * `sitemap.ts` listed eight of the fourteen indexable routes. The six missing were `/envelope` and
 * five of the six connector pages -- the pages that answer "can this product read Google Ads?",
 * which is the question a machine comes to this site with. Nothing failed, because nothing compared
 * the hand-kept list to the routes on disk.
 *
 * So this reads `app/**` and compares BOTH WAYS. A hand-kept list checked in one direction is how
 * the original gap survived: every entry pointed at a real page, so every check anyone would think
 * to write came back green.
 */

/** Every route with a `page.tsx`, and whether its own metadata says not to index it. */
function routesOnDisk(): { path: string; noindex: boolean }[] {
  const out: { path: string; noindex: boolean }[] = [];

  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      // Route groups, private folders and the markdown twins are not pages.
      if (entry.startsWith("_") || entry.startsWith("(") || entry.endsWith(".md")) continue;
      const full = `${dir}/${entry}`;
      if (!statSync(full).isDirectory()) continue;
      const page = `${full}/page.tsx`;
      try {
        const source = readFileSync(page, "utf8");
        out.push({
          path: `${prefix}/${entry}`,
          noindex: /robots:\s*\{\s*index:\s*false/.test(source),
        });
      } catch {
        // No page.tsx here; it may still be a parent of routes that do have one.
      }
      walk(full, `${prefix}/${entry}`);
    }
  };

  const root = readFileSync(`${APP}/page.tsx`, "utf8");
  out.push({ path: "/", noindex: /robots:\s*\{\s*index:\s*false/.test(root) });
  walk(APP, "");
  return out;
}

const disk = routesOnDisk();
const registered = new Set(AGENT_PAGES.map((p) => p.path));

describe("the machine-readable page registry", () => {
  it("found the routes at all, so the assertions below are not vacuous", () => {
    // An empty scan would make every "for each" below pass by iterating nothing -- the same trap
    // `captureLog` guards against in the api-edge suite.
    expect(disk.length).toBeGreaterThan(14);
    expect(disk.some((r) => r.path === "/")).toBe(true);
  });

  it("describes every public page on disk", () => {
    const missing = disk.filter((r) => !r.noindex && !registered.has(r.path)).map((r) => r.path);
    expect(
      missing,
      `these routes are indexable and absent from AGENT_PAGES, so no agent can find them: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("describes no page that does not exist", () => {
    const onDisk = new Set(disk.map((r) => r.path));
    const invented = AGENT_PAGES.filter((p) => !onDisk.has(p.path)).map((p) => p.path);
    expect(invented, `AGENT_PAGES names routes with no page.tsx: ${invented.join(", ")}`).toEqual(
      [],
    );
  });

  it("describes no page that asked not to be indexed", () => {
    // A signed-in surface in a file built to be read by machines is worse than an absent one: the
    // page is noindex precisely because it is nobody's business, and llms.txt is a louder index
    // than a sitemap.
    const priv = disk.filter((r) => r.noindex && registered.has(r.path)).map((r) => r.path);
    expect(priv, `noindex routes are listed for agents: ${priv.join(", ")}`).toEqual([]);
  });

  it("has a markdown handler on disk for every entry", () => {
    for (const page of AGENT_PAGES) {
      const dir = markdownPath(page.path).replace(/^\//, "");
      expect(
        () => statSync(`${APP}/${dir}/route.ts`),
        `${page.path} has no ${dir} handler`,
      ).not.toThrow();
    }
  });
});

describe("llms.txt", () => {
  const text = llmsTxt();

  it("has the structure the convention requires", () => {
    const lines = text.split("\n");
    // "An H1 with the name of the project or site. This is the only required section."
    expect(lines[0]?.startsWith("# ")).toBe(true);
    // "A blockquote with a short summary of the project."
    expect(text).toMatch(/\n> .+/);
    // "Zero or more markdown sections delimited by H2 headers, containing file lists."
    expect(text).toMatch(/\n## .+/);
  });

  it("links to the markdown twin of every registered page", () => {
    for (const page of AGENT_PAGES) {
      expect(text, `${page.path} is not linked from llms.txt`).toContain(markdownPath(page.path));
    }
  });

  it("links to nothing that is not a registered page", () => {
    const linked = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1] ?? "");
    const allowed = new Set(AGENT_PAGES.map((p) => markdownPath(p.path)));
    for (const url of linked) {
      const path = new URL(url).pathname;
      expect(allowed.has(path), `llms.txt links ${path}, which is not a registered page`).toBe(
        true,
      );
    }
  });
});

describe("a page rendered as markdown", () => {
  it("states the page's own title and summary, and nothing from another page", () => {
    const pricing = AGENT_PAGES.find((p) => p.path === "/pricing");
    expect(pricing).toBeDefined();
    if (pricing === undefined) return;
    const md = pageMarkdown(pricing);
    expect(md.startsWith(`# ${pricing.title}`)).toBe(true);
    expect(md).toContain(pricing.summary);

    const other = AGENT_PAGES.find((p) => p.path === "/privacy");
    expect(other).toBeDefined();
    if (other !== undefined) expect(md).not.toContain(other.summary);
  });

  it("carries a link back to the page it describes", () => {
    for (const page of AGENT_PAGES) {
      const md = pageMarkdown(page);
      expect(md, `${page.path} markdown does not link its own source`).toMatch(/\nSource: \[/);
      expect(md).toContain("/llms.txt");
    }
  });
});

describe("the capability gate reaches the machine-readable surface", () => {
  /**
   * THE ASSERTION THIS WHOLE DIRECTORY EXISTS TO MAKE.
   *
   * `withheld-claims.test.tsx` closes the hole one level up: a claim whose capability has not
   * launched, rewritten as hand-typed section copy, renders like an approved one. `llms.txt` and
   * the markdown twins are the same hole with a wider mouth -- they are written to be quoted by
   * machines, so a withheld promise that leaks here is repeated by something that will not say
   * where it got it.
   *
   * `publishableClaims` drops a withheld claim rather than substituting a softer sentence, because
   * a softer sentence is the withheld claim with the gate routed around it. This proves the drop.
   */
  const surfaces = [llmsTxt(), ...AGENT_PAGES.map((p) => pageMarkdown(p))].join("\n\n");

  it("found something to check, so the assertions below are not vacuous", () => {
    expect(withheldClaims().length).toBeGreaterThan(0);
    expect(surfaces.length).toBeGreaterThan(500);
  });

  it("publishes no distinctive phrase from a claim the gate withholds", () => {
    // FIVE-WORD RUNS, NOT WHOLE-STRING CONTAINMENT. The first version of this asserted
    // `not.toContain(claim.text)`, and a mutation proved it nearly worthless: retyping a withheld
    // claim as a summary in the registry -- the exact way a person would route around the gate --
    // left it green, because a hand-retyped sentence is never character-identical to the original.
    //
    // Five is the same floor `withheld-claims.test.tsx` measured for the same corpus and for the
    // same reason: fewer words and ordinary English trips it, more and a paraphrase walks through.
    // Runs shared with a claim that IS allowed are excluded, because a withheld claim and an
    // allowed one may legitimately share a phrase and firing on the overlap would forbid a sentence
    // the site is explicitly permitted to say.
    const normalise = (t: string) =>
      ` ${t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()} `;
    const runs = (t: string): string[] => {
      const words = normalise(t).trim().split(" ").filter(Boolean);
      const out: string[] = [];
      for (let i = 0; i + 5 <= words.length; i += 1) out.push(words.slice(i, i + 5).join(" "));
      return out;
    };

    const allowedRuns = new Set(allowedClaims().flatMap((c) => runs(c.text)));
    const haystack = normalise(surfaces);

    for (const entry of withheldClaims()) {
      for (const run of runs(entry.claim.text)) {
        if (allowedRuns.has(run)) continue;
        expect(
          haystack.includes(` ${run} `),
          `the withheld claim "${entry.claim.id}" reached the machine-readable surface: "${run}"`,
        ).toBe(false);
      }
    }
  });

  it("publishes the claims that ARE allowed, so the filter is not refusing everything", () => {
    // The other direction. A `publishableClaims` that returned [] would pass the test above and
    // would make every markdown page an empty shell -- green, and useless.
    const allowed = new Set(allowedClaims().map((c) => c.id));
    const used = AGENT_PAGES.flatMap((p) => p.claims).filter((id) => allowed.has(id));
    expect(used.length, "no registered page cites a single publishable claim").toBeGreaterThan(0);
    for (const id of new Set(used)) {
      const text = allowedClaims().find((c) => c.id === id)?.text;
      if (text !== undefined) {
        expect(surfaces, `${id} is allowed but never published`).toContain(text);
      }
    }
  });
});
