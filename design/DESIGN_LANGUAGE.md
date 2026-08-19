# LRH Emergency Manual — Site-Wide Design Language

Companion to `README.md` (the VF/VT screen). This file covers the **global** system: chrome, page types, tokens, and rules. Reference prototype: `LRH Design Language.dc.html` — open it in a browser; the DEMO row at the bottom switches between Home, Category, Card, and Tokens.

These are **design references**, not production code. Recreate them in the site's existing stack; keep all existing clinical content and dose logic.

---

## 1. Tokens (CSS variables on `body`, `data-theme="dark"|"light"`)

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--bg` | #0D1420 | #EFF2F5 | page |
| `--card` | #161F2E | #FFFFFF | card surface |
| `--card2` | #1D2A3C | #F4F6F9 | inset surface, inputs, secondary buttons |
| `--ink` | #EAF0F7 | #141E2B | primary text |
| `--ink2` | #8FA0B5 | #5A6A7D | secondary text, labels |
| `--line` | rgba(255,255,255,.10) | rgba(15,35,60,.13) | hairline borders |
| `--accent` | #2FA372 | #00693E | primary action, live values |
| `--red` | #E5484D | #C63238 | shock, arrest, critical |
| `--amber` | #F0B429 | #B07E13 | due now, caution |
| `--blue` | #4C8DDA | #2F6FB5 | airway, navigation, info |
| `--green` | #3DA35D | #1F7F49 | ROSC, resolved |
| `--gray` | #5C6B7E | #6B7A8D | non-shockable, inert |
| `--purple` | #9B7BD4 | #6C4FA3 | Pediatric category |
| `--teal` | #3AA6A6 | #1F7E7E | Procedures category |
| `--orange` | #E08A3C | #B4661F | Trauma category |

Dark is the default. Theme toggle lives in the sticky header on every page; persist per device.

**Pediatric accent override:** on any page where a weight under 50 kg is set, `--accent` becomes the patient's Broselow band color (see README.md, Design Tokens). This is the only dynamic token.

## 2. Type

- **Source Sans 3** 400/600/700/800. **JetBrains Mono** 500/700, used only for numbers: timers, card numbers, doses in the log, counters.
- Page title 27-30px/800. Card title 19px/800. Row title 16.5px/700. Body 14.5-15.5px, line-height 1.55-1.6. Section label 11px/800, letter-spacing .12-.14em, uppercase, color `--ink2`. Timer 26px in header, 54px for the primary countdown, mono.
- Minimum body size anywhere: 13px.

## 3. Shape, spacing, targets

- Cards 14px radius, buttons 12px, pills 999px, checkbox 6px.
- 1px `--line` borders everywhere. **Category and section identity is a 4px left bar**, never a filled header block or icon tile. This is the main departure from the current site: it stops category color competing with red/amber status color.
- Content column max-width 1000px, 14px side padding; grids use `repeat(auto-fit,minmax(300px,1fr))` so phone gets one column and iPad two, with no breakpoint logic. Layout is identical across devices apart from column count — muscle memory has to carry from phone to iPad to the wall-mounted screen.
- Hit targets: primary action 64px+ tall, secondary 52px+, chrome buttons 38-44px.
- Gaps: 8px between siblings in a group, 10-12px between groups, 16-20px before a new section label.

## 4. Global chrome (every page)

The chrome is **two rows, ~90px total** — one 48px bar plus one chip strip. Nothing else is allowed to live at the top of a page. This replaces the earlier three-bar stack (breadcrumb row + button row + weight row), which ate a third of a phone screen before any content.

**Row 1 — the bar (48px).**
- Back: a bare `‹` chevron plus a short destination label, 44px tall, no button chrome. The label names **where you land, not the product**: from a card it is the category ("‹ CODES"), from a category it is "‹ ALL CARDS". Home shows the chevron at 35% opacity, disabled. "LRH Emergency Manual" appears only as the home page title — never as a nav label.
- Centre: two lines in the same block — card/page title 15px/800 (ellipsis truncation, never wraps), breadcrumb 10.5px/800/.1em `--ink2` underneath.
- Right: a single 44×44 `⋯` button. Everything non-urgent lives behind it: theme toggle, design tokens, PRINT THIS CARD, RESET CASE (two-tap arm). Open state flips the glyph to `✕` and gives it a `--card2` fill.

**Row 2 — the chip strip** (34px pills, horizontally scrollable, no visible scrollbar):
1. **Weight chip** — the weight state *is* the control. Unset it reads "SET WEIGHT" with an amber outline; set it reads "72 KG · ADULT" / "18 KG · PEDS" with an accent outline. Tapping expands the weight editor inline underneath (kg input, age input, ESTIMATE KG, DONE) rather than opening a screen.
2. **TIMELINE · n** — event count included when non-zero.
3. **Section jumps** — per page type: a card offers CHECKLISTS / DOSES / RELATED CARDS; a category index offers its group names (ARREST / AIRWAY / REFERENCE); a procedure card offers EQUIPMENT / STEPS / COMPLICATIONS; a workflow card offers its phase names. They smooth-scroll to the section with a 96px offset for the sticky bar (`scroll-margin-top:110px` on targets; do not use `scrollIntoView`). **Never render a jump chip for a section the page does not have.**

Everything the chips expand — weight editor, tools menu — pushes content down while open and collapses on the next selection. Only one may be open at a time.

**One weight, one case clock, one timeline** shared across every tool in the manual.

**Timeline bottom sheet:** backdrop rgba(5,10,18,.72), sheet 20px top radii, safe-area padding, max-height 80vh. Amber-barred privacy note ("Times and events only — no patient identifiers. Not a medical record. Clears on RESET."), newest-first list (mono accent timestamp plus label), COPY TO CLIPBOARD button that flips to "COPIED". Every logged action from any page lands here. All modals in the manual use this bottom-sheet pattern — no centered dialogs.

## 5. Page types

**Home hub** — H1 plus one-line purpose, search field (card-styled, 16px input to avoid iOS zoom), then category cards in an auto-fit grid: 4px category bar, 12px color chip, name 19px/800, card count in mono, one-line description in `--ink2`.

**Category index** — H1 plus short description, then groups. Each group has a label row (color chip, 11px/.14em label, hairline rule) and an auto-fit grid of rows: mono number in the group color, title, and an optional right-aligned note ("LIVE", "opens in Codes"). Rows are 4px-barred cards, 62px+ tall.

**Protocol / procedure card** — mono card number, H1, right-aligned one-line imperative. Then the **NAME / CLAIM / AIM** strip: three 4px-barred cards (red / blue / accent), 10.5px/.14em label, 14.5px body. Then any one-tap "— LOG IT" action buttons in a 2-up grid. Then checklists as **accordions, one open at a time**: 54px header with name, mono progress "2/3", plus/minus chevron; rows are full-width tap targets with a 22px checkbox that fills with the section color when checked; checked text goes 50% opacity plus strikethrough and writes a timeline entry. Figures keep their current line-drawing style with mono labels but sit in a `--card` panel with a 4px bar.

**Live protocol (VF/VT and similar)** — see `README.md`. Different from a reference card: one big "now" card, phased flow, guided step cards.

## 6. Behavior rules

- One big tap per action, no confirmation dialogs. Only destructive actions (RESET) use a two-tap arm-then-confirm on the same button.
- Every action writes to the shared timeline with elapsed-time stamps.
- Nothing is ever locked into sequence — guided steps suggest, they do not gate. Every section and card stays reachable at any time, and a free-text "+ LOG EVENT" is always available on live pages.
- **Motion is reserved for overdue things.** A blinking dot means running; a pulsing amber block means act now. Nothing else animates.
- **Icons only where the glyph is instant**: bolt (shock), heart (start CPR / ROSC), drop (epi), ECG traces (rhythm choices). Everything else is a word. Do not add an icon per row — it destroys the scan.
- Stacked multi-line choices are **left-justified** (one fixed anchor per row); single short labels centre.
- Inputs are 16px or larger to prevent iOS zoom; use inputMode decimal/numeric on all number fields.

## 7. Print

Every card must print usefully — a printed copy is the fallback when the network or the tablet is not there, and cards get taped inside code carts.

- `⋯ → PRINT THIS CARD` sets a print mode that **force-opens every accordion** (collapsed content cannot be revealed by CSS alone, so open it in state, call `window.print()` on the next frame, and restore afterwards), then prints.
- `@media print`: 14mm page margin; force the light token set regardless of theme (`--bg/--card/--card2` white, `--ink` black, `--line` #bbb) so dark mode never prints a black page; `[data-noprint]` hides all chrome (sticky bar, chip strip, demo/nav rows); buttons lose their min-height and padding so a checklist prints as a list, not a stack of blocks; `[data-print-block]` on each checklist and dose card sets `break-inside:avoid`.
- Category and section color survive as the 4px left bar — the only color that needs to reproduce, and it reproduces fine in greyscale as a grey bar.
- Checkbox squares print empty and are large enough to tick with a pen.

## 8. Migration order (suggested)

1. Ship tokens, theme toggle, and the two chrome pieces (header, weight bar) globally — biggest visual win, lowest risk.
2. Home hub and category indexes (pure presentation, no logic change).
3. Reference and procedure cards: NAME/CLAIM/AIM strip plus checklist accordions.
4. Live protocol pages, starting with VF/VT per `README.md`.
5. Retire the old blue header band and filled category tiles last, once every page is on the new chrome.

Note on step 1: shipping the new chrome means deleting the old blue LRH band, the separate breadcrumb line, and the standalone weight row — the win comes from removing rows, not restyling them. If they all stay and the new bar is added, the top of the page is worse than before.

## Files
- `LRH Design Language.dc.html` — home, category, card, and tokens reference prototype
- `VF Cognitive Aid.dc.html` and `README.md` — the live protocol screen
