# 74. The cadence nobody keeps

**PR:** TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

The site promised a brief every morning, in six places. Nothing sends anything and nothing runs on
a clock. This removes the promise and adds the guard that stops it coming back.

| Where | What it said |
|---|---|
| `_content.ts` | `heroLine2: "Every morning."` — **the headline** |
| `DashboardFeature.tsx` | "One page, every morning" · "once a day" · "Know what changed overnight" |
| `FeatureGrid.tsx` | "What arrives, and when" · "Yesterday in three lines **at breakfast**, a ranked list **on Monday** … the report your accountant wants **on the first**" |
| `UseCases.tsx` | "The same brief **every morning**" |
| `FaqCta.tsx` | "What does it **send me each morning**?" · "**Connect tonight. Decide at breakfast.**" |
| `brief/_content.ts` | "**Morning brief**" · "**Yesterday**, in three lines." — over a **seven-day** period |

## 2. Why every one of them is false

`generateBrief` in `apps/web/app/brief/actions.ts` is a form action with **no other caller in the
repository**. No cron writes a brief — the only scheduled work ingests rows. And `packages/email`
has no caller at all, because note 70 verified the domain holds neither an MX nor a TXT record.

A customer who connected a source and waited for breakfast would get nothing, **twice over**: no
brief is written, and there is no channel to write it to.

The sweep that *does* run is `INGEST_CRON = "23 2 * * *"`, which Cloudflare evaluates in UTC —
**09:23 in Asia/Bangkok**. So even the rows are not in by breakfast, for the customer this product
is built for.

## 3. The one that is not marketing

`/brief` told a signed-in customer they were looking at **yesterday**. `BRIEF_PERIOD` is
**seven days against the seven before them**, and has been since the route landed.

Nobody typed a wrong figure. The arithmetic was right and checked twice, and `verify.ts` would have
refused the brief over a single untraceable numeral. **The heading was the assertion nothing
checked** — a wrong number that looks right, arriving through the one part of the page no guard
could see. That is this repository's founding rule, failing in the place it never thought to look.

`_content.test.ts` now derives the expected word from `BRIEF_DAYS`, so changing the window without
changing the heading turns five assertions red.

## 4. How it survived

Each of these sentences was **written by someone describing the product they intended**, and every
one of them was reviewed. The homepage's own test even listed `"Connect tonight. Decide at
breakfast"` as a required landmark — the copy was pinned in place by an assertion that it be
there.

No guard in this repository could see it. `check-copy` saw a named constant. `check-brand` saw no
identity string. `forbidden-claims` saw no banned assertion. Every one of them passed, on every
one of these sentences, for as long as they have existed.

**A claim about behaviour is invisible to a guard that only reads words.**

## 5. The guard, and the two ways it nearly failed

`apps/web/app/cadence.test.ts` scans every route source for a promise that something happens at a
recurring time of day, near a word for the thing that would arrive.

It went wrong twice before it worked, and both are worth recording because both are general:

**It fired on the denials.** "Nothing is sent to you", "Nothing is sent for you" — the honest
sentences. Banning a form of words also bans saying you do not do it, which is note 65's finding
in a new place. A match now counts only when nothing negates it in the clause before. That is a
heuristic and it is written down as one.

**It was too broad to survive.** The first pattern returned twenty findings, nineteen of them
noise: `lands:` is a **field name** in the Meta Ads reference table, "the connection dies quietly
overnight" is a true statement about a token, "Connections are read once a day" is true —
`INGEST_CRON` *is* daily. A guard with that ratio gets disabled, not fixed. It is narrowed to the
phrase class the six real findings shared, and it now reports exactly the real ones.

The FAQ's own pre-existing cadence guard had the opposite disease: it was written as
`/we.?ll send|will arrive|delivered (each|every)/` with a comment excusing "every morning" because
*"the page's positioning is that a brief covers each morning, and the hero says so"* — assuming the
conclusion, while the question three lines above it read "What does it **send me each morning**?".
**A guard that passes the page's own worst sentence is worse than no guard**: it makes an
unexamined claim look examined.

## 6. What the copy says now

The hero keeps the promise that is actually kept — one page, in a minute, against the afternoon an
owner spends in four tabs — and says nothing about when. `heroLine2` is `"In one minute."`

The day a cron writes briefs and a channel delivers them, these lines change **in that commit**,
which is the rule `packages/email/src/templates.ts` already holds itself to.

## 7. Cost estimate

**Per connected account per month:** `N/A — no data-plane work.` Copy and two static scans.

## 8. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform call, no table, no quota, no dependency.

**18. Claim provenance.** `PASS`, and this unit is entirely that gate. Six claims about product
behaviour were being published with nothing able to see them; all six are gone and a guard now
refuses the class on every route.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Named test that went red |
|---|---|
| restore `heroLine2: "Every morning."` | *makes no unnegated promise… — reports `_content.ts:210`* |
| restore `"What does X send me each morning?"` | *makes no unnegated promise…* and *says outright… that nothing is sent* |
| restore `"Connect tonight. Decide at breakfast."` | *makes no unnegated promise…* |
| delete the honest denial from the brief answer | *says outright, in the answer about asking for a brief, that nothing is sent* |
| restore `heading: "Yesterday, in three lines."` | *does not say yesterday* and *names the number of days the period actually spans* |
| change `BRIEF_DAYS` to 14 under the heading | five red, including the same two |

**Two of these failed the first time I ran them**, and that is the entry worth keeping: my
replacement cadence pattern passed *"Connect tonight. Decide at breakfast."* — because "at
breakfast" is not "by breakfast" — and my denial test passed its own deletion, because it matched
`/nothing is sent/` anywhere on the page and the **invitation** answer also says it. Two true
sentences, and the test could not tell which one it was guarding. The denial is now pinned to the
answer that needs it, via `QUESTIONS` exported for the purpose.

`apps/web` **530 tests**, up from 376.

## 10. What was left out

**Nothing builds the cadence.** A cron that writes a brief and a channel that delivers it are the
unit this makes honest, not the unit it replaces. The copy changes back in that commit.

**`IntegrationsMap.tsx` still carries "200+ integrations"**, reported in `_content.ts` as outside
an earlier change's paths and still outside this one's.

**Three near-miss sentences were left alone** and are listed here so the next reader does not think
they were missed: "Connections are read once a day" on `/connectors/shopify` (true — `INGEST_CRON`
is daily), "the connection dies quietly overnight" on `/connectors/ga4` (a token expiry, not a
delivery), and "the decisions you make every day" (the reader's life, not ours).
