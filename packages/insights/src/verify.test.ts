import { describe, expect, it } from "vitest";

import { NO_PRIORS } from "./feedback.ts";
import { COMPARISON, PERIOD, settledWeek } from "./fixtures.ts";
import { type FigureSet, buildFigureSet } from "./figures.ts";
import { verifyInsight } from "./verify.ts";

function build(): FigureSet {
  const result = buildFigureSet({
    business: "cafe",
    priors: NO_PRIORS,
    period: PERIOD,
    comparison: COMPARISON,
    rows: settledWeek(),
  });
  if (!result.ok) throw new Error(`expected a figure set, got ${result.code}`);
  return result.set;
}

const SET = build();

function answer(fields: {
  summary?: readonly string[];
  unusual?: string | null;
  action?: { title: string; why: string } | null;
}): string {
  return JSON.stringify({
    summary: fields.summary ?? ["Takings held up.", "Orders held up.", "Nothing broke."],
    unusual: fields.unusual ?? null,
    action: fields.action ?? null,
  });
}

describe("a brief built only from the figures is accepted", () => {
  it("accepts figures copied exactly", () => {
    // Every number here is one `figures.test.ts` asserts the set contains.
    const verdict = verifyInsight(
      answer({
        summary: [
          "Takings were THB 29,000.00 against THB 28,000.00 the week before.",
          "That is up 3.6%.",
          "Average ticket was THB 100.00.",
        ],
        unusual: "woocommerce took 75.9% of takings.",
      }),
      SET,
    );
    expect(verdict.ok).toBe(true);
  });

  it("accepts a date written back out of the period", () => {
    const verdict = verifyInsight(
      answer({ summary: ["Covering 2026-09-07 to 2026-09-13.", "Nothing else.", "Nothing more."] }),
      SET,
    );
    expect(verdict.ok).toBe(true);
  });

  it("accepts prose with no numbers at all", () => {
    expect(verifyInsight(answer({}), SET).ok).toBe(true);
  });
});

describe("THE REFUSAL: a number the data does not contain kills the whole insight", () => {
  it("refuses an invented figure", () => {
    const verdict = verifyInsight(
      answer({ summary: ["Takings were THB 41,200.00.", "Good week.", "Keep going."] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "unverifiable_number" });
    // It is refused WHOLE. There is no insight to fall back on, no repaired text, no partial
    // summary. The two true lines go with the false one.
    expect("insight" in verdict).toBe(false);
  });

  it("refuses a plausible ROUNDING of a true figure", () => {
    // 29,000 is true. 30,000 is a number nobody measured, and it is the shape of error most
    // likely to survive a human review.
    const verdict = verifyInsight(
      answer({ summary: ["Takings were about THB 30,000.", "Steady.", "Nothing unusual."] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "unverifiable_number" });
  });

  it("refuses arithmetic the model did itself", () => {
    // 29,000 - 28,000 = 1,000 is licensed because `figures.ts` computed it. 29,000 / 7 is not.
    const verdict = verifyInsight(
      answer({ summary: ["That is THB 4,142.86 a day.", "Steady.", "Nothing unusual."] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "unverifiable_number" });
  });

  it("refuses a time of day, because there is no hourly grain to have measured one", () => {
    const verdict = verifyInsight(
      answer({ unusual: "Orders peaked at 12:40.", summary: ["a", "b", "c"] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "unverifiable_number" });
  });

  it("refuses an invented number in the ACTION as readily as in the summary", () => {
    const verdict = verifyInsight(
      answer({ action: { title: "Cut the ad budget", why: "It is losing THB 7,777.00 a week." } }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "unverifiable_number" });
  });

  it("names the offending fragment so an operator can see what happened", () => {
    const verdict = verifyInsight(
      answer({ summary: ["Takings were THB 41,200.00.", "b", "c"] }),
      SET,
    );
    if (verdict.ok) throw new Error("expected a refusal");
    expect(verdict.offending).toContain("41,200.00");
    expect(verdict.detail).toContain("refused whole");
  });
});

describe("quantities written as words", () => {
  it("refuses them, because the numeric scan cannot check them", () => {
    const verdict = verifyInsight(
      answer({ summary: ["Takings doubled on the week.", "b", "c"] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "spelled_quantity" });
  });

  it("refuses a spelled numeral", () => {
    expect(
      verifyInsight(answer({ unusual: "Three channels slipped.", summary: ["a", "b", "c"] }), SET),
    ).toMatchObject({ ok: false, code: "spelled_quantity" });
  });

  it("still allows the product's own sentence", () => {
    // "one" is deliberately not in the ban list. See the note on SPELLED_QUANTITIES.
    const verdict = verifyInsight(
      answer({ action: { title: "One thing worth doing today", why: "It is the largest." } }),
      SET,
    );
    expect(verdict.ok).toBe(true);
  });
});

describe("a banned claim in the model's own words is refused too", () => {
  it("refuses the competitor vocabulary the brand guard bans", () => {
    const verdict = verifyInsight(
      answer({ unusual: "A competitor undercut your listing.", summary: ["a", "b", "c"] }),
      SET,
    );
    expect(verdict).toMatchObject({ ok: false, code: "forbidden_claim" });
  });

  it("refuses the billing line the artboard closes on", () => {
    const verdict = verifyInsight(answer({ summary: ["Pay as you go.", "b", "c"] }), SET);
    expect(verdict).toMatchObject({ ok: false, code: "forbidden_claim" });
  });
});

describe("a malformed answer refuses rather than being salvaged", () => {
  it("refuses empty output", () => {
    expect(verifyInsight("   ", SET)).toMatchObject({ ok: false, code: "empty_output" });
  });

  it("refuses output that is not JSON", () => {
    expect(verifyInsight("Here is your brief!", SET)).toMatchObject({
      ok: false,
      code: "malformed_output",
    });
  });

  it("refuses the wrong shape rather than filling in what is missing", () => {
    expect(verifyInsight(JSON.stringify({ summary: ["one line"] }), SET)).toMatchObject({
      ok: false,
      code: "wrong_shape",
    });
    expect(verifyInsight(JSON.stringify({ summary: [1, 2, 3] }), SET)).toMatchObject({
      ok: false,
      code: "wrong_shape",
    });
    expect(verifyInsight(JSON.stringify([1, 2, 3]), SET)).toMatchObject({
      ok: false,
      code: "wrong_shape",
    });
  });
});

describe("the gate is checked against the set it was given, not a global", () => {
  it("refuses a figure that is true of a DIFFERENT business", () => {
    const other = buildFigureSet({
      business: "cafe",
      priors: NO_PRIORS,
      period: PERIOD,
      comparison: COMPARISON,
      rows: settledWeek().map((r) => ({ ...r, metrics: { ...r.metrics, revenue: 777 } })),
    });
    if (!other.ok) throw new Error("fixture");
    // 29,000 is this set's figure and not that one's.
    expect(
      verifyInsight(answer({ summary: ["Takings were THB 29,000.00.", "b", "c"] }), other.set),
    ).toMatchObject({ ok: false, code: "unverifiable_number" });
  });
});

/* ================================================================================================
 * A SIZE ASSERTED IN PROSE
 * ============================================================================================== */

describe("a word that states a size the arithmetic did not", () => {
  /**
   * `salience.ts` bands every change and the prompt tells the model the band IS the size. A word
   * that asserts a size on top of it is a quantity the gate cannot check -- the same defect as a
   * spelled-out number, wearing an adverb. "Takings fell sharply" over a 2.1% move is a false
   * statement about the data containing no false number, so every other check here waves it past.
   */
  const overstatements = [
    "Takings fell sharply against last week.",
    "Orders plummeted on Tuesday.",
    "Spend soared while what it returned did not.",
    "Commission surged on that channel.",
    "Takings collapsed at the weekend.",
    "Delivery orders skyrocketed.",
    "Revenue nosedived.",
    "Costs rose dramatically.",
    "The change was drastically worse than last week.",
    "Margins steeply narrowed.",
  ];

  for (const line of overstatements) {
    it(`refuses ${JSON.stringify(line.slice(0, 40))}`, () => {
      const verdict = verifyInsight(answer({ unusual: line }), SET);
      expect(verdict.ok).toBe(false);
      if (verdict.ok) return;
      expect(verdict.code).toBe("magnitude_word");
      expect(verdict.detail).not.toHaveLength(0);
    });
  }

  /**
   * THE OTHER HALF, AND THE REASON THE LIST IS SHORT. A guard that fires on correct copy gets
   * switched off, which is worse than not having one. Direction words are not sizes -- the delta
   * figure states the direction -- so a brief saying takings fell must pass, every morning.
   */
  const mustStayLegal = [
    "Takings fell against last week.",
    "Orders rose on Saturday.",
    "Spend is up and what it returned is not.",
    "Takings held steady.",
    "Nothing moved that is worth acting on.",
    "The comparison is not available for that figure.",
    "Commission was not reported on one row.",
    "Takings dropped on the delivery channel.",
  ];

  for (const line of mustStayLegal) {
    it(`does NOT refuse ${JSON.stringify(line.slice(0, 40))}`, () => {
      const verdict = verifyInsight(answer({ unusual: line }), SET);
      if (!verdict.ok) expect(verdict.code).not.toBe("magnitude_word");
    });
  }
});
