# 78. The request that can be made, and the erasure that cannot

**PR:** #57 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

An in-account surface where a person files a data-subject request — access, rectification,
portability, objection or erasure — and watches what becomes of it. A table, two `SECURITY DEFINER`
functions, one route.

**It performs no deletion, and that is the decision rather than the shortfall.**

> **Corrected after the merge.** `20260913000700_erasure.sql` (#69) landed in parallel from another
> session and *does* erase — one `delete from public.organisations`, owner-only, refused while a
> subscription is live. The reasoning below, which argued that the grants made erasure impossible,
> was true of the schema as it stood and is no longer. #69 changed the grants and gave its reasons:
> two thirds of the retention argument in `rls.sql` rested on an audit log and a Meta client-list
> record that **do not exist**. That is a better answer than the one this note reached, and it is
> recorded here rather than quietly edited out, because the interesting part is that two sessions
> read the same comment and only one of them checked whether its premises were true.
>
> What survives unchanged: this surface is still the channel for everything erasure cannot answer —
> a correction, an objection, a question about what is held, or a request from somebody who is not
> the owner. A viewer cannot close an account and must still be able to ask.

The finding that decided the shape came out of reading the grants rather than the plan:

- `20260908000700_rls.sql` withholds `DELETE` from `organisations`, `workspaces`, `invitations` and
  `api_keys` **deliberately** — "a hard delete of an organisation destroys the audit log and the
  Meta client-list record along with it".
- No code in this repository can delete an `auth.users` row. There is no admin client, no
  `deleteUser`, no path. A human in the Supabase dashboard is the only route, outside this repo and
  unlogged.
- `packages/payloads/src/payloads.ts` has `deleteWorkspacePayloads`, written for exactly the R2 half
  of this problem, **exported, and with no non-test caller anywhere.**
- Retention per category is booked in `AGENTS.md` under "Needs a human, not code".

A product that shipped a "delete my data" button this week would be claiming a capability every one
of those facts denies. What it can honestly do is receive the request, record it where it cannot be
quietly edited, and show the person it was received — and that turns out to be worth more than it
sounds, for the reason in §1.1.

### 1.1 The published rights channel does not work

`/privacy` has always told a data subject to write to the contact address. `AGENTS.md` records,
verified over DNS-over-HTTPS rather than assumed, that the brand domain answers **NODATA for both MX
and TXT** — the zone exists and holds no mail exchanger.

**The published intake for a PDPA s.30–36 right does not receive mail.** So this screen is not an
improvement on a working channel. It is the first channel. That reframes the unit: not a compliance
feature, but the closing of a confirmed defect where a published promise resolved to nothing.

The `/privacy` rights clause now names the screen first and keeps the address as a second route.

### 1.2 What the table refuses

`public.data_requests`, organisation-scoped, `FORCE ROW LEVEL SECURITY`.

`authenticated` holds **`SELECT` and nothing else** — no `INSERT`, no `UPDATE`, no `DELETE`, at any
point, for any role in the organisation. Filing goes through `public.file_data_request`, which takes
the subject from `app.current_user_id()` rather than from the caller, and refuses an organisation
the session is not a member of. Withdrawal goes through `public.withdraw_data_request`, which
matches on `requested_by = app.current_user_id()` — **so an owner cannot withdraw a viewer's
request**. Seniority is not standing.

That last one is the property the whole table exists for. A record the subject can close is not a
record; a record their employer can close is worse.

### 1.3 No deadline is invented

`app.data_request_deadline()` returns `NULL`, and the screen renders the absence in words.

PDPA s.30–36 govern these rights and the period that applies is a question for a Thai-qualified
lawyer. A plausible interval typed into that function would be rendered next to a customer's own
request as a commitment the company is then measured against **by the one person entitled to enforce
it** — which is `coalesce(timezone, 'UTC')`'s failure with higher stakes. `20_data_requests.sql`
asserts the NULL, so establishing the period means deleting that assertion in the same change.

### 1.4 The erasure, when it is built, is nearly one statement

Recorded so the next person does not go looking for a table-by-table script: `delete from
public.organisations` reaches **thirteen of the sixteen tables in `public`** by cascade. Not reached,
each for its own reason — `waitlist` (no foreign key either way: a different data subject and a
different request), `ambient_readings` (Air4Thai station data, no tenant column, not personal data),
and `auth.users` (the reference points *into* `members`, not outward).

The engineering that remains is not the delete. It is who may issue it, what is kept afterwards for
the audit-log and Meta client-list reasons the grants cite, and wiring `deleteWorkspacePayloads`.

## 2. Cost estimate

**Per connected account per month:** N/A. One row per request, filed by hand by a human being. There
is no per-account, per-row or per-night component. Storage is a handful of rows per organisation per
year at the most pessimistic reading, and the two functions are called at human frequency.

## 3. Platform-terms check

18 gates. **2 PASS, 16 N/A, 0 FAIL.**

**Credential** — 1 BYOC `N/A` no platform call. 2 vendor-key `N/A` no data source. 3 token
pass-through `N/A` no MCP surface. 4 credential hygiene **`PASS`** — the table holds no credential;
`subject_note` is free text from a data subject and is bounded, and the error paths return the
database's own code, never a row.

**Tenancy** — 5 RLS **`PASS`** — `organisation_id`, `FORCE` RLS, one `SELECT` policy keyed on
`app.is_org_member`, proved against a hostile `authenticated` session in `20_data_requests.sql`.
6 service-role `N/A` — no service-role key is used; both writes are definer functions called as the
signed-in user. 7 cross-workspace `N/A` — no query spans organisations. 8 cross-customer
aggregation `N/A`. 9 API key scope `N/A`.

**Data movement** — 10 resale `N/A` nothing leaves. 11 Meta client list `N/A` — this PR does not
touch workspace lifecycle; note §1.4 records that the Meta client-list record is one reason the
erasure is not a bare `DELETE`. 12 licences `N/A` no dependency added.

**PII and consent** — 13 hash at the edge `N/A` for the audience path, which this does not touch.
Stated rather than waved: `subject_note` deliberately **can** hold personal data, because a person
describing a request about their own data will write some, and a hashed request is not a request.
It is bounded, never logged, and reaches no model prompt. 14 forbidden payloads `N/A`. 15
per-destination consent `N/A`.

**Access tier** — 16 tier `N/A`. 17 long-lead `N/A`.

**Claims** — 18 **`PASS`**. No new claim. The screen's copy makes no compliance assertion, names no
statute as satisfied, and states no period. `FORBIDDEN_CLAIMS` scans it with every other route.

## 4. What was left out

- **Any deletion at all**, for the reasons in §1. The follow-up is the erasure unit, and it needs the
  retention decision first.
- **The queue side.** Nothing renders open requests to whoever answers them, because `state` moves
  only through functions no role can yet call. That is deliberate — an admin screen that could
  resolve a request is exactly the privilege §1.2 withholds — but it means fulfilment today is a
  human reading the table. Named so it is a known gap rather than a discovered one.
- **Notification.** Nobody is told a request arrived. Email is behind the same missing DNS record as
  everything else (`70-the-mail-nobody-can-send-yet.md`).
- **`workspaces.client_contact`**, an unconstrained free-text column designed to hold a third
  party's contact details, in a table no policy permits hard-deleting. Found during this unit,
  widens issue #53, and is not this PR's to fix.
- **Retention periods per category** — a founder and lawyer decision, unchanged.

## 5. Open or unverified spec items this builds on

- **The PDPA response period is unestablished.** Everything here is built to render its absence
  rather than depend on its value, so establishing it later is additive.
- **`AGENTS.md` gap 1 was corrected by this unit rather than relied upon.** It listed
  `restatement_events` among tables nothing deletes. The prune *exists* — 30-day retention, granted
  to `app_webhook`, cron declared and dispatched — and **never runs**, because `src/index.ts` passes
  `store: null` and `handleScheduled` returns `not_configured` before reaching it. The conclusion
  was right; the mechanism was not what the text implied. A retention control that is written,
  tested, granted, scheduled and unreachable is worse than an absent one, because every artefact
  says it is covered. Corrected in place.

## 6. Verification

SQL suite green against a live PostgreSQL 16: **25 assertions in `20_data_requests.sql`, 0 failed.**
Full gate green by exit code, including `pnpm -r build` for both apps.

**`run-local.sh` now enumerates the suites instead of listing them.** Its own comment recorded that
`13_scheduler_entry_point.sql` had shipped beside its migration and never been wired in — "a test
nothing runs is indistinguishable from a test that passes" — and was fixed by adding one more
hand-written line, which fixed that instance and left the mechanism. `20_data_requests.sql` hit it
immediately: written, present, and silently not run. The list is now the filesystem, ordered by
`sort -V`.

### Mutation proofs

| Mutation | Test that went red |
|---|---|
| `grant select, update` to `authenticated` | `an owner cannot resolve their own request`, `an owner cannot write a resolution note`, `authenticated holds no UPDATE on data_requests` |
| `app.data_request_deadline()` returns `interval '30 days'` | `no statutory period is invented`, detail `30 days` |
| Removed the `is_org_member` check from `file_data_request` | `a member of another organisation cannot file against this one` |
| Dropped `requested_by = app.current_user_id()` from the withdrawal | `an owner cannot withdraw somebody else's request` **and** `the subject can withdraw their own request` — the second is the one that matters: a guard removed in the permissive direction also broke the legitimate path |
| `pendingNote` replaced with "We will respond within 30 days" | `says in words that no response time is published`, naming the phrase |
| `listEmpty` replaced with "Your data has been deleted" | `does not claim anything has been deleted` |
| Added `/data-requests` without adding it to `PRIVATE_PATHS` | `are exactly the routes that asked not to be indexed` — **this one fired unprompted**, during ordinary development, which is the only real evidence a guard works |

One mutation failed to apply and reported green: the first attempt at the deadline copy used an
anchor Biome had already reformatted, so the replacement matched nothing and the suite passed for
the wrong reason. Re-applied against the real text; it then failed as it should. Recorded because it
is the same trap this repository has hit before, and the reason every mutation above was checked to
have landed before its result was believed.
