# 89. A door for a table that had none

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`public.api_keys` has existed since 8 September. It carries a spend budget, a tool allow-list, a
hashed credential, a display prefix, three RLS policies, and a `verify_api_key` function the Worker
already calls on every `/v1/performance` request. **Nothing could make one.** A customer could be
sold an API and have no way to obtain a key for it.

This adds `/keys`: an owner or admin can see the workspace's keys, make one, and retire one. The
plaintext is shown once and stored nowhere.

It is the same family of defect as note 87's: every artefact says the feature is there — the table,
the policies, the verifier, the spec section — except the one a customer touches.

**The decision: the screen hands over a working key while admitting it does not know where to point
it.** `apiUrl()` throws unless `PUBLIC_API_URL` is set or `brand.apiBaseUrl` is settled, and it
throws deliberately: *"Refusing to derive one from the site URL — the API is a different origin, and
a URL on the site's domain would resolve to the marketing site rather than fail."* The alternative
considered and rejected was to block the whole screen until somebody settles the hostname. That is
the wrong trade: the key is real and works the moment its address is known, and a customer who has
one can be told the address in a sentence. So the throw is **caught and turned into an explanation**
— the only `try` in `page.tsx`, and it converts a refusal into a sentence, never into a default.

**The second decision: `key_hash` is named in exactly one file, and only as something written.**
`api_keys_select` returns the whole row to an admin, hash included. RLS decides which *rows* a
session sees; it has no opinion about columns, and nothing in this schema would stop `select("*")`
putting the SHA-256 of every live credential into a server-rendered document. Every column is named,
and `_keys.test.ts` asserts the hash is absent from the read — **and that it is a real column**, so
"absent" is a fact about the schema rather than about a typo.

**The third: the digest comes from `@repo/store`, not from a second SHA-256.** `hashApiKey` is what
the Worker feeds `verify_api_key`, `\x` bytea framing included. A second implementation here would
compile, pass a test of its own, and mint credentials the Worker refuses — with neither half able to
say which was wrong.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.`

No platform read, no envelope row, no R2 object, no KV write, no model call, nothing on the
scheduler. One insert per key made and one update per key retired, at the frequency a business
changes the tools that read its own figures. The keys this screen mints will later consume the
metered surface, but the *meter* is `verify_api_key` and `credits_used`, both of which already exist
and are unchanged here. The scheduler's useful-row ratio (spec §8's open question) is untouched.

## 3. Platform-terms check

### Credential

**1. BYOC.** No platform call on any path in this diff. The credential minted here is one **this
company issues for its own API**, not a platform token: no Google, Meta, GA4 or Search Console call
is made, and no developer token or GCP project is involved.
> `PASS`

**2. Vendor-key exception.** No company-held platform key used.
> `N/A`

**3. No token pass-through.** No MCP surface touched. The key this screen mints is the one the MCP
server will later resolve to a workspace; nothing forwards it upstream.
> `N/A`

**4. Credential hygiene.** The gate this whole unit is about. The plaintext exists in exactly one
place — the state returned to the admin who made it — and is rendered once. It is **not** written to
any column (`actions.test.ts` asserts it against *every* field of the insert, not one), not logged
on the happy path or on any refusal (`console` is spied and asserted empty), and not put in a cache
entry. What is stored is the SHA-256 and a non-secret display prefix. `_keys.test.ts` asserts the
digest is never read back.
> `PASS`

### Tenancy

**5. RLS.** No new table, column or policy. The three that exist are unchanged and are what this
screen reads and writes through.
> `N/A`

**6. No service-role bypass.** Every query runs on `supabaseServer()` under the caller's own cookie
session. No service-role key exists in this app and none was added. The role gate in the action is
**not** the tenancy guarantee — `api_keys_insert` and `api_keys_update` are, both keyed on
`app.is_org_admin` — it is there so a refusal is a sentence rather than a silently empty result.
> `PASS`

**7. No cross-workspace read.** No workspace predicate is written in application code, for the house
reason `_auth/workspace.ts` sets out: RLS does tenancy, and a `.eq("workspace_id", …)` would be the
second place it is decided. The workspace on an insert comes from `currentWorkspace()`, which reads
it from the session, never from the caller.
> `PASS`

**8. No cross-customer aggregation.** None.
> `N/A`

**9. API key scope.** Directly on point. Every key minted here carries exactly one `workspace_id`,
taken from the session. `monthly_credit_budget` and `allowed_tools` are columns of the row the
Worker reads before its first upstream call, and this screen renders both — a null budget as "no
ceiling set" and an empty allow-list as every tool, per the schema's own comment. Neither is
collapsed into a zero.
> `PASS`

### Data movement

**10. No resale or redistribution.** Nothing leaves the workspace. A key is a credential for reading
the customer's *own* rows.
> `PASS`

**11. Meta client list.** Untouched.
> `N/A`

**12. Dependency licences.** No third-party dependency added. `apps/web` gains a workspace
dependency on `@repo/store`, which is this repository.
> `PASS`

### PII and consent

**13. Hash at the edge.** No personal datum is handled. A key row carries a name the customer
chooses, a prefix, a digest and counters — no address, no identifier. **No column was added**, so the
`packages/payloads/src/redaction.ts` check a new personal-data column would demand does not arise.
`created_by` is a `members.id`, which is the same id `security_events.subject_id` already uses for
the reason note 87 records: an id rather than an address, because an address is personal data with a
retention question this schema has not answered. Nothing reaches a model prompt.
> `PASS`

**14. Forbidden payloads.** The form takes one name, capped at the column's own 120 characters.
> `N/A`

**15. Per-destination consent.** No destination record.
> `N/A`

### Access tier and quota

**16. Tier reality.** No platform quota consumed.
> `PASS`

**17. No new long-lead dependency.** Nothing waits on an approval. It does depend on a **decision**
— the API's hostname — and that is handled by saying so rather than by blocking.
> `PASS`

### Claims

**18. Claim provenance.** No claim from `@repo/brand` is published or altered, and the `api-access`
family of claims is untouched: this screen makes no promise about what the API returns, only about
the key. Every sentence is signed-in copy in `KEYS_COPY`, behind `robots: { index: false }`, and
`forbidden-claims.test.ts` scans this route like every other. Nothing asserts SOC 2, ISO 27001, an
audit, a penetration test, or compliance with any law.
> `PASS`

**Result:** `12 PASS, 6 N/A, 0 FAIL`

## 4. What was left out

* **Setting a budget or a tool allow-list from the screen.** Both are columns, both are rendered, and
  neither is editable yet. Making one is the gap that stopped a customer dead; tuning one is not, and
  an edit form for `allowed_tools` needs a list of tool names that does not exist in this repository
  to enumerate from — which would mean typing one, which would be a second list. Issue, not scope.
* **`expires_at`.** Same: the column exists, the verifier honours it, the table shows "Expired", and
  nothing sets it. A date picker with no policy behind it invites a customer to choose a number for a
  question nobody has asked.
* **Recording key creation in `security_events`.** Note 87 counted five declared event types with no
  caller and named the API-key ones among them. This adds the act those events describe without
  wiring them, which is the exact pattern that note is about — so it is stated here rather than
  discovered later. Wiring it is a migration and belongs with the connection events.
* **Rotation.** Retire and make another is the whole of it today. A one-click rotate is a second
  credential alive at once, which needs an overlap window nobody has chosen.
* **Settling the API's hostname.** **Founder action.** `brand.apiBaseUrl` is null and
  `brand.test.ts` asserts it is; the Worker is on `workers.dev` and no hostname routes to it. Until
  that is decided the screen says so.

## 5. Open or unverified spec items this builds on

* **The API's base URL is undecided**, and this screen is built to work either way rather than to
  wait. If the answer turns out to be a path on the site's origin rather than a separate host, the
  `apiUrl()` refusal is the thing that changes, not this page.
* **`key_prefix` is `mp_live_…` and never `mp_test_…`.** The column permits both and this product has
  no test mode — no sandbox, no fixture tenant, no path where a test key behaves differently. A key
  labelled test that does exactly what a live key does is a label that lies, and the customer who
  believes it is the one who pastes it somewhere public. When a sandbox exists this is the line that
  changes, and `_mint.test.ts` is what will notice.
* Nothing else. No platform freshness window, quota constant, restatement ladder or statutory
  deadline is relied on.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm -r test                      # 0  — web 729, api-edge 328, insights 146
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  — all nine
./supabase/tests/run-local.sh     # 0  — 718 assertions, 0 failed
pnpm --filter web build           # 0  — production build
```

### Mutation proof

Fourteen mutations, fourteen **named** tests red, each put back.

| Mutation | Test that went red |
|---|---|
| add `key_hash` to the columns read | `does not read the hash, which is a real column and therefore really excluded` |
| `select("*")` instead of naming columns | `never selects every column` |
| name a column the table does not have | `names only columns the table actually has` |
| invent a base URL when none is settled | `says the address is unsettled rather than printing one` |
| run the query for a viewer and show what comes back | `tells a viewer they cannot see keys rather than showing an empty list` |
| render never-used as `0` | `renders never-used and no-ceiling as words, never as zero` |
| render no ceiling as a ceiling of zero | same test |
| drop the timezone from the date | `formats that date IN the zone it names, not merely beside it` |
| store the key instead of its hash | `returns the key once and writes only a hash and a prefix` |
| call an insert that returned no row a success | `treats an insert that returned no row as a failure` |
| call a revoke that changed nothing a success | `refuses when the write changed nothing, rather than reporting success` |
| let a viewer write | `refuses a viewer before it touches the table` |
| draw the prefix independently of the key | `makes the prefix the start of the key, not a separate draw` |
| fold the biased bytes in with a modulo | `rejects the bytes that would bias the SECRET alphabet rather than folding them in` |

**Three of these earned their place by first passing, and each one is a finding.**

1. **The timezone mutation was green.** Deleting `timeZone: KEY_ZONE` from the formatter changed
   nothing in the rendered string: the " UTC" the assertion looked for is appended from a constant
   either way, and CI runs in UTC. The label survived while the formatter quietly went back to
   resolving to whatever zone the process is in — invisible on the deploy target, and a date that
   contradicts its own label on a developer's machine in Bangkok. The runner's zone cannot be changed
   from inside the test, so the **option** is now asserted rather than the output: `Intl.DateTimeFormat`
   is stood in for by a recording class, and every construction must carry `timeZone: "UTC"`.

2. **The bias assertion was written against the wrong half.** It fed a source of nothing but `255`
   and `0` to the *display* alphabet and expected the `255` to be rejected. It is not: that alphabet
   has 32 symbols, 256 is a whole multiple of 32, and `% 32` is already uniform. The rejection
   matters only for the 36-symbol *secret* alphabet, where the largest whole multiple is 252. The
   test now targets that half, and a second assertion states the display alphabet's size divides 256
   as a property — so if a character is ever added or removed there, the omission is loud.

3. **A `next build` failure that no other gate could see.** `apps/web` importing `@repo/store`'s
   barrel fails with eight `Module not found`s, because `src/index.ts` re-exports its siblings as
   `./thing.js` and Turbopack will not map that onto the `.ts` beside it. This is the failure
   `next.config.ts` predicts in writing — *"any package added here brings its specifiers with it, and
   `next build` is the thing that says so"* — hit by the next package pulled in. `tsc`, `vitest` and
   the Worker's own bundler all resolve it fine. Fixed by importing `@repo/store/jwt`, the leaf
   module, which imports nothing at all and therefore has no specifiers to get wrong.

   The same build also caught a client-bundle leak: `_table.tsx` is a client component and imported
   `ApiKeyRow` with a value import, dragging `_keys.ts` — and through it `next/headers` — into the
   browser. `import type` is erased before the bundler sees it. Biome's `useImportType` had flagged
   it as style; it was correctness.
