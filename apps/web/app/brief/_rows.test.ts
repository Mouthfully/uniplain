import { METRICS } from "@repo/contract";
import { describe, expect, it } from "vitest";

import { BRIEF_COLUMNS, MAX_BRIEF_ROWS } from "./_rows";

describe("the columns the brief reads", () => {
  /**
   * THE ONE THIS FILE EXISTS FOR.
   *
   * `entity_name` is a column on `envelope_rows` holding a campaign, listing or product name TYPED
   * BY THE CUSTOMER -- the one field on the row that can contain anything at all, including a
   * person's name (issue #53). `InsightRow` has no field to receive it, so the type already refuses
   * it; this asserts the second lock, that it never enters the process either.
   *
   * The two fail differently and that is why both exist: the type stops a mistake at compile time,
   * and the absent column keeps the value out even if somebody later widens the type.
   */
  it("never selects entity_name, which is tenant-typed free text", () => {
    expect(BRIEF_COLUMNS).not.toContain("entity_name");
  });

  it("selects no column whose name suggests free text", () => {
    for (const column of BRIEF_COLUMNS) {
      expect(column).not.toMatch(/_name$|^name$|label|title|note|description/);
    }
  });

  /**
   * A metric that falls out of this select does not error -- it reads as ABSENT, and the engine
   * names an absent metric as absent in the prompt. So a dropped column would quietly change what
   * the brief says about the business rather than breaking anything.
   */
  it("carries every metric in the dictionary", () => {
    for (const metric of Object.keys(METRICS)) {
      expect(BRIEF_COLUMNS, `${metric} is missing from the brief select`).toContain(metric);
    }
  });

  /** Every dimension `InsightRow` needs. `timezone` is the one `PERFORMANCE_COLUMNS` does not have. */
  it("carries every dimension the engine needs", () => {
    for (const column of [
      "source",
      "account_id",
      "entity_id",
      "entity_type",
      "date",
      "currency",
      "timezone",
      "is_provisional",
      "fetched_at",
    ]) {
      expect(BRIEF_COLUMNS).toContain(column);
    }
  });

  it("names each column once", () => {
    expect(new Set(BRIEF_COLUMNS).size).toBe(BRIEF_COLUMNS.length);
  });

  /**
   * The cap exists so a period with more rows than one brief can cover REFUSES rather than
   * silently describing some of them as all of them. The query asks for one more than the cap
   * precisely so the two cases can be told apart.
   */
  it("has a row cap that is a real number", () => {
    expect(MAX_BRIEF_ROWS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_BRIEF_ROWS)).toBe(true);
  });
});
