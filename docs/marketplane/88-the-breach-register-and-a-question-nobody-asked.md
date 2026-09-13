# 88. The breach register, and a question nobody asked

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Two of the four items still listed as blocking. Both turned out to be buildable, one of them for the
same reason Art. 28(3)(d) did: **the thing recorded as blocked was a framing, not a dependency.**

### 1.1 The breach register — Art. 33(5), PDPA s.37(4)

`security_events` records acts this application performs. It is the raw material an incident
assessment reads, and it is **not a breach record**: it has no notion of who was affected, what the
likely consequences are, or whether anybody was told. Art. 33(5) asks for something else —
*"the controller shall document any personal data breaches, comprising the facts relating to the
personal data breach, its effects and the remedial action taken"* — and says that documentation must
let a supervisory authority verify compliance. A trail of events does not do that.

`public.breach_records` is that documentation, and three decisions in it are the whole unit.

**Seventy-two hours is encodable precisely because it is not invented.**
`app.data_request_deadline()` returns `NULL` on the rule that a statutory period nobody established
must not be written down as though it were one. This is the other case: **Art. 33(1) says "not later
than 72 hours after having become aware of it"**, and **PDPA s.37(4) sets the same 72 hours** to the
PDPC. The period is in both statutes, so encoding it records a fact rather than guessing one. The
distinction between those two functions is the entire rule, which is why they sit one migration
apart and say so in their own comments.

**The deadline binds one role and not the other.** This company is controller of its own account
records and **processor** of the platform data it reads for a customer — the split
`PROCESSING_ACTIVITIES` already draws. Art. 33(1)'s clock binds a *controller*. A processor's duty is
Art. 33(2), *"without undue delay"*, with no period named. So the function returns a timestamp for a
controller breach and `NULL` for a processor one, and **`NULL` means no fixed statutory deadline,
never no obligation.** A single countdown against every row would show a processor breach a deadline
the law does not set — to whoever is handling an incident, at the worst possible moment to be handed
a wrong number.

**Incomplete records are lawful and must stay writable.** Art. 33(4) is explicit that information
"may be provided in phases". So the Art. 33(3) fields are nullable and no CHECK demands them. A
constraint requiring a complete record would make the register unusable in the first hours of an
incident — exactly when it must be started — and would push whoever is handling it into inventing
values to make the insert succeed. `app.breach_record_gaps` reports what is missing instead, so a
record can be honest about being partial rather than either false or absent. **What must not exist
is a partial record that looks complete.**

And the counts are nullable integers where `NULL` is not zero. Art. 33(3)(a) asks for approximate
numbers; before those are established the answer is unknown, and `0` would report a breach affecting
nobody — this repository's founding example, in the one document a regulator reads after an
incident. The suite asserts a recorded zero and an unknown are distinguishable.

### 1.2 The DPO determination — assessed rather than left undecided

`brand.dataProtectionOfficer` is `null` and every document said the question "has not been
determined". **"Undecided" is the status this repository has already learned not to trust.**
`AGENTS.md` said GDPR applicability was open while the pricing table quoted euros (note 85), and
Art. 28(3)(d) sat recorded as blocked on DNS because nobody re-read the Article (note 87 → the
commit after it). An open question is the one kind of statement nobody audits.

Both statutes require an officer in three cases and not otherwise, and all three are assessable
against the record of processing:

| Limb | Finding |
|---|---|
| **(a)** public authority — Art. 37(1)(a), PDPA s.41(1) | Not engaged. A Thai private limited company performing no public function |
| **(b)** regular and systematic **monitoring of data subjects** on a large scale — Art. 37(1)(b), PDPA s.41(2) | **The one this product looks like it might meet.** Reading a business's platform metrics nightly *is* regular and systematic — but the limb is monitoring of *data subjects*. Spend, revenue, impressions and clicks are measurements of a business, and `envelope_rows` carries no buyer identifier: `normalize.ts` emits none. Monitoring a company's numbers is not monitoring the people behind them, and **the nightly cadence is what makes the confusion available** |
| **(c)** special categories on a large scale — Art. 37(1)(c), PDPA s.41(3) | Not engaged. Scanned, not remembered: thirteen markers drawn from Art. 9, Art. 10 and s.26, applied to every activity's purpose, subjects and categories |

**The finding is "no limb is engaged", which is not the same claim as "no DPO is required."** The
first is about the record; the second is a legal opinion. The module is named for the limbs
(`engagedLimbs()`), not the conclusion, for that reason — and `brand.dataProtectionOfficer` stays
`null` with no contact printed anywhere, because printing one nobody staffs is worse than printing
none.

**The scale caveat travels with the finding**, in the module and in the test. Both (b) and (c) turn
on *large scale* and this service has no customers. A limb unengaged because there is nothing to
engage it is not a limb that will stay unengaged, and a reviewer reading the finding without that
sentence would be reading a conclusion about an empty database as a conclusion about the business.

**It re-opens itself.** If an activity ever records a special category, the limb flips and the build
fails until the assessment and `AGENTS.md` are rewritten. Mutation-proven below by adding "health
status" to one activity's subjects — the record of processing is where such a column arrives first,
because `activities.test.ts` fails if a table lands without an entry.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. One table with no tenant column that no customer path reads or writes, two
pure SQL functions, one build-time TypeScript module. No query on any request path, no upstream
call, no scheduler work; the polling ratio section 8 names as the margin risk is untouched.

`breach_records` consumes Supabase disk — the line section 7 names as most likely to break — at a
rate bounded by how often this company has a breach, which is not a volume term.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call.

**2. Vendor-key exception.** > `N/A` — no company-held key.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface.

**4. Credential hygiene.** > `PASS` — no credential in the diff. The suite's fixture *describes* an
exposed credential as the nature of a breach and quotes no value.

### Tenancy

**5. RLS.** > `PASS` — `breach_records` carries **FORCE** row level security, not merely ENABLE, and
**no policy for any command**, which denies it to every role RLS applies to. Asserted in
`24_breach_register.sql` from the roles themselves and again by `15_force_rls.sql`, which reads the
catalogue. **Mutation-proven:** removing the FORCE line fails `15_force_rls.sql`.

**6. No service-role bypass.** > `PASS`, and it is the deliberate design rather than an exception.
There is no tenant path to this table at all: it is company regulatory documentation reached by
`service_role`, which RLS does not apply to — the shape `waitlist` uses. **No permissive policy was
added to make a writer work**, which is the rule `15_force_rls.sql` demonstrates.

**7. No cross-workspace read.** > `PASS` — the table has no tenant column by design. A breach
register keyed per workspace would be the wrong artefact: the obligation is the company's.

**8. No cross-customer aggregation.** > `PASS` — nothing aggregated.

**9. API key scope.** > `N/A` — untouched.

### Data movement

**10. No resale or redistribution.** > `PASS` — nothing leaves. A customer learns about a breach
from the notification, not by reading the register.

**11. Meta client list.** > `N/A` — untouched.

**12. Dependency licences.** > `PASS` — none added.

### PII and consent

**13. Hash at the edge.** > `PASS` for the ingest boundary, which is untouched — **and the honest
answer for this table is different and is recorded in the record of processing.** Free text written
during an incident may name a person, and `redaction.ts` removes identifiers *by key* without
inspecting values. So `breach_records` is listed as an activity holding personal data rather than
under `NO_PERSONAL_DATA`, on the column types rather than on optimism.

**14. Forbidden payloads.** > `N/A` — no egress path.

**15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request.

**17. No new long-lead dependency.** > `PASS` — nothing added.

### Claims

**18. Claim provenance.** > `PASS` — no user-visible claim. Nothing here renders to a visitor, the
`audit-log` claim stays withheld, and the DPO finding is deliberately phrased as "no limb engaged"
rather than "no DPO required", with the scale caveat attached. `brand.dataProtectionOfficer` stays
`null`.

**Result:** `10 PASS, 8 N/A, 0 FAIL`

## 4. What was left out

- **A notification path.** The register documents; it does not send. Art. 33(1) notification to a
  supervisory authority and Art. 34 communication to data subjects both need a recipient, a channel
  and a decision about who acts at 3am. **The register is the part that has to exist first** — you
  cannot notify from facts nobody wrote down — but this note does not claim the obligation is met.
- **A UI for the register.** Written through `service_role` by whoever is handling an incident. A
  screen is worth building when there is a team; a table with a gaps function is worth having today.
- **Retention for `breach_records`.** None set, recorded as unset. It genuinely matters here — the
  record exists to be producible to a regulator, and how long after an incident that stays true is a
  decision nobody has taken.
- **Art. 46 transfer instrument.** The remaining one, and still not started. See §5.
- **Art. 27 representative.** Unchanged: a written designation of a third party.

## 5. Open or unverified spec items this builds on

- **The 72 hours is quoted from Art. 33(1) and PDPA s.37(4).** Both are checked into the comment
  that encodes it. What is *not* established here is Thailand's implementing detail — whether the
  PDPC's own notification form or channel imposes anything further. Recorded as unchecked rather
  than assumed absent.
- **The DPO finding is mine, not counsel's.** Particularly limb (b): "monitoring of data subjects"
  is a phrase with EDPB guidance behind it that this assessment does not cite. The distinction drawn
  — business metrics rather than individuals — is sound on the face of the Article and on
  `envelope_rows` carrying no buyer identifier, and it is the kind of line a regulator could draw
  differently.
- **"Large scale" is undefined in both statutes and unmeasurable at zero customers.** The caveat is
  in the module and in the test rather than in a note, because a note is the part that gets skipped.
- **Whether a processor breach has any deadline at all** is stated as Art. 33(2)'s "without undue
  delay". The agreement separately commits to notifying the customer without undue delay, so the
  `NULL` is not a gap in the commitment — only in the statute's arithmetic.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm exec biome lint .          = 0
pnpm exec biome format .        = 0
pnpm -r typecheck               = 0
pnpm -r test                    = 0
pnpm -r build                   = 0     (both apps)

all nine check-*.mjs guards     = 0

./supabase/tests/run-local.sh   = 0     (24 suites, 738 assertions, 0 failed)
```

`24_breach_register.sql` contributes 27 assertions and requires at least 22 to have run.

### Mutations, each proven and reverted

| Mutation | Named guard that went red |
|---|---|
| Give a **processor** breach the 72-hour deadline (`when p_role = 'processor'`) | `a controller breach gets 72 hours from awareness`, `a processor breach gets NO deadline, because none is set in law`, `the clock runs from awareness rather than from now()` |
| `enable row level security` without `force` | `15_force_rls.sql` — *public.breach_records has row-level security FORCED, not merely enabled* |
| Revoke naming only `anon, authenticated`, omitting `public` | `anon cannot execute app.breach_record_gaps`, `authenticated cannot execute app.breach_record_gaps` |
| Add "health status" to one activity's data subjects | `finds no limb engaged on the record as it stands` and `flips the special-category limb if the record ever names one` |
| Mark the monitoring limb `triggered: true` | `finds no limb engaged` and `distinguishes monitoring a business from monitoring the people behind it` |

### A mutation I got wrong, and what it cost

The first attempt at the deadline mutation deleted the controller branch, leaving
`case … else … end` with **no `when`**. That is a syntax error, so `create or replace function`
failed and the suite failed for a reason that had nothing to do with the behaviour under test.

I nearly recorded it as a pass, because my grep for failures matched `FAIL` and
`assertion(s) failed` and the output said `ERROR: function … does not exist`. **A mutation that
breaks compilation proves nothing** — it tests that broken SQL is rejected, which was never in doubt.
Redone by inverting the roles, which is valid SQL, and three assertions went red.

The tell was that the mutation produced *no matching output at all*. Earlier in this branch the same
shape appeared twice — an edit whose anchor did not match, reported as green. **Silence from a
mutation is not a passing guard; it is an unfinished experiment.**

## 7. What the record-of-processing guard did on arrival

`activities.test.ts` failed the moment the migration landed:

```
these tables exist and no processing activity accounts for them,
so the s.39 record is incomplete: breach_records
```

Third or fourth time this session a guard has caught a table on arrival rather than in review, and
the outcome is a `breach-documentation` activity classified as **holding personal data** rather than
listed under `NO_PERSONAL_DATA` — because the free text written during an incident may name someone,
and `redaction.ts` is explicit that it removes by key without inspecting values. The guard did not
just demand an entry; it forced the judgement about what kind of entry, at the point where the
answer was still cheap.
