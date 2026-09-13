# 98. The door with one side built

**PR:** #85 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Five items stand between this product and a lawful EU-facing sale. Four of them exist **only because
Art. 3(2)(a) is engaged**, and Art. 3(2)(a) is engaged because of three product decisions expressed
in code:

| Factor | Where it lives |
|---|---|
| a euro price is quoted | `CURRENCIES` in `apps/web/app/_billing/plans.ts` |
| the offering is addressed without territorial limit | the footer constants in `_content.ts`, rendered site-wide |
| currency choice is presented as a feature | `apps/web/app/pricing/page.tsx` |

`territorial-scope.ts` already read all three and reported them as Art. 3(2)(a) factors, correctly
and with evidence. **None of them said anybody chose.**

**The Art. 27 obligation has been described in four documents as something to obtain, and never once
as something to make inapplicable.** A door with two sides had one of them built: the work list for
getting a representative is specified Article by Article in issue #74, and the alternative — not
offering into the Union, which needs no representative, no Clauses and no counsel opinion on
Art. 3(2) — was written down nowhere.

**This does not take that decision and does not recommend it.** The founder was asked twice and
answered twice: *"keep the EU, build the GDPR work"*, then *"keep the EU, accept the gap until you
designate"*. `brand.unionOffering` is `true` and that is the answer, recorded as a decision rather
than inferred from three files. What this adds is the other side, written down, and a check that the
two sides cannot disagree.

### 1.1 The coherence check runs both ways, and the two failures have different owners

`offeringCoherence()` compares the recorded decision against the factors actually present:

| Recorded | Site | State | Why it matters |
|---|---|---|---|
| `true` | offers | **coherent** — today | the decision and its consequences agree |
| **`false`** | **offers** | `offers-undeclared` | **a live exposure nobody decided to take.** Art. 3(2)(a) engaged by a configuration under a record saying it is not, with the obligations that follow unowned |
| `true` | names markets | `declared-unoffered` | obligations carried for nothing |

The first failure is the one that matters and it is the one a "tidy-up" would produce: somebody sets
the flag false because the EU is not the market, the euro price stays on the pricing page, and the
repository now contains a written statement that the product is not offered into the Union while the
page offers it. That is a wrong answer in the most consequential place this repository has one, and
the test fails with the work list attached — every factor still present, naming the file it lives in.

### 1.2 The work list is generated, not written

`closingRequirements()` derives one item per factor that is actually present, so it cannot describe
removing something the site no longer does. A test asserts each item names a file, **and it caught
one that did not**: the currency-choice item said what the factor meant and pointed nowhere. Fixed
in the item rather than loosened in the test — a work list whose entries are not actionable is a
list somebody reads once.

### 1.3 What this does not do

It does not make the EU sale lawful. Nothing in a repository can: that needs a representative
designated **in writing**, Clauses **entered**, and counsel's view on Art. 3(2)(a). A test asserts
the gap is still open — `unrepresentedOffering()` still returns true — precisely so this unit cannot
read as having closed anything.

What it changes is that the decision is now a one-line change with the build enforcing coherence on
both sides of it, instead of a scattered edit across pricing, footer copy and three compliance
modules that nobody would be confident they had finished.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. One brand fact, two pure functions, one test file. Nothing renders that
did not render before.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A`. &nbsp;
**3. No token pass-through.** > `N/A`. &nbsp; **4. Credential hygiene.** > `N/A` — no credential in
the diff.

### Tenancy
**5. RLS.** > `N/A` — no migration. &nbsp; **6. No service-role bypass.** > `N/A`. &nbsp;
**7. No cross-workspace read.** > `N/A` — build-time constants. &nbsp; **8. No cross-customer
aggregation.** > `N/A`. &nbsp; **9. API key scope.** > `N/A`.

### Data movement
**10. No resale or redistribution.** > `N/A` — nothing moves. &nbsp; **11. Meta client list.**
> `N/A`. &nbsp; **12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A`. &nbsp; **14. Forbidden payloads.** > `N/A`. &nbsp;
**15. Per-destination consent.** > `N/A`.

### Access tier and quota
**16. Tier reality.** > `N/A`. &nbsp; **17. No new long-lead dependency.** > **`PASS`, and this gate
is the unit's subject read sideways.** Gate 17 asks whether a change depends on an approval not
held, and requires naming the gate, its timeline and the degraded path. An Art. 27 representative is
exactly such a dependency — held by nobody, on no timeline — and `closingRequirements()` is the
first time the **degraded path** has been written down anywhere.

### Claims
**18. Claim provenance.** > `PASS` — nothing renders. The `gdpr` claim stays withheld on
`brand.euRepresentative`, unchanged, and a test asserts `unrepresentedOffering()` is still true so
this cannot read as progress toward a claim it does not make.

**Result:** `3 PASS, 15 N/A, 0 FAIL`

## 4. What was left out

- **Taking the decision.** Not mine. The founder answered twice and the answer is recorded as given.
- **Rendering the decision on `/pricing`.** It already discloses the Art. 27 gap where the decision
  to buy is made, which is the disclosure a buyer needs. Adding the company's own internal
  deliberation to a pricing page would be noise for a reader and would not change what they are
  told.
- **A guard script.** The signals and the fact are all inside `apps/web` and `@repo/brand`, and a
  vitest file reaches both. A `scripts/check-*.mjs` would be a second mechanism for an invariant one
  already covers.
- **The other four founder items.** The Stripe key (#50), the MX records (#83, now build-enforced by
  `check-mailbox.mjs`), the Clauses and counsel. None is code and none is touched.

## 5. Open or unverified spec items this builds on

- **Whether removing the three factors would actually take the offering out of Art. 3(2)(a)** is a
  legal question and `closingRequirements()` does not answer it. The EDPB's guidelines treat these as
  factors in an overall assessment, not as a checklist that switches the Article off — and a
  disclaimer that a site does not serve the Union while it visibly does is worth nothing. The list
  says what would have to change; whether that is sufficient is counsel's.
- **Art. 3(2)(b) — monitoring behaviour — is not assessed at all**, by this or by
  `territorial-scope.ts`. It is a second, independent route into the GDPR, and closing the (a) route
  would not close it. Named here because a work list for (a) alone could be mistaken for a complete
  answer.
- **`brand.unionOffering` is a recorded decision and not a legal determination**, the same
  distinction `unrepresentedOffering()` draws in its own comment. Setting it changes what the
  repository is coherent with; it does not change what the law reaches.
- **The three factors are the ones this repository can read.** A campaign, a language, a
  Union-facing domain or a reseller would each be a factor too, and none is visible from here.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm -r build           = 0    all thirteen check-*.mjs  = 0
```

### Mutations, each proven and reverted

| Mutation | Observed |
|---|---|
| `unionOffering: false` with the euro price still shipping | **two** red: the coherence assertion, with the full generated work list in the failure message, **and** the assertion that the Art. 27 gap is still open |
| A work item naming no file | `a requirement that names no file` — **this one was not a mutation.** It was the real state of the third item and the test found it on its first run |

The second row is the one worth recording. The assertion that every requirement names a file looked
like a formality when it was written, and it immediately caught an item that told a reader what the
factor meant and gave them nowhere to go. Fixed in the item.
