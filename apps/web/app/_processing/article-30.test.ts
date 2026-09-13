import { existsSync } from "node:fs";
import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { ARTICLE_30_RECORD, SECURITY_MEASURES, unmetSubParagraphs } from "./article-30";
import { PROCESSING_ACTIVITIES } from "./activities";
import { SUB_PROCESSORS } from "./sub-processors";

/**
 * THE RECORD, HELD TO THE ARTICLE AND TO THE SYSTEM.
 *
 * The danger with a record of processing is not that it is missing. It is that it is COMPLETE AND
 * WRONG -- seven sub-paragraphs, each with a confident paragraph under it, none of which anybody
 * checked against the software. That document passes a first review and fails the only one that
 * matters, and it is the document a template produces.
 *
 * So two things are asserted, and the second is the one that makes this more than formatting:
 *
 *   1. EVERY SUB-PARAGRAPH OF ART. 30(1) IS PRESENT, exactly once, in order. A record that silently
 *      omits (e) looks finished.
 *   2. EVERY ANSWER IS DERIVED OR REFUSED. A sub-paragraph marked `recorded` must be backed by
 *      something in the repository -- an activity, a provider, a file on disk. One that cannot be
 *      answered must be marked `absent` and say why. What is forbidden is the third state: a
 *      confident sentence with nothing behind it.
 */

const LETTERS = ["a", "b", "c", "d", "e", "f", "g"] as const;

describe("the record covers Article 30(1) and nothing is quietly missing", () => {
  it("has each sub-paragraph exactly once, in the order the Article numbers them", () => {
    expect(ARTICLE_30_RECORD.map((e) => e.subParagraph)).toEqual([...LETTERS]);
  });

  it("states each requirement in the Article's terms, and answers each at length", () => {
    // THE FLOORS ARE ASYMMETRIC, AND THAT IS THE POINT. `content` and `evidence` are OURS, so a
    // short one is a placeholder. `requirement` is the ARTICLE'S, and (b) really is "The purposes
    // of the processing." -- thirty-one characters. The first version of this held the quoted
    // statute to a length we invented, which would have been satisfied by padding the Article's own
    // words. A floor on somebody else's text is a floor on nothing.
    for (const entry of ARTICLE_30_RECORD) {
      expect(entry.requirement.length, `(${entry.subParagraph}) requirement`).toBeGreaterThan(25);
      expect(entry.content.length, `(${entry.subParagraph}) content`).toBeGreaterThan(80);
      expect(entry.evidence.length, `(${entry.subParagraph}) evidence`).toBeGreaterThan(20);
    }
  });

  it("cites a file that exists for every piece of evidence", () => {
    // A record whose evidence points at a deleted file is a record nobody has read since the file
    // was deleted. Paths are checked on disk; anything that is not a path is skipped rather than
    // failed, because some evidence is legitimately a published route.
    for (const entry of ARTICLE_30_RECORD) {
      const paths = entry.evidence
        .split(",")
        .map((p) => p.trim().split(" ")[0] ?? "")
        .filter((p) => p.includes("/") && /\.(ts|tsx|sql)$/.test(p));
      expect(paths.length, `(${entry.subParagraph}) cites no file`).toBeGreaterThan(0);
      for (const path of paths) {
        expect(
          existsSync(new URL(`../../../../${path}`, import.meta.url).pathname),
          `(${entry.subParagraph}) cites ${path}, which does not exist`,
        ).toBe(true);
      }
    }
  });
});

describe("what the record refuses to claim", () => {
  it("reports the transfer sub-paragraph as absent, because no instrument exists", () => {
    // (e) IS THE ONE A TEMPLATE FILLS IN. Every recipient is in a third country from the Union's
    // standpoint, the controller is too, and no Art. 46 safeguard has been entered. A record that
    // asserted standard contractual clauses here would be the most consequential false sentence in
    // the compliance surface -- it is the sentence a reviewer relies on to clear the transfer.
    const e = ARTICLE_30_RECORD.find((x) => x.subParagraph === "e");
    expect(e?.state).toBe("absent");
    expect(e?.content.toLowerCase()).toContain("no art. 46 safeguard is in place");
    for (const invention of [
      "standard contractual clauses are in place",
      "adequacy decision has been granted",
      "binding corporate rules are in place",
    ]) {
      expect(e?.content.toLowerCase() ?? "", `the record claims: ${invention}`).not.toContain(
        invention,
      );
    }
  });

  it("marks the identity sub-paragraph partial while a representative and DPO are undecided", () => {
    // Goes red the day either is settled, which is the intended forcing function: `brand.test.ts`
    // uses the same mechanism for a certificate. A compliance position may not be established by a
    // one-character edit, and may not be left stale by one either.
    const a = ARTICLE_30_RECORD.find((x) => x.subParagraph === "a");
    expect(brand.euRepresentative).toBeNull();
    expect(brand.dataProtectionOfficer).toBeNull();
    expect(a?.state).toBe("partial");
    expect(a?.content).toContain("NONE DESIGNATED");
    expect(a?.content).toContain("NONE APPOINTED");
  });

  it("states no retention period it does not hold", () => {
    const f = ARTICLE_30_RECORD.find((x) => x.subParagraph === "f");
    const recorded = PROCESSING_ACTIVITIES.filter((a) => a.retention !== null).length;
    expect(f?.state).toBe(recorded === PROCESSING_ACTIVITIES.length ? "recorded" : "partial");
    expect(f?.content).toContain(`${recorded} of ${PROCESSING_ACTIVITIES.length}`);
    for (const period of ["30 days", "90 days", "six years", "one year"]) {
      expect(f?.content.toLowerCase() ?? "", `the record states a period: ${period}`).not.toContain(
        period,
      );
    }
  });

  it("hands a reviewer the unmet list rather than making them find it", () => {
    const unmet = unmetSubParagraphs().map((e) => e.subParagraph);
    expect(unmet, "the unmet list is empty, which contradicts the assertions above").not.toEqual(
      [],
    );
    expect(unmet).toContain("e");
    expect(unmet).toContain("a");
  });
});

describe("the derived sub-paragraphs move when the system moves", () => {
  it("counts the activities that exist, not a number typed once", () => {
    const b = ARTICLE_30_RECORD.find((x) => x.subParagraph === "b");
    expect(b?.content).toContain(`${PROCESSING_ACTIVITIES.length} activities`);
    for (const activity of PROCESSING_ACTIVITIES) {
      expect(b?.content, `activity ${activity.id} is missing from (b)`).toContain(activity.id);
    }
  });

  it("names every disclosed recipient in (d)", () => {
    const d = ARTICLE_30_RECORD.find((x) => x.subParagraph === "d");
    for (const provider of SUB_PROCESSORS) {
      expect(d?.content, `${provider.name} is missing from (d)`).toContain(provider.name);
    }
  });

  it("backs every security measure with a file that exists", () => {
    // ART. 30(1)(g) INVITES ADJECTIVES. "Industry-standard encryption" would satisfy any reader and
    // no test. Each measure names a mechanism, and the mechanism has to be somewhere on disk.
    expect(SECURITY_MEASURES.length).toBeGreaterThanOrEqual(4);
    for (const m of SECURITY_MEASURES) {
      expect(m.measure.length, "a measure with no detail is an adjective").toBeGreaterThan(90);
      expect(
        existsSync(new URL(`../../../../${m.evidence}`, import.meta.url).pathname),
        `the measure cites ${m.evidence}, which does not exist`,
      ).toBe(true);
    }
  });
});
