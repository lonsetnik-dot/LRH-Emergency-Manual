# State

Overwritten every time. This file is always current; `RUN-LOG.md` is the history.
If the run died unexpectedly, start here.

**Last updated:** 2026-08-22, during Phase 0.

---

## Read this first, before anything else in the repo

**`main` is shipping a broken stylesheet and has been since `dc77e2e` merged.**
`design-system.css` v0.2.0 replaced v0.1 instead of extending it and dropped 74
selectors that all eighteen card tools still use — every checklist row, every
card heading, every callout, the app bar, and the theme mechanism. Four verify
suites went red the moment it landed.

The fix is the first commit on `redesign/phase-0-foundation`. It restores the
removed rules verbatim in a new §8 of the same file, so unmigrated pages render
exactly as they did before and the section shrinks to nothing as pages migrate.

**Nothing in this repository can confirm what the live site is serving** — per
`CLAUDE.md`, that lives in Netlify and no test can reach it. What is certain is
what `dist/` contains.

---

## Where the run is

| | |
|---|---|
| **Phase** | 0 — Foundation and ratchet |
| **Branch** | `redesign/phase-0-foundation` |
| **Baseline** | `content-before.json` committed as `6e16e85`; round-trips clean |
| **Blocked items** | 0 |
| **Harness** | see below |

## What is green

Before any change this run made, six suites were red — four from the stylesheet
replacement, two because `run-tests.sh` globs two CLI tools that are not suites.
All six are addressed in Phase 0's first commit, and the full harness is re-run
before that commit lands. `RUN-LOG.md` carries the run-by-run detail.

`verify_tokens.mjs` is new and green, and was mutation-tested four ways.

## The next action, concretely

Phase 0 has four deliverables and the first is done. In order:

1. ~~Base sheet restored so the existing pages work~~ — done, with
   `verify_tokens.mjs` holding the one duplication it introduced.
2. **`design-system-shell.css` as an add-on** — cadence, metronome, dock,
   picker, toast, zero selector overlap with the base. Note the name is already
   taken: today's `design-system-shell.css` is the **old** `.shell*` chrome that
   `peds/` consumes, and `verify_shell_parity.mjs` asserts its shell block is
   byte-identical to the one inside `design-system-live.css`. It cannot be
   overwritten; the add-on is new content in the same file or a new marker, and
   which of those is a call to make when the layers are actually written.
3. **The cairn back mark**, one shared source injected at a marker. The drawing
   exists already — `sources-index.reference.html` carries it inline as a
   `<symbol id="cairn-back">` on the `0 0 48 48` grid, and the comment beside it
   says *"in production this is injected at a build marker, never pasted per
   page."* That is the file to lift it from.
4. **The remaining twelve Phase 0 suites**, red first and gated to migrated
   paths. `verify_tokens.mjs` exists and needs its page-local-literal half added.

Then Phase L, on its own branch, starting with the topology decision.

## How to resume from cold

```bash
git checkout redesign/phase-0-foundation
node build.mjs && bash run-tests.sh          # expect ALL GREEN
node verify_content_invariance.mjs           # expect CONTENT INVARIANCE HELD
```

Read `PLAN.md` for the shape of the work, `FINDINGS.md` for what is known and
unfixed, `BLOCKED.md` for anything waiting on a decision.

Do not `pkill -f run-tests.sh` — the pattern matches the shell the command is
running inside. Use `fuser -k -n tcp 8123` for a stuck server.
