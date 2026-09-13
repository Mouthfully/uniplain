# 66. A number that means something, and feedback that cannot carry a sentence

**PR:** #54 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the two asks behind it

The founder asked for the OpenRouter prompt to use numbers in a meaningful way, and for the engine
to learn from customer feedback. They are separate problems and they land in one unit because the
second one resolves into the first: what feedback is *allowed* to change turns out to be settled by
the same rule that governs what the prompt may contain.

## 2. The first ask: the prompt handed over figures and no sense of which mattered

`brief.ts` printed every figure with equal weight. A takings movement of 0.4% and one of 38%
arrived identically, so the model chose for itself which to lead with and what adverb to reach for.

**That choice is a judgement about magnitude, which is arithmetic, which by the one rule is not the
model's to make.** It is the same class of thing as the delta that carried a size but not a
direction (note 59): the model was being asked to supply something the data already knew.

### Materiality is computed, and handed over as a word

`salience.ts` bands each change from the percentage `buildFigureSet` already computes:

| Band | Rule | What the prompt permits |
|---|---|---|
| `large` | ≥ 15% | may be called a real change; comes first |
| `notable` | ≥ 2% | name it plainly, no strong word |
| `negligible` | < 2% | say it held steady — **never** a rise, fall, jump or drop |
| `unknown` | no comparison exists | say the comparison is not available |

**The thresholds are chosen, not derived, and the file says so.** There is no measurement behind 2%
and 15%; they are a judgement about a shop owner reading three lines over coffee. What matters more
than their values is that they are applied consistently and that the model cannot overrule them
with an adverb.

**`unknown` is not a fourth size.** It means the previous period measured zero, or the metric was
absent or unreadable, so there is no percentage to band. Collapsing it into `negligible` is the
`?? 0` mistake in a new costume: a period nobody measured, presented as a period where nothing
happened. A mutation that collapses the two turns two named tests red.

### A band is a word, and that is the whole design constraint

`verify.ts` refuses any numeral no figure licensed, so anything added to the prompt that *looks
like* a number widens the allowed set for the entire brief. `brief.ts` already learned this
expensively and records it: the fetch time was removed because `2026-09-07T23:30:00Z` would have
licensed 23, 30 and 0 on every run, after which "takings are up 23%" would sail through a gate that
allowed that number for an unrelated reason.

So **no threshold, boundary or count reaches the prompt** — only one of four words. The test that
holds this is the one worth keeping: strip every `[...]` mark out of the rendered prompt and the
numeric tokens must be unchanged.

### New rules about what a number is *for*

The prompt now says the job is to say what the figures mean, not to phrase them, and each line must
say what a figure means for the day, name what changed and against what, or say plainly that
nothing moved. It also requires the unit or currency to stay attached: a bare number in a sentence
is a number the owner has to go and look up.

### One new refusal, and a deliberately short list

`magnitude_word`. "Takings fell **sharply**" over a 2.1% move is a false statement about the data
that contains no false number, so every other check waved it through. A size asserted in prose is a
quantity the gate cannot check — the same defect as a spelled-out number, wearing an adverb.

**The list holds only words that are wrong at every band** — `sharply`, `plummeted`, `soared`,
`collapsed` and thirteen more. It does **not** ban "rose", "fell" or "up": those are directions, the
delta figure states the direction, and a guard that fired on them would fire on correct briefs
several times a morning. A guard with false positives gets switched off, which is worse than not
having one, so eight must-stay-legal sentences run beside the ten refusals.

**What it cannot do, stated because the boundary is easy to misread:** it cannot tell that a
`negligible` change was called "a fall". That needs attributing a clause to a figure, which is
language work — and language work is what this module exists to not depend on. The prompt asks for
it; this catches the unambiguous half. Reducing a failure is not preventing it.

## 3. The second ask: feedback, and the rule it collided with

`CLAUDE.md`: **nothing tenant-written reaches a model prompt.** Feedback is by definition
tenant-written. Either the rule bends or feedback takes a shape that cannot break it.

**The rule does not bend.** `data_collection: "deny"` still permits 30 to 55 day retention at some
providers (note 59), so a sentence an owner typed about their own business is a sentence that may
sit on a third party's disk for two months.

### So the vocabulary is closed, and the absence of a field is the control

`ActionFeedback` has **no free-text field**. That is not an omission for whoever adds the storage
table to fill in: a `note` column may exist in the database and must never be given a path into this
package, because a field that does not exist on the type cannot be rendered by a function that only
takes the type. The test does the only thing a runtime can — it shoves a note on through the cast a
careless caller would reach for, and checks the rendered prompt never carries it.

### "Training" — what this is, and what it deliberately is not

**No model is fine-tuned, and none should be.** Fine-tuning would mean keeping a corpus of
customers' business figures for the purpose of improving a model — the exact practice
`provider: { data_collection: "deny", zdr: true }` exists to refuse at the provider, contradicted one
layer up by us. It would also be a new PDPA s.28 cross-border transfer, for a new purpose, on data
collected for a different one.

What learns is the **engine**, per workspace, in TypeScript, from counts anyone can read back.
That is a weaker claim than "the AI learns from you" and it is the true one.

### Four verdicts, and why one of them is not like the others

| Verdict | Meaning | Effect |
|---|---|---|
| `did_it` | acted on it | clears the decline count |
| `not_doing_it` | their decision about their business | counts toward silence |
| `already_knew` | we told them something they knew | counts toward silence |
| `wrong` | **our arithmetic is broken** | **suppresses nothing, ever** |

`wrong` is a defect report about a detector, and a broken detector is broken for every workspace.
Quietly hiding a finding because one owner called it wrong destroys the only signal that it needs
fixing — and destroys it fastest in exactly the workspace observant enough to notice. So it is
counted, surfaced by `defectSignals()` for a human, and changes nothing a customer sees. An owner
who wants it gone says `not_doing_it`, which is a choice rather than a bug report.

### Feedback may remove an action. It may not re-rank one.

*"Ordered by value, biggest first"* is a promise about the **data**. An owner's opinion is not worth
more money than the arithmetic says, so priors filter **before ranks are assigned** rather than
re-sorting after. The survivors stay in value order, the promise holds, and the ranks the model sees
are 1, 2, 3 with no hole to explain — no impact label reads "what action 3 is worth" beside a list of
two.

### `priors` is required on `FigureInput`, and the churn is the point

Making it optional would have saved about fifteen lines across the tests and bought a failure mode
this repository is organised against: a caller that forgets it gets a full action list and no error
— the product silently ignoring what a customer told it. **Ignoring feedback must not be reachable
by omission.** `NO_PRIORS` is how a caller says "nothing has been said", which for a new workspace
is a fact rather than a stand-in for one.

## 4. Cost estimate

**Per connected account per month:** `N/A — no data-plane work in this unit`, and one note for when
there is. The prompt grew by roughly 20 lines of fixed instruction and one short mark per change
figure; at `temperature: 0` that is input tokens on a call nothing yet makes. Feedback adds no
platform call and no row — the storage table is a separate unit (§7).

## 5. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform API call, no quota, no new table. **Gate 6 (PII
path)** deserves a sentence rather than an `N/A`: this unit creates the first structure that would
carry a customer's opinion, and it is built so that structure cannot carry prose.

**18. Claim provenance.** `PASS`. No user-visible claim changes and `AVAILABLE_CAPABILITIES` is
untouched. The unit **narrows** what may be said: one new refusal code, and a `negligible` change
may no longer be described as a movement at all.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 6. Mutation testing

Every mutation run by exit code, each reverted.

| Mutation | Result |
|---|---|
| `wrong` also counts toward silence | 3 red, incl. *never falls silent on `wrong`* and the end-to-end case |
| `did_it` no longer clears declines | *clears the path to silence when the owner comes back and acts* |
| `unknown` collapses to `negligible` | 2 red — *bands a metric with no comparable previous period as unknown* |
| a band word carrying a digit (`"large over 15pc"`) | 4 red, including **adds no numeral to the prompt** — the `fetched_at` lesson caught mechanically |
| the `magnitude_word` refusal deleted | 10 red, one per overstatement |
| the ban widened to `"fell"` | *does NOT refuse "Takings fell against last week."* — the false-positive half |

Suite green at **146 tests**, up from 105.

## 7. What was left out

**There is no storage and no surface, so no customer can give feedback yet.** This unit is the
contract and the arithmetic. The table needs `workspace_id`, RLS with **FORCE** (note 63), a grant
for the writing role, and a retention answer — feedback is personal data about a named user's
actions, and `AGENTS.md` records that nothing in this schema deletes anything yet. That is a unit
with a migration in it and it should not ride along here.

**Nothing calls the engine at all**, which is the gap [#49](https://github.com/Mouthfully/uniplain/issues/49)'s
criterion 6 turns on and is unchanged by this PR. Better prompts do not deliver a brief.

**The band boundaries are not per-business.** A 3% move means something different to a guesthouse
with forty bookings a month than to a café with four hundred covers a day, and one pair of
thresholds serves both. Doing it properly needs a dispersion measure over a workspace's own history
— real work, and it should follow evidence that the flat version is wrong rather than precede it.

**`SILENCE_AFTER = 3` is chosen, not measured**, and it is the only number in `feedback.ts` that is.

**The adverb rule is enforced only at its unambiguous edge**, as §2 says. A `negligible` change
described as "a fall" still passes.
