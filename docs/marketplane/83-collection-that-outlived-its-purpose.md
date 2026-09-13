# 83. A collection path that outlived its purpose, and an erasure that would have gone quiet

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Two defects of the same species: **a fact published about the system that the system had stopped
making true.** One is live and closed here. One is latent and made impossible to ship quietly.

**The live one.** `public.join_waitlist` was `EXECUTE`-able by `anon`, which is the internet — the
anon key ships in browsers, that is what it is for. The grant was correct when written: the product
was pre-launch, every page offered to take an address, and someone offering one is by definition not
authenticated. Then the waiting list was removed. `/waitlist` became `/access`, the form went, the
server action went, and the function's only caller went with them. **The grant stayed.** A write path
into a table of email addresses, open to the internet, with no page in front of it and no purpose
behind it.

Meanwhile `_processing/activities.ts` publishes the record of processing at `/processing`, and its
`waiting-list` entry says, in capitals, **"COLLECTION HAS ENDED."** That is a statement of fact in a
compliance artefact addressed to a regulator and to a customer's counsel, and the grants in this
schema contradicted it.

Under the PDPA this is substantive rather than formal. Collecting personal data for a purpose that
no longer exists has no basis, and consent given "to be told when access opened" cannot cover a
collection made after that offer was withdrawn.

**The decision: close the collection, do not touch the rows.** Migration `20260913001500` revokes
`EXECUTE` from `anon`, from `authenticated`, and from `PUBLIC`. It drops no table, deletes no row,
and drops no function.

That split is the whole design. Addresses already submitted belong to real people who may have been
promised something, and discarding them is a decision for someone who knows whether anyone was —
`/access` already says exactly that, and `/privacy` discloses that they are held. A "fix" that closed
the path by dropping the table would satisfy every assertion about collection and would be the more
serious act. So `23_waitlist_closed.sql` **asserts the rows survive**, which is the assertion that
goes red if someone later tidies up by deleting what they find unused.

Collection stops today; retention stays the founder's call; neither waits for the other. The function
is kept rather than dropped so that reopening a waiting list is a deliberate grant rather than a
rewrite.

### 1.1 The justification was in a comment, which is why nobody noticed

`07_anon_grants.sql` maintains the allow-list of anon-executable functions, and admitted this one
with a careful paragraph:

> "It is the one function in this schema that is MEANT to be called by a stranger: the product is
> pre-launch and the people signing up are by definition not authenticated."

**That sentence was true, and stopped being true without moving.** The reasoning was sound on its own
terms — one address in, one row written, nothing read back, `on conflict do nothing` so it cannot
even be used to ask whether an address is already on the list — and the entry still came out wrong,
because the product state it depended on changed and the comment did not.

The old text is kept in the file rather than deleted, as the record of how a sound argument produced
a wrong grant. **A grant justified by a product state has to be revisited when the product state
changes, and the only thing that makes that happen is the list being short enough to read.**

### 1.2 The drift guard's own failure message had drifted

Removing the entry turned up the same defect one layer down. The assertion that fires when an
unexpected function is anon-executable opened with:

> "Three functions are meant to be: two gated on possession of an API key hash, and the
> waiting-list write, which is meant for strangers and can read nothing back."

Hard-coded prose beside the array it describes. It was still saying "three" and still naming the
waiting-list write **after** that grant was revoked — so the failure text of the drift guard was
itself a piece of drift, describing a schema that no longer existed. The count and the list are now
derived from `v_expected` with `cardinality()` and `array_to_string()`. A number in prose beside an
array is a number that will disagree with the array.

### 1.3 The latent one: an erasure that would have gone quiet

`deleteWorkspacePayloads` is written, exported and tested, and **has no production caller.** In an
erasure path that reads like an oversight. It is not one: `putPayload` and `putBufferedPayload` have
no production caller either. The R2 archive holds nothing, so there is nothing to fail to delete.
Today the two absences cancel out exactly.

**The day they stop cancelling is the day it becomes a live defect, and it will be silent.** Wiring
the archive into ingest is a feature with an obvious success condition — payloads appear in R2, and
whoever ships it will be watching for that. Nothing about that change surfaces the erasure half.
`public.delete_organisation` cascades through thirteen tables and cannot reach a bucket, so
`/account` would go on reporting a closed account — correctly, about Postgres — while the customer's
platform data sat in object storage, still billed for, after they asked for it to be gone.
`19_erasure.sql` would stay green throughout: it reads `pg_class`, and a bucket is not in the
catalogue.

That is the shape CLAUDE.md calls the worst possible outcome. Not an error, not a blank: **an answer
that looks right.** "Your account is closed" is a wrong number of exactly that kind, and the person
it misleads is the one who asked to be forgotten.

So `scripts/check-erasure.mjs` makes the coupling enforced rather than remembered: **if a shipping
module calls a payload write, some shipping module must call the workspace delete.** It says nothing
about where, how, or on what schedule — that is the design of whoever wires the archive up. It says
only that shipping one half alone fails the build, with the reason attached to the failure.

The converse is deliberately not checked. A delete with no write is harmless and is the state today;
asserting it would mean deleting a tested function in order to go green.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work, and the change is subtractive. One `revoke` on a function with no caller,
one SQL suite, one build-time source scan. No table, column, index or row is added; no platform
call, model call or scheduler work is introduced. Nothing here touches the ingest path, the
restatement ladder, or the polling ratio section 8 flags as the margin risk.

Strictly, closing an open anon write path **removes** an unbounded cost line: a stranger could insert
an unlimited number of distinct addresses into `waitlist`, each a row on Supabase disk — the line
section 7 names as most likely to break. It was never metered, because it was never a feature.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call anywhere in the diff.

**2. Vendor-key exception.** > `N/A` — no company-held key; no data source contacted.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface touched.

**4. Credential hygiene.** > `PASS` — no credential in the diff. The revoked function never handled
one.

### Tenancy

**5. RLS.** > `PASS` — no new table. `public.waitlist` keeps `FORCE ROW LEVEL SECURITY` with no
policy for any command, which is what denies it to every role RLS applies to;
`23_waitlist_closed.sql` asserts both settings still hold, plus that `anon` and `authenticated` hold
no `SELECT`/`INSERT`/`UPDATE`/`DELETE` on the table.

**6. No service-role bypass.** > `PASS` — and this is the substance of the change. The revoked path
was a `SECURITY DEFINER` function reachable by `anon`, which is the strongest form of bypass in this
schema. It now runs for the owner and `service_role` only.

**7. No cross-workspace read.** > `N/A` — `waitlist` has no tenant column and no foreign key in
either direction; it is a different data subject and a different controller relationship, which
`20260913001100` records.

**8. No cross-customer aggregation or benchmarking.** > `N/A` — nothing aggregated.

**9. API key scope.** > `PASS` — the two remaining anon-executable functions
(`consume_api_key_credits`, `verify_api_key`) are untouched and still gated on possession of a key
hash. `07_anon_grants.sql` asserts the set is exactly those two, in both directions, so this change
could not have quietly taken the edge's own entry points with it.

### Data movement

**10. No resale or redistribution.** > `N/A` — no data leaves anything.

**11. Meta client list.** > `N/A` — not touched.

**12. Dependency licences.** > `PASS` — no dependency added; the new guard uses the existing
`scripts/lib/scan.mjs`.

### PII and consent

**13. Hash at the edge.** > `N/A` — no ingest path touched. (`waitlist` holds plaintext addresses by
design, collected with consent before this change and now closed to new writes; it is not an
edge-accepted payload.)

**14. Forbidden payloads rejected before egress.** > `N/A` — no egress path.

**15. Per-destination consent.** > `PASS` — in the only sense that applies here. The consent that
covered this collection was for a purpose that ended, and the collection is now closed rather than
continuing on a basis that expired.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request.

**17. No new long-lead dependency.** > `PASS` — nothing added; one grant removed.

### Claims

**18. Claim provenance.** > `PASS` — and this gate is what the PR is about. `/processing`'s
`waiting-list` entry asserted "COLLECTION HAS ENDED." while the schema still permitted collection.
The claim is now true, the entry cites the migration and the suite that enforce it, and the enforcing
mechanism is an effective-privilege check rather than a sentence. No new user-visible claim is made
and no forbidden claim appears.

**Result:** `10 PASS, 8 N/A, 0 FAIL`

## 4. What was left out

- **Deleting the rows.** The deliberate omission, argued in §1. Retention is the founder's decision
  and remains open; `23_waitlist_closed.sql` asserts the rows are still there so that closing the
  path cannot quietly perform the deletion.
- **Dropping `public.waitlist` and `public.join_waitlist`.** Same reason. Keeping the function is
  what makes reopening a waiting list a deliberate grant.
- **Wiring `deleteWorkspacePayloads` into the erasure path.** Not done, because there is nothing to
  erase and a caller with no data to act on is untestable in the way that matters. The guard makes
  the wiring unavoidable at the point it becomes necessary, which is the right moment for the design
  decision it needs (in the definer? on a queue the Worker drains? the account row is gone by then,
  which is the hard part). **Issue, not scope creep.**
- **A general "claims in the record of processing are backed by the schema" guard.** Tempting after
  finding one. Not written, because the two examples do not yet show the shape of the rule, and a
  guard generalised from one instance tends to encode that instance.
- **Retention periods anywhere.** Still none, still recorded as none.

## 5. Open or unverified spec items this builds on

- **The PDPA basis for the closure.** Collection for a purpose that no longer exists has no lawful
  basis; that is the general principle and it is why the revoke is not merely tidiness. **What is
  NOT claimed here: that retaining the existing rows is lawful.** The record of processing says those
  rows are held with no current purpose and that this is recorded rather than glossed. This PR does
  not improve that position and does not pretend to — it stops it getting worse.
- **Whether anyone on the list was promised anything.** Unknown to this repository, and the reason
  the rows are not deleted. If the answer is "nobody", deleting them is the right next act and is
  cheap; if it is "they were told they would hear when access opened", that is a communication the
  founder owes before the data goes.
- **`07_anon_grants.sql`'s remaining two entries.** Both are gated on possession of a secret, which
  is a stronger argument than the one that just failed — but it is still an argument in a comment
  about a product state. Worth re-reading whenever the API-key surface changes.
- **The erasure guard's reach.** It scans shipping TypeScript for calls, so a payload write reaching
  R2 through a path it cannot see (a raw `env.PAYLOADS.put`, a re-export chain it fails to follow)
  would not trip it. The bucket binding is narrow and `@repo/payloads` is the only module that
  addresses it today, which is what makes the function-name scan sound; **if that stops being true,
  the guard weakens silently.** Recorded here rather than discovered later.

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

`23_waitlist_closed.sql` contributes 16 assertions and requires at least 14 to have run, so a file
that dies before its assertions cannot report as coverage — the failure mode that produced a
green-but-empty suite earlier in this branch's history.

### Mutations, each proven and reverted

| Mutation | Named guard that went red |
|---|---|
| Remove the `revoke ... from anon, authenticated` from the migration | `07_anon_grants.sql` — *public.join_waitlist(text, text) is callable by anon, so it is callable by the internet*, and *exactly the intended functions are anon-executable* (suite exits 3) |
| Add a shipping module calling `putPayload`, with no eraser | `check-erasure.mjs` — *this module archives payloads to R2, and nothing in the repository calls deleteWorkspacePayloads* (exit 1) |
| Add that module **and** an eraser caller | `check-erasure.mjs` passes — proving the guard demands the coupling, not the absence |
| Replace the `revoke ... from public` with `grant execute ... to public` | `07_anon_grants.sql` (exit 3), and `23_waitlist_closed.sql` run directly against that database — *anon*, *authenticated* and *PUBLIC cannot execute join_waitlist* all red |

The third row is the one worth keeping. A guard that only ever fires is indistinguishable from a
ban; proving it goes green when the coupling is satisfied is what shows it is asking for the right
thing.

### A note on the first mutation

It exits at `07_anon_grants.sql`, which runs before `23_waitlist_closed.sql`, so the new suite never
gets to fire on that mutation. That is the correct ordering and not a gap.

**A claim I wrote here and then checked, because it was the kind that sounds right.** The first
draft of this paragraph said `23`'s `PUBLIC` assertion catches a downstream `create or replace`
restoring the default "which no allow-list comparison would see". **That is false.** A third
mutation — `grant execute ... to public` in place of the revoke — proves it: `07` goes red
immediately, because `has_function_privilege('anon', …)` accounts for privileges reaching `anon`
*through* `PUBLIC`. An allow-list keyed on effective privilege sees a `PUBLIC` grant perfectly well.

Run against that same mutated database directly, `23` fails three assertions (`anon`,
`authenticated`, and `PUBLIC`), so the ACL check works — but it is not catching something `07`
misses. What `23` actually adds is narrower and worth stating accurately:

- **`authenticated` is checked, and `07` never checks it.** `07` is scoped to `anon` by design. A
  grant to `authenticated` alone would leave `07` green and reopen the path to every signed-in
  customer.
- **The failure names the mechanism.** `07` reports "callable by anon"; `23` says whether the route
  was a direct grant or the `PUBLIC` default, which is the difference between a one-line revoke and
  a function that will keep reopening.
- **The non-destructive property is only asserted in `23`** — the rows survive, the table is still
  `FORCE`, the comments no longer advertise anon execution. None of that is a grant question.
