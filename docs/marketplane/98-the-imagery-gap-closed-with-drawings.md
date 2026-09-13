# 98. The imagery gap, closed with drawings rather than photographs

**PR:** #86 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** merged

---

## 1. What this is, and the decision taken

Note 97 measured the landing pages against the two references the founder named and ended on one
honest loss: **imagery.** 213 image elements on supermetrics.com, 203 on windsor.ai, against one
product screenshot and a logo strip here. The note called it "photography and product footage,
assets not CSS", and recorded that no amount of motion work closes it.

**The decision is that the gap gets closed with DRAWINGS rather than with photographs, and the
reason is not the budget.** The references' imagery is decorative: office interiors, laptops on
desks, smiling staff. Buying an equivalent library would match the count and say nothing. What this
product has instead is four claims nobody else can make, and every one of them is a SHAPE --

* the figures and the language travel separately and meet again at a check;
* many kinds of account arrive as one row shape;
* two database identities that never touch;
* and, on each trade page, the actual rows a brief was computed from.

A shape is the one thing prose is bad at and a stock photograph cannot carry at all. So: five
figures on five pages, all drawn in SVG from tokens, none of them decorative.

The alternative considered and rejected was **commissioning illustration to match the count.** It
would have closed the measured gap and left the pages saying exactly what they said before, which is
the same defect as a chart drawn from numbers somebody typed for the chart.

### The harness, and why the old number was the wrong number

`apps/web/scripts/imagery-audit.mjs` counts **painted pictures**, not image tags, because a tag
count is wrong in both directions: a 24px line icon repeated down a feature list is four `<svg>`
elements and no imagery, and a bar chart built from divs is zero tags and unmistakably a picture. It
measures the painted box of every `img`, `picture`, `video`, `canvas`, `svg` and `[role="img"]`,
counts the ones large enough to read as a picture rather than a bullet, and skips a candidate whose
ancestor already counted.

`[role="img"]` is in that selector and **`data-picture` deliberately is not.** A count you can raise
by adding an attribute is worth nothing; `role="img"` was already on the drawn panels because a
screen reader needs to be told the same thing, so the harness reads a declaration the code already
made rather than one invented to score.

| | before | after |
|---|---|---|
| `/` | 7 | **8** |
| `/integrations` | 1 | **2** |
| `/for/cafe`, `/for/salon`, `/for/online-shop` | 1 each | **2 each** |
| `/security` | 1 | **2** |
| `/pricing`, `/docs` | 1 each | 1 each — see §6 |
| **total across eight landing pages** | **14** | **20** |

**CORRECTION, AND THE REASON IT IS RECORDED RATHER THAN EDITED AWAY.** Both columns above were
measured against a base that did not yet include #85, which **deliberately deleted the four bar
charts from the reports section** -- they illustrated four documents that do not exist, and the
`aria-label="Sample figures"` admitting it was alt text no sighted reader ever met. That was the
right call and it removes four painted pictures from the home page. Re-measured on the main these
figures actually landed on: **10 before, 16 after.**

**The delta is +6 either way**, which is what this unit did; the endpoints moved because another
unit correctly took something away. Two true measurements of different trees, and the one that
describes today's is the second.

**The references were NOT re-measured with this ruler, and that is a finding rather than an
omission.** Chromium cannot reach either site through this environment's egress proxy — the tunnel
closes mid-exchange on both, reproducibly — so their painted-picture count is unknown. Their tag
counts were re-taken with `curl` and are unchanged (supermetrics 112 `img` + 91 `picture` + 2
`video` + 8 `svg`; windsor 179 `img` + 24 `svg`). **A tag count and a painted-picture count are not
the same measurement and must not be put in the same column.** The harness takes a `BASE` and a
proxy from the environment so the comparison can be completed the day the references are reachable.

### What was drawn

| Figure | Page | What it says that the sentence beside it cannot |
|---|---|---|
| `InsightPipeline` | `/` | The flow **forks at the computed figures**: one branch to the model, one straight to the check. Drawn as a chain, the model would be a step the numbers pass through, which is the one thing this product does not do. The model's station is dashed because it holds language, not arithmetic; the refusing exit is drawn at the same weight as the sending one. |
| `OneRowShape` | `/integrations` | A till, an ad account, a store and an analytics property arriving at one row. The field names are `InsightRow`'s own, and `is_provisional` is in the drawing on purpose — it is the field a competitor's diagram leaves out. |
| `TwoIdentities` | `/security` | Two lanes with a rule between them that nothing crosses, and one struck box for the service-role key that is not in the Worker. The absence is the point, and a diagram that only draws what exists cannot show it. |
| `SegmentRows` | `/for/*` | The **actual rows** each brief was computed from, one panel per account. |

`SegmentRows` is the one chart on this site that cannot go wrong: it reads `segment.rows`, the same
array `buildFigureSet` was handed to produce the figures printed beside it. There is no second set of
numbers to drift because there is nowhere to write one.

**It draws shape and never prints a value**, and that is a rule. The figures beside it were rendered
by the engine — `renderMoney` and `renderCount` decide currency, precision and separator. An axis
label here would be a second renderer for the same numbers, and the first time the two disagreed on a
rounding the page would print one number twice, differently, with nothing to say which was right. A
test refuses a digit in any text the chart renders.

`METRIC_LABELS` was exported from `@repo/insights` for it. A label typed in the web app is how a page
ends up calling `net_revenue` "revenue" and contradicting the figure beside it.

### Two defects this found in itself

**A diagram nobody can read is worse than no diagram, and the first version shipped one.** At a
420px viewport `InsightPipeline` set its 13px labels at roughly four and a half pixels: complete,
correctly proportioned, unreadable. Wide figures now sit in `Figure`, which stops the drawing
shrinking below a derived minimum and scrolls instead. Hiding wide figures below a breakpoint was
considered and rejected — it tidies the page by taking the picture away from the readers most likely
to be on a phone.

**And the frame then broke the page around it.** `overflow-x: auto` scrolls only when the container
is itself constrained, and a grid item defaults to `min-width: auto`, so the 820px inner block pushed
its own column wide and **the home page gained 474px of sideways scroll at 390px** — the same class
of defect as the header CTA in note 97, found the same way. `min-w-0 max-w-full` on the scroller.
Every page now reports 0 at 360, 390, 430 and 768.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.`

No platform read, no envelope row, no R2 object, no KV write, no model call, nothing on the
scheduler, no effect on the polling ratio section 8 names as the margin risk. The figures are inline
SVG rendered by server components: **no image bytes are downloaded at all**, no new dependency, no
JavaScript. `imagery-audit.mjs` is a developer tool that runs on demand and never in a customer's
browser.

## 3. Platform-terms check

### Credential

**1. BYOC.** > `N/A` — no platform call is added or changed. No figure reads a credential.

**2. Vendor-key exception.** > `N/A` — no company-held key is used; nothing fetches anything.

**3. No token pass-through.** > `N/A` — the MCP surface and the OAuth surface are untouched.

**4. Credential hygiene.** > `PASS` — no credential appears in the figures, their fixtures or their
tests. `TwoIdentities` names two database ROLES, which are not secrets.

### Tenancy

**5. RLS.** > `N/A` — no table, column or policy is added.

**6. No service-role bypass.** > `PASS` — nothing here runs a query. The figure on `/security`
documents that there is no service-role key in the Worker; it does not introduce one.

**7. No cross-workspace read.** > `N/A` — no query is added. Every row drawn is a module constant in
`app/for/_content.ts`.

**8. No cross-customer aggregation or benchmarking.** > `PASS` — the charts draw one illustrative
segment's own rows. No percentile, median, peer comparison or industry average is computed or shown.

**9. API key scope.** > `N/A` — no API surface is touched.

### Data movement

**10. No resale or redistribution.** > `N/A` — no platform data moves. The rows drawn are sample
rows written into the repository, not any customer's.

**11. Meta client list.** > `N/A` — no Meta onboarding, workspace lifecycle or deletion path is
touched. `/for/cafe` names Meta Ads in copy that already existed.

**12. Dependency licences.** > `PASS` — **no dependency is added.** The figures are hand-drawn SVG;
no charting library is introduced.

### PII and consent

**13. Hash at the edge.** > `PASS` — no personal datum is introduced. The sample rows carry a date,
a currency, a timezone and numbers, and `entity.id` is the literal string `sample-<source>`.

**14. Forbidden payloads rejected before egress.** > `N/A` — nothing egresses.

**15. Per-destination consent.** > `N/A` — no record is sent anywhere.

### Access tier and quota

**16. Tier reality.** > `N/A` — no request is made, so no quota is consumed.

**17. No new long-lead dependency.** > `N/A` — nothing here waits on an approval.

### Claims

**18. Claim provenance.** > `PASS` — and this is the gate that did work.

Every label in `TwoIdentities` names a **role, a view or a setting** — `app_scheduler`,
`public.due_connections`, `authenticated`, forced row-level security, and the absent service-role key
— each of which this repository can be read to confirm. Not one of them asserts an audit, a
certificate, a penetration test or a compliance status, so `FORBIDDEN_CLAIMS` has nothing to catch
and `forbidden-claims.test.ts` passes on the changed routes.

`OneRowShape` names six fields and a test ties them to the keys of a real `InsightRow`, so the
drawing cannot outlive the contract it describes. `InsightPipeline` shows **no number at all** —
there is nothing in it to label "sample", because it draws the path a figure takes and never a
figure. `SegmentRows` prints no value by construction and carries the existing sample badge.

**Result:** `7 PASS, 11 N/A, 0 FAIL`

## 4. What was left out

* **`/pricing` and `/docs` keep one picture each, deliberately.** A price is a number and a number is
  already in its best form; a reference document is a reference document. A figure on either would be
  decoration, and decoration is the imagery version of a chart drawn from invented data. "Closed"
  here means every page that had an argument worth drawing now has it drawn — not every page has a
  picture.
* **Photography and product footage.** Still absent, still a commissioning decision with a budget
  attached. This change does not claim to have closed that; it claims the drawn half was the half
  worth closing first.
* **A painted-picture count for the two references.** Unmeasurable from this environment (§1). The
  harness is written to take it the day they are reachable.
* **Animating any of the figures.** The motion system from note 97 is scroll-driven and resolves
  against the nearest scrollport; a `Figure` frame IS a scrollport. A reveal inside one would be
  timed against the frame rather than the page. Nothing here animates and a test keeps it that way.
* **A vertical variant of each wide figure for phones.** Two drawings per figure to maintain, against
  a scroller that works today.

## 5. Open or unverified spec items this builds on

* **Newer browser engines make overflow containers keyboard-focusable on their own.** `Figure` writes
  `tabIndex={0}` rather than relying on it, because this repository will not quote a support table it
  cannot verify.
* **The references' painted-picture count.** Stated as unknown above rather than estimated.
* Nothing else. No platform, no statutory deadline, no setting anyone must confirm.

## 6. Verification

```
pnpm -r test                      # 0
pnpm -r typecheck                 # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  -- all ten
./supabase/tests/run-local.sh     # 0  -- 754 assertions, 0 failed
pnpm --filter web build           # 0  -- production build

node apps/web/scripts/imagery-audit.mjs   # 14 -> 20 painted pictures across eight pages
node apps/web/scripts/header-fit.mjs      # PASS at nine widths
node apps/web/scripts/motion-check.mjs    # OK, both motion modes
```

Horizontal overflow re-measured at 360, 390, 430 and 768px on all six changed pages: **0 everywhere.**

### Mutation proof

Nine mutations against `app/_art/art.test.tsx`, each caught by a named test and put back.

| Mutation | What caught it |
|---|---|
| rename `role="img"` so the figure goes silent | `is announced as one picture with a name` |
| pin a figure to a fixed `width` | `scales with its container instead of being pinned to one size` |
| write a colour literal into every station's stroke | `writes no colour of its own` |
| put a scroll-driven reveal inside a figure frame | `puts nothing animated inside a figure frame` |
| print a number on the shape-only chart | `draws shape and never prints a value` |
| fall back to zero for an unreadable measurement | `gives an unreadable measurement no bar at all` |
| draw a field name the envelope does not have | `names only fields the envelope row actually has` |
| render an empty frame when there is nothing to draw | `draws nothing at all rather than an empty frame` |
| shorten a figure's accessible name to two words | `is announced as one picture with a name` |

**Three mutations passed before they failed, and two of those were the mutation being wrong.**

1. **`<svg[^>]*role="img"` matched `data-was-role="img"`.** `[^>]*` cheerfully consumed `data-was-`,
   so renaming the attribute to anything ENDING in `role` left the test green while the figure went
   silent to every screen reader. `\srole=` now. This is the third time in two units of work that a
   loose pattern has passed a mutation — `margin` matching only itself, `\btext-ink\b` firing at a
   hyphen, and now this. **The pattern is the lesson: an assertion about markup needs the boundary
   written, never assumed.**

2. A colour-literal mutation edited a `className` string that the file does not contain — the class
   list is built by a template literal. It proved nothing until it was redone against the element.

3. A label-shortening mutation wrote `const FIGURE_LABEL = "Two identities" && <the real label>`,
   which evaluates to the real label. It tested that `&&` works.

Separately: **the fixture was testing itself.** `art.test.tsx` first passed `SegmentRows` a short
accessible name invented for the test, so the "a name has to carry the argument" assertion measured
the fixture and would have gone on passing with the shipped label deleted. It reads
`FOR_COPY.rowsFigureLabel` now.
