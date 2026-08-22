# Execution brief — unattended run

**Paste this to start. Nobody is watching.** Lon has stepped away and may not
read anything you write for many hours. Behave accordingly: never wait for an
answer, never guess at one, and leave the repository in a state he can walk back
into and understand in five minutes.

---

## Your governing documents

Read all five before your first commit. They are the specification; this file is
only the operating contract.

| File | Owns |
|---|---|
| `PRODUCT.md` | Who this serves, what it may never do |
| `DESIGN.md` | The committed visual world; 16 settled decisions; **§12 frozen identifiers** |
| `LOCALIZATION.md` | 64 site-specific items across 3 risk tiers; **31 are safety-critical** |
| `REDESIGN-BRIEF.md` | The phase plan, the verify suites, the acceptance criteria |
| `PARKED-WORK.md` | What is deliberately not being built, and why |

`CLAUDE.md` outranks all of them. If a design instruction would break offline
operation, expose PHI, hardcode a clinical value, or duplicate content, the
design instruction is wrong.

---

## What this software is

A cognitive aid used during resuscitations in a rural emergency department. A
clinician reads a dose off it and gives that dose. Wrong output here is not a bug
report, it is a patient.

This single fact decides every judgment call you will make today: **when
uncertain, do less.** An unfinished phase is recoverable. A confidently wrong
number is not.

---

## The operating contract

### 1. Never guess. Park instead.

You will hit decisions you cannot make. When you do, **do not stop the run and do
not invent an answer.** Append to `BLOCKED.md`, then move to the next piece of
work that is not downstream of that decision.

Append in exactly this format:

```
## [B-nn] <short title>
- **Phase / file:** phase 3 — procedures/index.html:412
- **Decision needed:** Which controls belong in `.console` for this tool?
- **Why I can't make it:** `.console` membership sets a 44px floor that
  ACCESSIBILITY.md treats as "tapped during a resuscitation" — a clinical
  classification, not a styling choice.
- **Options as I see them:** (a) the four action buttons only; (b) those plus
  the two checklist toggles.
- **What I did instead:** left the existing markup untouched; migrated the rest
  of the file; this is the only remaining item.
- **Unblocks:** nothing else. Safe to answer any time.
```

Numbered `B-01` onward. One entry per decision, never a batch.

**Park, do not guess, when you hit any of these:**

- A clinical value's correct number is unclear
- A capability answer is needed (cath lab, platelets, trauma level, tele-services)
- A review date or a clinician attribution would have to be supplied
- `.console` membership for a tool
- The home hub's ordering by clinical frequency
- Anywhere `DESIGN.md` is ambiguous and two readings would produce different UI

### 2. Hard stops — halt that file, keep the run alive

Stop work **on the file**, log it in `BLOCKED.md` marked `HARD STOP`, and
continue elsewhere:

- **A medical conflict.** Any disagreement with an upstream guideline, or between
  two parts of the manual. Golden rule 15. Never reconcile one yourself.
- **A frozen identifier would have to change** — an element id, a card anchor, a
  `{{PROC:}}` section heading, a `{{SHARE:}}` block constraint, a Broselow band
  hex, a kit item string, an `lrh-case-*` key.
- **You would have to write a clinical value into a shipped path** to make
  something work.

### 3. Halt the entire run — these four only

Write a final summary in `RUN-LOG.md` and stop:

- `BLOCKED.md` reaches **15 entries.** That many unknowns means the plan is wrong
  and continuing generates work that will be redone.
- The build is broken and you cannot restore it within three attempts.
- Any change you are asked to make would weaken the offline guarantee or touch
  PHI handling.
- You cannot get the harness green at a phase boundary after three attempts.

Anything else: keep working.

### 4. Do exactly what is specified

The single biggest risk of an unattended run is a well-meaning agent improving
things nobody asked to improve.

- No refactors beyond the brief. No new features. No dependency changes.
- No "while I was in here" fixes. If you spot something, add it to
  `FINDINGS.md` — a separate file from `BLOCKED.md`, for observations that do not
  block you.
- Do not reorganize files, rename things, or change the build architecture beyond
  what `REDESIGN-BRIEF.md` states.
- Do not touch anything in `PARKED-WORK.md`.

### 5. Commit and branch discipline

- **Never commit to `main`. Never merge. Never force-push.**
- One branch per phase: `redesign/phase-0-foundation`,
  `redesign/phase-L-generic-base`, `redesign/phase-1-print`, and so on.
- Push the branch and open a **draft PR** when a phase reaches green. CI runs on
  it. Leave it for Lon to review and merge.
- Within a phase, **the localization commit lands separately from the visual
  commit, always.** A dose lost inside a two-thousand-line restyle is
  unreviewable. This is not negotiable and there is no exception for small files.
- Commit messages state what changed and why in plain sentences. If a commit
  makes a suite fail deliberately, say so in the message.

### 6. Verify continuously, not at the end

Before **every** commit: `node build.mjs`, then `bash run-tests.sh`. Green, or
you do not commit.

Do not batch a phase's work and test once at the end. A red suite five commits
back is an afternoon of bisecting that nobody is here to supervise.

New suites land **red first** — a test that has never failed is not a test. Land
them gated to migrated paths so the phase still ships green, and widen the gate
as pages migrate.

### 7. Leave a trail

Three files, at the repo root, updated as you go:

- **`RUN-LOG.md`** — append-only. What you did, in order, with timestamps and
  commit SHAs. Written for a person skimming it, not a machine parsing it.
- **`BLOCKED.md`** — the decision queue above.
- **`STATE.md`** — overwritten each time, always current. Which phase, what is
  green, what the next action is, and how to resume. If the run dies
  unexpectedly, this file is what makes the work recoverable.

---

## Before you change one character

```bash
node build.mjs
node verify_content_invariance.mjs snapshot dist content-before.json
git add content-before.json && git commit -m "Baseline content manifest before the redesign sweep"
```

**This is the first thing you do, and it cannot be recovered later.** The
snapshot is the only proof that the rewrite carried the medicine across
unchanged. Take it from the built `dist/`, not the source, so template tokens are
resolved. If a single page is rewritten before this exists, the baseline for that
page is gone and its content can never be verified.

Then confirm it is real: `git stash` any change, re-snapshot, and compare — a
clean tree must produce zero differences. A baseline that cannot round-trip is
worse than none, because it will read as green forever.

## The two passes

Every page goes through two passes with **different contracts**. Do not merge
them — the whole safety argument rests on the difference.

### Pass 1 — restyle

Rebuild the page against the design system. New chrome, new classes, new markup,
new layout. **The words do not change at all.**

`verify_content_invariance.mjs` runs in its default mode, where prose is
blocking. Zero prose differences or the pass fails. This is what lets you rewrite
thirty-seven pages unattended without anyone reviewing each one: the check proves
the medicine came across, rather than a person hoping it did.

A legitimate change — a version stamp, a localization stripped to `NOT SET` —
goes in `content-exceptions.json` with a written reason. Declared is fine.
Silent is never fine.

### Pass 2 — distill

Cut the text. Target roughly **half the current word count**, per `DESIGN.md`
§12b. Run the check with `--distill`: numbers, citations and configured values
stay blocking, prose drops to reporting, and every removed sentence is written to
`CUTS.md` as a checklist for Lon to approve.

So a distiller can shorten an explanation and **cannot** drop a dose, a
threshold, or a citation. Not because it is instructed not to — because the check
will not let it.

Two things the distiller does not touch, and these are judgment rather than
mechanism: **any caveat that changes what a clinician does**, and **disclaimers
or medico-legal text**. If a cut feels like either, leave it and note it in
`FINDINGS.md`.

`CUTS.md` is the whole review surface for the sweep. Keep it clean and readable —
it is the one file that will actually get read.

## Starter artifacts

These exist and are proven against `sources/`. Use them; do not rewrite them from
scratch.

- `design-system.css` — the base layer, v0.2.0
- `verify_content_invariance.mjs` — both modes
- `content-exceptions.json` — the declared-exception format, with two real entries
- `sources/index.html` — the reference implementation. When unsure how a
  primitive is meant to be used, read this page.

Its measured result, as the bar to hold: page-local CSS 50 → 13 lines, raw colour
values 4 → 0, media queries in the page 2 → 0, undersized targets 44 → 0,
`aria-expanded` 0 → 2, words 386 → 197, content invariance green.

## Order of work

Follow `REDESIGN-BRIEF.md`'s phases exactly. Two adjustments for unattended
running:

**Start with `shape`.** Run it, write the plan to `PLAN.md`, commit it, then
proceed without approval. Lon reviews `PLAN.md` alongside the work rather than
before it. If `shape` produces a plan that contradicts `DESIGN.md`, `DESIGN.md`
wins — note the discrepancy in `FINDINGS.md`.

**Then, before Phase 0:** audit every existing verify suite's header against its
actual assertions. `verify_issues_20260809.mjs` claims to cover issue #30 and
asserts nothing about it — which let an orphaned feature read as shipped for two
weeks. Any suite naming something it does not test goes in `FINDINGS.md`. Small,
mechanical, and it protects everything downstream.

Then: **Phase 0 → Phase L → Phases 1 through 8.**

Three folded issues, in their phases:

- **#28 and #29 (QR codes)** — Phase L step 8. The deliverable is *"the generator
  runs in `build.mjs`,"* not *"codes regenerated once."* `generate_qr_codes.py`
  is currently referenced by nothing and writes to `/tmp` for a human to paste
  back, while 61 label entries pair a tokenized caption with a pixel matrix baked
  against LRH's domain. Until the generator runs in the build, both issues reopen
  once per fork.
- **#36 (pacemaker card)** — the iconography pass. The card exists; the magnet
  glyph in `equipment-icons.js` reaches the label sheet but never the card
  heading. Inject it via the `/* @icons */` marker, never paste it.

---

## Realistic expectations for one day

**You will not finish.** Thirty-seven pages, roughly 2,500 lines of page-local
CSS, sixteen new verify suites, and a clinical extraction pass is not a day's
work. Do not compress phases to appear productive — compression is exactly how a
clinical value gets lost in a large diff.

What a good day looks like: Phase 0 complete and merged-ready. Phase L's
mechanical parts done and its decisions cleanly parked. Phase 1 underway or
finished. Every branch green. `BLOCKED.md` holding real questions with enough
context that Lon can answer them in one sitting.

**Stop at a green boundary.** If you are mid-file when you sense the run is
ending, finish that file, get it green, commit, and update `STATE.md`. Never
leave the tree in a state where the next session has to reconstruct your
intentions.

---

## The five things to re-read before you touch a clinical file

1. The generic base ships **no plausible defaults**. An unset Tier-1 value
   suppresses its dependent display. A hospital reading a confidently-rendered
   wrong dose is the failure mode this entire effort exists to prevent.
2. **Extraction moves a value; it never changes one.** Markup to config, byte for
   byte.
3. **Never invent** a dose, a location, a phone number, or a review date. An
   empty field is the correct output. An invented review date is a fabricated
   clinical credential.
4. **Frozen identifiers are frozen.** Printed QR codes on physical carts point at
   these anchors.
5. **The `-tx` tokens, the Broselow band array, and runtime `.style` writes are
   deliberate.** They look like drift. They are not. `DESIGN.md` §1 and §11.

---

## When you finish, or stop

Write a closing entry in `RUN-LOG.md` containing:

- Phases completed, with branch names and PR links
- What is green and what is not
- Every open `BLOCKED.md` item, restated in one line each, ordered by what
  unblocks the most work
- Anything in `FINDINGS.md` you think is urgent
- The single next action, stated concretely enough to start from cold

Do not summarize optimistically. If a phase is 60% done, say 60% and say which
40% remains. Lon is coming back to make decisions, and the only thing that makes
that fast is an honest account of where things actually stand.
