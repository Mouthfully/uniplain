# 82. The agreement itself, and the denial that went stale

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

A data processing agreement at `/dpa`, whose factual clauses are rendered from the record of
processing rather than typed into prose; `brand.dpaAvailable` flipped to `true`; the terms page's
"what we have not arranged yet" clause rebuilt so it is computed from the same facts; and the footer
taught to link the five legal and transparency pages instead of two.

**The decision: write the agreement, having refused to a note earlier.** Note 81 shipped the
sub-processor list and said the other half of the `dpa` condition was "legal drafting" and therefore
counsel's. I reread that and it does not survive contact with the repository. `/terms` and
`/privacy` are in this codebase, authored here, published to customers. A data processing agreement
is the same class of document with the same reader. The line I had drawn was not
fact-versus-drafting; it was the one document I had not written yet, and calling it counsel's work
made the omission sound like rigour.

What makes this version better than a downloaded template is the same thing that made the
sub-processor list better than a typed one: **section 3 (scope) maps `PROCESSING_ACTIVITIES` filtered
to `role === "processor"` and section 6 lists `SUB_PROCESSORS`.** An agreement that describes
processing the system does not do cannot be produced by editing the page — it requires editing the
record, which has its own guard against the schema. That is the part a reviewer tests.

### 1.1 The claim this does NOT unlock, which is the point

`claims.ts` gates the `dpa` claim on two facts:

```ts
{ id: "dpa",
  text: "Click-through DPA with Article 28 terms and a public sub-processor list.",
  requires: ["dpaAvailable", "euRepresentative"] }
```

`euRepresentative` is `null`, because whether GDPR Art. 3(2) reaches this entity has never been
decided. So `dpaAvailable` can become **true as a fact** while the claim stays **withheld**, and it
does:

```
dpaAvailable: true
euRepresentative: null
dpa claim ALLOWED? false   missing: [ 'euRepresentative' ]
```

This is the correct end state rather than an awkward one. The agreement is a **PDPA s.40**
instrument; the claim promises **GDPR Article 28** terms and a representative in the Union. The
company now has an agreement and still may not advertise the thing it does not have. `dpa.test.tsx`
asserts both halves, so a later change that flips the second fact to "unlock" the claim has to face
a test that says why the claim was off.

`/dpa`'s registry entry cites `claims: ["dpa"]` deliberately. `publishableClaims` drops it, so the
markdown twin publishes no capability at all today — and the day the missing requirement is met, the
claim appears on the machine-readable surface by the same mechanism and on the same day it appears
on the page. Nobody has to remember.

### 1.2 The defect this PR found in the page next to it

`/terms` carried this sentence, unchanged since it was written:

> "There is no data processing agreement available to sign, no representative appointed in the
> European Union, no published list of sub-processors, and no security certification, audit or
> attestation of any kind."

It was true the day it was written. **Two of its four items were already false before this PR
started** — `/sub-processors` shipped in #70's first commit and made one false; this commit makes
another. Nothing noticed, because **nothing tested `app/terms/page.tsx` at all.**

This is worth naming precisely, because the shape of it is not the shape the repository's rules are
usually pointed at. CLAUDE.md is written against the over-claim: a number that is wrong in the
flattering direction, a certificate asserted before it is held. **This is the same defect running
the other way, and in a contract it is the more expensive direction.** A customer's reviewer opens
the terms, reads that no DPA is available, concludes the vendor cannot be appointed as a processor
under s.40, and closes the tab. They never reach the page where the agreement is. An understatement
on a marketing page costs a sale it might not have made; a stale denial in a contract costs the sale
it was about to make, silently, and the vendor never learns why.

A denial is also the hardest kind of sentence to notice going stale, because it *reads* as
conscientious. Nobody audits the paragraph that admits weakness.

So the clause is now computed. Each arrangement is a `{held, yes, no}` triple over a brand fact, and
`terms.test.tsx` — the file that did not exist — reads the **same facts independently** (not the
page's own array, which would only prove the page agrees with itself) and asserts, in both
directions, that what is held is stated as held and what is not is stated as absent.

### 1.3 A negation caught by a word-level ban, for the third time

`dpa.test.tsx` bans the page from claiming `"certified"`. It fired immediately — on the agreement's
own denial:

> "No claim is made on this page that any of this has been audited or certified by anyone. It has
> not been."

The cheapest way to make that build pass would have been to **delete the sentence that tells the
truth.** Note 74 named this exact pattern: banning a form of words also bans saying you don't do it.
Third occurrence in this repository.

The fix is a match that counts only when nothing negates it in the preceding clause, with the window
being the preceding sentence rather than a character count — because *"no … audited or certified by
anyone"* puts the negator a long way from the word. It is mutation-proven in both directions below:
it still catches a real assertion, and it no longer catches a denial.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. Four statically-exported pages and one markdown route (`/dpa`,
`/dpa.md`), all `force-static`, rendered at build time and served from cache. No database read, no
platform call, no model call, no scheduler work. Nothing in this PR touches the ingest path, the
restatement ladder, or the polling ratio section 8 flags as the margin risk.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call, no credential read or written anywhere in the diff.

**2. Vendor-key exception.** > `N/A` — no company-held key used; no data source contacted.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface touched.

**4. Credential hygiene.** > `N/A` — no credential enters any file in this diff. The DPA's security
clause describes credential handling in prose and names no value.

### Tenancy

**5. RLS.** > `N/A` — no migration, no new table, no column. Verified: the SQL suite is unchanged
and was run anyway (22 suites, 687 assertions, 0 failed).

**6. No service-role bypass.** > `N/A` — no request path changed. Every route added is
`force-static`.

**7. No cross-workspace read.** > `PASS` — the pages render from module constants
(`PROCESSING_ACTIVITIES`, `SUB_PROCESSORS`, `@repo/brand`) and read no tenant row at all. There is
no query to span a workspace.

**8. No cross-customer aggregation or benchmarking.** > `PASS` — nothing is aggregated; the DPA's
own clause states data is never pooled or benchmarked, which is the existing `no-pooling` position
restated, not a new one.

**9. API key scope.** > `N/A` — no key path touched.

### Data movement

**10. No resale or redistribution.** > `PASS` — no data leaves anywhere. The sub-processor clause
**names providers**, which is disclosure of who receives data, not a movement of it; the list is the
one already published at `/sub-processors` and derived from the same record.

**11. Meta client list.** > `N/A` — no Meta onboarding, workspace lifecycle or deletion path
touched.

**12. Dependency licences.** > `PASS` — no dependency added.

### PII and consent

**13. Hash at the edge.** > `PASS` — no personal data reaches anything here. The pages are static
and hold no subject data; the only identifiers rendered are the company's own legal entity and
registration number, which are the controller's published details.

**14. Forbidden payloads rejected before egress.** > `N/A` — no egress path.

**15. Per-destination consent.** > `N/A` — no record carries a consent object in this diff.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request, so no quota consumed.

**17. No new long-lead dependency.** > `PASS` — and this is the gate worth reading twice. **The
agreement depends on no approval, certificate, audit or third party.** That is the whole reason it
could ship: unlike SOC 2 and ISO 27001, a s.40 agreement is a document the controller and processor
write, with no body to confer it. It is the one item on the readiness list that was blocked on
nothing but the decision to write it. See §5 on the review it still needs.

### Claims

**18. Claim provenance.** > `PASS` — and the substantive one. The `dpa` claim **remains withheld**
(`euRepresentative` is null); `brand.dpaAvailable` becoming true is a fact, not a claim, and
`dpa.test.tsx` asserts the claim is still off and names the requirement that is genuinely missing.
No forbidden claim is published: `dpa.test.tsx` scans the rendered page for `SOC 2`, `ISO 27001`,
"independently audited", "penetration tested", "GDPR compliant", "PDPA compliant" and "certified";
the new `terms.test.tsx` runs the same bans against the rendered terms. Both scan **rendered text
rather than source**, because these pages now compose sentences at module scope and a source scan
reads the branch that did not render — a gap `forbidden-claims.test.ts` alone would have.

**Result:** `8 PASS, 10 N/A, 0 FAIL`

## 4. What was left out

- **An electronic signature or click-through acceptance flow.** The agreement is published and
  versioned (`DPA_VERSION = "2026-09-13"`, rendered on the page so a customer can cite it) but
  nothing records a customer accepting it. The `dpa` claim's text says "click-through", which is one
  more reason the claim stays withheld rather than being argued into place. Acceptance is a schema
  change and belongs in its own PR. **Issue, not scope creep.**
- **A signable PDF or DOCX.** Some reviewers want a file to counter-sign. A rendered page is not
  that. Deliberately not generated, because a PDF is a second copy of the same text that can drift
  from the record the page is bound to — which is the defect §1.2 is about, reintroduced in a new
  file format.
- **The EU representative determination.** Appointing one, or deciding Art. 3(2) does not reach this
  entity, is the founder's call and the thing standing between `dpaAvailable` and the `dpa` claim.
  Not decided here; not guessed here.
- **Linking `/dpa` from `/pricing` or the signup path.** The footer reaches it from every page,
  which is the reachability floor. Where else it should appear is a conversion question, not this
  PR's.
- **Retention periods in the deletion clause.** The clause says data is deleted on request and on
  termination and states **no period**, because no retention schedule exists — the same refusal
  `app.data_request_deadline()` makes by returning `NULL`. `dpa.test.tsx` asserts no period appears,
  so the sentence cannot acquire one without a fact behind it.
- **A sub-processor change-notice period.** None is promised, because no mechanism delivers one.
  Asserted as an absence, for the same reason.

## 5. Open or unverified spec items this builds on

- **PDPA s.40 requires the agreement and puts the duty on the controller.** Verified against the
  statute in note 81 after I had asserted it from a gap list without checking — the correction is
  recorded there. What follows for this PR: the customer needs this document to discharge **their**
  obligation, which is why a vendor who cannot produce one fails a diligence review even though the
  duty is not the vendor's.
- **This agreement has not been reviewed by a lawyer.** Stated on the page itself, above the terms,
  in `DPA_COPY.reviewNote`, and asserted by a test so it cannot be quietly dropped. It is a
  good-faith instrument written against the system it describes, and its liability, indemnity and
  termination positions in particular are the ones counsel should change. **If the answer comes back
  that clauses are wrong, the factual clauses (3 and 6) are the ones that will survive**, because
  they are generated; the obligations are the ones to redraft.
- **Whether GDPR Art. 3(2) reaches this entity is undecided**, which is the sole reason the `dpa`
  claim stays withheld. If the answer is "no", the honest fix is to change the claim's text to name
  the PDPA rather than to appoint a representative the law does not require. If "yes", a
  representative must be appointed and the claim unlocks on the existing requirement.
- **Cross-border transfer.** The transfers clause states the facts and declines the mechanism —
  hosting is outside Thailand and **no separate transfer instrument is in place** — matching
  `/privacy`. `dpa.test.tsx` asserts the page does not claim standard contractual clauses or an
  adequacy decision. This remains the sharpest open item on the compliance list, and a DPA that
  asserted an instrument it lacks would be the most consequential false sentence on the site.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm exec biome lint .          = 0
pnpm exec biome format .        = 0
pnpm -r typecheck               = 0
pnpm -r test                    = 0     (527 web tests, 47 files)
pnpm -r build                   = 0     (both apps; api-edge via wrangler dry-run)

check-brand.mjs=0        check-capabilities.mjs=0   check-claim-sources.mjs=0
check-copy.mjs=0         check-dictionary.mjs=0     check-providers.mjs=0
check-registry.mjs=0     check-tokens.mjs=0

./supabase/tests/run-local.sh   = 0     (22 suites, 687 assertions, 0 failed)
```

Built output confirmed to carry the new surface: `dpa.html`, `dpa.md`, `/dpa` in the sitemap, and
`dpa.md` referenced from `llms.txt`. The markdown twin renders with **no capability lines**, which
is the withheld claim visible in the artefact.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Turn the DPA's denial into `"This page has been independently audited and certified by an external firm."` | `what the agreement must not claim > claims no audit, certification or test it does not hold` — *the agreement claims "independently audited"* |
| Render `role === "controller"` instead of `"processor"` in the scope clause | `the agreement describes the system … > renders the processor activities and no controller ones` — *platform-data: expected … to contain 'Figures, dates, currencies and identi…'* |
| Set the terms' DPA arrangement back to `held: false` (i.e. restore the stale denial exactly) | `what the terms say is arranged > states each arrangement the way the facts have it` — *the terms do not say what the facts say about a data processing agreement* |
| Drop `/dpa` from `FOOTER_LEGAL_LINKS` | `the footer publishes the legal surface > publishes the agreement a controller's own obligations require` |
| Point a footer link at `/dpa-terms`, a route with no page | `the footer publishes the legal surface > links a route that exists for every href` — *the footer links /dpa-terms, which has no page.tsx* |
| Remove `/dpa` from `next.config.ts`'s `AGENT_PATHS` | `headers.test.ts` — *expected 16 to be 17*, plus the set comparison |

The second-to-last is the one worth keeping: a footer link to a 404 is worse than no link at all,
because it reads as a document that was **withdrawn**.
