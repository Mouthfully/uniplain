import { describe, expect, it } from "vitest";

import { PROCESSING_ACTIVITIES } from "./activities";
import { ARTICLE_30_RECORD, SECURITY_MEASURES } from "./article-30";
import { SCC_ANNEXES, SCC_CLAUSES_NOTE, sectionsNeedingSomeoneElse } from "./scc-annexes";
import { SUB_PROCESSORS } from "./sub-processors";

/**
 * THE ANNEXES, AND THE THING THEY MUST NOT BE MISTAKEN FOR.
 *
 * An annex is signed. That is the whole difference between this file and every other assessment in
 * this directory: the Art. 30 record and the Art. 28 mapping are documents a reviewer reads, and a
 * wrong sentence in them is embarrassing. **A wrong sentence in an annex is a wrong sentence in a
 * contract**, describing a system that is not the one running.
 *
 * So two things are asserted, and the second is the one that matters most:
 *
 *   1. Every generated section is generated -- it tracks the record of processing, the security
 *      measures and the sub-processor list, and a mutation to any of those moves it.
 *   2. **Nothing here looks like a complete transfer instrument.** No Art. 46 safeguard has been
 *      entered. The annexes are the half that is ours; the Clauses are the Commission's and are a
 *      signature. A test asserts the sentence saying so survives, because deleting it is the
 *      cheapest way to make this look finished.
 */

describe("the annexes track the system rather than describing it once", () => {
  it("has every section the Decision's annexes ask for", () => {
    const ids = SCC_ANNEXES.map((s) => s.id);
    for (const required of [
      "I.A",
      "I.B.subjects",
      "I.B.data",
      "I.B.sensitive",
      "I.B.frequency",
      "I.B.nature",
      "I.B.purpose",
      "I.B.retention",
      "I.C",
      "II",
      "III",
    ]) {
      expect(ids, `annex section ${required} is missing`).toContain(required);
    }
    expect(new Set(ids).size, "a section id is duplicated").toBe(ids.length);
  });

  it("draws the transfer description from the processor activities", () => {
    const processor = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor");
    expect(processor.length).toBeGreaterThan(0);

    const subjects = SCC_ANNEXES.find((s) => s.id === "I.B.subjects");
    const data = SCC_ANNEXES.find((s) => s.id === "I.B.data");
    const nature = SCC_ANNEXES.find((s) => s.id === "I.B.nature");
    for (const activity of processor) {
      expect(subjects?.content, `${activity.id} subjects`).toContain(activity.subjects);
      expect(data?.content, `${activity.id} categories`).toContain(activity.categories);
      expect(nature?.content, `${activity.id} purpose`).toContain(activity.purpose);
    }

    // A CONTROLLER-ONLY ACTIVITY MUST NOT APPEAR. The customer's own account records are not
    // processed on their behalf and are not part of this transfer; an annex that swept them in
    // would describe a transfer that is not happening.
    const billing = PROCESSING_ACTIVITIES.find((a) => a.id === "billing");
    expect(billing?.role).toBe("controller");
    if (billing !== undefined) {
      expect(data?.content).not.toContain(billing.categories);
    }
  });

  it("draws Annex II from the security measures and Annex III from the sub-processors", () => {
    const annexII = SCC_ANNEXES.find((s) => s.id === "II");
    for (const measure of SECURITY_MEASURES) {
      expect(annexII?.content, "a security measure is missing from Annex II").toContain(
        measure.measure,
      );
    }
    const annexIII = SCC_ANNEXES.find((s) => s.id === "III");
    for (const provider of SUB_PROCESSORS) {
      expect(annexIII?.content, `${provider.name} is missing from Annex III`).toContain(
        provider.name,
      );
    }
  });
});

describe("what the annexes refuse to fill in", () => {
  it("leaves the exporter and the supervisory authority to the customer", () => {
    // A PLACEHOLDER WOULD PRODUCE AN ANNEX THAT LOOKS COMPLETE AND NAMES NOBODY. The exporter is
    // the customer; the competent authority under Clause 13 follows from where the exporter is
    // established. Neither is knowable here.
    const outstanding = sectionsNeedingSomeoneElse().map((s) => s.id);
    expect(outstanding).toContain("I.A");
    expect(outstanding).toContain("I.C");
  });

  it("does not name this company's own regulator as the competent authority", () => {
    // THE WRONG ANSWER THAT READS RIGHT. Thailand's PDPC supervises this company and is not the
    // competent supervisory authority for these Clauses -- Clause 13 points at the exporter's
    // Member State. An annex naming the PDPC here would be filled in, plausible and wrong.
    const c = SCC_ANNEXES.find((s) => s.id === "I.C");
    expect(c?.state).toBe("for-the-customer");
    expect(c?.content).toContain("Clause 13");
    expect(c?.content.toLowerCase()).toContain("is not the competent authority for these clauses");
  });

  it("states no retention period, because none is set", () => {
    // AN ANNEX IS EXACTLY WHERE "24 MONTHS" GETS TYPED because the box wants something -- and it
    // would be a period nobody decided, signed.
    const r = SCC_ANNEXES.find((s) => s.id === "I.B.retention");
    expect(r?.state).toBe("absent");
    for (const period of ["24 months", "12 months", "six years", "90 days", "30 days"]) {
      expect(r?.content.toLowerCase() ?? "", `the annex states a period: ${period}`).not.toContain(
        period,
      );
    }
  });

  it("keeps the sentence saying these are annexes and not an instrument", () => {
    // THE CHEAPEST WAY TO MAKE THIS LOOK FINISHED IS TO DELETE THIS SENTENCE, which is why it is an
    // exported constant with a test on it rather than a comment.
    expect(SCC_CLAUSES_NOTE).toContain("2021/914");
    expect(SCC_CLAUSES_NOTE.toLowerCase()).toContain("not reproduced here");
    expect(SCC_CLAUSES_NOTE.toLowerCase()).toContain(
      "no standard contractual clauses have been entered",
    );
  });

  it("does not let the Art. 30 record claim a transfer safeguard now exists", () => {
    // THE ASSERTION THAT STOPS THIS UNIT OVERCLAIMING. Preparing the annexes is not entering the
    // Clauses. Art. 30(1)(e) must still report `absent`, and if a later change flips it on the
    // strength of this file existing, the build says so.
    const e = ARTICLE_30_RECORD.find((x) => x.subParagraph === "e");
    expect(e?.state).toBe("absent");
    expect(e?.content.toLowerCase()).toContain("no art. 46 safeguard is in place");
  });
});
