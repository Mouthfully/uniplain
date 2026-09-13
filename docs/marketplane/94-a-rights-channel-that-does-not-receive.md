# 94. A rights channel that does not receive

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`/privacy`'s clause on a data subject's statutory rights ended with this sentence:

> **The contact address at the top of this page reaches the same people.**

`packages/brand/src/brand.ts`, in a comment beside that same address:

> **VERIFIED NOT YET DELIVERABLE** at the time of writing: the zone has one CNAME and no MX record
> … **Mail to this address bounces until that is finished.**

Both were in the repository at the same time. One of them was published to data subjects.

**A rights channel that does not receive is not a rights channel**, and the failure mode is the
worst one available: a request sent to a bouncing address and never answered is indistinguishable,
from the outside, from a company that read it and decided to ignore you. Under the PDPA the
published channel is how s.30–36 are exercised at all, and for a data subject with **no account** —
someone named in an invitation, someone on the closed waiting list — the mailbox was the only
channel published.

**The decision: the fact moves out of a comment and becomes a brand fact, and every page that
publishes the address reads it.**

### 1.1 The comment was the defect, not the mailbox

The mailbox not working is a DNS task and it is the founder's. What this repository could fix is
that **nothing connected the two statements.** A comment asserting a state is not a check on that
state — which is the same lesson `recipientsInRecord()` taught one note ago, where a doc comment
described a derivation the body did not perform.

`brand.supportMailboxDeliverable` behaves like `soc2TypeIIReport` and `iso27001Certificate`: **false
until a third party makes it true**, the third party here being the zone's MX records rather than an
auditor. `CONTACT_DELIVERY_LINE` and `RIGHTS_CHANNEL_LINE` are derived from it in `_content.ts`, so
one boolean decides what every document says.

### 1.2 The terms were worse in one specific respect

Six clauses send a customer to *"the contact address above"* — a refund, a deletion request outside
account closure, the notices clause. **Clause 15 starts a thirty-day dispute clock running from a
notice sent there.** A clock that starts on a bounce is a term a customer loses by relying on, and
it is in the contract a B2B buyer signs.

So the admission renders in the parties panel on `/terms` as well as the controller panel on
`/privacy` — **beside the address**, not in a clause further down. A reader scans a panel; putting
the qualification three screens away leaves the address itself reading as a working channel.

### 1.3 Withdrawing a channel is not answering the obligation

GDPR Art. 12(2) requires a controller to **facilitate** the exercise of rights; PDPA s.30 assumes
there is a way to ask. Deleting the sentence and stopping there would have left a data subject with
nowhere to go, which is the obligation failed by a different route.

The replacement names the routes that work: the **registered postal address**, which is a real
channel for a Thai juristic person and is already printed in the same panel, and the signed-in
**Your data** screen for a member of an account. A test asserts both appear, so a future edit cannot
withdraw the mailbox without leaving something behind.

### 1.4 The guard asserts agreement, which is why it is green today

`scripts/check-mailbox.mjs` asks Cloudflare's resolver over DNS-over-HTTPS — the same method
`AGENTS.md` documents the original verification with, and one that works where `dig` is not
installed.

| fact | zone | result |
|---|---|---|
| false | no MX | **pass** — the honest current state, and the pages admit it |
| **true** | **no MX** | **FAIL** — a channel published by flipping a boolean. The interlock `brand.test.ts` puts on the certification facts, applied to this one |
| false | **MX** | **FAIL** — the records landed and every page still apologises for a mailbox that works |

The third row is the one that earns its keep. **The five-minute DNS task becomes a red build on the
day it is done**, rather than a line in `AGENTS.md` nobody rereads — which is exactly how the
OpenRouter comment survived being falsified.

**A resolver that cannot be reached fails**, for the reason `check-advisories.mjs` gives at length:
a check that could not run must not be indistinguishable from one that ran and found nothing.

### 1.5 A stale entry in the gap list, corrected

`AGENTS.md` item 6 read *"s.30–s.36 — no data-subject rights path at all. No intake, no identity
check, no clock, no export, no rectification, no objection, no erasure"* — long after
`/data-requests` shipped with an intake and a status trail, `/account` shipped an export and an
erasure, and Art. 18 restriction was added to the enum and the form.

Recorded rather than quietly overwritten, because **a gap list that is not re-read describes a
system that no longer exists**, and the next person reading it would have built something that was
already there.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. One boolean, two derived strings, two statically-rendered paragraphs. The
guard makes one DNS-over-HTTPS request per CI run, in the job that already talks to the outside
world.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A` — no key.
&nbsp; **3. No token pass-through.** > `N/A`. &nbsp; **4. Credential hygiene.** > `PASS` — the
guard sends a domain name to a public resolver and nothing else.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `N/A`. &nbsp;
**7. No cross-workspace read.** > `N/A` — static pages. &nbsp; **8. No cross-customer
aggregation.** > `N/A`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > `PASS` — nothing moves. &nbsp; **11. Meta client list.**
> `N/A`. &nbsp; **12. Dependency licences.** > `PASS` — none added; the guard uses `fetch`.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path. &nbsp; **14. Forbidden payloads.** > `N/A`.
&nbsp; **15. Per-destination consent.** > `N/A`.

### Access tier and quota
**16. Tier reality.** > `N/A`. &nbsp; **17. No new long-lead dependency.** > `PASS` — the DNS
records are a founder task measured in minutes, not an approval queue, and nothing here waits on
them: the pages are correct either way.

### Claims
**18. Claim provenance.** > **`PASS`, and it removes a published untruth.** "The contact address at
the top of this page reaches the same people" was a statement about this company's own operation,
on a page a customer's counsel relies on, and it was false. No claim id is added; the new copy is
derived from a brand fact and cannot become false by drift, only by the fact being set wrongly —
which the guard refuses.

**Result:** `6 PASS, 12 N/A, 0 FAIL`

## 4. What was left out

- **A public intake form for a data subject with no account.** It would be an unauthenticated write
  path that creates rows holding a stranger's address — which is exactly what `join_waitlist` was,
  and it was revoked from `anon` two days ago for good reasons. It also needs an identity-check
  design, because answering "what do you hold about me" to whoever asks is its own breach. Worth
  building; not worth bolting on to a copy fix. **Issue.**
- **The MX records.** Founder task, [#83](https://github.com/Mouthfully/uniplain/issues/83). The
  guard now makes doing it fail the build until the copy follows, which is the point.
- **Rewriting the six terms clauses that say "the contact address above".** With the admission in
  the panel they read correctly in context, and rewriting six contractual clauses to route around a
  DNS record that will exist shortly is churn in a document where churn is expensive.
- **The footer imprint.** It prints the address beside the postal address already, and it is an
  imprint rather than a channel. Adding the admission there would put an apology on every page of
  the site for a condition two documents already state where it matters.
- **`legalEmail`.** Still null, still says so. A second address that does not receive would not be
  progress.

## 5. Open or unverified spec items this builds on

- **The postal address as a statutory channel is a reading, not a determination.** A registered
  address for a Thai juristic person is a real route and Art. 12(1) does not prescribe a medium. But
  whether post alone *facilitates* the exercise of rights within Art. 12(2)'s meaning — for a data
  subject in another country, against a one-month deadline — is a question for counsel, and this
  change does not answer it. It is strictly better than an address that bounces, which is the claim
  being made.
- **The guard trusts one resolver.** Cloudflare's answer is treated as the zone's state. A split
  horizon, or a resolver-side failure that returns NOERROR with no answer, would read as "no MX".
  The failure direction is safe — it keeps the admission up — but it is not a proof.
- **NXDOMAIN is treated as "no mailbox".** It is: a zone that does not resolve receives nothing.
  Worth stating because the guard's status check accepts two DNS statuses and a reader might expect
  only one.
- **`AGENTS.md` item 6 was stale for days**, and nothing in the build could have known. The gap list
  is prose about the system rather than a derivation from it, which is a limit of the document
  rather than a defect in this change.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all twelve check-*.mjs    = 0
./supabase/tests/run-local.sh = 0  --  28 suites, 754 assertions, 0 failed
```

`check-mailbox.mjs` reports: *brand.supportMailboxDeliverable is false and the zone has no MX
record. They agree.* — which is the negative, verified live rather than carried forward from a
comment.

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| `supportMailboxDeliverable: true` with no MX record | *is TRUE and the zone has NO MX RECORD… The pages stop admitting that the contact address bounces, and /privacy goes back to telling a data subject that it reaches somebody* |
| Point the guard at an unresolvable resolver | *check-mailbox: fetch failed… This is NOT a pass* |
| Delete the admission block from `/privacy` | `publishes the admission on every document that publishes the address` — *privacy publishes an address that bounces and does not say so* |
| Restore the old sentence in `RIGHTS_CHANNEL_LINE` | `never tells a data subject the mailbox reaches somebody while it does not` |

**One mutation was a no-op and is recorded as one.** The first attempt at the third row replaced the
conditional with `{false ? null : (…)}`, which still renders the block — so the suite stayed green
and proved nothing. The tell was the same as every other broken mutation in this repository:
**fewer failures than the change should cause.** Deleting the block outright is the mutation that
tests the assertion.
