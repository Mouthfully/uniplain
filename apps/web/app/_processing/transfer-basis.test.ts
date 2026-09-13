import { brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { SUB_PROCESSORS } from "./sub-processors";
import {
  ADEQUACY_LIST_STATE,
  NOTIFICATIONS_IN_FORCE,
  SECTION_28_LIMBS,
  SECTION_29_LIMBS,
  transferPosition,
  transferRecords,
} from "./transfer-basis";

/**
 * THE TRANSFER ASSESSMENT, HELD TO THE SAME RULE AS EVERY OTHER ONE HERE.
 *
 * `AGENTS.md` ranks this second on its own PDPA list — **"s.28: every byte crosses a border with no
 * mechanism"** — and it had stayed there while `scc-annexes.ts` generated three annexes of the
 * Commission's Standard Contractual Clauses. That is the GDPR instrument, for a law whose
 * application to this entity is **undecided**, and the PDPA binds today. CLAUDE.md names exactly
 * that inversion.
 *
 * WHAT THESE ASSERTIONS ARE FOR. An assessment is the easiest thing in this repository to make
 * comfortable: every limb is prose, nothing fails, and a sentence reading "this transfer is
 * necessary to perform the customer's contract" would look like diligence and be a legal conclusion
 * nobody took. `representative-requirement.ts` set the precedent — a limb the record cannot answer
 * is **undetermined**, which is not a softer "no" — and the assertions below are what keep this one
 * to it.
 */

const ALL_LIMBS = [...SECTION_28_LIMBS, ...SECTION_29_LIMBS];

describe("the assessment covers what it claims to cover", () => {
  it("has limbs and recipients, so the assertions below are not vacuous", () => {
    expect(SECTION_28_LIMBS.length).toBe(6);
    expect(SECTION_29_LIMBS.length).toBe(2);
    expect(SUB_PROCESSORS.length).toBeGreaterThan(3);
  });

  it("records every disclosed sub-processor, in both directions", () => {
    // A transfer list that is not the recipient list is a transfer list that has stopped being
    // about this service. Generated from `SUB_PROCESSORS`, and asserted anyway: the generation is
    // one line and one line is exactly what a refactor rewrites.
    const assessed = transferRecords()
      .map((r) => r.processor)
      .sort();
    expect(assessed).toEqual(SUB_PROCESSORS.map((p) => p.name).sort());
  });

  it("cites a section on every limb", () => {
    for (const limb of ALL_LIMBS) {
      expect(limb.test, `${limb.id} states a test with no section`).toMatch(/s\.(28|29)\)/);
      expect(limb.finding.length, `${limb.id} gives a finding too short to be one`).toBeGreaterThan(
        80,
      );
    }
  });
});

describe("what the assessment refuses to assert", () => {
  it("claims no basis, because none is held", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. The day a basis genuinely exists this goes red, and it
    // should: entering an instrument is a change somebody makes deliberately, and it has to come
    // with the evidence and with this test being updated in the same commit.
    const engaged = ALL_LIMBS.filter((l) => l.state === "engaged");
    expect(
      engaged.map((l) => l.id),
      "a transfer basis is claimed; no instrument or finding is recorded anywhere in this repository",
    ).toEqual([]);
    expect(transferPosition()).toContain("No s.28 or s.29 basis is established");
  });

  it("does not report adequacy for a destination it has not identified", () => {
    // s.28's question is whether A COUNTRY has adequate standards. Four of five recipients carry
    // `location: null` — the sub-processor field states a location "only where the repository
    // actually knows" — so for those the question cannot be reached, which is a different and more
    // honest answer than "no adequacy finding".
    for (const record of transferRecords()) {
      expect(record.adequacyReachable).toBe(record.destination !== null);
      if (!record.adequacyReachable) {
        expect(
          record.note,
          `${record.processor} has no stated destination and the note does not say so`,
        ).toContain("NOT ESTABLISHED");
      }
    }
    // And at least one is genuinely unreachable, or this assertion is decorative.
    expect(transferRecords().some((r) => !r.adequacyReachable)).toBe(true);
  });

  it("keeps the adequacy-list question unknown rather than answered", () => {
    // TWO SOURCES DISAGREED IN SHAPE: one said no list has been published, the other that the
    // Committee "may" establish one. Neither is the Committee. "No list exists" closes a route;
    // "we did not find one" leaves it open and unexamined, and only the second is what is known.
    expect(ADEQUACY_LIST_STATE).toBe("unverified");
  });

  it("does not decide the limbs that turn on a legal determination", () => {
    // The contractual limbs are the ones a company under pressure would mark satisfied. They are
    // the ones most likely to be arguable, which is exactly why they are recorded as open.
    const open = ALL_LIMBS.filter((l) => l.state === "undetermined").map((l) => l.id);
    expect(open).toContain("contract-subject");
    for (const limb of ALL_LIMBS.filter((l) => l.state === "undetermined")) {
      expect(limb.finding, `${limb.id} is open and does not say who would decide it`).toMatch(
        /counsel|not .* to decide|not a thing a source file can answer/i,
      );
    }
  });

  it("does not treat prepared annexes as an entered instrument", () => {
    // `scc-annexes.ts` generates Annexes I.B, II and III. A near-miss recorded in note 89 was
    // reading a non-null field as a stated one; this is the same error one level up — reading
    // prepared paperwork as a signed instrument, in the document a customer's counsel reads.
    const safeguards = SECTION_29_LIMBS.find((l) => l.id === "safeguards");
    expect(safeguards?.state).toBe("not-engaged");
    expect(safeguards?.finding).toContain("preparing an annex is not entering the Clauses");
  });
});

describe("the facts it rests on are dated and attributable", () => {
  it("states when the two notifications took effect", () => {
    // CHECKED AGAINST PUBLISHED COMMENTARY, NOT RECALLED. An invented statutory date is the failure
    // mode this repository has actually suffered, and a date in a compliance artefact is the kind a
    // reader takes on trust.
    expect(NOTIFICATIONS_IN_FORCE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(NOTIFICATIONS_IN_FORCE).toBe("2024-03-24");
  });

  it("grounds the obligation in the controller's own location", () => {
    // s.5 binds a controller located in the Kingdom. Not the data subject's location, not the
    // server's — CLAUDE.md is explicit that hosting in Singapore ADDS a transfer obligation rather
    // than removing one, and a reading that put the trigger anywhere else would quietly excuse
    // every row above.
    expect(brand.postalAddress.country).toBe("Thailand");
  });
});
