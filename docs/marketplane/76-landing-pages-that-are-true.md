# 76. Landing pages that are true

**PR:** TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is

`/security` and three segment pages — `/for/cafe`, `/for/online-shop`, `/for/salon` — plus the NAV
and sitemap entries that make them reachable.

Both surfaces were drafted by agents, came back from adversarial review as `needs-fixes` with
**twelve false claims between them**, and were parked on a branch rather than merged. This is the
pass that makes each sentence true.

## 2. Why the drafts could not ship, and what that says about the guards

Every mechanical gate passed on the drafts. `check-copy` saw named constants, `check-tokens` saw no
colour literal, `check-brand` saw no identity string, `forbidden-claims` saw no banned assertion,
and `pnpm -r test` was green. **Not one of the twelve was visible to anything.**

They were found by reading each sentence against the code that would have to make it true. That is
not a process that scales, which is why every fix below that *could* be turned into an assertion
was.

## 3. `/security` — the six

| Said | Actually |
|---|---|
| the archive keep-list is "written for that source" | `REDACTION_POLICIES` gave **`verbatim`** to ten of twelve entries — no filtering at all — including every implemented Google and Meta source |
| the controls are "a property of the running system rather than an intention" | `putPayload` has **no call site** under `apps/api-edge/src`. Nothing has ever archived anything |
| "a request to remove data is handled by hand" | promised a manual service that did not exist. It does now, and it is not manual — see note 75 |
| "a link to an address **or an identity provider**" | `signin/google.ts` opens by recording that Google is `google: false` in the live project |
| the cross-account query returns "identifiers and times and nothing else" | six columns, two of which are neither: a provider name and a restatement window in days |
| `metaDescription`: "read access only" | `auth/adwords` is not a read-only scope, and `metadata` is not scanned by `check-copy` |

The archive control now leads with the truth — **nothing archives a platform response today** — and
describes the filter as the thing that will apply when something does. Three sources carry a
keep-list, which is the number after the Shopify connector added one (note 77); the rest return rows
about campaigns and pages rather than about people.

## 4. `/for/*` — the six

| Said | Actually |
|---|---|
| "work out what the average ticket **did**" | `ticketFigures` emits `derived.average_ticket` for the current period only — no previous, no delta |
| ad spend "in the same currency as the till and on the same calendar" | **nothing converts.** `@repo/fx` has no importer at all; a figure set that mixes currencies is *refused* |
| "a voided **or refunded** receipt reopens the day it belonged to" | a refund is a second receipt on its own day. The connector's trap 2 says so in capitals |
| "the difference is the number you actually live on" | `fees`/`net_revenue` exist only where a gateway wrote fee metadata onto the order, and this site's own WooCommerce page says most write nothing |
| "how many **people** reached the site" | `sessions` is the property's own count of sessions. One visitor makes many |
| `claim("read-only-oauth")` on the online-shop page | its only connector is `key_secret`, and `/connectors/woocommerce` advertises having **no OAuth** as a feature |

Three of these were **contradicted by the card directly beneath them**. The lead promised the tidy
version and the detail told the truth, which is the shape a reader is least likely to catch.

## 5. What became an assertion

Prose cannot be guarded, but the code it describes can be pinned:

- **`REDACTION_POLICIES` against the page's number.** Exactly three implemented sources carry a
  keep-list; the rest must be `verbatim`. A fourth gaining one, or one of the three losing it,
  fails.
- **The archive is still empty.** The test walks `apps/api-edge/src` for a `putPayload` call. The
  day something archives, the control's first sentence becomes false and this fails *first*.
- **The cross-account query's six columns**, named, against the migration.
- **The unimplemented-platform list is filtered through `IMPLEMENTED_SOURCE_IDS`.** A hand-written
  list of things that are not true goes stale in the dangerous direction: it keeps banning a word
  that has become sayable, and the fix then looks like deleting a guard.

## 6. Cost estimate

**Per connected account per month:** `N/A — no data-plane work.` Four pages and their copy.

## 7. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform call, no table, no quota, no dependency.

**18. Claim provenance.** `PASS`, and this unit is the gate. Twelve sentences that were not true of
this codebase are gone; `/security` names two standards in order to say they are **not held**, which
the ban permits and the assertion does not; `claim()` is used where a claim exists and deliberately
not where it does not hold.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 8. Mutation testing

| Mutation | Named test that went red |
|---|---|
| give Shopify's payloads `verbatim` | *matches the number of implemented sources that actually carry a keep-list* |
| call `putPayload` from the Worker | *still describes an archive that nothing writes to* |
| name Shopify on a segment page before its connector existed | *cafe names no platform this product cannot read* (this is how the seventh such test was found) |

## 9. What was left out

**No fourth segment.** Three is what the implemented connector set honestly supports.

**`/for` itself still 404s.** Three deep pages with no parent. A parent page is a decision about
whether the segment list is a navigation surface or an SEO one, and that is not a copy fix.

**The `read-only-oauth` claim is unchanged.** It carries specification citations 3.5 and 11.2 and is
true of the platforms reached through an authorisation server. `/security` now names the case where
the read-only limit is ours rather than the platform's, and the online-shop page stops rendering the
claim where its only connector has no OAuth lane — but **editing an approved claim with citations is
a brand decision, not a copy pass.**
