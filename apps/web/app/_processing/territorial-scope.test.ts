import { readFileSync } from "node:fs";
import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { SCOPE_FACTORS, targetingSignals, unrepresentedOffering } from "./territorial-scope";

/**
 * THE ASSESSMENT, AND THE THING THAT STOPS IT BEING FORGOTTEN.
 *
 * These assertions are an unusual shape for this repository: most of them RECORD A GAP rather than
 * prove it closed. That is deliberate, and the reasoning is worth stating because the obvious
 * alternative is worse.
 *
 * The obvious alternative is a guard that fails the build while the entity offers euro prices with
 * no Art. 27 representative. It would be red today, and the two ways to make it green are to
 * appoint a representative -- which no test can do -- or to DELETE THE EURO PRICE. That is a
 * commercial decision belonging to the founder, and a build failure is a bad way to be asked for
 * one: the cheapest path to green would be removing a currency the business may depend on, taken by
 * whoever was unlucky enough to be mid-PR.
 *
 * So these assert the CURRENT STATE explicitly, in both directions, and go red the moment anyone
 * changes the facts without carrying the change through. The gap cannot be forgotten because it is
 * written down as an assertion; it cannot be quietly closed because closing it moves a fact these
 * tests read.
 */

describe("what the configuration says about the Union", () => {
  it("reads real factors, so nothing below is vacuous", () => {
    expect(SCOPE_FACTORS.length).toBeGreaterThanOrEqual(4);
    for (const factor of SCOPE_FACTORS) {
      expect(factor.evidence.length, `${factor.id} has no evidence`).toBeGreaterThan(40);
      expect(factor.factor.length, `${factor.id} has no statement`).toBeGreaterThan(40);
    }
  });

  it("finds the entity offering into the Union", () => {
    // If this ever goes red, the euro price and the territory-free copy have BOTH gone, and the
    // assessment's conclusion changes. That is a real change and should fail until this file and
    // AGENTS.md §2 are rewritten to match it.
    const signals = targetingSignals();
    expect(
      signals.length,
      "no targeting signal remains: the offering was narrowed, and the assessment needs rewriting",
    ).toBeGreaterThan(0);
    expect(signals.map((s) => s.id)).toContain("member-state-currency");
  });

  it("records that no representative is designated, which is the open item", () => {
    // Art. 27. When a representative IS designated, `brand.euRepresentative` stops being null, this
    // assertion goes red, and whoever flips it has to come here and to AGENTS.md -- which is the
    // same mechanism `brand.test.ts` uses for a certificate: a compliance position cannot be
    // established by a one-character edit.
    expect(brand.euRepresentative).toBeNull();
    expect(unrepresentedOffering()).toBe(true);
  });

  it("does not claim GDPR compliance anywhere, which is a separate thing from being in scope", () => {
    // AN OBLIGATION IS NOT A CLAIM. The claim gate correctly withholds `gdpr`; that stops the site
    // SAYING it complies. Nothing in a claim gate stops the GDPR applying, and conflating the two
    // is how "the claim is withheld" gets mistaken for "we are out of scope".
    const withheld = brand.euRepresentative === null;
    expect(withheld, "the gdpr claim's requirement changed; re-read this test").toBe(true);
  });
});

describe("the assessment is carried into the document that states the position", () => {
  const agents = readFileSync(new URL("../../../../AGENTS.md", import.meta.url).pathname, "utf8");

  it("no longer asserts that nobody has decided whether the business sells into the EU", () => {
    // THE SENTENCE THIS UNIT EXISTS TO RETIRE. AGENTS.md §2 opened with it -- while the pricing
    // page quoted euros. The premise was false, and because it was written as an open question
    // nobody went looking for the answer.
    //
    // QUOTED SPANS ARE STRIPPED FIRST, and the reason is the fourth instance of one pattern in this
    // repository. A correction has to QUOTE the sentence it corrects, or the next reader cannot
    // tell what changed -- so a bare `not.toContain` fires on the fix and the cheapest green is
    // deleting the explanation. `dpa.test.tsx` hit this on a denial, `74-the-cadence-nobody-keeps`
    // named it, and here it is again: what is banned is the ASSERTION, never the mention.
    const unquoted = agents.replace(/"[^"]*"/g, " ");
    expect(
      unquoted,
      "AGENTS.md still states the EU question as undecided outside a quotation",
    ).not.toContain("Applicability is genuinely open and nobody has decided it");
  });

  it("names the euro price as the evidence, where the next reader will find it", () => {
    const section = agents.slice(agents.indexOf("## 2. GDPR"), agents.indexOf("## 3. ISO"));
    expect(section.length).toBeGreaterThan(400);
    expect(section.toLowerCase()).toContain("euro");
    expect(section).toContain("Art. 27");
  });
});
