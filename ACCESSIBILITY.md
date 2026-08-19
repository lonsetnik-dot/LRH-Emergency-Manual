# ACCESSIBILITY.md — mobile UI/UX accessibility standard

Companion to `LAYOUT.md` (which owns the touch-target floor *values*) and
`DESIGN-SYSTEM.md` (which owns color). This file is the **normative mobile
accessibility standard for the CairnReady trunk**, and the map of which rules
are machine-enforced by `verify_accessibility.mjs` versus reviewed by humans.

These rules are **trunk invariants, not site config**. A hospital edition can
re-skin colors and localize thresholds; it cannot localize away zoom, target
sizes, or contrast floors — the verify suite is written to stay green across
localized values and to go red when an edition breaks an invariant, exactly
like the clinical invariants in CLAUDE.md ("Config-driven verification").

## The user this standard is written for

A clinician holding a phone **in one hand**, possibly **gloved**, under high
cognitive load, at a bedside with variable lighting, possibly in a wifi dead
zone, possibly with the phone locked to their hospital's enterprise settings
(no browser extensions, no user stylesheets). Several rules below are stricter
than WCAG 2.2 AA because of that user; none are looser.

## 1. Zoom is never disabled

Every page: `width=device-width, initial-scale=1`, and **never**
`user-scalable=no` or a `maximum-scale` below 2. Pinch-zoom is an emergency
accessibility feature for exactly our reader. (WCAG 1.4.4.) *Enforced.*

## 2. Touch targets

- The per-class floors in `LAYOUT.md` ("Minimum target sizes") are normative:
  72px primary destructive, 62px decision routers, 56px secondary actions,
  44px checkbox rows and clocks — stepping up at ≥760px. Anything tapped
  *during* a resuscitation lives in `.console` and gets those floors.
- Absolute floor anywhere in the repo, any width: **24×24 CSS px** (WCAG
  2.5.8), with WCAG's own exemption for links inline in a sentence.
- Interactive elements inside `.console` never render under **44px** in
  either dimension. *Enforced (24px global, 44px in `.console`).*
- No control requires a **long-press, double-tap, drag, or hover** to
  operate. Hover may enhance, never gate. Destructive actions get a
  confirm-gate (the RESET pattern), not a harder gesture. *Human-reviewed.*

## 3. Contrast and color

- Text ≥ **4.5:1** against its background; large text and non-text
  indicators ≥ **3:1** (WCAG 1.4.3/1.4.11) — **in both themes**. The shared
  tokens (`--ink`/`--ink2`/`--accent` on `--bg`/`--card`/`--card2`) are
  checked pairwise from `design-system.css`; a re-skin that breaks a pair
  goes red. *Enforced for the token pairs; spot-checks for one-off colors
  are human work.*
- Color is never the sole carrier of meaning (DESIGN-SYSTEM.md §2): every
  drawer has a number+word+shape, every state has a text tag. Must survive
  greyscale and print. *Human-reviewed; print rules partially enforced by
  the poster suite.*

## 4. Reflow and orientation

- At **320 CSS px** width, no page-level horizontal scrolling (WCAG 1.4.10).
  Wide content (tables, figures) scrolls inside its own container, never the
  page. *Enforced.*
- Portrait and landscape both work; nothing locks orientation except the
  print sheets, which are paper.

## 5. Typography

- Text inputs: **≥16px** font-size, always — smaller triggers iOS focus
  auto-zoom, which yanks the viewport mid-resuscitation. *Enforced.*
- Effective body text ≥15px; line-height ≥1.4 for prose; no justified text.
  *Human-reviewed.*

## 6. Motion

- Any page that declares CSS animation carries a
  `@media (prefers-reduced-motion: reduce)` block that stills it.
  *Enforced (pairing check).*
- Nothing flashes more than 3 times/second (WCAG 2.3.1) — this includes the
  metronome cue. No autoplaying motion longer than 5s without a way to stop
  it. *Human-reviewed.*

## 7. Screen-reader structure

- Every page: `<html lang="en">`, a unique descriptive `<title>`, and
  **exactly one `<h1>`** (visually hidden via `.sr-only` is fine — that is
  the landing page's own pattern, and the live engines' pattern). *Enforced.*
- Icon-only and symbol-only controls carry `aria-label`s; QR images carry
  their destination in `aria-label` (the QR suite reads them). Timers and
  step-changes in live engines announce via `aria-live` where a sighted user
  would see the change. *Human-reviewed; new engines copy the existing
  markup.*
- Modals: `role="dialog"`, `aria-modal`, focus moves in on open and returns
  on close; no keyboard trap. *Human-reviewed.*

## 8. Focus

Visible focus indicator on every interactive element (`:focus-visible`
styling in the design system) — never `outline:none` without a replacement.
*Human-reviewed.*

## 9. What the suite asserts (summary)

`verify_accessibility.mjs`, run against `dist/` like every other suite:

1. Viewport meta present, zoom not disabled — every published page.
2. `lang`, non-empty `<title>`, exactly one `h1` — representative page set.
3. No page-level horizontal overflow at 320px — representative page set.
4. Visible interactive targets ≥24px (inline prose links exempt);
   `.console` targets ≥44px — representative page set.
5. Text inputs ≥16px computed font-size.
6. `@keyframes` ⇒ `prefers-reduced-motion` block, per file, repo-wide.
7. Shared token pairs ≥4.5:1 in dark and light, parsed from
   `design-system.css`.

A check that cannot honestly pass yet is listed in the suite's header as a
known gap with its issue number — the LAYOUT.md precedent — never silently
skipped. Red must mean something.
