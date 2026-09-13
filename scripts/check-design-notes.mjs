#!/usr/bin/env node
/**
 * THE DESIGN-NOTE NUMBER GUARD: two notes may not share a number, and a note's heading may not
 * disagree with its filename.
 *
 * THIS HAS NOW HAPPENED FOUR TIMES AND NEVER ONCE AS A MERGE CONFLICT. Two notes numbered 77
 * sat in this directory for a day; #73 and #75 each collided with #70 and were renumbered before
 * merge; and #80 landed five at once -- 86 through 90 -- against five that had merged while it was
 * open. Every instance has the same shape: two branches open at the same time, each reading the
 * highest number on `main` rather than the highest number CLAIMED, and git with nothing to say
 * because ten different filenames sharing five numbers is not a conflict. It merges clean and
 * ships.
 *
 * A number that identifies two documents identifies neither. Commit messages, PR bodies and the
 * notes' own cross-references all cite notes by number, and every one of those citations becomes
 * ambiguous the moment a number is reused.
 *
 * WHAT THIS DOES NOT DO: require the numbers to be contiguous, or to start at 1, or to match the
 * order they merged in. Gaps are fine and inevitable -- a branch that claims 96 and is abandoned
 * leaves a hole, and filling holes would mean renaming a document somebody has already cited.
 * What is refused is exactly the ambiguity: two files, one number.
 *
 * THE HEADING CHECK IS THE OTHER HALF, and it is the one that catches a rename done with `git mv`
 * and nothing else. A file called `91-…md` whose first line reads `# 86.` is a document that
 * answers to two numbers depending on which one you looked at -- which is the same defect wearing
 * a different hat.
 *
 * TWO THINGS THIS GUARD GOT WRONG ON ITS FIRST RUN, both fixed here rather than in the documents.
 *
 *   `00-` IS A PREFIX, NOT A NUMBER. `00-repo-map.md` and `00-recon-reports.md` deliberately share
 *   it: zero means "the reference material phase 0 produced", and both are cited by name rather
 *   than by number everywhere they appear. Renaming a foundational document that a dozen notes
 *   link to, to satisfy a rule aimed at a different problem, would be the guard doing harm. It is
 *   exempt, and the exemption is narrow -- `00` only.
 *
 *   THE HEADING SEPARATOR IS NOT THE POINT. `64-the-build-order.md` opens `# 64 — The build
 *   order`, with an em dash where most notes use a full stop. The number agrees with the filename,
 *   which is the whole question; the punctuation after it is a house style nobody wrote down and
 *   this guard has no business legislating. Only the digits are compared.
 *
 * Usage: node scripts/check-design-notes.mjs [--warn]
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { parseArgs, readText, repoRoot, report } from "./lib/scan.mjs";

const NOTES_DIR = "docs/marketplane";

/** `NN-name.md` only. The template, the handover and the plan are not numbered notes. */
const NUMBERED = /^(\d+)-[a-z0-9-]+\.md$/;

const { warn } = parseArgs(process.argv);
const findings = [];

function at(file, message) {
  findings.push({ file, line: 1, column: 1, message });
}

const files = readdirSync(join(repoRoot, NOTES_DIR))
  .filter((name) => NUMBERED.test(name))
  .sort();

// A scan that found nothing would pass for ever, which is the failure this whole file is about.
if (files.length < 10) {
  at(
    NOTES_DIR,
    `only ${files.length} numbered design notes were found, which means the filename pattern no ` +
      "longer matches this directory and this guard is checking nothing.",
  );
}

const byNumber = new Map();
for (const name of files) {
  const number = Number((NUMBERED.exec(name) ?? [])[1]);
  const seen = byNumber.get(number);
  // `00` is the phase-zero reference prefix, shared on purpose. See the header.
  if (number === 0 || seen === undefined) {
    byNumber.set(number, name);
  } else {
    at(
      `${NOTES_DIR}/${name}`,
      `note ${number} is also \`${seen}\`. Two documents with one number make every citation of ` +
        "that number ambiguous, and git will never tell you: different filenames are not a " +
        "conflict. Renumber the one that has not merged yet, past the highest number CLAIMED by " +
        "any open branch rather than the highest on main.",
    );
  }

  // The heading must agree with the filename. The DIGITS only -- see the header on why the
  // separator after them is not this guard's business.
  const text = readText(`${NOTES_DIR}/${name}`);
  const heading = /^#\s+(\d+)\b/.exec(text ?? "");
  if (heading === null) {
    if (number !== 0) {
      at(
        `${NOTES_DIR}/${name}`,
        "the first line does not open with `# NN`, so nothing can check the number inside the " +
          "file against the number on it.",
      );
    }
  } else if (Number(heading[1]) !== number) {
    at(
      `${NOTES_DIR}/${name}`,
      `the filename says note ${number} and the heading says note ${heading[1]}. A renumber done ` +
        "with `git mv` alone leaves the document answering to two numbers depending on which one " +
        "you looked at.",
    );
  }
}

process.exit(
  report({
    name: "design-note guard",
    findings,
    notes: [
      "two notes may not share a number; every citation of a reused number is ambiguous",
      "a note's heading must agree with its filename, which is what catches a bare `git mv`",
      "gaps are allowed -- filling one would rename a document somebody has already cited",
    ],
    warn,
    summary: `${files.length} numbered notes, each with a number of its own`,
  }),
);
