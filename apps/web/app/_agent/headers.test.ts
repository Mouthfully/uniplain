import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AGENT_PAGES, markdownPath } from "./registry";

const CONFIG = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

/**
 * THE SECOND COPY OF THE PAGE LIST, HELD TO THE FIRST.
 *
 * `next.config.ts` spells the fourteen paths out instead of importing the registry, because the
 * config is loaded before anything is compiled and importing the registry would drag `_content.ts`,
 * `@repo/brand` and the billing modules in to read fourteen strings. That duplication is a
 * deliberate trade and this file is the other half of it: a second list nothing compares is exactly
 * the arrangement that left six pages out of the sitemap.
 *
 * The config is SCANNED rather than imported, for the same reason `_oauth-refusals.test.ts` scans
 * the Worker's source: importing `next.config.ts` from vitest evaluates a Next config object, and
 * what is under test is the literal list a human edits.
 */
function pathsInConfig(): string[] {
  const block = /const AGENT_PATHS = \[([\s\S]*?)\];/.exec(CONFIG);
  expect(block?.[1], "AGENT_PATHS could not be read out of next.config.ts").toBeTypeOf("string");
  return [...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("the Link headers that advertise the markdown twins", () => {
  const configured = pathsInConfig();

  it("read the list at all", () => {
    // A regex that matched nothing would make both assertions below pass by comparing two empties.
    expect(configured.length).toBe(AGENT_PAGES.length);
    expect(configured.length).toBeGreaterThan(10);
  });

  it("covers exactly the registered pages, in both directions", () => {
    expect([...configured].sort()).toEqual([...AGENT_PAGES.map((p) => p.path)].sort());
  });

  it("points each one at its own markdown twin and at llms.txt", () => {
    // The header template, asserted on its shape rather than on a rendered string: this is the one
    // place the `.md` convention is spoken to a machine over HTTP, and a typo in a relation name is
    // silent -- the header is simply ignored and nothing anywhere reports it.
    expect(CONFIG).toContain('rel="alternate"');
    expect(CONFIG).toContain('type="text/markdown"');
    expect(CONFIG).toContain('rel="describedby"');
    expect(CONFIG).toContain("/llms.txt");
    for (const page of AGENT_PAGES) {
      expect(markdownPath(page.path).endsWith(".md")).toBe(true);
    }
  });
});

describe("the security headers", () => {
  it("sets the four that need no nonce", () => {
    for (const header of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(CONFIG, `${header} is not set`).toContain(header);
    }
  });

  it("refuses framing in both the modern and the legacy spelling", () => {
    // frame-ancestors is the one the browser honours; X-Frame-Options is what an older scanner and
    // an older browser read. Neither is a substitute for the other, so both are set.
    expect(CONFIG).toContain("frame-ancestors 'none'");
    expect(CONFIG).toContain("X-Frame-Options");
  });

  it("does not claim a script-src policy it cannot enforce", () => {
    // A `script-src` without per-request nonces would either break the JSON-LD block and Next's own
    // bootstrap, or be written with 'unsafe-inline' and mean nothing. Absent and documented beats
    // present and hollow -- the same rule the rest of this repository applies to claims.
    //
    // ASSERTED ON THE POLICY VALUE, NOT ON THE FILE. The first version of this test scanned the
    // whole source and went red on the COMMENT above the header block, which explains in prose why
    // there is no script-src. A guard that fires on the explanation of the rule it enforces is
    // worse than no guard: the cheapest way to make it green is to delete the explanation.
    const policy = /key: "Content-Security-Policy", value: "([^"]*)"/.exec(CONFIG);
    expect(policy?.[1], "the CSP value could not be read out of next.config.ts").toBeTypeOf(
      "string",
    );
    expect(policy?.[1]).not.toContain("script-src");
    expect(policy?.[1]).not.toContain("unsafe-inline");
  });
});
