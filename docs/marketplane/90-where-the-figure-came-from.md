# 90. Where the figure came from

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Each action on the home page's sample card states an impact and a one-line provenance note — *"From
your own prices and last month's volume"*. The request was to show **which connector** a figure came
from, with the mark.

Each action now carries `sources`, and the card renders a chip per source: the artwork where it
ships, the label beside it, both drawn from `@repo/brand`.

**The decision that makes this safe: a source is an id, never a typed name.**
`docs/marketplane/58-plan-reconciliation.md` §5.1 is almost entirely about this surface. Its rule is
that FoodStory, Ocha, StoreHub, GrabFood, foodpanda, LINE MAN, Booking.com, K PLUS, SCB, Shopee,
Lazada and TikTok Shop must not appear as sources *"in any form — logo, chip, 'planned' row or FAQ
sentence"* while they do not exist.

**A chip with a logo on it is exactly the form that rule names**, so the defence cannot be that this
row is different in kind. It is that `sources` is typed `ImplementedSourceId`, and
`IMPLEMENTED_SOURCE_IDS` is what `check-capabilities.mjs` already holds against the source tree. An
unbuilt connector cannot be written here — and because a type stops being a guard the moment
somebody writes a cast, `source-marks.test.tsx` proves the set at runtime too. Mutation-proven with
`"grabfood" as ImplementedSourceId`, which compiles and fails the test.

`SOURCE_LABELS` was private to `claims.ts` and is now exported rather than retyped. A second copy of
those names is a second thing to keep in step, and the specific failure is not cosmetic: the guard
compares *ids* against the source tree and has nothing to say about strings written somewhere else.

### 1.1 Three of seven connectors ship no artwork, and that is rendered rather than papered over

`public/platforms` has files for Google Ads, Meta, Google Analytics and Shopify. **Loyverse, Search
Console and WooCommerce have none.**

A placeholder mark for those three would be artwork this repository invented for someone else's
trademark, so `sourceMark` returns `slug: null` and the chip renders as a label with no mark. A
`src` built from a guessed slug would 404 — a broken image directly underneath a sentence asking the
reader to trust where a number came from, which is the worst place on the page to put one.

The consequence is visible and worth stating plainly: **the first card in the screenshot shows two
text chips and no logos**, because it rests on Loyverse and WooCommerce. The second card shows two
marks. Getting logos onto the other three needs the real brand assets, which is a founder-or-designer
task rather than something to fabricate — see §4.

### 1.2 The sources are chosen to make the weakest card visible

The third action cites one source. That is not padding avoided, it is the point of showing sources at
all: the action whose provenance is thinnest — a single till — is now visibly the one resting on a
single till, next to a figure already marked as a range because *"last week's orders may still be
restated"*. Two claims about the same uncertainty, one of which a reader can check at a glance.

### 1.3 What this change makes worse elsewhere

The same `/platforms/*.svg` artwork now appears in two places on the home page meaning two different
things: `IntegrationsStrip` under the hero means *"tools you already run on"*, and this row means
*"we read this"*.

`IntegrationsStrip` lists thirteen marks, of which **four are implemented sources**. The other nine —
TikTok, HubSpot, Stripe, YouTube, Google Sheets, LINE, Shopee, Looker, BigQuery — are not connectors
this product has. **Two of them, LINE and Shopee, are named in §5.1's must-stop list by name.** The
file's own comment says *"a visitor reads it as the set we read"* and *"Additions belong here when
the connector exists, not before"*, immediately above a list that contradicts both sentences.

**Not fixed here.** It is a separate surface with its own argument to settle — whether that strip is
a source list or a "your tools" list — and CLAUDE.md's rule is to open an issue rather than widen a
PR. Raised as one, and flagged in §5 because this change sharpens the ambiguity rather than creating
it.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. A statically-exported marketing section gains one `<ul>` per card and, at
most, two 12×12 SVGs already served from `public/platforms` and already downloaded by
`IntegrationsStrip` on the same page. No query, no upstream call, no scheduler work, nothing added
to the ingest path.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A` — no
company-held key. &nbsp; **3. No token pass-through.** > `N/A` — no MCP or OAuth surface.
&nbsp; **4. Credential hygiene.** > `N/A` — no credential in the diff.

### Tenancy
**5. RLS.** > `N/A` — no migration or table. &nbsp; **6. No service-role bypass.** > `N/A` — static
section, no request path. &nbsp; **7. No cross-workspace read.** > `PASS` — build-time constants;
the figures are samples and no tenant row is read. &nbsp; **8. No cross-customer aggregation.**
> `PASS` — nothing aggregated. &nbsp; **9. API key scope.** > `N/A` — untouched.

### Data movement
**10. No resale or redistribution.** > `PASS` — nothing moves; the row *names* where a sample figure
would have come from. &nbsp; **11. Meta client list.** > `N/A` — no Meta onboarding, workspace
lifecycle or deletion path is touched. Meta's **mark** appears, which is disclosure of a connector,
not a client record. &nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path, nothing persists.
&nbsp; **14. Forbidden payloads.** > `N/A` — no egress. &nbsp; **15. Per-destination consent.**
> `N/A` — no consent object.

### Access tier and quota
**16. Tier reality.** > `N/A` — no upstream request.
**17. No new long-lead dependency.** > `PASS` — every source shown is already implemented and
already claimed. This adds no dependency on an approval not held; that is precisely what typing the
field as `ImplementedSourceId` enforces.

### Claims
**18. Claim provenance.** > **`PASS`, and this gate is the whole unit.** A source chip is a claim
that this product reads that platform. It is drawn from `IMPLEMENTED_SOURCE_IDS` — the same list the
`connectors` claim is built from — so it cannot name a platform the claim gate would withhold, and
the test asserts the set rather than trusting the type. The card keeps its **"Sample figures"** label,
which matters *more* after this change than before: real connector names beside invented figures make
the sample more convincing, and a test asserts the label survives.

**Result:** `9 PASS, 9 N/A, 0 FAIL`

## 4. What was left out

- **Artwork for Loyverse, Search Console and WooCommerce.** Needs the trademark holders' actual brand
  files. Drawing an approximation would be inventing someone else's mark, and a wrong logo is a
  trademark problem rather than a design one. **Issue, not scope creep.**
- **Fixing `IntegrationsStrip`.** Argued in §1.3. Separate surface, separate decision, own issue.
- **Provenance on the real brief at `/brief`.** This unit changes the marketing sample only. The
  signed-in brief has genuine per-figure sources available — `packages/insights` carries source ids
  through to the prompt — and showing them there is more valuable than showing them here. It is also
  a different component with a real data path behind it, so it is its own unit.
- **A per-figure source, rather than per-action.** An action's impact may combine metrics from two
  connectors, and attributing each number to one of them needs `figures.ts` to carry provenance per
  value. Worth doing on the real brief; not worth inventing on a sample.

## 5. Open or unverified spec items this builds on

- **§5.1's rule is about connectors that do not exist**, and this row shows only ones that do. That
  reading is stated here so it can be disagreed with: someone could hold that the section bans any
  platform mark near a figure. If that is the intent, this row should show labels with no artwork at
  all — one constant, `SOURCE_ARTWORK`, emptied.
- **`IntegrationsStrip` contradicts its own comment**, listing nine unimplemented platforms including
  two §5.1 names by name. Recorded rather than fixed, and raised as an issue. **This change does not
  cause it and does make it more visible**, because the same artwork now carries two meanings on one
  page.
- **The sources on each sample action are illustrative**, like the figures they sit beside. They are
  plausible and consistent rather than measured, and the card says "Sample figures" three times over.
  What is *not* illustrative is the set they are drawn from: every one is a connector this product
  actually reads.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all nine check-*.mjs      = 0
```

No migration; the SQL suite is unaffected.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| `sources: ["grabfood" as ImplementedSourceId]` — an unbuilt, §5.1-named platform pushed past the type with a cast | `names no source that is not implemented` — *shift cites "grabfood", which is not an implemented source* |
| Claim artwork for WooCommerce, which ships no file | `ships a file for every slug the map claims` — */platforms/woocommerce.svg does not exist* |
| Return `"Meta"` instead of `SOURCE_LABELS.meta_ads` | `renders the label from the brand map rather than a retyped name` — *expected 'Meta' to be 'Meta Ads'* |

The first is the one that matters. It **compiles** — the type is bypassed exactly the way a hurried
change would bypass it — and the guard catches it anyway. A type that stops being enforced the moment
someone writes `as` is not a control over what this page claims; the runtime assertion is.
