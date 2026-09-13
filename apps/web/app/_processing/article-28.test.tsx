import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page from "../dpa/page";
import { ARTICLE_28_CLAUSES, unmetClauses } from "./article-28";
import { DPA_COPY } from "./dpa-content";

/**
 * THE MAPPING, HELD TO THE AGREEMENT IT MAPS.
 *
 * A clause-by-clause mapping is the document a reviewer reads INSTEAD of the agreement. That is
 * what makes it useful and what makes it dangerous: a mapping asserting coverage the agreement does
 * not contain is worse than no mapping at all, because it is believed and it is shorter.
 *
 * So every sub-paragraph marked `met` names a phrase, and that phrase has to appear in the
 * RENDERED PAGE -- not in `DPA_COPY`, which would only prove the mapping agrees with the constant
 * it was written beside, but in the markup a customer's counsel actually reads. A commitment
 * defined and never rendered is a commitment nobody is offered.
 */

const markup = renderToStaticMarkup(<Page />);
const rendered = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&#x2014;|&mdash;/g, "—")
  .replace(/\s+/g, " ");

const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

describe("the agreement answers Article 28(3), sub-paragraph by sub-paragraph", () => {
  it("covers every sub-paragraph exactly once, in the Article's order", () => {
    expect(ARTICLE_28_CLAUSES.map((c) => c.subParagraph)).toEqual([...LETTERS]);
  });

  it("renders the commitment behind every sub-paragraph it marks met", () => {
    // THE ASSERTION THAT MAKES THIS A MAPPING RATHER THAN A WISH. Checked against the rendered
    // page: a clause added to DPA_COPY and never rendered would satisfy a constant-level check and
    // would offer the customer nothing.
    for (const clause of ARTICLE_28_CLAUSES) {
      if (clause.state !== "met") continue;
      expect(
        rendered,
        `(${clause.subParagraph}) is marked met, but the agreement does not say "${clause.commitment}"`,
      ).toContain(clause.commitment);
    }
  });

  it("names a clause of the agreement for every sub-paragraph, met or not", () => {
    // `Object.values` over DPA_COPY is a union of strings and string arrays, so a `v is string`
    // predicate is not assignable to the parameter. Narrow with a plain filter and assert after.
    const headings: string[] = Object.values(DPA_COPY).flatMap((v) =>
      typeof v === "string" && /^\d+\. /.test(v) ? [v] : [],
    );
    for (const clause of ARTICLE_28_CLAUSES) {
      expect(headings, `(${clause.subParagraph}) points at no clause`).toContain(clause.clause);
      expect(rendered, `(${clause.subParagraph})'s clause is not rendered`).toContain(
        clause.clause,
      );
    }
  });

  it("states each requirement in the Article's terms, without padding them", () => {
    // FORTY-FIVE, NOT EIGHTY -- AND I SET IT TO EIGHTY FIRST, one commit after writing a paragraph
    // in `86` about exactly this. (c) is "Takes all measures required pursuant to Article 32", and
    // Art. 28(3)(c) really is that short. A floor on the statute's own wording is satisfiable only
    // by padding it, which makes the mapping longer and less faithful at the same time.
    //
    // What the floor is for is a placeholder -- an empty string, a "TODO", a sub-paragraph added to
    // the list and never written. Forty-five catches those and clears the shortest real one.
    for (const clause of ARTICLE_28_CLAUSES) {
      expect(clause.requirement.length, `(${clause.subParagraph})`).toBeGreaterThan(45);
      expect(clause.commitment.length, `(${clause.subParagraph}) commitment`).toBeGreaterThan(20);
    }
  });
});

describe("what the mapping refuses to claim", () => {
  it("reports the sub-processor sub-paragraph as unmet, because no notice channel exists", () => {
    // ART. 28(2) MAKES A RIGHT TO OBJECT DEPEND ON A NOTICE, and the domain answers NODATA for MX,
    // so the company cannot send one. Writing "we will notify you of any change" into the agreement
    // would be a commitment nothing keeps, in the document a customer relies on most -- which is
    // the failure this repository exists to refuse, in its most expensive location.
    const d = ARTICLE_28_CLAUSES.find((c) => c.subParagraph === "d");
    expect(d?.state).toBe("absent");
    expect(unmetClauses().map((c) => c.subParagraph)).toEqual(["d"]);

    // And the agreement must still be the one saying so, in its own words, to the reader.
    expect(rendered).toContain("No notice period is promised here");
  });

  it("promises no notice period anywhere on the page", () => {
    // The same bans `dpa.test.tsx` already enforces, re-run here because this unit added four
    // clauses to the agreement and an added clause is exactly where a promise slips in.
    const lower = rendered.toLowerCase();
    for (const promise of [
      "days' notice",
      "days notice",
      "advance notice",
      "we will notify you of any new",
      "thirty days before",
    ]) {
      expect(lower, `the agreement promises "${promise}"`).not.toContain(promise);
    }
  });

  it("claims no audit it has not had, while committing to allow one", () => {
    // Art. 28(3)(h) is a commitment to PERMIT an audit. It is not a claim to have HAD one, and the
    // two sit one sentence apart in the same clause -- which is where they would get confused.
    expect(rendered).toContain("will allow it and will take part rather than merely permit it");
    expect(rendered).toContain("There is no third-party audit report to provide");
    expect(rendered.toLowerCase()).not.toContain("independently audited");
  });
});
