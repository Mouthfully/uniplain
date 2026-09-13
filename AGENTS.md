# Compliance: what is actually implemented, what is partial, and what is absent

The reference `CLAUDE.md` points at. Read it before claiming anything is covered.

**Method.** Four frameworks were mapped against this repository by separate agents, each then
handed to an adversary told to refute it, with instructions that "this is not implemented" is the
most valuable finding available. Where a control is called **implemented** it names the file or test
that proves it. **No evidence, no "implemented".** Anything that could not be verified from this
environment is marked *unverified* rather than laundered into a fact.

**Status at a glance**, and the shape of it is the honest headline:

| Framework | Implemented | Partial | Absent | N/A | Of |
|---|---|---|---|---|---|
| SOC 2 Type II | **0** | 19 | 15 | 1 | 35 |
| ISO/IEC 27001:2022 | 4 | 14 | 6 | — | 24 |
| GDPR | 3 | 9 | 12 | 1 | 25 |
| PDPA (Thailand) | 2 | 3 | 12 | 3 | 20 |

Zero SOC 2 criteria are fully implemented. That is not a failure of engineering — it is what a
framework built around policies, an auditor and an observation window looks like when measured
against a codebase.

---

## 1. PDPA — Thailand. The one that binds now

**Applicability: total, with no test to fail.** PDPA s.5 governs collection, use or disclosure by a
controller *located in the Kingdom*, whether the processing happens inside or outside it.
`brand.legalEntity` is a Thai juristic person with a Thai registration and a Samut Prakan address.
That single fact settles it. It does not matter where the customers are, where the data subjects
are, or where the data is hosted — **hosting in Singapore does not move it out of reach, it adds a
s.28 cross-border transfer obligation on top.**

**What it is:** a law. No auditor, no report, no observation window, no certificate, nothing to
obtain. In force since 1 June 2022. There is no "audit-ready" milestone and no date on which a claim
becomes available.

### Implemented

| § | Requirement | Evidence |
|---|---|---|
| s.22 | Collect only what is necessary | `packages/connectors/src/sources/woocommerce/normalize.ts` — the normalised row carries identifiers, money, quantities, dates, currency and timezone, and **no buyer name, email, phone or address** |
| s.37(1), cookies | A non-essential cookie needs a basis | `apps/web/app/_gate/token.ts` — the pre-launch cookie is an HMAC over a fixed label, one-way, identifies nobody, holds no per-person value |

### The eight blocking gaps, worst first

1. **s.37(3) — erasure on request now exists; no retention period still does.** `/account` closes an
   organisation outright (`20260913000700_erasure.sql`, #69): one `delete from public.organisations`,
   owner-only, refused while a subscription is live, with `19_erasure.sql` reading `pg_class` for
   every table carrying an `organisation_id` or `workspace_id` so a table added later is covered the
   day it lands.

   **What that does NOT do is set a retention period.** Erasure is an act a customer takes; s.37(3)
   is about data nobody has asked about. No period is set for `envelope_rows`, `connections`,
   `invitations`, `waitlist`, `members`, `billing_customers` or the R2 payload archive, and nothing
   removes any of them on a clock. The distinction matters because shipping erasure makes it very
   easy to believe this gap closed, and it did not.

   `restatement_events` is the one apparent exception and it is not one, which is worth stating
   precisely because the code reads as if it were. `app.prune_restatement_events` is real, has a
   30-day retention (`app.retention_delivered()`), is granted to `app_webhook`, and its cron
   `17 3 * * *` is declared in `apps/api-edge/wrangler.jsonc` and dispatched by name in
   `src/webhooks.ts`. **It never runs.** `src/index.ts` passes `store: null` into
   `handleScheduled`, which returns `not_configured` before the prune branch is reached, and no
   `WebhookStore` implementation exists outside a test fake. So the retention control is written,
   tested, granted, scheduled — and unreachable. That is a worse state than absent, because every
   artefact says it is covered.

   `oauth_authorizations` is the only table in the schema from which rows are actually removed: a
   one-hour TTL and a single-use `delete … returning`, both in `20260913000400_oauth_pending.sql`.
   Across all migrations there are exactly three `delete from` statements, and none names a
   tenancy table.
2. **s.28 — every byte crosses a border with no mechanism.** Five transfers, each needing a s.28 or
   s.29 basis: Supabase (Singapore), Cloudflare R2, Vercel, Stripe, **and OpenRouter**, which
   receives prompts built from a tenant's figures.
3. **s.40 — the company calls itself a processor and has no instrument.** `/privacy` declares
   processor status for customer platform data; `brand.dpaAvailable` is `false` and no agreement
   exists. That leaves every future customer exposed on s.40's controller-processor requirement.
4. **s.23 — two mandatory disclosures are missing from the collection notice**: the retention period
   (s.23(3)) and the categories of recipient (s.23(4)). Both are `open: true` clauses on `/privacy`
   — the candour is right, the gap is still a gap.
5. **s.39 — a record of processing activities now exists, and is generated rather than written.**
   The exemption remains **forfeited** — it turns on processing being occasional and the ingest runs
   on a nightly cron (`INGEST_CRON`) — so the obligation is live and is now met in the only form
   that stays met: `apps/web/app/_processing/activities.ts` accounts for every table in `public`,
   and `activities.test.ts` reads the migrations and fails the build in **both** directions, so a
   new table with no entry cannot ship. Published at `/processing`.

   What the record itself reports as still missing is unchanged and is listed on that page: no
   transfer instrument, no DPA, no retention schedule, no DPO.
6. **s.30–s.36 — no data-subject rights path at all.** No intake, no identity check, no clock, no
   export, no rectification, no objection, no erasure.
7. **s.19 / s.23 at the waiting list.** *Partly fixed:* the form now carries a purpose, a retention
   statement and a link to the notice. Still absent: a consent artefact recording what was agreed
   and when.
8. **s.37(1) — a security event trail now exists; a complete access log still does not.**
   `public.security_events` records security-relevant ACTS — a credential sealed, a connection
   attached or revoked, a role changed, a key minted — append-only and enforced as such: no role
   holds UPDATE, DELETE or INSERT on it, the only writer is a `SECURITY DEFINER` function, and
   `21_security_events.sql` proves all three from a hostile `authenticated` session. That makes an
   s.37(4) breach assessment possible where it previously was not.

   **Reads are still not captured**, and cannot be by anything in this schema: a tenant's reads go
   through PostgREST as `authenticated` and would need database-level statement logging. So
   `claims.ts` still correctly withholds `audit-log` — its text is "Every query, export and API key
   is logged" — and `surface:audit-log` stays out of `AVAILABLE_CAPABILITIES`. A test in the SQL
   suite carries the reasoning for whoever sees the new table and concludes the capability shipped.

**VERIFIED, AND IT IS WORSE THAN "NO MX".** This entry previously read *"one agent reported no MX
record; I could not verify that from this environment (no `dig`/`host`)"*. It is now verified, over
DNS-over-HTTPS against Cloudflare's resolver, which `curl` can reach where `dig` is absent:

```
DOMAIN=$(node -e 'import("@repo/brand").then(b => console.log(b.brand.domain))')
curl -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$DOMAIN&type=MX"
curl -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$DOMAIN&type=TXT"
```

(The domain is read from the brand package rather than typed, because `check-brand.mjs` bans the
literal everywhere else — **including inside a fenced shell example in a document**, which is how
the first draft of this paragraph failed the gate.)

Both return `Status: 0` (NOERROR) with **no `Answer` section at all** — only an SOA in `Authority`.
That is NODATA rather than NXDOMAIN: the zone exists and is served by Cloudflare, and it holds
**neither MX nor TXT records**.

Two consequences, and the second is new:

1. **Inbound mail bounces.** `brand.supportEmail` is published on `/privacy` and `/terms` as the
   route for data-subject requests. Under PDPA s.30–36 that is the statutory rights channel, and it
   currently does not receive mail. **This is the cheapest serious gap on this list and it is now a
   confirmed defect rather than a suspicion.**
2. **No outbound mail can be sent from the domain either.** No TXT means no SPF and no DKIM, so any
   sending provider — Resend, Postmark, Supabase's own SMTP with a custom sender — cannot be
   verified for the product domain until those records exist. Every email feature in the plan, from the
   morning brief to a workspace invitation, is behind this same five-minute DNS task.

### Needs a human, not code

A founder decision on **retention per category**. A **Thai-qualified lawyer** for the s.40
controller-to-processor agreement and the s.28 transfer instruments. A **record of processing**
owned by a person. **Sub-processor diligence and contracts.** A **breach runbook with a named human
and a route to the PDPC**. A **deliverable legal inbox**. A **DPO watch** — no appointment is needed
today, but the trigger is a standing review item, not a one-off.

---

## 2. GDPR — the business decision was taken by the pricing table

**This section used to open "Applicability is genuinely open and nobody has decided it… That turns
on whether the business sells into the EU." That premise was false when it was written.** The site
sells into the EU: `/pricing` quotes **euro** prices to any visitor, the footer on every page says
the product is built for businesses everywhere, the pricing hero reads "Priced in your currency",
and tax is added at checkout according to where the buyer is.

Nobody decided that as a legal position. A pricing table decided it, and the conclusion was never
carried back to the paragraph saying the question was open — which is why nobody went looking for
the answer for as long as the question looked unanswered.

The entity is Thai, so the GDPR reaches it only through Art. 3(2). EDPB Guidelines 3/2018 name the
possibility of paying **in the currency of a Member State, other than the one generally used in the
trader's own State**, among the factors showing a controller envisages offering services to data
subjects in the Union. The trader's State is Thailand; `brand.defaultCurrency` is USD; the euro is
neither. `apps/web/app/_processing/territorial-scope.ts` reads the configuration and reports the
factors with the file each was read from, so this is evidence rather than an impression, and
`territorial-scope.test.ts` goes red if any of it moves.

**THIS IS LIVE CONDUCT, NOT A MISSING DOCUMENT.** Every other gap on this page is something not yet
done. If Art. 3(2)(a) is engaged, the obligations attached the day the first euro price rendered,
and **Art. 27 requires a representative in the Union designated in writing**. Every PDPA gap in §1
reappears with a different section number and a larger ceiling.

**An obligation is not a claim.** `FORBIDDEN_CLAIMS` stops the site *saying* it is GDPR compliant
and the `gdpr` and `dpa` claims stay withheld on `euRepresentative` — all correct, and none of it
stops the GDPR applying. Reading "the claim is withheld" as "we are out of scope" is the specific
mistake this section now exists to prevent.

Three outcomes, and doing nothing is not among them:

1. **Counsel finds Art. 3(2)(a) engaged** → designate an Art. 27 representative; `euRepresentative`
   stops being null, which turns `territorial-scope.test.ts` red until this section is rewritten.
2. **The founder decides the EU is not a market** → the euro price and the territory-free copy come
   off. A commercial decision, not taken in code.
3. **Counsel finds the factors insufficient** → record the finding *with this evidence*, so it is
   not rediscovered, and the assessment reopens itself if the configuration moves.

### Implemented

| Article | Requirement | Evidence |
|---|---|---|
| Art. 5(1)(c) | Data minimisation | `woocommerce/normalize.ts` emits no buyer identifier |
| Art. 25(1) | Data protection by design | **FORCE** row-level security (not merely ENABLE) on **all fifteen** tables in `public`, asserted from the catalogue by `supabase/tests/15_force_rls.sql`. Three tables had only ENABLE until `20260913000200_force_rls.sql`; the earlier version of this row said "all seven tenancy tables" and was silent about the eight added since |
| Art. 5(1)(a) / 12(1) | Transparency | `/privacy` and `/terms` — every statement is read out of the repository or declared absent; gaps are marked rather than filled |

### What exists now, and what is still open

The decision recorded above was taken: the EU stays a market, so the GDPR work is being built
rather than deferred. Progress against the articles this section previously listed as absent:

| Article | State | Evidence |
|---|---|---|
| Art. 30(1) records | **Held, with (a) partial and (e) absent, both stated as such** | `apps/web/app/_processing/article-30.ts` derives every sub-paragraph from the PDPA record, the sub-processor list and the brand facts. `article-30.test.ts` asserts each letter appears once, every `recorded` answer is backed by a file that exists, and the transfer sub-paragraph reports **no Art. 46 safeguard** rather than inventing one |
| Art. 15, 16, 17, 20, 21 rights | **An intake exists for each** | `app.data_request_kind`, `/data-requests`, plus `/account` export and erasure |
| Art. 18 restriction | **Added.** It was missing from the enum and from the form, so nothing failed | `20260913001600_restriction_right.sql`; `_content.test.ts` now reads the enum out of the migrations and compares both directions, which is what was absent |
| Art. 32(1) security measures | **Described from mechanisms that exist** | `SECURITY_MEASURES` in `article-30.ts`; each clause names a file and the test fails if it does not exist |
| Art. 27 representative | **Absent** — the open decision, issue #74 | `brand.euRepresentative` is `null` |
| Art. 44–49 transfers | **Absent, and the largest remaining gap** | Every recipient is in a third country from the Union's standpoint and so is the controller. No SCCs, no BCRs, no derogation. Stated in Art. 30(1)(e), in `/dpa` and in `/privacy` |
| Art. 33–34 breach notification | **Partial** — the trail an assessment needs exists, the notification path does not | `20260913001200_security_events.sql` |
| Art. 28 processor terms | **A PDPA s.40 instrument exists; its Art. 28(3) clause-by-clause coverage is unassessed** | `/dpa` |
| Art. 37 DPO | **Undecided**, like PDPA s.41 | `brand.dataProtectionOfficer` is `null` |

---

## 3. ISO/IEC 27001:2022 — not held, and mostly not a code problem

**Applicability: voluntary, by procurement.** No statute imposes it. PDPA and GDPR Art. 32(3)/42
treat certification as *one way of demonstrating* measures, never as a requirement. The demand would
come from an enterprise buyer — and decision 11A.1 moved the primary customer to an owner-run small
business that will never run a security review.

**What it is:** a certificate from an accredited body against an **ISMS** — clauses 4–10: context,
leadership, risk assessment, internal audit, management review. Annex A is a *reference* control set
justified in a Statement of Applicability. **Implementing every technical control in Annex A
produces a well-run system and not a certificate.**

### Implemented

| Control | Requirement | Evidence |
|---|---|---|
| A.5.15 | Access control enforced, not intended | FORCE RLS on **every** table in `public` (15 of 15), explicit per-table grants, `revoke all … from anon`; `supabase/tests/15_force_rls.sql` reads the catalogue rather than a list, so a table added without it fails on the day it lands |
| A.5.17 | Authentication information managed | `20260908000600_api_keys.sql` — only a SHA-256 `key_hash` and a non-secret prefix are stored; plaintext shown once |
| A.8.3 | Information access restricted | as A.5.15, plus no DELETE on `organisations`/`workspaces`/`invitations`/`api_keys` and no policy granting an API-key session write access. Note what this rests on: every SECURITY DEFINER writer here reaches a FORCED table through no policy admitting its owner, so the whole write path depends on the owner holding `BYPASSRLS`. Demonstrated as a mechanism in `15_force_rls.sql`; **unverified on the hosted project** |
| A.8.33 | Test information protected | every fixture is hand-written synthetic TypeScript; no production data in any test |

### Absent and code-shaped, so these are ours to fix

- **A.8.8 vulnerability management** — no `pnpm audit` step, no Dependabot or Renovate, no CodeQL or
  SAST, no secret scanning, no SBOM. *Verified: one CI workflow, no dependabot config, no audit or
  SAST step anywhere in `.github/`.*
- **A.8.15/A.8.16 logging and monitoring** — the Worker emits structured `console.log` with counts
  and reasons. That is emission, not monitoring: no alerting, no retention, no review.
- **A.8.32 change management** — *verified: no `CODEOWNERS`, and the ten most recent commits are all
  unsigned (`%G?` = `N`).* Changes reach `main` without required review.
- **A.5.19–A.5.22 supplier security** — no vendor register, no DPA with any of the five vendors that
  hold data, no review of their reports.

---

## 4. SOC 2 Type II — not held, and the window is the part you cannot shortcut

**Applicability: by choice, and the case for it is currently weak.** A Thai entity can engage a CPA
firm under AT-C 205 exactly as a US one can. Whether it *should* is a procurement question, and the
stated customer will never ask.

**What it is:** an **attestation**, not a certification. No certificate, no accredited body, no
registry, no logo entitlement. A CPA firm produces a **report** in four parts — the auditor's
opinion, **management's assertion**, **management's written description of the system**, and the
tests performed. Parts two and three are written by *the company*, and **no such description exists
anywhere in this repository.**

**Type I is design at a point in time. Type II is operating effectiveness over a window** — commonly
3 to 12 months. That window is the thing no engineering work shortens.

### Zero implemented, and one gap explains why

**There is no population to observe.** Type II tests effectiveness by sampling what accumulated
during the period. `envelope_rows` holds no rows, there are no customers, and until recently nothing
ran on a clock. An auditor sampling this system would find nothing to sample.

The rest: **no written policies at all** (CC5.3 is unsatisfiable, and roughly a third of the Common
Criteria depend on a policy existing to be tested against); **no audit log** (CC6.1); **changes reach
production without review or approval** (CC8.1); **no monitoring, alerting or incident response**
(CC7.2–7.5); **no vulnerability management** (CC6.8, CC7.1); **no vendor management** while the
entire system is vendors (CC9.2); **no defined service commitments** — a Type II opinion is rendered
against the entity's own stated commitments, and there is no SLA, RPO or RTO to render one against.

### Needs a human, not code

A **licensed CPA firm** — no consultancy or compliance platform can issue the report. **Management's
description and assertion.** A **full approved policy set**. A **named security owner** with
independent oversight. **HR controls** — background checks where lawful in Thailand, confidentiality
agreements, recorded security-awareness training. An **independent penetration test within the
window**. **Executed DPAs with every sub-processor.** **Cyber liability and professional indemnity
insurance** — CC9.1 explicitly contemplates insurance, and this company custodies other people's
platform credentials.

---

## 5. The claim surface

What stops any of this being asserted before it is true.

| Control | Evidence |
|---|---|
| A machine-readable ban list, each entry carrying the decision that killed it | `packages/brand/src/claims.ts` → `FORBIDDEN_CLAIMS` |
| SOC 2 and ISO 27001 declared as claims withheld by a brand fact only a third party can set | `claims.ts` `soc2`/`iso27001`; `brand.ts` both `false` |
| Flipping a certification fact cannot silently publish copy — the ban and the claim are interlocked | `brand.test.ts` "does not fire on the claims that are allowed" goes red until the ban is deleted in the same change |
| The governing law and supervisory authority stated once, as facts about the entity | `brand.governingPrivacyLaw`, `brand.supervisoryAuthority`, rendered on `/privacy` |
| The ban applied to **every route**, not just the homepage | `apps/web/app/forbidden-claims.test.ts` — source scan, comments stripped, `\uXXXX` decoded |
| A withheld claim cannot be rewritten as hand-typed section copy | `apps/web/app/withheld-claims.test.tsx` — five-word runs |

**Still absent:** nothing checks the `/privacy` clauses against the PDPA's *required contents*. The
page names the law; no guard asserts that what it says satisfies it. That needs a lawyer, not a
regex.

---

## 6. If you are about to do compliance work

**Order it by what binds.** The PDPA binds today and nobody is asking for the other three. Retention
and deletion (s.37(3)), a rights path (s.30–36), and the transfer basis for OpenRouter (s.28) are
the three that are both legally live and genuinely code-shaped.

**The cheapest serious win is not a framework control.** It is a mailbox that receives mail, so the
rights channel already published on a public notice is not a dead end.

**Do not implement a control in order to claim it.** The claim is gated on a document, not on the
control. Build the control because the obligation is real; the claim follows a third party, or it
does not follow.
