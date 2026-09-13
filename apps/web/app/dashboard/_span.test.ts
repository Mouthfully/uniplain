import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DASHBOARD_SPAN_DAYS, dashboardSpan, spanLabel } from "./_span";

/**
 * THE WINDOW A CUSTOMER'S ROWS ARE READ FOR.
 *
 * The assertion that matters is the last one in this file, and it is about the page rather than the
 * function: **no date literal may appear in the dashboard's query again.** Everything above it
 * checks that the derived window is the one it claims to be, but a correct `dashboardSpan` sitting
 * beside a page that still queries a constant would be the defect untouched, with a module in front
 * of it making it look addressed.
 *
 * What went wrong: `const SPAN = { from: "2026-06-01", to: "2026-06-30" }`, frozen, under a comment
 * about the heading and the query not disagreeing. Every signed-in customer after June 2026 had
 * their rows read for a month nobody chose, and was told "your workspace has no rows for this
 * period" -- a sentence about their business, drawn from a literal they could not see.
 */

describe("the span a customer's rows are read for", () => {
  it("ends yesterday, because a day in progress is not a day", () => {
    // The rule `brief/_period.ts` states and this one follows: including this morning puts a few
    // hours of trading into a total labelled as a full period.
    expect(dashboardSpan("2026-09-13").to).toBe("2026-09-12");
    expect(dashboardSpan("2026-01-01").to).toBe("2025-12-31");
  });

  it("covers exactly the declared number of complete days, inclusive", () => {
    const span = dashboardSpan("2026-09-13");
    const from = Date.parse(`${span.from}T00:00:00Z`);
    const to = Date.parse(`${span.to}T00:00:00Z`);
    const days = (to - from) / 86_400_000 + 1;
    expect(days).toBe(DASHBOARD_SPAN_DAYS);
  });

  it("crosses a month, a year and a leap day without arithmetic drift", () => {
    // UTC date-only arithmetic, so no local offset can shift a day. A `setUTCDate` that rolled
    // wrongly across February would move a customer's window by a day and nothing would say so.
    expect(dashboardSpan("2026-03-01")).toEqual({ from: "2026-01-30", to: "2026-02-28" });
    expect(dashboardSpan("2028-03-01")).toEqual({ from: "2028-01-31", to: "2028-02-29" });
    expect(dashboardSpan("2026-01-15")).toEqual({ from: "2025-12-16", to: "2026-01-14" });
  });

  it("is never empty, on any day of any month", () => {
    // The reason this is thirty trailing days and not a calendar month. Month-to-date is empty on
    // the 1st, so a month-shaped window would report "no rows for this period" truthfully and
    // uselessly, to every customer at once, once a month.
    for (const day of ["2026-09-01", "2026-02-01", "2026-12-01", "2027-01-01"]) {
      const span = dashboardSpan(day);
      expect(span.from < span.to, `${day} produced an empty or inverted span`).toBe(true);
    }
  });

  it("refuses an unusable date rather than substituting one", () => {
    // A quietly defaulted window is the defect this module replaced. Swapping a frozen literal for
    // a silent fallback would leave the reader in exactly the same position.
    for (const bad of ["", "yesterday", "2026-9-13", "20260913", null, undefined, 20260913]) {
      expect(() => dashboardSpan(bad), `accepted ${JSON.stringify(bad)}`).toThrow();
    }
  });

  it("refuses a date the calendar does not have", () => {
    // `Date` rolls "2026-02-31" into March without complaint, which would silently move a
    // customer's window a month. The round-trip is what catches it.
    expect(() => dashboardSpan("2026-02-31")).toThrow();
    expect(() => dashboardSpan("2026-13-01")).toThrow();
  });

  it("labels the window with the same values it queried", () => {
    const span = dashboardSpan("2026-09-13");
    const label = spanLabel(span);
    expect(label).toContain(span.from);
    expect(label).toContain(span.to);
  });
});

describe("the page asks the question it shows", () => {
  const page = readFileSync(new URL("./page.tsx", import.meta.url).pathname, "utf8");

  it("has no date literal in the dashboard page", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. Comments are stripped first, because the note explaining
    // the defect necessarily quotes the June dates that caused it -- and a guard that fired on its
    // own explanation would be answered by deleting the explanation.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const literals = code.match(/["'`]\d{4}-\d{2}-\d{2}["'`]/g) ?? [];
    expect(
      literals,
      `the dashboard page contains a hard-coded date: ${literals.join(", ")}. A frozen window ` +
        "reads a customer's rows for a period nobody chose and reports the emptiness as theirs.",
    ).toEqual([]);
  });

  it("derives the window rather than declaring one", () => {
    expect(page).toContain("dashboardSpan(");
    expect(page).not.toContain("const SPAN =");
  });

  it("tells the reader which window produced the figures", () => {
    // The live table used to carry no period label at all, and its note pointed at "the period
    // above" -- which was the CONCEPT screen's frozen badge, below it. Figures whose window is
    // invisible cannot be audited by the person they are about.
    //
    // ASSERTED ON THE `LiveRows` CALL, NOT ON THE PAGE. The first version of this checked that
    // `spanLabel(span)` appeared anywhere in the file, and a mutation blanking the table's own
    // prop left it green -- `spanLabel(span)` was still there, in the empty-state sentence. A
    // guard satisfied by a different call site than the one it is about is worse than none: it
    // reports the property as held.
    const call = page.match(/<LiveRows[^>]*\/>/s);
    expect(call, "the LiveRows call moved or changed shape").not.toBeNull();
    expect(
      call?.[0] ?? "",
      "the live table renders a customer's figures without naming the window they came from",
    ).toContain("spanLabel(span)");
  });
});
