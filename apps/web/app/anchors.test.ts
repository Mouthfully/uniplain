import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * EVERY IN-PAGE LINK POINTS AT SOMETHING.
 *
 * This exists because three did not, and two of them were the most important buttons on the site:
 * the hero's "start free" and every plan button on the pricing section both read `href="#start"`,
 * an id no element in this application carries. A visitor who was sold clicked, and nothing
 * happened. The third, the FAQ's "visit the help center", pointed at `#docs` while `/docs` had
 * shipped as a real route months earlier.
 *
 * All three were placeholders from the reference design, each with a comment explaining that it was
 * waiting for a page to exist. That is the failure mode worth naming: A PLACEHOLDER THAT READS LIKE
 * A DECISION SURVIVES THE THING IT WAS WAITING FOR. Nothing failed, nothing 404'd, and nothing in
 * the build could tell the difference between a link that scrolls and a link that does nothing.
 *
 * WHAT THIS CHECKS, AND THE WEAKNESS IT ADMITS. A fragment must resolve to an `id` somewhere in
 * `apps/web/app`. It is NOT per-page: proving that `#compare` renders on the same page as the link
 * to it would mean resolving the component tree, and a test that has to render every route to check
 * a link would not be run. So a link pointing at an id that exists on a DIFFERENT page still
 * passes here. That is a real hole, and it is a much smaller one than the defect this replaces --
 * pointing at an id that exists NOWHERE is the shape all three shipped bugs had.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const SCANNED = /\.(tsx|jsx)$/;
const SKIPPED = /\.(test|spec)\.[tj]sx?$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (SCANNED.test(entry) && !SKIPPED.test(entry)) out.push(path);
  }
  return out;
}

/** Blank comments out, preserving line count. A fragment quoted in prose is not a link. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, lead) => lead);
}

const FILES = sourceFiles(HERE);
const SOURCES = new Map(FILES.map((file) => [file, stripComments(readFileSync(file, "utf8"))]));

/** Every `id="…"` this application renders, from any file. */
const IDS = new Set<string>();
for (const source of SOURCES.values()) {
  for (const match of source.matchAll(/\bid="([^"{]+)"/g)) IDS.add(match[1] as string);
}

interface Fragment {
  readonly file: string;
  readonly line: number;
  readonly target: string;
}

const FRAGMENTS: Fragment[] = [];
for (const [file, source] of SOURCES) {
  source.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/href="#([^"]*)"/g)) {
      FRAGMENTS.push({ file: relative(HERE, file), line: index + 1, target: match[1] as string });
    }
  });
}

describe("in-page links", () => {
  it("finds fragment links to check, so a passing run means something", () => {
    // A scan that matched nothing would pass for ever and prove nothing -- the same argument the
    // SQL suites' assertion floors make.
    expect(FRAGMENTS.length).toBeGreaterThan(5);
    expect(IDS.size).toBeGreaterThan(5);
  });

  it("every one points at an id this application actually renders", () => {
    const dead = FRAGMENTS.filter((fragment) => !IDS.has(fragment.target));
    expect(
      dead.map((f) => `${f.file}:${f.line} -> #${f.target}`),
      "these links scroll nowhere",
    ).toEqual([]);
  });

  it("none is the empty fragment, which navigates to the top of the page rather than anywhere", () => {
    const empty = FRAGMENTS.filter((fragment) => fragment.target === "");
    expect(empty.map((f) => `${f.file}:${f.line}`)).toEqual([]);
  });
});
