# 89. The last sentence nobody checked

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Two units: the **SCC annexes**, generated from the record, and the **Art. 27(2) assessment** that
settles whether a representative in the Union is required at all.

*(Correction: the commit shipping the annexes says they are recorded in note 88. They are recorded
here — 88 covers the breach register and the DPO assessment. The commit message is wrong and the
note it names does not contain them.)*

### 1.1 The SCC annexes — the half that is ours

The standard route for a controller in the Union sending data to a processor outside it is the
Commission's SCCs, Module Two. Nobody has entered them, and **Art. 30(1)(e) still reports `absent`**
— a test asserts it, so preparing annexes cannot be mistaken for entering Clauses.

The SCCs are two things bolted together. The **operative Clauses** are the Commission's own text,
adopted unchanged: that is a signature, and they are deliberately not reproduced, because a version
typed from memory would be a legal instrument with errors in it — worse than not having one. The
**annexes** are the parties' description of this specific service, and they are what a customer's
counsel actually sends back marked.

In every company that has done this, the annexes are a Word document filled in once and never
reopened — a description of a system that keeps changing. Annex I.B lists categories of data;
Annex II lists security measures; Annex III lists sub-processors. All three already exist here,
generated and guarded, so the annexes are generated from them. **An annex that disagrees with the
record of processing is a signed statement that disagrees with the record of processing.**

Two sections are deliberately not filled in. **I.A**'s exporter half is the customer — a placeholder
would produce an annex that looks complete and names nobody. **I.C** is the competent supervisory
authority, which Clause 13 puts in the *exporter's* Member State; naming Thailand's PDPC there would
be filled in, plausible and wrong.

#### A state I derived wrongly

The retention section read `state: retention !== null ? "generated" : "absent"`. `platform-data`'s
retention field is **not null** — it holds the sentence *"None operates. A 30-day period is declared
in code for restatement events and does not run."*

A field filled in with a statement that nothing operates is not a retention period. **Inferring
"stated" from "non-null" is the `?? 0` mistake one level up** — presence of a value read as presence
of a fact — and it would have reported that section complete **in a signed document**. The test
expecting `absent` caught it.

### 1.2 The Art. 27(2) assessment — the exemption nobody had read

Every document in this repository said a representative in the Union was outstanding, and each
treated it as obvious: Art. 3(2) is engaged, the controller is outside the Union, therefore
Art. 27(1) bites. **That skips Art. 27(2), which decides whether Art. 27(1) applies at all.**

The pattern is familiar enough by now to name. `AGENTS.md` said GDPR applicability was open while
the pricing table quoted euros (85). Art. 28(3)(d) sat blocked on DNS because *inform* was read as
*send* (87→88). The DPO question sat undecided when all three limbs were assessable (88). **Each
time the obstacle was a framing carried forward without being re-read**, and each time it had been
written down confidently enough that nobody re-opened it. *"A representative is required"* is the
same kind of sentence: true or false, never checked.

| Art. 27(2) limb | Finding |
|---|---|
| **(a)i** the processing is **occasional** | **Not satisfied — and this is what closes the exemption.** A nightly read of a customer's connected accounts for the duration of their subscription is the opposite of occasional, and it is that *by design*: "every morning" is what the product is sold as doing |
| **(a)ii** no large-scale special categories or Art. 10 data | **Satisfied.** Taken from the same scan the DPO assessment runs |
| **(a)iii** unlikely to result in a risk | **Not satisfied — and deliberately not claimed.** A controller asserting its own processing is low-risk is the least reliable sentence in data protection, and this one holds sealed credentials reaching a customer's advertising accounts. Nothing turns on it, which is exactly why claiming it would be taking a position for no benefit |
| **(b)** public authority | Not satisfied. A Thai private limited company performing no public function |

(a) is **conjunctive**, so one satisfied limb rescues nothing — and recording that (a)ii *does* point
towards the exemption is the difference between an assessment and an argument. A scoring that only
ever found against the company would be no more trustworthy than one that only ever found for it.

**The finding: the exemption is not available, so Art. 27(1) stands. A representative is
required.** The conclusion matches what everyone assumed — which is the outcome an assessment is
least likely to be built for and most useful in, because an assumption that turns out right is
indistinguishable from one that turns out wrong until somebody checks.

#### Why build it when the answer was already believed

Because it converts *"we should probably get a representative"* into a finding with the limb, the
evidence and the reason attached. **The founder is being asked to engage a third party and pay them
a recurring fee.** That request is worth a page saying exactly why, which limb closes the exemption,
and what would have to change for it not to — rather than a line on a gap list everyone has stopped
reading.

`DESIGNATION_REQUIREMENTS` states the engagement as a specification: established in a Member State
where the data subjects are (Art. 27(3)); designated **in writing** (Art. 27(1)); mandated to be
addressed by supervisory authorities and data subjects on all issues (Art. 27(4)); named in the
privacy notice; and able to maintain the Art. 30(1) record — **which already exists, generated**, so
that requirement is met the day the representative is engaged rather than being work that follows.

**No mandate is drafted.** Art. 27(4)'s mandate is a contract with a named third party, and there is
no party to name. Drafting terms for one would produce a document that reads as ready to sign and
binds nobody — the same failure as an annex with a placeholder in the parties box, and a test bans
the drafting phrasings.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. Two build-time modules read only by tests. No route, query, table,
upstream call or scheduler work.

**The cost this unit's finding creates is real and is not a COGS line:** an Art. 27 representative
is a recurring third-party fee, and this assessment is what establishes that it is owed rather than
optional. Nothing in section 7's table prices it, and it is larger than most lines that are there.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A` — no
company-held key. &nbsp; **3. No token pass-through.** > `N/A` — no MCP or OAuth surface.
&nbsp; **4. Credential hygiene.** > `PASS` — no credential in the diff; the risk limb *describes*
sealed credentials and quotes no value.

### Tenancy
**5. RLS.** > `N/A` — no migration, table or policy. &nbsp; **6. No service-role bypass.** > `N/A` —
no request path. &nbsp; **7. No cross-workspace read.** > `PASS` — build-time constants only; no
query. &nbsp; **8. No cross-customer aggregation.** > `PASS` — nothing aggregated.
&nbsp; **9. API key scope.** > `N/A` — untouched.

### Data movement
**10. No resale or redistribution.** > `PASS` — nothing moves; the annexes *describe* a transfer
that a signature would authorise. &nbsp; **11. Meta client list.** > `N/A`.
&nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path. &nbsp; **14. Forbidden payloads.** > `N/A` — no
egress. &nbsp; **15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota
**16. Tier reality.** > `N/A` — no upstream request.
**17. No new long-lead dependency.** > **`PASS`, and the gate reads against itself again.** This adds
none and *establishes* that one already owed is genuinely owed: an Art. 27 representative, with the
limb that closes the exemption recorded. That is the inverse of what this gate usually catches, and
the reason it is written down rather than assumed.

### Claims
**18. Claim provenance.** > `PASS` — nothing renders to a visitor. The `gdpr` and `dpa` claims stay
withheld on `euRepresentative`, Art. 30(1)(a) goes on reporting `NONE DESIGNATED`, and a test
asserts it — **the assessment strengthens the request rather than answering it**, and cannot be
mistaken for having answered it.

**Result:** `9 PASS, 9 N/A, 0 FAIL`

## 4. What was left out

- **The designation itself.** Art. 27(1) needs a named legal person in the Union who agrees to be
  addressed by supervisory authorities and data subjects. There is no artefact that substitutes for
  someone agreeing. **This is the one remaining item**, and it is now specified rather than vague.
- **A draft mandate.** Argued above; a test bans the phrasings.
- **Entering the SCCs.** A signature, with the Commission's own text.
- **Rendering either module.** Consistent with the Art. 30 record and the Art. 28 mapping: these are
  artefacts for a reviewer who asks and for a founder deciding, not pages for the site. Publishing
  an unentered instrument's annexes would advertise readiness the company does not have.
- **Art. 3(2)(b) monitoring assessment.** Named in 85, still not done, still honest to say so.

## 5. Open or unverified spec items this builds on

- **The exemption reading is mine, not counsel's.** "Occasional" has EDPB guidance behind it that
  this assessment does not cite. The reading — a standing nightly schedule is not occasional — is
  about as safe as such a reading gets, and it is still a reading.
- **The risk limb is scored `false` for absence of evidence, not presence of risk.** That is stated
  in the module. It would be wrong to quote this assessment as a finding that the processing *is*
  high-risk; it is a finding that low risk was not established and was not claimed.
- **Art. 27(3)'s Member State depends on where the customers are**, which is a commercial fact this
  repository does not hold and cannot derive. The specification says so rather than guessing one.
- **Whether Art. 3(2) is engaged remains counsel's** (issue #74). Everything here is downstream of
  it: if Art. 3(2) is not engaged, Art. 27 never applies and this assessment is moot rather than
  wrong. `representativeRequired()` reads `targetingSignals()` for exactly that reason, so the chain
  breaks at the right link rather than silently concluding.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all nine check-*.mjs      = 0
```

SQL unaffected (no migration); green on the preceding commit — 24 suites, 738 assertions, 0 failed.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Name the PDPC as the competent authority in Annex I.C | `leaves the exporter and the supervisory authority to the customer`, `does not name this company's own regulator as the competent authority` |
| Delete the sentence saying no Clauses have been entered | `keeps the sentence saying these are annexes and not an instrument` |
| Sweep controller activities into the transfer description | `draws the transfer description from the processor activities` |
| Satisfy all three limbs of Art. 27(2)(a) | `is closed by the occasional limb`, `does not claim its own processing is low-risk`, `records the one limb that does point towards the exemption`, and **`concludes the obligation stands`** |
| Downcase `IN WRITING` in the specification | `states the engagement as a specification rather than an obligation` |

### A mutation that half-landed

The first attempt at the exemption mutation set `occasional: true` and tried to set the risk limb
too; the second anchor did not match, so only one limb flipped. **One test failed and I could have
recorded that as proof of the chain** — it was not. With one limb satisfied the exemption is still
unavailable (a) is conjunctive), so `representativeRequired()` never moved and the chain assertion
never ran.

Redone by flipping all three, at which point four assertions fail including
`concludes the obligation stands`. This is the third time in this branch that a partial or broken
mutation nearly passed for a proof. **The tell is always the same: fewer failures than the mutation
should cause.**
