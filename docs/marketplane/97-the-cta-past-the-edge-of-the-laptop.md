# 97. The call to action past the edge of the laptop

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

The brief was to raise the landing pages to the standard of the references the founder named. Two
things came out of it, and the second one was not on the list.

**A motion system.** Scroll reveals with a stagger, a lift under the pointer, the hero's trend line
drawing itself, and the hero wash breathing — all of it CSS, none of it JavaScript.

**A defect the motion work found by accident.** Measuring the page in a real browser to check the
reveals, the header turned out to be overflowing at every laptop width. `scripts/header-fit.mjs`,
against a production build, with the stylesheet confirmed applied:

| Width | Page scrolls sideways | Header overflows its own box | Links off-screen |
|---|---|---|---|
| 1024px | **231px** | 231px | **2** — "Sign in" *and* the primary CTA |
| 1152px | 103px | 103px | **1** — the primary CTA |
| 1280px | 15px | 55px | **1** — the primary CTA |
| 1366–1920px | 0 | 55px | 0 |

**The primary call to action on the marketing site was past the right edge of a 13-inch laptop.**

**The decision: fix the fit, and do not fix the nav.** The row moves to `xl:` and the gaps tighten
(48px→24px between the header's groups, 28px→20px between links). Every width now reports 0/0/0.

It is worth being exact about what caused this, because nobody was careless. The header comment
already records the *first* time it happened — the row was at `md:`, did not fit at 768, and moved
to `lg:`. Then `NAV` grew from six entries to ten, one at a time, each addition individually right
and separately argued in `_content.ts` ("a page nothing links to is a page nobody uses"). None of
them was measured against the width of the bar, because **there was no harness above 768px.**
`mobile-audit.mjs` covers 320–768. The laptop range was assumed.

## 2. What is deliberately NOT fixed, and why that matters more than what is

**Ten links is a sitemap, not a navigation**, and five of them — `/connections`, `/brief`,
`/dashboard`, `/members`, `/account` — are signed-in surfaces. Every one carries
`robots: { index: false }` and sits in `PRIVATE_PATHS`. A logged-out visitor is being offered five
links that will bounce them to `/signin`.

They cannot simply be removed: **this header is the product's chrome as well as the marketing
site's**, so deleting them strands a signed-in customer with no way to reach their own connections.
The real answer is a header that knows which of the two it is, and that is its own unit of work with
its own design decisions. Raising the breakpoint is a patch; it is labelled as one in the code.

The visible cost of the patch is that 1024–1279 now gets the drawer instead of the row. That is the
same trade the previous audit made one breakpoint down, and it is strictly better than the CTA being
unreachable.

## 3. The motion system, and the one rule it cannot break

**The page is complete and readable with the entire motion block deleted.**

The usual scroll reveal sets `opacity: 0` in a stylesheet and repaints when a script says so. That
makes the page's *default* state invisible and its readable state conditional on a script running —
so a JavaScript error earlier in the bundle, a blocked third party, a crawler that does not execute
scripts, or a reader whose extension disabled the observer all get a blank page. **This site
publishes `llms.txt` precisely because things that do not run scripts come here to read it.**

So the reveal is opt-*in*, through `@supports (animation-timeline: view())`. Hiding an element
requires a feature which, if present, also un-hides it. There is no arrangement of failures that
leaves content invisible, and no JavaScript at all — no observer, no scroll listener, no hydration
cost, and no frame dropped on the mid-range phone this product's customer is holding.

Three further rules, each held by a test rather than by intention:

* **Only `opacity` and `transform`.** Both composited, neither in layout, so no reveal can shift a
  line of text under a reader's thumb mid-scroll.
* **`prefers-reduced-motion: no-preference`, never an override.** An override can be beaten by
  specificity; a declaration that was never written cannot.
* **The hero's draw-on has no `fill-mode`.** Before the animation starts and after it ends the line
  is simply drawn. `both` or `backwards` would show an empty chart on a slow first paint.

`pathLength="1"` on the trend path is what keeps the draw-on honest: dash units are measured against
a declared length of one whole path, so redrawing the trend or changing the viewBox cannot leave it
animating the wrong distance.

## 3b. The benchmark, measured rather than recalled

The founder named **supermetrics.com** and **windsor.ai** as the bar. The first version of this work
was built on judgement and never compared to either, which is the same defect as a figure nobody
produced. Both were fetched and their shipped stylesheets read.

| | supermetrics.com | windsor.ai | here |
|---|---|---|---|
| stylesheet | `_astro/index.HV-U3gWy.css`, 158 KB | `new_design.css`, 33 KB | `globals.css` + tokens |
| transition durations | **.2s ×30**, .3s ×27, .15s ×5 | .2s / .3s | **200ms** base, 160ms fast |
| easing | **ease-out ×89**, linear ×9, ease-in-out ×8 | linear ×15 | two named curves |
| entrance keyframes | fadeIn, fadeInUp, fadeInDown, slideInLeft | target-fade | mp-reveal, mp-reveal-side |
| `fadeInUp` travel | `translate3d(0,30px,0)` | — | **24px**, and see below |
| entrance trigger | class-applied; no scroll timeline | — | **`animation-timeline: view()`, no JS** |
| stagger | not in the stylesheet | — | 4-step range offset |
| continuous decoration | `carousel` | `circle-rotate`, `img-rotate`, reverse + delayed variants | `mp-drift` |
| SVG draw-on | none | none | `mp-draw` |
| **`prefers-reduced-motion`** | **0 blocks** | **0 blocks** | every animation gated |
| imagery | 91 `<picture>`, 112 `<img>`, 2 `<video>` | 179 `<img>`, 24 `<svg>` | 1 screenshot, 1 logo strip |

**Two values moved because of this, and one deliberately did not.**

`--mp-motion-base` was **320ms and is now 200ms**. A control answering a pointer at 320ms is slower
than the bar, and the bar agrees with itself: `.2s` is the single most common duration on the
reference, thirty occurrences.

`--mp-motion-rise-distance` was **18px and is now 24px**, still short of their 30px. Their entrance
is time-driven — the element travels 30px while the reader holds still. Ours is driven by scroll
position, so the reader is *also* moving and the perceived travel is the sum. The number moved
because it was measured against something; it did not move all the way because the two mechanisms
are not the same mechanism.

A fourth keyframe was added, `mp-reveal-side`, because the reference ships direction variety
(`fadeInUp` *and* `slideInLeft`) and this did not. A two-column section whose halves both rise reads
as one block twitching; the copy arriving from the side while the visual rises reads as two things
assembling. It is used on exactly the three split sections that have that shape.

**Where the bar is not matched, and will not be.** Neither reference contains a single
`prefers-reduced-motion` block — zero in both stylesheets and zero in both HTML documents. Matching
them there would mean deleting the gates.

**Where the bar is genuinely ahead, and it is not animation.** Supermetrics ships 91 `<picture>`
elements and two videos; Windsor ships 179 images. This page has one screenshot and a logo strip.
That gap is photography, illustration and product footage — assets, not CSS — and no amount of
motion work closes it. It is named here rather than quietly left out of the comparison.

*(A methodology note, because it nearly produced a false finding: an early pass grep'd both
documents for motion runtimes and reported three "rive" hits on one and five on the other. Both were
substring matches — "d**rive**s" in a headline, "**Rive**ry" in a competitor logo. Neither site
loads Rive. The finding was checked before it was written down.)*

## 3c. The home page was one flat ribbon, and that was measurable

The brief singled out the home page. Measured before anything was changed: **thirteen sections,
roughly nine thousand pixels, and every one of them reported a fully transparent computed
background.** The whole page sat on a single ground, so nothing marked where one argument stopped
and the next began. Both references band their sections; this one did not band at all.

It now carries four bands, grouped **by argument rather than by alternation**. Strict
light-dark-light over thirteen sections is its own monotony — it manufactures a rhythm out of
nothing and puts a seam through the middle of ideas that belong together. So:

| Band | Sections | Why together |
|---|---|---|
| ground | hero, integrations strip | the opening |
| `surface-subtle` | SimplerWay, ActionSheet | one argument: told what to do, and every insight ends in a to-do |
| ground | FeatureGrid, AssistantPanel | the capabilities |
| **`surface-inset`** | IntegrationsMap, DashboardFeature | **the product moment** — your tools, then the page you open instead of the others |
| ground | Reports | |
| `surface-subtle` | Pricing | |
| ground | UseCases | |
| `surface-subtle` | Faq, FinalCta | the close |

`surface-inset` is spent **once**. The token file records it as *"BRAND.md Pale blue — soft feature
backgrounds"*, which is this exact job; used everywhere it stops being an emphasis, used nowhere the
product moment reads like every other section. **No new value is introduced** — three existing
tokens, no literal.

Measured after, in a real browser, both schemes — **these are the counts before the contrast band
in §3d, which adds one more tone to each**:

| | distinct grounds | ink contrast |
|---|---|---|
| light | **3** | 15.44 – 17.32 : 1 |
| dark | **2** | 14.63 – 17.85 : 1 |

**Dark mode loses the third tone, and that is the token file's decision rather than an oversight.**
Its dark block resolves both `surface-subtle` and `surface-inset` to the ground, with the reason
written beside it: *"an inset rail recedes on dark, so it takes the ground."* The rhythm survives —
two grounds still band the page — but the product moment is not distinguished there. Inventing a
third dark value to fix it would be a colour nobody chose, and the token file marks the two values
it had to invent as `INVENTED` precisely because that is a cost.

**The bands live in `page.tsx`, not on the sections.** Every section sets its own
`mx-auto max-w-[1200px]`, so a background on the section itself paints a 1200px stripe with bare
ground either side. The band has to be an outer element — and keeping all four in one file makes the
rhythm readable *as* a rhythm instead of as eleven independent decisions.

**No band wrapper may set `overflow`.** `animation-timeline: view()` resolves against the nearest
scrollport, so an `overflow-hidden` on a wrapper would silently retime every reveal below it against
the wrong box — and nothing would look broken enough to investigate. A test refuses it.

## 3d. The one contrast band, and the verdict against the two references

Banding by argument closed the flat-ribbon defect but left one measured gap open. supermetrics.com
bands its home page with **six** `data-theme` tones, and **three of them are dark** (`dark` ×5,
`dark-purple` ×3, `dark-grey` ×1). This page had three light tones and **not one contrast band** —
every section, top to bottom, on some shade of white. A page that only ever gets lighter and darker
by two per cent has a rhythm you have to look for.

The closing call to action is where that is spent, and the only place spending it is cheap. The
panel holds one heading, one line of lead and one filled button, so inking it for a dark ground is
three tokens. Putting the band on an argument section instead would mean re-inking every card, chart
and caption inside it — a far larger change for a smaller reason.

`surface-inverse` **inverts with the theme**: deep navy under a light scheme, the light ground under
a dark one. That is the token behaving correctly. What the band is for is contrast *against the page
around it*, and it stays a contrast band in both. The button does not change — the token file is
explicit that filled controls keep `--mp-accent` and `--mp-ink-on-accent` everywhere, and
`--mp-accent-on-dark` is for accent **text** on a dark ground, which this is not.

Measured in a real browser, both schemes:

| | panel | heading | lead | button ink on fill |
|---|---|---|---|---|
| light | `rgb(23, 35, 50)` | **15.87 : 1** | **10.47 : 1** | 4.86 : 1 |
| dark | `rgb(244, 246, 250)` | **16.50 : 1** | **7.00 : 1** | 4.86 : 1 |

Ground tones on the home page now: **light 4** (page white, `surface-subtle`, `surface-inset`, the
contrast band), **dark 3** (page, ground, the contrast band).

### The verdict the brief asked for

The instruction was to match or beat supermetrics.com and windsor.ai on design and animation. Both
were fetched and their stylesheets counted; the numbers below are from that measurement, not from
memory. Stated plainly, including where this page loses:

| Dimension | supermetrics | windsor | here | verdict |
|---|---|---|---|---|
| keyframes defined | 6 | 8 | 7 | **match** |
| distinct entrance variants | 4 | 1 | 2 | **behind** |
| entrance trigger | class applied by JS | class applied by JS | scroll-driven CSS, no JS | **beat** |
| stagger | none in CSS | none | 4-step, CSS only | **beat** |
| transition duration | `.2s` ×30 | `.2s` / `.3s` | 200ms | **match** |
| SVG draw-on | none | none | yes, `pathLength="1"` | **beat** |
| `prefers-reduced-motion` blocks | **0** | **0** | 4, and every animation gated by one | **beat** |
| JavaScript cost of motion | JS-driven | JS-driven | **zero bytes** | **beat** |
| home-page ground tones | 6 (3 dark) | 20 background declarations | 4 light / 3 dark, 1 contrast band | **behind** |
| imagery | 91 `<picture>`, 112 `<img>`, 2 video | 179 `<img>`, 24 `<svg>` | 1 screenshot, 1 logo strip | **well behind** |

**On animation this page beats both references, and it is not close.** They animate by having
JavaScript add a class; this animates on the scroll timeline with no script at all, so the motion
costs nothing to download, nothing to hydrate and nothing on the main thread. Neither reference ships
a single `prefers-reduced-motion` block — on both of those sites, a visitor who has asked their
operating system to stop moving things is ignored. Here the motion is *opt-in to the preference*:
every animation lives inside `@media (prefers-reduced-motion: no-preference)` nested in
`@supports (animation-timeline: view())`, so turning the whole motion system off leaves a complete,
correct page rather than a blank one. Durations and keyframe count match the references because they
were retuned *against* them, not guessed.

**On design the verdict splits.** Banding, rhythm and the contrast band now read as deliberate, and
the header fits at every laptop width the references fit at — which it did not before this branch.
But the references are **image-dense and this page is not**: 203 image elements on one and 203 on
the other, against one product screenshot here. That is photography, illustration and product
footage — **assets, not CSS** — and no amount of motion or banding work closes it. It is a
commissioning decision with a budget attached, and inventing placeholder imagery to close a gap on
paper would make the page worse, not better.

So: **beats both on animation technique, accessibility and page weight; matches on timing and
density of motion; remains behind on imagery, and will until someone buys imagery.** That last line
is the finding, recorded here rather than left for the next person to rediscover.

## 4. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.` No platform read, no envelope
row, no R2, no KV, no model call, nothing on the scheduler. The motion adds **no JavaScript**: no
bundle growth, no hydration, no main-thread work. Two new harnesses are developer tools that run on
demand and never in a customer's browser.

## 5. Platform-terms check

### Credential
**1. BYOC** / **2. Vendor key** / **3. Token pass-through** — no platform call, no credential on any
path in this diff. > `N/A`
**4. Credential hygiene.** Nothing sensitive is stored, logged or rendered. The two harnesses drive
a local server and hold no secret. > `PASS`

### Tenancy
**5. RLS** / **8. Cross-customer aggregation** / **9. API key scope** — no table, no query, no key.
> `N/A`
**6. No service-role bypass.** No query at all. > `PASS`
**7. No cross-workspace read.** None issued. > `PASS`

### Data movement
**10. No resale or redistribution.** Nothing leaves. > `PASS`
**11. Meta client list** / **12. Dependency licences** — untouched; no dependency added
(`playwright` was already a devDependency). > `N/A`

### PII and consent
**13. Hash at the edge.** No personal datum is handled or rendered. No column added. Nothing reaches
a model prompt. > `PASS`
**14. Forbidden payloads** / **15. Per-destination consent** — no input accepted. > `N/A`

### Access tier and quota
**16. Tier reality** / **17. Long-lead dependency** — no quota consumed, nothing waits on an
approval. > `PASS`

### Claims
**18. Claim provenance.** **No copy changed.** Not one sentence was added, removed or reworded —
every edit is a class name, a stylesheet rule, a token or a comment. `check-copy` and
`forbidden-claims.test.ts` pass unchanged, and no claim from `@repo/brand` is published or altered.
> `PASS`

**Result:** `8 PASS, 10 N/A, 0 FAIL`

## 6. What was left out

* **The header that knows whether it is marketing or product.** §2. The real fix; its own unit.
* **Revealing the marquee, the FAQ and the final CTA.** The reveal is applied to the five sections
  with heading-plus-grid structure. The marquee already has motion of its own and a reveal on top of
  it reads as two things happening; the FAQ is a list of disclosures where an entrance competes with
  the open/close. Restraint rather than oversight.
* **Number count-ups on the hero metrics.** The figures are labelled samples, and a number animating
  upward implies it is being read live — which is the one impression this page must not give.
* **Anything JavaScript-driven.** Scroll-driven CSS covers the whole design. An IntersectionObserver
  would buy support in engines without scroll timelines, at the cost of the guarantee in §3.

## 7. Open or unverified spec items this builds on

* **Where `animation-timeline: view()` is unsupported, the page is the static page it already was.**
  That is a fallback by construction — the `@supports` block simply never applies — rather than a
  claim about any browser version, and it is stated that way deliberately: this repository has no
  way to verify a support table and will not quote one.
* Nothing else. No platform, no statutory deadline, no setting anyone must confirm.

## 8. Verification

```
pnpm -r test                      # 0  — web 841, api-edge 328, insights 146
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  — all nine
./supabase/tests/run-local.sh     # 0  — 754 assertions, 0 failed
pnpm --filter web build           # 0  — production build

node apps/web/scripts/header-fit.mjs     # PASS at 360/768/1024/1152/1280/1366/1440/1600/1920
node apps/web/scripts/motion-check.mjs   # OK
```

### Mutation proof

Nineteen mutations, each caught by a named test and put back. The full list is in the PR; four are
worth reading here.

| Mutation | What caught it |
|---|---|
| apply the reveal outside `@supports` | `declares the animation only inside the support query` |
| keep `text-ink` on the heading when its panel turns dark | `carries exactly one contrast band, and inks it for the ground it is on` |
| unwrap the contrast band back to `surface-inset` | the same test |
| give the hero draw-on a `fill-mode` | `draws the trend line without ever leaving it half drawn` |
| animate `margin-top` in the reveal keyframe | `animates exactly opacity and transform, and nothing else` |
| add an eleventh nav link | `is not left to drift the next time a link is added` |

**Five mutations passed before they failed, and four of those were the guard being wrong.**

1. **`margin-top` walked straight through the layout check.** The ban list matched `margin` exactly,
   so it caught the one spelling nobody would write. The list is stems now (`margin` catches
   `margin-top`, `border` catches `border-width`) — and an **allow-list** was added beside it,
   because a ban list can only refuse what somebody thought to name.

2. **Two reduced-motion checks tested proximity, not containment.** They asked whether a
   `prefers-reduced-motion` string existed *above* a selector, via `lastIndexOf`. Moving the hero's
   animations out of their gate entirely left both green, because the reveal block's query was still
   further up the file. A rule is inside a query or it is not; how far away the words are is not
   evidence. Both now brace-match the query bodies and test containment.

3. **The first "hide content outside the query" mutation was my mutation being wrong**, not the
   test — it renamed a class inside the block rather than moving a declaration out of it. Redone
   properly, it fails, and a second assertion was added for the other way to build the same defect
   (a bare `opacity: 0` on a reveal class anywhere in the file).

4. **`\btext-ink\b` matched `text-ink-inverse-strong`.** The first contrast-band assertion failed
   on the *correct* markup, because `\b` fires at the hyphen — so a word boundary is no evidence the
   token ended there. It is a negative lookahead now, `text-ink(?![-\w])`. Worth writing down
   because the failure was loud this time; the same pattern written as a "must contain" rather than
   a "must not contain" would have passed on nothing useful and said so silently.

**And a measurement was wrong in a way that would have shipped a false report.** The first run of
the header numbers was taken against a server still serving a previous build's asset hashes, so no
utility applied at all: `display: inline` on elements classed `block`, `max-width: none` on a
`max-w-[1200px]` section, and 570px of invented overflow. An unstyled page measures beautifully
wrong. `header-fit.mjs` now asserts the stylesheet arrived — if `max-width` on the first constrained
section is not 1200px, it reports nothing else — and every number in §1 was re-taken, on both sides
of the change, with that assertion passing.
