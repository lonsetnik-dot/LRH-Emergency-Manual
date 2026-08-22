# Plan — the redesign sweep

Written at the start of an unattended run, per `EXECUTION-BRIEF.md`: *"Start with
`shape`. Run it, write the plan to `PLAN.md`, commit it, then proceed without
approval."*

**How this was produced.** Impeccable is not installed in this environment —
there is no `shape` command to invoke, only `ImpeccableDesignGuide.md`, which is
explicit that the guide is *"a design reviewer's standards and checklist, not a
set of tool commands to execute."* So the brief below was written by hand against
the guide's own Shape contract (§ Shape, phases 1–3), which ends: *"When no human
or structured answer mechanism exists, mark assumptions plainly, return the
brief, and stop."* Every assumption is marked. Nothing here overrides `DESIGN.md`;
where the two could be read differently, `DESIGN.md` wins and the reading is
recorded in `FINDINGS.md`.

Shape's Phase 1 (discovery) is already answered — by `PRODUCT.md`, which was
written to Impeccable's `init` contract for exactly this purpose. Shape's Phase 2
(design direction) is already resolved — `DESIGN.md` is the committed world, with
sixteen decisions recorded so no session relitigates them. What remains is
Phase 3, the brief.

---

## The brief

### 1. Job and audience

A clinician in a rural emergency department, mid-resuscitation, glancing at a
phone held in one hand. The critical case is the **locum on a night shift who has
never opened this manual** — the reason novelty is a cost here and familiarity is
the bar. Secondary: the same content printed on a cart label at 2 m, and a
readiness champion at a desk.

### 2. Outcome and proof

The right next action and the correct dose for *this* patient, found in about
four seconds, without reading, searching or remembering. Proof is not visual: the
build is correct when a clinician acts correctly on first encounter, and when
every clinical string, number, citation and configured value survives the rewrite
byte for byte — which `verify_content_invariance.mjs` proves mechanically against
`content-before.json`, taken from `dist/` before any page was touched.

### 3. Selected direction

Settled, not chosen here. `DESIGN.md` §0 records sixteen decisions; the load-bearing
ones for this sweep are: the two-row bar (48px app bar + 34px chip strip, ~82px
total), the composite cairn back mark replacing three Unicode arrows across 40
occurrences, severity-owns-fills / category-owns-the-4px-left-bar, all eyebrows
deleted, theme following `prefers-color-scheme` with no toggle, exactly two
breakpoints, and base + shell sheets with zero selector overlap.

The measured bar is the rewritten `sources/` reference: page-local CSS 50 → 13
lines, raw colours 4 → 0, media queries 2 → 0, undersized targets 44 → 0,
`aria-expanded` 0 → 2, words 386 → 197.

### 4. Scope and boundaries

Thirty-seven authored pages plus `cairn/`. Two passes per page with **different
contracts** — restyle (words unchanged, prose blocking) then distill (~half the
words, numbers/citations/config still blocking). They never merge; the whole
safety argument is the difference between them.

Untouched: clinical content, the offline build architecture, every existing
verify suite except the three named for deliberate rewrite, and everything in
`PARKED-WORK.md`.

Anti-goals are enumerated in `REDESIGN-BRIEF.md` and not restated. The one worth
repeating on its own is: **do not ship a plausible default.** A generic base that
ships a sensible-looking pressor concentration is more dangerous than one that
ships nothing.

### 5. States and ranges

Real ranges, not decorative ones: 41 verify suites, ~2,540 lines of authored
page-local CSS, ~510 runtime `.style` writes (exempt), ~470 native `<details>`
(exempt from `aria-expanded`), ~2,080 inline `style=` attributes in `codes/`
alone, 61 QR matrices, 64 localization items across 3 risk tiers of which 31 are
safety-critical.

Material states per surface: unset weight (suppresses dependent doses — the
existing pattern the `NOT SET` mechanism generalizes), running case, logged row,
due row, offline/stale-shell, print, and both themes.

### 6. Interaction and layout

One chrome everywhere; a tool differs only in words, timers and doses. Section
jumps by anchor with `scroll-margin-top`, never `scrollIntoView`. Overlays escape
their container. One control per row — a checkbox *or* a log control, never both.
No interaction requires hover, drag, long-press or double-tap.

### 7. Constraints and open decisions

Binding: no external request of any kind; no PHI; no clinical value in markup;
content has exactly one home; frozen identifiers frozen; a medical conflict is a
stop.

**Decisions a builder must not invent** — these go to `BLOCKED.md` on contact,
not to judgment: `.console` membership per tool, the home-hub ordering, any
review date or clinician attribution, any unclear clinical value, any capability
answer, and any place two readings of `DESIGN.md` would produce different UI.

---

## Order of work

`REDESIGN-BRIEF.md`'s phases, unchanged, with the two adjustments the execution
brief names (start with this plan; audit suite headers before Phase 0).

| # | Phase | Branch | Content |
|---|---|---|---|
| — | Baseline | `redesign/phase-0-foundation` | `content-before.json`, committed. **Done.** |
| — | Header audit | same | Every suite's header against its assertions → `FINDINGS.md` |
| 0 | Foundation + ratchet | `redesign/phase-0-foundation` | Base sheet, shell add-on, cairn mark, 13 new suites red-first |
| L | Generic base | `redesign/phase-L-generic-base` | Topology, `NOT SET`, config schema, 3 named defects, attribution strip, identity leaks, QR generator in the build, 4 localization suites |
| 1 | Print surfaces | `redesign/phase-1-print` | `labels/` + 10 poster leaves |
| 2 | Static reference + hub | `redesign/phase-2-static` | 11 pages including the redesigned home hub |
| 3 | Card tools | `redesign/phase-3-cards` | `procedures/`, `simulations/`, `equipment-readiness/`, `trauma/`, `vems/` |
| 4 | Shared case state | `redesign/phase-4-case` | `codes/`, `peds/`, `ob-neonatal/` — the real volume |
| 5 | Live engines | `redesign/phase-5-engines` | 5 engines; `design-system-live.css` retired at the end |
| 5b | Theme | `redesign/phase-5b-theme` | One atomic commit, every page |
| 6 | `tca/` rebuilt | `redesign/phase-6-tca` | To the existing design artifact |
| 6b | Iconography | `redesign/phase-6b-icons` | Issue #36 |
| 7 | `cairn/` | `redesign/phase-7-cairn` | Token alignment |
| 8 | Documentation | `redesign/phase-8-docs` | Amend, never override |

Within every phase from 1 onward, **step one is that phase's localization
commit**, landing separately from any visual change to the same file.

## What changed in this plan versus the brief, and why

**Phase 0 has to start by repairing the foundation sheet, not only extending it.**
`design-system.css` v0.2.0 arrived by upload directly on `main` and the harness
is red on arrival — the accessibility suite's token-contrast check parses
`body[data-theme]` blocks that v0.2.0 no longer contains, and the sheet's own
`a { text-decoration: underline }` now underlines control-shaped links that
`verify_design_language.mjs` forbids. `REDESIGN-BRIEF.md` Phase 0 says the base
sheet is *"added alongside the three existing sheets, which keep working"*; today
it replaced one of them and they do not. Getting back to green is therefore the
first Phase 0 task, ahead of the new suites, because nothing can be committed
until it is. Detail in `FINDINGS.md`; the failure list is in `RUN-LOG.md`.

Nothing else departs from `REDESIGN-BRIEF.md`.
