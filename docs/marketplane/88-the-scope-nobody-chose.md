# 88. The scope nobody chose

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Two things, one of which was already shipped and wrong.

**The defect.** `app/_auth/actions.ts` called `supabase.auth.signOut()` with no argument, and
`@supabase/auth-js` documents what that means in capitals of its own: *"the default `scope` is
`'global'`. This signs the user out of **every device they are currently signed in on**, not just
the current tab/session. If you only want to sign the user out of the current session (the behavior
most other auth libraries default to), pass `{ scope: 'local' }` explicitly."*

So the "Sign out" button in the dashboard header was ending the session on the owner's phone and on
the shop's counter tablet at the same time. Nothing in the code, the copy, or any diff said so — the
behaviour lived entirely in a library default. For the customer this product is sold to, an owner
and two or three staff sharing devices, that is not a security feature; it is the till logging
itself out because somebody closed a laptop in the back office.

**The feature.** `/account` gains a fourth section: **sign out of every other device**, using
`scope: "others"`, which the library's own implementation confirms leaves the current session alone
(`_signOut` skips `removeCurrentSession()` when the scope is `others`).

**The decision: the rule is not "use local", it is that every call site states its scope.** The two
sites now choose opposite scopes and both are right. The header button is one person leaving one
screen → `local`. The OAuth callback's work-email refusal is an identity the door turns away, which
should hold no session anywhere including one made before the rule reached it → `global`, unchanged
in behaviour but written down. `sign-out-scope.test.ts` scans `app/**` and fails a call site that
passes no scope, so a third one cannot inherit "every device this person owns" by accident.

The alternative — fix the button and leave the callback implicit — was rejected. Half the defect is
the wrong scope; the other half is that a scope was never stated, and fixing only the first leaves
the mechanism that produced it.

**And the honest shape of "see and revoke sessions".** The *seeing* half is not possible on any
credential this repository may hold: GoTrue exposes a person's sessions only through its admin API,
which needs the service-role key, and CLAUDE.md's rule is not a preference — *"Two identities, never
one… There is no service-role key in the Worker. Do not add one."* A key that can list every
account's sessions is a key that can read every account. So the screen **says it cannot show the
list**, rather than rendering an empty table. An empty table is the wrong-number failure in a
different currency: a person checks it, is told nothing else is signed in, and stops looking.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.`

No platform read, no envelope row, no R2 object, no KV write, no model call, nothing on the
scheduler. One auth-server call per press of a button a business presses when somebody leaves. The
scheduler's useful-row ratio (spec §8's open question) is untouched.

## 3. Platform-terms check

### Credential

**1. BYOC.** No platform call on any path in this diff.
> `N/A` — no platform data path.

**2. Vendor-key exception.** No company-held key used.
> `N/A`

**3. No token pass-through.** No MCP surface touched.
> `N/A`

**4. Credential hygiene.** This is the substantive gate. The change **revokes** credentials and
stores none: refresh tokens are ended at the auth server and nothing is written to an application
table, a log, or the returned state. The upstream error is deliberately not echoed — it names the
auth server and its project — and `session-actions.test.ts` asserts no project identifier reaches
the screen. **No service-role key was added**, which is the whole reason the listing half of this
feature does not exist.
> `PASS`

### Tenancy

**5. RLS.** No new table, column or policy.
> `N/A`

**6. No service-role bypass.** The action runs on `supabaseServer()` under the caller's own cookie
session, and `auth.signOut` acts on that session's own user and no other. The admin API is not
reached, and this is the gate that decided the feature's shape rather than merely passing.
> `PASS`

**7. No cross-workspace read.** No query issued.
> `PASS`

**8. No cross-customer aggregation.** None.
> `N/A`

**9. API key scope.** No API key surface touched.
> `N/A`

### Data movement

**10. No resale or redistribution.** Nothing leaves the workspace; nothing is sent anywhere.
> `PASS`

**11. Meta client list.** Untouched.
> `N/A`

**12. Dependency licences.** No dependency added.
> `N/A`

### PII and consent

**13. Hash at the edge.** No personal datum is handled at all. A session is revoked by the caller's
own token; no address, no device name, no IP, no user agent is read, stored or displayed — and the
reason the device list is absent is the same rule that would have governed storing it. **No column
was added**, so the `packages/payloads/src/redaction.ts` check does not arise. Nothing reaches a
model prompt.
> `PASS`

**14. Forbidden payloads.** None accepted; the form has no fields.
> `N/A`

**15. Per-destination consent.** No destination record.
> `N/A`

### Access tier and quota

**16. Tier reality.** No platform quota consumed. The auth server has its own project-level rate
limit, which is why an upstream failure is reported as a failure with nothing changed rather than
retried.
> `PASS`

**17. No new long-lead dependency.** Nothing waits on an approval.
> `PASS`

### Claims

**18. Claim provenance.** No claim from `@repo/brand` is published or altered. Every sentence added
is signed-in copy in `ACCOUNT_COPY`, behind `robots: { index: false }`, and
`forbidden-claims.test.ts` scans this route like every other. Nothing asserts SOC 2, ISO 27001, an
audit, a penetration test, or compliance with any law. **What the copy does say is two things it
cannot do**, and both are tested: that the device list cannot be shown, and that the revoke is not
instant.
> `PASS`

**Result:** `8 PASS, 10 N/A, 0 FAIL`

## 4. What was left out

* **The device list.** Not a schedule item — not possible on any credential this repository may
  hold. Recorded here as a negative finding rather than a backlog entry, because the next person to
  look will otherwise spend the same afternoon on the admin API and reach the same rule.
* **Ending one named session.** Same reason: selecting one requires enumerating them.
* **Sign-out on role removal.** When `/members` removes somebody, their session survives until its
  refresh token is next used. Closing that needs the admin API too, and is the one genuine cost of
  the rule above. It is not pretended away: it is the reason this control exists at all, since the
  owner can now end every other session themselves.
* **Two-factor.** Still blocked on project switches this session cannot set.

## 5. Open or unverified spec items this builds on

* **The revoke is not instant, and how long it is not instant for is unknown here.** The library is
  explicit: *"the access token JWT will be valid until it's expired… Supabase revokes the refresh
  token… This does not revoke the JWT."* That window is the project's access-token lifetime, which
  is configurable and **this code cannot read it**. The first draft of the copy ended *"which is
  minutes rather than days"* — a guess wearing the costume of a fact, about a setting nobody in this
  repository can see. It is gone, and `session-actions.test.ts` now refuses any digit or duration
  word in that sentence. **Founder action: decide and record the access-token lifetime**, after
  which the sentence can name it.
* **`scope: "others"` leaving the current session intact** is read from the shipped implementation
  of `@supabase/auth-js@2.116.0` (`GoTrueClient.js`, `_signOut`), which skips
  `removeCurrentSession()` for that scope — not from the prose. If that changes, the person pressing
  the button is signed out of the screen they pressed it from, which reads as a failure.
* Nothing else. No platform freshness window, quota constant, restatement ladder or statutory
  deadline is relied on.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm -r test                      # 0  — web 709, api-edge 328, insights 146
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  — all nine
./supabase/tests/run-local.sh     # 0  — 718 assertions, 0 failed
pnpm --filter web build           # 0  — production build
```

### Mutation proof

Thirteen mutations, thirteen **named** tests red, each put back.

| Mutation | Test that went red |
|---|---|
| drop the scope on the sign-out button | `never calls signOut with no argument, because that means every device` |
| make the button `global` again | `signs out only this device from the button, and everywhere from the refusal` |
| narrow the callback refusal to `local` | same test |
| let the library default decide the revoke scope | `never omits the scope, because the library's default is the wrong one` |
| revoke with `global`, signing the person out of their own screen | `revokes the others and keeps this one, and says it did` |
| ignore `signOut`'s error | `reports an upstream failure as a failure, and says nothing changed` |
| drop the signed-out check | `refuses when there is no session, and does not call the platform` |
| put a window ("up to an hour") back into the copy | `quotes no window at all for when the other device stops working` |
| turn the admission into "nothing else is signed in right now" | `admits the list cannot be shown rather than implying there is nothing to show` |
| drop the "we cannot show you the list" line from the form | `admits, above the button, what signing out everywhere cannot do` |
| drop the "it is not instant" line from the form | same test |
| remove the whole section | `offers all four, with the one that cannot be undone last` |
| move the section below the erase button | same test |

**A guard reported coverage it did not have, on its first run, and was caught by its own vacuity
check.** `sign-out-scope.test.ts` builds a map from file path to the argument at each call site, and
the path arithmetic was one slash off — so `byPath.get("_auth/actions.ts")` returned `undefined`.
The assertion failed only because the expected value was a string; had the expectation been
`undefined` for any reason, the test would have compared two absences and reported green. The
vacuity check now asserts the paths themselves are the ones the lookups use, which is the same
lesson `registry.test.ts` and `captureLog` record: a list built by hand and compared to nothing
passes every check anyone thinks to write.
