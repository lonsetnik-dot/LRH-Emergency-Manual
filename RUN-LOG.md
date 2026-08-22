# Run log — the redesign sweep

Append-only. Written for a person skimming it. Times are UTC.

---

## 2026-08-22 · session opens

Read the five governing documents in full — `PRODUCT.md`, `DESIGN.md`,
`LOCALIZATION.md`, `REDESIGN-BRIEF.md`, `PARKED-WORK.md` — plus `CLAUDE.md`,
which outranks them, and the Impeccable guide's Operate-mode and Shape sections.

### 16:39 — the baseline, before touching anything

```
node build.mjs
node verify_content_invariance.mjs snapshot dist content-before.json
```

39 pages, 7,893 blocking items, taken from the **built** `dist/` so `{{SITE.*}}`
tokens, `{{PROC:}}` transclusions and injected shared files are already resolved.
Committed as `6e16e85`, before any other change, because it cannot be recovered
later.

Then proved it round-trips: clean tree → rebuild → re-snapshot → compare →
`CONTENT INVARIANCE HELD — 0 blocking differences, 0 advisory.`

A baseline that cannot round-trip reads as green forever, so it was also
mutation-tested in three directions, each reverted afterwards:

| Mutation | Result |
|---|---|
| `IV TXA 1 g over 10 min` → `2 g` in `codes/` | `[FAIL] codes/index.html · prose` — LOST and ADDED both named |
| deleted `Never clamp a bubbling drain` from `procedures/` | `[FAIL] procedures/index.html · prose   LOST` |
| removed a citation URL appearing exactly once | `[FAIL] sources/index.html · urls   LOST` |

The third attempt at that last one is worth recording because the first attempt
gave a **false pass** — see `FINDINGS.md` [F-04]. The buckets are sets, so
deleting one of two identical URLs changed nothing.

### 16:44 — the plan

Impeccable is not installed here, so `shape` was written by hand against the
guide's own Shape contract, whose stated fallback is exactly the no-human case.
`PLAN.md`.

### 16:45 — a full harness run, to know what "green" means today

Run before any change, on the tree as merged. **It is not green.** Details below.

### 16:50 — verify-suite header audit

Per `EXECUTION-BRIEF.md`, before Phase 0: every suite's header claims against its
actual assertions. Findings [F-02] and [F-03].

### 16:52 — the harness, before any change

```
=== 6 suites failed ===
verify_accessibility · verify_design_language · verify_logit · verify_rounded_cards
verify_content_invariance · verify_verb_grammar
```

Two distinct causes, and neither is anything this run did.

**Four of them are one bug.** `design-system.css` v0.2.0 arrived on `main` by
upload and **replaced** the v0.1 sheet rather than extending it, dropping 74
selectors that all eighteen `/* @design-system */` pages still use — 1,785 `.t-ck`
rows, 1,501 `.t-div` dividers, 577 `.t-head` headings, 293 `.t-box` callouts, 146
`.lrh-row` index rows, the `.hdr` app bar, the `.logit` pill, and the whole
`body[data-theme]` theme mechanism. `FINDINGS.md` [F-01]. This is on production.

**Two of them are not suites at all.** `run-tests.sh` globs `verify_*.mjs`;
`verify_content_invariance.mjs` and `verify_verb_grammar.mjs` are CLI tools that
exit 2 asking for arguments. `FINDINGS.md` [F-05].

### 17:05 — Phase 0, commit 1: restore the vocabulary

Everything below is on `redesign/phase-0-foundation`.

`design-system.css` gains **§8 LEGACY VOCABULARY**, the 74 removed rules restored
**v0.1 verbatim** — deliberately not rewritten, because verbatim is what makes it
provable that eighteen unmigrated pages look exactly as they did before, without
reviewing them by eye. The section only ever shrinks: a page that migrates stops
using these classes, and the last rule leaves with the last consumer, at the end
of Phase 5.

Three rules were *not* restored blindly:

- **`.pagefoot`** and **`a`** exist in v0.2.0 already. Restoring the v0.1 copies
  would have put them *later* in the file and silently overridden the new
  definitions on migrated pages — v0.1's `.pagefoot` uses `14px/10px 18px` where
  v0.2.0 uses the spacing scale. Dropped, with a comment saying so.
- **The theme block** could not be restored as-is either, but for a better
  reason: comparing the two sheets token by token showed v0.2.0 **did not change
  the palette at all**. Both palettes are byte-identical to v0.1; only the
  *selector* moved. So §8a re-adds `body[data-theme="light"]` and
  `body[data-theme="dark"]` as a bridge over the same values, and the media query
  stays as the no-JS default. A stored preference beats the device again, which
  is what `DESIGN.md` §7 requires until Phase 5b retires the toggle in one atomic
  commit.

The bridge duplicates 35 declarations, and golden rule 12 says a copy that must
exist gets a mechanism rather than a promise — so **`verify_tokens.mjs`** lands
with it and fails if the two blocks ever disagree, if either gains a token the
other lacks, if a token is defined only in a light block, or if the dark bridge
fails to restore something the light one overrides. Mutation-tested four ways;
each mutation went red and was reverted.

Two suites were repaired rather than restored:

- **`verify_accessibility.mjs`** check 7 parsed `body[data-theme]` blocks that no
  longer existed and returned `''` for both themes. Re-pointed at `:root` and the
  `prefers-color-scheme: light` block. The "defines the shared tokens" assertion
  deliberately stays **ahead** of its `continue`, or an empty block would read as
  a pass and the repo's only automated 4.5:1 guard would become a green lie.
  All 18 token pairs now measure between 4.56:1 and 16.80:1.
- **`verify_content_invariance.mjs`** and **`verify_verb_grammar.mjs`** got
  default modes. Both were the interesting kind of decision rather than a
  one-liner — see [F-05]; the verb-grammar default in particular had to be gated,
  because the obvious "scan everything" would have printed PASSED over 1,785 rows
  it cannot match.

