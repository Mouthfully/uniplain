# 96. The number that identified two documents

**PR:** #TBD &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. What this is, and the decision taken

Five design notes arriving with #80 were numbered 86 through 90. Five notes numbered 86 through 90
had merged while #80 was open. **Git merged it clean**, because ten different filenames sharing five
numbers is not a conflict — and a directory where `note 88` names two documents shipped.

The five that arrived second are renumbered to 91–95, their three internal cross-references are
corrected, and `scripts/check-design-notes.mjs` now refuses the collision.

**The decision: the number goes to whichever note reached `main` first, and the guard is the
deliverable rather than the renaming.** The renaming fixes today. Without the guard it recurs, and
the evidence that it recurs is not speculative:

| When | What collided | How it was caught |
|---|---|---|
| before today | two notes numbered `77` | never — both are still there, and one is cited by number |
| #73 | `77`, again, against #70 | by hand, minutes before merge |
| #75 | `86`, against #70's claim on 81–85 | by hand, minutes before merge |
| #80 | `86`–`90`, five at once | by hand, **after** the merge |

Four times, four different branches, and the one time it was caught late it was already on `main`.
That is a mechanism, not carelessness. The mechanism is that a branch reads the highest number on
`main` and the correct answer is the highest number **claimed by any open branch** — a fact no
branch can see from inside itself.

**The alternative considered and rejected: stop numbering the notes.** Dates or slugs would make
collisions impossible. They would also break every citation in every commit message and PR body in
this repository, which cite notes by number and nothing else, and the numbers carry a real signal —
reading 58 then 60 then 82 in order is reading the argument in the order it was made.

## 2. Cost estimate

**Per connected account per month:** `฿0 / $0 — no data-plane work.` Five file renames, three
sentence edits, one guard, one CI step. Nothing executable changed.

## 3. Platform-terms check

18 gates: **0 PASS, 18 N/A, 0 FAIL.** No executable change, no data path, no credential, no claim
published, no personal datum, no platform call. Gate 18 is worth one line even so: the renamed
documents publish nothing — they are internal design notes, and `check-brand` and
`forbidden-claims.test.ts` scan them exactly as before and still pass.

- [x] Every applicable gate is `PASS` or `N/A` with a reason.
- [x] No gate is `FAIL`.

## 4. What was left out

* **The two notes numbered 77.** Both are cited by number in merged commit messages, so renaming
  either one makes an existing citation wrong rather than ambiguous. They are grandfathered, and the
  guard would refuse them today — which is stated here so the exemption is visible rather than
  discovered. **Issue, not scope creep.** *(Not an exemption in the code: the guard has no
  allow-list, and the pair does not currently trip it because only one of them survived a rename
  earlier today. If the other returns, the guard fires and this paragraph is the answer.)*
* **Renumbering to close the gaps.** 91–95 leaves no hole, but a future abandoned branch will. Gaps
  are allowed on purpose: filling one renames a document somebody has already cited, which is the
  defect this note is about, performed deliberately.
* **Commit messages and PR bodies written before the merge.** They still say 86–90. They are
  history and are left alone; each renamed note carries a banner saying what it was called.

## 5. Open or unverified spec items this builds on

None. This depends on no platform, no library version, no statutory deadline and no setting anybody
has to confirm.

## 6. Verification

```
pnpm -r test                      # 0
pnpm exec biome lint .            # 0
pnpm exec biome format .          # 0
node scripts/check-*.mjs          # 0  — all ten, including the new one
```

### Mutation proof

Three mutations, three findings, each put back.

| Mutation | What the guard said |
|---|---|
| add a second note numbered 91 | `note 91 is also 91-a-colliding-note.md` — the defect itself |
| rename a note with `git mv` and leave the heading | `the filename says note 91 and the heading says note 86` |
| break the filename pattern so nothing matches | `only 0 numbered design notes were found… this guard is checking nothing` |

The third is the one worth keeping. A guard that enumerates a directory reports **PASS** when its
pattern stops matching, and a passing guard that checked nothing is worse than no guard at all —
it is the `registry.test.ts` lesson and the `captureLog` lesson in a third costume. The floor is
asserted before any comparison runs.

**And the guard's first run was wrong twice, in the guard rather than in the repository.** It
flagged `00-repo-map.md` and `00-recon-reports.md` as a collision — `00` is a phase-zero *prefix*
shared on purpose by two documents everything cites by name — and it flagged
`64-the-build-order.md` for opening `# 64 — ` with an em dash where most notes use a full stop. The
first is a real exemption, narrow and documented. The second was the guard legislating a house style
nobody wrote down; only the digits are compared now. Both fixed in the guard, because a guard that
makes the repository wrong to satisfy itself is a guard that gets deleted.
