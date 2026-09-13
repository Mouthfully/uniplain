# 97. The till this product is designed around

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`runLoyverseBackfill` was written, tested and exported from `@repo/connectors`. **Nothing called
it.** `runIngest` refused every provider but `woocommerce`, and the nightly sweep filtered the rest
out before they were leased.

So a café in Bangkok could connect their Loyverse account, watch the connection go healthy, and
never receive a single row — from the sweep or from a manual `POST /v1/ingest/run`, which answered
501. Note 96 corrected the claim that hid this; this is the feature that removes the need for it.

**Loyverse is dispatched. The published claim widened by itself, in the same commit, because it is
derived:**

> Reads **Loyverse and WooCommerce** on your own credentials.

### 1.1 The work was never the walking

The backfill walks a window and its own tests prove it. What was missing is **resolving what the
walk needs from a connection row** — and nothing in the repository had ever done that for a source
other than WooCommerce:

| What the dispatch resolves | Where it comes from | What it refuses |
|---|---|---|
| the OAuth grant | the sealed blob, opened under the KEK | a `key_secret` blob — Loyverse has no bearer lane |
| granted scopes | `connections.granted_scopes` | a grant without `RECEIPTS_READ` |
| the merchant's timezone | `connections.timezone` | **null** — `dimensions.date` is computed in it |
| the window | the caller's `since`, `until` pinned once | a future `until`, which is a permanent hole |

`PROVIDER_LANES.loyverse` is `["oauth"]`, and the single-element array is a refusal rather than an
omission: Loyverse issues a pasteable personal access token that its own documentation says *"gives
unlimited access to the targeted account"* — no scopes, and on this API unlimited includes
`RECEIPTS_WRITE`. The dispatch requires an OAuth grant and a test asserts the refusal.

### 1.2 `splits` is null for Loyverse, and that is the whole argument in one field

WooCommerce meters `splits` — windows the bisector had to cut, each implying a probe page fetched
from the merchant and discarded. Loyverse walks a cursor. **There is no probe page, so there is
nothing to count.**

Reporting `0` would say *"we measured this and it was none"*, and an operator comparing two runs
would read the Loyverse pull as cheap. It reports **null**: absent is not zero, which is this
repository's first rule applied to a field nobody would have looked at twice.

### 1.3 A branch, not a shared loop

The two sources agree on almost everything and disagree on the three things that matter: the
window's field names (`modifiedAfter` / `updatedAfter`), what a checkpoint is, and **what a run
costs the merchant** — WooCommerce meters splits, Loyverse meters an account-wide rate budget shared
with the merchant's own integrations.

A shared loop would have to erase those differences to a common shape, and **the common shape is
where a number stops meaning what its source meant by it.** The branch returns early and the
WooCommerce path is untouched.

## 2. Cost estimate

**Per connected account per month:** the first data-plane figure in several notes, and it is
derived rather than asserted.

A Loyverse pull is `1 + ceil(receipts / page)` requests per chunk, plus one `/merchant/` call per
run. At `LOYVERSE_PAGE_LIMIT` per page and the default chunk width, a café writing ~40 receipts a
day costs **one merchant call and one or two receipt pages per nightly run** — call it 3 requests a
night, ~90 a month, against an account budget of 300 requests per 300 seconds that this client
already holds a floor back from so the merchant's own integrations are not the ones that get the
429.

Rows: ~40/night → ~1,200 envelope rows a month per connected till. At `numeric(20,6)` columns on a
flat table that is small against the Supabase disk line `20260908001100_envelope_rows.sql` names as
most likely to break the model, and it is **new**: this account previously wrote none.

Workers: one Workflow instance per (connection, source, ingest_date), unchanged in shape — the
sweep now has a second provider to claim rather than a second cron.

**What is NOT costed, and is stated rather than assumed away:** the restatement ladder. Loyverse
receipts restate (a sale cancelled or refunded moves `updated_at`), and the D+1/D+3/D+7/D+28 re-pull
multiplies the request count by roughly four over a month. Section 8's own open question — whether
platform limits force 3-5× redundant polling per useful row — applies here and this change does not
answer it.

## 3. Platform-terms check

### Credential
**1. BYOC.** > **`PASS`, and it is the gate this unit is built on.** The credential is opened from
the per-workspace vault under `CREDENTIAL_KEK` and is the customer's own OAuth grant. No
company-held token touches the till. &nbsp; **2. Vendor-key exception.** > `N/A` — no company key.
&nbsp; **3. No token pass-through.** > `N/A` — no MCP surface. &nbsp; **4. Credential hygiene.**
> `PASS` — the token appears in no report, no log line and no error message; `IngestReport` carries
numbers, a connection id and repository-authored text.

### Tenancy
**5. RLS.** > `N/A` — no migration; rows are written through `public.ingest_envelope_rows`, which
already carries the workspace scope. &nbsp; **6. No service-role bypass.** > `PASS` — the run writes
through the minted role, unchanged. &nbsp; **7. No cross-workspace read.** > `PASS` — the connection
is read by `(workspaceId, connectionId)` and the write context carries both. &nbsp; **8. No
cross-customer aggregation.** > `PASS` — nothing aggregated. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > `PASS` — receipts land in the originating workspace and
nowhere else. &nbsp; **11. Meta client list.** > `N/A`. &nbsp; **12. Dependency licences.** > `PASS`
— none added; the connector was already a dependency.

### PII and consent
**13. Hash at the edge.** > **`PASS`, and worth checking rather than assuming.** A Loyverse receipt
can carry a customer id and a line note — the fixture's own note reads *"Extra shot for Khun Nok"*.
`normalizeLoyverseReceipts` is the boundary and it emits the envelope's fields; this dispatch adds
no field and reads none. **Named in §5 as the thing a reviewer should check independently**, because
"the normaliser handles it" is exactly the sentence that should not be taken on trust in a note
about a path that now runs. &nbsp; **14. Forbidden payloads.** > `PASS` — no special-category field
exists on a receipt. &nbsp; **15. Per-destination consent.** > `N/A` — nothing egresses.

### Access tier and quota
**16. Tier reality.** > **`PASS`.** Loyverse's limit is 300 requests per 300s **per account**,
shared with the merchant's own integrations, and the client holds `LOYVERSE_RATE_FLOOR` back so this
product is not what hands them a 429. The budget is threaded across chunks rather than restarted per
chunk — a walk that began afresh each chunk could spend 300 requests per chunk. &nbsp;
**17. No new long-lead dependency.** > `PASS` — the OAuth app exists and the connector shipped; this
depends on no approval that is not already held.

### Claims
**18. Claim provenance.** > **`PASS`, and the mechanism did the work.** The claim widened because
`INGESTABLE_SOURCE_IDS` gained an id, not because anybody edited copy. `brand.test.ts` went red on
the old sentence and demanded the new one in the same commit, and `check-ingestable.mjs` refuses the
id unless `runIngest` actually dispatches it.

**Result:** `13 PASS, 5 N/A, 0 FAIL`

## 4. What was left out

- **GA4, Meta Ads and Search Console.** Each has a written backfill and each needs a **report
  definition** — a property set, a metric set, a grain — that a `connections` row does not carry.
  Where that lives, and what happens when it is absent, is a design question with a right answer
  (refuse, never default) and it is not this unit. Still declared in `DEFERRED_SOURCE_IDS`.
- **Google Ads and Shopify.** No backfill at all.
- **Automating the first window.** Unchanged: a connection with a null `ingest_checkpoint` is
  reported `awaiting_first_run` and skipped. `52-ingest-runtime.md` §4 — *"a default window on a
  watermark walk is the worst kind"*.
- **Writing the watermark back.** The Worker still cannot write `last_backfill_at`; the operator
  holds the checkpoint. Unchanged by this and called out in `ingest.ts`'s own header.
- **A live pull against a real Loyverse account.** No credential exists in this environment. The
  test is end to end over ports with a real seal and a real open, which is what `ingest.test.ts`
  does for WooCommerce — and it is not the same as having read a real till.

## 5. Open or unverified spec items this builds on

- **No live pull has happened, for any connector.** "WooCommerce works" and now "Loyverse works"
  both mean *the dispatch is exercised end to end against fakes in real workerd*. Neither means a
  row has ever arrived from a real account. Stated because the difference is exactly the one this
  PR has spent two notes on.
- **Whether a receipt's line note can carry personal data into `envelope_rows`** is the gate-13
  question above. The normaliser is the boundary and this change does not alter it; a reviewer
  should confirm independently rather than on this note's word, and `packages/payloads/src/redaction.ts`
  is explicit that it removes identifiers **by key** and does not inspect values.
- **Loyverse's boundary inclusivity is undocumented**, which the backfill's own checkpoint comment
  works through at length: it does not know whether `min`/`max` are inclusive, so it overlaps chunks
  by `LOYVERSE_BOUNDARY_OVERLAP_MS` and lets the upsert collapse the re-read. That reasoning is
  inherited here unchanged and is the reason a Loyverse run can report more rows read than written.
- **The restatement ladder is uncosted for this source**, per §2.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0  (334 in api-edge)
pnpm -r build           = 0    all thirteen check-*.mjs  = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
```

The claim, read out of the build before and after:

```
before:  "Reads WooCommerce on your own credentials."
after:   "Reads Loyverse and WooCommerce on your own credentials."
```

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| Remove `loyverse` from `INGEST_SOURCES` | **five** tests red — the dispatch, the currency, the split count, and both refusals |
| Report `splits: 0` instead of `null` | `reports a null split count rather than zero, because there is no bisector` |
| Delete `assertReadOnlyCredential(loyverseCredential)` | **nothing. All 334 green.** |

**The third is the one worth reading, and it is recorded because it walked through.**
`fetchMerchant` calls the same assertion at its own top, so the guarantee is `client.ts`'s and the
call in `runIngest` is an earlier restatement of it that no test distinguishes. The line is kept —
that module's own note is "calling it three times costs nothing; missing it once costs the
guarantee" — but the comment beside it now says it is defence in depth rather than claiming it is
load-bearing, and the test asserts the **property a merchant feels**: a grant this product cannot
read with is refused before a single request reaches their account's shared rate budget.

**One of these tests was passing for the wrong reason and is fixed.** The harness minted its own
KEK, so a record sealed by the caller under a different key failed with `bad_kek` — and `bad_kek` is
an `IngestError` like every refusal in the file, so `rejects.toBeInstanceOf(IngestError)` was green
on a decryption failure that had nothing to do with timezones. The key is threaded now and every
refusal is asserted by the message it names. Same tell as a mutation that fails fewer assertions
than it should.
