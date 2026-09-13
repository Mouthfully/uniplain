# 90. The second factor nobody can unlock

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed &nbsp;·&nbsp; **Ships no feature**

---

## 1. What this is, and the decision taken

**This note ships no code beyond a correction.** It exists because two earlier notes in this
directory state something about two-factor sign-in that is **false**, and because the thing they
were wrong about turns out to hide a decision nobody has taken.

Notes 86 and 88 both say TOTP is *"blocked on three Supabase project switches"*. I wrote both, from
memory, without reading the library. It is not true.

**What is actually installed.** `@supabase/auth-js@2.116.0` exposes the whole TOTP flow on the
**anon key**, with no service-role key, no project flag and no client option:

| Call | What it does |
|---|---|
| `mfa.enroll({ factorType: 'totp' })` | creates an unverified factor and returns `qr_code`, `secret`, `uri` |
| `mfa.challenge({ factorId })` | starts a challenge |
| `mfa.verify({ factorId, challengeId, code })` | verifies it |
| `mfa.challengeAndVerify({ factorId, code })` | both, for TOTP |
| `mfa.listFactors()` | the person's own factors |
| `mfa.unenroll({ factorId })` | removes one |
| `mfa.getAuthenticatorAssuranceLevel()` | `currentLevel`, `nextLevel`, `currentAuthenticationMethods` |

So the claim in 86 and 88 is wrong and is corrected in the same change as this note. A denial is the
hardest sentence to notice going stale, because it *reads* as conscientious — which is precisely the
finding note 82 recorded about `/terms` saying no DPA was available after one existed. Same defect,
committed by the author of that note, in the opposite direction: a **capability denied** rather than
a capability over-claimed.

**The decision taken: build none of it yet, and say why.**

Not because it is hard. Because both shippable shapes are unacceptable and the third needs an answer
this session cannot give.

## 2. Why enrolment alone would be the wrong-number failure in another currency

Verifying a factor has two real effects today: the current session is promoted to `aal2`, and — per
the library's own words — *"all other sessions are logged out"*. Neither of those is protection at
the **next** sign-in. A later magic-link sign-in returns a session at `aal1` with `nextLevel: 'aal2'`
and **nothing challenges it** unless this application's own door, or a row-level-security policy,
decides to.

So a `/account` section headed "Two-factor sign-in", with a QR code and a verified green tick, would
tell an owner their account needs a code to get into — while it does not. That is THE ONE RULE in a
different currency: not a wrong number, a wrong reassurance, acted on by somebody who then reuses a
password elsewhere or stops worrying about a shared tablet.

## 3. Why enforcement would be worse, and this is the part that needs a decision

Enforcement is buildable: the door reads `getAuthenticatorAssuranceLevel()` and sends `aal1` with
`nextLevel: 'aal2'` to a challenge screen. Fifty lines in the middleware and one page.

**And then a customer loses their phone, and nobody on earth can let them back in.**

Work through the three ways out, against what this repository actually holds:

1. **An administrator removes the factor.** Needs `auth.admin.mfa.*`, which needs the service-role
   key. CLAUDE.md: *"Two identities, never one… There is no service-role key in the Worker. Do not
   add one."* There is none in the web app either. **No.**
2. **Another owner removes it for them.** Same admin API. **No.**
3. **Recovery codes.** `mfa.recoveryCodes.*` exists — `generate`, `regenerate`, `getStatus`,
   `verify`, `unenroll` — and would pass through `createServerClient`'s `auth` options. But it is
   gated behind `auth.experimental.recoveryCodes: true`, and the library marks every method
   `@experimental`. **Possible, and it means the only escape from a permanent lockout rests on an
   API its own authors have not committed to.**

A locked-out account here is not an inconvenience. It is a small business's entire figures behind a
door with no key, held by a company that has deliberately built itself unable to open it — and that
inability is a feature everywhere else in this product.

**That trade is the founder's to make, not this session's.** Shipping either half under an
assumption would be exactly the move CLAUDE.md forbids: *"When you cannot verify something, say
so."*

## 4. What the decision actually is

One question, and the honest options:

> **Do we want a second factor that can lock a customer out, before recovery codes leave
> `@experimental`?**

* **Yes, with recovery codes.** Ship enrolment, door enforcement, and `recoveryCodes.generate()`
  shown once at enrolment with the same "you will see this once" discipline `/keys` already uses.
  Accept that the escape hatch is an experimental API, and accept a support path that ends in "we
  cannot help you" if it changes under us.
* **Yes, without recovery codes.** Do not. Recorded only so the option is visibly rejected rather
  than silently absent.
* **No, wait.** Nothing ships. `/security` says nothing about a second factor, which is what it says
  today, and remains true.
* **Something in between: enrolment with no enforcement, honestly labelled.** Possible only if the
  copy never uses the words "two-factor" or "protected", and says in the first sentence that a code
  is not yet asked for at sign-in. That is a section whose whole content is a disclaimer, and it is
  hard to see who it helps.

The work is scoped and small once the answer exists. What is missing is the answer.

## 5. What could not be verified from here

* **Whether the Supabase project has the TOTP factor type enabled.** It is a dashboard setting and
  no key this session holds can read it. `mfa.enroll` returns an error if it is off, so this is
  checkable at run time and is not a reason to delay anything — but it must not be asserted, and it
  is a founder action the day the decision above is taken.
* **Whether `recoveryCodes` leaves `@experimental`, and when.** Unknown, and not something to
  guess at. It is the hinge of option one.
* **`aal2` in row-level security.** Supabase's documented pattern gates policies on
  `auth.jwt()->>'aal'`. This schema does not, and adding it would touch every policy in
  `20260908000700_rls.sql` — a second, larger unit, and one that changes what a stolen `aal1` token
  can reach. Named here so option one is not costed as "fifty lines in the middleware".

## 6. Verification

Nothing to run beyond the gate, because nothing executable changed. Run by exit code:

```
pnpm -r test                      # 0
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  — all nine
./supabase/tests/run-local.sh     # 0
pnpm --filter web build           # 0
```

**No mutation proof, because there is no guard.** That absence is itself the point: a decision
recorded in prose is protected by nothing, and the only thing keeping this note true is somebody
reading it before they build the feature. Which is exactly what did not happen to notes 86 and 88,
three hours apart, in this same directory.
