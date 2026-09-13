# 99. A day-based source, asked for in days

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and a correction to two notes before it

Search Console is dispatched. Three of seven connectors now deliver rows, and the claim widened by
itself again:

> Reads **Loyverse, Search Console and WooCommerce** on your own credentials.

**First, a correction.** Notes 96 and 97 and issue #89 all said the blocker for GA4, Meta Ads and
Search Console was *"a report definition a `connections` row does not carry"*. **That is wrong.** Each
connector carries its own default — `GA4_DEFAULT_REPORT`, `META_DEFAULT_REPORT`,
`SEARCH_CONSOLE_DEFAULT_REPORTS` — decided by the connector author and documented where it lives. The
dispatch has to invent nothing. I asserted a blocker from the shape of the options type without
reading whether the field was optional, and then repeated it twice.

The real blockers are different for each, and one of them is much harder than what I claimed:

| Connector | Actual blocker |
|---|---|
| **Search Console** | its window is a **day span**, and `IngestRequest` carried only instants |
| **GA4** | `runGa4Backfill` returns `void` — **no checkpoint** |
| **Meta Ads** | `runMetaBackfill` returns `void` — **no checkpoint** |

### 1.1 Why the day span is not a formality

Search Console reports in **the platform's own Pacific reporting day**. The two sources dispatched
before it report in instants, so the obvious way to wire this one is `request.since.slice(0, 10)`.

**That picks a reporting day by accident.** A run asked for from `2026-09-11T20:00:00Z` would read
the 11th when Google's own day had not started, and every impression and click would be attributed
to a day the platform would not have answered for — well-formed data on the wrong calendar day, with
nothing marking it. It is the Bangkok-receipt error from note 97 in a different timezone.

So `IngestRequest` grew `from` and `to`, inclusive at both ends, validated at the boundary with the
connector's own `parseSearchConsoleDate` rather than a second definition of what a date is. A
`search_console` run without them **refuses, and the refusal names the reason** rather than the
field. There is no default lookback either: how long a Search Console figure keeps moving is
unmeasured — that is what the null `restates_until` says — so a number here would silently decide how
much of a customer's history is re-read.

### 1.2 GA4 and Meta cannot be wired without work in the connectors

Both walk a plan of windows and return `void`. `IngestReport.checkpoint` is documented as *"the
`since` the NEXT run must use… A partial run that reported the span's END would skip everything it
did not reach, which is correct-looking and wrong forever."*

Neither generator knows which windows completed, so there is **nothing honest to put in that field**.
Deriving it from the last window's end is the exact failure the field's own comment names. That is a
connector-level gap — each needs a checkpoint the way WooCommerce, Loyverse and Search Console have
one — and it is not something a dispatch can paper over. `DEFERRED_SOURCE_IDS` now says so instead of
repeating my wrong reason.

## 2. Cost estimate

**Per connected account per month:** derived, and the chunk width does the work.

`SEARCH_CONSOLE_CHUNK_DAYS` is **one**, and the connector is explicit that the number is an admission
rather than a tuning: sizing wider means predicting how many distinct queries a property returns per
day, which nothing here has measured. Two reports per chunk — the unthresholded total first, then the
query grain — so a run costs **2 requests per calendar day of span**, plus paging where a day exceeds
the row limit.

A nightly run over one day: **~2 requests**, ~60 a month. An initial 90-day backfill: **~180
requests**, once. Rows: one totals row per day plus up to `rowLimit` query rows per day, so a
property with 50 distinct queries a day writes ~51 rows/day → ~1,530 a month per connected property,
which is the largest per-account row count of the three wired sources.

**Not costed, and stated rather than assumed away:** the restatement ladder does not apply here and
that is itself the open item — `planBackfill`'s tiers are built for sources with a measured
finalisation lag, and this connector reads *the span it is given* precisely because Search Console
publishes none. So re-reading is an operator decision with no schedule behind it, and the monthly
figure above assumes each day is read once.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `PASS` — the customer's own OAuth access token, opened from the per-workspace vault.
&nbsp; **2. Vendor-key exception.** > `N/A`. &nbsp; **3. No token pass-through.** > `N/A`. &nbsp;
**4. Credential hygiene.** > `PASS` — the token appears in no report, log or error.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `PASS` — unchanged write
path. &nbsp; **7. No cross-workspace read.** > `PASS` — read by `(workspaceId, connectionId)`, written
with both. &nbsp; **8. No cross-customer aggregation.** > `PASS`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > `PASS`. &nbsp; **11. Meta client list.** > `N/A`. &nbsp;
**12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > **`PASS`, and the anonymity threshold is the interesting part.** A search
query is user-typed text and can contain anything, including a name — which is why Google's own
threshold withholds low-volume queries before this product ever sees them. The connector's
normaliser is the boundary and this dispatch adds no field. Named in §5 for independent checking,
because `packages/payloads/src/redaction.ts` removes identifiers **by key** and is explicit that it
does not inspect values. &nbsp; **14. Forbidden payloads.** > `PASS` — no special-category field
exists on a Search Analytics row. &nbsp; **15. Per-destination consent.** > `N/A`.

### Access tier and quota
**16. Tier reality.** > **`PASS`, and the per-site ceiling is shared with the customer's own tools.**
The backfill makes both of its refusals **before the first request**, so a run that was always going
to be refused spends none of that ceiling. &nbsp; **17. No new long-lead dependency.** > **`PASS`
with a caveat named in §5**: `webmasters.readonly`'s sensitive-scope status is flagged unconfirmed in
the standing list, and this dispatch does not change what scope is requested.

### Claims
**18. Claim provenance.** > `PASS` — the claim widened because `INGESTABLE_SOURCE_IDS` gained an id;
`brand.test.ts` went red on the old sentence and `check-ingestable.mjs` refuses the id unless
`runIngest` dispatches it.

**Result:** `12 PASS, 6 N/A, 0 FAIL`

## 4. What was left out

- **GA4 and Meta Ads.** They need a checkpoint in the connector before any dispatch can be honest.
  Recorded in `DEFERRED_SOURCE_IDS` with the real reason, and #89 is corrected.
- **Google Ads and Shopify.** No backfill at all.
- **A restatement schedule for Search Console.** The connector reads the span it is given, on
  purpose. Giving it a ladder means inventing a finalisation lag nobody has measured.
- **Wiring `from`/`to` into the scheduled sweep.** The sweep has no span to supply and would have to
  invent one, which is the same refusal one layer up. A Search Console pull is an operator action
  through `POST /v1/ingest/run` until something decides the span deliberately.

## 5. Open or unverified spec items this builds on

- **`webmasters.readonly`'s sensitive-scope status is unconfirmed**, per the standing list. If it is
  sensitive, the OAuth verification gate applies and this connector's usefulness is behind an
  unbounded queue — never quote a duration for it.
- **Search Console publishes no finalisation statement**, which is why `restates_until` is null for
  this source and why the checkpoint's own comment says it means READ and not FINAL. A caller
  treating a date behind the watermark as done has decided an open question by accident.
- **Whether a search query can carry personal data into `envelope_rows`** is the gate-13 question.
  Google's threshold is a mitigation and not a guarantee, and the normaliser is the boundary; a
  reviewer should confirm independently rather than on this note's word.
- **No live pull has happened, for any connector.** Unchanged from note 97 and repeated because it
  is the difference between "the dispatch is exercised end to end against fakes in real workerd" and
  "a row has arrived from a real property".

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0  (343 in api-edge)
pnpm -r build           = 0    all thirteen check-*.mjs  = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
```

```
before:  "Reads Loyverse and WooCommerce on your own credentials."
after:   "Reads Loyverse, Search Console and WooCommerce on your own credentials."
```

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| Derive the span from `since.slice(0, 10)` instead of refusing | **two** red: the refusal test and the one-ended-span test |
| Report `spanTo` instead of `spanFrom` when nothing completed | see below — **green twice before it failed** |

**THE SECOND MUTATION SURVIVED TWO TESTS WRITTEN TO CATCH IT, AND THAT IS THE ENTRY.**

The first attempt used a one-day span, so `from` and `to` were the same string and no assertion
could tell them apart. The second used a three-day span and failed the run at the third request — by
which point **the first chunk had completed**, `readThrough` was a real date, and the `??` branch was
never evaluated. Both tests passed. Both proved nothing.

Failing at the **first** request is the only state in which the fallback is reached, and the mutation
then fails by name. Three attempts, and the tell each time was the one this repository keeps
teaching: the mutation should have broken something and did not.
