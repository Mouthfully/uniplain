# 66. The OAuth package was complete and nothing served it

**PR:** _(not yet opened)_ &nbsp;·&nbsp; **Issue:** #51 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`packages/oauth` has been finished since it was written: `pkce.ts`, `startAuthorization`,
`verifyCallback`, `exchangeCode`, and a `PROVIDERS` table with scopes and endpoints for Google, Meta
and Loyverse. **Nothing called any of it.** The Worker had four routes — `/health`,
`/v1/performance`, `/v1/ingest/run`, `/v1/connections` — and no connector OAuth callback anywhere;
the only `callback` in `apps/` is Supabase sign-in, which is unrelated.

The consequence is not subtle. Four of six providers are OAuth-only and could not be connected at
all: `ga4`, `google_ads`, `search_console`, `loyverse`. **Loyverse is built, tested, merged and
unreachable**, and `PROVIDER_LANES.loyverse = ["oauth"]` is a *refusal* rather than an omission —
Loyverse does issue a pasteable personal access token, and the platform's own sentence about it is
that it "gives unlimited access to the targeted account", which on that API includes
`RECEIPTS_WRITE`, `ITEMS_WRITE` and `INVENTORY_WRITE`. Offering that lane would have moved Loyverse
out of the group where read-only is enforced **by the token** and into the group where it is
enforced **by our promise** (`58-plan-reconciliation.md` §1.5), while the product tells a cafe owner
this is the connector whose permissions are narrow.

This PR builds the Worker half of the door: `POST /v1/connections/oauth/start` and
`POST /v1/connections/oauth/callback`, plus the store they need.

**The decision, in one sentence: the pending authorisation is a row in Postgres behind two
`SECURITY DEFINER` functions, not a signed cookie and not Workers KV — because redemption must be
single-shot and tenancy must be decided by the database, and only a server-side row in Postgres has
both.** The alternatives were considered and named:

| Considered | Why not |
|---|---|
| A signed cookie carrying the pending record | Nothing in `flow.ts` checks "has this been spent". A replayable pending record attaches a **second connection from one authorisation**. A cookie cannot express single-use without server state to mark it spent — at which point the cookie is decoration on top of the store it replaced. |
| Workers KV | Same single-use problem (KV has no atomic delete-and-return), and it moves the tenancy decision from `app.can_write_workspace()` into a `===` in TypeScript. |
| A Durable Object | Solves single-use and still moves tenancy into Worker code, and adds an identity and a cost line for a row that lives ten minutes. |

`delete from public.oauth_authorizations where state = p_state and app.can_write_workspace(...)
returning *` is atomic single-use for free, and the tenancy predicate is the *same function every
RLS policy in this schema calls*. The `connections` insert that follows is then adjudicated a
**second** time by the existing `connections_insert` policy on the customer's own forwarded token.
Two database decisions; zero application-code decisions.

### `POST /v1/connections` did not change, and that is deliberate

It still refuses a body naming `oauth`, and that refusal is correct: accommodating it would mean
fabricating a `TokenResponse` out of a pasted string. **This is a different door, not a widened
one.**

### Where each half runs, and why

`CREDENTIAL_KEK` does not move. The flow **begins** at the Worker (`/oauth/start` runs
`startAuthorization`, persists the row, returns only the authorize URL — so the `code_verifier`
never touches the web app) and **ends** at the Worker (`/oauth/callback` redeems, verifies,
exchanges, and hands the `TokenResponse` to `@repo/connections`' `connect()` to seal — never
`@repo/vault` directly, so the AAD scope and the blob discriminant keep one implementation).

The web app owns exactly one thing: **the redirect URI**. It has to. That origin is the only one
carrying the Supabase session cookie, and "the workspace comes from the caller's session" is
unsatisfiable at a redirect that arrives with no session. The web app collects `code` and `state`
off its own query string and POSTs them onward — the collect-and-post posture
`apps/web/app/connections/actions.ts` already documents.

### What the sweep is, and what it is not

`start_oauth_authorization` deletes rows older than **one hour** before every insert. That horizon
is **garbage collection, not expiry**. `PENDING_TTL_MS` (ten minutes, in `verifyCallback`) stays the
single authority on whether an authorisation is still good; a second TTL in SQL would be two
constants that can disagree. A row between ten and sixty minutes old is still deletable-and-
returnable, and `verifyCallback` then throws `expired` — so the customer gets a named refusal rather
than silence. `16_oauth_pending.sql` asserts **both halves**: the two-hour row is swept and the
thirty-minute row survives. A test that only proved "old rows are deleted" would pass just as
happily against a ten-minute horizon, which is the version of this file that would have been wrong.

### What "read-only" means here, and what building this door cost to keep it

This is the third thing this note exists to record, and it is the one most likely to be
rediscovered at cost — because the decision is invisible in the diff. It shows up only as an
**absence**: a lane that is not in an array.

`58-plan-reconciliation.md` §1.5 draws the line this repository actually runs on. There are two
groups of sources, and they are not equally honest:

| | Read-only is enforced by | Examples | What we can truthfully say |
|---|---|---|---|
| **Group 1** | **the token** — the platform will not honour a write with this credential | Loyverse (`RECEIPTS_READ`, `MERCHANT_READ`), Xero, Stripe restricted keys | "This connection cannot change anything." A statement about the **platform**. |
| **Group 2** | **our code** — the credential can write and we choose not to | QuickBooks Online (`com.intuit.quickbooks.accounting` is one scope covering both), FlowAccount, GrabFood, StoreHub | "We do not call the write endpoints." A statement about **us**, and materially weaker. |

**Loyverse belongs to Group 1 only because this door was built.** Loyverse issues a pasteable
personal access token — the exact shape `connectWithToken` already accepts, requiring no OAuth
client registration, no redirect URI and no callback route. Taking it would have made Loyverse
connectable months ago, with none of this PR. The platform's own sentence about that token is that
it "gives unlimited access to the targeted account", and on this API *unlimited* includes
`RECEIPTS_WRITE`, `ITEMS_WRITE`, `INVENTORY_WRITE` and `TAXES_WRITE`.

So `PROVIDER_LANES.loyverse = ["oauth"]` is **a refusal, not an omission**, and the refusal is
structural rather than conventional: `offersLane("loyverse", "bearer")` is false, so
`connectWithToken` rejects the provider before anything is sealed. **The cost of that refusal was
this entire PR** — the pilot POS connector sat built, tested, merged and unreachable rather than
being connected by the easy credential. That is the price of the standard, paid once, in full,
and it should be legible to whoever is next asked to pay it.

**THE SAME QUESTION IS OPEN FOR THE THREE CONNECTORS AT THE TOP OF THE BUILD ORDER, AND THIS IS THE
FIRST PLACE IT HAS BEEN ANSWERED BY REFUSING.** `64-the-build-order.md` §5(h) states the collision
plainly and leaves it undecided:

- **LINE Official Account** — the channel access token can **broadcast to every follower**. LINE
  offers no narrower credential, only shorter-lived ones. There is no Group 1 option at all.
- **Omise / Opn Payments** — the secret key that reads `GET /charges` can also **create charges and
  refunds**. One key, both directions.
- **Google Sheets (`drive.file`)** — Google's own wording is "See, edit, create, and delete only the
  specific Google Drive files you use with this app." The genuinely read-only Google scopes
  (`spreadsheets.readonly`, `drive.readonly`) are Sensitive and Restricted respectively. **There is
  no option that is both narrow and read-only.**

Those are the three highest-value connectors for this market, and **none of them has a Loyverse-
shaped escape**. Refusing the write-capable lane there does not mean building a different door; it
means **not building the connector**. So the precedent set here does not decide them — and this note
must not be read as though it did. What it does is fix the shape of the argument and put a price on
it: the standard is *read-only enforced by the token where the platform offers it*, the cost of
holding it was a PR, and when a platform offers nothing in Group 1 the choice is between **saying so
in the trust copy** and **not shipping the connector**. It is not between those two and a third
option where the copy stays as it is.

`64` §5(h)'s closing line is the operative one and is repeated here rather than summarised away:
whoever writes the trust and security copy needs this decided **before** they write it, or the first
security questionnaire will decide it for them. Nothing in this PR writes that copy, and
`check-copy` plus `forbidden-claims.test.ts` will not catch a sentence that is merely **too strong**
— they catch banned strings, not overclaims. **This is an issue to open, not scope to add here.**

---

## 2. Cost estimate

**Per connected account per month: ≈ `$0.000002`, and it is not the number that matters.**

Derived rather than asserted. This is a **control-plane** endpoint: it runs twice in the life of a
connection, plus once more each time a grant is re-authorised.

| Term | Per connect | Unit | Cost |
|---|---|---|---|
| Workers requests | 3 (start, callback, and the web app's redirect route) | $0.30 / million | $0.0000009 |
| Workers CPU | ~3 ms total; one SHA-256, one AES-GCM seal | $0.02 / million CPU-ms | ~$0.00000006 |
| PostgREST round trips | 3 (start RPC, redeem RPC, connections insert) | included in Supabase plan | $0 |
| Supabase disk | one ~400-byte row for ≤ 1 hour, then gone | $0.125 / GB-month | ~$0.0000000005 |
| Token endpoint | 1 outbound HTTPS call | free (provider's) | $0 |
| R2 / KV | none — nothing here is cached or archived | — | $0 |

A connection re-authorised monthly (Meta's ~60-day long-lived token is the shortest real cycle)
doubles a number that is already below a rounding error. **The steady-state per-connected-account
cost of this PR is zero:** nothing here runs on a schedule, nothing here is in the ingest path, and
it adds no term to the nightly row count.

**What it does do to the cost model is unblock four sources**, whose data-plane cost is estimated in
their own notes and is unchanged by this one. **It does not change the polling ratio §8 flags as the
thing that collapses the ~98% margin** — it touches no scheduler and no backfill window.

Three caveats repeated rather than assumed away: §8 marks the performance COGS and the ~98% margin
UNVERIFIED; §7's table has no disk-growth term by its own checker's admission; and §8's open
question about 3x–5x redundant polling is untouched here and still open.

---

## 3. Platform-terms check

### Credential

**1. BYOC.** Every platform call reads the credential from the per-workspace connection vault. This
PR *creates* those rows and reads none. The **grant** is the customer's own — their Google/Meta/
Loyverse login, their consent, one workspace — and the token is sealed under `CREDENTIAL_KEK` bound
to `{workspaceId, connectionId}`. No company-held platform token appears on any path; no
`process.env.*_ACCESS_TOKEN`. The **OAuth client registration** (`OAUTH_*_CLIENT_ID` / `_SECRET`) is
the deployment's own app, per `@repo/oauth`'s registry, and is *not* a developer token or a GCP
project — the per-tenant developer-token question is open and is flagged in §5.
> `PASS`

**2. Vendor-key exception.** No company-held key is used for any platform data.
> `N/A` — no vendor-key surface in this diff.

**3. No token pass-through.** The MCP server is not touched. The customer's Supabase access token is
forwarded to **PostgREST only** — the same database the session already authenticates against —
and never upstream to a provider; providers receive the client credentials and the one-time code.
**PKCE is on every authorize and every exchange**, unconditionally, including Loyverse (see §5).
RFC 9728 metadata and RFC 8707 resource indicators are properties of *this product's* MCP
authorisation surface, which does not exist yet; this is an outbound OAuth **client**, so neither
applies here.
> `PASS` on PKCE and no-pass-through; RFC 9728 / 8707 `N/A` — not the MCP surface.

**4. Credential hygiene.** The `TokenResponse` reaches `connect()` and nothing else. Asserted, not
asserted-about: `oauth-connect.test.ts` greps the access token, the refresh token and the client
secret out of **every response body this route can produce** (seven paths), out of the **error body
even when the fake provider echoes the client secret back**, and out of **every `console.log`
argument, stringified, on both the accepted and the refused path** — plus the `state` and the
`code_verifier`, which are credentials for *this* flow, and `external_account_id`, which identifies
the merchant's business. `exchangeCode` already refuses to interpolate a provider's error body
because providers echo request parameters and the client secret is a request parameter. The
token-death path is unchanged and already exists: `recordFailure` flips health to `needs_reauth`.
> `PASS`

### Tenancy

**5. RLS.** `public.oauth_authorizations` carries `workspace_id`, has `ENABLE` **and** `FORCE ROW
LEVEL SECURITY`, and has **no policy and no grant for any role** — the two-layer posture
`20260912000900` names. Access is exclusively through two `SECURITY DEFINER` functions whose
predicate is `app.can_write_workspace()`. `16_oauth_pending.sql` proves org B cannot redeem org A's
state, in the shape `01_rls_isolation.sql` proves the rest.
> `PASS`

**6. No service-role bypass.** The Worker forwards the customer's own Supabase access token and
mints nothing. There is still **no service-role key in the Worker** and this PR adds no identity and
no role.
> `PASS`

**7. No cross-workspace read.** The one cross-tenant query in this schema remains
`public.due_connections`, untouched and unwidened. Every statement added here is keyed on one
`state`, and the row it returns names one workspace.
> `PASS`

**8. No cross-customer aggregation or benchmarking.** Nothing is aggregated. No percentile, no peer
comparison, no training input.
> `N/A`

**9. API key scope.** Untouched. These routes deliberately **refuse** an API-key session: a minted
token carries no `sub`, so `app.can_write_workspace()` refuses it, and `access-token.ts` refuses it
one layer earlier with `not_a_user`.
> `N/A` — no API-key path in this diff.

### Data movement

**10. No resale or redistribution.** No platform data is read, returned, exported or webhooked here.
The response carries a connection id and a status.
> `N/A`

**11. Meta client list.** Meta onboarding is reachable through this route (`meta_ads` offers the
`oauth` lane), but the client record lives on `workspaces.client_name` / `client_contact` and its
lifecycle is unchanged by this PR.
> `N/A` — no workspace lifecycle change.

**12. Dependency licences.** No dependency added. `@repo/oauth` was already a dependency of
`apps/api-edge`.
> `PASS`

### PII and consent

**13. Hash at the edge.** No email, phone, name or address reaches persistence, a log, R2 or a
prompt. The pending row is `state`, `code_verifier`, `workspace_id`, `provider`, `sources[]`,
`redirect_uri`, `created_at` — checked against `packages/payloads/src/redaction.ts`' **by-key** rule
as the working agreement requires: that module removes identifiers by key and explicitly does not
inspect values, so a personal datum inside a kept key is protected by nothing. There is no kept key
here holding one. `OPENID` is available on Loyverse and is deliberately not requested; the Google
`id_token` is never read. `16_oauth_pending.sql` asserts the column set **exactly**, so the first
person to add `external_account_id` or an email to this table fails the build.
> `PASS`

**14. Forbidden payloads rejected before egress.** Nothing is egressed.
> `N/A`

**15. Per-destination consent.** No audience or conversion write path here.
> `N/A`

### Access tier and quota

**16. Tier reality.** One token-endpoint call per connect; no reporting API is called. Google Ads
operations, GA4 property tokens, Meta's insights budget and Loyverse's 300-per-300-seconds are all
untouched. **This route never retries an exchange**: an authorisation code is single-use at the
provider, so `token_exchange_failed` is a 502 whose message says to start again rather than retry —
a retry loop here would be a retry-storm against a consent endpoint.
> `PASS`

**17. No new long-lead dependency.** It depends on approvals **not held**, and shipping it is what
makes the gap visible rather than theoretical:

| Gate | Observed timeline | Degraded path that ships today |
|---|---|---|
| Google OAuth sensitive-scope verification (`adwords`, `analytics.readonly`) | documented 3–5 days, **observed at over ten weeks**; never quote the shorter figure | The client stays in testing mode and only allow-listed test users complete the flow. The route works; the consent screen refuses everyone else. Loyverse does not depend on it. |
| Meta Business Verification + App Review for `ads_read` | typically weeks 3–8 | Same shape. |
| Loyverse app registration | **self-serve, instant, no review queue** | This is the path that actually ships. It is why client credentials are resolved **per provider** rather than gathered up front: a deployment holding only a Loyverse registration must not answer 503 for a flow it is fully configured for. |

> `PASS` — named, timelined, with the degraded path.

### Claims

**18. Claim provenance.** No user-visible copy is added. No route source gained a `FORBIDDEN_CLAIMS`
string; `forbidden-claims.test.ts` scans every route and passes. No brand fact is flipped.
> `PASS`

**Result:** `11 PASS, 7 N/A, 0 FAIL`

---

## 4. What was left out

**THE WEB HALF.** The redirect-URI route in `apps/web` is not in this PR. This is the Worker half:
the two endpoints, the store, the migration and the suites. The web app's job is narrow and
documented in `oauth-connect.ts` — read `currentWorkspace()` and `getSession()`, POST `code` +
`state` + `external_account_id` onward — and it is a separate change with its own copy constants and
its own `check-copy` surface. **Open an issue; do not widen this PR.**

**ACCOUNT SELECTION, WHICH IS THE REAL GAP AND IS STATED RATHER THAN PAPERED OVER.** `connect()`
needs the id of the account at the provider, and **one Google grant covers many Ads customer ids and
many GA4 properties**. Choosing one requires listing what the grant reaches and asking the customer
— a step this repository has not built for any provider. So the callback **requires**
`external_account_id` in its body and refuses without it.

Inventing one was the alternative and it is exactly the failure this codebase refuses: taking the
first account the grant reaches, or deriving a label from the token response, produces a connection
filed under the wrong account — **numbers that look right**. The residual risk is that a customer
can label a Google grant with a GA4 property the grant does not reach; the first pull 403s and
`recordFailure` turns that into `needs_reauth`, which is the honest failure mode and not a silent
one. Until the selection step exists, the web app must carry the account id the customer typed on
the connect form through the detour — it is not a secret, it is not the state, and it is not put in
the pending row, which is the storage decision this PR implements rather than relitigates.

**A CRON FOR THE SWEEP.** The sweep rides on `start_oauth_authorization`, so a deployment where
nobody starts a flow for a month keeps that month's abandoned rows. They are unreadable and tiny,
and the alternative is a fourth cron and an identity to run it — a larger change than the thing it
would tidy. If it ever matters, the fix is a scheduled call to the existing function, **not a second
TTL constant**.

**THE TRUST-COPY DECISION THAT §1'S READ-ONLY SECTION FORCES.** This PR establishes the standard by
paying for it once (Loyverse, Group 1, at the cost of this whole change) but it **does not decide
LINE, Omise or `drive.file`**, where no Group 1 credential exists at all and the choice is between
weaker copy and no connector. Deciding it here would be scope-widening into a question that belongs
to whoever writes the trust page, and answering it *implicitly* — by letting this precedent stand in
for a decision nobody took — is the failure mode `64-the-build-order.md` §5(h) warns about by name.
**Open an issue; do not widen this PR.** What is recorded here is the shape of the argument, the
price already paid, and the fact that `check-copy` and `forbidden-claims.test.ts` catch banned
strings rather than overclaims, so no guard will catch this going wrong.

**A REFRESH PATH.** `exchangeCode` stores the refresh token and `PROVIDERS.*.issuesRefreshToken`
records who issues one; nothing renews yet. Out of scope, and visible: `connectionHealth` already
reads `expires_at`.

**MULTI-SOURCE GRANTS.** `startAuthorization` accepts several sources and this route sends exactly
one. `toPendingAuthorization` **refuses** a row that does not name exactly one source rather than
taking the first: a grant covering two sources would have to become two connections, which is a flow
nobody has designed, and picking one by array order would file a Loyverse grant as a GA4 connection.

**A CHECK CONSTRAINT ENUMERATING PROVIDERS.** `oauth_authorizations.provider` is bounded `text`, not
an enum and not `check (provider in ('google','meta','loyverse'))`. No guard in `scripts/` relates
`packages/oauth/src/providers.ts` to this schema the way `check-providers.mjs` relates
`ConnectionProvider` to `app.connection_provider`, so a hand-written list here would be **a second
copy of a registry with nothing comparing the two** — and its failure mode is the expensive one: a
provider added in TypeScript fails on the INSERT, in production, after the merchant has finished
authorising. The narrowing happens where the registry lives, on both the write and the read.

---

## 5. Open or unverified spec items this builds on

**PKCE ON LOYVERSE IS UNVERIFIED AND IS THE LIKELIEST THING TO BREAK THE FIRST REAL MERCHANT
AUTHORISATION.** `startAuthorization` always sends `code_challenge` and `code_challenge_method`, and
`exchangeCode` always sends `code_verifier`. **Loyverse documents neither.** Unknown authorisation
parameters are usually ignored, and an unknown `code_verifier` at a token endpoint usually is too —
but *usually* is the whole risk, and **the failure is invisible until a real merchant tries**,
because no fixture can tell us. **I could not find Loyverse documentation stating either way. That
is a finding, not a gap to paper over.**

PKCE is **not** dropped to make the first attempt more likely to succeed. Without it, an
authorisation code intercepted on the redirect is enough to obtain a token — and that is a
self-contained reason that needs no external mandate. (The "mandatory PKCE" line in
`00-recon-reports.md` is about **our** MCP server surface, not about an outbound OAuth client; it is
not evidence for this decision and is not cited as though it were.)

> **DAY ONE, NOT A FOOTNOTE.** The first thing to do against a real Loyverse merchant account —
> before any ingest work, before the web half is polished, and *before a merchant who is not us is
> asked to authorise anything* — is to complete one authorisation end to end and watch which of
> three things happens:
>
> 1. **It works.** PKCE is silently accepted. Record that here as VERIFIED with the date, and this
>    item closes.
> 2. **The authorize URL is rejected** (an error at the consent screen, or `code_challenge` echoed
>    back as an unknown parameter). Then `code_challenge` and `code_challenge_method` must become
>    per-provider in `PROVIDERS`, not dropped globally — Google and Meta both take them and both
>    should keep them.
> 3. **The authorize URL is accepted and the token endpoint rejects the exchange.** This is the
>    nastiest case, because the merchant has already consented and the failure lands after the
>    detour. `code_verifier` is then the parameter to make per-provider.
>
> **Only case 1 is a result. Cases 2 and 3 are one-line changes, and knowing which one it is costs
> one test authorisation.** What is not acceptable is discovering it from a customer, which is
> exactly what happens if this is left until a merchant is onboarded: no fixture, no test and no
> amount of re-reading the code can produce this answer, because the answer lives on Loyverse's
> servers.

If the first merchant authorisation does fail, `code_challenge` is the first parameter to look at,
and the test that pins the current behaviour is
`"starts loyverse, which is oauth-only BY REFUSAL and unreachable until this route existed"`.

**A SESSION THAT LAPSES DURING THE DETOUR SILENTLY LOSES THE FLOW.** Redemption requires the
customer's Supabase session at the callback, because that is what makes the workspace come from the
session rather than from the redirect. A customer who takes long enough at Google's consent screen
for their session to lapse lands on sign-in; the pending row is never redeemed; the authorisation
they just granted produces no connection. **They see a sign-in page, not an error about the
connection.** Accepted, and the mitigation belongs to the web half: a named refusal message rather
than a bare redirect. Filed as such rather than discovered.

**TWO MEMBERS OF THE SAME WORKSPACE ARE NOT SEPARATED.** `app.can_write_workspace` is the tenancy
predicate, so an owner or admin of the same workspace can redeem a state started by a colleague.
They could create the same connection directly, so no privilege is gained — but this is a real
narrowing a browser-bound cookie would have given and the database does not. Stated rather than
discovered.

**THE `code_verifier` IS IN BACKUPS AND IN POINT-IN-TIME RECOVERY** for as long as those are kept,
even though the live row is gone within the hour. It is not a credential on its own — completing an
exchange also needs the one-time code and the client secret, which is a Worker secret and is not in
that database — but a restored backup is a place a verifier exists after everyone has stopped
thinking about it. The mitigating design choice is the column list: nothing else in the row is
personal data.

**`webmasters.readonly`'s SENSITIVE-SCOPE STATUS IS UNCONFIRMED** (`PROVIDERS.google`, §3.5). If it
falls behind the same unbounded review, `search_console` may not make the launch connector list —
which this route would then start a flow for that the consent screen refuses. Nothing here asserts
otherwise.

**PER-TENANT GOOGLE DEVELOPER TOKENS IN A MULTI-TENANT SERVICE ARE UNDOCUMENTED.** This PR takes no
position: the OAuth client registration is a deployment binding and the developer token is not
touched. If the answer comes back that each tenant needs its own, the `OAUTH_GOOGLE_*` bindings
become per-workspace and `clientCredentials` gains a workspace argument — a change confined to
`index.ts` and the deps interface, because the route asks for credentials through a function rather
than reading `env`.

**GOOGLE'S REFRESH-TOKEN BEHAVIOUR IS A HARD FAILURE HERE, DELIBERATELY.** Google issues a refresh
token only on the first authorisation for a client and account unless `access_type=offline` and
`prompt=consent` are both sent. `PROVIDERS.google.extraAuthParams` sends both, and `exchangeCode`
refuses a Google grant that comes back without one (`missing_refresh_token`, 409). Without that
refusal the connection dies silently within the hour with `ok: true` on the connect.

---

## 6. Verification

Run by exit code, never by reading output.

```
./scripts/gate.sh
  check-brand                ok
  check-capabilities         ok
  check-claim-sources        ok
  check-copy                 ok
  check-dictionary           ok
  check-providers            ok
  check-registry             ok
  check-tokens               ok
  biome-lint                 ok
  biome-format               ok
  typecheck                  ok
  test                       ok
  PASS -- every check exited 0

sudo -u postgres env PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=postgres \
  ./supabase/tests/run-local.sh                                        → exit 0

  (the script defaults to PGPORT=5433 and PGUSER=postgres over peer auth; on this machine the
  cluster is on 5432 and the shell user is not a role, so both are overridden on the command
  line rather than by editing the script. Exit code read directly -- NOT through a pipe to
  `tail`, which reports the exit status of `tail`. That mistake reports 0 for a failing suite.)
  oauth pending suite: 33 passed, 0 failed, 33 total   (new; floor 29)
  force rls suite:     47 passed, 0 failed             (was 45 — two more, ENABLE and FORCE for the
                                                        new table, read off the catalogue)
  anon grants suite:  149 passed, 0 failed             (was 142 — seven more, one per privilege on
                                                        the new table, also catalogue-driven. The
                                                        anon-executable FUNCTION set is unchanged at
                                                        exactly three: both new functions are
                                                        granted to `authenticated` alone, so that
                                                        expected list did not have to move.)
  every other suite:   unchanged

pnpm --filter web build   → exit 0
```

### Mutation proofs

Every guard and every refusal was broken, watched go red by name, and put back.

**The migration and `supabase/tests/16_oauth_pending.sql`:**

| Mutation | Test that went red |
|---|---|
| Dropped `grant execute … to authenticated` on `redeem_oauth_authorization` | `authenticated may execute public.redeem_oauth_authorization(text)` |
| Dropped `public` from both `revoke all … from public, anon, authenticated` | `public.{start,redeem}_oauth_authorization … is an intended anon-executable function` and `exactly the three intended functions are anon-executable in public` — caught by `07_anon_grants.sql`, one file earlier |
| Removed `app.can_write_workspace(a.workspace_id)` from the redeem predicate | `carol redeeming alice's state gets zero rows, decided by the database` **and** `alice redeems her own authorisation and gets the code_verifier back` — the second is why Carol goes first in that file |
| Sweep horizon changed from `1 hour` to `10 minutes` | `the sweep LEFT the thirty-minute-old one -- the horizon is GC, not the ten-minute TTL` and ``a thirty-minute-old authorisation is still returned, so verifyCallback can say `expired` `` |
| `delete … returning` changed to a non-destructive `select` | `the same state redeemed a second time is zero rows -- one authorisation, one connection` and `the redeemed row is gone from the table, not merely filtered` |
| `force row level security` dropped, leaving only `enable` | `public.oauth_authorizations has row-level security FORCED, not merely enabled` — caught by `15_force_rls.sql`, from the catalogue, on the day the table landed |
| A permissive `for all using (true)` policy added "to keep the definer writer working" | `public.oauth_authorizations has NO policy of any kind -- the functions are the only way in` |

**The Worker and `apps/api-edge/test/oauth-connect.test.ts`:**

| Mutation | Test that went red |
|---|---|
| `returnedState: parsed.state` → `pending.state` (the state **echoed** rather than verified) | `is still compared by 'verifyCallback' even though the lookup found the row by it` |
| `state_mismatch` collapsed into the retryable `store_unavailable` | `is refused when it names no pending authorisation`, `is refused when another tenant presents it, and the DATABASE is what refuses`, `is SINGLE-USE: replaying the same code twice does not attach twice` |
| `verifyCallback` given the row's own `createdAt` as `now`, so nothing ever expires | `is refused against PENDING_TTL_MS, and nothing is exchanged` |
| The store stops destroying the row it returns (a read, not a delete) | `is SINGLE-USE: replaying the same code twice does not attach twice`, plus two others |
| `isOAuthSource` check removed from the start route | `is refused, and the refusal says which lane it does offer` |
| The 201 body carries `access_token` back | `appears in no response body this route can produce` |
| The callback log line carries `external_account_id` and `refresh_token` | `appears in no log line, on the accepted path or on a refused one` |

Two of those deserve a note. The **echoed state** mutation is the bug the whole constraint names,
and only one test catches it — the one that hands the route a store answering with a *different*
row than the state asked for. Without that test the lookup would be the only thing standing there,
and a refactor that looked a pending record up by workspace would pass every other assertion in the
file.

The **non-destructive store** mutation is applied to the test's own fake PostgREST, deliberately:
the single-use property belongs to `delete … returning`, and this proves the Worker test detects a
store that does not destroy. That the *real* store does destroy is proven separately, in SQL, by the
fifth row of the first table.
