# 69. The first surface that hands an insight to a customer

**PR:** #59 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

`packages/insights` has been able to write a brief since it landed, and nothing called it. No route,
no cron, no key on any surface — verified repeatedly this week and recorded on
[#49](https://github.com/Mouthfully/uniplain/issues/49) as the one unmet criterion in its own
"done looks like" list.

`/brief` closes that, for one signed-in workspace, on demand, on one screen: read the rows, compute
the figures, write the brief, check every number back out of it, render what survives — **or render
exactly why nothing did.**

## 2. On demand, not on a clock, and the copy does not pretend otherwise

The product's own copy promises a brief every morning. **This is not that**, and the page says
nothing that implies it is. There is no scheduler calling the engine and no channel to deliver
through; the morning half is a cron and a channel adapter, which is the next unit.

A page that generated on every view would also spend a provider call each time somebody refreshed.
So the owner asks, and gets one. `_content.test.ts` asserts no string on this surface promises a
cadence it does not have.

## 3. Every refusal is rendered, and three of them must never become one

The rule this unit is built around: **no branch returns something that looks like a brief.** There
is a `BriefState` for every way it can fail, each carries the engine's own code, and the page shows
it. The three that matter are genuinely different statements about the world:

| State | A statement about | Called a model? |
|---|---|---|
| `figures_refused` | **the customer's data** — no rows, mixed currency, no readable metric | no |
| `model_failed` | **our infrastructure** — the provider could not be reached | yes, and it failed |
| `refused` | **the model** — it wrote a number the figures do not support | yes, and the gate caught it |

Collapsing them into "something went wrong" would hide the third, and the third is the entire
product. **A customer who never sees a refusal has no reason to trust the briefs that are not
refused**, so the refusal state gets the most space on the page and says plainly that it is the
product working rather than failing. A test asserts all six failure messages and all six headings
are distinct, and a mutation that gives two of them the same sentence turns it red.

**A failed read is not an empty period.** `briefRows` returns a refusal rather than `[]` on a
database error, because `[]` would reach the engine as `no_rows` and the owner would be told their
week was empty when what happened was a fault. The dashboard learned this exact lesson already
(`DASH_STATE.rowsUnavailable`); it matters more here, because a brief makes sentences out of what it
is given.

## 4. `entity_name` is not selected, and that is two locks rather than one

The column holds a campaign, listing or product name **typed by the customer** — the one field on
the row that can contain anything at all, including a person's name. That is
[#53](https://github.com/Mouthfully/uniplain/issues/53), filed earlier today.

`InsightRow` has no field to receive it, so the type already refuses it. `BRIEF_COLUMNS` refuses it
again, one layer earlier. **The two fail differently and that is why both exist:** the type stops a
mistake at compile time, and the absent column keeps the value out of the process even if somebody
later widens the type. `CLAUDE.md`'s rule — nothing tenant-written reaches a model prompt — is worth
two locks.

This is a second read of `envelope_rows` beside `performanceRows`, deliberately rather than a
widening of it: the engine needs `timezone`, `account_id` and `entity_type`, which the dashboard's
table renders nowhere.

**No tenancy predicate**, for the reason `workspace.ts` gives: row-level security decides what this
session sees, and a `.eq("workspace_id", …)` here would be a second place tenancy is decided — the
one that eventually disagrees, while being invisible to a policy audit because it lives in a React
file.

## 5. Three things that refuse instead of defaulting

**The business type.** `leadingMetrics(business)` takes the type as an **input**; nothing infers it,
and `SimplerWay`'s "Learn" step says so in as many words. So the owner picks it, the select has no
pre-selected option, and the action returns `no_business_type` rather than assuming. A default here
would quietly decide that every guesthouse is a café.

**The tenant salt.** `opaqueTenantId` refuses without one, and that is its rule rather than this
file's: an unsalted hash of a workspace uuid is reproducible by anyone holding the uuid, which is
the exact join the `user` field exists to prevent. Missing salt is `not_configured`, never a
fallback.

**The date.** `periodFor` throws on anything that is not `YYYY-MM-DD`. A substituted date would put
a period in the heading that the figures do not cover — the same class of mistake as a defaulted
currency.

## 6. The period, and why it takes "today" as an argument

**Seven days against the seven before them.** A single day against the day before is the noisiest
comparison a shop can make — a wet Tuesday against a dry Monday says nothing — and is also the most
likely to band `large` in `salience.ts` for a reason nobody can act on. Seven against seven puts
every weekday on both sides. It ends **yesterday**: a day still in progress is not a day, and
including this morning would compare four hours of trading against seven full days and call the
difference a fall.

`periodFor(today)` takes the date rather than reading a clock, so the period is an **input to the
request that produced it** and reconstructible afterwards. A function reading `new Date()` inside
would answer differently at 23:59 and 00:01 with no record of which it had been. The page reads the
clock once and passes it as a hidden field.

**Which timezone's midnight is not answered here and is not pretended away.** Every row carries its
own `timezone`, and `20260912000400`'s rule forbids `coalesce(timezone, 'UTC')` — "a guess wearing
the costume of a fact". The same open question sits in `app.due_connections`. One founder decision
settles both.

## 7. Cost estimate

**Per connected account per month:** depends entirely on how often an owner presses the button, and
this is the first unit in the repository with a real per-call provider cost.

One brief is one OpenRouter completion at `temperature: 0` with a JSON schema. The prompt is the
figure set — a week of rows for a small shop renders to a prompt measured in low thousands of
tokens (note 59 §2 has the measured shape), and the answer is three lines plus two short fields.
**On demand, a café owner pressing it once a morning is ~30 calls a month.** It is not metered and
not entitled: `PLAN_ENTITLEMENTS` has no insight allowance, and adding one is a pricing decision
rather than an engineering one. **That is the cost line to watch when this moves to a cron**, where
the multiplier becomes connected accounts × days rather than × button presses.

R2, KV and Supabase disk are untouched — no row is written by this unit.

## 8. Platform-terms check

Gates 1–5, 7–17: `N/A` — no platform API call, no credential, no quota, no new table.

**4 (credential hygiene).** `PASS`. `OPENROUTER_API_KEY` is a **platform** secret read server-side
in the action and passed to `postInsight`; it is never prefixed `NEXT_PUBLIC_`, never returned in
any `BriefState`, and never reaches the one client component. It stays away from `CREDENTIAL_KEK`
and the vault path, which exist for per-tenant secrets under RLS.

**6 (PII path).** `PASS`, and the sharpest gate here. Rows reach a third-party model provider for
the first time. What travels is the figure set: computed numbers, dictionary metric labels and
source ids. No entity name, no account id, no workspace name, no customer identifier — the tenant is
a salted SHA-256. `provider: { data_collection: "deny", zdr: true }` is enforced in the one request
builder.

**18 (claim provenance).** `PASS`. `AVAILABLE_CAPABILITIES` is **untouched** — see §10.

**Result:** `3 PASS, 15 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Result |
|---|---|
| add `entity_name` to `BRIEF_COLUMNS` | 2 red — *never selects entity_name, which is tenant-typed free text* |
| period includes today | 4 red, including both boundary-crossing cases |
| a bad date defaults to a fixed period instead of throwing | *refuses rather than defaulting when the date is unusable* |
| give two failure states the same sentence | *says something different for every one of them* |

All reverted. Web suite **343 tests**, up from 335.

## 10. What was left out

**`surface:answer` is NOT flipped, and that is deliberate.** The claim it gates says we sell *the
answer*. This page delivers one to a signed-in owner on a deployment where the key is set — and no
key is set anywhere today, so on every existing deployment it renders `not_configured`. Flipping a
capability is a marketing claim about what the product does for customers, and it should follow the
first brief a real customer actually reads, not this PR. It is a one-line change when that happens.

**Nothing is scheduled and nothing is delivered.** No cron calls this, and there is no email, LINE
or push adapter. "Every morning" stays a claim on the marketing page with a ledger entry against it
(note 60 §6.1).

**No feedback is collected**, though the engine now takes it. `packages/insights`'s `ActionFeedback`
and priors are wired through as `NO_PRIORS`; there is no storage table and no control on this page.
That is note 66's own "left out" and needs a migration with RLS, FORCE and a retention answer.

**The brief is not stored.** Each press generates a new one; nothing keeps what was written, so
nothing can show an owner last week's brief or compare against it. Storing them is also what a
follow-up check would need.

**No rate limit and no entitlement check.** A signed-in owner can press the button repeatedly and
each press is a provider call we pay for. That is acceptable while access is password-gated and
there are no customers; it is not acceptable the day it is not, and it should land with the pricing
decision in §7 rather than as a guess now.

## 11. Open or unverified spec items this builds on

**Which timezone's midnight defines a day** — §6, and shared with the scheduler.

**The model id is named in the source**, not read from the environment, so which model wrote a
customer's brief is a fact in version control rather than a deployment setting nobody can
reconstruct. Which model and provider *actually* served it is still recorded from the response,
because OpenRouter's routing can answer the same request from a different provider run to run.

**The row cap is chosen, not measured.** 2000 rows is a guess at what one week of a small business
looks like with room to spare. It refuses rather than truncates, so being wrong is visible.
