import { BUSINESS_TYPES } from "@repo/insights";
import { describe, expect, it } from "vitest";

import { BRIEF_COPY, BUSINESS_LABELS } from "./_content";

/**
 * EVERY WAY THIS SURFACE CAN PRODUCE NOTHING HAS ITS OWN SENTENCE.
 *
 * The failure this guards against is the ordinary one: three unrelated problems collapsing into
 * "something went wrong". Here the three are genuinely different statements about the world --
 *
 *   figures_refused   a statement about the CUSTOMER'S DATA. No model was called.
 *   model_failed      a statement about OUR INFRASTRUCTURE. Nothing is wrong with their rows.
 *   refused           a statement about THE MODEL. It wrote a number the figures do not support.
 *
 * -- and the third is the one the entire product is sold on. A customer who is shown a generic
 * apology instead has no way to know the refusal happened, and therefore no reason to trust the
 * briefs that are not refused.
 */
const FAILURE_COPY = [
  BRIEF_COPY.notConfiguredBody,
  BRIEF_COPY.rowsUnreadableBody,
  BRIEF_COPY.tooManyRowsBody,
  BRIEF_COPY.figuresRefusedBody,
  BRIEF_COPY.modelFailedBody,
  BRIEF_COPY.refusedBody,
] as const;

describe("the copy for the states that produce no brief", () => {
  it("says something different for every one of them", () => {
    expect(new Set(FAILURE_COPY).size).toBe(FAILURE_COPY.length);
  });

  it("gives each one a heading of its own too", () => {
    const headings = [
      BRIEF_COPY.notConfiguredHeading,
      BRIEF_COPY.rowsUnreadableHeading,
      BRIEF_COPY.tooManyRowsHeading,
      BRIEF_COPY.figuresRefusedHeading,
      BRIEF_COPY.modelFailedHeading,
      BRIEF_COPY.refusedHeading,
    ];
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("writes a real sentence in each, not a placeholder", () => {
    for (const line of FAILURE_COPY) {
      expect(line.split(/\s+/).length).toBeGreaterThan(8);
      expect(line).not.toMatch(/TODO|TBD|lorem/i);
    }
  });

  /**
   * A FAILED READ IS NOT AN EMPTY PERIOD, and this is the sentence that keeps the two apart. The
   * dashboard learned the same lesson: `performanceRows` returns no rows on error, so a customer
   * whose query failed was once told their period was empty -- a statement about their business
   * made from a database fault.
   */
  it("refuses to describe an unreadable period as an empty one", () => {
    expect(BRIEF_COPY.rowsUnreadableBody).toMatch(/not a statement about the period/i);
  });

  /** The refusal is presented as the product working. If that ever reads as an apology, it is wrong. */
  it("presents a refusal as the product working rather than failing", () => {
    expect(BRIEF_COPY.refusedReassurance).toMatch(/working rather than failing/i);
    expect(BRIEF_COPY.refusedBody).toMatch(/not corrected/i);
  });

  /** Nothing here may promise the morning delivery that no cron and no channel provide. */
  it("promises no cadence this surface does not have", () => {
    for (const line of Object.values(BRIEF_COPY)) {
      expect(line).not.toMatch(/every morning|each morning|we.ll send|arrives at/i);
    }
  });
});

describe("the business types the owner chooses from", () => {
  it("labels every type in the dictionary, and none that is not", () => {
    expect(Object.keys(BUSINESS_LABELS).sort()).toEqual([...BUSINESS_TYPES].sort());
  });

  it("gives no two types the same label", () => {
    const labels = Object.values(BUSINESS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
