# 96. The claim named seven platforms and one of them could produce a row

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Published on the home page, verbatim, and read out of the running build rather than from the source:

> **Reads GA4, Google Ads, Loyverse, Meta Ads, Search Console, Shopify and WooCommerce on your own
> credentials.**

`apps/api-edge/src/ingest.ts` refuses every provider but `woocommerce` with `unsupported_provider`,
and `scheduled-ingest.ts` filters the rest out **before they are leased**. `public.ingest_envelope_rows`
is the only write path to `envelope_rows` and `runIngest` is its only caller.

**So a customer could connect their Loyverse till — the till this product is designed around — watch
the connection go healthy, and never receive a single row.** Not from the nightly sweep, and not
from a manual `POST /v1/ingest/run`, which answers 501.

This is the "with value" half of the thing being built, and it was failing in the most expensive
place available: the headline promise on the page somebody buys from.

### 1.1 Every guard passed, and each was doing its job

| Guard | What it asserted | Why it passed |
|---|---|---|
| `check-capabilities.mjs` | every id in `IMPLEMENTED_SOURCE_IDS` has a client and a normaliser exported | **true of all seven** |
| `AVAILABLE_CAPABILITIES` | `source:any` is available | it read `IMPLEMENTED_SOURCE_IDS.length > 0` |
| `brand.test.ts` | the claim text, pinned exactly | it pinned the false sentence |

The capability gate — the machine built specifically to stop a claim outrunning the product — was
satisfied by **a test that something is implemented, licensing a sentence that names seven things.**

**A gate that verifies a proxy for the thing claimed eventually licenses a falsehood.** "Has a
client and a normaliser" is a real property and it is strictly weaker than "a row can arrive", and
nobody chose the gap: the proxy was accurate when it was written and the ingest path grew a
restriction the gate could not see.

### 1.2 The fix is that the claim reads the right list

`INGESTABLE_SOURCE_IDS` is the set `runIngest` will dispatch. `connectorClaim` is built from it and
`source:any` is derived from it, so the published sentence is now:

> **Reads WooCommerce on your own credentials.**

**That is a large, visible reduction of the home page and it is what is true.** It is also
self-correcting in the direction that matters: wiring a backfill widens the claim by itself, on the
same commit, with no copy to remember.

`check-ingestable.mjs` holds `INGESTABLE_SOURCE_IDS` against the Worker's actual dispatch **in both
directions**, so the claim cannot be widened by editing the brand package — and a source the Worker
starts dispatching that the claim withholds also fails, because a product quietly doing more than it
says is the same defect pointed the other way.

### 1.3 Four backfills are written, tested, exported — and wired to nothing

This is the part that turns a disappointing finding into an actionable one.

| Connector | `backfill.ts` | Dispatched |
|---|---|---|
| WooCommerce | yes | **yes** |
| GA4 | **yes** | no |
| Loyverse | **yes** | no |
| Meta Ads | **yes** | no |
| Search Console | **yes** | no |
| Google Ads | no | no |
| Shopify | no | no |

`ingest.ts`'s refusal carried this reason: *"four of the five connectors have no `backfill.ts` yet,
so a map would be four entries pointing at nothing"*. **True when written. Four of them now have
exactly that**, each exported from `@repo/connectors` with its own test file.

The same shape as the sub-processor comment that said OpenRouter had no caller, and as `AGENTS.md`
item 6 saying there was no rights path: **correct when written, falsified by a later commit,
attached to nothing that could notice.** Third instance this session, which is why the replacement
is a checked boolean rather than better prose — `DEFERRED_SOURCE_IDS[].backfill` is verified against
the filesystem, so the day somebody writes the fifth backfill the build goes red.

What is actually missing is the **dispatch**, not the backfills. Each takes source-specific options
— a store URL and consumer key, a till token, a GA4 property and report definition, a Meta ad
account and report definition — and resolving those from a connection row is the work. It is a
feature, and it is the one that decides whether this product delivers anything to a customer who is
not on WooCommerce. **Issue, not this PR.**

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. No ingest behaviour changes: the Worker dispatches exactly what it
dispatched before. What changes is what the site says about it, and one guard script in CI.

The **commercial** cost is real and is not mine to price: the home page's source claim goes from
seven platforms to one. That is a reduction in what is advertised and not a reduction in what is
delivered, because what is delivered was already one.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `PASS` — untouched; every dispatch still opens a per-workspace credential. &nbsp;
**2. Vendor-key exception.** > `N/A`. &nbsp; **3. No token pass-through.** > `N/A`. &nbsp;
**4. Credential hygiene.** > `N/A` — no credential in the diff.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `N/A` — no request path
changes. &nbsp; **7. No cross-workspace read.** > `N/A`. &nbsp; **8. No cross-customer
aggregation.** > `N/A`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > `N/A` — nothing moves. &nbsp; **11. Meta client list.**
> `N/A` — no Meta onboarding path is touched; the Meta *connector* remains built and remains
undispatched. &nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A`. &nbsp; **14. Forbidden payloads.** > `N/A`. &nbsp;
**15. Per-destination consent.** > `N/A`.

### Access tier and quota
**16. Tier reality.** > **`PASS`, and this change improves it.** Gate 16 is about fitting the tier
actually held. A claim to read six platforms whose ingest is not wired is the same error one level
up: advertising a capacity the deployment does not have. &nbsp; **17. No new long-lead dependency.**
> `PASS` — nothing new is depended on; this removes a claim rather than adding a requirement.

### Claims
**18. Claim provenance.** > **`FAIL` before this change, `PASS` after, and that is the entry.** The
gate asks whether every user-visible claim comes from the allowed-claims list **and is true today**.
It came from the list. It was not true. Six of the seven platforms it named could not deliver a row.
The claim is now derived from what the Worker dispatches, and `check-ingestable.mjs` makes the
derivation binding rather than conventional.

**Result:** `5 PASS, 13 N/A, 0 FAIL` — with gate 18 recorded as **failing before this change**,
because a platform-terms block that only ever reports the post-change state is a form that cannot
find anything.

## 4. What was left out

- **Wiring the four written backfills.** The feature this finding is really about, and the one that
  makes the claim widen. Each needs source-specific options resolved from a connection row, and
  doing it hurriedly in the path that writes the numbers the product is about is precisely where
  CLAUDE.md's one rule bites. **Issue.**
- **Google Ads and Shopify backfills.** Not written at all. Separate work again.
- **`/integrations` and the six connector pages.** They describe what each connector reads, which is
  true of the connector. Whether a page describing an undispatched connector needs the same
  qualification the claim now carries is a real question and a different surface. Named in §5.
- **A second claim distinguishing "connects" from "reads".** Defensible — all seven genuinely
  connect — and it is a new claim id needing a specification citation, which is a product decision
  rather than a correction. Raised in the issue.
- **`IMPLEMENTED_SOURCE_IDS`' other consumers.** The sample-card provenance chips and the segment
  pages read it, and it still means what it always meant: a connector exists. Left alone
  deliberately; narrowing it would have changed four surfaces on one argument.

## 5. Open or unverified spec items this builds on

- **`/integrations` is unreviewed against this.** Its registry summary is "The platforms this
  product can read, and what it reads from each." That sentence is now in tension with the claim,
  and this change sharpens the tension rather than creating it. It builds no copy through `claim()`,
  so no gate caught it and none would have.
- **Whether "reads" was the wrong word all along.** A defensible reading is that the claim described
  the connectors' capability rather than the pipeline's. Stated so it can be disagreed with: the
  reading taken here is a customer's — "reads Loyverse" means their Loyverse data shows up — and on
  that reading the sentence was false for six platforms.
- **`INGEST_SOURCE` is a single string and this guard reads it as one.** It also accepts an
  `INGEST_SOURCES` array for the day there is more than one. If the dispatch becomes a map or a
  registry lookup, the guard needs updating and will fail loudly rather than silently, because it
  refuses to pass when it cannot parse.
- **No end-to-end test exists** from a sealed connection through to a written envelope row, for any
  connector including WooCommerce. Nothing in this change alters that, and it is why "WooCommerce
  works" is stated here as "the Worker dispatches it" rather than as a claim about a live pull.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all thirteen check-*.mjs  = 0
```

The false claim was read out of the **running build** before the change and the true one after,
by asserting the value into a test failure rather than by reading the source:

```
before:  "Reads GA4, Google Ads, Loyverse, Meta Ads, Search Console, Shopify and WooCommerce
          on your own credentials."
after:   "Reads WooCommerce on your own credentials."
```

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| Add `loyverse` to `INGESTABLE_SOURCE_IDS` without wiring dispatch | *names "loyverse" and runIngest does not dispatch to it. The home page would claim to read a platform from which no row can arrive* |
| Record `loyverse` as having no backfill | *is recorded as having no backfill and packages/connectors/src/sources/loyverse/backfill.ts exists* — **the exact drift that shipped**, now caught |
| Remove `shopify` from both lists | *is an implemented connector and is neither ingestable nor deferred* |
| Point `INGEST_SOURCE` at `loyverse` | **two**: the claim now names a source the Worker will not dispatch, **and** the Worker dispatches one the claim withholds |

The fourth is the one worth reading. Both halves fail, which is the point of checking both
directions: a product that quietly reads more than it says is not the safe direction of the same
mistake, it is a different disclosure defect with the arrow reversed.
