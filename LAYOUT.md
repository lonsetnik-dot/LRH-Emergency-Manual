# LAYOUT.md — the layout contract

Same role as `CASE-STATE.md`, for layout instead of shared state: the written contract that
keeps six independently-duplicated `index.html` files (plus the landing page and
`clinical-pathways/`) from drifting apart. Layout had already drifted into three unrelated
conventions with nothing written down before WS11 (see "History" at the bottom) — this file
is what stops a fourth from happening by accident.

Read this before touching any `@media` block, any of the class names below, or adding a
sizing rule to a bare `<div style="...">` in a card. If a change doesn't fit anywhere in this
document, that's a signal to fix the change, not to add an exception.

## The two breakpoints

The whole repo uses exactly two widths. No third breakpoint may be added anywhere —
`clinical-pathways/heart/index.html` briefly had two (560px, 620px) that predated this
document; WS11.7 folds them into 600/760, see History.

- **600px** — phone → small-tablet. Currently used for `.menu` only (the landing-page /
  procedures-index card-grid layout): single column below 600, `repeat(auto-fit,
  minmax(280px,1fr))` above it.
- **760px** — small-tablet → the width this whole manual is actually designed for (an iPad at
  the bedside). Used for `.nca`, `.steps`, `.figs`, and (as of WS11) `.console`.
- **print** — letter-portrait output for code carts and binders. `.steps`/`.figs` become
  `repeat(3,1fr)` regardless of screen width; nav/reset/weight-bar/etc. are hidden per tool.

**Explicit carve-out:** `@media (prefers-reduced-motion: reduce)` (used in `codes/index.html`)
is an accessibility feature, not a layout breakpoint, and is outside this contract. The
acceptance grep below excludes it by design — see "Acceptance check."

## The class vocabulary

One line each on what belongs in it. All six card tools (`codes`, `peds`, `trauma`,
`ob-neonatal`, `debrief`, `procedures`) share these verbatim — same names, same rules, same
`@media (min-width:760px)` block, per golden rule 4.

- **`.menu`** — the card-grid you tap into a tool's numbered sections from (landing page,
  procedures index, posters index). 1 column → `minmax(280px,1fr)` auto-fit at 600px.
- **`.nca`** — NAME / CLAIM / AIM, the three-box team-briefing block at the top of a
  resuscitation card. 1 column → `1.05fr 1fr 1fr` at 760px.
- **`.steps`** — the thing you *read*: accordions, checklists, dosing reference. 1 column →
  `minmax(300px,1fr)` auto-fit at 760px; `repeat(3,1fr)` in print.
- **`.figs`** — diagrams and figure cards. 1 column → `minmax(260px,1fr)` auto-fit at 760px;
  `repeat(3,1fr)` in print.
- **`.console`** (new, WS11) — the thing you *operate*: clocks, counters, decision routers,
  dose-log buttons, metronomes. Not a layout — a sizing scope. It sets the CSS custom
  properties consumed by the target-size floors below and can be applied to more than one
  element in a card, including elements that aren't adjacent to each other (see
  `ob-neonatal` shoulder dystocia, whose console is a clock strip *and* a separate re-run
  button 150 lines apart in the DOM — both get `.console`, neither gets moved).

**Rule: operational controls live in `.console`, never in a bare inline-styled div.** If it's a
clock, a counter, a decision-router row, a dose-log button, or anything else someone taps
*during* a resuscitation rather than reads *about* one, it gets `.console` — not a one-off
`<div style="margin:0 14px">` with no class, which is what every one of them was before WS11
(see History).

### `.card-split` — a separate, rarer decision, not bundled with `.console`

`.card-split` (`grid-template-columns:minmax(300px,420px) 1fr` at ≥760px, `display:block`
below it) is a two-column layout for a card whose console content is (a) one contiguous block
and (b) genuinely separable from the reference content next to it. It is decided **per card**,
not automatically wherever `.console` appears:

- **Yes** — codes card 01 (arrest): the console is one contiguous block that ends right where
  the dosing-reference accordions begin.
- **No** — `ob-neonatal` shoulder dystocia: console pieces aren't contiguous (clock strip
  above `.nca`, re-run button at the bottom of `.steps`), and the maneuver cards mix figures
  with checkboxes — no seam to split on. `.console` sizing applies directly to the disjoint
  pieces with no `.card-split` wrapper.
- **No** — codes STEMI (card 21): the console *is* contiguous, but it's three short buttons
  next to five full accordions — splitting it would leave the console column mostly empty air.
  Sizing only.

Console track width: `minmax(300px,420px)`, sized to what card 01's redesigned rhythm panel
and DEFIB button actually need at the 760px floors, not the 460px the original mockup guessed
from one card. Worth a real look on an iPad in portrait at exactly 760px, where the console
column maxing out at 420px leaves `.card-ref` only ~310px.

## Minimum target sizes

Floors for the whole repo, not card-01-specific values. Applies at every width; step-up at
≥760px is driven by CSS custom properties scoped to `.console` (never added to `:root` —
`:root` is brand colors, per golden rule 4).

| Control class | Phone floor | ≥760px |
|---|---|---|
| Primary destructive action (defib, and equivalents) | 72px | 88px |
| Decision router rows (rhythm check, HR bands, Apgar) | 62px | 74px |
| Secondary action (dose log, clock start, cycle) | 56px | 64px |
| Checkbox row | 44px | 44px |
| Primary numeric display (clock) | 44px | 60px |

Nothing in the repo may end up below the phone floor for its class, at any width.

Long checklists (≥8 items) get a two-up layout at ≥760px:
`grid-template-columns:1fr 1fr; gap:0 20px`. Each row keeps its own `data-k` and 44px floor —
this is a display rule, not a restructuring of the checklist itself.

## The four presentation modes

- **Console** — clock-bearing cards, mid-resuscitation. `.console` (+ `.card-split` where
  warranted). Optimized for a tap under pressure, one-handed, possibly gloved.
- **Reference** — `.steps` / `.figs` content. Optimized for reading: dosing tables, criteria,
  citations, diagrams.
- **Propped** — the procedure posters (`posters/*/index.html`). Fixed `.sheet{width:8.5in}`
  letter-portrait sheet, meant to be printed and propped open on a cart, not resized. Out of
  scope for WS11 — see WS12.
- **Seated** — `debrief/index.html`. Read after the fact, at a desk, not at the bedside; no
  urgency-driven sizing floors apply.

A single card can contain both console and reference regions (card 01 is console + reference;
most checklist-only cards are reference only). A card never mixes propped or seated framing
with the other two — those are different files entirely.

## Container width

`main { max-width:1400px; margin:0 auto; padding-bottom:56px; }` in all six card tools. Prose
blocks (the landing page, `clinical-pathways/`) stay narrow regardless — see History for their
current state and WS11.7's planned convergence.

## Acceptance check

```
grep -o '@media[^{]*' index.html */index.html */*/index.html
```

(The 11.3 spec text gives `*/index.html posters/*/index.html` — extended here to
`index.html */index.html */*/index.html` because two paths were silently excluded from the
check they're meant to be covered by: the landing page's own root `index.html`, and
`clinical-pathways/heart/index.html`, which is nested two directories deep and doesn't match a
single-level `*/index.html` glob at all. `*/*/index.html` covers both `posters/*/index.html`
and `clinical-pathways/heart/index.html` in one pattern.)

Expected output, repo-wide: only `(min-width:600px)`, `(min-width:760px)`, `print`, and
`(prefers-reduced-motion: reduce)` (the explicit accessibility carve-out above — filter it out
with `grep -v` if you want a strict pass/fail against the three layout values). Every width
that appears in that filtered output must appear in this document; every width in this
document must appear in the repo. No orphans in either direction.

**As of WS11.3 (this file's first version), this does not yet pass clean** —
`clinical-pathways/heart/index.html` still has `(min-width:560px)` and `(min-width:620px)`,
and the landing page / `clinical-pathways/index.html` still use `.wrap{max-width:840px}`
instead of the `main{max-width:1400px}` + 600/760 convention. Both are tracked, scoped work —
WS11.7 — not a bug in this document.

## History — how layout drifted before this file existed

Three conventions existed with nothing written down connecting them:

1. **The six card tools** (`codes`, `peds`, `trauma`, `ob-neonatal`, `debrief`, `procedures`) —
   `main{max-width:1400px}` + the 600/760 blocks above. Consistent across all six, but nothing
   said so anywhere, and nothing stopped an eventual seventh tool from picking a different
   number.
2. **The landing page and `clinical-pathways/`** — `.wrap{max-width:840px}` (900px in
   `clinical-pathways/heart/`), each with its own ad hoc media queries: the landing page and
   `clinical-pathways/index.html` happen to already use 600px (harmless coincidence); `heart/`
   used 560px and 620px, which don't match anything else in the repo. WS11.7 brings all three
   onto the standard shell.
3. **The nine procedure posters** — a fixed `.sheet{width:8.5in}` letter-portrait sheet, no
   responsive breakpoints at all by design (meant to be printed). Out of scope here; see WS12.

A fourth would-be convention — an 820px breakpoint scoped to one card — was proposed in an
earlier draft of this workstream (`AGENT-TASKS-WS11-arrest-console.md`, deleted) and rejected
before any code was written: the six-tool convention above already covers tablet widths, and a
third breakpoint used by exactly one card is exactly the kind of drift this document exists to
prevent. See WS11.1 for the full reasoning.

The other gap this file's `.console` class closes: every clock, counter, dose-log button,
decision router, and metronome across all six tools was a bare inline-styled
`<div style="margin:0 14px">` with no class — invisible to all of the above, and 100% wide at
1400px regardless of screen size. `.steps`/`.figs`/`.nca`/`.menu` reflow content you read;
nothing reflowed content you operate. `.console` is the fix, added in WS11.
