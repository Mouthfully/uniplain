import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ACTIONS, ActionSheet, CARD_SUMMARY } from "./ActionSheet";

/**
 * THE ACTION SHEET'S SUMMARY MUST BE THE SUM OF THE ACTIONS IT SUMMARISES.
 *
 * This file exists because the line it guards was wrong on the page. It read "Three actions, worth
 * about ฿6,400 a month between them", above three actions worth ฿3,100-฿3,600 a month,
 * ฿1,840 a month, and ฿900-฿1,400 A WEEK. ฿6,400 is roughly the first two plus the top of the
 * third -- a weekly figure added into a monthly total, which is the one arithmetic error this
 * product is sold against, printed on the section that sells it.
 *
 * `sample-brief.test.tsx` does this job for `AssistantPanel` by checking every numeral against
 * what the engine licensed. It cannot do it here: these three actions are hand-written copy
 * illustrating a capability that does not exist yet, so there is no figure set to check them
 * against. What CAN be checked without an engine is that the copy is consistent with itself, and
 * that is the property that failed.
 *
 * SO THE RULE IS: EVERY PERIOD IS SUMMED SEPARATELY AND NONE IS CONVERTED. There is no
 * weeks-per-month constant in this file on purpose. Converting is how the original went wrong --
 * not by choosing a bad conversion factor, but by applying one silently. `combineMetric` refuses
 * to combine across incompatible aggregations for the same reason: a total across units is not a
 * smaller total, it is a different quantity.
 */

/** `฿1,840` / `฿900` -> 1840 / 900. Thin and non-breaking spaces are stripped first. */
function baht(text: string): number[] {
  return [...text.replace(/[  ]/g, " ").matchAll(/฿\s*([\d,]+)/g)].map((m) =>
    Number(m[1]?.replace(/,/g, "")),
  );
}

/** The period a figure is quoted in. `null` means the phrase named none, which is itself a defect. */
function period(text: string): "month" | "week" | null {
  if (/\ba month\b/.test(text)) return "month";
  if (/\ba week\b/.test(text)) return "week";
  return null;
}

/**
 * A figure is a range when two amounts appear in one phrase and a point when one does. BOTH ENDS
 * are tracked: a summary that gets the low right and the high wrong is still wrong, and the line
 * this file was written for got the high wrong by adding a weekly figure to it.
 */
function span(amounts: number[]): { low: number; high: number } {
  return { low: Math.min(...amounts), high: Math.max(...amounts) };
}

/** The clauses of the summary, split on the joins it is allowed to use. */
function clauses(summary: string): string[] {
  return summary.split(/,\s*plus\s+|;\s*/).map((part) => part.trim());
}

const markup = renderToStaticMarkup(<ActionSheet />).replace(/&#x([0-9a-f]+);/gi, (_, h) =>
  String.fromCodePoint(Number.parseInt(h, 16)),
);

describe("the action sheet's summary is the arithmetic of its own actions", () => {
  /**
   * THE EXPORTS CANNOT DRIFT FROM THE PAGE. Everything below reads the two constants directly;
   * this is what stops that from becoming a test of something the section no longer renders.
   */
  it("renders the summary and every impact it summarises", () => {
    expect(markup).toContain(CARD_SUMMARY);
    for (const action of ACTIONS) {
      expect(markup).toContain(action.impact);
    }
  });

  it("quotes a period for every impact, so nothing is summed across an unstated unit", () => {
    for (const action of ACTIONS) {
      expect(period(action.impact), `no period on "${action.impact}"`).not.toBeNull();
    }
    for (const clause of clauses(CARD_SUMMARY).filter((c) => c.includes("฿"))) {
      expect(period(clause), `no period on "${clause}"`).not.toBeNull();
    }
  });

  it("sums each period separately and converts none", () => {
    const totals = new Map<string, { low: number; high: number }>();
    for (const action of ACTIONS) {
      const key = period(action.impact);
      if (key === null) continue;
      const { low, high } = span(baht(action.impact));
      const running = totals.get(key) ?? { low: 0, high: 0 };
      totals.set(key, { low: running.low + low, high: running.high + high });
    }

    // A PERIOD THE SUMMARY DROPS IS THE FAILURE THAT PRODUCED ฿6,400: the weekly action was not
    // omitted from the total, it was quietly folded into the monthly one.
    for (const [key, total] of totals) {
      const clause = clauses(CARD_SUMMARY).find((part) => period(part) === key);
      expect(clause, `the summary states no ${key} figure`).toBeDefined();

      const stated = span(baht(clause ?? ""));
      expect(stated.low, `${key} low`).toBe(total.low);
      expect(stated.high, `${key} high`).toBe(total.high);
    }
  });

  it("states no period the actions do not have", () => {
    const actual = new Set(
      ACTIONS.map((a) => period(a.impact)).filter((p): p is "month" | "week" => p !== null),
    );
    for (const clause of clauses(CARD_SUMMARY).filter((c) => c.includes("฿"))) {
      const key = period(clause);
      if (key === null) continue;
      expect(actual.has(key), `the summary claims a ${key} figure the actions do not`).toBe(true);
    }
  });
});
