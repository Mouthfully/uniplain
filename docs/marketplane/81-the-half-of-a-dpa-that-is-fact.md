# 81. The half of a DPA that is fact

**PR:** #70 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

A public sub-processor list at `/sub-processors`, derived from the record of processing and guarded
against it.

**Why this and not the agreement itself.** `claims.ts` already states the condition for the `dpa`
claim precisely: *"Click-through DPA with Article 28 terms and a public sub-processor list."* Two
things. One is legal drafting; the other is a statement of fact about what the software does. This
ships the second and leaves the first to counsel, and **`brand.dpaAvailable` stays `false`** — a test
asserts it, because the most tempting thing to do on the day this page ships is to decide half the
condition is close enough.

### 1.1 A claim I made and had not checked

Earlier in this work I wrote that *"until there is a DPA, a business customer cannot lawfully appoint
this company as its processor"*. That is a statement about Thai law, and I had taken it from a gap
list rather than from the statute — exactly the failure CLAUDE.md names, in the direction of
pessimism rather than optimism, which makes it no better.

Checked: **PDPA s.40 does require an agreement, and the duty sits with the controller.** The Act
provides that *"the Data Controller shall prepare an agreement between the parties to control the
activities carried out by the Data Processor to be in accordance with the Data Processor's
obligations"*
([Norton Rose Fulbright](https://www.nortonrosefulbright.com/en/knowledge/publications/e29d223d/overview-of-thailand-personal-data-protection-act-be2562-2019),
[Kennedys](https://www.kennedyslaw.com/en/thought-leadership/article/guidelines-on-key-compliance-requirements-for-the-personal-data-protection-act-in-thailand/)).

So the conclusion held, and the emphasis was wrong in a way that matters commercially: **the
obligation is the customer's, and what a vendor owes is the ability to enter one and the facts it
rests on.** An agreement that cannot name the providers behind the service is one no reviewer signs.
That is what makes this page a sale artefact rather than a compliance chore.

### 1.2 The guard found two real defects in the record of processing

Written expecting to confirm a list. It refused twice, and both were mine:

**Vercel was disclosed as a sub-processor and no processing activity named it.** The record had been
built table-first — every entry anchored to tables in `public` — so *processing that holds no row was
invisible to it*. Serving a signed-in page is processing: a request carries an address, a session
and a path, and it passes through a provider. **A record of processing that can only see storage is
a record of storage.** There is now a `serving-the-site` activity with `tables: []`.

**Vercel's description was 58 characters and the floor was 60.** The assertion looked arbitrary when
written and was not: "Hosts this website" is not a description a customer's counsel can check
anything against. It now says what actually passes through, which is session cookies and addresses
in transit.

### 1.3 What the page refuses to say

- **No notice period for a change.** A test bans "30 days", "advance notice", "we will notify". None
  exists, and a stated one is a commitment nothing keeps.
- **No location it does not know.** Three of the four providers have no region recorded here, and the
  page says so rather than writing a plausible one. A region in a disclosure a customer's counsel
  relies on is a retention period with a signature on it.
- **No agreement.** A section headed "What is not in place" says there is no DPA and no transfer
  instrument, and a test scans the rendered page for "dpa is available", "dpa on request" and
  "sign our dpa".

## 2. Cost estimate

**Per connected account per month:** N/A. A static page and a test. No data-plane work.

## 3. Platform-terms check

18 gates. **2 PASS, 16 N/A, 0 FAIL.**

Credential 1–3 `N/A`; 4 **`PASS`** — the page names no credential. Tenancy 5–9 `N/A`, static and
tenant-independent. Data movement 10 `N/A`; 11 `N/A`; 12 `N/A` no dependency. PII 13–15 `N/A`.
Access tier 16–17 `N/A`. Claims 18 **`PASS`** — the page makes no compliance claim, cites only
`no-pooling` and `no-training` through `optionalClaim`, and `brand.dpaAvailable` is unchanged.

## 4. What was left out

- **The agreement.** Legal drafting. Publishing text written here as though binding would be worse
  than none, and it is the single remaining blocker to a B2B sale.
- **A transfer instrument.** Same reason.
- **Notice-of-change machinery.** A DPA usually grants a right to object to a new sub-processor
  within a period. There is no mailing list and no period, so none is promised.
- **The host's own retention.** What Vercel keeps in its request logs is Vercel's retention and was
  not established, so the record says that rather than guessing.

## 5. Open or unverified spec items this builds on

- **Whether this entity is a processor for platform data at all** is stated on `/privacy` and rests
  on the same reasoning the record of processing uses. Counsel's call, unchanged.
- **The `dpa` claim stays withheld** and `brand.test.ts` keeps it that way. Turning it on requires
  the agreement to exist and the matching ban to be deleted in the same change.

## 6. Verification

Gate green by exit code including `pnpm -r build`. Web suite 502 → 513. `/sub-processors` and
`/sub-processors.md` read back over HTTP from a production build.

### Mutation proofs

| Mutation | Test that went red |
|---|---|
| An activity gains a recipient not on the list (`Datadog`) | `names no recipient in an activity that is not in the disclosed set` **and** `covers every activity that names a recipient` |
| `brand.dpaAvailable` flipped to `true` | `does not flip the brand fact` |

One process note worth keeping. Reverting the first mutation with `git checkout <file>` **discarded
the uncommitted `serving-the-site` activity** written minutes earlier, and the suite went green
again — for the wrong reason. Caught by grepping for the activity rather than trusting the green.
A revert that restores HEAD is not a revert of your mutation when your fix is also uncommitted.
