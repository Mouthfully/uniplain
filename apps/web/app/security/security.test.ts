import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Brand, brand, FORBIDDEN_CLAIMS, withheldClaims } from "@repo/brand";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SecurityPage, { metadata } from "./page";
import {
  ASSURANCE_DOCUMENTS,
  CONTROLS,
  FACT_ROWS,
  GAPS,
  LAW_POINTS,
  SECURITY_COPY,
  assurance,
  documentsNotHeld,
} from "./_content";

/**
 * /security IS THE ONE PAGE ON THIS SITE WHOSE SUBJECT IS THE BAN LIST ITSELF.
 *
 * `forbidden-claims.test.ts` already scans every route's source, so the cheapest reading of this
 * file is that it duplicates that. It does not, and the difference is the reason this route needed
 * its own tests:
 *
 *   THE SOURCE SCAN CANNOT SEE A COMPUTED SENTENCE. Half of this page is built from brand facts at
 *   render time -- the hosting region, the governing law, the authority, and whether anything is
 *   held. None of those strings appears in any source file under `app/`, so a brand field that
 *   changed into something the ban list refuses would render cleanly past that guard. The tests
 *   below scan the RENDERED page as well as the source.
 *
 *   THE SOURCE SCAN CANNOT SEE AN ASSERTION THAT IS MERELY STALE. "No report is held" is not a
 *   forbidden phrase; it is a true sentence that becomes a false one the day somebody flips
 *   `brand.soc2TypeIIReport`. A page that typed it would pass every existing guard forever. So the
 *   flip is performed here against a copy of the brand facts, and what changes is asserted.
 *
 *   THE COPY GUARD IS A SCRIPT, AND A SCRIPT CAN BE RUN WITH `--warn`. `check-copy.mjs` has an
 *   explicit warn mode and an ignore pragma. This route asserts the same property from inside the
 *   test suite so that neither switch reaches it.
 *
 * WHAT WAS FOUND WHILE WRITING THIS, recorded because the next person will wonder why the page
 * never names the two standards: BOTH CERTIFICATION PATTERNS MATCH THE BARE NAME, with no
 * assertion attached, and `forbidden-claims.test.ts` decodes `\uXXXX` escapes before matching. The
 * name cannot reach this route in any spelling. See the header of `_content.ts` for why importing
 * it from a package outside the scan was refused rather than merely unavailable.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(HERE, "page.tsx");
const CONTENT_PATH = join(HERE, "_content.ts");

/** Blanked the way the repository's other source scanners blank them: a comment renders nothing. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, lead) => lead);
}

/** An escaped space is a space on the page. Decode before matching, or the escape is the way round. */
function decodeEscapes(source: string): string {
  return source.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function fresh(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

const PAGE_SOURCE = decodeEscapes(stripComments(readFileSync(PAGE_PATH, "utf8")));
const CONTENT_SOURCE = decodeEscapes(stripComments(readFileSync(CONTENT_PATH, "utf8")));

const html = renderToStaticMarkup(createElement(SecurityPage));
const RENDERED = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

/** Every string this surface can put in front of a reader, computed values included. */
const COPY_STRINGS: string[] = [
  ...Object.values(SECURITY_COPY),
  ...FACT_ROWS.flatMap((row) => [row.key, row.value]),
  ...CONTROLS.flatMap((control) => [control.title, control.check, ...control.body]),
  ...ASSURANCE_DOCUMENTS.flatMap((document) => [
    document.title,
    document.issuedBy,
    ...document.what,
    ...document.required,
  ]),
  ...GAPS.flatMap((gap) => [gap.term, gap.note]),
  ...LAW_POINTS,
];

describe("no forbidden claim reaches this route", () => {
  it.each(FORBIDDEN_CLAIMS.map((f) => [f.pattern.source, f] as const))(
    "no line of the page or its copy module matches %s",
    (_source, forbidden) => {
      const hits: string[] = [];
      for (const [label, source] of [
        ["page.tsx", PAGE_SOURCE],
        ["_content.ts", CONTENT_SOURCE],
      ] as const) {
        for (const [index, line] of source.split("\n").entries()) {
          if (fresh(forbidden.pattern).test(line)) {
            hits.push(`${label}:${index + 1}: ${line.trim().slice(0, 120)}`);
          }
        }
      }
      expect(hits, forbidden.reason).toEqual([]);
    },
  );

  /**
   * THE HALF A SOURCE SCAN CANNOT DO. `FACT_ROWS`, `LAW_POINTS` and the assurance count are built
   * from `@repo/brand` at module load, so their text exists in no file under `app/`. A brand field
   * edited into something the ban list refuses would render straight past `forbidden-claims.test.ts`
   * and past the scan above it.
   */
  it.each(FORBIDDEN_CLAIMS.map((f) => [f.pattern.source, f] as const))(
    "nothing this surface actually renders matches %s",
    (_source, forbidden) => {
      const inCopy = COPY_STRINGS.filter((value) => fresh(forbidden.pattern).test(value));
      expect(inCopy, forbidden.reason).toEqual([]);
      expect(fresh(forbidden.pattern).test(RENDERED), forbidden.reason).toBe(false);
    },
  );
});

describe("what is not held is computed from the brand facts, never asserted", () => {
  /**
   * THE TEST THE WHOLE PAGE TURNS ON, and the question it answers is "what would have to change
   * here if the fact flipped?". If the answer were "nothing", the page would be asserting something
   * it never checked -- which is exactly the sentence that does the most damage by outliving its
   * own truth, because a buyer reads "no report is held" as current.
   */
  it("holds neither document while both brand facts are false", () => {
    expect(brand.soc2TypeIIReport, "flipped by an auditor, never by an edit").toBe(false);
    expect(brand.iso27001Certificate, "flipped by a certification body, never by an edit").toBe(
      false,
    );
    expect(documentsNotHeld(brand)).toHaveLength(ASSURANCE_DOCUMENTS.length);
    expect(assurance(brand)).toEqual({ kind: "none-held" });
  });

  it.each(ASSURANCE_DOCUMENTS.map((document) => [document.fact, document] as const))(
    "stops listing a document as not held once %s is true",
    (fact, document) => {
      const flipped: Brand = { ...brand, [fact]: true };

      expect(documentsNotHeld(flipped).map((d) => d.id)).not.toContain(document.id);
      expect(documentsNotHeld(flipped)).toHaveLength(ASSURANCE_DOCUMENTS.length - 1);

      const status = assurance(flipped);
      expect(status.kind).toBe("undescribed");
      // The branch carries titles and no prose, for the reason `_figures.ts` keeps a number out of
      // two of its three branches: a sentence about a document nobody here has read would have to
      // invent the firm, the window and the date.
      if (status.kind === "undescribed") expect(status.documents).toContain(document.title);
    },
  );

  it("makes the absolute statement today, and would not while anything is held", () => {
    expect(RENDERED).toContain(SECURITY_COPY.assuranceNoneHeld);
    expect(RENDERED).not.toContain(SECURITY_COPY.assuranceUndescribed);

    const flipped: Brand = { ...brand, soc2TypeIIReport: true, iso27001Certificate: true };
    expect(assurance(flipped).kind).toBe("undescribed");
    expect(documentsNotHeld(flipped)).toEqual([]);
  });

  it("reads the region, the law and the authority out of the brand package", () => {
    expect(RENDERED).toContain(brand.governingPrivacyLaw);
    expect(RENDERED).toContain(brand.supervisoryAuthority);
    if (brand.dataRegion !== null) expect(RENDERED).toContain(brand.dataRegion);
    expect(RENDERED).toContain(brand.postalAddress.country);
  });
});

/**
 * A WITHHELD CLAIM CANNOT BE REWRITTEN AS SECTION COPY HERE EITHER.
 *
 * `withheld-claims.test.tsx` applies this to the homepage and to nothing else. This page is the one
 * most likely to reach for the withheld set: `soc2`, `iso27001`, `gdpr`, `dpa` and `governing-law`
 * are all withheld, and all five are about exactly what this page discusses. `governing-law` is the
 * live trap -- the page prints `brand.governingPrivacyLaw` and `brand.supervisoryAuthority` as
 * labelled values, and the withheld claim is a SENTENCE built from the same two facts. Printing the
 * facts is allowed; restating the sentence is not, and only a run check tells the two apart.
 */
const RUN_LENGTH = 5;

function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function runs(text: string): string[] {
  const words = normalise(text).trim().split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + RUN_LENGTH <= words.length; i += 1) {
    out.push(words.slice(i, i + RUN_LENGTH).join(" "));
  }
  return out;
}

const withheld = withheldClaims();
const pageText = normalise(RENDERED);

describe("a withheld claim is not republished as copy on this page", () => {
  it("has withheld claims to check, so a green run means something", () => {
    expect(withheld.length).toBeGreaterThan(0);
  });

  it.each(withheld.map((entry) => [entry.claim.id, entry] as const))(
    "does not restate the withheld claim %s",
    (_id, entry) => {
      const found = runs(entry.claim.text).filter((run) => pageText.includes(` ${run} `));
      expect(
        found,
        `This page carries wording from the withheld claim "${entry.claim.id}". A claim held back ` +
          "by a brand fact cannot be hand-typed back onto a page -- name the facts, not the verdict.",
      ).toEqual([]);
    },
  );
});

/**
 * EVERY SENTENCE LIVES IN THE COPY MODULE.
 *
 * `check-copy.mjs` owns this rule for the whole site and this asserts it for one route, because
 * that script has a `--warn` mode and a per-line ignore pragma and this page is the wrong one to
 * let through either. The rule is copied from it deliberately: five or more words, ending in
 * terminal punctuation or carrying an internal sentence break.
 *
 * `className` values are removed first for the reason the script masks generics -- a Tailwind class
 * list reads as several words and would fire on markup that renders no prose at all.
 *
 * IT ALREADY CAUGHT SOMETHING THE SCRIPT DOES NOT, and the finding is worth keeping: a ternary
 * choosing between two copy constants tripped it, because `?` is terminal punctuation and a chain
 * of copy identifiers clears the word floor. That is not a false positive dressed up -- a page
 * deciding WHICH promise to make is a page holding copy, so the choice moved into `_content.ts`
 * next to the sentences it chooses between.
 */
const WORD_RE = /[A-Za-zÀ-ɏ]+(?:['’-][A-Za-zÀ-ɏ]+)*/g;

function isSentence(chunk: string): boolean {
  const value = chunk.replace(/\s+/g, " ").trim();
  if ((value.match(WORD_RE) ?? []).length < 5) return false;
  return /[.!?][)"'’”\]]*$/.test(value) || /[.!?]["'’”)\]]?\s+["'“(]?[A-Z]/.test(value);
}

describe("no sentence is typed into the markup", () => {
  it("carries no prose of its own outside the copy module", () => {
    const markup = PAGE_SOURCE.replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, "");
    const offenders = markup
      .split(/[<>{}"'`]/)
      .map((chunk) => chunk.replace(/\s+/g, " ").trim())
      .filter(isSentence);

    expect(
      offenders,
      "A sentence typed into page.tsx renders exactly like an approved one and goes through no " +
        "resolver. Move it into _content.ts beside the comment explaining why it says what it says.",
    ).toEqual([]);
  });
});

describe("the shape the page promises a reader", () => {
  /** Unlike /members and /brief, this is a page a buyer is meant to find. */
  it("is indexed", () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe("/security");
  });

  it("gives every control a way it stays true", () => {
    for (const control of CONTROLS) {
      expect(control.body.length, control.id).toBeGreaterThan(0);
      // A check short enough to be a restatement of the title describes no mechanism.
      expect(control.check.split(/\s+/).length, control.id).toBeGreaterThan(8);
      expect(RENDERED).toContain(control.check);
    }
  });

  it("says what obtaining each document would actually require", () => {
    for (const document of ASSURANCE_DOCUMENTS) {
      expect(document.required.length, document.id).toBeGreaterThan(2);
      expect(document.issuedBy.length, document.id).toBeGreaterThan(0);
      for (const requirement of document.required) expect(RENDERED).toContain(requirement);
    }
  });

  it("states the gaps rather than implying them away", () => {
    expect(GAPS.length).toBeGreaterThan(4);
    for (const gap of GAPS) expect(RENDERED).toContain(gap.note);
  });
});
