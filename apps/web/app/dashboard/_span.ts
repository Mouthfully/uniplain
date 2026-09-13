/**
 * THE PERIOD THE LIVE TABLE COVERS, DERIVED FROM ONE DATE AND NOTHING ELSE.
 *
 * THE DEFECT THIS REPLACES. The dashboard queried `{ from: "2026-06-01", to: "2026-06-30" }`, a
 * literal, under a comment saying "One place, so the heading and the query cannot disagree". The
 * comment was about a different disagreement and the constant was frozen: every signed-in customer,
 * on every day after June 2026, had their rows read for a month chosen by nobody. A shop trading in
 * September was told **"Your workspace has no rows for this period yet"** -- a sentence about their
 * business, true of a window they never picked and were never shown.
 *
 * That is the house failure mode exactly. Not an error and not a blank: an answer that looks right.
 * An owner reads it as "my data has not arrived", checks their connection, finds it healthy, and
 * has no way to discover that the question asked was about June.
 *
 * TODAY IS AN ARGUMENT, NOT A CLOCK READ. The same rule `brief/_period.ts` follows, for the same
 * reason: a function reading `new Date()` internally answers differently at 23:59 and 00:01 with no
 * record of which it did, and no test pins it without freezing time. The surface reads the clock
 * once and hands the date down.
 *
 * THIRTY COMPLETE DAYS, ENDING YESTERDAY.
 *
 *   Why not a calendar month: on the 1st, month-to-date is empty, so the screen would report "no
 *   rows for this period" truthfully and uselessly, once a month, to every customer at once. A
 *   window whose emptiness depends on the date it is asked is not a window.
 *
 *   Why yesterday and not today: a day still in progress is not a day. Including this morning puts
 *   a few hours of trading in a total labelled as a full period, which is the same class of wrong
 *   number as a partial sum presented as a sum. `brief/_period.ts` excludes today and says so.
 *
 *   Why thirty and not seven: the brief compares seven against seven because a comparison needs
 *   matching weekdays on both sides. This table compares nothing -- it lists rows -- so the only
 *   question is how much a reader wants to see at once, and a month of trading is the answer an
 *   owner gives.
 *
 * WHICH TIMEZONE'S MIDNIGHT IS NOT ANSWERED HERE, and is not pretended away. Calendar arithmetic is
 * done in UTC on date-only values so no local offset can shift a day, but whose midnight ends a
 * trading day is an open founder decision recorded in `20260913000100_ingest_watermark.sql` and in
 * `brief/_period.ts`. `20260912000400`'s rule forbids `coalesce(timezone, 'UTC')` -- "a guess
 * wearing the costume of a fact" -- and this module does not make that guess on the data. It picks
 * a window; the rows carry their own timezone.
 */

/** How many complete days the live table covers. */
export const DASHBOARD_SPAN_DAYS = 30;

export interface DashboardSpan {
  /** Inclusive, `YYYY-MM-DD`. */
  readonly from: string;
  /** Inclusive, `YYYY-MM-DD`. Yesterday, relative to the date supplied. */
  readonly to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar arithmetic in UTC on a date-only value, so no local offset can shift a day. */
function shift(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * The window the live table reads.
 *
 * THROWS ON AN UNUSABLE DATE rather than substituting one. There is no sensible default: a
 * silently chosen window is exactly the defect this module exists to remove, and swapping a frozen
 * literal for a quietly defaulted one would leave the reader in the same position. `periodFor` in
 * `brief/_period.ts` refuses for the same reason and in the same words.
 */
export function dashboardSpan(today: unknown): DashboardSpan {
  if (typeof today !== "string" || !ISO_DATE.test(today)) {
    throw new Error("dashboard: a span needs a calendar date in YYYY-MM-DD form");
  }
  // A date the regex accepts but the calendar does not -- "2026-02-31" -- must not roll silently
  // into March. `Date` normalises it, so the round-trip is what catches it.
  const at = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== today) {
    throw new Error("dashboard: a span needs a real calendar date");
  }

  const to = shift(today, -1);
  return { from: shift(to, -(DASHBOARD_SPAN_DAYS - 1)), to };
}

/**
 * The span as a reader sees it, so the table and its label cannot come from different values.
 *
 * The two were separate before: the query used a literal in `page.tsx` and the badge rendered
 * `SITE_DASHBOARD.period`, a hand-typed string in `_content.ts`. Two copies of one fact, kept in
 * step by nobody -- and the live table carried no period label at all, so a customer could not see
 * which question had been asked of their data.
 *
 * ISO DATES RATHER THAN "1 Sep - 30 Sep". A localised range needs a locale and a month name, and
 * this label sits beside figures whose currency and timezone the repository refuses to guess.
 * Guessing the reader's date format to dress up a window they are being shown for audit is the
 * wrong trade: the point of the label is that it matches the query exactly.
 */
export function spanLabel(span: DashboardSpan): string {
  return `${span.from} to ${span.to}`;
}
