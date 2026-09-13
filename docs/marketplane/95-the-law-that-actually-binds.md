# 95. The transfer work was done for the law that might apply

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`scc-annexes.ts` generates Annexes I.B, II and III of the Commission's Standard Contractual Clauses.
It is careful work, and a test stops preparing annexes being mistaken for entering the Clauses.

**It is the GDPR instrument, and the GDPR's application to this entity is undecided.** Art. 3(2)
turns on counsel and is item 3 on the founder list. Meanwhile PDPA s.5 binds a controller *located
in the Kingdom*, `brand.legalEntity` is a Thai juristic person, and that settles it with no test to
fail and no decision to take.

So the cross-border work existed for the law that might apply and not for the one that does.
CLAUDE.md names that inversion in as many words — *"every data-protection field in `brand.ts` was
GDPR-shaped while the law that actually binds is the PDPA"* — and `AGENTS.md` ranks it second on its
own PDPA list: **"s.28 — every byte crosses a border with no mechanism."**

`transfer-basis.ts` scores all six s.28 exceptions and both s.29 routes against the record,
generated from `SUB_PROCESSORS`, and `/processing` publishes it. **No basis is claimed, because none
is held.**

### 1.1 Three findings that came out of generating it rather than writing it

**Four of the five recipients carry `location: null`, so s.28's question cannot be reached for
them.** Adequacy is a property of a *named country*; the sub-processor field's own rule is that a
location is stated "only where the repository actually knows", and for four providers it does not.
That is a different and more honest answer than "no adequacy finding" — it is that the assessment
cannot begin. Nobody writing this by hand would have produced it, because a hand-written version
would have opened with "no adequacy decision covers these transfers" and moved on.

**Whether the Committee has published an adequacy list could not be established.** One secondary
source says no list has been published; another says only that the Committee *may* establish one.
Neither is the Committee. `ADEQUACY_LIST_STATE` is `"unverified"` and the page says so, because
CLAUDE.md's rule is that *"I could not find documentation" is a finding* — and here the two possible
findings differ materially: **"no list exists" closes a route; "we did not find one" leaves it open
and unexamined.** A boolean would have forced a guess, which is why the type has three states.

**`/privacy` was drifting into asserting a limb.** Its transfers clause opened *"Those transfers are
**necessary** to provide the service a customer has asked for"*. To a lawyer that reads as the
contractual-necessity limb of s.28 being asserted — and `transfer-basis.ts` records that limb as
**open, needing counsel**. The factual half survives ("those transfers happen in every configuration
of this product"); the word that carried the claim is gone, and the clause now names the PDPA
position rather than only the GDPR one.

### 1.2 The limbs are scored, and two are refused

`representative-requirement.ts` set the precedent: score what the record can answer, and **refuse
what it cannot** rather than filling it in. A limb marked *undetermined* is a claim about what is
known; a limb marked *not engaged* is a claim about the system. They are not interchangeable.

| Limb | State | Why |
|---|---|---|
| compliance with law | not engaged | no transfer here is compelled; each is a choice about where the service runs |
| **informed consent** | **not engaged — deliberately not claimed** | the limb a company under pressure reaches for. No screen tells anyone a destination is inadequate, and for the processor activities the data subjects are the customer's. **A consent nobody was asked for is not a basis** |
| **contract with the data subject** | **open — counsel** | the one that plausibly carries, and not this repository's to decide |
| contract in the subject's interest | open — counsel | the same question one step removed |
| vital interests | not engaged | this product reports on trading figures |
| substantial public interest | not engaged | claiming one would be the least defensible sentence on the page |
| **s.29 BCRs** | not engaged, twice | there is no group to bind, *and* the route needs the Committee's approval before use |
| **s.29 appropriate safeguards** | not engaged | **preparing an annex is not entering the Clauses**, and whether the EU Clauses would satisfy the Committee's notification does not arise until they are signed |

### 1.3 A dated fact, checked rather than recalled

The two PDPC notifications — on adequate destinations (s.28) and appropriate safeguards (s.29) —
were published 25 December 2023 and **took effect 24 March 2024**. That date is in a constant with a
test on it, and it was verified against published legal commentary rather than written from memory,
because an invented statutory deadline is a failure mode this repository has actually suffered.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. One assessment module and one statically-rendered section on a page that
already renders the record of processing. No migration, no query, no upstream call.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A`. &nbsp;
**3. No token pass-through.** > `N/A`. &nbsp; **4. Credential hygiene.** > `N/A` — no credential in
the diff.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `N/A`. &nbsp;
**7. No cross-workspace read.** > `PASS` — build-time constants; no tenant row is read. &nbsp;
**8. No cross-customer aggregation.** > `N/A`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > **`PASS`, and it is the gate this unit is about.** Nothing
new moves. What changes is that the transfers which already happen are assessed against the statute
that governs them and published, rather than described only against a statute that may not apply.
&nbsp; **11. Meta client list.** > `N/A`. &nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path. &nbsp; **14. Forbidden payloads.** > `N/A`.
&nbsp; **15. Per-destination consent.** > **`N/A`, and worth distinguishing.** This gate is about
Google `ad_user_data` / Meta `data_processing_options` on outbound audience records, which do not
exist here. The s.28 *consent* limb assessed above is a different consent entirely, and it is
recorded as **not claimed** rather than satisfied.

### Access tier and quota
**16. Tier reality.** > `N/A`. &nbsp; **17. No new long-lead dependency.** > `PASS` — entering an
instrument is a founder-and-counsel task and nothing here waits on it; the page is correct either
way and goes red when it changes.

### Claims
**18. Claim provenance.** > **`PASS`, and the unit is mostly an exercise in this gate.** Every
sentence published is either read from the record or declared absent. No claim id is added, nothing
asserts compliance, and the strongest sentence on the new section is *"No s.28 or s.29 basis is
established for any of these transfers."* Two limbs that could have been marked satisfied are marked
open instead, and a test asserts they stay that way — so a later change cannot quietly convert an
open question into a published basis.

**Result:** `5 PASS, 13 N/A, 0 FAIL`

## 4. What was left out

- **Entering any instrument.** Counsel and the founder. What this adds is that the absence is now
  assessed route by route and published, and that a test goes red the day a basis is recorded — so
  entering one is a deliberate change carrying its own evidence.
- **A view on whether the EU Clauses satisfy the Thai notification.** Genuinely open and not
  reachable from here. It does not arise until the Clauses are signed, which is §5's point.
- **Consent flows for the s.28 consent limb.** Buildable and the wrong thing to build: consent under
  that limb requires telling a data subject the destination's standards are inadequate, and for the
  processor activities they are not our data subjects to ask.
- **Retention, still.** Unchanged and still the founder's: `activities.ts` reports no period for
  most activities and says so.
- **The Art. 27 / SCC / counsel items.** Unchanged, unchanged and unchanged. This does not move any
  of them and does not pretend to.

## 5. Open or unverified spec items this builds on

- **The adequacy-list question is open**, and it is the load-bearing one. If a list exists and
  Singapore is on it, the Supabase transfer may already be carried and the position changes for the
  one recipient whose destination is known. `ADEQUACY_LIST_STATE` exists so that answer has a place
  to land.
- **The statutory limbs are taken from published summaries of s.28**, not from the Act's official
  English text, which was not obtained. The six are consistent across the sources checked; the
  wording here paraphrases rather than quotes, and is marked as a test rather than a citation.
- **Whether the contractual limbs carry is exactly the open question**, and this unit's whole
  discipline is not answering it. If counsel says they do, most of these transfers have a basis and
  the page changes to say so. If counsel says they do not, the safeguard route is the only one and
  the SCC annexes become urgent rather than prepared.
- **Four destinations are unknown**, which is a fact about the disclosure rather than about the
  providers. Establishing where Cloudflare, Vercel and Stripe actually process this data is a
  founder-and-vendor task, and it is a precondition for the adequacy route ever being assessable.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all twelve check-*.mjs    = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
```

### Mutations, each proven and reverted

| Mutation | Named tests that went red |
|---|---|
| Mark the contractual limb `engaged` | **two**: `claims no basis, because none is held` and `does not decide the limbs that turn on a legal determination` |
| `ADEQUACY_LIST_STATE = "none-published"` | `keeps the adequacy-list question unknown rather than answered` |
| Mark the s.29 safeguards limb `engaged`, reading prepared annexes as an entered instrument | **two**: `claims no basis` and `does not treat prepared annexes as an entered instrument` |
| `const reachable = true`, so a recipient with no stated destination reports an assessable one | `does not report adequacy for a destination it has not identified` |

The first is the one that matters. **Marking a limb satisfied is the single easiest edit in this
module and the only one with a consequence** — it is one word, it makes the page read better, and it
converts an open legal question into a published assertion that a customer's counsel would rely on.
It fails twice.

The third is the same error the SCC annex work nearly shipped, one level up: note 89 records reading
a *non-null* retention field as a *stated* one. Here it would be reading prepared paperwork as a
signed instrument, in the document a reviewer opens first.
