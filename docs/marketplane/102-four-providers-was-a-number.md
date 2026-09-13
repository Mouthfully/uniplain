# 102. "Four providers" was a number

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`apps/web/app/brief/actions.ts` posts a workspace's computed figures to `openrouter.ai`. It has done
so since `/brief` shipped.

OpenRouter appeared in **no processing activity**, in **no sub-processor list**, on `/privacy`,
`/processing` or `/sub-processors`, in the **generated Art. 30(1)(d) record**, or in **SCC Annex
III**. The privacy notice said, in words a customer's counsel reads:

> **Four providers process data on our behalf in order to run this service.**

There were five.

**A wrong number that looks right, in a statutory disclosure.** CLAUDE.md's one rule names that as
the worst possible outcome, and the reason it gives is exactly what happened here: nothing told
anybody it was wrong.

### 1.1 The decision not to list it had been taken, correctly, and then falsified

This is the part worth reading, because "somebody forgot" would be a much less useful story. The
clause carried this comment, in capitals, directly above the sentence:

> **OPENROUTER IS DELIBERATELY NOT IN THIS LIST.** `packages/insights` can call it and nothing does:
> no route, no cron, and no key configured on any surface. Listing a processor that receives nothing
> would be the same defect as omitting one that does. **It joins this list in the change that gives
> it a caller, not before.**

Every word of that was true when it was written, and it is the right reasoning — over-disclosure is
a real defect and the ordering it asks for is the right ordering. `/brief` then gave OpenRouter a
caller, and **nothing brought anybody back to the comment.** A correct decision, invalidated by a
later commit, with no mechanism attached to it.

### 1.2 Two guards already covered this and both were green

- `sub-processors.test.tsx` asserts the published list and the record of processing agree **in both
  directions**. Green: a recipient absent from the record is absent from the list, and **two lists
  that omit the same thing agree perfectly.**
- The "record" side of that comparison was `recipientsInRecord()`, whose own comment reads *"every
  sub-processor the record of processing **actually names**"* — and whose body was
  `return [...RECIPIENTS]`, a **hand-typed array of four literals**.

So the strongest-sounding assertion in the compliance surface — *both directions* — was comparing a
disclosure against a copy of itself. **Consistency between copies is not evidence.** That sentence
is the whole unit.

### 1.3 What changed, and why each change is a different kind of fix

| Change | What it fixes |
|---|---|
| OpenRouter added to `PROCESSING_ACTIVITIES` and `SUB_PROCESSORS` | the disclosure itself |
| `RECIPIENTS` **derived** from the activities' `recipients` | the function whose name claimed a derivation it did not perform |
| The `/privacy` clause **generated** from `SUB_PROCESSORS`, **with no count in it** | the typed sentence, and the typed number inside it |
| `scripts/check-recipients.mjs` | the thing none of the above can do: read an input the lists are not copies of |
| The privacy-notice test now **renders** the page instead of `readFileSync`-ing it | an assertion that passed on a name appearing in a comment |

**The count is deleted rather than derived.** Spelling "five" from `SUB_PROCESSORS.length` would
work and is still the wrong shape: a count is a second statement of a fact the list already makes,
and it is the half a reader believes without checking. The list is the count.

### 1.4 The guard reads the source, because that is the one input a list cannot copy

Every `https://host` in shipped TypeScript must be classified in `recipients.ts`:

| Role | Meaning | Obligation |
|---|---|---|
| `sub-processor` | receives data on our behalf | must be in `SUB_PROCESSORS`, so every generated disclosure gains it |
| `tenant-platform` | the customer's own platform on the customer's own credential | **not** ours to disclose — listing Google as our sub-processor would misdescribe who is accountable to whom |
| `public-source` | read from, told nothing about any tenant | none |
| `own` | this product's own domain | none |
| `not-requested` | a literal with no request behind it | the note has to say why |

22 hosts today. A new one fails the build until somebody says which it is — and saying
`sub-processor` fails again until the disclosure names it.

**`tenant-platform` is checked structurally rather than trusted**, and that came out of a mutation
that walked straight through the first version. Relabelling `openrouter.ai` from `sub-processor` to
`tenant-platform` left the guard **and all 88 tests green**, because the disclosure chain runs from
`PROCESSING_ACTIVITIES` and a lie told only in `recipients.ts` broke nothing — two independent lists
again, which is the defect reappearing inside its own fix. So: **BYOC is architectural, therefore
checkable.** "The customer's own platform on the customer's own credential" means the call is made
where a per-workspace credential is opened — `packages/oauth`, `packages/connectors`,
`packages/connections`. A host claiming that role from anywhere else is claiming it from a file with
no tenant credential to use. `openrouter.ai` is reached from `packages/insights` on a **platform**
key, and the relabel now fails by name.

### 1.5 The email package, and a comment turned into a coupling

`packages/email/src/send.ts` says:

> **IT IS ALSO A FIFTH SUB-PROCESSOR.** … The clause must be amended in the change that gives this
> package its first real caller, not later.

That is the same ordering the OpenRouter comment asked for, written by somebody who had just watched
the risk. `@repo/email` is genuinely unwired — nothing outside the package imports it, so Resend
receives nothing and disclosing it now would be the over-disclosure error in the other direction. Its
`recipients.ts` entry carries `noCallerOf: "@repo/email"` and the guard asserts the absence. **The
day an import lands, the build fails and names the disclosure that has to be written in the same
change.** Proven by adding the import; see §6.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. No migration, no table, no query, no upstream call added. `/privacy`
renders a few more paragraphs, `/sub-processors` one more row, and both are statically rendered.

**One real consequence, and it is not a cost in money.** Adding a sub-processor opens the Art. 28(2)
notice window: `lastChangedAt()` is now today, `noticeWindowOpen()` returns true for thirty days,
and the in-product notice shows on the dashboard. That is the mechanism working — this is exactly
the event it was built for — and it means the change is announced rather than quiet.

## 3. Platform-terms check

### Credential
**1. BYOC.** > **`PASS`, and this gate is now enforced rather than asserted.** No platform call is
added, and the guard refuses a host claiming to be the customer's own platform from outside the code
that opens a per-workspace credential. `OPENROUTER_API_KEY` is a platform key and is documented as
one in `brief/actions.ts`; it is nowhere near `CREDENTIAL_KEK` or the vault path. &nbsp;
**2. Vendor-key exception.** > **Named rather than waved through.** OpenRouter *is* a company-held
key on a tenant request path, which gate 2 confines to public-data sources. It has been that since
`/brief` shipped and this change does not alter it — what changes is that it is now disclosed. Flagged
in §5 as the one gate this unit makes visible and does not resolve. &nbsp;
**3. No token pass-through.** > `N/A` — no MCP surface. &nbsp; **4. Credential hygiene.** > `PASS` —
no credential in the diff; nothing in the returned brief state carries the key.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `N/A` — no new request
path. &nbsp; **7. No cross-workspace read.** > `PASS` — the brief reads one workspace and the
identifier sent is a salted hash of that one workspace id. &nbsp; **8. No cross-customer
aggregation.** > `PASS` — nothing aggregated; `NO_PRIORS`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > **`PASS`, and this is the gate the unit is about.** Data
moves to OpenRouter and always did; what this change does is say so. Every call carries
`data_collection: "deny"` and `zdr: true`, built by one builder and re-checked by the client.
&nbsp; **11. Meta client list.** > `N/A`. &nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `PASS` — nothing the customer typed reaches the prompt: the system
prompt is a module constant, the user prompt is computed figures, dictionary labels and source ids,
and `InsightRow` carries no entity name. The tenant identifier is a salted SHA-256 produced by one
function that refuses to run without a salt. &nbsp; **14. Forbidden payloads.** > `PASS` — no
special-category field exists to send. &nbsp; **15. Per-destination consent.** > `N/A` — no consent
object.

### Access tier and quota
**16. Tier reality.** > `N/A` — no platform quota touched. &nbsp; **17. No new long-lead
dependency.** > `PASS` — OpenRouter is already in use; nothing new is depended on.

### Claims
**18. Claim provenance.** > **`PASS`, in the direction that matters: this REMOVES a false
statement.** "Four providers process data on our behalf" was a published claim about this company's
own conduct and it was untrue. The replacement is generated, so it cannot be untrue by drift. No
claim id is added, `no-pooling` and `no-training` are unaffected — both are about
`data_collection: "deny"` and `zdr: true`, which were always sent — and `request.ts`'s own warning
stands: those fields still permit 30-55 day retention at some providers, which is why the activity's
retention field says so rather than claiming zero.

**Result:** `12 PASS, 5 N/A, 0 FAIL, 1 flagged` — gate 2, in §5.

## 4. What was left out

- **Whether what OpenRouter receives is personal data at all.** The figures are measurements of a
  business and the identifier is a salted pseudonym. The activity states the facts and declines the
  conclusion, because it is a legal determination and the disclosure does not depend on it: a
  controller deciding whether to appoint this company is entitled to know who receives their data
  either way.
- **A retention period for OpenRouter.** `zdr: true` is requested on every call; OpenRouter's own
  documentation says its provider-policy data "is not a definitive source of third party data
  policies". Writing a number here would be repeating a third party's best knowledge as this
  company's commitment.
- **Resend.** Genuinely unwired. Disclosing a provider that receives nothing is the same defect
  pointed the other way, and §1.5 is the enforcement instead.
- **Scanning test files for hosts.** They are full of fixture hosts and the invariant is about code
  that ships. A test reaching a real host is a different problem with a different guard.
- **`http://` and template-built URLs.** The guard reads `https://` literals. A host assembled from
  fragments defeats it, which is stated in §5 rather than claimed away.

## 5. Open or unverified spec items this builds on

- **Gate 2 is now visible and is not resolved by this unit.** The platform-terms check confines a
  company-held key to public-data sources, and `OPENROUTER_API_KEY` is a company-held key on a
  tenant request path. That predates this change by every commit since `/brief` shipped; disclosing
  the recipient is what made it legible. It deserves its own decision — whether the model call is
  BYOK, or whether gate 2's scope was only ever about *platform* data — and an issue rather than a
  paragraph here.
- **The guard reads `https://` string literals only.** A host built by concatenation, read from an
  environment variable, or reached over `http://` is invisible to it. Supabase, Cloudflare, Vercel
  and Stripe are all reached without a literal host in the source, which is why the reverse
  direction — every disclosed sub-processor has a classified host — **is not asserted**: it would be
  false for four of the five.
- **The claim that nothing tenant-written reaches the prompt** is CLAUDE.md's rule and
  `brief.ts`'s construction, read rather than re-derived here. If a field is added to `InsightRow`
  that carries customer text, this activity's categories become wrong and no guard in this change
  would catch it.
- **`recipientsInRecord()` was wrong for as long as it existed**, and its own doc comment described
  the correct behaviour. A comment asserting what the code does is not a check on what the code
  does — worth recording, because this repository's comments are unusually load-bearing and that
  cuts both ways.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all eleven check-*.mjs    = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
```

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| A new host in a shipped file | *tracker.example-analytics.net appears in apps/web/app/brief/actions.ts and is classified nowhere* |
| **Relabel `openrouter.ai` as `tenant-platform`** | **first version: guard green, 88 tests green.** After the BYOC path rule: *classified as the customer's own platform and appears in packages/insights/src/request.ts, which is not connector or OAuth code* |
| Remove OpenRouter from `SUB_PROCESSORS`, leaving the host classified | *classified as a sub-processor named "OpenRouter", which is not in SUB_PROCESSORS* |
| `import { sendEmail } from "@repo/email"` in `brief/actions.ts` | *@repo/email is recorded as having no caller, and apps/web/app/brief/actions.ts imports it. Disclose it in this change* |
| Delete the `insight-generation` activity | **four** tests red: the processor-role list, the rendered privacy notice, the both-directions comparison, and "gives every provider at least one activity" |

**The second row is the one that matters and it is a mutation that FAILED FIRST.** It walked through
the guard and every test, because relabelling a host in `recipients.ts` alone broke nothing — the
disclosure chain runs from the activities. That is the original defect reappearing inside its own
fix: a third list, independent of the other two, agreeing with nobody. It is why the BYOC rule is
structural rather than a note, and why it is written down here rather than quietly corrected.

The first version of the `noCallerOf` check also fired on `recipients.ts` itself, which names
`@repo/email` in the note explaining that nothing imports it — a guard tripping over the document
that describes it. Matching an import rather than a mention fixed it.
