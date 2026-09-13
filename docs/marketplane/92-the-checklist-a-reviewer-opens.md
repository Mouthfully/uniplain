# 92. The checklist a reviewer opens

> **Renumbered from 87 on merge.** #80 was open while #75 through #78 merged, and both
> branches read the highest number on `main` rather than the highest number *claimed*. Five
> notes collided — 86 through 90 — and git had nothing to say about it, because ten different
> filenames sharing five numbers is not a conflict. `check-design-notes.mjs` now refuses a
> duplicate prefix, which is the only reason this is the last time. Commit messages and PR
> bodies written before the merge still say 87; they are history and are left alone.

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Note 86 shipped an Art. 30 record and the restriction right, and left two things named as still
code-shaped and not started. This is the first: **Art. 28(3), clause by clause, against the
agreement that is actually published.**

`/dpa` is a PDPA s.40 instrument. Whether its clauses *also* satisfy GDPR Art. 28(3)(a)–(h) is a
different question and it is the first one a B2B reviewer asks — Art. 28(3) is a checklist, they
read it with the agreement open, and **a missing sub-paragraph is a rejection rather than a
comment.** Writing the agreement and assuming the checklist fell out of it is how a document comes
back marked.

It had not fallen out of it. Five of eight were short:

| Sub-paragraph | Before |
|---|---|
| **(b)** confidentiality of authorised persons | **Absent entirely.** No clause anywhere said the people who can touch a customer's data are bound to keep it confidential — the shortest thing in the Article and the easiest to have |
| **(a)** documented instructions | Covered purpose and unlawful-instruction pushback. Said nothing about **transfers**, and nothing about a law-compelled disclosure being notified to the customer first |
| **(f)** assistance | Stopped at breach. Art. 28(3)(f) spans Arts 32–36 — security assessment, DPIA, prior consultation |
| **(g)** deletion or return | Offered export and account closure, which is a self-service feature — not "at the choice of the controller, delete or return **after the end of provision**, and delete existing copies" |
| **(h)** audits | Offered information. **Allowing and contributing to audits** was not there at all |

All five are now in the agreement, as a new clause 5 (Confidentiality) and four additions. Every
other clause renumbered.

### 1.1 The one that is still not met, and why it stays that way

**(d)** — the conditions for engaging another processor. Art. 28(2) requires the controller's prior
authorisation and, where that authorisation is general, that the processor **inform the controller
of intended changes and give it the opportunity to object.**

The agreement says plainly that no notice period is promised, because no mechanism exists to give
one. That is still true: **the domain answers NODATA for MX**, so the company cannot send the notice
that a right to object depends on.

Writing *"we will notify you of any change"* into the agreement would close the checklist item and
would be **a commitment nothing keeps, in the document a customer relies on most.** That is this
repository's defining refusal, in its single most expensive location. So (d) is reported `absent`,
with the reason and the thing that would close it.

A reviewer reading this meets **one honest gap** rather than eight sentences of which one is false.
The first is a conversation; the second is the end of the conversation.

### 1.2 Why the mapping is checked against the rendered page

A clause-by-clause mapping is the document a reviewer reads **instead of** the agreement. That is
what makes it useful and what makes it dangerous: a mapping asserting coverage the agreement does
not contain is worse than no mapping, because it is believed and it is shorter.

So every sub-paragraph marked `met` names a phrase from the agreement, and `article-28.test.tsx`
requires that phrase in the **rendered markup** — not in `DPA_COPY`, which would only prove the
mapping agrees with the constant it was written beside. **A commitment defined and never rendered is
a commitment nobody is offered**, and the mutation below proves the check catches exactly that.

### 1.3 The same mistake, one commit later

`87`'s first draft held every `requirement` string to **80 characters**. It went red on (c), because
Art. 28(3)(c) is *"takes all measures required pursuant to Article 32"* and really is that short.

Note 86 closes with a paragraph about this exact error, made on the Art. 30 record, and I made it
again on the next file. The floors are now 45 for the statute's wording and a separate one for the
`commitment` string, which is ours. Writing the lesson down did not stop me repeating it a few
minutes later; the test did. **That is an argument for the test and not much of one for the note** —
worth recording, because the standing assumption in this directory is that a written-down lesson is
the fix.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. Four paragraphs and one clause added to a statically-exported page, one
mapping module read at build time by a test. No migration, no query, no upstream call, no scheduler
work.

**A cost this does create, honestly:** the new commitments are real obligations, not text. Clause 11
now commits to allowing and contributing to audits and inspections, and clause 6 to assisting with
DPIAs and prior consultation. Those are staff time on a customer's schedule, and they are the
correct cost of being a processor a business can appoint. Nothing in section 7's table prices them.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call in the diff.

**2. Vendor-key exception.** > `N/A` — no company-held key.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface touched.

**4. Credential hygiene.** > `PASS` — no credential in the diff. The new confidentiality clause
*describes* access control and names no value.

### Tenancy

**5. RLS.** > `N/A` — no migration, no table, no policy.

**6. No service-role bypass.** > `PASS` — and the new clause 5 states the mechanism to the customer
in their own terms: a cross-tenant task runs as an identity holding no grant on any table, and
per-customer reads run under the customer's own workspace. That is `app_scheduler` and
`authenticated` described without naming them, and it is true of the code as it stands.

**7. No cross-workspace read.** > `PASS` — static page, no query.

**8. No cross-customer aggregation.** > `PASS` — nothing aggregated.

**9. API key scope.** > `N/A` — untouched.

### Data movement

**10. No resale or redistribution.** > `PASS` — nothing moves. Clause 2 now states explicitly that
the cross-border transfers are made to provide the service and for no other reason, which narrows
rather than widens.

**11. Meta client list.** > `N/A` — untouched.

**12. Dependency licences.** > `PASS` — none added.

### PII and consent

**13. Hash at the edge.** > `N/A` — no ingest path.

**14. Forbidden payloads.** > `N/A` — no egress.

**15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request.

**17. No new long-lead dependency.** > `PASS` — nothing added. **(d) depends on one already
outstanding:** the MX record, which is a five-minute founder task and is what stands between the
agreement and a complete Art. 28(3).

### Claims

**18. Claim provenance.** > `PASS`, and it is the substantive gate here. The new clauses are
**commitments**, not claims of fact — "will allow an audit" is a promise about future conduct, which
a contract is for. What is *not* said is that any audit has happened: clause 11 still says there is
no third-party audit report, and `article-28.test.tsx` asserts both sentences survive together,
because they sit one paragraph apart and that is where they would get confused. `unmetClauses()`
returns `["d"]` and a test asserts it is not empty, so nobody can mark the checklist complete
without closing the gap.

**Result:** `10 PASS, 8 N/A, 0 FAIL`

## 4. What was left out

- **Art. 33–34 breach notification path.** The other item note 91 named and still not started. The
  append-only trail an assessment needs exists; the notification path does not, and a 72-hour clock
  needs a recipient, a template and a decision about who is on the hook at 3am. **Issue, not scope
  creep.**
- **Closing (d).** Needs a notice channel, which needs the MX record. Deliberately not faked.
- **A published Art. 28(3) mapping page.** Internal, like the Art. 30 record. It is an artefact for a
  reviewer who asks, not a page for the site, and publishing a checklist with one `absent` row
  before the founder has decided how to close it would advertise the gap rather than answer it.
- **Legal review of the new clauses.** Unchanged and stated on the page itself: nobody has reviewed
  this agreement. The four additions are drafted against the Article's own wording, which is the
  best that can be done here and is not the same as being right.

## 5. Open or unverified spec items this builds on

- **The mapping is mine, not counsel's.** Each sub-paragraph is read against the Article's text and
  matched to a clause. A lawyer may judge a clause insufficient even where this reports `met` —
  particularly (c), where "takes all measures required pursuant to Article 32" is a standard the
  clause describes rather than invokes, and (e), where the assistance promised is what is possible
  for a processor holding no direct relationship with the data subject.
- **(b) is a commitment about people, and there is essentially one person.** The clause is true and
  will stay true only if it is honoured as the company hires. It is the clause most likely to become
  false without anyone editing it — no test can reach an employment contract.
- **Whether Art. 28 applies at all follows from Art. 3(2)**, which counsel has not confirmed
  (issue #74). If it does not, this is not wasted: PDPA s.40 wants an agreement controlling the
  processor's activities, and every clause added here serves that too.
- **The renumbering changed clause numbers a customer may already have cited.** `DPA_VERSION` is
  `2026-09-13` and unchanged by this unit, which is wrong if anyone has relied on the earlier
  numbering. Nobody has — the agreement shipped today, in this same PR — but a future change to
  clause numbers must move the version, and no test enforces that yet. **Recorded rather than
  quietly fixed.**

## 6. Verification

Run by exit code, never by reading output.

```
pnpm exec biome lint .          = 0
pnpm exec biome format .        = 0
pnpm -r typecheck               = 0
pnpm -r test                    = 0
pnpm -r build                   = 0     (both apps)

all nine check-*.mjs guards     = 0
```

No migration in this unit; the SQL suite was green on the commit before it — 23 suites, 702
assertions, 0 failed.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Mark (d) `met` while no notice channel exists | `reports the sub-processor sub-paragraph as unmet` — *expected 'met' to be 'absent'* |
| Delete the rendered confidentiality section from `dpa/page.tsx`, leaving the clause defined in `DPA_COPY` | `renders the commitment behind every sub-paragraph it marks met` — *(b) is marked met, but the agreement does not say "bound to keep it confidential"* — and `names a clause of the agreement for every sub-paragraph` |

The second is the one the design turns on. The clause was still **defined**, fully written, in
`DPA_COPY`; only the six lines rendering it were gone. A mapping checked against the constant would
have stayed green and a customer would have been offered nothing. Checking against the rendered page
is the difference between a mapping that describes the agreement and one that describes the
intention behind it.
