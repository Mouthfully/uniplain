# 85. The decision the pricing table took

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

`AGENTS.md` §2 opened with this, and had since it was written:

> "Applicability is genuinely open and nobody has decided it. … That turns on whether the business
> sells into the EU."

**The business sells into the EU.** `/pricing` quotes **euro** prices to any visitor
(`CURRENCIES = ["usd", "eur", "thb"]`, `starter: { usd: 19, eur: 18, thb: 690 }`); the pricing hero
reads *"Priced in your currency."*; the copy says tax is added at checkout according to where the
buyer is; and the footer of **every page** says the product is built for businesses everywhere.

Nobody decided that as a legal position. A pricing table decided it, and the conclusion was never
carried back to the paragraph that said the question was open — which is exactly why nobody went
looking for the answer. **An open question is the one kind of statement that never gets audited.**

This unit does not answer it either, because that is a legal conclusion and this repository refuses
to invent those. It does something narrower and harder to argue with: `territorial-scope.ts` reads
the configuration, scores it against the factors the **EDPB names in Guidelines 3/2018** for
Art. 3(2)(a), and reports each with the file it was read from. Counsel reaches the conclusion; this
makes sure they reach it holding the facts rather than the intention.

### 1.1 Why this outranks everything else on the list

The compliance gap list — DPA, transfer instrument, retention schedule, DPO determination, MX
record — is a list of **missing documents**. Things not yet done. Each has an obvious remedy and
none of them is getting worse while it waits.

**This is live conduct.** If Art. 3(2)(a) is engaged, the obligations attached the day the first
euro price rendered. Art. 27 requires a representative in the Union *designated in writing*, and
every PDPA gap in §1 reappears with a different article number and a larger ceiling. The clock has
been running; it was not waiting for a decision.

**And an obligation is not a claim.** This is the distinction the repository was one step away from
getting wrong. `FORBIDDEN_CLAIMS` bans "GDPR compliant" on every route, and the `gdpr` and `dpa`
claims stay withheld on `euRepresentative`. All of that is correct, all of it is working, and none
of it stops the GDPR applying. Reading *"the claim is withheld"* as *"we are out of scope"* is the
specific mistake §2 now exists to prevent — and it was an easy one to make, because the claim gate
is so thorough that its silence looks like coverage.

### 1.2 Why this is a test that records a gap rather than a guard that fails

The obvious build is a guard that goes red while the entity offers euro prices with no Art. 27
representative. It would be red today. **The two ways to make it green are to appoint a
representative — which no test can do — or to delete the euro price.**

That second one is a commercial decision belonging to the founder, and a failing build is a terrible
way to ask for one: the cheapest path to green would be removing a currency the business may depend
on, taken by whoever was unlucky enough to be mid-PR and wanted their unrelated change to land. A
guard whose easiest resolution is the wrong one does not enforce a rule, it selects for the wrong
answer under time pressure.

So the assertions **record the current state explicitly, in both directions**, and go red the moment
anyone moves a fact without carrying the change through:

- Remove the euro price and the territory-free copy → `finds the entity offering into the Union`
  goes red, because the assessment's conclusion has changed and must be rewritten.
- Designate a representative → `records that no representative is designated` goes red, so whoever
  flips `euRepresentative` has to come here and to `AGENTS.md`.

Both proven below. It is the same mechanism `brand.test.ts` uses for a certificate: **a compliance
position cannot be established, or abandoned, by a one-character edit.**

### 1.3 The fourth negation

`expect(agents).not.toContain("Applicability is genuinely open and nobody has decided it")` fired on
the corrected `AGENTS.md` — because the correction **quotes the sentence it corrects**, which it has
to, or the next reader cannot tell what changed.

Fourth instance in this repository of one pattern: `dpa.test.tsx` caught a denial, `74` named it,
`83` hit it in a failure message. Quoted spans are now stripped before the ban. **What is banned is
the assertion, never the mention** — which is the same rule `CLAUDE.md` already states for the
compliance acronyms themselves.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. One module read at build time by a test, one documentation section, no
route, no query, no table, no upstream call. Nothing renders it to a visitor.

**The cost this surfaces is not a COGS line and belongs here anyway.** If counsel finds Art. 3(2)(a)
engaged, an Art. 27 representative is a recurring third-party fee and the GDPR programme is
engineering work not currently scoped. If the founder narrows the offering instead, the cost is the
EU revenue line. Either number is larger than anything in section 7's table, and neither can be
estimated here.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call in the diff.

**2. Vendor-key exception.** > `N/A` — no company-held key.

**3. No token pass-through.** > `N/A` — no MCP or OAuth surface.

**4. Credential hygiene.** > `N/A` — no credential in the diff.

### Tenancy

**5. RLS.** > `N/A` — no schema change, no table.

**6. No service-role bypass.** > `N/A` — no request path.

**7. No cross-workspace read.** > `PASS` — the module reads build-time constants and `@repo/brand`.
It touches no tenant row and has no query to span a workspace.

**8. No cross-customer aggregation.** > `N/A` — nothing aggregated.

**9. API key scope.** > `N/A` — untouched.

### Data movement

**10. No resale or redistribution.** > `N/A` — no data moves.

**11. Meta client list.** > `N/A` — untouched.

**12. Dependency licences.** > `PASS` — none added.

### PII and consent

**13. Hash at the edge.** > `N/A` — nothing persists.

**14. Forbidden payloads.** > `N/A` — no egress.

**15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota

**16. Tier reality.** > `N/A` — no upstream request.

**17. No new long-lead dependency.** > **`N/A`, and the gate is worth reading against its own
wording.** This adds none. What it *records* is that the business may already depend on one it has
not obtained — an Art. 27 representative — which is the inverse of what this gate usually catches
and is precisely why it is written down rather than left as a note.

### Claims

**18. Claim provenance.** > `PASS` — no new user-visible claim; nothing here renders to a visitor.
The `gdpr` and `dpa` claims remain withheld on `euRepresentative` and this unit does not touch that
gate. It records, in the file where compliance positions live, that **withholding a claim is not the
same as being out of scope** — which strengthens gate 18 rather than testing against it.

**Result:** `5 PASS, 13 N/A, 0 FAIL`

## 4. What was left out

- **Removing the euro price, or the "everywhere" copy.** The single most consequential thing in
  reach, and **deliberately not done.** It is a commercial decision about which markets the business
  serves, the founder's alone, and taking it inside a compliance PR would be the worst kind of scope
  creep: irreversible-feeling, easy to justify, and wrong if the EU is a market they want.
- **Appointing a representative, or drafting one's terms.** Not something code can do.
- **A published page.** `/processing` and `/sub-processors` are published because a customer needs
  them. This is an internal assessment whose conclusion is not yet taken; publishing "we target the
  EU and have no representative" before the founder decides which way to resolve it would be
  choosing for them, in public.
- **The same assessment for Art. 3(2)(b)** (monitoring behaviour of data subjects in the Union).
  Not written, because the product reads a *business's own platform metrics* rather than tracking
  individuals, and a factor list built to reach a conclusion I had already assumed would be worth
  less than nothing. It needs its own look with the record of processing in hand.
- **The PDPA s.41 DPO determination.** The other genuinely open determination, and it is *not*
  settled by anything found here. Left for its own unit: s.41 turns on whether a core activity
  requires regular systematic monitoring of personal data on a large scale, or processes s.26
  sensitive data — questions the record of processing can inform but which turn on scale, and scale
  today is zero customers. **Issue, not scope creep.**

## 5. Open or unverified spec items this builds on

- **EDPB Guidelines 3/2018 on the territorial scope of the GDPR** are the source for the factor
  list, and the currency factor in particular. They are guidance rather than statute, and a court
  weighs the factors as a whole rather than counting them — **so a finding of three-out-of-three is
  not a legal conclusion and this module does not present it as one.**
- **Whether Art. 3(2)(a) is in fact engaged is not decided here and must not be read as decided.**
  The module is deliberately named for the configuration rather than the conclusion:
  `unrepresentedOffering()`, not `isGdprApplicable()`.
- **If the answer comes back "not engaged"** — the factors judged insufficient, or the EU business
  found to be de minimis — this change survives intact and gains value: the finding gets recorded
  *with this evidence*, and `territorial-scope.test.ts` reopens it automatically if the
  configuration later moves. That is the outcome this is most useful in, not the one it is least
  useful in.
- **The euro price has been live for the whole of this repository's history.** This note does not
  establish when the first euro price rendered publicly, or whether any EU customer has ever
  transacted. Both matter to the size of the exposure and neither is knowable from here.

## 6. Verification

Run by exit code, never by reading output.

```
pnpm exec biome lint .          = 0
pnpm exec biome format .        = 0
pnpm -r typecheck               = 0
pnpm -r test                    = 0
pnpm -r build                   = 0     (both apps)

check-brand=0       check-capabilities=0   check-claim-sources=0   check-copy=0
check-dictionary=0  check-erasure=0        check-providers=0       check-registry=0
check-tokens=0
```

No migration, so the SQL suite is unaffected; it was green on the commit two before this one — 23
suites, 702 assertions, 0 failed.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| `CURRENCIES = ["usd", "thb"]` — drop the euro price | `finds the entity offering into the Union` — *expected [ 'universal-offer', …(1) ] to include 'member-state-currency'* |
| `euRepresentative: "Some Rep BV, Amsterdam"` — designate one | `records that no representative is designated` (*expected 'Some Rep BV, Amsterdam' to be null*) and `does not claim GDPR compliance…` |

Both directions matter, and that is the point of the pair. The assessment is not a paragraph that
happens to be stored in a `.ts` file: **it reacts to the configuration in both directions**, so
narrowing the offering and designating a representative each force the position to be rewritten
rather than allowing it to drift out of date the way the sentence it replaces did.
