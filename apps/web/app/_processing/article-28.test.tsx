import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page from "../dpa/page";
import { ARTICLE_28_CLAUSES, unmetClauses } from "./article-28";
import { DPA_COPY } from "./dpa-content";
import { lastChangedAt, SUB_PROCESSOR_CHANGES, SUB_PROCESSOR_NOTICE_DAYS } from "./sub-processors";

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
  it("meets the sub-processor sub-paragraph only because a mechanism backs it", () => {
    // THIS ASSERTION USED TO RUN THE OTHER WAY. It required (d) to be `absent`, on the reasoning
    // that Art. 28(2) makes a right to object depend on a notice, that a notice needs a channel,
    // and that the domain answers NODATA for MX -- so the sub-paragraph waited on DNS.
    //
    // THE ARTICLE SAYS INFORM, NOT SEND. The blocker was a reading, not a dependency. So the
    // assertion is replaced by its inverse, and it is deliberately NOT a bare `expect met`: what
    // has to hold is that the promise is backed, in three places that can each be broken
    // separately.
    const d = ARTICLE_28_CLAUSES.find((c) => c.subParagraph === "d");
    expect(d?.state).toBe("met");
    expect(unmetClauses(), "a sub-paragraph regressed").toEqual([]);

    // 1. The period the agreement states is the period the code enforces.
    expect(SUB_PROCESSOR_NOTICE_DAYS).toBe(30);
    expect(rendered).toContain("no sooner than thirty days after it is published");

    // 2. The remedy exists, because informing without a remedy is not an opportunity to object.
    expect(rendered).toContain("may end the agreement within that window");

    // 3. There is something to publish into. A notice mechanism with no change list is a promise
    //    about a page that would be blank the first time it mattered.
    expect(SUB_PROCESSOR_CHANGES.length).toBeGreaterThan(0);
    expect(lastChangedAt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("promises no notice it cannot give", () => {
    // The mechanism covers sub-processor changes on surfaces this company controls. A promise to
    // email, write or contact would be unbacked again -- the domain still answers NODATA for MX,
    // and that has not stopped mattering, it has stopped being load-bearing for THIS clause.
    const lower = rendered.toLowerCase();
    for (const promise of [
      "we will email you",
      "we will write to you",
      "we will contact you",
      "we will call you",
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
