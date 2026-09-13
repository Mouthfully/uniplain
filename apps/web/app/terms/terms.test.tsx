import { brand } from "@repo/brand";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUB_PROCESSORS } from "../_processing/sub-processors";
import Page from "./page";

/**
 * THE CONTRACT, HELD TO THE FACTS IT ASSERTS.
 *
 * Nothing tested this page. That is not an oversight anyone would have noticed, because the clause
 * that went wrong was a DENIAL -- "there is no data processing agreement available to sign, no
 * published list of sub-processors" -- and a denial reads as caution rather than as a claim. It was
 * true when written. `/sub-processors` shipped and made a quarter of it false; `/dpa` shipped and
 * made another quarter false; the sentence did not move, and no test existed to move it.
 *
 * A STALE DENIAL IS WORSE HERE THAN ON ANY OTHER PAGE. On a marketing page an understatement costs
 * a sale. In a contract it is the document a customer's reviewer relies on: they read "no DPA is
 * available", conclude the vendor cannot be appointed as a processor, and never open the page where
 * the agreement is. The repository's rule is that a wrong number that looks right is the worst
 * outcome; a wrong sentence in a contract is the same failure in prose.
 *
 * So these assertions run the clause against the SAME facts the page computes it from, in both
 * directions: every arrangement that is held must be stated as held, and every one that is not must
 * be stated as absent. There is no list of expected sentences here -- a list would drift for the
 * same reason the original sentence did.
 */

const markup = renderToStaticMarkup(<Page />);
const text = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

/**
 * The arrangements a buyer checks, each paired with the fact that settles it.
 *
 * This is deliberately a SECOND, INDEPENDENT reading of the same brand facts rather than an import
 * of the page's own `ARRANGEMENTS` array. Importing it would make the test assert that the page
 * agrees with itself, which it cannot fail to do. What has to be proven is that the page agrees
 * with `@repo/brand` and with the sub-processor record -- so the facts are read again here, and
 * only the facts are shared.
 */
const ARRANGEMENTS = [
  {
    what: "a data processing agreement",
    held: brand.dpaAvailable,
    whenHeld: /a data processing agreement is published/i,
    whenAbsent: /no data processing agreement available to sign/i,
  },
  {
    what: "an EU representative",
    held: brand.euRepresentative !== null,
    whenHeld: /a representative is appointed in the european union/i,
    whenAbsent: /no representative is appointed in the european union/i,
  },
  {
    what: "a published sub-processor list",
    held: SUB_PROCESSORS.length > 0,
    whenHeld:
      /processed data on our behalf are published as a list|process data on our behalf are published as a list/i,
    whenAbsent: /no published list of sub-processors/i,
  },
  {
    what: "a security certification",
    held: brand.soc2TypeIIReport || brand.iso27001Certificate,
    whenHeld: /a security certification or attestation is held/i,
    whenAbsent: /no security certification, audit or attestation/i,
  },
] as const;

describe("what the terms say is arranged", () => {
  it("states each arrangement the way the facts have it, and never the other way", () => {
    for (const arrangement of ARRANGEMENTS) {
      const present = arrangement.held ? arrangement.whenHeld : arrangement.whenAbsent;
      const wrong = arrangement.held ? arrangement.whenAbsent : arrangement.whenHeld;

      expect(
        present.test(text),
        `the terms do not say what the facts say about ${arrangement.what}`,
      ).toBe(true);
      expect(
        wrong.test(text),
        `the terms still carry the stale sentence about ${arrangement.what}`,
      ).toBe(false);
    }
  });

  it("covers arrangements in both states, so the assertion above is not vacuous", () => {
    // If every arrangement happened to be absent, the test would only ever exercise the denial
    // branch and the day one became available it would fire for the right reason -- but until then
    // nothing would prove the "held" sentences are even reachable. One of each proves both.
    const held = ARRANGEMENTS.filter((a) => a.held).length;
    expect(held, "no arrangement is held, so the affirmative branch is untested").toBeGreaterThan(
      0,
    );
    expect(held, "every arrangement is held, so the denial branch is untested").toBeLessThan(
      ARRANGEMENTS.length,
    );
  });

  it("does not tell a reader that none of them exists once one does", () => {
    // The clause's own intro sentence is a summary of the four below it, and a summary is the part
    // that goes stale first. "None of them exists today" was true and is not.
    expect(text.toLowerCase()).not.toContain("none of them exists today");
  });
});

describe("the contract claims nothing it does not hold", () => {
  it("asserts no audit, certification or compliance it has not obtained", () => {
    // The same bans `forbidden-claims.test.ts` enforces across every route, applied here against
    // the RENDERED text rather than the source, because this page composes sentences at module
    // scope and a source scan reads the branch that did not render.
    const lower = text.toLowerCase();
    for (const claim of [
      "soc 2",
      "iso 27001",
      "27001",
      "gdpr compliant",
      "pdpa compliant",
      "independently audited",
      "penetration tested",
    ]) {
      expect(lower, `the terms claim "${claim}"`).not.toContain(claim);
    }
  });
});
