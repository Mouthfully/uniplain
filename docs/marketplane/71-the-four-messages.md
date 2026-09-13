# 71. Four messages, and the number a template must not add

**PR:** #61 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

Templates for the lifecycle the founder named — sign-up, how to use, and a report on a weekly or
monthly span — plus a fourth the list did not name and the product needs more than any of them.

| Template | What it says |
|---|---|
| `welcomeEmail` | the account exists; two steps get you to a first brief |
| `howToUseEmail` | connect, wait a night, choose the trade, read it |
| `briefEmail` | the brief itself, over a week or a month |
| `refusalEmail` | **no brief was written, and why** |

They are plain text, because `packages/email` is plain text: HTML would add a rendering surface, a
second copy of every string that could drift from the first, and the remote-image path that most
mail tracking uses — which `/privacy` says this product does not do.

## 2. The rule that shaped every line: a template may not add a number

`verify.ts` refuses a whole insight over one numeral it cannot trace. **A template that then
wrapped the verified text in numbers of its own — "3 actions this week", "up 12%" — would
reintroduce exactly that fabrication one layer further out, past every existing check, on the copy
a customer actually reads.**

That is not hypothetical. A subject line summarising the result is the natural thing to write, and
it is a claim made by code that never saw the figures.

So the only digits any template emits are ones handed to it: the period's own dates, the figures'
own text, and the step numbers in the fixed copy. The test renders a brief and checks **every**
numeric token in subject and body against the content it was given. Adding
`${content.summary.length} lines` to the intro turns it red.

The subject carries the span and the dates and nothing else, and a separate test asserts it holds
no direction word — no *up*, *down*, *rose*, *fell*.

## 3. The fourth template, which the list did not ask for

**`refusalEmail` exists rather than the message simply not being sent.** An owner expecting
something and receiving silence learns the product is unreliable. An owner told that a figure could
not be traced back to their own rows learns that it refuses to guess — which is the only reason to
trust the briefs that do arrive.

It attaches no figures, estimates nothing to fill the gap, says in the **subject** that there is no
brief so it is clear before opening, and passes the engine's own refusal code and detail through
unedited.

## 4. No cadence, because there is no cadence

Nothing schedules a brief. No cron calls the engine, and until the domain's DNS exists nothing can
be delivered at all (note 70).

So the welcome message does **not** say a brief arrives every morning. It says what actually
happens: *"Briefs are written when you ask for one. Nothing is sent on a schedule at the moment,
and this message will say so differently when that changes."*

A test asserts no template matches `every (morning|day|week|month)`, `each morning`, `we'll send`,
`will arrive` or `delivered each`. The copy changes in the same commit as the scheduler, not before.

**`BriefSpan` is `week` or `month` and names the span the FIGURES cover, not when the message
arrives.** That distinction is why the type is not called `frequency`.

## 5. The blind spot this closes

`forbidden-claims.test.ts` scans routes under `apps/web/app`. **An email never passes through a
React page**, so a banned claim written into a template would reach a customer with no existing
guard seeing it — the same shape as the gap note 65 found when a phrase's only detector lived in
the claim text it was being removed from.

So this package runs `FORBIDDEN_CLAIMS` over every rendered message, subject and body. Putting
*"We are SOC 2 compliant"* into the sign-off turns it red.

## 6. The input shape is defined here, not imported from the engine

`BriefContent` is the narrowest thing a message needs, and the caller maps a `GenerateResult` onto
it. A plain-text renderer has no business depending on the arithmetic: this keeps the mail package
installable in the Worker without pulling the engine in behind it, and keeps the file honest about
what it actually consumes.

## 7. Cost estimate

**Per connected account per month:** `N/A — nothing is sent.` Four pure functions returning
strings. The send cost is note 70's and is still behind the DNS.

## 8. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform call, no table, no quota. Nothing here sends.

**18. Claim provenance.** `PASS`, and the gate this unit was most exposed on. Customer-facing copy
that no existing guard could see is exactly where a claim slips through. Three tests hold it: the
ban list over every message, the no-schedule check, and the numeric-token check that stops a
template inventing a figure the verifier never saw.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Result |
|---|---|
| add `${content.summary.length} lines, 1 action` to the intro | *emits no number that did not come from the content it was given* |
| welcome says "A brief arrives every morning" | *promises no schedule, because there is none* |
| subject becomes "takings up, 2026-09-06 to …" | *keeps the subject to the span and the dates* |
| `"We are SOC 2 compliant"` in the sign-off | *matches no forbidden claim, in subject or body* |

All reverted. Email suite **23 tests**, up from 10.

**And one the suite caught on me:** my first version of the restatement-marker test matched the
line containing `"Takings"`, which found the model's summary sentence *"Takings held steady."*
before the provenance line. The marker belongs to the **figure**, not to prose about it, so the
test is anchored to the provenance line's own prefix. A test that passes by reading the wrong line
is worth less than no test.

## 10. What was left out

**Nothing sends any of these.** No caller, by the same argument as note 70: until SPF and DKIM
exist, a send returns success for mail nobody receives.

**No monthly REPORT, and the distinction matters.** `briefEmail` over a `month` span is the engine's
brief across thirty days — the same three lines and one action, wider. It is **not** the monthly
investor update, the P&L or the accountant export from `Reports.tsx`: none of those exists, two of
them are not expressible in the current dictionary at all (note 65), and nothing here implies
otherwise.

**No localisation.** Note 65 removed "in Thai or English" from the site because nothing in this
repository is localised to Thai, and these templates are English for the same reason.

**No unsubscribe link and no preference centre.** The moment any of these is sent on a schedule
rather than on request, one is needed — and it needs somewhere to store the preference.

**No invitation template**, because there is still no invitation flow: `invitations` has a table
and no code that creates a row.
