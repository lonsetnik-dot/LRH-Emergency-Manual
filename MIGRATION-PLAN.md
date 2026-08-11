# LRH Emergency Manual — Design-Language Migration Plan

> Approved implementation plan for completing the design-language migration.
> Captured here so it travels with the repo (e.g. a cloud session can execute it).
> This is a UI/skin migration only — **no clinical content, dose math, thresholds,
> or shared-state contract changes.**

## Context

The site's new design language (from the `design_handoff_vf_cognitive_aid` handoff)
is only **partially applied**, and stopped before the hardest parts. Today:

- **Two token systems coexist.** Most tools (`codes`, `procedures`, `peds`,
  `ob-neonatal`, `trauma`, home hub, `debrief`, `system`, `labels`) use prefixed
  `--lrh-*` CSS variables; only `arrest/` and `airway/` use the intended
  unprefixed set (`--bg/--card/--ink/--accent`). `clinical-pathways/heart/` is a
  third, older brand scheme (light-only, no dark mode).
- **The old chrome was never removed.** On the tool pages a *new* sticky header
  (`.lrh-hdr`, e.g. "CODES & RESUSCITATION" + theme toggle) sits directly on top
  of the *old* three-bar stack (`◀ MANUAL / TIMELINE / RESET` nav + a separate
  WEIGHT row + the CODE RUNNING bar). The handoff's own migration note warns this
  exact state is "worse than before."

**Goal:** one consistent design system across every tool — the unprefixed token
set and a single focused header — retiring the old three-bar chrome and the
duplicate `--lrh-*` tokens, **without changing any clinical content or breaking
the live cardiac-arrest engine.**

## Decisions (confirmed with Lon)

- **Chrome = a simpler single sticky bar** (like `arrest/`+`airway/` already
  ship), NOT the two-row chip-strip from DESIGN_LANGUAGE.md §4. Live code screens
  keep their focused clock bar.
- **Pilot order = Procedures first** (it has no live case-state engine, so it is
  the safe place to lock the visual pattern), get sign-off, then roll the proven
  pattern to the live/complex tools.

## Key constraints (verified during exploration)

1. **Token migration is a mechanical de-prefix, values unchanged:** `--lrh-bg`→
   `--bg`, `--lrh-card(2)`→`--card(2)`, `--lrh-ink(2)`→`--ink(2)`, `--lrh-line`→
   `--line`, `--lrh-accent`→`--accent`, `--lrh-red/amber/blue/green/gray`→
   unprefixed. Also carry `--accentInk/--sans/--mono` and keep category
   `--purple/--teal/--orange` (the home hub uses them). Canonical values live in
   `arrest/index.html` `:root` (dark) + `body[data-theme="light"]`.
   - **CRITICAL:** rename only the CSS custom-property `--lrh-` prefix. Do **not**
     touch the `lrh-case-*` / `lrh-pref-*` **localStorage keys** or card `data-k`
     ids — those are the cross-tool shared-state contract (`CASE-STATE.md`), and
     the RESET sweep keys off the `lrh-` *storage* prefix. Any rename regex must
     target `--lrh-`, never bare `lrh-`.

2. **Codes/peds live-engine coupling — restyle *around* it, do not rewrite.**
   Preserve these element ids and their load order:
   - `#stickytop` (a ResizeObserver writes its height into `--sticky-h` for
     in-page scroll offsets).
   - Weight: `#wtbar #wtkg #wtage #wtageunit #wtestimate #wtdisplay` (drive dose
     math, the pediatric trigger, and the Broselow chip).
   - Clock/metronome: `#headsup #huclock #hubeat #humetrotext #hucue`.
   - Timeline: `#summarybtn #summarymodal #summarybody #summaryclose #summarycopy`.
   - Reset: `#resetbtn #resetmodal #startnewcasebtn` — **the reset confirm-gate
     script must still load immediately after the nav and before any card
     markup**; its `stopImmediatePropagation` supersedes ~15 legacy per-card reset
     listeners, so moving it lets raw resets fire.
   - Arrest engine: `#arrestmodebar #arrestmodetext #arrestmodetoggle`, card
     `#c01`, and the `data-arrestmode` attribute on `#c01` that gates adult-vs-
     PALS dosing; Broselow chip `#brosechip…`.

3. **Chrome is copy-pasted per file** (no shared JS — "tools share a contract,
   not code"). Apply the new chrome per file. `procedures` has shell chrome only
   (no case state) → safest pilot. `codes` + `peds` carry the full live engine.

## Reference implementations to template from

- Tokens + single-bar chrome: `arrest/index.html`, `airway/index.html` (identical
  token blocks; `.hdr` sticky bar = eyebrow label + mono clock + status word +
  `.ghost` theme/reset buttons).
- Card interior (NAME/CLAIM/AIM strip, accordions, 4px left-bar identity):
  already present in `codes/` — align the others to match.

## Phased plan (each phase = its own PR, CI-gated, reviewed with light+dark screenshots)

- **Phase 0 — Merge PR #52 first** so the verify CI runs on every migration PR.
- **Phase 1 — Token unification (low risk, no layout change).** De-prefix
  `--lrh-*` → unprefixed across the old tools + home hub; migrate
  `clinical-pathways/heart/` onto the token set + dark mode; merge duplicate
  `:root`/`body[data-theme]` blocks into the one canonical set. Verify screenshots
  look identical; suite green. Files: `codes/`, `procedures/`, `peds/`,
  `ob-neonatal/`, `trauma/`, `debrief/`, `system/`, `labels/`, `index.html`,
  `clinical-pathways/(index|heart)/index.html`.
- **Phase 2 — New single-bar chrome, piloted on `procedures/`.** Replace the old
  three-bar stack with one focused sticky bar (back/label · title/breadcrumb ·
  theme toggle · reset), matching `arrest/airway`. Get Lon's sign-off on the look.
- **Phase 3 — Roll the chrome to the live/complex tools**, one PR each,
  preserving every id + load order in constraint #2: `codes` (highest care — run
  `verify_arrest_screen` + `verify_arrest_merge` + a manual arrest-flow / reset-
  gate / peds-mode check), then `peds`, `ob-neonatal`, `trauma`, `debrief`,
  `system`.
- **Phase 4 — Card interiors & page-type polish.** Make NAME/CLAIM/AIM strips,
  accordions, dose blocks, figures, and the 4px left-bar identity consistent;
  finish moving the home hub + category indexes fully onto the unified
  tokens/chrome; confirm print rules (force light tokens, open accordions).
- **Phase 5 — Live-protocol reconciliation.** Decide `arrest/` standalone vs
  `codes/#c01` (does codes card 01 link out to `arrest/`, or get the live-protocol
  design inline?) — open question for Lon at this phase. Bring any remaining live
  screens to the VF/VT pattern.
- **Phase 6 — Retire the old.** Delete dead `--lrh-*` aliases, old blue-band CSS,
  filled-tile styles. Final full-site screenshot pass (light+dark) + full suite +
  print check.

## Verification (every phase)

- Run the full verify suite: `bash run-tests.sh` (or the CI added in #52). Arrest
  changes must keep `verify_arrest_screen` (142) and `verify_arrest_merge` (41)
  green.
- Visual check: local server (`python3 -m http.server 8124`) + the in-app browser
  at `http://localhost:8124/<tool>/?from=home`, screenshot **light and dark**.
- Codes smoke test: start CPR → enter weight → confirm adult/PALS flips
  (`data-arrestmode`) → shock/epi/timeline log → RESET confirm-gate clears cleanly.
- Print check: print one card per tool; accordions open, colors survive.

## Out of scope / unchanged

No clinical content, dose math, thresholds, or the `lrh-case-*` / `lrh-pref-*` /
`data-k` state contract changes — this is UI/skin only.
