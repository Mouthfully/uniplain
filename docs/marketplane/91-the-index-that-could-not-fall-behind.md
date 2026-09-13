# 91. The index that could not fall behind the site

**PR:** #80 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

The footer carried the imprint and five policy links. Twenty-one public pages exist. Everything
else — six connector pages, three segment pages, the row shape, the field map, `/security` — was
reachable from the six-item header, from a search engine, or from nowhere. A visitor standing on the
pricing page had no route to the connector page for their till.

The footer now carries five columns: **Product**, **Connectors**, **Reference**, **By business** and
**Trust and legal**, plus the machine-readable files under Reference. The imprint moved to a bottom
bar under a rule.

**The decision, and it is the whole unit: the columns are built from `AGENT_PAGES`, not written.**

`_footer-links.ts` groups the route registry. `footer-links.test.tsx` asserts every registry path is
in exactly one column or is written down in `FOOTER_UNLISTED` with a reason. `FOOTER_UNLISTED` is
empty today, which is the honest state — every public page this product has is worth linking from
every page of it.

**The alternative considered and rejected was a sixth hand-kept list of routes**, which is what a
footer normally is. Five have drifted in this repository and every one drifted identically:

| List | What it said | What was true |
|---|---|---|
| `sitemap.ts` | 8 routes | 14 indexable, 5 of the 6 omitted were connector pages |
| `robots.ts` | 2 disallowed | 7 private, including `/connections` and `/brief` |
| `IntegrationsStrip` | 13 platform marks | 4 are connectors; two of the rest are §5.1 names |
| the footer | `/terms`, `/privacy` | `/dpa`, `/processing`, `/sub-processors` shipped unlinked |
| the footer, again | those 5 | 21 public pages |

None was wrong when written. Each was compared to nothing afterwards. `registry.test.ts` already
holds `AGENT_PAGES` against `app/**` on disk in both directions, so grouping *that* list means a new
public page goes red here until somebody decides which column it belongs in — **and the decision is
the point.** The defect was never a missing link. It was a link nobody chose not to add.

### 1.1 Labels are the pages' own titles, and may only be trimmed

A retyped label drifts silently: the link keeps working and describes a page that has since been
renamed. So no label is written in the footer module. Each is the registry `title`, with an optional
group-level `trimSuffix` removing a word the column heading already supplies — six titles ending
"connector" under a heading reading **Connectors**.

`trimSuffix` may only **remove from the end**, never add or replace, which makes every rendered label
a prefix of the title it came from. That is the property the test asserts, rather than trusting the
helper to have only removed. Mutation-proven by hard-coding one label; see §6.

`footerLinks` **throws** on a path with no registry entry rather than skipping it. A skipped link is
this module's own defect arrived at from the other side: the column renders, the page is missing from
it, and nothing says so. `AGENT_PAGES` is a build-time constant, so the throw stops a production
build, which is where a mistake in a list of routes should stop.

### 1.2 The machine-readable files are hand-written, and that is why they are checked twice

`/llms.txt`, `/sitemap.xml` and `/robots.txt` have no `page.tsx` and therefore no registry entry, so
`files` bypasses the mechanism above. Two assertions cover the gap: each must map to a route module
that exists on disk, and no rendered href may be a `PRIVATE_PATHS` entry.

That second one is only reachable **because** `files` exists. Through `paths` it would be vacuous —
`registry.test.ts` already refuses a noindex route in `AGENT_PAGES`, so `footerLinks` would throw
first. A hand-written entry is the only way `/keys` or `/brief` could reach this footer, and it is
exactly the way one would. Asserted over the rendered hrefs for that reason.

### 1.3 The tap floor is 24px here and 44px in the header, deliberately

`_chrome.test.tsx` holds the header's controls to WCAG 2.5.5 — 44px, AAA. Twenty-four footer links at
44px is 1,056 pixels of column. **2.5.8 is the AA floor and it is 24**, these are not primary
controls, and the phone is already where the six-link header leaves the most unreachable. The class
is written explicitly rather than left to the line height, so the number is a decision a test can
read; the test asserts a floor rather than the value, so raising it stays legal.

The columns are `grid-cols-2` from the narrowest width, not `sm:`. Stacked single-file at 390px the
five columns ran past a thousand pixels, which turns an index into a scroll. Measured in Chromium at
390×844 before and after.

## 2. Cost estimate

**Per connected account per month:** `$0.00`

N/A — no data-plane work. A statically-rendered footer gains nineteen `<a>` elements and five
headings, all from build-time constants. No query, no upstream call, no scheduler work, nothing added
to the ingest path. `AGENT_PAGES` was already imported by the sitemap, `llms.txt` and the per-page
markdown, so the module adds no new dependency edge to the served bundle.

## 3. Platform-terms check

### Credential
**1. BYOC.** > `N/A` — no platform call. &nbsp; **2. Vendor-key exception.** > `N/A` — no
company-held key. &nbsp; **3. No token pass-through.** > `N/A` — no MCP or OAuth surface.
&nbsp; **4. Credential hygiene.** > `N/A` — no credential in the diff.

### Tenancy
**5. RLS.** > `N/A` — no migration or table. &nbsp; **6. No service-role bypass.** > `N/A` — static
chrome, no request path. &nbsp; **7. No cross-workspace read.** > `PASS` — build-time constants; no
tenant row is read. &nbsp; **8. No cross-customer aggregation.** > `PASS` — nothing aggregated.
&nbsp; **9. API key scope.** > `N/A` — untouched.

### Data movement
**10. No resale or redistribution.** > `PASS` — nothing moves. &nbsp; **11. Meta client list.**
> `N/A` — no Meta onboarding, workspace lifecycle or deletion path is touched. &nbsp;
**12. Dependency licences.** > `PASS` — none added.

### PII and consent
**13. Hash at the edge.** > `N/A` — no ingest path. &nbsp; **14. Forbidden payloads.** > `N/A` — no
egress. &nbsp; **15. Per-destination consent.** > `N/A` — no consent object.

### Access tier and quota
**16. Tier reality.** > `N/A` — no upstream request. &nbsp; **17. No new long-lead dependency.**
> `PASS` — every page linked already ships.

### Claims
**18. Claim provenance.** > **`PASS`, and it is the gate worth arguing.** A footer link is not a
claim sentence, but a *label* is prose rendered on every page of the site, and hand-typing twenty-one
of them is twenty-one chances to write a promise outside `CLAIMS`. Nothing here is typed: each label
is a registry `title`, and the registry is already scanned for `FORBIDDEN_CLAIMS` by
`forbidden-claims.test.ts`. `check-copy` passes because the strings are named constants and the
headings are noun phrases.

Two claim-shaped consequences are improvements rather than risks. **`/dpa` stays linked** — PDPA s.40
puts the duty to hold a processor agreement on the *customer*, and a reviewer who cannot find one
concludes this vendor cannot be appointed at all. And the **labels are now the pages' own titles**,
so the legal column reads "Data processing agreement", "Record of processing" and "Privacy notice"
rather than the shorter hand-written versions it carried — which say the same thing the documents
say, because they *are* what the documents say.

**Result:** `8 PASS, 10 N/A, 0 FAIL`

## 4. What was left out

- **A search box, a language switch and a status link.** Standard footer furniture. There is no
  search index, one language, and no status page; a link to any of them would be a promise.
- **Linking `/dashboard`, `/brief` and `/connections`** the way the header does. The header is
  signed-in-aware by way of middleware; the footer would be advertising a sign-in wall on a
  marketing page. Asserted the other way instead: no `PRIVATE_PATHS` entry may appear.
- **Making the logo a link to `/`.** A one-line change and a real omission, but it is in the imprint
  block rather than the index this unit is about, and `/` is now linked as **Overview** from the
  Product column. Not worth widening the diff for; noted so the next person sees it was seen.
- **Backfilling the design notes for the five commits before this one on this PR.** See §5.

## 5. Open or unverified spec items this builds on

- **Five commits on this PR shipped with no design note**: the hero overlay fix, the mobile menu
  fix, the insight card, the Reports section and the terms termination clause. Note 90 covers only
  the first unit on the branch. The working agreement says a note per PR and this PR has one — but
  it plainly means a note per *unit*, and four of those units have none. **Recorded rather than
  fixed**, because writing four retrospective notes now would be inventing the reasoning rather than
  recording it, which is the failure mode the notes exist to prevent. The commit messages carry the
  argument in each case.
- **`FOOTER_UNLISTED` is empty and the test that guards it is therefore weak in one direction.** It
  asserts that anything excepted is a real registry path; it cannot assert that a reason was
  written, because a reason is a comment. If the list ever grows, the reason beside each entry is a
  convention held by review and by nothing else.
- **§5.1's platform-name rule does not reach this footer**, because every connector column entry is
  a page this product ships for a connector it has built. Stated so it can be disagreed with: the
  six entries are the six implemented connectors, which is the same set `check-capabilities.mjs`
  holds against the source tree.
- **`IntegrationsStrip` still lists nine platforms this product does not read**, two of them §5.1
  names. Unchanged here, and this change makes the contrast sharper: the footer's Connectors column
  is now the accurate list, six items, a few hundred pixels below a strip of thirteen. Issue #81.

## 6. Verification

```
pnpm exec biome lint .  = 0    pnpm exec biome format .  = 0
pnpm -r typecheck       = 0    pnpm -r test              = 0
pnpm --filter web build = 0    all nine check-*.mjs      = 0
```

No migration; the SQL suite is unaffected. Footer rendered and measured in Chromium at 1280×900 and
390×844.

### Mutations, each proven and reverted

| Mutation | Named test that went red |
|---|---|
| Drop `/security` from the legal column | `puts every registered page in a column or writes down why it is out` — *these public pages are linked from no column and named in no exception: /security* |
| Return a hand-typed `"Analytics"` for the GA4 link instead of the derived label | `draws every label from the page's own title` — *"Analytics" is not what "Google Analytics 4 connector" says; it was written rather than derived* |
| Add `{ href: "/keys", label: "API keys" }` to `files` | `reaches no signed-in surface` **and** `links a route module for every machine-readable file` — two, because a hand-written entry escapes both checks at once |
| Put `/blog` in `FOOTER_UNLISTED` | `keeps the exception list a decision rather than a dumping ground` — */blog is excepted from a list it was never on* |

The first is the one that matters, and the failure count is the tell that it landed: **one** failure,
with the `it.each` in `_chrome.test.tsx` reporting 56 cases where the unmutated run reports 57. A
dropped column entry has to remove exactly one rendered link and fail exactly one assertion; anything
else would mean the mutation broke something other than what it was aimed at.

The third failing **two** tests is not noise either. `/keys` has no route module under the
machine-readable map and is a `PRIVATE_PATHS` entry, and a hand-written `files` entry is precisely
the change that would trip both — which is the argument in §1.2, observed rather than asserted.
