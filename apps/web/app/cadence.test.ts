import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * NOTHING SENDS, AND NOTHING RUNS ON A CLOCK. THE SITE SAID OTHERWISE IN SIX PLACES.
 *
 * `generateBrief` in `brief/actions.ts` is a form action with no other caller in the repository;
 * no cron writes a brief -- the only scheduled work ingests rows; and `packages/email` has no
 * caller at all, because note 70 verified the domain holds neither an MX nor a TXT record. A
 * customer who connected a source and waited for breakfast would get nothing, twice over.
 *
 * What the site said, before this:
 *
 *   _content.ts          heroLine2: "Every morning."            <- the headline
 *   DashboardFeature     "One page, every morning" / "once a day" / "changed overnight"
 *   FeatureGrid          "What arrives, and when"
 *   UseCases             "The same brief every morning"
 *   FaqCta               "What does it send me each morning?" / "Connect tonight. Decide at breakfast."
 *   brief/_content.ts    "Morning brief" / "Yesterday, in three lines."  <- over a SEVEN-DAY period
 *
 * THE LAST ONE IS THE WORST AND IT IS NOT MARKETING. A signed-in customer was told a week's
 * takings were yesterday's, by the heading, on the page whose whole purpose is refusing a number it
 * cannot trace. Nobody typed a wrong figure; the arithmetic was right and checked twice. The copy
 * was the assertion nothing checked.
 *
 * WHY A SOURCE SCAN AND NOT A RENDER. Several of these live in server components that read a
 * session or a database, so a rendering test would assert a fixture. This reaches every route,
 * at the cost of also seeing strings that never render -- the trade `forbidden-claims.test.ts`
 * already makes, and the right one for a claim that is one edit from being published.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const SCANNED = /\.(tsx?|jsx?)$/;
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

/**
 * Comments are blanked, line count preserved.
 *
 * This repository explains its bans in prose beside the code they bind -- the four sections above
 * each carry a comment naming the sentence they used to hold -- so scanning comments would fire on
 * every explanation of the rule. A comment renders nothing.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, lead) => lead);
}

/**
 * A RECURRING TIME OF DAY, WHICH IS THE DEFECT CLASS AND NOT A WORD LIST.
 *
 * The first version of this pattern also caught delivery verbs -- send/deliver/arrives/lands -- and
 * returned twenty findings, most of them noise: `lands:` is a FIELD NAME in the Meta Ads reference
 * table, "the connection dies quietly overnight" is a true statement about a token expiring, and
 * "what you paste is sent once, to the service that encrypts it" is a true statement about a
 * credential. A guard with that ratio gets an `// eslint-disable` or a deleted line, not a fix.
 *
 * So it is narrowed to what the six real findings actually had in common: A PROMISE THAT SOMETHING
 * HAPPENS AT A TIME OF DAY, ON REPEAT. That is unambiguous in prose, it is the sentence a customer
 * plans their morning around, and nothing else in this application has a reason to say it.
 *
 * WHAT THIS DELIBERATELY NO LONGER CATCHES: a bare "we will send", which is TRUE of the sign-in
 * link -- Supabase's own auth server sends that one, and `_content-auth.ts` is right to say so.
 * Delivery is not the lie; a schedule is.
 */
const CADENCE =
  /\b(?:each|every)\s+morning\b|\bonce a day\b|\bdaily brief\b|\b(?:by|at|before)\s+breakfast\b|\bwake up to\b|\bwhen you wake\b|\bnext morning\b/gi;

/**
 * AND THE PHRASE HAS TO BE ABOUT THE THING THAT WOULD ARRIVE.
 *
 * "Connections are read once a day" is TRUE -- `INGEST_CRON` is daily -- and "the decisions you
 * make every day" is about the reader's life, not ours. Both were caught by the phrase list alone,
 * and a guard that reports four true sentences to find one false one is a guard somebody disables.
 *
 * So a finding also needs a word for the thing being promised nearby. That makes this narrow on
 * purpose: a cadence attached to a noun this list does not carry gets through, and the answer to
 * that is to add the noun rather than to widen the phrases into everything that mentions a day.
 */
const PROMISED =
  /\b(?:brief|briefs|lines|report|reports|summary|digest|figures|numbers|page|email|message)\b/i;

/**
 * A match is a finding only when nothing negates it in the clause before.
 *
 * Without this the guard fires on the honest sentences -- "nothing is sent to you", "Nothing is
 * sent for you" -- and the page gets edited into silence rather than honesty. Banning a form of
 * words also bans saying you do not do it, which is the trap note 65 recorded when deleting a
 * phrase deleted its own guard. It is a heuristic, and a contorted enough sentence gets past it.
 */
const NEGATOR =
  /\b(?:nothing|not|never|no|without|neither|nor|cannot|can't|won't|does not|doesn't|instead of)\b/i;

function clauseBefore(text: string, at: number): string {
  const run = text.slice(Math.max(0, at - 90), at);
  const boundary = run.search(/[.;:!?][^.;:!?]*$/);
  return boundary === -1 ? run : run.slice(boundary + 1);
}

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly matched: string;
  readonly context: string;
}

const FINDINGS: Finding[] = [];
for (const file of sourceFiles(HERE)) {
  const source = stripComments(readFileSync(file, "utf8"));
  for (const match of source.matchAll(CADENCE)) {
    const index = match.index ?? 0;
    if (NEGATOR.test(clauseBefore(source, index))) continue;
    const around = source.slice(Math.max(0, index - 120), index + 120);
    if (!PROMISED.test(around)) continue;
    FINDINGS.push({
      file: relative(HERE, file),
      line: source.slice(0, index).split("\n").length,
      matched: match[0],
      context: source.slice(Math.max(0, index - 50), index + 50).replace(/\s+/g, " "),
    });
  }
}

describe("the product promises no cadence it does not keep", () => {
  it("scans real files, so a passing run means something", () => {
    // A scan that reached nothing would pass for ever -- the argument the SQL suites' assertion
    // floors make, applied to a directory walk.
    expect(sourceFiles(HERE).length).toBeGreaterThan(30);
  });

  it("makes no unnegated promise that anything is sent, arrives, or happens on a clock", () => {
    expect(
      FINDINGS.map((f) => `${f.file}:${f.line} "${f.matched}" — …${f.context}…`),
      "nothing schedules a brief and nothing can deliver one",
    ).toEqual([]);
  });
});
