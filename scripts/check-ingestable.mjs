#!/usr/bin/env node
/**
 * THE INGESTABLE GUARD: what the site claims to read must be what the Worker can read.
 *
 * ================================================================================================
 * THE CLAIM NAMED SEVEN PLATFORMS AND ONE OF THEM COULD PRODUCE A ROW
 * ================================================================================================
 *
 * Published on the home page, verbatim: **"Reads GA4, Google Ads, Loyverse, Meta Ads, Search
 * Console, Shopify and WooCommerce on your own credentials."**
 *
 * `runIngest` refuses every provider but `woocommerce`, and the sweep filters the rest out before
 * they are leased. A customer could connect their Loyverse till, watch the connection go healthy,
 * and never receive a row.
 *
 * ================================================================================================
 * THE CAPABILITY GATE PASSED BECAUSE IT WAS CHECKING A PROXY
 * ================================================================================================
 *
 * `AVAILABLE_CAPABILITIES` read `IMPLEMENTED_SOURCE_IDS.length > 0` -- a test that SOMETHING is
 * implemented, licensing a claim that names seven things. `check-capabilities.mjs` was green
 * throughout and correctly so: it asserts each id exports a client and a normaliser, which is true
 * of all seven and is strictly weaker than "a row can arrive".
 *
 * A gate that verifies a proxy for the thing claimed eventually licenses a falsehood. This checks
 * the thing:
 *
 *   1. `INGESTABLE_SOURCE_IDS` equals what `apps/api-edge/src/ingest.ts` actually dispatches, in
 *      BOTH directions. The claim cannot be widened by editing the brand package.
 *   2. Every implemented source is ingestable or deferred IN WRITING, exactly once.
 *   3. A deferral's `backfill` flag is checked against the filesystem -- which is the field that
 *      went stale last time. `ingest.ts` carried "four of the five connectors have no backfill.ts
 *      yet"; four of them grew one, and the comment kept saying it. A boolean a guard checks
 *      cannot drift that way, and the day somebody writes the fifth backfill this goes red.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./lib/scan.mjs";

const CLAIMS = join(repoRoot, "packages/brand/src/claims.ts");
const INGEST = join(repoRoot, "apps/api-edge/src/ingest.ts");
const SOURCES = join(repoRoot, "packages/connectors/src/sources");

const problems = [];

/** A `readonly string[]`-shaped const, read out of TypeScript by name. */
function idList(text, name) {
  const block = text.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  return block === null ? null : [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

let claims;
let ingest;
try {
  claims = readFileSync(CLAIMS, "utf8");
  ingest = readFileSync(INGEST, "utf8");
} catch (error) {
  console.error(`\ncheck-ingestable: ${error.message}\n`);
  process.exit(1);
}

const ingestable = idList(claims, "INGESTABLE_SOURCE_IDS");
const implemented = idList(claims, "IMPLEMENTED_SOURCE_IDS");
if (ingestable === null || implemented === null || implemented.length === 0) {
  console.error(
    "\ncheck-ingestable: could not read INGESTABLE_SOURCE_IDS and IMPLEMENTED_SOURCE_IDS out of " +
      "claims.ts. Refusing to pass on a file this guard cannot parse.\n",
  );
  process.exit(1);
}

/** Deferrals, with the flag this guard exists to check. */
const deferred = [
  ...claims.matchAll(
    /id:\s*"([^"]+)",\s*\n\s*backfill:\s*(true|false),\s*\n\s*missing:\s*"([^"]*)"/g,
  ),
].map((m) => ({ id: m[1], backfill: m[2] === "true", missing: m[3] }));

// ---- 1. The brand list equals what the Worker dispatches -----------------------------------
const single = ingest.match(/export const INGEST_SOURCE\s*=\s*"([^"]+)"/)?.[1];
const many = idList(ingest, "INGEST_SOURCES");
const dispatched = many ?? (single === undefined ? null : [single]);

if (dispatched === null) {
  console.error(
    "\ncheck-ingestable: could not read INGEST_SOURCE or INGEST_SOURCES out of ingest.ts. " +
      "Refusing to pass: this guard's whole job is comparing that list to the claim.\n",
  );
  process.exit(1);
}

const onlyClaimed = ingestable.filter((id) => !dispatched.includes(id));
const onlyDispatched = dispatched.filter((id) => !ingestable.includes(id));
for (const id of onlyClaimed) {
  problems.push(
    `  INGESTABLE_SOURCE_IDS names "${id}" and runIngest does not dispatch to it.\n` +
      "      The home page would claim to read a platform from which no row can arrive.",
  );
}
for (const id of onlyDispatched) {
  problems.push(
    `  runIngest dispatches "${id}" and INGESTABLE_SOURCE_IDS does not name it.\n` +
      "      The product reads a source the claim withholds. Add it -- the claim widens by itself.",
  );
}

// ---- 2. Every implemented source is accounted for, exactly once -----------------------------
const accounted = [...ingestable, ...deferred.map((d) => d.id)];
for (const id of implemented) {
  const times = accounted.filter((x) => x === id).length;
  if (times === 0) {
    problems.push(
      `  "${id}" is an implemented connector and is neither ingestable nor deferred.\n` +
        "      Say which, in writing, in claims.ts. A connector nobody decided about is one a " +
        "customer connects and never hears from.",
    );
  } else if (times > 1) {
    problems.push(`  "${id}" is both ingestable and deferred.`);
  }
}
for (const entry of deferred) {
  if (!implemented.includes(entry.id)) {
    problems.push(`  "${entry.id}" is deferred and is not an implemented connector at all.`);
  }
  if (entry.missing.trim().length < 40) {
    problems.push(
      `  "${entry.id}" is deferred with a ${entry.missing.trim().length}-character reason. ` +
        "Say what is missing.",
    );
  }
}

// ---- 3. The backfill flag is checked against the filesystem ---------------------------------
for (const entry of deferred) {
  const exists = existsSync(join(SOURCES, entry.id, "backfill.ts"));
  if (exists === entry.backfill) continue;
  problems.push(
    exists
      ? `  "${entry.id}" is recorded as having no backfill and packages/connectors/src/sources/${entry.id}/backfill.ts exists.\n` +
          "      This is the drift that shipped last time: a comment said four connectors had no " +
          "backfill, four of them grew one, and the comment kept saying it. The work is done and " +
          "the dispatch is not wired -- record that, or wire it."
      : `  "${entry.id}" is recorded as having a backfill and no backfill.ts exists for it.`,
  );
}

if (problems.length > 0) {
  console.error(`\ncheck-ingestable: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `check-ingestable: ${ingestable.length} of ${implemented.length} connectors can be read; ` +
    `${deferred.length} deferred in writing, ${deferred.filter((d) => d.backfill).length} of them ` +
    "with a backfill already written.",
);
