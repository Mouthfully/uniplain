import { describe, expect, it } from "vitest";

import { BRIEF_DAYS, periodFor } from "./_period";

describe("the period a brief covers", () => {
  it("ends yesterday, because a day still in progress is not a day", () => {
    const { period } = periodFor("2026-09-13");
    expect(period.to).toBe("2026-09-12");
  });

  it("compares seven days against the seven immediately before them", () => {
    const { period, comparison } = periodFor("2026-09-13");
    expect(period).toEqual({ from: "2026-09-06", to: "2026-09-12" });
    expect(comparison).toEqual({ from: "2026-08-30", to: "2026-09-05" });
  });

  it("leaves no gap and no overlap between the two spans", () => {
    const { period, comparison } = periodFor("2026-09-13");
    const dayAfterComparison = new Date(`${comparison.to}T00:00:00Z`);
    dayAfterComparison.setUTCDate(dayAfterComparison.getUTCDate() + 1);
    expect(dayAfterComparison.toISOString().slice(0, 10)).toBe(period.from);
  });

  it("spans exactly the stated number of days on both sides", () => {
    const { period, comparison } = periodFor("2026-09-13");
    const span = (from: string, to: string) =>
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    expect(span(period.from, period.to)).toBe(BRIEF_DAYS);
    expect(span(comparison.from, comparison.to)).toBe(BRIEF_DAYS);
  });

  /**
   * MONTH AND YEAR BOUNDARIES, because date arithmetic done by hand is where off-by-one lives and
   * a brief whose heading says one week and whose figures cover another is exactly the confident
   * wrong thing this product refuses.
   */
  it("crosses a month boundary correctly", () => {
    expect(periodFor("2026-03-03").period).toEqual({ from: "2026-02-24", to: "2026-03-02" });
  });

  it("crosses a year boundary correctly", () => {
    expect(periodFor("2027-01-02").period).toEqual({ from: "2026-12-26", to: "2027-01-01" });
  });

  it("handles a leap day without losing one", () => {
    expect(periodFor("2028-03-01").period).toEqual({ from: "2028-02-23", to: "2028-02-29" });
  });

  /**
   * NO DEFAULT DATE, EVER. A substituted date would put a period in the heading that the figures do
   * not cover, which is the same class of mistake as a defaulted currency or timezone.
   */
  it("refuses rather than defaulting when the date is unusable", () => {
    for (const bad of [undefined, null, "", "today", "13-09-2026", "2026-9-13", 20260913]) {
      expect(() => periodFor(bad)).toThrow(/calendar date/);
    }
  });

  it("is the same answer every time it is asked, so a brief can be reconstructed", () => {
    expect(periodFor("2026-09-13")).toEqual(periodFor("2026-09-13"));
  });
});
