# 101. The advisory nobody was looking for

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`AGENTS.md` lists **A.8.8 vulnerability management** under "absent and code-shaped, so these are ours
to fix": no `pnpm audit` step, no Dependabot or Renovate, no CodeQL or SAST, no secret scanning, no
SBOM. This builds the dependency half — a guard, a schedule that supplies the fixes, and the two
findings running it produced.

**The first run found a `high`-severity advisory that had been sitting in the tree with nothing
looking at it.** `sharp@0.35.2`, GHSA-rgj7-g3m4-5g8c, reached through
`apps/api-edge > @cloudflare/vitest-pool-workers > miniflare > sharp`.

**The decision: build the control, and do not let it become a claim.** `FORBIDDEN_CLAIMS` bans
"penetration tested" and this changes none of that — nothing here is published, and no brand fact
moves. The obligation it answers is **PDPA s.37(1)**, appropriate security measures, which binds
this controller today with no auditor and no certificate in it. A service that custodies other
people's platform credentials, with a known-vulnerable dependency and a published fix, is a s.37(1)
exposure whether or not anyone ever asks.

CLAUDE.md's own rule is the test this had to pass: *"Do not implement a control in order to claim
it. Build the control because the obligation is real."*

### 1.1 The advisory is real and it is **not** in the served path, and both halves matter

`sharp` arrives through `@cloudflare/vitest-pool-workers`, which is the Worker **test harness**. It
is in neither shipped bundle — not `apps/web`'s Next build, not `apps/api-edge`'s wrangler bundle —
and the root `package.json` does not even list it in `onlyBuiltDependencies`, so its native code was
never compiled here.

**That is the finding, not a reason to skip the finding.** Saying "high severity in a service holding
OAuth credentials" without saying "in a test dependency" would be the same class of error this
repository fails builds over, pointed the other way: a number that looks worse than the truth is
still a number that does not match it. It is fixed rather than argued away, because the fix is a
version pin and cost nothing.

**Fixed by `pnpm.overrides: { "sharp": ">=0.35.4" }`.** `pnpm audit` now reports zero at every
severity, verified before and after.

### 1.2 The second finding: the lockfile could not be regenerated

Landing the override needed a non-frozen install, and that failed — on something unrelated:

```
apps/web
└─┬ @vitejs/plugin-react 5.1.2
  └── ✕ unmet peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0": found 8.2.2
```

`vite@8.2.2` was **already in the committed lockfile**, pulled in through `vitest`. With
`strict-peer-dependencies` on, that combination is a hard error — but `--frozen-lockfile` does not
re-check peers, so **CI was green and had always been green**, and the wall was waiting for whoever
next added a dependency. Nothing in the build would have told them it was not their change.

Fixed in the same commit, because it is the same commit's blocker: the catalog moves
`@vitejs/plugin-react` from `5.1.2` to `6.1.1`, which peers `vite ^8.0.0`. Its three new peers are
all `optional: true`, checked rather than assumed. Version 6 drops the Babel pipeline, which is why
the lockfile loses roughly six hundred lines; every test and both builds pass on it.

**This is the closest thing here to widened scope**, so it is stated plainly rather than folded in:
it is not a change anybody asked for, and the defence is only that the unit could not land without
it and that leaving it would leave a repository nobody can add a dependency to.

### 1.3 The three decisions that make this a gate rather than a checkbox

**An audit that could not run is not a pass.** `pnpm audit` needs the registry. If it cannot be
reached, or returns something the guard cannot parse, the guard **fails** and says which. An offline
audit reporting "no vulnerabilities found" is the `?? 0` of security tooling: absent is not zero, and
"we could not check" is a finding. Same posture as the Worker reporting `not_configured` rather than
letting a missing binding look like an empty work list.

**An acknowledgement names an advisory and expires.** Without an escape hatch, the first high-severity
advisory with no published fix turns every pull request red, and what gets reached for under that
pressure is deleting the gate. So one exists, built to be survivable rather than permanent:

| Rule | What it stops |
|---|---|
| keyed on the **GHSA id**, never the module | acknowledging today's `sharp` finding hiding tomorrow's |
| `expires` required, **max 90 days** | a suppression becoming a decision to stop looking |
| reason under 60 characters refused | `"reason": "dev only"` |
| an entry for an advisory the audit no longer reports **fails** | the file silting up until nobody reads it |

**`.github/dependabot.yml` is the other half, and it is why the gate is survivable.** A gate whose
only escape is a suppression trains people to suppress. Weekly, dev tooling grouped and production
dependencies not — a change to what ships to a customer deserves its own reading. `vitest` and
`@cloudflare/vitest-pool-workers` majors are ignored, with the reason restated in that file rather
than left in a comment in `pnpm-workspace.yaml` where Dependabot cannot see it.

**High and critical fail; moderate and below print.** A moderate advisory in a formatter is not worth
stopping every pull request over, and a gate that cries wolf gets `--no-verify`-d.

### 1.4 A separate CI job, deliberately

The advisory guard is the only step in the workflow that depends on a service outside it. Inside
`verify`, a registry outage would turn the whole gate red and read exactly like a broken test — and
the reflex on a red build is to re-run rather than to read. It runs as its own job, with its own
name, and installs nothing: `pnpm audit` reads the lockfile, verified against a tree containing only
the manifests and `pnpm-lock.yaml`. So it also cannot be broken by an install failure.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. No migration, no query, no upstream call on any tenant path, nothing added
to ingest. The cost is CI minutes: one extra job of roughly thirty seconds per run, and up to five
Dependabot pull requests a week.

The dependency changes touch nothing that ships. `sharp` is a transitive test dependency;
`@vitejs/plugin-react` is the JSX transform for `apps/web`'s vitest run and is not in the Next build.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A` — no
company-held key. &nbsp; **3. No token pass-through.** > `N/A` — no MCP or OAuth surface.
&nbsp; **4. Credential hygiene.** > **`PASS`, and in the direction that matters.** No credential is
added. The guard's own output prints advisory ids, module names and dependency paths, and nothing
from the environment — an audit tool that echoed a registry token into a public CI log would be the
obvious way to fail this gate.

### Tenancy
**5. RLS.** > `N/A` — no migration or table. &nbsp; **6. No service-role bypass.** > `N/A` — no
request path. &nbsp; **7. No cross-workspace read.** > `N/A` — no query. &nbsp; **8. No
cross-customer aggregation.** > `N/A` — nothing aggregated. &nbsp; **9. API key scope.** > `N/A` —
untouched.

### Data movement
**10. No resale or redistribution.** > `PASS` — nothing moves. The audit sends the lockfile's
package names and versions to the registry, which is what installing them already does. &nbsp;
**11. Meta client list.** > `N/A` — untouched. &nbsp; **12. Dependency licences.** > `PASS` — no
dependency is added. Two move version: `sharp` (Apache-2.0) via an override, `@vitejs/plugin-react`
(MIT) via the catalog. Neither is ELv2 or AGPL and neither is in a served path.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path. &nbsp; **14. Forbidden payloads.** > `N/A` — no
egress. &nbsp; **15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota
**16. Tier reality.** > `N/A` — no upstream platform request. &nbsp; **17. No new long-lead
dependency.** > `PASS` — no approval is needed by anything here.

### Claims
**18. Claim provenance.** > **`PASS`, and this is the gate the unit had to survive.** Nothing is
published. No page renders, no claim id is added, no brand fact moves, and `soc2`/`iso27001` stay
`false`. The words "penetration tested", "independently audited" and the rest remain in
`FORBIDDEN_CLAIMS`, and running an audit tool does not come close to any of them —
`forbidden-claims.test.ts` scans every route's source and there is no route in this diff.
`AGENTS.md` records A.8.8 as **partial**, with what is still missing named in the same row: no SAST,
no secret scanning, no SBOM, and none of the ISMS half A.8.8 also wants — a defined process, an
assigned owner, a documented response time.

**Result:** `7 PASS, 11 N/A, 0 FAIL`

## 4. What was left out

- **CodeQL / SAST, secret scanning and an SBOM.** Named in the same `AGENTS.md` line and each is its
  own unit. Secret scanning in particular is a repository setting rather than a file, so it is a
  founder action and not a commit.
- **A.8.32 change management** — `CODEOWNERS`, required review, signed commits. A different control
  with a different argument, and the ten most recent commits are still unsigned. **Issue, not scope
  creep.**
- **Raising the gate to moderate.** Defensible and premature: no moderate advisory is outstanding, so
  the choice would be made with nothing to weigh it against.
- **A response-time commitment.** A.8.8 wants one, and it is a founder decision with a real cost
  attached rather than a number to invent. Recorded as missing in `AGENTS.md`.
- **Bumping `@cloudflare/vitest-pool-workers` to drop `sharp` upstream.** The catalog's own comment
  warns that the pool peers `vitest ^4.1.0` and that vitest 5 breaks every Worker test. An override
  is the surgical fix; the upstream bump is a version-trap change that deserves its own PR.

## 5. Open or unverified spec items this builds on

- **`pnpm audit`'s severity ratings are GitHub's, not this repository's.** The gate inherits a
  third party's judgement of what "high" means, and a rating can change after the fact. Stated
  because the guard reads as though `high` were a property of the advisory rather than an opinion
  about it.
- **The dependency path is read from the audit's own `findings[].paths`.** The claim that `sharp` is
  test-only rests on that string plus the absence of `sharp` from `onlyBuiltDependencies` — not on
  an inspection of either shipped bundle. If it turns out to be reachable from a Worker build, the
  severity of the finding changes and the fix does not: it is already pinned to the patched version.
- **Dependabot's grouping and ignore rules are unverified in operation.** No pull request has been
  raised by it. The file is valid YAML against the documented schema; whether the groups read the
  way they are meant to will only be visible next Tuesday.
- **`--frozen-lockfile` not re-checking peers** is behaviour observed in pnpm 10.33 here, not a
  documented guarantee. What is certain is that this repository's committed lockfile violated a peer
  range and CI never said so.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all ten check-*.mjs       = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
pnpm audit              = 0 high, 0 critical, 0 at every severity
```

`pnpm install --frozen-lockfile` **and** `--no-frozen-lockfile` both succeed, which is the second
finding's fix stated as a result rather than a claim.

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| Remove the `sharp` override so the real advisory returns | guard exits 1, naming `high sharp@0.35.2 GHSA-rgj7-g3m4-5g8c`, the path through `vitest-pool-workers`, and the published fix |
| With it failing, add a valid acknowledgement | guard exits 0 — **the hatch proven against a real advisory rather than a fixture** |
| `"reason": "dev only"` | *gives a reason of 8 characters. Say why this advisory does not reach anything a customer relies on* |
| `expires` set to a past date | *acknowledgement EXPIRED on 2026-09-01* |
| `expires` set 261 days out | *the maximum is 90. An acknowledgement is a promise to look again, not a decision to stop looking* |
| Acknowledge the **module** `sharp` rather than the advisory id | **two failures**: the advisory is still blocking, and the entry is reported as one the audit does not report |
| `pnpm` replaced with a stub exiting 1 with no output | *pnpm audit produced no output (exit 1). This is NOT a pass: the registry may be unreachable* |

The last one is the one that matters. Every other mutation makes the guard louder; that one is the
only one that could have made it **quieter**, and a security gate that reports clean because it could
not check is worse than no gate — it answers the question with the wrong answer instead of leaving it
open.

The module-versus-advisory mutation failing **twice** is the design working as intended rather than
noise: acknowledging a module neither suppresses the advisory nor passes silently, because the
entry matches nothing the audit reported.

Two of these initially failed with a Node stack trace rather than the guard's own sentence. Fixed in
the same change — a guard that dies with a stack trace has reported nothing to the person who has to
act on it.
