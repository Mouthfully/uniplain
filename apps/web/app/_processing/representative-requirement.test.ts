import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { ARTICLE_30_RECORD } from "./article-30";
import {
  DESIGNATION_REQUIREMENTS,
  EXEMPTION_LIMBS,
  exemptionAvailable,
  representativeRequired,
} from "./representative-requirement";
import { targetingSignals } from "./territorial-scope";

/**
 * THE CHAIN, ASSERTED LINK BY LINK.
 *
 * "A representative is required" was written in four documents and checked in none. It happens to
 * be true. **That is the outcome an assessment is least likely to be built for and most useful
 * in** -- an assumption that turns out right is indistinguishable from one that turns out wrong
 * until somebody checks, and this repository has now been wrong three times about exactly this kind
 * of carried-forward sentence.
 *
 * So what is asserted is not the conclusion. It is the chain that produces it: Art. 3(2) engaged,
 * Art. 27(2) exemption unavailable, therefore Art. 27(1) stands. Each link can be broken separately
 * and each break fails the build.
 */

describe("the Art. 27(2) exemption, limb by limb", () => {
  it("scores every limb with evidence and cites the paragraph", () => {
    expect(EXEMPTION_LIMBS.length).toBe(4);
    for (const limb of EXEMPTION_LIMBS) {
      expect(limb.test, `${limb.id} cites no paragraph`).toMatch(/Art\. 27\(2\)/);
      expect(limb.evidence.length, `${limb.id} gives no evidence`).toBeGreaterThan(80);
    }
  });

  it("is closed by the occasional limb, not by the dramatic one", () => {
    // THE LIMB THAT ACTUALLY DECIDES IT. A nightly read for the duration of a subscription is the
    // opposite of occasional, and it is that by design -- "every morning" is what the product is
    // sold as doing. If this ever goes green the product has become something else.
    const occasional = EXEMPTION_LIMBS.find((l) => l.id === "occasional");
    expect(occasional?.satisfied).toBe(false);
    expect(occasional?.evidence).toContain("nightly");
    expect(exemptionAvailable()).toBe(false);
  });

  it("does not claim its own processing is low-risk", () => {
    // A CONTROLLER ASSERTING ITS OWN PROCESSING IS LOW-RISK is the least reliable sentence in data
    // protection, and this one holds sealed credentials for a customer's advertising accounts.
    // Scored false because it is not established -- and nothing turns on it, which is exactly why
    // claiming it would be taking a position for no benefit.
    const risk = EXEMPTION_LIMBS.find((l) => l.id === "unlikely-to-result-in-a-risk");
    expect(risk?.satisfied).toBe(false);
    expect(risk?.evidence).toContain("not asserted");
  });

  it("records the one limb that does point towards the exemption", () => {
    // Art. 27(2)(a) is CONJUNCTIVE. This limb is satisfied and does not rescue anything, and saying
    // so is the difference between an assessment and an argument: a scoring that only ever found
    // against the company would be no more trustworthy than one that only ever found for it.
    const special = EXEMPTION_LIMBS.find((l) => l.id === "no-large-scale-special-categories");
    expect(special?.satisfied).toBe(true);
    expect(exemptionAvailable(), "a single satisfied limb made the exemption available").toBe(
      false,
    );
  });
});

describe("the chain from Art. 3(2) to the designation", () => {
  it("holds the first link: the entity offers into the Union", () => {
    expect(targetingSignals().length).toBeGreaterThan(0);
  });

  it("concludes the obligation stands, and would not if a link broke", () => {
    expect(representativeRequired()).toBe(true);
    // The second link, proven by construction rather than asserted: if the exemption were
    // available, the requirement would fall away even with the targeting signals present.
    expect(targetingSignals().length > 0 && !exemptionAvailable()).toBe(true);
  });

  it("still records that none is designated", () => {
    // The finding is that one is REQUIRED. Nothing here designates one, and Art. 30(1)(a) must go
    // on saying so -- the assessment strengthens the request rather than answering it.
    expect(brand.euRepresentative).toBeNull();
    const a = ARTICLE_30_RECORD.find((x) => x.subParagraph === "a");
    expect(a?.state).toBe("partial");
    expect(a?.content).toContain("NONE DESIGNATED");
  });
});

describe("what the founder is being asked for", () => {
  it("states the engagement as a specification rather than an obligation", () => {
    // The founder is being asked to engage a third party and pay them a recurring fee. That request
    // is worth the Articles it rests on.
    expect(DESIGNATION_REQUIREMENTS.length).toBeGreaterThanOrEqual(5);
    const all = DESIGNATION_REQUIREMENTS.join(" ");
    for (const article of ["Art. 27(1)", "Art. 27(3)", "Art. 27(4)", "Art. 30(1)"]) {
      expect(all, `the specification does not cite ${article}`).toContain(article);
    }
    expect(all, "the writing requirement is the one most easily skipped").toContain("IN WRITING");
  });

  it("does not draft a mandate for a party nobody has named", () => {
    // Art. 27(4)'s mandate is a contract with a named third party. Drafting terms for a party that
    // does not exist would produce a document that reads as ready to sign and binds nobody -- the
    // same failure as an annex with a placeholder in the parties box.
    const all = DESIGNATION_REQUIREMENTS.join(" ").toLowerCase();
    for (const draft of ["hereby appoints", "the parties agree", "this mandate is made"]) {
      expect(all, `a mandate is being drafted: "${draft}"`).not.toContain(draft);
    }
  });
});
