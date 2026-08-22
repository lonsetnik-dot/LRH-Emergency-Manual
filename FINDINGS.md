# Findings

Observations from the redesign run that do **not** block work. Nothing here is a
decision waiting on Lon — those are in `BLOCKED.md`. Nothing here was acted on
beyond what the phase it sits in already required; `EXECUTION-BRIEF.md` §4 forbids
"while I was in here" fixes, so an unfixed finding is the correct output.

Ordered by how much it matters, not by when it was found.

---

## [F-01] `main` is shipping a stylesheet that removed 74 selectors the pages still use — **URGENT**

`design-system.css` v0.2.0 landed on `main` by upload (`dc77e2e`, merged in
`565589a`) and it is not an addition — it is a **replacement**. Normalizing both
files' selector lists and diffing them, v0.2.0 dropped 74 selectors that the
eighteen pages carrying `/* @design-system */` use right now:

| Removed | Occurrences in authored pages | What it is |
|---|---|---|
| `.t-ck` | 1,785 | the checklist row |
| `.t-div` | 1,501 | the row divider |
| `.t-head*` (7 variants) | 577 | every card heading |
| `.t-box*` (4 variants) | 293 | every callout |
| `.lrh-row` | 146 | the tappable index row — the 4px category bar |
| `.lrh-mono` | 136 | mono numerals |
| `.hdr` and its children | 111 | **the app bar itself** |
| `.t-sub`, `.t-foot`, `.lrh-filter`, `.logit`, `.lrh-menuwrap`, `.reviewedbar`, `.lrh-startnew-btn`, `.acch`, `[data-logevent]` | ~250 | search, log controls, menus, review banner |
| `body[data-theme]` / `body[data-theme="light"]` | — | **the entire theme mechanism** |

`REDESIGN-BRIEF.md` Phase 0 step 1 says the base sheet is *"added alongside the
three existing sheets, which keep working."* Today it replaced one of them and
they do not. The consequence is not cosmetic: `theme-boot.js` still writes
`data-theme` on `<body>` and nothing reads it any more, so the light-theme
palette is unreachable on every card tool, and `verify_accessibility.mjs`'s
token-contrast check parses for exactly those two blocks and finds neither.

**This is on production.** `main` is what `lrhemergencymanual.net` serves and
these commits are merged into it. Nothing in the repo can confirm what the live
site looks like — per `CLAUDE.md`, the deployment is not knowable from the files —
but the built `dist/` is unambiguous about what was published.

**Handled, not merely noted:** Phase 0's first commit restores the removed
vocabulary into the same sheet, alongside v0.2.0's new vocabulary, which is what
"added alongside" asks for applied within one file. Each page then drops its old
classes as it migrates, and the old block shrinks to nothing by the end of
Phase 5. Getting back to green had to come first because nothing can be committed
until it does.

---

## [F-02] `verify_accessibility.mjs` check 7 was reading a stylesheet shape that no longer exists

Lines 80–81 match `body[data-theme] { … }` and `body[data-theme="light"] { … }`
against `design-system.css`. Against v0.2.0 both matches return `''`, so
`themeTokens('')` returns `{}` and the check reports `FAIL 7. dark theme defines
the shared tokens`.

It failing is the *good* outcome and the reason F-01 was caught at all. Worth
recording anyway, because it is one edit away from the bad one: had the check
been written as `if (!t.bg) continue;` before the "defines the shared tokens"
assertion rather than after it, the entire contrast check — the only automated
enforcement of the 4.5:1 floor in both themes — would have iterated over zero
pairs and passed green while the light palette was unreachable.

The suite is on the list to be rewritten anyway when Phase 5b moves selection to
`prefers-color-scheme`; the fix is to parse `:root` and the
`@media (prefers-color-scheme: light)` block, and to **fail when either block is
empty** rather than skipping.

---

## [F-03] `verify_issues_20260809.mjs` claims two issues it does not test, and tests one it does not claim

`PARKED-WORK.md` names #30. The audit found it is two, and one in the other
direction:

- **#30 (DSED / vector change)** — header claims it; `rvf|refractory|vector|dsed`
  appear zero times in the body. Already documented.
- **#31 (peds cart colour clarity)** — header claims it; nothing in the file
  asserts anything about the Broselow drawer chip. The section that looks like it
  might (`code cart: five drawers, bottom one deep`) is about the `codes/` cart
  infographic, a different artifact.
- **#36 (pacemaker / ICD)** — the header does **not** claim it, and the file
  contains a full `#36 pacemaker / ICD` section that does assert it.

An under-claim is harmless. An over-claim converts an open question into a false
green, which is what let #30's orphaned reference block read as shipped for two
weeks. Both over-claims are still over-claims: nothing was changed here, because
correcting the header without adding the assertions would only move the lie, and
adding the assertions is Phase 6b (#36) and parked work (#30, #31).

---

## [F-04] The content-invariance buckets are **sets**, so losing one of N identical occurrences is invisible

`verify_content_invariance.mjs` finishes every bucket with
`[...new Set(prose)].sort()`. A sentence that appears three times on a page and
twice after the rewrite is byte-identical as a set, and the compare says HELD.

Found by mutation-testing the baseline: deleting the first `href="https://…"`
match in `sources/index.html` — the canonical link, which appears twice — reported
HELD. Re-running against a citation that appears exactly once
(`https://jts.health.mil/index.cfm/PI_CPGs/cpgs`) correctly reported
`[FAIL] sources/index.html · urls   LOST`.

This is a real limit on the guarantee the whole sweep rests on, and it is worth
being precise about what remains true. It **cannot** miss the last copy of
anything — a sentence that leaves the page entirely is always caught. What it
misses is going from *n* copies to *n−1*, which for a repository governed by
golden rule 12 ("content has exactly one home") should not be a common shape, and
where it does occur — a transcluded row rendered twice on one page — the surviving
copy still says the right thing.

Not changed. Switching the buckets to multisets would be a change to the safety
net in the middle of relying on it, and it would light up on legitimate
de-duplication, which is a thing this sweep is supposed to do.

---

## [F-05] Two CLI tools are caught by `run-tests.sh`'s glob and fail on a healthy repo

`run-tests.sh` globs `verify_*.mjs` and runs each with no arguments. Two of the
files matching that glob are not suites:

- **`verify_content_invariance.mjs`** — a snapshot/compare tool. With no
  arguments it printed usage and exited 2.
- **`verify_verb_grammar.mjs`** — a corpus scanner taking `<file|dir>`. Same
  shape, same exit.

Both reported `!! FAILED` on a completely healthy repository, which is worse than
noise: a harness that cries wolf twice teaches that a red line is normal, at the
moment the harness is the only thing protecting a bedside instrument.

**Handled in Phase 0**, because nothing could be committed until the harness was
green. Each got a default mode, and in both cases the *obvious* default would
have been the dangerous one.

`verify_content_invariance.mjs` with no arguments now snapshots the built `dist/`
and compares it against `content-before.json` in restyle mode — the round-trip
proof, re-run on every harness run, so a lost sentence surfaces on the commit
that loses it rather than five commits later. **After an approved distill pass
the baseline must be re-taken by hand**, or the harness reports the approved cuts
as lost prose. That is written into the file's header, and it is deliberately not
automatic: a baseline that moves on its own proves nothing.

`verify_verb_grammar.mjs` was the more interesting one, because the obvious
default would have produced a suite that could not fail. It matches `<li class="check">`, the v0.2.0 checklist
row. Every row in the manual today is a `.t-ck`. A naive "scan `dist/`" default
would have found **zero rows, zero problems, and printed PASSED** over 1,785
unexamined checklist rows — green, permanently, until the last page migrated.

So its default is gated to migrated pages, with membership derived from the
rendered markup (a `.checklist` container or a `.check` row) rather than from a
declared flag, per golden rule 13's "never scope a check by the field it is
checking." Three things follow: the gate's width prints on every run (`3 of 39`
today — the three `.reference.html` exemplars, which are real pages in `dist/`
and really are being checked), it widens by itself as pages migrate, and a page
carrying the container with **no rows in it** fails — a migration that dropped
its content is the one failure a row-by-row scan cannot see, having no rows to
look at.

Both were mutation-tested before landing: a banned opener and an emptied
container each turn the verb-grammar suite red, and each mutation was reverted.

## [F-06] The reference implementation is not the file the brief names

`EXECUTION-BRIEF.md` lists `sources/index.html` under "Starter artifacts" as
*"the reference implementation. When unsure how a primitive is meant to be used,
read this page."* `sources/index.html` is unmodified and still on the old
vocabulary. The rewritten reference is `sources-index.reference.html` at the repo
root, and there are two more of the same kind: `dka-index.reference.html` and
`row-grammar.reference.html`.

Reading the wrong one would have taught the old vocabulary as the target. Nothing
changed; Phase 2 migrates `sources/index.html` and the reference file is the
thing to migrate it *to*.

---

## [F-07] The reference implementation carries authored inline `style=` attributes

Acceptance criterion 12 is *"zero authored `style=` attributes carrying visual
properties"*, and `DESIGN.md` §11 scopes the exemption to runtime `.style` writes.
`sources-index.reference.html` — the proven exemplar — contains
`style="margin:var(--sp-3) 0 0"` on a static `<p class="card-sub">`, plus several
inside JS template strings (`style="flex:1;min-width:0"`,
`style="padding:var(--sp-3)"`, `style="color:var(--teal-tx)"`).

They are token-valued rather than raw literals, so they do not violate the
*colour* rule, and the ones inside template strings are generated markup rather
than authored markup. But `verify_no_inline_style.mjs` is specified as a
**source-text check over authored markup**, and a source-text check cannot tell a
template string from a document. Two honest readings:

1. The suite scans only markup outside `<script>`, and the one static instance in
   the reference becomes a class.
2. The suite scans everything and the reference is amended.

Reading 1 is narrower and matches the wording of `DESIGN.md` §11 ("authored
markup"), so Phase 0 writes it that way — and the one static instance is still a
violation under it. Recorded rather than parked because it does not change what
gets built, only what the suite is pointed at.

---

## [F-08] Impeccable is not installed in this environment

There is no `shape`, `critique`, `audit` or `polish` command available — only
`ImpeccableDesignGuide.md`, whose own opening says it is *"a design reviewer's
standards and checklist, not a set of tool commands to execute."* `PLAN.md` was
therefore written by hand against the guide's Shape contract, whose stated
fallback is exactly this case.

The same applies to `REDESIGN-BRIEF.md`'s *"wire Impeccable's detector into CI as
a required check"* (Phase 0) and acceptance criterion 17. There is no detector
binary here to wire. `.impeccable/config.json` and its suppressions are present
and were read; the widened side-stripe suppression `DESIGN.md` §13 calls for can
still be written, but nothing in this environment can run the check that
suppression applies to.

---

## [F-09] Two governing documents are duplicated at the repo root

`EXECUTIONBRIEF.md` is byte-identical to `EXECUTION-BRIEF.md`.
`REDESIGNBRIEF.md` is an earlier, shorter version of `REDESIGN-BRIEF.md` (330
lines against 468) — not a duplicate, a **stale fork**, which is worse: a future
session that opens the un-hyphenated one gets a different work order.

Both arrived in the same upload. Not deleted — `EXECUTION-BRIEF.md` §4 forbids
reorganizing files, and deleting a governing document unattended is not a call to
make on inference. Phase 8 is the place for it.
