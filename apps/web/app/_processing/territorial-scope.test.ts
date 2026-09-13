import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import {
  SCOPE_FACTORS,
  closingRequirements,
  offeringCoherence,
  targetingSignals,
  unrepresentedOffering,
} from "./territorial-scope";

/**
 * THE DECISION THAT WAS TAKEN TWICE AND RECORDED NOWHERE.
 *
 * "Keep the EU, build the GDPR work", then "keep the EU, accept the gap until you designate." Both
 * answers are on the record in a conversation. What lived in the repository was the CONSEQUENCES,
 * scattered across three files: a euro price in `_billing/plans.ts`, a footer reading "businesses
 * everywhere", a pricing page advertising currency choice. `SCOPE_FACTORS` reads all three and
 * reports them as Art. 3(2)(a) factors, correctly, and none of them says anybody chose.
 *
 * WHY THAT MATTERS MORE THAN A MISSING FIELD. Art. 27 applies because Art. 3(2)(a) is engaged, and
 * Art. 3(2)(a) is engaged because of those three product decisions. **The obligation has been
 * described in four documents as something to obtain and never once as something to make
 * inapplicable** -- so a door with two sides had one of them built. `brand.unionOffering` is the
 * decision, `closingRequirements()` is the other side of it written down, and the assertions below
 * hold the two against each other so neither can drift.
 */

describe("the offering and the record of it agree", () => {
  it("reads factors at all, so the assertions below are not vacuous", () => {
    expect(SCOPE_FACTORS.length).toBeGreaterThan(3);
    for (const factor of SCOPE_FACTORS) {
      expect(
        factor.evidence.length,
        `${factor.id} asserts a factor with no evidence`,
      ).toBeGreaterThan(30);
    }
  });

  it("does not let the site offer into the Union while the record says it does not", () => {
    // THE ASSERTION THIS FILE EXISTS FOR, and the direction that is a live exposure rather than a
    // tidiness problem: a euro price shipping under `unionOffering: false` is Art. 3(2)(a) engaged
    // by a configuration nobody decided to have, with the obligations that follow unowned.
    expect(
      offeringCoherence(),
      offeringCoherence() === "offers-undeclared"
        ? `the site carries ${targetingSignals().length} targeting factor(s) and brand.unionOffering is false. ` +
            `Either the decision is to offer -- set it true, and Art. 27 follows -- or these have to go: ${closingRequirements().join(" ")}`
        : "brand.unionOffering is true and the site names no territory-free offering, so obligations are being carried for nothing",
    ).toBe("coherent");
  });

  it("keeps the alternative written down, factor by factor", () => {
    // A work list rather than an opinion. Generated from the factors actually present, so it cannot
    // describe removing something the site no longer does.
    const requirements = closingRequirements();
    expect(requirements.length).toBe(targetingSignals().length);
    for (const requirement of requirements) {
      expect(requirement.length, "a requirement too short to act on").toBeGreaterThan(80);
      expect(requirement, "a requirement that names no file").toMatch(/`[^`]+`/);
    }
  });

  it("still reports the Art. 27 gap the decision leaves open", () => {
    // Unchanged and asserted, because this unit must not read as having closed anything. The
    // founder chose to keep the Union and accept the gap; the gap is still there.
    expect(brand.unionOffering).toBe(true);
    expect(brand.euRepresentative).toBeNull();
    expect(unrepresentedOffering()).toBe(true);
  });
});
