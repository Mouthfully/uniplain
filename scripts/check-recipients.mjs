#!/usr/bin/env node
/**
 * THE RECIPIENT GUARD: a host in shipped code must be a host somebody has classified.
 *
 * ================================================================================================
 * THE DEFECT THIS EXISTS AFTER, AND WHY EVERY EXISTING GUARD PASSED THROUGH IT
 * ================================================================================================
 *
 * `apps/web/app/brief/actions.ts` posts a workspace's computed figures to `openrouter.ai`. It has
 * done so since `/brief` shipped. OpenRouter appeared in no processing activity, in no
 * sub-processor list, on `/privacy`, `/processing` or `/sub-processors`, in the generated
 * Art. 30(1)(d) record or in SCC Annex III. The privacy notice said, in words, **"Four providers
 * process data on our behalf"**.
 *
 * There were already two guards over this. `sub-processors.test.tsx` asserts the published list and
 * the record of processing agree **in both directions**, and it was green -- because a recipient
 * absent from the record is absent from the list, and two lists that omit the same thing agree
 * perfectly. Worse, the "record" side was `recipientsInRecord()`, which returned a hand-typed
 * constant while its comment said it read the activities. **Consistency between copies is not
 * evidence.**
 *
 * The decision not to list OpenRouter had even been taken correctly, in a comment on the clause:
 * "packages/insights can call it and nothing does: no route, no cron, and no key configured on any
 * surface... It joins this list in the change that gives it a caller, not before." That was true
 * when written. `/brief` then gave it a caller, and nothing brought anybody back to the comment.
 *
 * ================================================================================================
 * SO THIS GUARD READS THE SOURCE, WHICH IS THE ONE THING THE LISTS CANNOT COPY FROM
 * ================================================================================================
 *
 * Every `https://host` in shipped TypeScript must appear in `OUTBOUND_HOSTS` with a role:
 *
 *   sub-processor    receives data on our behalf -- must also be in `SUB_PROCESSORS`, and is
 *                    therefore on every disclosure generated from it
 *   tenant-platform  the customer's own platform on the customer's own credential. NOT ours to
 *                    disclose: listing Google as our sub-processor would misdescribe who is
 *                    accountable to whom
 *   public-source    read from, told nothing about any tenant
 *   own              this product's own domain
 *   not-requested    a literal with no request behind it -- a reserved example domain, or a host
 *                    recorded in a comment as dead
 *
 * A new host fails until somebody says which. Saying "sub-processor" then fails until the
 * disclosure names it. Neither step can be reached by editing one list to match another.
 *
 * AND ONE COUPLING IN THE OTHER DIRECTION. A `not-requested` entry may name a package that would
 * call the host if it were wired up (`noCallerOf`). `@repo/email` is written, tested and imported
 * by nothing, and its own header says the sub-processor clause must be amended in the change that
 * gives it a caller. This turns that sentence into a build failure rather than a hope.
 */

import { listFiles, readText, repoRoot } from "./lib/scan.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const problems = [];

/**
 * Where a `tenant-platform` host may appear.
 *
 * These are the only places a per-workspace credential is opened: the OAuth package that obtains
 * it, the connections package that stores it, and the connectors that spend it. Everywhere else is
 * running on a key of ours.
 */
const BYOC_PATHS = ["packages/oauth/", "packages/connectors/", "packages/connections/"];

/** Shipped TypeScript: the two apps and the packages, minus their tests. */
function shippedSources() {
  return listFiles().filter(
    (rel) =>
      (rel.startsWith("apps/") || rel.startsWith("packages/")) &&
      /\.(ts|tsx)$/.test(rel) &&
      !/\.test\.tsx?$/.test(rel) &&
      !rel.includes("/dist/"),
  );
}

/**
 * `OUTBOUND_HOSTS`, read out of the TypeScript by shape rather than imported.
 *
 * A guard cannot import the module it checks -- this is a `.mjs` script and that is `.ts` -- and the
 * other guards in this directory read TypeScript the same way. The parse is deliberately strict:
 * anything it cannot read is a failure, because a classification list this script silently read as
 * empty would let every host through.
 */
function classifiedHosts() {
  const text = readFileSync(join(repoRoot, "apps/web/app/_processing/recipients.ts"), "utf8");
  const entries = new Map();
  for (const m of text.matchAll(
    /host:\s*"([^"]+)",\s*\n\s*role:\s*"([a-z-]+)",\s*\n\s*processor:\s*(null|"[^"]*"),/g,
  )) {
    entries.set(m[1], { role: m[2], processor: m[3] === "null" ? null : m[3].slice(1, -1) });
  }
  if (entries.size < 10) {
    throw new Error(
      `read only ${entries.size} entries out of recipients.ts; the file's shape changed and this ` +
        "guard would otherwise pass by finding nothing to check",
    );
  }

  // The `own` entry is built from `brand.domain` rather than typed, because `check-brand.mjs`
  // refuses the domain as a literal outside `packages/brand` -- this script included.
  const brandText = readFileSync(join(repoRoot, "packages/brand/src/brand.ts"), "utf8");
  const domain = brandText.match(/^\s*domain:\s*"([^"]+)"/m)?.[1] ?? null;
  if (domain !== null) entries.set(domain, { role: "own", processor: null });

  return entries;
}

/** The published sub-processor names. */
function disclosedProcessors() {
  const text = readFileSync(join(repoRoot, "apps/web/app/_processing/sub-processors.ts"), "utf8");
  const names = [...text.matchAll(/^\s{4}name:\s*"([^"]+)",$/gm)].map((m) => m[1]);
  if (names.length === 0) throw new Error("read no names out of sub-processors.ts");
  return new Set(names);
}

/** Packages a `not-requested` host says are unwired, and the host that vouches for each. */
function unwiredPackages() {
  const text = readFileSync(join(repoRoot, "apps/web/app/_processing/recipients.ts"), "utf8");
  return [...text.matchAll(/noCallerOf:\s*"([^"]+)",\s*\n\s*note:/g)].map((m) => m[1]);
}

let classified;
let disclosed;
let unwired;
try {
  classified = classifiedHosts();
  disclosed = disclosedProcessors();
  unwired = unwiredPackages();
} catch (error) {
  console.error(`\ncheck-recipients: ${error.message}\n`);
  process.exit(1);
}

// ---- Every host in shipped source is classified -------------------------------------------
const seen = new Map();
for (const rel of shippedSources()) {
  const text = readText(rel);
  if (text === null) continue;
  for (const m of text.matchAll(/https:\/\/([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9])/g)) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) seen.set(host, rel);
  }
}

if (seen.size === 0) {
  console.error("\ncheck-recipients: found no hosts at all; the scan is broken, not the code\n");
  process.exit(1);
}

for (const [host, rel] of seen) {
  const entry = classified.get(host);
  if (entry === undefined) {
    problems.push(
      `  ${host} appears in ${rel} and is classified nowhere.\n` +
        "      Add it to apps/web/app/_processing/recipients.ts. If it receives data on our " +
        "behalf it is a sub-processor and every disclosure has to gain it.",
    );
    continue;
  }
  // THE RELABEL THIS CLOSES. A mutation moved `openrouter.ai` from `sub-processor` to
  // `tenant-platform` and everything stayed green: the disclosure chain runs from
  // `PROCESSING_ACTIVITIES`, so a lie told in `recipients.ts` alone broke nothing. Two independent
  // lists again, which is the whole defect.
  //
  // BYOC IS ARCHITECTURAL, SO IT IS CHECKABLE. "The customer's own platform on the customer's own
  // credential" means the call is made by a connector or by the OAuth code, because that is where
  // per-workspace credentials are opened. A host claiming that role from anywhere else is claiming
  // it from a file that has no tenant credential to use -- `packages/insights` reaches OpenRouter
  // on a PLATFORM key, from `apps/web/app/brief` -- and the claim is refused.
  if (entry.role === "tenant-platform" && !BYOC_PATHS.some((p) => rel.startsWith(p))) {
    problems.push(
      `  ${host} is classified as the customer's own platform and appears in ${rel}, which is ` +
        "not connector or OAuth code.\n      A host reached outside those paths is reached on " +
        "OUR credential, which makes its operator a sub-processor rather than the customer's " +
        "own platform.",
    );
    continue;
  }
  if (entry.role === "sub-processor" && !disclosed.has(entry.processor)) {
    problems.push(
      `  ${host} is classified as a sub-processor named "${entry.processor}", which is not in ` +
        "SUB_PROCESSORS.\n      A recipient the code has and the disclosure does not is the " +
        "defect this guard was written after.",
    );
  }
}

// ---- A package vouched for as unwired must still be unwired --------------------------------
const importers = shippedSources();
for (const pkg of unwired) {
  // AN IMPORT, NOT A MENTION. The first version of this matched the bare string, and
  // `recipients.ts` failed its own check by naming the package in the note explaining that nothing
  // imports it -- a guard that fires on the document describing the thing it guards.
  const importer = new RegExp(
    String.raw`(?:from|import|require)\s*\(?\s*["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
  );
  const real = importers.filter((rel) => {
    if (rel.startsWith(`packages/${pkg.replace("@repo/", "")}/`)) return false;
    const text = readText(rel);
    return text !== null && importer.test(text);
  });
  if (real.length > 0) {
    problems.push(
      `  ${pkg} is recorded in recipients.ts as having no caller, and ${real[0]} imports it.\n` +
        "      The host it reaches now receives data. Disclose it in this change: add the " +
        "processing activity, add the sub-processor, and move its entry off `not-requested`.",
    );
  }
}

if (problems.length > 0) {
  console.error(`\ncheck-recipients: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(
  `check-recipients: ${seen.size} hosts in shipped source, all classified; ` +
    `${disclosed.size} sub-processors disclosed.`,
);
