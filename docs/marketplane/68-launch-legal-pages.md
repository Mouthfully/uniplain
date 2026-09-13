# 68. Removing "pre-launch" from a page without removing the truth from it

**PR:** #57 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the line it had to hold

The founder is taking the product live and asked for `/terms` and `/privacy` to stop reading as a
pre-launch draft, keeping only the password gate.

**Two different things wear the same words, and only one of them should have gone.**

| What it was | What it is | What happened |
|---|---|---|
| "The service is not yet generally available" | a statement about **a date** | deleted — it stops being true tomorrow |
| "No liability cap has been agreed" | a statement about **a document** | replaced with a term the company can stand behind |
| "No retention schedule has been decided" | a statement about **the code** | **kept**, because nothing deletes on a timer |

That third row is the whole discipline of this unit. A term nobody has negotiated can be negotiated
in an afternoon. A clause describing behaviour the software does not have is a false statement
about the product, and writing one into a legal page is the same defect this repository refuses
everywhere else, in the one place where it is binding.

## 2. What the pages say now

### Five clauses closed on `/terms`, one deliberately left open

**Refunds** — paid in advance, cancel any time, the unused part of a period is not refunded, and a
charge taken in error is refunded in full. **Termination** — either side may end it, thirty days'
notice for breach, immediately where the breach cannot be put right. **Changes to these terms** —
thirty days' notice of a material reduction, continued use is acceptance, and a customer who
declines is refunded the remainder. **Limitation of liability** — no indirect or consequential
loss, capped at twelve months' fees, with the usual carve-out for what the law will not let anyone
limit. **Governing law** — the law and courts of the provider's own jurisdiction, read from
`brand.postalAddress.country`, with thirty days to resolve a dispute in writing first.

Two more clauses that were deferring to the open list — the notice period before a non-urgent
**suspension**, and before a **feature is withdrawn** — now state seven and thirty days.

**These are conventional terms, not negotiated ones, and no lawyer has seen them.** That is
recorded in the file, not only here, because the next person to read it needs to know which
sentences have been through counsel: none of them have.

**`termination` stays open, and only its second paragraph is why.** The right to terminate is
settled. What happens to the data afterwards is not — and that is not waiting on a negotiation, it
is waiting on code.

### Two clauses closed on `/privacy` from facts in the repository

**Sub-processors** was declining to publish a list until one had been "assembled and verified".
It is now four named providers with what each one processes — the database and authentication
server, the Worker runtime and payload archive, the web host, the payment processor — because all
four are readable off the code.

**OpenRouter is deliberately not in that list.** `packages/insights` can call it and nothing does:
no route, no cron, no key on any surface. Listing a processor that receives nothing is the same
defect as omitting one that does. It joins the clause in the change that gives it a caller.

**International transfers** now states the facts — Thailand to Singapore, and onward to the payment
processor and web host — and still does **not** claim a transfer instrument, because none exists.
Naming where data goes is a disclosure this repository can make truthfully; asserting that standard
contractual clauses are in place would be a claim about paperwork nobody has signed.

**Changes to this policy** closed with a thirty-day notice commitment. **Retention stays open** for
the reason in §1.

### The sentence that did not move

> No certification, audit, attestation or compliance claim is made anywhere on this page.

Word for word, in the rewritten headline note. It is still true, and it is the sentence
`FORBIDDEN_CLAIMS` exists to keep true. "Make it look legit" is not a reason to touch it.

## 3. The waiting list is gone; the password gate is not

`/waitlist` did two jobs — a sign-up form for strangers under the heading "Not open yet", and a
password box. The form, its server action and its `join_waitlist` call are deleted. The password
box is the half that still has a job.

**The route was renamed `/access`.** `/waitlist` in the address bar announced a pre-launch product
on every redirect, before a visitor had read a word. The middleware, the gate route and its test
follow it.

**It is now `robots: { index: false }`.** The old page was deliberately indexable, because it was
the one page a stranger could usefully reach. A password prompt is not: indexing it puts the door
rather than the product in front of anyone searching for the company.

**A door with no lock must not look like a locked one.** `isGated()` is false when no password is
configured, and the page now shows a contact route rather than an input that would accept anything.

### What was NOT removed, and why that is a decision

`public.waitlist` and `public.join_waitlist` are **still in the schema**. Any address already
submitted is still held. Dropping a table that may hold real sign-ups is destructive and
irreversible, and it belongs to the founder rather than to a copy change.

So `/privacy` still discloses those addresses, under a renamed row — *"Earlier sign-up form …
No longer collected"*. **A notice that stops disclosing data the company still holds is a notice
that has become wrong**, which is exactly the failure this unit exists to avoid. The row and the
table go in one change, when somebody confirms what is in it.

## 4. Cost estimate

**Per connected account per month:** `N/A — no data-plane work.` Copy, one route rename, one
deleted form and server action. No new table, no new call.

## 5. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform API call, no quota. **Gate 6 (PII path)** is a
`PASS` worth naming: the only route that collected a personal datum from an unauthenticated
stranger has been removed, and the data it collected is still disclosed.

**18. Claim provenance.** `PASS`, and this is the gate the unit was most at risk on. The instruction
was to make the pages look legitimate, and the tempting failure was to close every open clause.
Three stayed open — retention, transfers, the DPA — plus the data half of termination, each because
closing it would have asserted something untrue rather than something unnegotiated. The
certification sentence is unchanged and `AVAILABLE_CAPABILITIES` is untouched.

**Result:** `2 PASS, 16 N/A, 0 FAIL`

## 6. Mutation testing

`N/A for new guards — this unit adds none.` What it does carry is a regression the existing suite
caught: deleting `app/waitlist/` left `.next/types/validator.ts` importing a route that no longer
exists, and `typecheck` failed on it until the build regenerated the manifest. Recorded because it
looks exactly like the stale-`tsbuildinfo` trap from note 63 and has a different cause and a
different fix — that one wanted a cache deleted, this one wants a build run.

The existing guards were re-run against the new copy: `check-copy`, `check-brand` and
`forbidden-claims.test.ts` all pass on both rewritten pages, which is what stops a legal page
acquiring a compliance claim while nobody is reading it as marketing.

## 7. What was left out

**No lawyer has seen any of this.** Five clauses now bind the company where previously they said
nothing. Conventional is not the same as correct-for-this-entity, and a Thai-qualified lawyer
should read `/terms` before the first customer signs up rather than after.

**Retention is still the biggest hole on `/privacy`**, and it is a code hole, not a wording one.
`AGENTS.md` records that nothing deletes `envelope_rows`, `connections`, `invitations`, `members`
or the R2 archive. Until something does, the clause cannot close honestly.

**`public.waitlist` still holds addresses** — §3. One founder decision away from a migration.

**The DPA clause is unchanged.** `brand.dpaAvailable` is `false` and flipping it is a claim that a
document exists.
