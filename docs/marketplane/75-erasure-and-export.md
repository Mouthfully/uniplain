# 75. Erasure and export, and the reason the schema refused them

**PR:** TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

`/account`. A member downloads everything the account holds as one JSON file; an owner closes the
account outright, which removes the organisation and everything that cascades from it.

PDPA **s.31** (portability) and **s.33** (erasure). Both are laws that already bind this
controller — s.5 binds a controller located in the Kingdom and `brand.legalEntity` is a Thai
juristic person — rather than features to be scheduled. That is why they came before the things
that are easier to build.

## 2. Why the schema did not have them, and why that reasoning expired

`20260908000700_rls.sql` says, in its grant block:

> Deliberately no DELETE on organisations, workspaces, invitations or api_keys. Each is retired by
> setting `deleted_at` or `revoked_at`, because a hard delete of an organisation **destroys the
> audit log** and the **Meta client-list record** along with it.

Sound when written. Two thirds of it no longer holds:

- **There is no audit log.** No table records who did what, anywhere in this schema. Issue #63 is
  open precisely because nothing does. A retention argument cannot rest on an artefact that does
  not exist.
- **There is no Meta client-list record either.** No Meta onboarding exists, gate 11 is `N/A` on
  every design note to date, and no table holds a client's legal entity name.

And CLAUDE.md is blunt about what the alternative does to the promise: *"Soft-deleted rows staying
readable is the usual way 'delete my data' quietly fails to mean anything."* A `deleted_at`
timestamp makes a tenant invisible. **It does not erase them.**

## 3. The cascade is the whole mechanism

One `delete from public.organisations`. Every foreign key that reaches an organisation is already
`on delete cascade`, directly or through `workspaces`.

**Nothing in the function enumerates those tables**, and that is the design. A list is a second
place the schema is written down, and the one that goes stale the first time a table is added.
`20260913000600_membership_guards.sql` already returns early from the owner-count guard for exactly
this reason: *"refusing that cascade would make an organisation undeletable"*.

`19_erasure.sql` matches it: section 3 reads **`pg_class` for every table in `public` carrying an
`organisation_id` or a `workspace_id`** and asserts nothing anywhere still names the erased tenant.
A table added tomorrow is covered on the day it lands; a table added with a *non-cascading* key
fails here rather than quietly keeping a customer's rows. Same shape as `15_force_rls.sql`, and for
the same reason — **do not convert either into a list of names.**

## 4. Every way it refuses

| Refusal | Why it is not merely a screen rule |
|---|---|
| **Owner only**, not `is_org_admin` | Every other administrative act is owner-or-admin. An admin is a delegate, and ending the business is not a delegated act — the argument `members_owner_changed_only_by_owner` already makes, applied to the account. |
| **The typed name, compared exactly** — no trim, no case fold | A confirmation enforced only by a form is absent from every other caller. A customer who cannot reproduce their own account's name has not confirmed anything. |
| **A live subscription refuses** | Erasing `subscriptions` tells the payment processor nothing. A customer who erased here would keep being charged with nothing left to show them why — a wrong number that looks right, in money. Four of the eight statuses count as live: `active`, `trialing`, and — the two worth arguing for — `past_due` and `unpaid`, because both mean the processor is still trying to collect. |

## 5. What it cannot reach, said on the page rather than discovered

**The sign-in record.** `public.members` references `auth.users`, never the other way round, so the
cascade runs *away* from the login. Removing it needs the Auth admin API and therefore a
service-role credential; this function does not have one and is not getting one.

**Archived platform responses — there are none.** `putPayload` and `putBufferedPayload` are
exported from `@repo/payloads` and called from nowhere under `apps/api-edge/src`. The R2 bucket has
never had anything written to it. `deleteWorkspacePayloads` exists too, is tested five ways
including *"is idempotent, so a retried erasure is not an error"*, and also has no caller. **When
something starts writing payloads, that change owns wiring the erasure**, and the migration's
comment is the note it should fail against.

**Anything the payment provider holds.** Hence the refusal above.

All three are printed **above** the button, not under it. A customer pressing it believes they are
gone; a footnote after the fact is a sentence nobody reads at the moment it matters.

## 6. The export, and the column that must never be in it

Every table **names its columns**. There is no `select *` in `_export.ts`.

`connections` is why. A tenant *can* select `credential_ciphertext`, `credential_iv` and
`wrapped_dek` — `connections_select` allows it deliberately, because the scheduler needs the
ciphertext and reading it yields nothing without the KEK, which lives in Cloudflare. So nothing in
the database stops a credential reaching an export; only this module does.

And an export is a file a customer emails to their accountant or drops in a shared folder. **Sealed
or not, a credential belongs to the boundary that holds it**, and the moment it is in a downloaded
file it is outside that boundary for good.

A failed read **refuses the whole export**. A file that silently omits a table is worse than no
file: the customer believes they have everything, and the missing thing is the one they will need.
`_figures.ts`'s three-branch rule, applied to a download.

It is a route handler rather than a server action, because an action cannot set
`Content-Disposition`, and the alternatives put a tenant's whole dataset through the document. The
filename carries **the date and not the organisation's name**: a download lands in a shared folder
as often as not, and the business name is the one identifier in that file a stranger could read
without opening it.

## 7. Cost estimate

**Per connected account per month:** `$0.00`. One function, one route, no platform call, no
scheduled work, no R2, no KV, no model call. The export is a handful of selects on a page load a
customer initiates perhaps once in the life of the account.

## 8. Platform-terms check

**1–3.** `N/A` — no platform call, no company-held key, no MCP surface.
**4. Credential hygiene.** `PASS`, and this unit's sharpest gate. The export could trivially have
carried the sealed credential and the database would not have stopped it; `_export.test.ts` asserts
the absence by column name and refuses a wildcard select.
**5. RLS.** `PASS` — no new table. `delete_organisation` is definer with the owner predicate in the
body; `19_erasure.sql` proves cross-tenant refusal from a real `authenticated` session.
**6. No service-role bypass.** `PASS` — and the one thing that *would* need a service-role key,
deleting `auth.users`, is refused and disclosed rather than built.
**7–9.** `PASS`/`N/A` — one organisation per call, nothing aggregates, no API-key path.
**10. No resale or redistribution.** `PASS` — the export moves a customer's data to the customer.
**11–12.** `N/A` — no Meta surface, no new dependency.
**13. Hash at the edge.** `PASS` — the export carries no buyer identifiers; `envelope_rows` never
held them.
**14–17.** `N/A`/`PASS` — no forbidden payload, no destination, no quota, no new approval.
**18. Claim provenance.** `PASS` — `/privacy` and `/terms` are updated in the same change, and
both keep saying there is no retention period, because there still is not one.

**Result:** `11 PASS, 7 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Named test that went red |
|---|---|
| gate on `is_org_admin` instead of owner | *an ADMIN cannot erase the organisation* — **see below** |
| drop the typed confirmation | *the confirmation is compared exactly, not case-folded*, and four more |
| erase while a subscription is live | *a live subscription refuses the erasure* |
| delete the members instead of the organisation | *no table in public still holds a row for the erased organisation* — reports `subscriptions=1 workspaces=1 …` |
| drop the `revoke … from public, anon` | `07_anon_grants.sql`, three suites earlier |
| export the sealed credential columns | *names none of the sealed credential columns* |
| `select *` on `envelope_rows` | *selects named columns everywhere, never a wildcard* |
| delete the sentence about the surviving sign-in record | *says the sign-in record survives…* |

**The first one passed, and that is the entry worth keeping.** Replacing the owner check with
`app.is_org_admin` left the whole suite green. The admin got past the function's own gate, reached
the `delete`, and was stopped one layer down by `members_owner_changed_only_by_owner` from note 72:
the cascade into `public.members` tries to remove an **owner** row while the actor is an admin, and
that trigger raises `42501` too. **Two different refusals, the same SQLSTATE, and a test that could
not tell them apart.**

The assertion now checks the message, not just the class. Two things follow. The membership trigger
is a genuine second floor under this operation, which is a good accident. And the same mutation
exposed why the real code says `is distinct from` rather than `not`: with `not app.is_org_admin(…)`
a **non-member** gets `NULL`, `not NULL` is falsy, and the gate opens.

**A second fix went in for the same reason.** Removing the confirmation check made the first
refusal probe *erase* the fixture; the assertions noticed, but the suite then died on a foreign key
and never reached its report — failing with a message about `billing_customers` that told the next
person nothing. The billing fixtures are now `where exists` guarded. **A suite that dies before it
can say what failed has thrown away the only thing it was for.**

SQL suites **19**, 14 new assertions. `apps/web` **417 tests**.

## 10. What was left out

**No two-stage erasure.** A request-then-drain design would let a customer change their mind inside
a grace period, and needs a scheduler. This erases at once, which is what the copy says.

**No retention schedule**, and `/privacy` still says so. The period is a founder decision with
their accountant — Thai accounting retention is real and nothing in this repository states it, and
inventing a number is exactly what CLAUDE.md forbids.

**No erasure for a person who is not an owner of anything**: a waiting-list address, or an invitee
whose address sits in somebody else's `invitations` row. `public.waitlist` has no policy for any
command and no read path for any tenant role. That is an operator surface and a separate unit.

**Nothing cancels the subscription.** The erasure refuses while one is live rather than cancelling
it, which is the honest half of not having built cancellation yet.
