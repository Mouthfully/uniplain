# 67. The phone: one gutter, five overflows, and a leading for Thai

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Every number in this note was read in a production build by `apps/web/scripts/mobile-audit.mjs`
(`node apps/web/scripts/mobile-audit.mjs`, 20 routes x 320/360/390/768). Nothing here was inferred
from a class name, and every fix below was re-measured after it landed.

**Before:** eleven route/width pairs scrolled sideways -- `/pricing` by 443px at 320, 
`/fields/google-ads` by 474px, `/` by 30px at all four widths, `/connectors/meta-ads` by 4px.
**After:** no route scrolls sideways at any of the four widths.

The decision, and it is a choice rather than a constraint: **the page gutter is bound to a token in
one CSS rule rather than edited at 104 call sites.** Of the 104 `px-8` in `apps/web`, 103 sit on
an `mx-auto max-w-[...]` shell and the 104th is the navigation panel added by this same change --
`absolute inset-x-0` under the header, full-bleed, wanting the header's own gutter rather than a
centred one. There is no `px-8` in this app that means anything but "page gutter" -- so
`globals.css` re-binds the utility to `--mp-gutter-page: clamp(16px, 5vw, 32px)`. The alternative
considered and rejected was a shared `<PageShell>` wrapper or a new class: both are the
same edit repeated 104 times, and both leave the next section anyone writes out of the fix, which is
how 64px of a 320px phone came to be spent on padding in the first place.

Three more single-place fixes, each mutation-proved in the browser (numbers in section 6):

* `.overflow-x-auto { position: relative }` -- the `/pricing` matrix sat in a scroller, and the
  scroller worked; its 26 `position: absolute` `.sr-only` cells did not belong to it, because a
  `static` box is not a containing block. They were laid out against the initial containing block
  780px out and clipped by nothing.
* `.hero-glow { overflow-x: clip }` below 1260px -- the decorative wash is inset `-30px`
  horizontally, which is free when the section is 1200px inside a wider viewport and is exactly
  30px of sideways scroll when the section *is* the viewport. The constant 30px at four different
  widths is what identified it; a content problem would have changed with the width.
* `min-w-0` on the `/fields/google-ads` article -- below `md` it is the only child of a grid with no
  template, so its auto track could not go below the 762px min-content the catalogue table's
  `min-w-[760px]` sets. The `md:` and `xl:` templates already said `minmax(0,1fr)`; the base one did
  not.

And two component fixes in `_sections/` and the hero: the hero's three-up metric row (a 67px
currency figure was being drawn in a 13px cell -- overlapping takings figures, which is the one
thing this product may not show), and `#integrations`, whose map row has never fitted the column it
is in at any viewport (332px column at 768, 440 at 1024, 528 from 1280 up, against a row that needs
676) and which therefore splits at `lg` now instead of `md`.

## 2. Cost estimate

**Per connected account per month:** `N/A -- no data-plane work.`

Marketing-surface CSS and JSX only. No connector, no scheduler, no query, no new row, no new
object, no model call. Nothing in the diff changes rows/night, restatement depth, Workers
invocations, R2 object count, KV writes, Supabase disk or bought data, so the ~98% margin question
and the redundant-polling ratio are untouched.

## 3. Platform-terms check

### Credential
1. **BYOC.** `N/A` -- no platform call in the diff.
2. **Vendor-key exception.** `N/A` -- no data source touched.
3. **No token pass-through.** `N/A` -- no MCP or OAuth surface touched.
4. **Credential hygiene.** `PASS` -- no credential, token or secret appears; the diff is CSS,
   Tailwind classes and one measurement script.

### Tenancy
5. **RLS.** `N/A` -- no table, column or migration.
6. **No service-role bypass.** `N/A` -- no request path changed.
7. **No cross-workspace read.** `N/A` -- no query.
8. **No cross-customer aggregation.** `N/A` -- nothing aggregates anything.
9. **API key scope.** `N/A` -- no key path.

### Data movement
10. **No resale or redistribution.** `N/A` -- no data leaves anything.
11. **Meta client list.** `N/A` -- no Meta onboarding or lifecycle code.
12. **Dependency licences.** `PASS` -- no dependency added. `playwright` was already added as an
    apps/web devDependency by the harness PR and is Apache-2.0, dev-only, never in the served path.

### PII and consent
13. **Hash at the edge.** `PASS` -- no field, log, payload or prompt is touched. The one string the
    Thai measurement substitutes into a heading is a fixed constant in the harness, not tenant text.
14. **Forbidden payloads rejected before egress.** `N/A` -- no egress.
15. **Per-destination consent.** `N/A` -- no record, no destination.

### Access tier and quota
16. **Tier reality.** `N/A` -- no upstream request.
17. **No new long-lead dependency.** `PASS` -- none; nothing here waits on an approval.

### Claims
18. **Claim provenance.** `PASS` -- no copy is added, changed or moved. Every string on every page
    is the one that was there before; the diff changes sizes, paddings, breakpoints and line
    heights. `check-copy`, `check-brand` and `forbidden-claims.test.ts` all pass.

**Result:** `5 PASS, 13 N/A, 0 FAIL`

## 4. What was left out

* **The header, the footer and `NAV`.** `_chrome.tsx` and the `NAV` constant were being rewritten in
  parallel for the reachability defect; nothing here touches either file. The header CTA (140x40),
  the drawer's six nav links (29x52) and the three footer links (121x14, 32x16, 38x16) are all still
  under 44px and all belong to that file.
* **757 nodes at 11px.** Left, deliberately. They are the app's caption size, they are consistent,
  and sweeping them is a type-scale redesign rather than a mobile fix. What was raised is the type
  that is smaller than that and is content a customer has to read: the connector diagram caption
  (8px -- the smallest in the app, below even the floor the static audit assumed), the
  `/fields/google-ads` type pills and the `/privacy` status chips (10px). Counts: 8px 18 -> 0,
  9px 38 -> 32, 10px 707 -> 590.
* **The mono fixture panels on `/connectors/*` (10px).** Left. They are a picture of one normalised
  row, with a fixed-width key column, a truncating value and an `ml-auto` note -- at 10px one of
  them (meta-ads) was already 4px over the viewport before this PR. Enlarging the specimen is a
  re-layout of the specimen, not a padding change. Issue, not scope creep.
* **The hero mock's own 9px labels.** Left. Chart-axis hours and the "Sample" badge inside a
  decorative dashboard shot; nothing in them is a fact a customer acts on. The one thing in that
  mock that *was* fixed is the one thing that is: the currency figures.
* **Tap targets between 24px and 44px.** Left, with the line drawn at the standard rather than at
  preference: WCAG 2.5.8 (AA) requires 24x24, 2.5.5 (AAA) 44x44. Everything in `_sections/` that was
  under 24 is now a 44px box (13 controls on `/` alone); the three 29px "See the source" chips
  inside the assistant mock are above the AA floor and were left at their designed size.
* **`#integrations` above 1024.** The map row needs 676px and its column is 528px at its widest, so
  it still spills ~21px into the gutter between the two columns from 1024 up -- measured at 768,
  900, 1024, 1280, 1440 and 1600. That is a tile-size decision on a founder-supplied artboard, not a
  padding fix. This PR only stops it reaching past the viewport.
* **`/connections`, `/billing`, `/welcome` behind a session.** Still unmeasured: all three redirect
  to `/signin` without one, so their rows in every report are `/signin`'s.
* **The Thai face.** `--mp-font-display` still carries no Thai face, so Thai in a heading is drawn
  by a system last-resort face (measured: 1066px of advance under the computed stack against
  1025.56px under Noto Sans Thai named explicitly). The token file already records that appending it
  is a founder call. The leading added here is derived from the worse of the two faces so that it
  holds whichever way that call goes.

## 5. Open or unverified spec items this builds on

None. No platform behaviour, freshness window, rate limit or approval is involved.

One local uncertainty worth recording instead: the Thai leading is **inert on every page today**.
`brand.defaultLocale` is `"en"` and there is no Thai copy anywhere in `apps/web`, so
`.font-display:lang(th)` matches nothing that currently ships. It was still worth writing, because
the alternative to a rule is a person remembering, and the harness now measures the tagged case on
every run -- delete the rule and two rows in the report go red on their own.

## 6. Verification

`./scripts/gate.sh` -- **PASS**, every check exited 0 (8 guards, biome lint, biome format,
typecheck, test). The SQL suite was not run: no migration, no policy, no function in this diff.

`node apps/web/scripts/mobile-audit.mjs` -- 20 routes x 4 widths, production build, exit 0.

```
                              before          after
horizontal overflow           11 route/width  0
  /pricing @320/@360/@390     443/403/373px   0
  /fields/google-ads          474/434/404px   0
  / @320/@360/@390/@768       30px each       0
  /connectors/meta-ads @320   4px             0
tap targets under 44px        1464            994     (13 of the removals are this PR's; the
                                                       rest are the parallel header work)
text under 12px               1520            1379    (8px: 18 -> 0)
```

**Mutation proof.** Each fix was reverted in the running browser and the document re-measured, which
is the same hide-test method the harness uses for attribution:

```
.px-8 forced back to a flat 32px      /connectors/meta-ads @320   0 -> +4px
.overflow-x-auto back to static       /pricing @320               0 -> +427px
                                      /pricing @390               0 -> +361px
article min-width back to auto        /fields/google-ads @320     0 -> +458px
                                      /fields/google-ads @390     0 -> +392px
.hero-glow overflow-x back to visible / @360                      0 -> +30px
                                      / @768                      0 -> +30px
#integrations back to two columns     / @768                      0 -> +13px
```

**Thai, and what the measurement actually said.** The prediction under test was that Thai marks
*clip*. They do not: no ancestor of either heading clips on either axis, and decoding the
screenshots row by row the ink reaches 1-2px above and 0-5px below the element's own box with
nothing severed. No leading was loosened on the strength of clipping, because clipping does not
reproduce.

What does reproduce is worse. At 38px with the authored `leading-[1.06]` the line box advances
40.28px while the Thai string's ink is 52px tall, so consecutive lines overlap by 11.72px and four
wrapped lines paint **one contiguous band with no blank pixel row in it**. Latin on the same element
is 37px of ink in that 40.28px box -- 3.28px of clearance. 52 + 3.2 = 55.2, and 55.2 / 38 = **1.45**,
which is where `--mp-leading-display-th` comes from; it is not a chosen number.

```
@360 h1 [as-shipped]          lang=(untagged)  box 40.28px  ink 52px  over +11.72px  bands 1
@360 h1 [lang-th-as-shipped]  lang=th          box 55.10px  ink 52px  over  -3.10px  bands 4, smallest gap 3px
```

Two variants (`lang-th-as-shipped`, `lang-th-face-fixed`) were added to the harness to measure this,
because a `:lang(th)` rule is invisible to a probe that substitutes Thai *text* into an element the
document still calls English. Mutation-proved: with the rule deleted and the page rebuilt, the
tagged row returns to `box 40.28px, over +11.72px, bands 1`. No Latin measurement moves -- the Latin
control is 37px of ink in a 40.28px box before and after, and every untagged row is unchanged.
