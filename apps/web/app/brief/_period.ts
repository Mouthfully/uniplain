import type { Period } from "@repo/insights";

/**
 * THE PERIOD A BRIEF COVERS, DERIVED FROM ONE DATE AND NOTHING ELSE.
 *
 * SEVEN DAYS AGAINST THE SEVEN BEFORE IT, and the choice is not arbitrary. A single day against the
 * day before is the noisiest comparison a shop can make -- a wet Tuesday against a dry Monday says
 * nothing about the business -- and it is also the one most likely to band as `large` in
 * `salience.ts` for a reason nobody can act on. Seven against seven puts every weekday on both
 * sides, so a weekend is compared with a weekend.
 *
 * IT TAKES "TODAY" AS AN ARGUMENT RATHER THAN READING A CLOCK. The whole engine is built so that
 * the same rows produce the same bytes, which is what makes a brief auditable after the fact: a
 * customer asking why a figure changed needs the period to be reconstructible. A function that read
 * `new Date()` internally would give a different answer at 23:59 and 00:01 with no record of which
 * it had been, and no test could pin it without freezing time.
 *
 * WHICH TIMEZONE'S MIDNIGHT is a question this file does not answer, and does not pretend to. The
 * dates come from the caller as calendar dates; every row carries its own `timezone` column, and
 * `20260912000400`'s rule forbids `coalesce(timezone, 'UTC')` -- "a guess wearing the costume of a
 * fact". The same open question sits in `app.due_connections`, recorded in
 * `20260913000100_ingest_watermark.sql`, and it is one founder decision for both.
 */

export const BRIEF_DAYS = 7;

/** What the surface tells the reader it is measuring, so heading and query cannot disagree. */
export const BRIEF_PERIOD = {
  days: BRIEF_DAYS,
  label: "the last seven days against the seven before them",
} as const;

export interface BriefPeriod {
  readonly period: Period;
  readonly comparison: Period;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar arithmetic in UTC, on a date-only value, so no local offset can shift a day. */
function shift(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * The two spans a brief compares, ending YESTERDAY.
 *
 * Today is excluded deliberately: a day still in progress is not a day, and a brief that included
 * this morning would compare four hours of trading against seven full days and call the difference
 * a fall.
 *
 * An unusable `today` falls back to nothing -- it throws. There is no sensible default date, and a
 * silently substituted one would put a period in the heading that the figures do not cover.
 */
export function periodFor(today: unknown): BriefPeriod {
  if (typeof today !== "string" || !ISO_DATE.test(today)) {
    throw new Error("brief: a period needs a calendar date in YYYY-MM-DD form");
  }

  const to = shift(today, -1);
  const from = shift(to, -(BRIEF_DAYS - 1));
  const comparisonTo = shift(from, -1);
  const comparisonFrom = shift(comparisonTo, -(BRIEF_DAYS - 1));

  return {
    period: { from, to },
    comparison: { from: comparisonFrom, to: comparisonTo },
  };
}
