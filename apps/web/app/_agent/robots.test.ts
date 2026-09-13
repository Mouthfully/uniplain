import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

import robots from "../robots";
import { PRIVATE_PATHS } from "./registry";

const APP = new URL("../", import.meta.url).pathname;

/**
 * ROBOTS.TXT, HELD TO THE ROUTES ON DISK AND TO ITS OWN GENEROSITY.
 *
 * Two failures are guarded here and the second is the one that would actually hurt.
 *
 * 1. THE DISALLOW LIST DRIFTING. It disallowed two paths while seven routes carried
 *    `robots: { index: false }`. The five it had never heard of included `/connections`, where a
 *    customer attaches a credential.
 *
 * 2. A NAMED AGENT SILENTLY GAINING THE PRIVATE PATHS. robots.txt has no inheritance: a crawler
 *    obeys exactly one group, the most specific match, and a named group that omits a Disallow is
 *    not falling back to `*` -- it is permitting. So the act of naming GPTBot to be generous about
 *    training is also, if done carelessly, the act of handing it `/dashboard`. Nothing about that
 *    is visible by reading the file casually, which is why it is asserted rather than reviewed.
 */

/** Every route whose own metadata says not to index it, read off `app/**` rather than a list. */
function noindexRoutesOnDisk(): string[] {
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith("_") || entry.startsWith("(") || entry.endsWith(".md")) continue;
      const full = `${dir}/${entry}`;
      if (!statSync(full).isDirectory()) continue;
      try {
        const source = readFileSync(`${full}/page.tsx`, "utf8");
        if (/robots:\s*\{\s*index:\s*false/.test(source)) found.push(`${prefix}/${entry}`);
      } catch {
        // Not a route itself; may still contain some.
      }
      walk(full, `${prefix}/${entry}`);
    }
  };
  walk(APP, "");
  return found;
}

const rules = robots().rules;
const groups = Array.isArray(rules) ? rules : [rules];

describe("the private paths", () => {
  const onDisk = noindexRoutesOnDisk();

  it("found routes to check, so the comparison is not vacuous", () => {
    expect(onDisk.length).toBeGreaterThan(4);
  });

  it("are exactly the routes that asked not to be indexed, in both directions", () => {
    expect([...PRIVATE_PATHS].sort()).toEqual([...onDisk].sort());
  });
});

describe("robots.txt", () => {
  it("emits a group for the wildcard and one per named agent", () => {
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.some((g) => g.userAgent === "*")).toBe(true);
  });

  it("refuses every private path in EVERY group, including the AI ones", () => {
    // The inheritance footgun. A named group missing this list does not fall back to `*`; it grants.
    for (const group of groups) {
      const disallow = group.disallow;
      const list = Array.isArray(disallow) ? disallow : disallow === undefined ? [] : [disallow];
      for (const path of PRIVATE_PATHS) {
        expect(
          list,
          `user-agent ${String(group.userAgent)} does not refuse ${path}, which grants it`,
        ).toContain(path);
      }
    }
  });

  it("allows the public site to the AI crawlers the founder decided to allow", () => {
    // The decision this file records. If it is ever reversed, this test is what has to be edited,
    // which is the point: the reversal should be a deliberate act and not a quiet deletion.
    for (const token of ["GPTBot", "ClaudeBot", "Google-Extended"]) {
      const group = groups.find((g) => g.userAgent === token);
      expect(group, `${token} has no group`).toBeDefined();
      expect(group?.allow).toBe("/");
    }
  });

  it("names no crawler token that was not verified against its operator's documentation", () => {
    // An invented user-agent string governs no crawler and reads as a decision that was taken.
    const verified = new Set([
      "*",
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-User",
      "Claude-SearchBot",
      "Google-Extended",
      "Applebot-Extended",
    ]);
    for (const group of groups) {
      expect(
        verified.has(String(group.userAgent)),
        `${String(group.userAgent)} is unverified`,
      ).toBe(true);
    }
  });

  it("points at the sitemap", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
