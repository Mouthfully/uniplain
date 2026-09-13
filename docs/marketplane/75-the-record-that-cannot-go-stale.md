# 75. The record that cannot go stale

**PR:** #57 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

A PDPA s.39 record of processing activities, **generated from the schema and guarded against it**,
published at `/processing`.

The obligation is live and was being plainly breached. `AGENTS.md` gap 5 recorded it, and recorded
why the escape hatch does not apply: the small-business exemption turns on processing being
*occasional*, and the ingest runs on a nightly cron. There was no record at all.

**Why this is a commercial unit and not only a compliance one.** A B2B customer appointing this
company as a processor inherits an obligation to check it. Their reviewer asks for two artefacts:
the DPA and the record of processing. The DPA needs a lawyer. The record does not — it is a
description of what the code already does, and this repository is unusually well placed to produce
one that is true.

### 1.1 The decision: code, not a document

A record of processing written by hand is accurate on the day it is signed and decays from the next
migration onward. Nobody notices, because nothing compares it to anything. The failure mode is
exact: **a document that looks right, produced for an audience who cannot check it** — this
repository's one rule in a different register.

So `_processing/activities.ts` must account for **every table in `public`**, and
`activities.test.ts` reads `supabase/migrations` and compares both ways. A table with no entry
fails the build. An entry naming a table that no longer exists fails. A table declared to hold no
personal data must carry a reason, because "not personal data" is a judgement and an unexplained one
rots like any stale list.

Seventeen tables, eight activities, one declared clean.

### 1.2 The distinction a buyer is actually paying for

Exactly one activity is marked `processor` — `platform-data`, the figures read out of a customer's
connected accounts. Everything else is `controller`. A test asserts that set is exactly
`["platform-data"]`.

That is not bookkeeping. Blur it and the company either claims the customer's obligations or
disclaims its own, and a reviewer who spots the blur stops the diligence. Stated sharply, it answers
the question their DPO came to ask: *a request from one of our data subjects goes to us, not to you.*

### 1.3 It states what is not in place

The page has a section headed "What is not in place": no transfer instrument, no DPA, no retention
schedule, no DPO.

That is a deliberate commercial judgement, not candour for its own sake. A reviewer finds all four
out in the first call regardless. Finding them stated on the vendor's own page is the difference
between a vendor who knows their position and one who has not looked — and it is the only version
of this page that survives contact with the `FORBIDDEN_CLAIMS` guard, which bans exactly the
assertions a weaker version would reach for.

### 1.4 The retention entries are the honest part

Six of eight activities have **no** retention period, and the record says so rather than filling in
a plausible one. Two do:

- `oauth_authorizations` — one hour, and on redemption. **The only retention that actually operates
  anywhere in this schema.**
- `platform-data` — *"None operates. A 30-day period is declared in code for restatement events and
  does not run: the scheduled job returns `not_configured` before reaching it."*

A test asserts that second sentence still contains `does not run`. A record listing "30 days" plainly
would describe a control the company does not have, to a regulator, in writing.

## 2. Cost estimate

**Per connected account per month:** N/A. A static page and a test. No data-plane work, no column,
no call.

## 3. Platform-terms check

18 gates. **2 PASS, 16 N/A, 0 FAIL.**

**Credential** — 1–3 `N/A`, no platform call, no vendor key, no MCP surface. 4 credential hygiene
**`PASS`**: the record names credential *columns* and their sealing, and contains no credential.

**Tenancy** — 5 RLS `N/A`, no new table. 6 service-role `N/A`. 7 cross-workspace `N/A` — the page is
static and tenant-independent; it describes the schema, never a tenant's rows. 8 cross-customer
aggregation `N/A`. 9 API key scope `N/A`.

**Data movement** — 10 resale `N/A`. 11 Meta client list `N/A` — the record *names* the
`client_name`/`client_contact` columns as capable of holding a customer's client contact details,
which is the disclosure, not a change. 12 licences `N/A`.

**PII and consent** — 13 hash at the edge `N/A`. 14 forbidden payloads `N/A`. 15 consent `N/A`.

**Access tier** — 16, 17 `N/A`.

**Claims** — 18 **`PASS`**. The page makes no compliance claim. It cites the three claims the
capability gate already allows (`tenant-isolation`, `no-pooling`, `no-training`) through
`optionalClaim`, and asserts nothing about SOC 2, ISO 27001, audits or penetration testing.
`forbidden-claims.test.ts` scans it with every other route.

## 4. What was left out

- **The DPA itself.** Legal text needs a lawyer; a drafted one published as though binding would be
  worse than none. This unit builds the artefact the DPA references, which is the prerequisite.
- **A transfer instrument.** Same reason.
- **Retention periods.** Founder plus lawyer. The record is built so that setting them later is
  additive: each entry's `retention` goes from null to a sentence.
- **s.37(1) — the personal-data audit trail.** Still absent. No access-log table exists in any
  migration and `claims.ts` correctly withholds the `audit-log` claim. This is the next code-shaped
  gap and it is the one that turns a withheld claim into a sellable one.
- **Machine-readable export of the record.** `/processing.md` exists via the llms.txt convention,
  which covers the reviewer's tooling. A structured JSON form was not attempted.

## 5. Open or unverified spec items this builds on

- **No lawful basis is asserted as established.** The `basis` field records the position this
  repository can support from its own behaviour; a test bans the phrasings that would overclaim
  ("we have determined", "legally compliant", "fully compliant"). The determination is booked in
  `AGENTS.md` under "needs a human".
- **The waiting list is recorded as held with no current purpose.** The feature it was collected for
  no longer exists, which is the condition that ends a retention basis. A test asserts that sentence
  is still there, because it is the one somebody would soften.

## 6. Verification

Gate green by exit code, including `pnpm -r build`. Web suite 445 → 457. `/processing` and
`/processing.md` read back over HTTP from a production build, not inferred from source.

### Mutation proofs

| Mutation | Test that went red |
|---|---|
| A new migration adding `public.support_tickets` | `accounts for every table in the schema`, naming `support_tickets` — the mutation was a **real migration file**, not an edit to the list |
| `platform-data` retention softened to "Restatement events are kept for 30 days." | `says plainly that the one declared period does not run` **and** `invents no retention period` |

The first is the one that matters. The guard does not compare a list to another list — it compares
the record to the migrations on disk, so the failure arrives the day a table lands rather than the
day somebody reviews the document. That is the whole difference between a record and a description
of one.
