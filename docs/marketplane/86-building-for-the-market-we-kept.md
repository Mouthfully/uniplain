# 86. Building for the market we kept

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Note 85 found that the site prices in euros with no Art. 27 representative, and put three
resolutions to the founder as issue #74. **The answer was: keep the EU as a market and build the
GDPR work.** This is the first instalment of that.

Two things shipped, and the second is the one that was actually missing from the product rather than
from the paperwork.

### 1.1 An Art. 30(1) record, built on the PDPA one

`activities.ts` is a PDPA s.39 record and a good one — purpose, subjects, categories, basis,
recipients, retention, per activity, generated from the schema. **It is not an Art. 30(1) record**,
because Art. 30(1) asks for three things s.39 does not:

- **(a)** the identity of the controller, its **representative** and its DPO — not a per-activity
  field at all;
- **(e)** transfers to a third country, **the country identified**, and documentation of the Art. 46
  safeguards relied on. `recipients` is a list of names carrying neither;
- **(g)** a general description of the technical and organisational security measures. Nowhere.

A record missing (a), (e) and (g) is the record a reviewer asks for and does not get. Writing a
second one by hand beside the generated one would produce two records that disagree within a month
— the failure this directory has already had twice — so `article-30.ts` **derives** every
sub-paragraph it can from what exists, and for the rest reports **absent, with the reason**.

**(e) is the uncomfortable one, and the reason this is worth generating at all.** From the Union's
standpoint every recipient is in a third country and so is the controller: the database is in
Singapore, the controller in Thailand, neither holding a Commission adequacy decision. Art. 30(1)(e)
then wants the Art. 46 safeguard documented — and there is none. `/privacy` and `/dpa` both say so
in prose. This says it **in a field**, so a reviewer meets the gap where the gap belongs instead of
inferring it from silence.

**(g) is the one that invites adjectives.** "Where possible, a general description…" is an invitation
to write a paragraph of comfortable words. Each measure here names a mechanism — FORCE row level
security, sealed credentials, the append-only trail, the prompt that carries no tenant text, the
model call that denies data collection — and `article-30.test.ts` fails the build if the file a
measure cites does not exist. *"Industry-standard encryption"* would satisfy every reader and no
test, which is exactly why it is not there.

### 1.2 The right to restrict processing, which was missing from the product

`app.data_request_kind` offered five kinds: access, rectification, portability, objection, erasure.
A good list, missing one. **Restriction is a distinct right, not a softer objection:**

- **Objection** (GDPR Art. 21, PDPA s.32) says **stop**. It asks the controller to cease an
  activity, and may be refused on compelling legitimate grounds.
- **Restriction** (GDPR Art. 18, PDPA s.34) says **hold**. Keep the data, stop using it, for the
  interval in which something else is unresolved — while accuracy is contested, while an objection
  is weighed, or where processing is unlawful but the person needs the data kept for a legal claim.

The second is what someone reaches for when they are **about to dispute something**. Offering only
*"stop using my data in a particular way"* and *"delete my data"* asks a person mid-dispute to
choose between abandoning the dispute and destroying the evidence for it. **Erasure is the
irreversible one.** This is not a paperwork gap; it is a form that pushes people towards the door
they cannot come back through.

### 1.3 Why nobody noticed, and the guard that ships with the fix

`REQUEST_KINDS` in `data-requests/_content.ts` is a list of strings under a comment saying *"Keys
match `app.data_request_kind`"* — and **nothing compared them.** That is precisely the arrangement
`check-providers.mjs` exists because of; its header records that `app.connection_provider` and its
TypeScript twin drifted, and that the dangerous direction is a member TypeScript can name and the
column cannot store, which fails on the INSERT in production after the person has finished filling
the form in.

Here the drift ran the quieter way: **neither side named restriction**, so nothing failed and the
missing right was invisible from both files. Worth being honest about — a comparison that had
existed would not have found it either. What found it was reading the enum against the statutes.
What the new comparison prevents is the *next* one, in both directions:

- a kind the form offers and the column cannot store → red;
- a member of the enum the form never offers → red, because **a right nobody can select is a right
  nobody can exercise**.

Both mutation-proven below.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. `article-30.ts` is read at build time by a test and renders to nobody.
The migration is one `alter type … add value`: no table, no column, no index, no row. The form gains
one radio option.

No new query, no upstream call, no scheduler work; the polling ratio section 8 names as the margin
risk is untouched.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call in the diff.

**2. Vendor-key exception.** > `N/A` — no company-held key.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface touched.

**4. Credential hygiene.** > `PASS` — no credential in the diff. `SECURITY_MEASURES` *describes*
credential sealing and names `packages/vault/src/vault.ts`; it quotes no value.

### Tenancy

**5. RLS.** > `PASS` — `data_requests` keeps FORCE row level security and its policies are
untouched. An enum gains a member; the table, its grants and its definer writers do not change.
`supabase/tests/15_force_rls.sql` reads the catalogue and still passes for every table.

**6. No service-role bypass.** > `PASS` — writes still go through `public.file_data_request`, which
is SECURITY DEFINER and `EXECUTE`-able only by `authenticated`. Adding a kind does not add a path.

**7. No cross-workspace read.** > `PASS` — `article-30.ts` reads build-time constants and touches no
tenant row. The request surface is unchanged and still per-organisation.

**8. No cross-customer aggregation.** > `PASS` — the record counts *activities* and names
*providers*; it aggregates no tenant data. Worth checking rather than assuming, because a compliance
record is exactly the sort of artefact that grows a "requests across all workspaces" figure later.

**9. API key scope.** > `N/A` — untouched.

### Data movement

**10. No resale or redistribution.** > `PASS` — nothing moves. The record *discloses* recipients,
which is disclosure of who receives data, not a movement of it.

**11. Meta client list.** > `N/A` — untouched.

**12. Dependency licences.** > `PASS` — none added.

### PII and consent

**13. Hash at the edge.** > `PASS` — no ingest path touched. `subject_note` remains the only
free-text field on a request and remains bounded; nothing new persists.

**14. Forbidden payloads rejected before egress.** > `N/A` — no egress path.

**15. Per-destination consent.** > `N/A` — no record carries a consent object here.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request.

**17. No new long-lead dependency.** > `PASS` — nothing added. The Art. 27 representative remains
the outstanding one, recorded in Art. 30(1)(a) and issue #74.

### Claims

**18. Claim provenance.** > `PASS` — no new user-visible claim, and specifically **no claim that the
Art. 30 obligation is met**. The record reports (a) partial and (e) absent, `unmetSubParagraphs()`
hands a reviewer that list first, and a test asserts the list is non-empty — so the build fails if
someone later marks everything `recorded` without doing the work. The `gdpr` claim stays withheld.

**Result:** `11 PASS, 7 N/A, 0 FAIL`

## 4. What was left out

- **Art. 33–34 breach notification.** The append-only trail an assessment needs exists; the
  notification path does not. A 72-hour clock needs a recipient, a template and a decision about who
  is on the hook at 3am — none of which is code alone. **Issue, not scope creep.**
- **Art. 28(3) clause-by-clause assessment of `/dpa`.** The agreement is a PDPA s.40 instrument. Whether
  its clauses satisfy Art. 28(3)(a)–(h) is a real comparison and deserves its own unit rather than a
  paragraph appended to this one.
- **The Art. 46 transfer instrument.** Cannot be written unilaterally: it means entering the
  providers' own SCC terms and recording which were accepted. Research plus a signature.
- **A published Art. 30 page.** The record is internal. `/processing` publishes the PDPA record
  because a customer needs it; Art. 30(1) records are produced to a supervisory authority on request,
  not published, and publishing (e) as it currently stands would advertise the transfer gap before
  the founder has decided how to close it.
- **Art. 3(2)(b) monitoring assessment.** Still not done; noted in 85 and still true.
- **PDPA s.41 / GDPR Art. 37 DPO determination.** Unchanged and still undecided.

## 5. Open or unverified spec items this builds on

- **This assumes Art. 30 applies**, which follows from Art. 3(2), which counsel has not confirmed.
  If it turns out not to apply, the record is not wasted: it is a superset of the s.39 record that
  *does* bind, and the security-measure description is wanted by every framework on the list.
- **"Every recipient is in a third country" is stated from the Union's standpoint and is not a legal
  conclusion about adequacy.** Neither Thailand nor Singapore holds a Commission adequacy decision
  as far as this repository has established; that was not re-verified against the Commission's
  current list in this unit, and a note that said otherwise would be inventing a check nobody ran.
- **Three of four sub-processor locations are still `null`** — recorded as not established rather
  than guessed. Art. 30(1)(e) wants the country *identified*, so the sub-paragraph cannot become
  `recorded` on a safeguard alone; those locations are part of the same debt.
- **Whether restriction is honoured is not asserted anywhere.** This unit adds the ability to
  *request* it. What the company does on receiving one is an operational commitment, and
  `app.data_request_deadline()` still returns `NULL` because no statutory period has been
  established. **An intake is not a remedy**, and this note does not claim it is.

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

./supabase/tests/run-local.sh   = 0     (23 suites, 702 assertions, 0 failed)
```

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Mark Art. 30(1)(e) `recorded` and assert standard contractual clauses are in place | `reports the transfer sub-paragraph as absent` (*expected 'recorded' to be 'absent'*) and `hands a reviewer the unmet list` |
| Point a security measure at `packages/vault/src/encryption-at-rest.ts`, which does not exist | `cites a file that exists for every piece of evidence` and `backs every security measure with a file that exists` |
| Delete sub-paragraph (e) from the record entirely | `has each sub-paragraph exactly once, in the order the Article numbers them` |
| Add `"compensation"` to `REQUEST_KINDS` | `has no kind the column cannot hold` — *the form offers "compensation", which app.data_request_kind cannot store* |
| Remove `"restriction"` from `REQUEST_KINDS`, leaving it in the enum | `leaves no member of the enum unreachable from the form` — *app.data_request_kind has "restriction", which the form never offers* |

### A floor I wrote wrongly and corrected

The first version held every `requirement` string to 60 characters. It went red on (b), because the
Article's own text for (b) is *"The purposes of the processing."* — thirty-one characters.

The floors are now asymmetric, and the asymmetry is the point: `content` and `evidence` are **ours**,
so a short one is a placeholder worth failing over; `requirement` is the **Article's**, and holding
somebody else's text to a length we invented is a floor on nothing — satisfiable only by padding the
statute.
