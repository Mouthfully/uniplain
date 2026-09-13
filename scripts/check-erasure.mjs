#!/usr/bin/env node
/**
 * THE ERASURE GUARD: the archive write and the archive delete must go live together.
 *
 * `deleteWorkspacePayloads` is written, exported and tested, and has NO PRODUCTION CALLER. In an
 * erasure path that reads like an oversight, and it is not one -- `putPayload` and
 * `putBufferedPayload` have no production caller either. The R2 archive holds nothing, so there is
 * nothing to fail to delete. Today the two absences cancel out exactly.
 *
 * THE DAY THEY STOP CANCELLING IS THE DAY THIS BECOMES A LIVE DEFECT, AND IT WILL BE SILENT.
 * Wiring the archive into the ingest path is a feature with an obvious success condition: payloads
 * appear in R2, and a developer watching for that will see it. Nothing about that change surfaces
 * the erasure half. `public.delete_organisation` cascades through thirteen tables and cannot reach
 * a bucket, so `/account` would go on reporting a closed account -- correctly, about Postgres --
 * while the customer's platform data sat in object storage, still billed for, after they asked for
 * it to be gone. `19_erasure.sql` would stay green throughout: it reads `pg_class`, and R2 is not
 * in the catalogue.
 *
 * That is the shape this repository calls the worst possible outcome. Not an error, not a blank:
 * an answer that looks right. "Your account is closed" is a wrong number of exactly that kind, and
 * the person it misleads is the one who asked to be forgotten.
 *
 * SO THE COUPLING IS ENFORCED RATHER THAN REMEMBERED. If a shipping module calls a payload WRITE,
 * some shipping module must call the workspace DELETE. This says nothing about where, or how, or on
 * what schedule -- that is the design of whoever wires the archive up. It says only that shipping
 * one half alone fails the build, with the reason attached to the failure.
 *
 * THE CONVERSE IS DELIBERATELY NOT CHECKED. A delete with no write is harmless, and is the state
 * today. Asserting it would mean deleting a tested function in order to go green, which is the
 * opposite of the point.
 *
 * WHY A GUARD SCRIPT AND NOT A VITEST FILE. It was written as one first, in `@repo/payloads`, and
 * that package targets the Workers runtime and carries no `@types/node` -- a source scan needs
 * `node:fs` and the typecheck refused it. The invariant also spans two packages and an app, which
 * is what this directory is for.
 */

import { listFiles, parseArgs, readText, report } from "./lib/scan.mjs";

const { warn } = parseArgs(process.argv.slice(2));

/** Functions that put a customer's platform data into the bucket. */
const WRITERS = ["putPayload", "putBufferedPayload"];

/** The one that takes it out again for a single workspace. */
const ERASER = "deleteWorkspacePayloads";

/**
 * The module that DEFINES these functions, excluded from the scan.
 *
 * Without this the definition and its own doc comment count as callers and the guard fires on
 * itself from its first run. Two earlier source-scanning guards in this repository shipped with
 * exactly that false positive.
 */
const DEFINING_MODULE = "packages/payloads/src/";

/** A file that ships. Tests, fixtures and build output do not. */
function ships(rel) {
  if (!/\.(ts|tsx)$/.test(rel)) return false;
  if (/\.test\.(ts|tsx)$/.test(rel)) return false;
  if (rel.startsWith(DEFINING_MODULE)) return false;
  if (rel.includes("/test/") || rel.includes("/tests/")) return false;
  if (rel.includes("/dist/") || rel.includes("/.next/")) return false;
  return true;
}

/**
 * Does this file CALL the name, as opposed to discussing it?
 *
 * THIS DISTINCTION IS THE WHOLE DIFFICULTY. `packages/connectors/src/sources/woocommerce/client.ts`
 * discusses `putBufferedPayload` across three paragraphs of comment and calls it nowhere. A bare
 * substring match would read that as the archive being live and demand an eraser for data that does
 * not exist -- a guard that fails the build over prose, which teaches the next person to delete the
 * prose. So comments and template literals are stripped and the match is made against code.
 */
function calls(text, name) {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, " ");
  // A call, or a named import / re-export binding: `import { putPayload } from ...` is how a
  // caller in another package starts, and catching only `name(` would miss a re-export that hands
  // the writer to code this guard never sees.
  return (
    new RegExp(`\\b${name}\\s*\\(`).test(code) || new RegExp(`\\b${name}\\b\\s*[,}\\n]`).test(code)
  );
}

const findings = [];
const files = listFiles().filter(ships);

// A guard that reads nothing passes, which is the failure this repository has shipped before: a
// renamed directory silently emptied the corpus and the check reported PASS for weeks.
if (files.length < 50) {
  findings.push({
    file: "scripts/check-erasure.mjs",
    line: 1,
    column: 1,
    message:
      `the scan found only ${files.length} shipping TypeScript files, which is too few to be ` +
      "real. The filter or the repository layout changed; a guard that reads nothing passes.",
  });
}

const writerCallers = [];
const eraserCallers = [];

for (const rel of files) {
  const text = readText(rel);
  if (WRITERS.some((w) => calls(text, w))) writerCallers.push(rel);
  if (calls(text, ERASER)) eraserCallers.push(rel);
}

if (writerCallers.length > 0 && eraserCallers.length === 0) {
  for (const rel of writerCallers) {
    findings.push({
      file: rel,
      line: 1,
      column: 1,
      message:
        `this module archives payloads to R2, and nothing in the repository calls ${ERASER}. ` +
        "Closing an account deletes thirteen tables by cascade and cannot reach a bucket, so a " +
        "customer's platform data would survive an erasure that /account reports as done. Wire " +
        "the delete into the erasure path before shipping the write.",
    });
  }
}

process.exit(
  report({
    name: "erasure guard",
    findings,
    notes: [
      `payload writers: ${WRITERS.join(", ")}`,
      `workspace eraser: ${ERASER}`,
      writerCallers.length === 0
        ? "no shipping module archives payloads yet, so there is nothing in R2 to erase"
        : `archived by: ${writerCallers.join(", ")}`,
      eraserCallers.length === 0
        ? "no shipping module erases them yet, which is only safe while the line above holds"
        : `erased by: ${eraserCallers.join(", ")}`,
    ],
    warn,
    summary:
      "no payload reaches R2 without something able to delete it when a customer closes their " +
      "account",
  }),
);
