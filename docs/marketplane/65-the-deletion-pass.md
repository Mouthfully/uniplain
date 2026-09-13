# 65. The deletion pass: a roadmap item and a promise with no path are not the same thing

**PR:** #41 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the line it draws

Note 60 section 6 is the ledger issue #49 asked for: every claim on the site written ahead of its
capability, grouped by what is missing. Writing it was the right first move — the gap is now
legible instead of absorbed. But a ledger is a record, not a remedy, and its own grouping contains
the remedy:

| Group | What it is | What closes it |
|---|---|---|
| 6.1, 6.2 | the cadence and the three surfaces — unbuilt | building them |
| **6.3** | "worse than unbuilt: the contract has no shape for them" | a dictionary change **first**, then building |
| 6.4, 6.5 | inference and audience | code for one, years for the other |

**The decision: 6.3 comes off the page; the rest stays and stays recorded.** A claim you can build
is a promise with a path, and a page that only describes what already compiles is a page for a
product with no direction. A claim whose figure has no column is different in kind — nobody is
"working towards" it, because the work has not been defined. One clause on the site named a
language nothing is localised to and one named a comparison nothing performs; both belong on the
same side of that line, and both are annotated at the line they left.

**Nothing was cut for being ambitious.** Every deletion below is a specific missing column, missing
source, or missing module, named in the file where the copy used to be.

## 2. What changed, and the block behind each

### The two reports that cannot be computed

`Reports.tsx` sold four named documents. Two of them were blocked in the data model:

- **"P&L by unit and channel"** — blocked twice. `dimensionsSchema` carries `date`, `currency`,
  `timezone` and `attribution_window`; there is **no `unit`**. And a profit-and-loss statement needs
  a cost side: `metrics.ts` has `spend`, `fees` and `commission` and nothing that is a cost of goods
  or an operating expense. → **"Revenue and ad spend by channel"**, because `source` *is* the
  channel and both metrics are in the dictionary.
- **"Bank loan pack"** — there is no bank. The connector directory holds air4thai, ga4, google_ads,
  meta_ads, search_console and woocommerce, and note 60 §1.3 records Thai deposit data as
  regulator-blocked until roughly 2027. This is not a connector somebody writes next quarter.
  → **"Orders and takings by day"**.

The section lead lost "unit" and "bank account" for the same reasons. All four reports remain
**unbuilt** — there is no report writer anywhere — and that stays in the ledger. The change is that
all four are now *expressible*.

### The follow-up check, in all three places it was written

`ActionSheet`'s lead and footer line, `FeatureGrid`'s action card, and `SimplerWay`'s fourth step
each promised that the product checks next week whether a recommendation worked. **Nothing compares
a recommendation against what happened afterwards**, and this is not a cadence a cron supplies: it
needs a record of what was recommended, a record of what the owner did, and a measurement of the
period after. Two tables and a job, none of them written.

`SimplerWay`'s step four is the one that cost something. Its own comment argued that a
recommendation nobody checks is indistinguishable from a guess — which is correct, and is why the
step cannot describe the check before the check exists. It is now **"Trace"**: every figure names
its source and the time it was read, which `fetched_at` and `is_provisional` make true today and
`/dashboard` already renders. The follow-up belongs back in that slot the day it is built.

### The language

"Reply to ask a follow-up, in Thai or English" appeared on `FeatureGrid`'s brief card and in the
FAQ. Two things were wrong and only one is a roadmap item: no channel adapter exists, so there is
nothing to reply to — and **nothing in this repository is localised to Thai.** Not a string table,
not a locale, not a model instruction. Naming a language is the kind of specific promise a customer
tests on their first attempt.

### The inference

`SimplerWay`'s "Learn" step said *"It works out what kind of business you run from the data."*
Nothing infers a business type: `leadingMetrics(business)` takes the type as an **input**. The
per-trade emphasis is real code; the inference is not. The step now says who supplies it.

### Five audience cards kept, ten claims inside them rewritten

**No card was cut, and that is a deliberate reading of what was false.** "Built for cafés" is a
statement of *who it is for*; note 60 §6.5's finding — that four of the five trades had no
reachable source — makes that a hard road, not an untruth, and issue #49 asks for the audience by
name. What was false is narrower: every `leadsWith` line named a figure **the envelope has no shape
for**.

**That finding moved under this unit's feet, and the change is in the right direction.** The
Loyverse point-of-sale connector landed on this branch while the pass was being written, so the
café now has a reachable source and the count is two of five, not one. It does **not** reopen any
line cut here: `loyverse/normalize.ts` maps a receipt to exactly two dictionary entries — `revenue`
and `orders` — and its own header rules out the rest for the same reasons this note gives, more
precisely. On hourly takings: *"a GRAIN problem, not a metric problem. `dimensions.date` is a
calendar day and the upsert key carries no time component, so there is nowhere to put it."* On
margin: the line items carry `cost` and `cost_total` and **the column still does not exist**.

It did correct one line of mine. The café card first read "what fees took back out of them", which
is true of the schema — `fees` is in the dictionary, from WooCommerce — and **false of the shop**: a
Loyverse-only café has nothing to deduct, because no delivery platform in that connector takes a
cut. A figure that exists somewhere in the dictionary is not thereby a figure this customer has.

| Figure | Why it has no column |
|---|---|
| hourly revenue, utilisation by hour | `date` is a calendar day and the upsert key has **no time component** |
| delivery share, occupancy | not metrics in `packages/contract/src/metrics.ts` |
| margin by listing | needs a cost of goods the dictionary lacks — **and** the WooCommerce entity is `shop_order`, so there is no per-listing grain to carry one. **Two independent blocks on one line**, and the second is new here: note 60 recorded only the first |
| one export per client | no export exists, and multi-client switching sits behind `surface:agency-switching`, which is **withheld** |

Each line was rewritten to a figure the dictionary holds, at the grain the envelope stores — a
**day** and a **source**. The hourly framing survives in exactly one place, the hero, where it is
drawn inside a panel labelled as a sample and issue #49 asks for it by name. **A sample may
illustrate a number the product does not yet have; a capability line may not.**

## 3. The defect this pass found on its own

`ActionSheet`'s card read **"Three actions, worth about ฿6,400 a month between them"** above three
actions worth ฿3,100–฿3,600 a month, ฿1,840 a month, and ฿900–฿1,400 **a week**. ฿6,400 is roughly
the first two plus the top of the third: **a weekly figure added into a monthly total.** The true
monthly total is nearer ฿8,800–฿11,500, and that figure has a weeks-per-month division inside it
that nothing on the page states.

This is the one arithmetic error the product is sold against, printed on the section that sells it,
inside a card that labels its figures as a sample. A sample label licenses an *invented* figure; it
does not license figures that contradict each other, because the thing being illustrated is the
arithmetic.

**The fix does not convert.** It sums the figures that share a unit and leaves the third in its own:
*"Three actions: ฿4,940 to ฿5,440 a month, plus ฿900 to ฿1,400 a week."* Both ends are exact. This
is what `combineMetric` does with an incompatible aggregation, and for the same reason — a total
across units is not a smaller total, it is a different quantity.

**And it is now guarded.** `action-sheet-arithmetic.test.tsx` sums each period separately and
asserts the summary states every period the actions have, with both ends exact. **There is no
weeks-per-month constant in that file on purpose:** converting is how the original went wrong — not
by choosing a bad factor, but by applying one silently.

`sample-brief.test.tsx` could not have caught this. It checks `AssistantPanel`'s numerals against
what the engine licensed; these three actions are hand-written copy for a capability that does not
exist, so there is no figure set to check them against. What can be checked without an engine is
that the copy is consistent with itself — which is precisely the property that failed.

## 4. Cost estimate

**Per connected account per month:** `N/A — no data-plane work.` Marketing copy, one test file, two
constants exported for it.

## 5. Platform-terms check

Gates 1–17: `N/A` — no credential, no table, no platform call, no PII path, no quota.

**18. Claim provenance.** `PASS`, and this unit exists for that gate. It moves the page's claim
surface strictly **inwards**: two report names, four `leadsWith` lines, five card bodies, three
follow-up clauses, two language clauses and one inference claim either removed or rewritten to a
figure the dictionary holds. `AVAILABLE_CAPABILITIES` is untouched and no withheld claim was
published. Note 60's ledger is amended in place with a pointer here rather than edited to match, so
the finding and the remedy are both still readable.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 6. Mutation testing

| Mutation | Result |
|---|---|
| restore `"Three actions, worth about ฿6,400 a month between them"` **verbatim** | `1 failed` — *month low: expected 6400 to be 4940* |
| drop the weekly clause, monthly total left correct | `1 failed` — *the summary states no week figure* |
| move one end by ฿100 | `1 failed` — *month high: expected 5540 to be 5440* |

All reverted. Suite green at **208 web tests** (204 before this unit).

## 7. What was left out

**The cadence claims stay** — "every morning", "each Monday", "on the first", note 60 §6.1. They are
unbuilt, not unbuildable: a cron and a channel adapter deliver them. Cutting them would have
rewritten the product's whole proposition on my own initiative, which is a founder's call.

**The three absent surfaces stay** — the brief, the action sheet and the Ask, note 60 §6.2. Same
line: `packages/insights` generates exactly this brief today and nothing delivers it. That is a
delivery gap with a path.

**The `diagnose` claim was not amended.** It was on my list and I could not reconstruct, from the
repository, what was wrong with its final clause — and the claim is **withheld** behind
`surface:diagnose`, so it renders nowhere and amending it on a guess would be the failure this repo
is organised against. Recorded rather than silently dropped: someone who knows the reason should
take it.

**`entity_name` is still stored tenant free text** with no policy over it — written by
`google_ads/normalize.ts:569` and `meta_ads/normalize.ts:493`, persisted by `store/src/ingest.ts:66`.
It never reaches a prompt (`InsightRow` carries no entity name), so it is not this unit's problem,
but it is unfiled and keeps being rediscovered.

**`run-local.sh` is still not in CI**, carried forward from note 63. Every guard here fails
correctly and the SQL half of the gate runs only when a person types the command.
