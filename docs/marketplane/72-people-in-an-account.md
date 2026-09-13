# 72. People in an account, and the door that only opens outwards

**PR:** #62 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

A customer can now add somebody to their account, choose what that person may do, take an
invitation back, change a role, and remove a member. `/members` lists who is in the account and
what is waiting; `/join` is where an invited person accepts.

**The decision: the database owns every rule, and the screen owns none of them.** Two new
triggers, not two `if` statements in a server action. The alternative — checking roles in
`actions.ts`, where it is easy to read and easy to change — puts the rule in the language least
likely to be opened during an audit, and leaves the same rule unenforced against anything that is
not this page. `18_membership_guards.sql` proves both rules against a real `authenticated` session.

Almost none of the schema was missing. `invitations`, its hashed token, its partial unique index,
`accept_invitation` and the full set of `members_*` policies have been there since 8 September.
What was missing was an application, one read path, and — the part worth the note — two rules that
only became reachable the moment a screen existed to reach them.

## 2. The one-way door

`members_update` and `members_delete` are gated on `app.is_org_admin`, which is true for **owner
and admin alike**. That was sufficient while nothing could call them: an organisation got exactly
one member, from `create_organisation`, and no surface offered to change it.

A members page offers both, and the policy is then the whole of the authorisation on an operation
that can end an account:

| | What `is_org_admin` alone permits | Why it cannot be permitted |
|---|---|---|
| **The last owner leaves** | an admin deletes the owner, or the owner demotes themselves | `organisations_update`, `members_insert`, `members_update`, `members_delete`, `invitations_insert` and every workspace grant are gated on `is_org_admin`. An organisation with no owner cannot invite, promote, rename itself or grant anything, **from any account, ever again** — and there is no support tool that reaches in. |
| **An admin removes an owner** | yes | An admin is a delegate. A delegate removing the principal who appointed them is the escalation shape an account takeover uses: compromise the weaker account, remove the stronger one, keep the business. |

Neither is a permission error a customer backs out of. The first is irreversible from inside the
product.

**Why a trigger and not a policy.** A policy sees one row at a time and cannot count what is left
after the statement. "At least one owner must remain" is a property of the table *after* the write.
Writing it as policies would also mean writing it four times — update and delete, for each rule.

**And not a permissive policy**, per CLAUDE.md: a policy added to keep a definer writer working
applies to `authenticated` too. Every definer writer in this schema reaches a FORCED table through
*no* policy, on the strength of the owner holding `BYPASSRLS`.

## 3. The bug that only a real session would have found

The first version of the owner-count guard was an ordinary trigger function. The last owner deleted
themselves and the suite stayed green.

It ran as `authenticated`, under the caller's own row-level security. The instant that member row
is gone, `app.is_org_member` is false for that session — so `organisations_select` hides the
organisation and `members_select` hides every remaining member. The guard read an empty table and
took the one branch written to let an organisation's deletion cascade through.

**An invariant about a table cannot be enforced through a view of it that the writer's own statement
has just narrowed.** It is `security definer` now, and the mutation that removes that word turns
five assertions red, including two that show an admin's ordinary work failing — because the count
then reads through a narrowed view in the other direction too.

This is the same class as note 63's finding, one layer up. A guard proved only as the table owner
has not met the principal it exists for.

## 4. The escape hatch, which is also a legal obligation

The guard returns early when the organisation no longer exists. Without that, `on delete cascade`
from `organisations` hits the owner rule and **an organisation becomes undeletable** — the same
one-way door facing the other way, and a straightforward breach of PDPA s.33. Deleting that branch
turns `13_scheduler_entry_point.sql` red, three suites before this unit's own.

## 5. Reading a colleague's name without opening `auth.users`

`members` holds `user_id` and nothing a person would recognise. `authenticated` holds no grant on
`auth.users` — correctly: a tenant role able to read it could enumerate every user of the platform.

`public.organisation_members(uuid)` is one `security definer` function that joins the address, with
the tenancy predicate in the body. It returns **member id, email, role, created_at and no user id**:
a screen needs to name a person and act on their membership, `members.id` does both, and
`auth.users.id` would be a second identifier for the same person to accumulate and join against
elsewhere. Asking for another organisation **raises** rather than returning empty — an empty set is
indistinguishable from an account with no members, and a screen built on that difference tells a
stranger "this account is empty" instead of "not yours".

**A negative finding worth writing down:** the `grant execute … to authenticated` on that function
**cannot be mutation-proved**. Deleting it leaves the suite green, because a hosted project ships
`alter default privileges in schema public grant all on functions to anon, authenticated,
service_role`. The line stays — that default is platform behaviour this repository does not own, and
the revoke beside it is one word away from taking the privilege from every customer — but the
comment claiming it was "the direction nothing else would catch" was false and has been corrected in
place. A comment that claims a guard it does not have is worse than no comment.

## 6. The invitation is a bearer credential, and the notice nobody else will give

**The token.** 32 random bytes from `crypto.getRandomValues`, base64url. Only its SHA-256 is stored,
`accept_invitation` takes the hash, and the link is shown **once** — in the response to the request
that created it. It is not recoverable by anybody, us included, and the copy says so rather than
leaving an admin hunting for a "resend" button that cannot exist.

CLAUDE.md bans an unsalted hash as a substitute for deleting an identifier. That ban is about
**enumerable inputs**: an email address is reversible by anyone holding a list of addresses. A
256-bit random token is not, so the same construction is correct here and wrong there. The two cases
look alike and are not.

**Accepting is a POST behind a button.** A link that granted membership on GET would be accepted by
every mail scanner, link previewer and corporate proxy that touched the message — consuming a
one-use invitation before the person saw it, and recording an acceptance nobody made.

**Every failure is one sentence.** `accept_invitation` returns the same refusal for "no such
token", "already accepted", "withdrawn" and "expired". Distinguishing them would let somebody
working through guessed tokens learn which had ever been real.

**Withdrawn, not deleted.** The row records that an address was entered and that the invitation was
taken back. Deleting it erases the fact that the collection happened, which is precisely the record
a person exercising a PDPA s.30 access request is entitled to see.

**And the notice.** An admin typing a colleague's address is collecting a **third party's** personal
data: that person has visited nothing, agreed to nothing, and may not know the account exists. PDPA
s.23 entitles them to be told who holds their data and why, at or before collection. Nothing can
send mail (note 70), so the notice is handed over by the admin — which is only possible if the page
prints it. `MEMBERS_COPY.noticeBody` is that notice, `invitationEmail` is what takes the job over
when the DNS lands, and `/privacy` gains a clause for the one row in its inventory whose subject
never visited the site.

`invitationEmail` interpolates **the link and nothing else** — not the inviter, not the business,
not the role. An invitation naming a business tells whoever holds that address, possibly a former
employee and possibly a typo, that the business uses this product.

## 7. A write that changed nothing is not a success

**Row-level security does not raise on a write it disallows.** It removes the row from the
statement's view, so a forbidden `update` or `delete` returns success having touched nothing: an id
from another organisation, a member somebody removed a second earlier, an invitation already
accepted. All three come back with no error at all.

Reporting those as done is this repository's own failure mode wearing different clothes — the screen
says the colleague was removed, the admin believes it, and the colleague is still reading the
takings. Every write asks for the rows it changed and refuses when there are none.

## 8. What the screen decides, and what it does not

What `_table.tsx` offers is a function of the reader's role; what the database **allows** is decided
by the policies and the two triggers. Those are not the same thing and are not meant to be — a
hidden button is a courtesy, never a control. The rules in the component are deliberately
**generous** rather than strict: showing a control the database then refuses produces one clear
sentence, while hiding one it would have allowed produces a customer who believes the product cannot
do it.

**Owner is not an invitable role.** An invitation is accepted by whoever holds the link; one
conferring ownership would hand the whole account — billing, every source, the right to remove
everyone else — to an address typed into a form. Promoting an existing member is a separate,
deliberate act against a person already known.

## 9. Cost estimate

**Per connected account per month:** `$0.00`. No platform call, no scheduled work, no R2, no KV, no
model call. Four rows at most in `invitations` per account and one per member, on Supabase disk at
$0.125/GB — unmeasurable at this size. Nothing here touches the scheduler, so the redundant-polling
ratio in section 8's open question is unchanged.

## 10. Platform-terms check

**1. BYOC.** `N/A` — no platform call.
**2. Vendor-key exception.** `N/A` — no company-held key.
**3. No token pass-through.** `N/A` — no MCP surface, no upstream OAuth.
**4. Credential hygiene.** `PASS` — the invitation token is a credential and is treated as one:
hashed before storage, absent from every error, every refusal state and every log. Asserted, not
asserted-about: a test spies on all five `console` methods across the happy path and three refusals.
**5. RLS.** `PASS` — no new table. Both new triggers sit on `public.members`, which already carries
`organisation_id` under FORCE RLS, and `17`/`18` prove cross-organisation refusal from a real
`authenticated` session.
**6. No service-role bypass.** `PASS` — every read and write runs under the caller's session.
`organisation_members` is `security definer` for the `auth.users` join only, with the tenancy
predicate in the body; the two trigger functions are definer to see the table they guard. No
service-role key is introduced.
**7. No cross-workspace read.** `PASS` — every query is one organisation's.
**8. No cross-customer aggregation.** `PASS` — nothing aggregates.
**9. API key scope.** `N/A` — no API key path.
**10. No resale or redistribution.** `PASS` — an invitation moves no platform data. It moves one
email address, to the person it belongs to.
**11. Meta client list.** `N/A` — no Meta surface.
**12. Dependency licences.** `PASS` — no new dependency.
**13. Hash at the edge.** `PASS` — an email address reaches the database because an account is made
of one, which clause 2 of `/privacy` already discloses. Nothing here puts one in a payload, an
archive or a model prompt; `InsightRow` is untouched.
**14. Forbidden payloads.** `PASS` — the only field collected is an email address.
**15. Per-destination consent.** `N/A` — no destination.
**16. Tier reality.** `N/A` — no quota consumed.
**17. No new long-lead dependency.** `PASS` — none. The one absent capability is the domain's mail
DNS, which is note 70's and already on the founder's list.
**18. Claim provenance.** `PASS` — `forbidden-claims.test.ts` scans every source under
`apps/web/app`, which now includes both new routes; `packages/email` runs the same list over the new
template.

**Result:** `13 PASS, 5 N/A, 0 FAIL`

## 11. Mutation testing

| Mutation | Named test that went red |
|---|---|
| drop the owner-count trigger | *the last owner cannot delete themselves*, *…demote themselves*, *an admin cannot remove an owner* |
| drop the owner-roles trigger | *an admin cannot demote an owner even when another owner remains*, and *an admin cannot remove an owner* reports "stopped by the owner count rather than by the roles rule" |
| remove `security definer` from the owner-count guard | five red, including two showing an admin's ordinary work breaking |
| remove the deleted-organisation early return | `13_scheduler_entry_point.sql`, three suites earlier |
| treat a write that changed no row as done | *refuses when the write changed no row* |
| drop the already-a-member check | *refuses an address that is already a member* |
| offer `owner` as an invitable role | *refuses a role nobody may be invited as*, *does not offer owner* |
| a token generator that repeats itself | *does not repeat itself* |
| store the token instead of its digest | *stores a digest and never the token itself* |
| let the role list drift from the enum | *matches `app.member_role` in the migration exactly* |
| `console.error(error, token)` on a refusal | *logs nothing, on any path* |
| trim the notice to "Let them know it is coming." | *still tells the admin to say who they are…* |
| delete the grant to `authenticated` on `organisation_members` | **nothing.** See §5 — recorded rather than papered over |

All reverted. SQL suites **18** (was 16 -- this unit adds both `17` and `18`), `apps/web` **373
tests** (was 352), `@repo/email` **26** (was 23).

**And one the suite caught on me twice.** The first `17_organisation_members.sql` reused
`a1111111-…`, already inserted by `14_ambient.sql` as a different person, and `on conflict (id) do
nothing` kept the existing row — so the membership joined to somebody else's address. That was the
lucky outcome: had the collision landed on a row the suite only counts, it would have passed while
testing nothing. Both new suites now use identifiers unique to themselves and **no conflict
clause**, so a future collision is a unique violation that stops the run. This is the hazard note 63
§7 wrote down about `app_test.results` — it applies to `auth.users` and `public.organisations`
fixtures too.

Then: `18`'s first draft wrote its assertions inside transactions it rolled back, and the assertions
rolled back with them. Seven of twelve ran and all seven passed. **The floor caught it**, which is
the entire argument for floors.

## 12. What was left out

**No expiry sweep.** Nothing purges expired or withdrawn invitations. The partial unique index
already allows re-inviting, so this is retention rather than function — and the retention period is
the founder's to set, not a number to invent. Issue, not scope creep.

**No audit log.** Who removed whom and when is not recorded anywhere a customer can read. `members`
carries `updated_at` and no history. For an owner-run business with three staff this is a real gap
only when there is a dispute; naming it here is cheaper than discovering it during one.

**Nothing sends the invitation.** The template exists and no caller does, for note 70's reason.
While `/access` password-gating is on, an invited colleague also needs the access password — the
gate is deliberately default-deny and adding `/join` to its allow-list is a decision for whoever
turns the gate off, not a side effect of this PR.

**No transfer of ownership as one action.** Making somebody else an owner and then demoting yourself
is two steps, and the guard makes the order matter. A single "transfer ownership" action would be
kinder and is a different unit.

**No self-service leave.** A member cannot remove themselves; an admin does it. `members_delete` is
admin-gated and widening it is a policy change with its own note.

**No per-workspace grants on the screen.** `invitations.workspace_ids` and `workspace_members` exist
and this surface always invites at organisation level, so analyst and viewer are offered with no way
to say *which* workspace. Honest but incomplete, and the reason analyst/viewer are described in the
copy as reading "the workspaces they are given" rather than "your data".
