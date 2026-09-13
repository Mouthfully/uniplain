#!/usr/bin/env node
/**
 * THE CACHE-WITHOUT-AN-INSTALL GUARD.
 *
 * `actions/setup-node` with `cache: pnpm` does two things: it RESTORES the pnpm content-addressable
 * store before the job, and it SAVES it afterwards. The save step reads the path that
 * `pnpm store path` reports, and if that directory does not exist it does not shrug -- it reports
 *
 *     Path Validation Error: Path(s) specified in the action for caching do(es) not exist
 *
 * and fails the job.
 *
 * A JOB THAT NEVER RUNS `pnpm install` NEVER CREATES THAT DIRECTORY. So whether such a job passes
 * depends entirely on whether the cache was a HIT: on a hit the restore creates the directory and
 * the save no-ops, and on a miss there is nothing there and the job fails after every real step has
 * already succeeded.
 *
 * THAT MAKES IT A BUG THAT ONLY FIRES ON DEPENDENCY PULL REQUESTS, because the cache key is the
 * lockfile hash and a dependency bump changes the lockfile by definition. It shipped, and the first
 * thing it did was fail all eight open Dependabot pull requests at once -- two of which only bump a
 * GitHub Action version and touch no application code at all -- while the guards inside the job
 * printed their PASS lines in the same log. Every one of those failures read as "the dependency
 * broke the build".
 *
 * So the rule: a job may ask for a package-manager cache only if it also installs. Nothing else
 * about caching is policed here -- a job that installs may cache or not as it likes.
 *
 * Usage: node scripts/check-workflow-cache.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = ".github/workflows";

/**
 * Jobs are split on their own indentation rather than parsed as YAML, and that is a deliberate
 * limit: adding a YAML parser to the root to read two keys buys a dependency for the one guard in
 * the tree that has none. A workflow whose jobs are not two-space indented would slip past this,
 * which is why the guard PRINTS the jobs it found -- a run that reports zero jobs in a file that
 * plainly has some is visible, where a silent zero would not be.
 */
function jobsOf(source) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (start === -1) return [];

  const jobs = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header !== null) {
      if (current !== null) jobs.push(current);
      current = { name: header[1], body: [] };
      continue;
    }
    // A line at column 0 ends the jobs block entirely.
    if (line.trim() !== "" && !line.startsWith("  ")) break;
    if (current !== null) current.body.push(line);
  }
  if (current !== null) jobs.push(current);
  return jobs.map((job) => ({ name: job.name, body: job.body.join("\n") }));
}

const findings = [];
let jobCount = 0;

for (const file of readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name))) {
  const source = readFileSync(join(WORKFLOWS, file), "utf8");
  for (const job of jobsOf(source)) {
    jobCount += 1;
    // `cache:` on setup-node, and any `cache-dependency-path` that goes with it.
    const asksForCache = /^\s*cache:\s*(pnpm|npm|yarn)\s*$/m.test(job.body);
    if (!asksForCache) continue;
    // An install is the only thing that creates the store the save step looks for.
    const installs = /^\s*(run:|-\s*run:).*\b(pnpm|npm|yarn)\s+(install|ci)\b/m.test(job.body);
    if (installs) continue;
    findings.push(
      `${file} job "${job.name}" asks setup-node for a package-manager cache and never installs. ` +
        "On a cache miss -- which every dependency bump is, because the key is the lockfile hash -- " +
        "the store directory is never created and the post-job save fails the whole job.",
    );
  }
}

console.log("workflow cache guard");
console.log(
  "  note: a job may ask for a package-manager cache only if it also runs an install; a job that " +
    "does not install has no store to save, and the save step errors rather than skipping",
);
console.log(`  note: ${jobCount} job(s) read across ${WORKFLOWS}`);

if (findings.length > 0) {
  for (const finding of findings) console.error(`  FAIL -- ${finding}`);
  process.exit(1);
}

console.log(`  PASS -- no job caches a store it never creates`);
