# 84. The window nobody chose

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

The dashboard read every customer's rows for **June 2026**, a literal, on every day forever:

```ts
/** The span the screen describes. One place, so the heading and the query cannot disagree. */
const SPAN = { from: "2026-06-01", to: "2026-06-30" } as const;
...
const performance = live ? await performanceRows(SPAN.from, SPAN.to) : null;
```

A shop trading in September signs in, and the screen says:

> "Your workspace has no rows for this period yet. Connect a source and run a backfill to fill it."

**That is a sentence about their business, and it is false.** Their rows exist; the question asked
was about a month nobody chose, and nothing on the page said which month it was. The owner reads it
as "my data has not arrived", checks the connection, finds it healthy, and has no route to
discovering that the query was about June. There is no error, no blank, and no way in.

This is the repository's stated worst case in its purest form: **a wrong answer that looks right.**
CLAUDE.md's rule is about `?? 0` and rounding, but a frozen window is the same defect at the level
of the question rather than the number — the figure is computed correctly from the wrong period, and
correctness downstream is what makes it convincing.

**The decision: derive the window, and show it where the figures are.** `dashboardSpan(today)`
returns the **thirty complete days ending yesterday**; the page reads the clock once and hands the
date down; the live table now carries the window it was read for.

### 1.1 Why those choices and not the obvious ones

**Thirty trailing days, not a calendar month.** Month-to-date is empty on the 1st. A month-shaped
window would report "no rows for this period" truthfully and uselessly, to every customer at once,
once a month — and it would be the same sentence the defect produced, which makes it the one
sentence this change must never be able to emit for a mechanical reason.

**Ending yesterday, not today.** A day still in progress is not a day. Including this morning puts
a few hours of trading into a total labelled as a full period — a partial sum presented as a sum.
`brief/_period.ts` already excludes today and says so; this is the same rule, not a new one.

**Today is an argument, not a clock read inside the function.** Copied deliberately from
`brief/_period.ts`, whose note gives the reason: a function reading `new Date()` internally answers
differently at 23:59 and 00:01 with no record of which it did, and no test pins it without freezing
time. The surface reads the clock once, in `page.tsx`, and passes the date in.

**It throws on an unusable date rather than substituting one.** A silently defaulted window is the
defect with a different constant in it. Swapping a frozen literal for a quiet fallback would leave
the reader in exactly the same position, and would be harder to find.

**Whose midnight ends a trading day is still not answered, and is not pretended away.** The
arithmetic is UTC on date-only values so no local offset can shift a day, but the timezone question
is an open founder decision recorded in `20260913000100_ingest_watermark.sql` and in
`brief/_period.ts`. `20260912000400`'s rule forbids `coalesce(timezone, 'UTC')` — "a guess wearing
the costume of a fact" — and this module makes no such guess about the data. It chooses a window;
the rows carry their own timezone.

### 1.2 The pointer that pointed at the wrong thing

`DASHBOARD_LIVE.note` read:

> "Read from your workspace for **the period above**. Row-level security decided which rows these
> are…"

There was no period above it. The live table renders **above** the illustrative concept screen — a
deliberate ordering, argued in the page's own comment, so that a real number is never mistaken for a
concept. The only period badge on the page is the concept's, **below** the live table, reading
`Jun 1 – Jun 30, 2026` and describing figures the page labels as illustrative.

So a customer who followed the pointer found a month, in a badge, that their rows were not read for
— and every reason to believe it. Two separate wrongnesses agreeing with each other by accident, one
of them correct about a concept screen and the other about nothing.

The note now takes the window as an argument and states it beside the figures. **Figures whose
window is invisible cannot be audited by the person they are about**, which is the property the whole
product is sold on.

### 1.3 A guard I wrote, mutated, and found weak

The first version of the label assertion was `expect(page).toContain("spanLabel(span)")`. Blanking
the live table's own prop — `span={spanLabel(span)}` → `span=""` — **left it green**, because
`spanLabel(span)` still appeared elsewhere in the file, in the empty-state sentence.

A guard satisfied by a different call site than the one it is about is worse than no guard: it
reports the property as held. It now matches the `<LiveRows … />` call and asserts on that, and the
same mutation goes red.

## 2. Cost estimate

**Per connected account per month:** `$0.00`, with a caveat worth stating rather than rounding away.

No new query, no new table, no new upstream call. The dashboard made exactly one `performanceRows`
read before and makes exactly one now.

**The caveat:** the window moved from a fixed 30-day month to a rolling 30 days, so for a workspace
with rows the read now returns data where it previously returned an empty set. That is the point of
the change, and it means the *first* real cost measurement of this screen is still ahead — the old
one measured a query against an empty range. Section 7's table has no disk-growth term by its own
checker's admission, and this note does not invent one. **Nothing here touches the scheduler**, so
the polling ratio section 8 names as the margin risk is unchanged.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call; the dashboard reads its own database.

**2. Vendor-key exception.** > `N/A` — no company-held key.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface touched.

**4. Credential hygiene.** > `N/A` — no credential in the diff.

### Tenancy

**5. RLS.** > `PASS` — no schema change. `performanceRows` runs as `authenticated` under RLS for one
workspace and that is untouched; only the two date arguments changed.

**6. No service-role bypass.** > `PASS` — the read still runs under the caller's identity. Widening
the window changes which of *their own* rows come back and nothing else.

**7. No cross-workspace read.** > `PASS` — and worth checking rather than assuming, because a date
range is exactly the kind of parameter that gets widened into an "all workspaces for this period"
roll-up later. It is not one: the query is the same single-workspace read, with different bounds.

**8. No cross-customer aggregation or benchmarking.** > `PASS` — nothing aggregated across tenants;
the table lists one workspace's rows.

**9. API key scope.** > `N/A` — no key path touched.

### Data movement

**10. No resale or redistribution.** > `PASS` — data moves nowhere; it is rendered to the workspace
it belongs to.

**11. Meta client list.** > `N/A` — not touched.

**12. Dependency licences.** > `PASS` — no dependency added.

### PII and consent

**13. Hash at the edge.** > `N/A` — no ingest path; nothing new persists or is logged.

**14. Forbidden payloads rejected before egress.** > `N/A` — no egress.

**15. Per-destination consent.** > `N/A` — no record carries a consent object here.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request, so no quota consumed.

**17. No new long-lead dependency.** > `PASS` — nothing added.

### Claims

**18. Claim provenance.** > `PASS` — no new user-visible claim. The change **removes** an untrue
statement (an emptiness attributed to the customer's data that belonged to a frozen constant) and
adds a factual one (the window). The concept screen keeps its `SITE_DASHBOARD.notice` label and its
own frozen `Jun 1 – Jun 30, 2026` badge, which is correct: it describes fixed illustrative figures
and should not move.

**Result:** `9 PASS, 9 N/A, 0 FAIL`

## 4. What was left out

- **Letting the customer choose the window.** A date picker is the obvious next request and is not
  this PR. The defect was a window nobody chose; the fix is a window that is *correct and visible*.
  Making it selectable is a feature with its own state, URL and empty-state questions. **Issue, not
  scope creep.**
- **A comparison period on the dashboard.** `/brief` compares seven days against the seven before.
  The live table lists rows rather than comparing them, so a comparison would need a second query
  and a second design decision about what "changed" means for a row. Not started.
- **Replacing the illustrative concept screen.** Still there, still labelled, still below the live
  table. It goes when there is a live workspace to demonstrate against — `MVP-PLAN.md` section 5,
  steps 8 and 9 — and removing it while `envelope_rows` is empty would leave a signed-in customer
  with a blank page and no sense of what the product is.
- **Localising the window label.** It renders as `2026-08-14 to 2026-09-12` rather than
  `14 Aug – 12 Sep`. A localised range needs a locale and a month name, and this label sits beside
  figures whose currency and timezone the repository refuses to guess. The point of the label is
  that it matches the query exactly; guessing the reader's date format to dress it up is the wrong
  trade.
- **`SITE_DASHBOARD.period`.** Left frozen on purpose — see gate 18.

## 5. Open or unverified spec items this builds on

- **Which timezone's midnight ends a trading day.** Unanswered, and now load-bearing in a second
  place. `dashboardSpan` picks calendar dates in UTC and the rows carry their own `timezone`; if the
  founder decides a trading day ends at the *workspace's* midnight, this window's boundaries shift
  by up to a day and the label must shift with them. **What happens to this change if the answer
  comes back the other way:** `dashboardSpan` gains a timezone argument and the call site supplies
  it — the structure survives, because today is already an input rather than a clock read. That is
  most of why it is an input.
- **Thirty days is a product judgement, not a sourced figure.** Nothing in the specification states
  a dashboard window. It is recorded here as a choice with reasons rather than presented as derived.
- **The screen has never rendered a non-empty live table.** `envelope_rows` holds no rows, so the
  live path is proven by tests and by nothing else. **The assertions in `_span.test.ts` are about
  the window, not about the figures**, and this note does not claim the table is verified against
  real data. That verification needs step 8 of the MVP plan.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm exec biome lint .          = 0
pnpm exec biome format .        = 0
pnpm -r typecheck               = 0
pnpm -r test                    = 0
pnpm -r build                   = 0     (both apps)

check-brand=0       check-capabilities=0   check-claim-sources=0   check-copy=0
check-dictionary=0  check-erasure=0        check-providers=0       check-registry=0
check-tokens=0
```

The SQL suite is unaffected by this unit (no migration) and was run green on the commit before it —
23 suites, 702 assertions, 0 failed.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Put the June literal back as `const span = { from: "2026-06-01", to: "2026-06-30" }` | `has no date literal in the dashboard page` — *the dashboard page contains a hard-coded date: "2026-06-01", "2026-06-30"* — and `derives the window rather than declaring one` |
| Blank the live table's window prop: `span={spanLabel(span)}` → `span=""` | `tells the reader which window produced the figures` — *the live table renders a customer's figures without naming the window they came from* |

The second mutation is the one that earned its place. **It passed against the first version of that
assertion**, which checked only that `spanLabel(span)` appeared somewhere in the file — and it did,
in the empty-state sentence, a different call site entirely. The assertion now matches the
`<LiveRows … />` call itself. A guard that a mutation walks through is not a weak guard, it is a
false report of coverage, and the only way to find one is to try.
