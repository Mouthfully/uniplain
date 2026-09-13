# 81. The address the account is reached at

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`/account` can now move an account to a different sign-in address. It shows the address currently
in use, sends the confirmation pair, and renders any change already in flight — read from the auth
record's `new_email`, not from the form's own state. Three sections now, in the order **take, move,
close**, with the permanent one last.

Until this, an owner-run business that changed hands, lost an office manager, or consolidated a
domain had exactly one route: write to support. The product is sold to a customer with no analyst
and no IT department, and "write to us" is the answer that customer has the least capacity to act
on.

**The decision: `checkWorkEmail` runs before the platform is asked, not after.** The alternative —
let Supabase judge the address and deal with the consequences at sign-in — was considered and is
actively dangerous here. `auth/callback/route.ts` applies `checkWorkEmail` to whatever address a
session returns and **signs the person out** if it fails, and every sign-in link this app sends
lands there (`_auth/actions.ts` passes `emailRedirectTo: /auth/callback`). So a change to a personal
mailbox would be accepted by the platform, confirmed by both parties, and then refused at the door
the *next* time the person signed in — leaving an account whose sign-in address is one the product
will not let in, and no screen anywhere to change it back, because changing it needs a session.
Checking first means the change is refused while the person is still signed in and looking at a
sentence that explains why.

**The second decision: both mailboxes confirm, and that is the platform's default rather than our
cleverness.** `@supabase/auth-js` documents `updateUser({ email })` as sending to the new address
and adds: *"If Secure Email Change is enabled (default), confirmation is also required from the old
email before the change is applied."* That default is the whole security story — without it, a
session somebody else has taken over could move the account to an address they control and the real
owner would find out by being unable to sign in. **This code cannot read that setting**, so the copy
describes the default and §4 records keeping it on as a founder action rather than an assumption.

**The third decision: the address form renders outside the membership branch.** `readMembership`
answers about an *organisation*; the sign-in address belongs to the auth record. A database that
cannot answer the first question must not withdraw the second answer — that would take away the one
remedy on the page at exactly the moment something is already wrong, and the page would simply look
like a page that does not offer it.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.`

Nothing here reads a platform, writes an envelope row, touches R2 or KV, or runs on the scheduler.
The only outbound work is two transactional emails per requested change, sent by Supabase's own auth
mailer on the project's existing quota, at a frequency bounded by how often a business changes the
person who signs in — in practice a handful of times over a customer's lifetime. The scheduler's
useful-row ratio (spec §8's open question) is untouched.

## 3. Platform-terms check

### Credential

**1. BYOC.** No platform call on any path in this diff. No developer token, GCP project or
`process.env.*_ACCESS_TOKEN` appears.
> `N/A` — no platform data path.

**2. Vendor-key exception.** No company-held key used.
> `N/A` — no data source.

**3. No token pass-through.** No MCP surface touched.
> `N/A`

**4. Credential hygiene.** No credential is created, read, stored or logged. The action logs
nothing on any path, happy or refusing, and the upstream error is deliberately **not** echoed: it
names the auth server and its rate limits, and `email-actions.test.ts` asserts neither the message
nor a project identifier reaches the returned state. The one address in the returned state is the
one the person just typed into a form they are looking at.
> `PASS` — nothing sensitive stored, logged or reflected.

### Tenancy

**5. RLS.** No new table, column or policy.
> `N/A`

**6. No service-role bypass.** The action runs on `supabaseServer()` under the caller's own cookie
session, and `auth.updateUser` acts on that session's own user and no other. No service-role key
exists in this app and none was added.
> `PASS`

**7. No cross-workspace read.** The page's only query is the pre-existing `readMembership`, called
exactly as before. The address form issues none.
> `PASS`

**8. No cross-customer aggregation.** None.
> `N/A`

**9. API key scope.** No API key surface touched.
> `N/A`

### Data movement

**10. No resale or redistribution.** Nothing leaves the workspace. The two confirmation emails go
to the customer's own two mailboxes.
> `PASS`

**11. Meta client list.** Meta onboarding, workspace lifecycle and deletion are untouched.
> `N/A`

**12. Dependency licences.** No dependency added.
> `N/A`

### PII and consent

**13. Hash at the edge.** An email address is personal data and it is handled here — so this gate is
answered rather than waved. It is **not** persisted by this repository, **not** logged, **not**
written to R2 or KV, and **never reaches a model prompt** (`packages/insights/src/brief.ts` builds
its user prompt from computed figures, dictionary labels and source ids; `InsightRow` carries no
address and nothing in this diff adds one). It lives in `auth.users`, which is the auth provider's
record and the one place the product's own cascade deliberately does not reach — recorded already in
`ACCOUNT_COPY.eraseSurvivesLogin`. **No column was added**, so the check
`packages/payloads/src/redaction.ts` demands of a new personal-data column does not arise. No hash
is stored as a substitute for anything.
> `PASS` — handled in transit, persisted only where it already lived.

**14. Forbidden payloads.** None accepted; the form takes one address.
> `N/A`

**15. Per-destination consent.** No destination record, no Google or Meta consent object.
> `N/A`

### Access tier and quota

**16. Tier reality.** No platform quota consumed. Supabase's auth mailer has its own project-level
rate limit, which is why an upstream failure is reported as a failure with nothing changed rather
than retried.
> `PASS`

**17. No new long-lead dependency.** Nothing here waits on an approval. Secure Email Change is a
project setting already on by default, not an application to be filed.
> `PASS`

### Claims

**18. Claim provenance.** No claim from `@repo/brand` is published or altered. Every sentence added
is signed-in product copy in `ACCOUNT_COPY`, behind `robots: { index: false }`, and
`forbidden-claims.test.ts` scans this route's source like every other. Nothing asserts SOC 2, ISO
27001, an audit, a penetration test, or compliance with any law. The one claim the copy *does* make
— that both mailboxes must confirm — is the documented platform default and is stated as behaviour,
with §4 naming what keeps it true.
> `PASS`

**Result:** `8 PASS, 10 N/A, 0 FAIL`

## 4. What was left out

* **Verifying that Secure Email Change is on.** The setting lives in the Supabase dashboard and no
  key this repository holds can read it. The honest position is the one CLAUDE.md demands: *when you
  cannot verify something, say so.* So it is written down as a **founder action — leave Secure Email
  Change enabled** — rather than asserted in a comment. The copy would become a false statement if
  it were turned off, and no test here would go red. This is the sharpest unguarded edge in the
  change and it is deliberate rather than overlooked.
* **A confirmation that the change completed.** Nothing in this product is told when the second
  mailbox confirms; the page reflects `new_email` while it is outstanding and stops when it clears.
  Polling the auth record or adding a webhook is a separate unit of work.
* **Cancelling a change in flight.** `auth-js` offers no "abandon the pending email change" call.
  Requesting a different address replaces the pending pair, and the copy says so. Inventing an
  endpoint for it is the failure mode this repository has actually suffered.
* **Recording the change in `security_events`.** The enum has no member for it and the event
  happens inside `auth.users`, which no trigger of ours owns. Widening the enum and finding a writer
  is its own unit — issue, not scope creep.
* **Sessions, and two-factor.** Both were on the same list and neither is here. Listing a person's
  sessions is not possible on any credential this repository can hold (the admin API is required and
  there is no service-role key in this product, by rule); TOTP is blocked on three Supabase project
  switches. Both stay open.

## 5. Open or unverified spec items this builds on

* **Secure Email Change is read from the library's own type documentation**
  (`@supabase/auth-js@2.116.0`, `GoTrueClient.d.ts`), not from a dashboard this session can see. If
  a deployment turns it off, `ACCOUNT_COPY.emailBothConfirm` becomes untrue and the takeover risk it
  describes becomes real. Nothing in CI can detect that. It is the founder action above.
* **Where the confirmation link lands is a project setting.** The claim this change depends on is
  narrower and does not turn on it: every *sign-in* link this app sends goes to `/auth/callback`,
  which is where `checkWorkEmail` refuses a personal address. That is read from
  `_auth/actions.ts` in this repository rather than assumed.
* Nothing else. No platform freshness window, quota constant, restatement ladder or statutory
  deadline is relied on by this diff.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm -r test                      # 0  — 46 web files, 517 tests; api-edge 16 files, 328 tests
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-brand.mjs      # 0
node scripts/check-capabilities.mjs   # 0
node scripts/check-claim-sources.mjs  # 0
node scripts/check-copy.mjs       # 0
node scripts/check-dictionary.mjs # 0
node scripts/check-providers.mjs  # 0
node scripts/check-registry.mjs   # 0
node scripts/check-tokens.mjs     # 0
./supabase/tests/run-local.sh     # 0  — 701 assertions, 0 failed
pnpm --filter web build           # 0  — production build
```

### Mutation proof

Every refusal was broken, a **named** test watched go red, and the code put back. A refusal nothing
tests is one the next person deletes.

| Mutation | Test that went red |
|---|---|
| drop the `checkWorkEmail` call | `refuses a personal mailbox WITHOUT asking the platform`, `refuses an empty or malformed address…` |
| drop the same-address check | `refuses the address already in use, whatever its case` |
| ignore `updateUser`'s error | `reports an upstream failure as a failure, and does not repeat what it said` |
| return `error.message` instead of the house copy | same test |
| drop the `.trim()` | `asks the platform to send the pair, and reports that it asked`, `refuses the address already in use…` |
| drop the signed-out check | `refuses when there is no session, and says so rather than redirecting` |
| hide the address form inside the membership branch | `still offers the address form when the organisation cannot be read` |
| render `pendingEmail={null}` always | `shows a change in flight, read from the auth record rather than from the form` |
| render `currentEmail={null}` always | `names the address currently signed in with…` |
| drop the both-mailboxes sentence | same test |
| move the address section below the erase button | `offers all three, in the order take, move, close` |

**One mutation exposed a defect in the test rather than in the code, and that is the finding worth
keeping.** The first attempt at *"still offers the address form when the organisation cannot be
read"* asserted on `ACCOUNT_COPY.emailHeading`. Wrapping only `<EmailForm>` in the membership branch
left it **green** — the `<h2>` above it still rendered, so the test saw a heading over nothing, which
is the exact defect and reads on screen as a section that does not exist. Every page assertion is
now anchored on copy the *form itself* prints, and the order assertion likewise moved off the three
headings and onto the three controls.
