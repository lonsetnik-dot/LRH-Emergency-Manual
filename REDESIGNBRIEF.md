# Redesign brief — CairnReady Emergency Manual

**This is the prompt.** Paste it, or point Claude Code at this file, at the start
of the effort. `PRODUCT.md` and `DESIGN.md` sit beside it and are the durable
context; this file is the work order.

---

## The request

Rebuild the visual and structural layer of the CairnReady Emergency Manual so the
whole system reads as one product. Keep every word of clinical content, every
clinical value, every verification suite, and the offline build architecture.
Replace the chrome, the token layer, and the card-interior vocabulary — and add
the tests that stop them drifting again.

**Mode: Operate.** Read `Operate mode depth` in the Impeccable guide before
anything else, and hold it above the "go all out, dream big and bold" framing in
the guide's opening. That framing is written for surfaces where design is the
product. Here the product is a clinician finding a dose in four seconds during a
resuscitation. The bar is **earned familiarity**, and the tool should disappear
into the task. Strangeness without purpose is the failure mode, not flatness.

**This is a redesign, not a refinement.** Per the guide's own rule: preserve
product truth, content, function, native affordances, and constraints; treat the
old look as evidence and anti-reference; do not split the difference into polish
on the discarded look. `DESIGN.md` is the committed world. Build to it.

---

## Read before acting

1. `PRODUCT.md` — who this serves and what it may not do.
2. `DESIGN.md` — the committed visual world and the sixteen settled decisions.
   **§12 (frozen identifiers) before you touch anything.**
3. `CLAUDE.md` — the golden rules. **These outrank `DESIGN.md`.** If a design
   decision would break offline operation, expose PHI, hardcode a clinical value,
   or duplicate content, the design decision is wrong and you stop and say so.
4. `CASE-STATE.md` — the storage contract shared across tools.
5. `build.mjs` **and `demo-build.mjs`** — both read the shared stylesheets and
   scripts at module scope. Any change to a sheet's existence or name must be
   made in both, in the same commit.
6. `run-tests.sh` and the existing suites: **41 `verify_*.mjs` plus
   `verify_qr_decode.py`**, run separately.

Then run `shape` and produce a plan. Do not begin implementation from this brief
alone.

---

## Hard boundaries

Violating any of these fails the work regardless of how it looks.

- **No external request, ever.** No CDN, no `fonts.googleapis.com`, no fetch, no
  beacon. `Source Sans 3` and `JetBrains Mono` cannot ship; the system stack and
  IBM Plex Mono are the permanent answer.
- **No PHI.** Case state is device-local, cleared by RESET and by inactivity.
- **No clinical value is written into the interface.** Doses, energies, cadences,
  and thresholds are read from SITE CONFIG. If a rebuild would move a number into
  markup, stop.
- **Content has exactly one home.** Transclude, inject, or link. Never paste.
- **Frozen identifiers are frozen.** `DESIGN.md` §12: element IDs and card
  anchors, `{{PROC:}}` section heading text, `{{SHARE:}}` block constraints,
  Broselow band hex values, kit item strings, `lrh-case-*` keys. Changing one is
  a stop, not a judgment call. Printed QR codes on carts point at these anchors.
- **A medical conflict is a stop, not a note.** Halt and escalate with
  `AskUserQuestion`.
- **The existing suites stay green.** Three need deliberate rewriting
  (`verify_shell_parity.mjs`, `verify_peds_shell.mjs`, `verify_poster_pages.mjs`)
  because they assert the old chrome or the old page geometry. Rewrite them to
  assert the new contract. Never delete or silence a suite to make a migration
  pass.

---

## Phase plan

Sequenced by clinical risk, lowest first. **Each phase ends with the full harness
green and a deployable state.** No phase begins before the previous one is
merged.

> **Do not delete `design-system-live.css` before Phase 5.** `build.mjs:19` and
> `demo-build.mjs` read it at module scope — deleting it is an unhandled `ENOENT`
> on the next build. Its marker is still live in all five case engines, and
> `build.mjs` fails the build on any un-injected marker. It also contains **22
> selectors that exist nowhere else** (`.acc`, `.accb`, `.sec`, `.wrap`, `.evrow`,
> `.due`, `.dot`, `.plabel`, `#caseclock`, `#customlog`, `#donesum`, `#logtoggle`,
> plus `html` / `body` / `button` / `input` resets). Deleting it is not
> subtraction; those selectors must be ported first.

### Phase 0 — Foundation and ratchet

No page is migrated. Nothing is deleted.

1. Build `design-system.css` (base): tokens, two-row bar, card-interior
   primitives, focus states, print palette, motion. **Added alongside the three
   existing sheets, which keep working.**
2. Build `design-system-shell.css` (add-on): operational layers only — cadence,
   metronome, dock, picker, toast. **Zero selector overlap with base.**
3. Draw the composite cairn back mark on the `0 0 48 48` grid. One shared source,
   injected at a marker.
4. **Write the new verify suites before migrating anything.** They must fail
   against the current codebase — a test that has never been red is not a test.
   Land them red-but-skipped, or gated to migrated paths, so Phase 0 still ships
   green.

New suites required:

| Suite | Asserts | Notes on writing it honestly |
|---|---|---|
| `verify_tokens.mjs` | No raw hex, radius, or spacing literal in authored page-local `<style>`. | Exempt Broselow band values and SITE CONFIG data. |
| `verify_breakpoints.mjs` | Exactly `600px`, `760px`, `print`, `prefers-reduced-motion`. | **Must parse media features only.** `max-width: 1400px` and `min-width: 44px` as CSS properties are required by `DESIGN.md` and are not breakpoints. |
| `verify_chrome.mjs` | One two-row bar on every page. Row 1 never wraps; nothing under 44px. | |
| `verify_backmark.mjs` | The composite mark on every page including poster leaves. `◀`, `&#9664;`, `‹` appear zero times. | 40 occurrences to remove. |
| `verify_focus.mjs` | Every interactive element resolves to a visible focus outline. | `:focus-visible` does not reliably match a programmatic `.focus()` in Chromium, and a pure CSS scan is gamed by a later `outline:none` winning on specificity. **Implement as a computed-style cascade resolution per element, and assert no rule sets `outline:none` without a replacement.** If this cannot be made honest, say so rather than shipping a green lie. |
| `verify_targets.mjs` | Per-class floors attached to selectors that match real elements, at both widths. | Must fail a floor declared on a selector with no matching node — that is the current bug. |
| `verify_aria.mjs` | Every **scripted** disclosure exposes `aria-expanded`. Every icon-only control has an accessible name. | **Native `<details>` is excluded** — it already exposes state, and a static `aria-expanded` on it is a stale, wrong value. ~470 native, a much smaller scripted set. |
| `verify_color_authority.mjs` | No category token as a fill. No severity token as a `border-left`. | |
| `verify_no_inline_style.mjs` | Zero authored `style=` attributes carrying visual properties. No selector matches an inline attribute's text. | **Source-text check over authored markup only, never a DOM check.** ~510 runtime `.style` writes carry live state and are exempt. `setAttribute('style', …)` is itself a violation. |
| `verify_print.mjs` | Every printing surface inherits the base print palette and `print-color-adjust: exact`. No page defines its own print colors. | 19 blocks across 14 files to remove. |
| `verify_sheet_isolation.mjs` | Base and shell share zero selectors. | |
| `verify_anchors.mjs` | **Every QR destination and every cross-tool `?from=…#anchor` resolves to a live element in `dist/`.** | New, and the single most important addition — the existing QR suites check that a code *decodes*, not that its target *exists*. Printed labels on carts depend on this. |
| `verify_stamp.mjs` | Every tool carries a version and a last-reviewed date. | **Fails until a human supplies the date.** An agent must never invent one — that would be a false clinical-review claim on a bedside instrument. |

Wire Impeccable's detector into CI as a required check alongside these.
Suppressions carry written reasons in `.impeccable/config.json`, in the style of
the entries already there.

### Phase 1 — Print surfaces (11 pages, zero case state)

`labels/` and the ten poster leaves. The most-drifted files in the repo and the
least able to hurt anyone. They prove the token layer and the back mark.

Each gains a back-to-manual control it does not currently have.

> **The real risk here is pagination, not CSS.** `verify_poster_pages.mjs`
> measures each `.sheet` against a fixed print box and will fail if the new
> chrome or spacing rhythm adds vertical height. The back control is
> **screen-only** on print surfaces. Re-run that suite per poster.

`verify_kit_consistency.mjs` is **not** a blocker here — it matches item-name
substrings and drawer words as raw text and is indifferent to markup. Anti-goal 1
already protects it.

### Phase 2 — Static reference and the home hub (11 pages)

`system/`, `sources/`, `conversations/`, `debrief/`, `posters/index`,
`clinical-pathways/` (index + 4 leaves), and **`index.html` — the home hub,
redesigned**.

The hub is not a migration. Replace the eight equal icon-plus-heading-plus-text
cards with a hierarchy reflecting real ED frequency and urgency. Cards are not
the page structure; nested cards do not appear. Run `shape` on this screen
specifically before building it, and confirm the ordering with a clinician — how
an ED actually reaches for these tools is a clinical judgment, not a design one.

### Phase 3 — Card tools (5 pages)

`procedures/`, `simulations/`, `equipment-readiness/`, `trauma/`, `vems/`.

First contact with the card-interior vocabulary — though the volume is modest
here (**36 inline `<h2>` titles** across these five; `equipment-readiness/` and
`vems/` have none). The bulk arrives in Phase 4.

Fix the three tools whose target floors are dead CSS — but see `DESIGN.md` §5:
**deciding which controls belong in `.console` is a clinical classification.
Stop and ask per tool.**

> **`procedures/` is a transclusion producer.** `codes/`, `peds/`,
> `ob-neonatal/`, and `tca/` transclude from it by parsing its markup structure.
> Section heading text and `<article id="cNN">` anchors are frozen. Verify the
> `{{PROC:}}` manifest resolves after every commit in this phase.

### Phase 4 — Shared case state (3 pages)

`codes/`, `peds/`, `ob-neonatal/`.

**This is the real volume phase, not Phase 3.** `codes/` alone carries ~2,080
inline `style=` attributes and 34 inline card titles; `peds/` adds 15. Budget
accordingly, and consider splitting `codes/` into its own sub-phase.

These carry the weight control and the timeline; the chip strip takes over both.
`verify_shell_parity.mjs` is rewritten here, deliberately, to assert the new
contract — it exists because one patient's weight once had two interfaces, and
that reason still holds.

Remove the dead `case-shell.js` injection: 18KB on each of five pages that have
no `data-opcard` and never call it.

### Phase 5 — Live engines (5 pages)

`airway/`, `arrest/`, `neonatal/`, `pph/`, `dystocia/`.

Highest risk, done last, when the vocabulary is proven everywhere else. These are
already the cleanest consumers — `arrest/` has 9 lines of local CSS — so the diff
is mostly chrome.

The operational layers move from chrome to in-page components. Behavior does not
change: the metronome still auto-pauses 10s on a rhythm check, dock slot colors
keep their meanings, timers still ride the buttons that satisfy them.

The Broselow dynamic accent, currently firing on one page, applies everywhere a
weight under 50kg is set — **with focus outlines decoupled from `--accent`**
(`DESIGN.md` §1). Do not touch the band hex values.

**End of Phase 5, and only here:** port the 22 orphan selectors out of
`design-system-live.css`, remove its marker from all five engines, delete the
file, and update `build.mjs` **and `demo-build.mjs`** in the same commit.

### Phase 5b — Theme, in one atomic change

Retiring `theme-boot.js` and switching selection to `prefers-color-scheme` is
repo-global and cannot be done per page: mid-migration, two pages on the same
device in the same case would disagree. One commit, every page, after the
per-page work is done. Retire `lrh-pref-theme` from the `CASE-STATE.md`
namespace.

### Phase 6 — `tca/` rebuilt

The worst outlier: no shared CSS, no app bar, no back link, no switcher, its own
`:root`. A finished TCA design artifact exists (`TCA_Cognitive_Aid.dc.html`) that
the code has never seen.

Rebuild to the artifact and the new system. Port it as designed — same words,
same flow, same structure. Deviations are proposals raised *before* building, per
golden rule 14.

### Phase 7 — `cairn/` outreach site

Aligned to the shared token layer and the cairn mark; its `--c-*` oklch namespace
retired. Note `build.mjs` skips this folder, so it can never receive an injected
sheet — its CSS stays page-local by construction, and acceptance criterion 5
excludes it.

### Phase 8 — Documentation

- Amend `DESIGN-SYSTEM.md`: the "colour encodes WHERE. Nothing else. Ever." rule
  is retired and replaced with the severity/category split. **Amend, do not
  override** — a document left contradicting the code is how this drift got
  normalized.
- Amend `SHELL.md`: two-row bar, absorbed layers, 760 not 768, theme follows the
  device (the "dark-only per PR #160" claim is false today and stays false).
- Amend `LAYOUT.md`: remove the self-declared failing state; the two-breakpoint
  rule is now tested.
- Amend **`LOCALIZING.md` and `LOCALIZATION-WORKSHEET.md`** — both list
  `--d1`–`--d6` as localizable fields. Retiring drawer color without touching
  these leaves exactly the prose-only contradiction this effort exists to end.
- Fix the `README.md` / `CLAUDE.md` repo-identity contradiction.
- Retire or rewrite `MIGRATION-PLAN.md`.
- Archive the six dated audit artifacts to `docs/archive/`.
- Point `design/README.md` at `DESIGN.md` as the current authority.

---

## Acceptance criteria

Done when every one is true **and asserted by a test**:

1. No raw hex, radius, or spacing literal in authored page-local CSS, outside the
   frozen-data exemptions.
2. Exactly two media-feature breakpoints repo-wide, plus print and reduced-motion.
3. One chrome implementation on all pages. Currently eight.
4. One back mark. `◀`, `&#9664;`, `‹` appear zero times.
5. **Authored page-local CSS under 250 lines total, excluding `cairn/` (which the
   build skips and cannot receive an injected sheet) and excluding poster/label
   `@page` geometry.** The comparable figure today is roughly 2,540 lines.
6. Base and shell sheets share zero selectors.
7. Every interactive element resolves to a visible focus outline, including shell
   controls.
8. Every **scripted** disclosure exposes `aria-expanded`. Native `<details>` is
   left alone.
9. Every target-size floor is attached to a selector that matches a real element.
10. `print-color-adjust: exact` on every printing surface. Two of twenty screen
    tools have it today.
11. No category token used as a fill; no severity token used as a left border.
12. Zero authored `style=` attributes carrying visual properties. Runtime `.style`
    writes untouched.
13. Contrast verified at 4.5:1 / 3:1 in **both** themes, with focus outlines
    verified against the fixed `--focus` token rather than the runtime accent.
14. Every tool carries a version and a human-supplied last-reviewed date.
15. All existing suites green; the three rewritten ones assert the new contract.
16. Every QR destination and cross-tool anchor resolves in `dist/`.
17. Impeccable's detector clean, or suppressed with a written reason.

---

## Anti-goals

Every one of these has already happened in this repo at least once.

- **Do not restructure clinical content.** Words, order, thresholds, and citations
  are reviewed. This is a rebuild of how they are presented.
- **Do not rename an anchor, an id, a shared-block key, or a Broselow hex.**
  Physical artifacts depend on them.
- **Do not invent affordances.** A locum on a night shift must not have to learn
  anything to leave a screen or find a dose.
- **Do not add a breakpoint** because a layout is awkward at some width. Fix the
  layout.
- **Do not solve a spacing problem with a one-off class.** Change the primitive.
- **Do not add motion.** Two authored moments exist.
- **Do not add decoration.** No sparklines, progress rings, gradient text, glass,
  or shadowed rectangles standing in for content.
- **Do not silence a failing test to land a migration.** A red suite is
  information.
- **Do not write a test that cannot fail.** If an assertion cannot be made honest,
  say so instead of shipping green.
- **Do not leave a document contradicting the code.** `LAYOUT.md` is the proof of
  what that costs.
- **Do not batch phases.** Merge each one green before starting the next.

---

## Verification

Impeccable's rule: bounded passes, not an open loop. Build the phase fully,
inspect once in a batched round covering phone and ≥760px together, fix
everything that round shows in one batch, confirm with at most one more round,
then stop.

Three things need a human and cannot be tested:

1. **Glyph discriminability at 2 m and at 16px.** Location now rides on glyphs.
   Review the set once, on a real device at real distance.
2. **The home hub hierarchy**, and **which controls belong in `.console`** — both
   clinical judgments handed to a person, not an agent.
3. **Both themes on a real screen in a real room** — bright bay, dim night shift.

Netlify deploy previews are 401-gated and cannot be fetched by an agent.
Verification runs against a local `dist/` build.
