import { describe, expect, it } from "vitest";

import { renderUserPrompt } from "./brief.ts";
import { NO_PRIORS } from "./feedback.ts";
import { buildFigureSet } from "./figures.ts";
import { COMPARISON, PERIOD, row, settledWeek } from "./fixtures.ts";
import {
  LARGE_AT_PERCENT,
  NOTABLE_AT_PERCENT,
  SALIENCE_BANDS,
  bandOf,
  salienceOf,
} from "./salience.ts";
import { numericTokens } from "./verify.ts";

function build(rows: Parameters<typeof buildFigureSet>[0]["rows"]) {
  const result = buildFigureSet({
    business: "cafe",
    priors: NO_PRIORS,
    period: PERIOD,
    comparison: COMPARISON,
    rows,
  });
  if (!result.ok) throw new Error(`expected a figure set, got ${result.code}: ${result.detail}`);
  return result.set;
}

describe("the boundaries, stated as tests so changing a threshold is a visible decision", () => {
  it("bands on the threshold itself, not above it", () => {
    expect(bandOf(LARGE_AT_PERCENT)).toBe("large");
    expect(bandOf(LARGE_AT_PERCENT - 0.1)).toBe("notable");
    expect(bandOf(NOTABLE_AT_PERCENT)).toBe("notable");
    expect(bandOf(NOTABLE_AT_PERCENT - 0.1)).toBe("negligible");
  });

  it("treats a fall exactly as it treats a rise of the same size", () => {
    expect(bandOf(-40)).toBe(bandOf(40));
    expect(bandOf(-0.4)).toBe(bandOf(0.4));
  });

  /**
   * A NON-FINITE INPUT IS `unknown`, NOT `negligible`. Upstream should have refused rather than
   * produced one, but if it ever does, banding it as small would state that nothing happened in a
   * period nobody could measure -- which is `?? 0` wearing a different hat.
   */
  it("bands a number that is not a number as unknown", () => {
    expect(bandOf(Number.NaN)).toBe("unknown");
    expect(bandOf(Number.POSITIVE_INFINITY)).toBe("unknown");
  });
});

describe("unknown is not a size", () => {
  /**
   * The previous period measured zero, so `buildFigureSet` emits an ABSENT `delta_share` rather
   * than dividing by it. That must band as `unknown`: there is no percentage, so there is no size,
   * and calling it negligible would tell the owner nothing moved on a day the comparison could not
   * be made at all.
   */
  it("bands a metric with no comparable previous period as unknown", () => {
    const rows = [
      row({ date: "2026-09-08", source: "woocommerce", metrics: { revenue: 0 } }),
      row({ date: "2026-09-09", source: "woocommerce", metrics: { revenue: 900 } }),
    ];
    const set = buildFigureSet({
      business: "cafe",
      priors: NO_PRIORS,
      period: { from: "2026-09-09", to: "2026-09-09" },
      comparison: { from: "2026-09-08", to: "2026-09-08" },
      rows,
    });
    if (!set.ok) throw new Error(set.code);

    const share = set.set.figures.find((f) => f.id === "metric.revenue.delta_share");
    expect(share?.kind).toBe("absent");
    expect(salienceOf(set.set, "revenue")).toBe("unknown");
  });

  it("bands a metric that is not in the set at all as unknown", () => {
    expect(salienceOf(build(settledWeek()), "position")).toBe("unknown");
  });
});

describe("the prompt carries the band", () => {
  const set = build(settledWeek());
  const prompt = renderUserPrompt(set);

  it("marks both of a metric's change figures, and marks them the same", () => {
    const lines = prompt.split("\n");
    const delta = lines.find((line) => line.includes("change against the previous period"));
    const share = lines.find((line) => line.includes("percentage change against the previous"));
    expect(delta).toBeDefined();
    expect(share).toBeDefined();

    const bandIn = (line: string) => SALIENCE_BANDS.find((band) => line.includes(`[${band}`));
    expect(bandIn(delta ?? "")).toBeDefined();
    expect(bandIn(delta ?? "")).toBe(bandIn(share ?? ""));
  });

  it("does not mark a total, because a total has no size to overstate", () => {
    const lines = prompt.split("\n");
    const total = lines.find(
      (line) => /takings|revenue/i.test(line) && !line.includes("change") && line.includes(":"),
    );
    expect(total).toBeDefined();
    for (const band of SALIENCE_BANDS) expect(total ?? "").not.toContain(`[${band}`);
  });

  /**
   * THE PROPERTY THE WHOLE DESIGN RESTS ON: A BAND ADDS NO NUMBER.
   *
   * `verify.ts` refuses any numeral the figure set did not license, so a mark that carried a digit
   * would widen the allowed set for the entire brief -- the mistake `brief.ts` records about the
   * fetch time, which licensed 23, 30 and 0 on every run. Stripping every `[...]` mark out of the
   * prompt must therefore leave the numerals untouched.
   */
  it("adds no numeral to the prompt", () => {
    const withoutMarks = prompt.replace(/\s{2}\[[^\]]*\]/g, "");
    expect(numericTokens(withoutMarks)).toEqual(numericTokens(prompt));
  });

  it("uses band words that contain no digit at all", () => {
    for (const band of SALIENCE_BANDS) expect(band).not.toMatch(/\d/);
  });
});

describe("the system prompt teaches the bands it will send", () => {
  it("names every band, so none arrives unexplained", async () => {
    const { SYSTEM_PROMPT } = await import("./brief.ts");
    for (const band of SALIENCE_BANDS) {
      expect(SYSTEM_PROMPT).toContain(`[${band}]`);
    }
  });
});
