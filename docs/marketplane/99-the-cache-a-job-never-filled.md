# 99. The cache a job never filled, and the eight pull requests it failed

**PR:** #100 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** merged

---

## 1. What this is, and the decision taken

Eight open Dependabot pull requests, every one of them red. Two of the eight bump nothing but a
GitHub Action version and touch no application code at all, which is what made the pattern worth
reading rather than working through one at a time: **a `actions/checkout` bump cannot break a
typecheck.**

It did not. The failing job is `external`, and in its log both guards pass —

```
check-advisories: no high or critical advisories (none reported).
check-mailbox: brand.supportMailboxDeliverable is false and the zone has no MX record. They agree.
```

— and then the job fails in POST-JOB CLEANUP:

```
##[error]Path Validation Error: Path(s) specified in the action for caching do(es) not exist,
hence no cache is being saved.
```

**`actions/setup-node` with `cache: pnpm` both restores the pnpm store and saves it.** The save step
reads the path `pnpm store path` reports, and when that directory does not exist it fails the job
rather than skipping. The `external` job never creates it, because the job never installs anything —
its own comment says so: *"`pnpm audit` reads the lockfile and needs no node_modules, so nothing is
installed here."*

**Whether the job passes therefore depends entirely on whether the cache was a HIT.** On a hit the
restore creates the directory and the save no-ops. On a miss there is nothing to save and the job
goes red after every real step has already succeeded.

**And the cache key is the lockfile hash, so a dependency bump is a cache miss by definition.** That
is the whole shape of it: a latent fault that is invisible on ordinary work and fires on exactly the
pull requests that change a lockfile. It shipped, and the first thing it did was fail every open
dependency pull request at once, each of which then read as *"the dependency broke the build"*.

**The decision: delete the cache from that job rather than make the job create a store.** The
alternative considered was adding `pnpm install` to `external` so there is something to cache — that
buys a slower job, an install failure path in the one job deliberately built not to have one (the
same comment records that as *"the other half of why it is separate"*), and a cache, in order to
keep a cache that was never saving anything useful. A cache asked for by a job that installs nothing
can only cost something.

**`scripts/check-workflow-cache.mjs` makes it a rule.** A one-line deletion with nothing behind it
is a line the next person re-adds, reasonably, on the grounds that caching is free. The guard
refuses any job that asks `setup-node` for a package-manager cache without also running an install.
It polices nothing else: a job that installs may cache or not as it likes.

It reads the workflow by indentation rather than with a YAML parser, which is a stated limit rather
than an oversight — adding a dependency to the repository root to read two keys is a poor trade for
the one guard in the tree that has none. It **prints the number of jobs it read** for that reason: a
run reporting zero jobs in a file that plainly has some is visible, where a silent zero would not be.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.`

Nothing in the product changes. The `external` job gets marginally faster (one fewer cache restore
of a store it did not use) and every future dependency pull request stops failing for a reason that
has nothing to do with its dependency.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call is added or changed.
**2. Vendor-key exception.** > `N/A` — no company-held key is used.
**3. No token pass-through.** > `N/A` — the MCP and OAuth surfaces are untouched.
**4. Credential hygiene.** > `PASS` — no credential appears in the workflow change or the guard.

### Tenancy

**5. RLS.** > `N/A` — no table, column or policy.
**6. No service-role bypass.** > `N/A` — nothing here runs a query.
**7. No cross-workspace read.** > `N/A` — no query is added.
**8. No cross-customer aggregation.** > `N/A` — no customer data is touched.
**9. API key scope.** > `N/A` — no API surface is touched.

### Data movement

**10. No resale or redistribution.** > `N/A` — no data moves.
**11. Meta client list.** > `N/A` — no Meta path is touched.
**12. Dependency licences.** > `PASS` — **no dependency is added.** The guard is plain Node with two
`node:` built-ins, which is the reason it parses by indentation rather than importing a YAML reader.

### PII and consent

**13. Hash at the edge.** > `N/A` — no personal datum is introduced.
**14. Forbidden payloads rejected before egress.** > `N/A` — nothing egresses.
**15. Per-destination consent.** > `N/A` — no record is sent anywhere.

### Access tier and quota

**16. Tier reality.** > `N/A` — no platform request is made.
**17. No new long-lead dependency.** > `N/A` — nothing waits on an approval.

### Claims

**18. Claim provenance.** > `N/A` — no user-visible copy changes. Nothing renders from this PR.

**Result:** `3 PASS, 15 N/A, 0 FAIL`

## 4. What was left out

* **Merging the eight Dependabot pull requests in this change.** They are eight separate decisions
  about eight dependencies — one of them a major `@types/node` bump and one a Playwright bump that
  the local browser harnesses depend on — and bundling them behind a CI fix would hide each of them
  behind the other seven. This unit fixes the reason they were ALL red; what each is worth is read
  off its own green run.
* **A guard on the other half of the same class.** `cache-dependency-path` pointing at a file that
  does not exist fails the same way, and is not checked here: it has not happened, and a guard
  written against a failure nobody has had is a guess about which shape it will take.
* **The Node 20 deprecation warnings** in every run (`actions/setup-node@v4`, `pnpm/action-setup@v4`
  being forced onto Node 24). Real, and exactly what the open action-bump pull requests address —
  theirs to fix, not this one's.

## 5. Open or unverified spec items this builds on

* **`setup-node`'s save behaviour on a missing path** is read off the failing run's own log, quoted
  verbatim above, rather than from documentation. The observed behaviour is the evidence.
* Nothing else.

## 6. Verification

```
pnpm -r test                      # 0
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  -- all fifteen, including the new one
./supabase/tests/run-local.sh     # 0  -- 754 assertions, 0 failed
pnpm --filter web build           # 0  -- production build
```

### Mutation proof

| Mutation | What caught it |
|---|---|
| put `cache: pnpm` back on the job that installs nothing | `check-workflow-cache` — the exact defect |
| delete the install from the job that legitimately does cache | `check-workflow-cache` — the rule holds in both directions |

Both went red and were put back; the clean tree passes. The second one matters as much as the first:
a guard that only fires on the literal line that was removed is a guard against one edit, not
against a rule.
