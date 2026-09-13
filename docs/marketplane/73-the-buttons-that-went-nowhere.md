# 73. The buttons that went nowhere

**PR:** #67 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Three links on the marketing site pointed at ids no element in the application carries. Two of them
were the primary call to action:

| Where | Read | Points at |
|---|---|---|
| `page.tsx` — the hero's **"Start free"** | `href="#start"` | nothing |
| `_sections/Pricing.tsx` — **every plan button** | `href="#start"` | nothing |
| `_sections/FaqCta.tsx` — **"Visit the help center"** | `href="#docs"` | nothing |

A visitor who was persuaded clicked the biggest button on the page and the page did not move.

**The decision: fix the three, and add the guard that would have caught them.** The alternative —
fixing them and moving on — leaves the next placeholder to be found by a customer.

## 2. Why they survived

All three were placeholders carried over from the reference design, and **each carried a comment
explaining that it was waiting for a page to exist**:

> *"The reference points this at a documentation page that is not part of the built app … it becomes
> a real href the moment the help centre has a route."*

`/docs` shipped. The comment did not. That is the failure mode worth naming, because it is not
carelessness and will happen again:

**A placeholder that reads like a decision survives the thing it was waiting for.** A reviewer
encountering `href="#docs"` with three lines of reasoning beside it reads a considered choice, not
an outstanding task — and nothing else in the repository could tell the difference. It does not
404, does not throw, does not warn, and renders identically to a working link.

This is the same shape as the two defects note 62 recorded and the one `run-local.sh` records about
suite 13: **a thing that is indistinguishable from working.** A test nothing runs looks like a test
that passes; a link that scrolls nowhere looks like a link.

## 3. Where they now point

`/signin`, for both `#start` sites. There is no separate sign-up route: the magic link creates the
account on first use, so *"start free"* **is** sign in.

**The plan buttons do not carry the plan**, and that was a decision rather than an omission.
Appending `?plan=growth` would look helpful and be a lie: nothing downstream reads it, `/welcome`
creates the organisation and `/billing` chooses the plan. A parameter no code consumes is a promise
the next screen silently breaks — which is this repository's own rule about defaults, applied to a
query string.

## 4. The guard

`apps/web/app/anchors.test.ts` scans every `.tsx` under `apps/web/app`, collects every `id="…"` the
application renders, and refuses any `href="#…"` whose target is not among them. A second assertion
refuses the empty fragment `href="#"`, which navigates to the top of the page rather than anywhere.

**And a vacuity floor**, for the reason the SQL suites give: a scan that matched nothing would pass
for ever. It asserts it found fragments and ids to check before checking them.

**The weakness, admitted rather than hidden.** The check is not per-page. Proving that `#compare`
renders on the same page as the link to it would mean resolving the component tree, and a test that
has to render every route to check a link is a test nobody runs. So a link pointing at an id that
exists on a *different* page still passes. That hole is real and much smaller than the one it
replaces: all three shipped bugs pointed at an id that existed **nowhere**.

Running it over the merged tree found the rest of the site clean — the six connector pages and
`/pricing` carry seven more fragment links and every one resolves.

## 5. Cost estimate

**Per connected account per month:** `N/A — no data-plane work.` Three href strings and a static
scan. No platform call, no table, no scheduled work.

## 6. Platform-terms check

Gates 1–17: `N/A` — no credential, no platform call, no tenancy surface, no table, no quota, no
dependency.

**18. Claim provenance.** `PASS`. No copy changed: `SITE.ctaPrimary`, `CTA_LABEL` and
`HELP_LINK_LABEL` are untouched, and the buttons say exactly what they said before. What changed is
where they go.

**Result:** `1 PASS, 17 N/A, 0 FAIL`

## 7. Mutation testing

| Mutation | Result |
|---|---|
| restore `href="#start"` on the hero | *every one points at an id this application actually renders* — reports `page.tsx:134 -> #start` |
| change the closing panel's link to `href="#"` | two red: the same test, and *none is the empty fragment* |

Both reverted. `apps/web` **376 tests**, up from 373.

The failure message names the file, the line and the target, because a guard that says only "a link
is broken" sends the next person scanning nine files by hand.

## 8. What was left out

**No per-page resolution**, as §4 sets out.

**Nothing checks internal `href="/…"` links against the route table.** A link to `/help` — a route
that does not exist — would 404 loudly rather than silently, so it is a smaller problem than this
one, and catching it needs the route manifest rather than a text scan. Worth doing; not this PR.

**The pricing page's plan buttons were not touched** because they were not broken. Only the home
page's pricing *section* carried the dead link.
