# 87. The trail that had no writer

**PR:** [#73](https://github.com/Mouthfully/uniplain/pull/73) &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

Issue #63 asked for a membership history, and the right answer turned out to be **not to build
one**. `public.security_events` already exists — append-only, `FORCE ROW LEVEL SECURITY`, no UPDATE
or DELETE grant for any role, one definer writer — and its event enum already declares
`member_role_changed` and `member_removed`.

What it did not have was a caller for either. This wires them, and puts the result on `/members`.

## 2. The failure this repository keeps finding, found again in its own fix

`20260913001300_wire_security_trail.sql` exists **because** `20260913001200` added
`record_security_event` and nothing called it. Its opening comment names the pattern and lists two
previous instances:

> `deleteWorkspacePayloads`, exported for the R2 half of an erasure and never wired;
> `app.prune_restatement_events`, written, granted, scheduled and unreachable because the Worker
> passes a null store. Both read as covered from every artefact except the one that matters. **An
> audit trail nothing writes to is the same object.**

That migration then wired **one** of the eight declared event types. Six were still unreachable
when this change started; this closes two of them. The remaining four —
`connection_created`, `connection_revoked`, `credential_sealed`, `api_key_created`,
`api_key_revoked` — are named in §7.

The lesson is not "somebody was careless". It is that **a declared enum member reads as a
capability**, and nothing in the repository could tell a declared one from a reachable one. §5 is
what changes that for these two.

## 3. A trigger, not a definer the screen calls

The previous wiring put the recording *inside* `file_data_request`, which was right: that act
already went through a definer, so the insert and the event are one transaction.

Membership has no such function. `/members` changes a role with an ordinary `update` and removes a
member with an ordinary `delete`, both through RLS. The options were to add a definer and route the
screen through it, or to use a trigger.

**A trigger, for the reason `20260913000600_membership_guards.sql` already gives about its own
rules: a server action is one caller among several.** A trigger catches the screen, a future bulk
tool, a support session and a migration alike — and it keeps the atomicity argument, because it
runs in the transaction of the statement that fired it.

## 4. Three ways it could have taken something else down

**It inserts directly rather than calling `record_security_event`.** That function opens with
`if not app.is_org_member(…) then raise`, which is correct for a call arriving from an application
and wrong here twice: an organisation being **erased** deletes its members while the organisation
row is already gone, so the membership test fails and the `RAISE` aborts the erasure — turning
"delete my data" into an error. And a migration repairing a row has no session at all.

**It returns early when the organisation is gone**, the same escape hatch
`assert_organisation_keeps_an_owner` needs and for the same reason. Removing it fails
`13_scheduler_entry_point.sql` — **three suites before this one's own**, which is how you know the
hatch is load-bearing rather than defensive.

**It files nothing for an update that changes no role.** `accept_invitation` touches `updated_at` on
a member who is already there, so recording every `UPDATE` would file an event each time somebody
re-accepted an invitation — noise in the one table that has to stay readable after an incident.

## 5. What is recorded, and the limit that is printed on the page

`subject_id` is the **member id**, not the person's address. The address is personal data with its
own retention question, and this table has **no retention period at all** — so putting one here
would build a store of identifiers nothing ever expires, in a table every member of the
organisation can read.

The consequence is real and is stated on the screen rather than hidden: a member still in the
account resolves to their address; **one who has been removed does not resolve at all.** The trail
answers *"what happened to this membership"* completely and *"who was that"* only while they are
still here.

`detail` carries the roles — `viewer -> analyst`, `role at removal: analyst` — which are a closed
vocabulary and not personal data, inside the table's own 200-character bound.

## 6. It does not become the audit log

`CLAIMS`' `audit-log` entry promises *"Every query, export and API key is logged"* and stays
**withheld**; `surface:audit-log` is deliberately absent from `AVAILABLE_CAPABILITIES` and this
change does not add it. Two of eight event types, on one surface, is not that claim — and
`_content.test.ts` refuses the words *"audit log"*, *"full audit"* and *"every query/action/access"*
anywhere in the members copy, so the section cannot quietly grow into the promise.

The page says the same thing in its own words: *"Connecting a source or creating an API key is
recorded too, and is not shown here."*

## 7. Cost estimate

**Per connected account per month:** `~$0.00`. One row per role change or removal — a handful over
an account's life — on Supabase disk at $0.125/GB. The read is bounded at fifty rows per page load.

## 8. Platform-terms check

Gates 1–4, 9–17: `N/A` or `PASS` — no credential, no platform call, no quota, no dependency.
**5. RLS.** `PASS` — no new table; `security_events` already carries `organisation_id` under FORCE
RLS with a member-gated select policy, and `24_membership_trail.sql` proves an admin can neither
rewrite nor delete it.
**6. No service-role bypass.** `PASS` — the writer is a definer trigger reaching a FORCED table
through **no** insert policy, on the owner's `BYPASSRLS`. A permissive insert policy would be one
line and would let every `authenticated` session write its own trail entries, which is the one
thing an evidence table must not allow.
**7. No cross-workspace read.** `PASS` — one organisation, `workspace_id` deliberately null.
**13. Hash at the edge.** `PASS`, and it is the gate this unit is really about: the trail holds an
opaque member id rather than an address, by the argument in §5.
**18. Claim provenance.** `PASS` — see §6.

**Result:** `7 PASS, 11 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Named test that went red |
|---|---|
| drop the trigger | seven, beginning *a role change files an event* |
| record every update, not only a role change | *an update that changes no role files nothing* — `6 -> 7` |
| remove the erasure escape hatch | `13_scheduler_entry_point.sql`, three suites earlier |
| record only the new role | *and it names both roles rather than only the new one* |
| drop the revoke on the writer | *anon cannot execute the membership trail writer*, and the `authenticated` twin |
| collapse "unreadable" into "nothing happened" | *has a different sentence for an unreadable history and an empty one* |
| trim the reason somebody is unnamed | *says why somebody who has left is not named* |
| rename the section "Full audit log" | *scopes itself to membership rather than implying a complete log* |

SQL suites **26**, 14 new assertions. `apps/web` **31** in the members suite.

## 10. What was left out

**Four event types still have no caller**: `connection_created`, `connection_revoked`,
`credential_sealed`, `api_key_created`, `api_key_revoked`. Each needs the same treatment at the
place the act happens, and the connection ones sit in the Worker rather than in a migration, which
makes them a different unit rather than more of this one.

**No retention period, and therefore no prune.** The period is a founder decision and nothing in
this repository states one. That is also *why* §5 keeps an id rather than an address: a store with
no expiry should hold as little as it can.

**The actor is not resolved to a name.** `security_events.actor` is an `auth.users` id, and this
app has no read path for that table at all — which is the entire reason
`public.organisation_members` exists. Resolving it would mean widening that function or adding a
second one, and the events a person cares about most are the ones about themselves, which are
already legible from the subject and the date.
