import { readFileSync } from "node:fs";
import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { PROCESSING_ACTIVITIES } from "./activities";
import { DPO_LIMBS, engagedLimbs, SCALE_CAVEAT } from "./dpo-requirement";

/**
 * THE ASSESSMENT, AND THE THING THAT MAKES IT RE-OPEN ITSELF.
 *
 * A determination taken once and filed is one that silently stops being true. That is not a
 * hypothetical in this repository: `AGENTS.md` said GDPR applicability was open while the pricing
 * table quoted euros, and Art. 28(3)(d) sat recorded as blocked on DNS because nobody re-read the
 * Article. Both were filed findings that had stopped matching the facts.
 *
 * So the assertions below are not "a DPO is not required". They are:
 *
 *   1. each limb is scored against the record of processing, not against memory;
 *   2. the special-category limb FLIPS if the record ever names one, and the build fails until this
 *      assessment is rewritten;
 *   3. the scale caveat travels with the finding, because a limb unengaged by an empty database is
 *      not a limb that will stay unengaged.
 */

describe("the limbs both statutes actually name", () => {
  it("scores every limb with evidence, so nothing is asserted from memory", () => {
    expect(DPO_LIMBS.length).toBe(3);
    for (const limb of DPO_LIMBS) {
      expect(limb.test.length, `${limb.id} states no test`).toBeGreaterThan(80);
      expect(limb.evidence.length, `${limb.id} gives no evidence`).toBeGreaterThan(80);
      // Each limb must cite the Article and the section, so a reader can check the framing rather
      // than trust this file's paraphrase of it.
      expect(limb.test, `${limb.id} cites no GDPR article`).toMatch(/Art\. 37\(1\)\([abc]\)/);
      expect(limb.test, `${limb.id} cites no PDPA section`).toContain("PDPA s.41");
    }
  });

  it("finds no limb engaged on the record as it stands", () => {
    // Stated as the finding it is, and it goes red the moment any limb flips -- which is the point.
    // Whoever makes that happen has to come here, and to AGENTS.md, in the same change.
    expect(engagedLimbs(), "a DPO limb became engaged; the assessment needs rewriting").toEqual([]);
  });

  it("distinguishes monitoring a business from monitoring the people behind it", () => {
    // THE LIMB A PRODUCT LIKE THIS LOOKS LIKE IT MIGHT MEET. Reading a business's metrics nightly
    // is regular and systematic; Art. 37(1)(b) is about monitoring DATA SUBJECTS. Conflating the
    // two is the easiest mistake available here and the reasoning has to survive in the file.
    const limb = DPO_LIMBS.find((l) => l.id === "systematic-monitoring");
    expect(limb?.triggered).toBe(false);
    expect(limb?.evidence).toContain("no buyer identifier");
    expect(limb?.evidence).toContain(`${PROCESSING_ACTIVITIES.length} activities`);
  });
});

describe("the assessment re-opens itself when the record moves", () => {
  it("flips the special-category limb if the record ever names one", () => {
    // Proven by construction rather than by trusting the scan: the same markers are applied here to
    // a fabricated activity, so a scan that silently stopped matching would be visible.
    const marked = "A record of each person's health condition and religious affiliation.";
    const markers = ["health", "religious"];
    for (const marker of markers) {
      expect(marked.toLowerCase(), `the marker "${marker}" would not match`).toContain(marker);
    }
    // And the real record contains none of them.
    for (const activity of PROCESSING_ACTIVITIES) {
      const haystack =
        `${activity.categories} ${activity.subjects} ${activity.purpose}`.toLowerCase();
      for (const marker of markers) {
        expect(haystack, `${activity.id} names a special category`).not.toContain(marker);
      }
    }
  });

  it("carries the scale caveat, because the database is empty", () => {
    // A limb unengaged because there is nothing to engage it is not a limb that will stay
    // unengaged, and a reviewer reading the finding without this sentence would be reading a
    // conclusion about an empty database as a conclusion about the business.
    expect(SCALE_CAVEAT).toContain("large scale");
    expect(SCALE_CAVEAT).toContain("no customers yet");
  });
});

describe("the finding is carried into the document that states the position", () => {
  const agents = readFileSync(new URL("../../../../AGENTS.md", import.meta.url).pathname, "utf8");

  it("records no officer appointed, which stays the honest state", () => {
    // Not the same claim as "none is required". `brand.dataProtectionOfficer` stays null and no
    // contact is printed anywhere, because printing one nobody staffs is worse than printing none.
    expect(brand.dataProtectionOfficer).toBeNull();
  });

  it("no longer leaves the question simply undecided", () => {
    // Quoted spans stripped first, for the fourth-and-fifth-time reason recorded in
    // `territorial-scope.test.ts`: a correction has to quote what it corrects.
    const unquoted = agents.replace(/"[^"]*"/g, " ");
    expect(unquoted, "AGENTS.md still files the DPO question as simply undecided").not.toMatch(
      /DPO[^.\n]*\bhas not been determined\b/,
    );
    expect(agents).toContain("Art. 37(1)(b)");
  });
});
