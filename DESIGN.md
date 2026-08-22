# Design

Durable visual decisions for the CairnReady Emergency Manual. This file is the
**single visual authority**. Where it disagrees with `DESIGN-SYSTEM.md`,
`SHELL.md`, `LAYOUT.md`, or `design/DESIGN_LANGUAGE.md`, this file wins and those
documents are amended to match.

**Mode: Operate.** Every decision below is judged by whether a clinician who has
never seen this manual can act correctly on first encounter, at arm's length,
under time pressure. Expression is not a goal here. Earned familiarity is.

---

## 0. Decision record

Sixteen decisions were settled before this file was written. They are recorded
here so no future session relitigates them.

| # | Decision | Rationale |
|---|---|---|
| 1 | Color encodes **severity and category**. The "colour encodes WHERE" rule is retired. | The drawer *color* tokens `--d1`–`--d6` were never implemented (docs only) and encoded one hospital's cart layout. Location moves to glyphs + number + word, which port. |
| 2 | Chrome is the **two-row bar**: 48px app bar + 34px chip strip. | Committed from `design/DESIGN_LANGUAGE.md`. |
| 3 | The chip strip **absorbs** weight, timeline, and case clock. | Keeps total chrome at ~82px instead of stacking a new bar on top of existing shell layers. |
| 4 | Cadence, metronome, dock, and picker **stop being chrome** and become in-page components. | They are the tool operating, not navigation. |
| 5 | Back/up control is a **single composite SVG**: left arrow + cairn. | Kills three Unicode glyphs across 40 occurrences; the arrow keeps the affordance legible to a stranger. |
| 6 | **All eyebrows deleted**, including step indicators. | Impeccable's one unearnable ban. Step position folds into the heading. |
| 7 | The **home hub is in scope** and gets real hierarchy. | Eight equal cards give no scan under stress. |
| 8 | Chip strip **stays at the wide breakpoint** (760px — see §6). | Muscle memory carries across devices. |
| 9 | Theme follows **`prefers-color-scheme`**. No toggle. | Both palettes stay; the control goes. See §7 for the accepted risk. |
| 10 | Migration runs **lowest clinical risk first**. | Prove the vocabulary where a mistake cannot reach a patient. |
| 11 | Scope: 20 screen tools, posters + labels, `tca/` rebuilt, `cairn/`. | |
| 12 | Mono covers **numbers, measurement, and fixed operational strings**. Narrative prose is sans. | |
| 13 | CSS delivery is **base + shell add-on**, two markers, zero selector overlap. | An unneeded layer is absent entirely. |
| 14 | **Full accessibility remediation** in this effort. | Every interactive component is being rewritten anyway. |
| 15 | The **cairn mark is fixed**, not localizable. | It is the network's shared identity. |
| 16 | **All authored inline style attributes become classes.** | Removes the substring-matching hack by removing what it matches. Runtime `.style` writes are exempt — see §11. |

> **Name collision warning.** `--d1`–`--d6` (retired drawer *color tokens*) and
> `#d1`–`#d6` (live drawer *anchors* in `codes/index.html`, baked into printed QR
> codes) are unrelated. Retiring the first must not touch the second. See §12.

---

## 1. Color

### Authority

Color carries two meanings and they own **different surfaces**, so they cannot
compete:

- **Severity owns fills and text color.** Critical, caution, info, ok.
- **Category owns the 4px left bar and nothing else.**

This split is not a compromise — `design/DESIGN_LANGUAGE.md` §3 specifies the 4px
bar precisely so category color does not compete with red/amber status. It is
also the enforceable form: a verify suite asserts no category token appears as a
`background`, and no severity token appears as a `border-left`.

### Tokens

Dark is the default palette. Both palettes are defined in the base sheet:
`:root` carries the **dark** values, and a single
`@media (prefers-color-scheme: light)` block redefines the same token names with
light values. No token is defined *only* in the light block — every token has a
`:root` definition, so a token can never resolve to nothing.

| Token | Dark (`:root`) | Light (media) | Role |
|---|---|---|---|
| `--bg` | `#0D1420` | `#EFF2F5` | page |
| `--card` | `#161F2E` | `#FFFFFF` | card surface |
| `--card2` | `#1D2A3C` | `#F4F6F9` | inset, inputs, secondary controls |
| `--ink` | `#EAF0F7` | `#141E2B` | primary text |
| `--ink2` | `#8FA0B5` | `#5A6A7D` | secondary text, labels |
| `--line` | `rgba(255,255,255,.10)` | `rgba(15,35,60,.13)` | hairlines |
| `--accent` | `#2FA372` | `#00693E` | primary action, live values |
| `--red` | `#E5484D` | `#C63238` | shock, arrest, critical |
| `--amber` | `#F0B429` | `#B07E13` | due now, caution |
| `--blue` | `#4C8DDA` | `#2F6FB5` | airway, navigation, info |
| `--green` | `#3DA35D` | `#1F7F49` | ROSC, resolved |
| `--gray` | `#5C6B7E` | `#6B7A8D` | non-shockable, inert |
| `--purple` | `#9B7BD4` | `#6C4FA3` | peds category |
| `--teal` | `#3AA6A6` | `#1F7E7E` | procedures category |
| `--orange` | `#E08A3C` | `#B4661F` | trauma category |

**The `-tx` family is retained and hereby documented.** Each accent answers two
questions that pull opposite ways — what color is a *fill* behind white text, and
what color is that meaning as *text* on a themed ground. One value cannot do
both. Every hue therefore keeps its fill token and gains a `-tx` text token that
clears 4.5:1 on `--bg`, `--card`, and `--card2` in its own theme. Use `-tx` for
`color:` only, never for `background:`. This was invented in code with no design
authority; it is correct, and this file is now its authority.

The same applies to `--sev-*` fills, `--tint-*` washes, `--on-tint-*` text
values, and `--note-bg` / `--note-tx`. All retained, all documented here.

**`--orange` is added to both sheets.** It was missing from the live sheet, which
is why `tca/` redeclared it locally.

### Category color and the switcher

The eight tool-identity colors in `tool-switcher.js` become token references.
The PPH value `#E75480` is off-palette **as a switcher color** and is replaced by
`--red` or a new category token.

> ⚠ **`#E75480` is also a Broselow band color** (`arrest/index.html`, the `bands`
> array: Grey / **Pink** / Red / Purple / Yellow / White / Blue / Orange / Green).
> Those hexes are a **physical-world standard** — the tape in the room and the
> drawer on the cart are that color. Changing one silently breaks
> screen-to-cart correspondence during pediatric dosing. See the frozen-value
> rule in §12. Tokenize the switcher; **do not touch the band array.**

### Non-negotiable color rules

1. **Color is never the sole carrier.** Every meaning also has a word, a number,
   a shape, or a position. The artifact must survive greyscale and photocopy.
2. **Contrast floors:** 4.5:1 body and placeholder text, 3:1 large text and
   non-text. Verified in **both** themes.
3. **No raw hex in page-local CSS.** Exactly two exemptions, both frozen data
   rather than design: Broselow band values, and any device-specific value that
   lives in SITE CONFIG.
4. Accent is for primary actions, current selection, and state — never
   decoration.
5. Inactive states never carry heavy or full-saturation color.

### Dynamic accent — and why focus is decoupled from it

On any page where a case weight under 50 kg is set, `--accent` is overridden at
runtime with the Broselow band color. This is a dose-safety cue and belongs
everywhere weight-based dosing is shown, not only on `arrest/`.

**Consequence, and the rule that follows:** because `--accent` changes at
runtime, nothing whose contrast must be *guaranteed* may depend on it. Focus
outlines therefore use a dedicated `--focus` token that is never overridden by
any runtime code, chosen to clear 3:1 against `--bg`, `--card`, and `--card2` in
both themes. Destructive controls use `--focus-danger`.

Without this, a pediatric case with a Grey band (`#8E8E93`) would ship focus
outlines at roughly 3.0:1 on `--card`, while a static contrast test — which
cannot see a runtime `setProperty` — reported green. A test that passes while
the shipped color differs is worse than no test.

---

## 2. Typography

One family. No display/body pairing — this is product UI.

**Sans:** the system stack. Golden rule 1 forbids fetching a webfont, so
`Source Sans 3` cannot ship. A permanent, deliberate deviation from
`design/DESIGN_LANGUAGE.md`, recorded here so it is not re-flagged.

**Mono:** `IBM Plex Mono`, `SF Mono`, `ui-monospace`, `Menlo`, monospace.

### Scale — fixed rem steps, not fluid

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 27–30px | 800 | |
| Card title | 19px | 800 | gets a real `.card-title` class |
| Row title | 16.5px | 700 | |
| Body | 15px | 400 | **line-height 1.55** |
| Section label | 11px | 800 | .12em tracking, uppercase, `--ink2` |
| Header timer | 26px | mono | |
| Primary countdown | 54px | mono | |

**Body line-height moves from 1.4 to 1.55.** The shipped value is tighter than
the design language specifies and tighter than is comfortable at a glance, at
arm's length, under stress. A legibility fix, not a taste preference.

Floors: nothing below 13px; inputs ≥16px.

### Mono discipline

Permitted: numbers, timers, doses, counters, card and drawer indices, timeline
log rows, and **fixed short operational strings** whose fixed width aids scanning
a column.

Forbidden: narrative prose, descriptions, explanatory text, anything read as a
sentence rather than scanned as data.

**The boundary, written so it does not drift: if it is read, it is sans; if it is
scanned, compared, or counted, it may be mono.**

---

## 3. Space, shape, elevation

### Spacing scale

Named steps, no raw values. `--sp-1: 4px` · `--sp-2: 8px` · `--sp-3: 12px` ·
`--sp-4: 16px` · `--sp-5: 20px` · `--sp-6: 24px` · `--sp-8: 32px`.

*(My call — the design language gave ranges but never named steps, which is why
every spacing value in the codebase is a literal. The most-repeated px literals
in the current CSS already fall on this scale.)*

Rhythm: tight within a group, generous between groups, more space above a
heading than below it.

### Radii — four values, tokenized

`--r-card: 14px` · `--r-control: 12px` · `--r-pill: 999px` · `--r-check: 6px`

This replaces **more than sixteen distinct radius values** currently in use
(12, 14, 10, 9, 8, 3, 16, 4, 7, 2.7, 6, 5.1, 2.4, 18, 11, 20, plus `50%`, `pt`
values, and six compound shorthands). A verify suite fails any raw
`border-radius` outside the token set. `50%` remains legal only for genuinely
circular elements — the metronome dot, the log pill.

### Elevation — declared once

Hairlines are the default: `1px solid var(--line)`. A surface has a border **or**
a shadow, never both.

Shadows exist only for elements floating above the page: the tool switcher menu,
the timeline sheet, the toast. Three named tokens, each with a real offset and a
soft blur. No zero-offset halos, no hard offset shadows.

---

## 4. Chrome — the two-row bar

Total ~82px. Sticky. Present on every page in the manual, including posters and
labels on screen (hidden in print).

### Row 1 — app bar, 48px

- **Left:** the back control — the composite cairn mark alone, no destination
  word, in a square 44px target. The word lives in `aria-label`: an icon-only
  control still needs an accessible name, and that is not optional. Making the
  control square is also what lets the title actually centre — with a text label
  the left control was wider than the two on the right and the title sat off-axis
  on every page.
- **Center:** page title, 15px/800, breadcrumb beneath at 10.5px/800/.1em.
  **Tappable — this is what opens the tool switcher.** The design language's
  title treatment carrying `SHELL.md`'s switcher behavior.
- **Right:** one 44×44 `⋯` overflow, flipping to `✕` when open. Contains case
  timeline, feedback, divider, reset (red).
- Never wraps at any width. Nothing in it is below 44px.

### Row 2 — chip strip, 34px

Present at every width. Absent entirely when a page has no chips — never
rendered empty.

Chips in order: **weight** (amber outline `SET WEIGHT` → accent outline
`72 KG · ADULT`, opens the full kg/age/estimate control), **case clock** (mono,
red-bordered while running, opens the timeline), **`TIMELINE · n`**, then
**section jumps**.

Section jumps use `scroll-margin-top: 110px`, never `scrollIntoView`, and are
never rendered for a section absent from the page.

### The back mark

One composite SVG on a `0 0 48 48` grid — the same glyph tier as
`design/ICONOGRAPHY.md`, inheriting its "survives at 16px" requirement. Chevron
in the left quarter, cairn stack taking the remaining width. `currentColor`
throughout, base stone at 75% opacity rather than a second hex, so it follows the
theme and prints black on white.

Rendered and checked at 16 / 20 / 26 / 40 / 64px in both themes: legible as
chevron-plus-three-stones at every size including the 16px floor. It runs at 26px
in the bar — larger than it would beside a word, because alone it carries the
whole affordance.

Written grammar exemption: `ICONOGRAPHY.md`'s `fill="none"` / 2.2-stroke rules
govern anatomical procedure glyphs. The cairn is solid geometric fill.

`◀`, `&#9664;`, and `‹` are deleted repo-wide — 40 occurrences across 24 files.
A verify suite fails their reappearance. Forward chevrons (`›`) meaning "opens
into" are untouched.

The ten poster leaves, which currently have no back-to-manual control, gain one.

> **Pagination risk.** `verify_poster_pages.mjs` measures each `.sheet` against a
> fixed print box. Adding a back control or changing the spacing rhythm can push
> a poster to an extra page. Posters must re-pass that suite, and the back
> control is screen-only on print surfaces.

---

## 5. Components

Every interactive component ships **default, hover, focus, active, disabled,
loading, error**. Half a set is not a component.

### Focus

`outline: 2px solid var(--focus); outline-offset: 2px` on `:focus-visible`, on
**every** interactive element including all shell controls. `--focus-danger` on
destructive controls. `:focus-visible` is never removed anywhere, for any reason.

`--focus` is a dedicated token, never overridden at runtime — see §1.

### Named primitives

The card-interior vocabulary becomes real classes. No element is styled by an
authored inline attribute, and nothing is styled by matching an inline
attribute's text.

`.card` · `.card-title` · `.row` · `.row-title` · `.section-label` ·
`.checklist` · `.check` · `.logit` · `.btn` (primary / secondary / destructive) ·
`.chip` · `.note` · `.figure` · `.steps` · `.console`

One name per concept, one concept per name. The eight current synonyms for
"tappable index row" collapse to `.row`. `.sheet` currently means five unrelated
things and is split.

### Targets

Global floor 24px. Operational controls 44px. Documented per-class floors —
destructive 72→88, routing 62→74, secondary 56→64, checkbox 44, clock 44→60 —
attached to selectors that actually match.

`.logit` moves from 36px to 44px. It is defined in **two** places today (base and
live sheets); both are consolidated.

> **The dead-`.console` fix is a clinical decision, not a cosmetic one.**
> `peds/`, `trauma/`, and `procedures/` declare these floors on a `.console`
> descendant selector with no `.console` element on the page, so the floors are
> inert. There are two fixes — add `.console` to the page, or rewrite the
> selectors — and they are not equivalent: `ACCESSIBILITY.md` and
> `verify_accessibility.mjs` treat everything inside `.console` as a control
> tapped during a resuscitation. Deciding which controls belong in that class is
> a clinical classification. **An agent must stop and ask, per tool.**

### Log controls

Shape carries function, and that rule predates this redesign: **underline
navigates, a rounded pill logs, and a control is never underlined**
(`verify_design_language.mjs`, `verify_logit.mjs`). Built on, not replaced.

**One control per row.** The row is *either* a checkbox *or* a log control, never
both. Two controls on one row is a decision to make while someone is watching a
patient.

#### Which rows get a log control

Ask one question: **will someone ask "when?"** If yes, it logs — and tapping it
both records the time and marks the step done, so no checkbox is needed. If no,
it is a checkbox and nothing is timestamped.

It logs when the step:

- starts or resets a cadence — epinephrine, rhythm check, HR check, sat check;
- has a repeat limit or a ceiling — "dose 1 of 3", a shock count;
- is irreversible or high-consequence — a shock delivered, blood activated,
  a hysterotomy started;
- is a milestone the case is measured against — code called, ROSC, time of birth,
  tourniquet on, transfer accepted;
- will be asked for at handover, in the debrief, or in the record.

Everything else is a checkbox. Most rows are checkboxes.

#### The control

The action, the computed dose, and the countdown all ride the same button, so one
target is the timer, the dose and the action — `SHELL.md`'s existing rule, and the
reason a cadence with a dock slot never gets a duplicate chip.

`.log` · `.log-block` (a major step *is* the control, 56px) · `.log-inline` (a
minor timed step, at the end of its row, 44px).

#### States

Colour is never the only carrier — **every state also changes the word.**

| State | Reads | Looks |
|---|---|---|
| ready | `LOG IT` | neutral border |
| due | `DUE 0:00` | amber border, 1.2s pulse |
| required, not yet done | `LOG IT` | red border and text |
| logged | `18:41 ✓` | green, tinted, verb in past tense |

**Logged is the payoff: the row becomes its own record.** The verb flips to past
tense and the time replaces the prompt, so a row already done reads as a timeline
entry rather than an instruction still waiting.

#### Undo

A mis-tap mid-code needs a way back: a quiet `UNDO` beside the control while the
undo window is open. Never a confirmation dialog — that costs a second nobody
has, and it makes the common case slower to protect against the rare one.

### Disclosure

Native `<details>`/`<summary>` wherever possible — there are roughly **470** of
them, and native disclosure already exposes its state to assistive technology.

`aria-expanded` is required on **scripted** disclosures only — the `.acch`
accordion buttons in the live engines and any custom toggle. Adding a static
`aria-expanded` to a native `<details>` produces a stale, wrong value and is an
anti-pattern. Today the scripted disclosures expose nothing.

### Overlays

Bottom sheet on phone, centered modal at the wide breakpoint. Overlays escape
their container — `<dialog>`, the popover API, or `position: fixed`. Never an
absolutely positioned child of an `overflow: hidden` ancestor.

A modal is never the first thought.

---

## 6. Layout

**Exactly two breakpoints: 600px and 760px.** Plus `print` and
`prefers-reduced-motion`. No third width may be added, ever.

**760 wins over 768.** `SHELL.md` currently runs nine `min-width: 768px` rules
governing the dock, picker, weight panel, and reset placement; `LAYOUT.md`
mandates 600/760 and forbids a third. All nine move to 760px. The affected band
is 760–767px. `SHELL.md` is amended to match.

Seven widths are live today (560, 600, 620, 760, 768, 900, 1100). All but two are
deleted.

> The breakpoint rule governs **media features**. `min-width:` and `max-width:`
> as ordinary CSS properties — `max-width: 1400px` on `main`, `max-width: 680px`
> on live tools, `min-width: 44px` on targets — are required by this document and
> are not breakpoints. The verify suite must distinguish them.

Grids use `repeat(auto-fit, minmax(300px, 1fr))` rather than breakpoint logic
doing a grid's job.

Content column: 1000px site-wide, 680px for live case tools, 14px side padding.
`main { max-width: 1400px; padding-bottom: 56px }` on card tools.

Running case tools put the **operating card first**, above reference content.

### Home hub

Redesigned, not migrated. The eight equal icon-plus-heading-plus-text cards are
replaced with a hierarchy reflecting real ED frequency and urgency. Cards are not
the page structure; nested cards do not appear.

---

## 7. Theme

Both palettes ship. Selection is `prefers-color-scheme`. There is no toggle, and
`lrh-pref-theme` is retired from the `CASE-STATE.md` namespace.

**Accepted risk, recorded knowingly.** `PRODUCT.md` names shared devices — whose
theme is whatever the last user or IT left — as a hazard of the operating scene,
and this decision removes the only in-app override. The tradeoff was put
explicitly and this was the answer: one less control in the chrome, and nothing
to be left in the wrong state by a previous user. If a wall display is ever
observed running the wrong palette in a real bay, revisit this line first.

**The theme mechanism is repo-global; the migration is per-page.** Switching
selection from `body[data-theme]` to `prefers-color-scheme` cannot be done a page
at a time without a window in which two pages on the same device in the same case
disagree. `theme-boot.js` is therefore retired in **one atomic change** covering
every page, not incrementally. `SHELL.md`'s "dark-only per PR #160" claim is
amended.

---

## 8. Motion

Motion conveys state. Nothing else animates.

- Transitions 150–250ms.
- Two authored moments: a 1.4s blink meaning *running*, a 1.2s pulse meaning
  *act now*. Plus the metronome beat, which is a clinical instrument.
- No page-load sequences. No section entrance animations.
- Every animation guarded by `prefers-reduced-motion`.
- Exponential ease-out from an already-visible default.

---

## 9. Print

Print is a first-class surface, not a stylesheet afterthought.

The **base sheet owns the print palette** as real tokens in one `@media print`
block, including `-webkit-print-color-adjust: exact` and
`print-color-adjust: exact`. There are currently **19 `@media print` blocks
across 14 screen files** — `codes/` alone has four — with four different values
for `--line` and three for `--card2`. All are deleted. (Two files,
`clinical-pathways/heart` and `clinical-pathways/pe`, already carry
`print-color-adjust`; the other eighteen screen tools do not.)

- 14mm page margin.
- `[data-noprint]` hides chrome; all shell layers and the back mark are
  screen-only.
- `[data-print-block]` sets `break-inside: avoid`.
- Buttons lose their min-height.
- Accordions are force-opened *in state* before `window.print()`, not by CSS.
- The 4px category bar survives as grey.

Posters and labels may override page geometry — sheet size, margins, `@page` —
but never a color.

---

## 10. Iconography

`design/ICONOGRAPHY.md` governs and `procedure-icons.js` is already fully
conformant. Unchanged: two tiers from one drawing, 2.2 stroke, `fill="none"`,
only action tips filled, one red idea per glyph, dashed means under the skin.

**Location is now carried by glyphs.** With drawer color retired, the equipment
glyph set carries more weight. Two consequences:

1. The set must be reviewed once, by a human, against "discriminable at 2 m" and
   "survives at 16px". No automated test can check this.
2. Glyphs encode **contents** (`ett`, `meds`, `fona`), never drawer numbers.
   Drawer number and cart name are localizable data in `inventory.js`, not
   design. This is what makes the system portable.

**No Unicode glyph or emoji ever stands in for an icon.**

---

## 11. Inline styles — what "all of them" means

Authored `style=` attributes carrying visual properties become classes. That
includes the ~105 inline `<h2>` card titles and `ob-neonatal/`'s fully inline
article cards.

**Runtime `.style` writes are exempt and always will be.** There are roughly 510
`element.style.X =` assignments plus `setProperty` calls across the codebase —
concentrated in `codes/`, `ob-neonatal/`, and `arrest/` — and they carry live
state: computed doses, countdown values, the Broselow accent. The
`verify_no_inline_style` suite is a **source-text check over authored markup**,
never a DOM check, or it will flag the very behavior this document mandates.

`setAttribute('style', …)` as a way around the source check is itself a
violation.

---

## 12. Frozen identifiers

These are not design surface. Changing one is a **stop**, not a judgment call.

- **Element IDs and card anchors** — `<article id="cNN">`, `#d1`–`#d6`, and every
  fragment target. `generate_qr_codes.py` bakes these into QR codes printed on
  labels **already adhered to carts**. A renamed anchor invalidates a physical
  artifact that cannot be fixed in software.
- **`{{PROC:tool#cNN|SECTION}}` section heading text.** `build.mjs` resolves
  transclusion by parsing the producer's markup — article, details, summary text,
  list rows. Renaming a section fails the build; restructuring its rows silently
  emits fewer of them.
- **`data-share` ids and `{{SHARE:}}` block contents.** `build.mjs` hard-rejects
  a shared block containing `<button>`, `id=`, `data-k=`, `data-logevent`, or a
  relative href. Accessibility remediation that adds a button or an id inside a
  shared block will fail the build.
- **Broselow band hex values.** A physical-world standard. See §1.
- **Kit item strings and drawer words.** `verify_kit_consistency.mjs` matches
  them as raw text across card, poster, label, and `inventory.js`.
- **`lrh-case-*` and `lrh-pref-*` storage keys**, per `CASE-STATE.md` — except
  `lrh-pref-theme`, retired in §7.

---

## 12b. Text density

Too much text is the manual's most pervasive design defect, and it is a
*clinical* defect: a clinician glancing at a screen mid-resuscitation reads the
first line and the last, and everything between them is cost. `DESIGN-SYSTEM.md`
already says a checklist row is one line and to delete statistics unless they are
the acted-on threshold. This section generalizes that to every surface.

**Target: roughly half the current word count.** The reference rewrite of
`sources/` went 386 → 197 words with nothing lost that a clinician acts on.

### Rules

- **Delete any sentence that describes what the reader can already see.**
  "Sorted by how much attention it needs" above a list that is visibly sorted is
  the canonical case.
- **Headings are nouns, not sentences.** "By source", not "By source — worst
  first". "How this stays current", not "How this is kept up to date — and what
  it cannot catch".
- **Ledes ≤ 15 words. Callouts ≤ 30 words.** A warning nobody finishes reading
  is not a warning.
- **Explanatory prose becomes a list.** Three paragraphs about how a process
  works becomes three lines. If it cannot, it belongs in a document, not on a
  screen a clinician uses under pressure.
- **One idea per line.** A sentence with two clauses joined by "and" is usually
  two rows.
- **No sentence explains a mechanism the reader will never act on.** Interesting
  is not a reason to be on the screen.

### What may never be cut

The distiller shortens explanation. It does not touch medicine.

- Doses, thresholds, energies, rates, intervals — and any number with a unit.
- Citations and source references.
- Any caveat that **changes what the clinician does** — a contraindication, a
  device-specific warning, a "do not carry that number across."
- Disclaimers and medico-legal text. These are not verbose; they are load-bearing
  and they are not an agent's to shorten.

Numbers, URLs and configured values are held invariant by the harness in both
passes, so the first two are a mechanical guarantee rather than an instruction.
The last two are judgment, and they are the reason cuts are reviewed.

---

## 13. Bans and earned exceptions

**Earned — the 4px category bar.** `skill-ban-side-stripe-borders` forbids a
colored `border-left` above 1px. This system makes the 4px bar the *entire*
category vocabulary, replacing a color system that would not have ported. The
brief earns it. The `.impeccable/config.json` suppression widens from
`design-system.css` to the repo, with this reason attached.

**Honored — numbered cards.** *(This reverses an earlier note in this file that
kept them; that note conflated two different jobs.)*

- **As a machine index the number stays.** `<article id="cNN">`, `#d1`–`#d6`,
  every fragment target — all frozen (§12), because printed QR codes on carts
  point at them.
- **As displayed text it goes.** No number in a heading, a menu row, a chip, or a
  link. "Cardiac Arrest — VF/VT", not "01 Cardiac Arrest — VF/VT".

The read-aloud test settles it: nobody says "go to card zero-six." They say "the
airway card", or just "airway". The sequence carries no information the reader
acts on, so the ban is honored — and the index survives underneath, where it is
actually used.

**Link grammar.** A link is the shortest noun naming its destination, underlined,
inline in the row it belongs to: `CONTROL the airway.` — "airway" links to the
RSI card. Never a trailing "(see card 14)", never a bare number, never a separate
"Related" block. Underline already means navigation
(`verify_design_language.mjs`), so a link needs no other marker.

**Honored — eyebrows.** Deleted everywhere, including step indicators.

**Honored — identical card grids.** The home hub is redesigned.

**Honored — glyph icons.** The Unicode back arrows are replaced by a drawn mark.

**Honored — mono as costume.** Bounded in §2.

---

## 14. What this system refuses

- Any external network request, for any reason, including fonts.
- Any patient identifier, anywhere.
- A clinical number that is not read from config.
- Content pasted into a second location.
- A raw hex, radius, or spacing literal in authored page-local CSS.
- A third breakpoint.
- An interactive element without a visible focus state.
- A frozen identifier changed without a human deciding.
- Novelty in a standard affordance. A stranger must not have to learn anything to
  get out of a screen or find a dose.
