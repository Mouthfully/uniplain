import { readFileSync } from "node:fs";
import { brand, withheldClaims } from "@repo/brand";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page from "../dpa/page";
import { PROCESSING_ACTIVITIES } from "./activities";
import { DPA_COPY, DPA_VERSION } from "./dpa-content";
import { SUB_PROCESSOR_NOTICE_DAYS, SUB_PROCESSORS } from "./sub-processors";

/**
 * THE AGREEMENT, HELD TO THE SYSTEM IT DESCRIBES.
 *
 * A data processing agreement is the one document where a promise and a fact sit in the same
 * sentence, and where a customer's counsel will check the second before trusting the first. A
 * template says what a vendor wishes were true; this one is rendered from the record of processing,
 * and these assertions are what make that more than a claim about the rendering.
 *
 * The obligations are not tested here, because a promise is not a testable fact -- "we will notify
 * you without undue delay" is a commitment, and the thing to check is that it is made, not that it
 * is true. What IS tested is every descriptive clause: who is a processor, what categories are
 * held, which providers receive data, and the four things the page must not claim.
 */

const markup = renderToStaticMarkup(<Page />);
const say = (m: string) =>
  m
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
const text = say(markup);

describe("the agreement describes the system, not a template", () => {
  it("renders the processor activities and no controller ones in the scope clause", () => {
    // Section 1 draws the controller/processor line in prose; section 3 draws it in code. If the
    // two ever disagree the agreement would be describing the customer's obligations as ours or
    // the reverse, which is the single worst error this document can contain.
    const processor = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor");
    expect(processor.length).toBeGreaterThan(0);
    for (const activity of processor) {
      expect(text, activity.id).toContain(activity.categories);
      expect(text, activity.id).toContain(activity.subjects);
    }

    // A controller-only activity's categories must NOT appear in the scope clause: the customer's
    // own account records are not processed on their behalf and are not in scope here.
    const billing = PROCESSING_ACTIVITIES.find((a) => a.id === "billing");
    expect(billing?.role).toBe("controller");
    if (billing !== undefined) expect(text).not.toContain(billing.categories);
  });

  it("names every disclosed sub-processor", () => {
    for (const provider of SUB_PROCESSORS) {
      expect(text, provider.name).toContain(provider.name);
    }
  });

  it("carries a version a customer can cite", () => {
    expect(text).toContain(DPA_VERSION);
    expect(DPA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("tells the reader it has not been approved by anyone", () => {
    // The most dangerous way to read a self-published agreement is as though a regulator or a
    // lawyer had signed it off. The page says otherwise, in its own words, above the terms.
    expect(text).toContain(DPA_COPY.reviewNote);
    expect(text.toLowerCase()).toContain("legal question");
  });
});

/**
 * Does the page ASSERT this phrase, as opposed to denying it?
 *
 * THE FIRST VERSION OF THIS GUARD FIRED ON THE AGREEMENT'S OWN DENIAL. The security clause says
 * "No claim is made on this page that any of this has been audited or certified by anyone", and a
 * bare `not.toContain("certified")` went red on it -- so the cheapest way to make the build pass
 * would have been to DELETE THE SENTENCE THAT TELLS THE TRUTH. That is the third time in this
 * repository a word-level ban has caught a negation; `74-the-cadence-nobody-keeps.md` names the
 * same failure and closes with the same fix.
 *
 * So a match counts only when nothing negates it in the clause before. The window is the preceding
 * sentence rather than a fixed character count, because "no ... audited or certified by anyone"
 * puts the negator a long way from the word.
 */
function asserts(haystack: string, phrase: string): boolean {
  const NEGATORS = /\b(no|not|never|nothing|neither|nor|none)\b/;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(phrase, from);
    if (at === -1) return false;
    const clauseStart = Math.max(
      haystack.lastIndexOf(".", at) + 1,
      haystack.lastIndexOf(";", at) + 1,
    );
    if (!NEGATORS.test(haystack.slice(clauseStart, at))) return true;
    from = at + phrase.length;
  }
}

describe("what the agreement must not claim", () => {
  it("claims no audit, certification or test it does not hold", () => {
    const lower = text.toLowerCase();
    for (const claim of [
      "soc 2",
      "iso 27001",
      "independently audited",
      "penetration tested",
      "gdpr compliant",
      "pdpa compliant",
      "certified",
    ]) {
      expect(asserts(lower, claim), `the agreement claims "${claim}"`).toBe(false);
    }
  });

  it("claims no transfer instrument", () => {
    // The transfers clause states the facts and declines the mechanism, which is the same posture
    // `/privacy` takes. A DPA asserting standard contractual clauses that do not exist would be the
    // most consequential false sentence on the site.
    const lower = text.toLowerCase();
    expect(lower).toContain("no separate transfer instrument");
    for (const claim of [
      "standard contractual clauses are in place",
      "we have scc",
      "adequacy decision",
    ]) {
      expect(lower, `the agreement claims "${claim}"`).not.toContain(claim);
    }
  });

  it("promises no retention period, because none is set", () => {
    const lower = text.toLowerCase();
    for (const promise of ["30 days", "90 days", "within a year", "for six years"]) {
      expect(lower, `the agreement states a retention period: "${promise}"`).not.toContain(promise);
    }
  });

  it("promises a sub-processor notice period only because a mechanism now gives one", () => {
    // THIS ASSERTION USED TO RUN THE OTHER WAY, and the reversal is the point rather than a
    // loosened test. It banned "days' notice" and "advance notice" outright, and that was correct
    // for as long as it was true: the domain answers NODATA for MX, so a promise to notify was a
    // promise nothing could keep -- in the document a customer relies on most.
    //
    // What changed is not the appetite for the promise, it is the mechanism. Art. 28(2) says
    // INFORM, not send. A dated change list on the page the agreement points at, plus a notice on
    // the screen a signed-in customer lands on, informs them -- and cannot bounce, cannot go to
    // spam, and cannot be sent to someone who left the company.
    //
    // So the ban is replaced by its inverse: the agreement must state a period, and that period
    // must be THE ONE THE CODE ENFORCES. A number typed here that disagreed with
    // SUB_PROCESSOR_NOTICE_DAYS would be the original defect wearing a commitment's clothes.
    expect(SUB_PROCESSOR_NOTICE_DAYS).toBe(30);
    expect(text.toLowerCase()).toContain("thirty days after it is published");
    expect(text.toLowerCase()).toContain("may end the agreement within that window");

    // Still banned: a notice about anything the mechanism does not cover. The window applies to
    // sub-processor changes and to nothing else, and a promise that drifted wider would be
    // unbacked again.
    for (const promise of ["we will email you", "we will write to you", "we will contact you"]) {
      expect(text.toLowerCase(), `the agreement promises "${promise}"`).not.toContain(promise);
    }
  });
});

describe("the brand fact and the claim it does not unlock", () => {
  it("records that an agreement now exists", () => {
    expect(brand.dpaAvailable).toBe(true);
  });

  it("still withholds the dpa claim, on the requirement that is genuinely missing", () => {
    // The claim's text promises "Article 28 terms" -- GDPR -- and a representative in the Union.
    // This is a PDPA s.40 instrument and `euRepresentative` is null, so the claim stays off. The
    // fact being true and the claim being withheld is the correct end state, not an oversight.
    const withheld = withheldClaims().find((entry) => entry.claim.id === "dpa");
    expect(withheld, "the dpa claim became publishable when it should not have").toBeDefined();
    expect(withheld?.missing).toContain("euRepresentative");
  });

  it("agrees with the privacy notice, which reads the same fact", () => {
    // `DPA_LINE` in `/privacy` branches on `brand.dpaAvailable`. Two pages, one fact; this catches
    // the half-done change where one says an agreement exists and the other says it does not.
    const notice = readFileSync(new URL("../privacy/page.tsx", import.meta.url).pathname, "utf8");
    expect(notice).toContain("brand.dpaAvailable");
    expect(notice).toContain("A data processing agreement is available");
  });
});
