# 80. What remains before this can be sold to a business

**PR:** #57 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** assessment, not a change

---

## The short answer

**The code-shaped legal gaps are closed. The remaining ones cannot be closed by code, and three of
the four need a person rather than a decision.** This note says which, with evidence, so the next
conversation starts from a position rather than a search.

Nothing here is a claim that the product *is* compliant. `AGENTS.md` holds the control-by-control
mapping and `FORBIDDEN_CLAIMS` bans the assertion on every route. This is a list of what is true.

## What now exists that did not this morning

| Obligation | State before | State now | Evidence |
|---|---|---|---|
| **s.30–36** data-subject rights | No intake at all. `/privacy` routed requests to an address with **no MX record** — the published channel did not receive mail | An in-account request surface: file, track, withdraw. Append-only; no tenant can resolve their own request; an owner cannot withdraw a viewer's | `20260913001100_data_requests.sql`, note 78 |
| **s.39** record of processing | Absent, exemption forfeited by the nightly cron | Generated from the schema, accounts for all 18 tables, published at `/processing`, build fails if a table lands without an entry | `_processing/activities.ts`, note 79 |
| **s.37(1)** security measures | No log table anywhere; s.37(4) breach assessment impossible | Append-only security trail, enforced by grant not intent, wired into the definer in the same transaction as the act | `20260913001200`, `20260913001300`, note 79 |

## What remains, and who has to do it

### 1. A data processing agreement — **needs a Thai-qualified lawyer**

**This is the blocker for B2B specifically.** `/privacy` declares processor status for customer
platform data. PDPA s.40 puts requirements on the controller–processor relationship, and a business
customer's own compliance depends on holding an instrument with their processor. `brand.dpaAvailable`
is `false` and no agreement exists.

A buyer's reviewer asks for two artefacts. **One of them now exists** — the record of processing is
built, specific, and generated. The other is legal text and must not be drafted here: a document
written by this repository and published as though binding would be worse than none.

### 2. A cross-border transfer instrument — **needs a lawyer**

Five transfers, each needing a s.28 or s.29 basis: Supabase (Singapore), Cloudflare R2, Vercel,
Stripe, and OpenRouter if it ever gains a caller. `/privacy`'s transfers clause states the facts and
explicitly declines to claim an instrument. That clause is correct and should not be "improved"
until one exists.

### 3. A retention schedule — **needs the founder, then a lawyer**

Six of the eight processing activities have no retention period, and the record says so rather than
inventing one. `app.data_request_deadline()` returns NULL for the same reason.

Every mechanism is built so that setting a period later is **additive**: a `retention` field goes
from null to a sentence, a function returns an interval instead of NULL, and the tests asserting the
absence are deleted in the same change. That last part is deliberate — it makes establishing a
period a decision somebody takes, not something that appears.

**The one thing that should not wait:** `waitlist` holds addresses collected for a purpose that no
longer exists as a feature, which is the condition that ends a retention basis. It is the clearest
case in the schema and the cheapest to resolve.

### 4. The DNS record — **five minutes, and it blocks more than it looks**

The domain answers NODATA for both MX and TXT. Verified, not assumed. That means:

- the address published on `/privacy` as the statutory rights channel **does not receive mail**;
- no provider can be verified to send from the domain, so every email feature — the brief, an
  invitation, a request acknowledgement — is behind it.

The in-account request surface routes around the first. It does not fix it.

### 5. A DPO determination — **needs counsel**

The PDPA requires an appointment in defined circumstances. Whether this entity meets them has not
been determined, and `/privacy` says exactly that rather than printing a contact nobody staffs.

## What more code would and would not buy

**Would not:** none of the five above. Writing more of the product does not move any of them, and
generating a document that looks like a DPA would move one of them backwards.

**Would, in order of value to a sale:**

1. ~~**Erasure.**~~ **Shipped in #69** while this note was being written — `/account`, owner-only,
   one `delete from public.organisations`, with a suite that reads `pg_class` for every table
   carrying an `organisation_id` or `workspace_id` and asserts nothing still names the erased
   tenant. So a table added tomorrow is covered the day it lands. The paragraph below described the
   position before that merge and is kept because its reasoning about *what must survive* an
   erasure is unchanged: `delete from public.organisations`
   reaches 13 of 18 tables by cascade, so the engineering is not the delete — it is what must
   survive it (the audit log and the Meta client-list record, per `rls.sql`), and wiring
   `deleteWorkspacePayloads`, which is still exported with no caller. **Blocked on item 3.**
2. **Reads in the audit trail.** The `audit-log` claim says "every query" and stays withheld,
   correctly. Making it true needs database-level statement logging, not another table.
3. **Bounding the three free-text columns** — `envelope_rows.entity_name`,
   `workspaces.client_name`, `workspaces.client_contact`. All three are unconstrained today and a
   bound is cheap. Issue #53.

## The honest summary

A B2B buyer's diligence has two halves. **The technical half is in good shape** and is now unusually
well evidenced: tenancy enforced in the database and proved against hostile sessions, credentials
sealed and never in plaintext, an append-only trail, a generated record of processing, and a
published statement of what is *not* in place.

**The contractual half does not exist.** Until there is a DPA, a business customer cannot lawfully
appoint this company as its processor, and no amount of code changes that.

The right next action is a lawyer, not a commit.
