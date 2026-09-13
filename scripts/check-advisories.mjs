#!/usr/bin/env node
/**
 * THE DEPENDENCY ADVISORY GATE.
 *
 * `AGENTS.md` lists A.8.8 vulnerability management under "absent and code-shaped, so these are ours
 * to fix": no audit step, no Dependabot or Renovate, no SAST, no SBOM. The first run of this script
 * found a **high**-severity advisory that had been in the tree with nothing looking at it.
 *
 * IT IS A CONTROL, NOT A CLAIM. `packages/brand`'s `FORBIDDEN_CLAIMS` bans "penetration tested" and
 * this changes none of that. The obligation it answers is PDPA s.37(1) -- appropriate security
 * measures -- and it is real whether or not anybody is ever shown a certificate: this service
 * custodies other people's platform credentials, and a known-vulnerable dependency in the path that
 * decrypts them is a security failure with a published identifier and a fix already written.
 *
 * ============================================================================================
 * THE THREE DECISIONS THAT MAKE THIS A GATE RATHER THAN A CHECKBOX
 * ============================================================================================
 *
 * 1. AN AUDIT THAT COULD NOT RUN IS NOT A PASS. `pnpm audit` needs the registry. If it cannot be
 *    reached, or returns something this script cannot parse, the gate FAILS and says which. An
 *    offline audit reporting "no vulnerabilities found" is the `?? 0` of security tooling -- absent
 *    is not zero, and "we could not check" is a finding.
 *
 * 2. AN ACKNOWLEDGEMENT NAMES AN ADVISORY AND EXPIRES. Without an escape hatch, the first
 *    high-severity advisory with no published fix turns every pull request red, and the pressure is
 *    then to delete the gate -- which is how a control dies. So one exists, and it is built to be
 *    survivable rather than permanent: it is keyed on the ADVISORY, never the module, so
 *    acknowledging today's `sharp` finding cannot hide tomorrow's; and it carries a date after
 *    which it stops working, so a suppression has to be renewed by somebody who looks again.
 *
 * 3. HIGH AND CRITICAL FAIL; MODERATE AND BELOW ARE REPORTED. A moderate advisory in a formatter is
 *    not worth stopping every pull request over, and a gate that cries wolf is a gate that gets
 *    `--no-verify`-d. They are printed on every run so they are visible rather than filtered away.
 *
 * Run it by exit code, like every other guard here:  node scripts/check-advisories.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ACKNOWLEDGEMENTS = fileURLToPath(new URL("../security/advisories.json", import.meta.url));

/** Severities that stop a build. Anything else is printed and does not. */
const BLOCKING = new Set(["high", "critical"]);

/** The longest an acknowledgement may run before somebody has to look at the advisory again. */
const MAX_ACKNOWLEDGEMENT_DAYS = 90;

const problems = [];
const notes = [];

/**
 * The audit, or a hard failure.
 *
 * `pnpm audit` exits 1 when it finds something and 0 when it does not, so a non-zero exit is not by
 * itself an error -- but a non-zero exit with no parseable JSON on stdout is, and that is the case
 * this separates. `execFileSync` throws on a non-zero exit and carries stdout on the error, which is
 * why the parse happens in both branches rather than only the happy one.
 */
function runAudit() {
  let stdout;
  try {
    stdout = execFileSync("pnpm", ["audit", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    stdout = typeof error?.stdout === "string" ? error.stdout : "";
    if (stdout.trim() === "") {
      const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
      throw new Error(
        `pnpm audit produced no output (exit ${error?.status ?? "?"}). This is NOT a pass: the ` +
          `registry may be unreachable. ${stderr === "" ? "No stderr." : `stderr: ${stderr}`}`,
      );
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      "pnpm audit returned output this guard could not parse as JSON. Not treated as a pass; " +
        "the audit format may have changed and this script needs updating.",
    );
  }

  if (parsed === null || typeof parsed !== "object" || typeof parsed.advisories !== "object") {
    throw new Error("pnpm audit returned JSON with no `advisories` object; refusing to pass.");
  }
  return parsed;
}

/**
 * The acknowledgements, validated rather than trusted.
 *
 * Every field is required and an unparseable file is a failure, not an empty list. A malformed
 * suppression file that silently read as "nothing is suppressed" would be the safe direction; one
 * that silently read as "everything is" would not, and the shape of the bug is not predictable
 * enough to rely on landing the right way.
 */
function readAcknowledgements() {
  let raw;
  try {
    raw = readFileSync(ACKNOWLEDGEMENTS, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`security/advisories.json is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed?.acknowledged)) {
    throw new Error('security/advisories.json must hold an "acknowledged" array.');
  }

  const today = new Date().toISOString().slice(0, 10);
  return parsed.acknowledged.map((entry, index) => {
    const where = `security/advisories.json[${index}]`;
    for (const field of ["advisory", "module", "reason", "expires"]) {
      if (typeof entry?.[field] !== "string" || entry[field].trim() === "") {
        throw new Error(`${where} is missing "${field}". Every field is required.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) {
      throw new Error(`${where} has expires="${entry.expires}"; it must be YYYY-MM-DD.`);
    }
    // A REASON THAT SAYS NOTHING IS NOT A REASON. The length floor is crude and it is the only
    // thing standing between this mechanism and "reason": "dev only".
    if (entry.reason.trim().length < 60) {
      throw new Error(
        `${where} gives a reason of ${entry.reason.trim().length} characters. Say why this ` +
          "advisory does not reach anything a customer relies on, and what would change that.",
      );
    }
    const days = Math.round(
      (Date.parse(`${entry.expires}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
    );
    if (days > MAX_ACKNOWLEDGEMENT_DAYS) {
      throw new Error(
        `${where} expires in ${days} days; the maximum is ${MAX_ACKNOWLEDGEMENT_DAYS}. An ` +
          "acknowledgement is a promise to look again, not a decision to stop looking.",
      );
    }
    return { ...entry, expired: entry.expires < today };
  });
}

// A GUARD THAT DIES WITH A STACK TRACE HAS REPORTED NOTHING. Every refusal above throws with a
// sentence written for the person who has to act on it; this is what makes it the thing they see.
let audit;
let acknowledged;
try {
  audit = runAudit();
  acknowledged = readAcknowledgements();
} catch (error) {
  console.error(`\ncheck-advisories: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
const byAdvisory = new Map(acknowledged.map((a) => [a.advisory, a]));
const used = new Set();

for (const advisory of Object.values(audit.advisories)) {
  const id = advisory.github_advisory_id ?? `npm-${advisory.id}`;
  const severity = String(advisory.severity ?? "unknown");
  const paths = (advisory.findings ?? []).flatMap((f) => f.paths ?? []);
  const where = paths.length === 0 ? "path not reported" : paths.slice(0, 3).join(", ");
  const line = `${severity} ${advisory.module_name}@${advisory.findings?.[0]?.version ?? "?"} ${id} -- ${advisory.title}\n      via ${where}\n      fix: ${advisory.recommendation ?? "none published"}`;

  if (!BLOCKING.has(severity)) {
    notes.push(`  ${line}`);
    continue;
  }

  const ack = byAdvisory.get(id);
  if (ack === undefined) {
    problems.push(`  ${line}`);
    continue;
  }
  used.add(id);
  if (ack.expired) {
    problems.push(`  ${line}\n      acknowledgement EXPIRED on ${ack.expires}: ${ack.reason}`);
    continue;
  }
  notes.push(`  acknowledged until ${ack.expires}: ${line}`);
}

// AN ACKNOWLEDGEMENT FOR AN ADVISORY THAT IS GONE IS ALSO A FAILURE. It is how a suppression file
// becomes a list nobody reads: entries accumulate, none is ever removed, and the next real finding
// arrives into a file that already looks like noise.
for (const ack of acknowledged) {
  if (!used.has(ack.advisory)) {
    problems.push(
      `  ${ack.advisory} (${ack.module}) is acknowledged but the audit no longer reports it. ` +
        "Remove the entry.",
    );
  }
}

const counts = audit.metadata?.vulnerabilities ?? {};
const summary = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([k, n]) => `${n} ${k}`)
  .join(", ");

if (notes.length > 0) {
  console.log(`advisories: not blocking (${BLOCKING.size ? "below high" : "none"}):`);
  for (const note of notes) console.log(note);
}

if (problems.length > 0) {
  console.error(`\ncheck-advisories: ${problems.length} blocking advisory/advisories\n`);
  for (const problem of problems) console.error(problem);
  console.error(
    "\nFix it, or add an entry to security/advisories.json naming the advisory, why it does not " +
      "reach anything a customer relies on, and a date within 90 days to look again.",
  );
  process.exit(1);
}

console.log(
  `check-advisories: no high or critical advisories (${summary === "" ? "none reported" : summary}).`,
);
