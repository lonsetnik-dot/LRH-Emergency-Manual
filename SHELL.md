# SHELL.md — the case-shell interaction contract

Same role as `CASE-STATE.md` (state) and `LAYOUT.md` (layout), for the
**interaction model**: the written contract that keeps every live tool's
chrome, timers, actions and gestures identical, so nothing has to be
re-learned mid-crisis. Source design: the Cairn case-shell handoff
(2026-08); reference implementation: `arrest/index.html`.

Design goals, in priority order:

1. **Next step face up** — no accordion to open, no scroll hunt. Doses
   computed and visible.
2. **Timers face up** — every cadence (rhythm check, epi, HR check, sat
   check) is a visible countdown that is also the button that satisfies it.
3. **App-managed situational awareness** — auto-logged timeline, DUE NOW
   escalation, a metronome that pauses itself for rhythm checks.
4. **Minimum paradigm count** — one bar, one strip, one dock, one picker
   pattern, reused everywhere. A tool differs only in words, timers, doses.

All prototype clinical values were illustrative. **Every dose, energy,
cadence and threshold comes from the tool's existing validated SITE CONFIG
block** — the shell renders config, it never carries numbers of its own.

## The layers (top to bottom, fixed order)

A layer a tool doesn't need is absent entirely, never left empty.

### 1. App bar — one row, 56px (60px ≥768px), never wraps
- **Left:** back control (`‹` phone / `MANUAL ›` breadcrumb ≥768px) +
  **tool name as dropdown** — tap opens the tool switcher (the six live
  engines + manual home; each row = 9px color square in that tool's accent,
  name, count/tag). Replaces separate MANUAL/BACK buttons.
- **Center:** empty when idle. While a case runs, the **master case clock
  pill** owns the center: red-bordered pill, mono digits, tag (`CODE` /
  `NRP` / `APNEA` / per tool). Tapping it opens the timeline.
- **Right, phone:** single `⋯` overflow menu → Case timeline, Feedback,
  divider, Reset for next case (red text).
- **Right, ≥768px:** the same items inline: TIMELINE, FEEDBACK, RESET
  (red border).
- No Light/theme item anywhere — the manual is dark-only per PR #160
  (deliberate deviation from the prototype, which predates that decision).
- All targets ≥44px. Bar is sticky. Nothing in it ever wraps.

### 2. Cadence + actions strip (only while a case runs)
- **Timers and doses ride the buttons** (2026-08-15 review): a cadence
  that has a dock/strip action renders INSIDE that button — countdown as
  a second mono line (red `DUE NOW` at zero), computed dose/energy in the
  label (`SHOCK 64 J`, `EPI 0.16 mg`). One target = the timer, the dose,
  and the action. This applies on BOTH widths.
- **Phone:** chips appear ONLY for a cadence that has no dock slot;
  a cadence with a dock button never gets a duplicate chip.
- **≥768px:** the dock buttons (layer 6) render up here instead,
  dock-styled (54px, tinted bg + 1.5px colored border). Metronome group
  right-aligned; the strip may flex-wrap; labels never truncate mid-word
  (`white-space:nowrap`, shorten text instead).

### 3. Metronome row (only for tools that have one)
- Beating dot (CSS scale pulse at the compression/vent rate), mode label
  (`30:2 · 110` / `CONT · 110` / `VENT · 50`), status line (`compress` /
  `2 breaths` / `paused N s` / `off`).
- 30:2 until ADV AIRWAY toggled, then continuous (arrest family). NRP uses
  continuous vent cadence, no airway toggle.
- **Auto-pause 10 s** whenever a rhythm/HR check is initiated, with a
  visible countdown; resumes itself.
- `MUTE` toggle always present (audio off → dot static gray). ADV AIRWAY
  logs to the timeline when set. Audio is WebAudio; mute respected
  case-wide.

### 4. Weight strip (weight-driven tools only)
- **Phone:** collapsed 44px row `WEIGHT · 16 kg / not set ▼`; tap expands
  kg input + age input + ESTIMATE. `not set` renders caution-amber; a set
  weight renders green.
- **≥768px:** expanded by default until confirmed (ESTIMATE or DONE ✓),
  then collapses to a slim row `WEIGHT 16 kg ✎ tap to change`.
- Every dose recomputes live from this value; unset weight renders
  `set weight` in place of a number — never a stale or default dose.
- **Mode lives here, not in a banner** (2026-08-15 review): a mode that
  changes dosing (pediatric vs adult) is stated in the strip's own row
  (`16 kg · PALS (pediatric)`), and leaving it is an explicitly labeled
  action (`TREAT AS ADULT`, undone by an equally explicit `UNDO`) —
  never a `DISMISS`, which reads as "hide this warning" while leaving the
  clinician unsure which dosing mode survived. Routing questions that
  change TOOLS (the NRP off-ramp) may stay dismissible banners — there
  the dismiss genuinely means "no, stay here," and dosing is unaffected.

### 5. Tool content — face up, operating card first
The ordering differs by phase (2026-08-15 review — the running screen
must put the thing you operate above the fold, never below reference):

**Idle:** first-action prompt box (caution border) + primary start button
(red, full width) → ACTIVATE TELE-ED → DOSING — FACE UP (the tool's ~3
primary doses as rows — name, rule, computed value; never behind an
accordion) → secondary doses → reference content.

**Running:** the tool's OPERATING CARD (cycle clock, pathway rungs, EBL
entry — whatever the tool is driven by) comes FIRST in the scroll area;
tele-ED/roles rows compact beneath it; the DOSING block follows as
reference (its next-step numbers already ride the action buttons, layer
2/6), then secondary doses, then the existing reference accordions,
citations, disclaimer. The start prompt and button are gone.

**ACTIVATE TELE-ED** stays face up from the first screen (blue-bordered,
full width). One tap logs the request time and collapses to a quiet
`TELE-ED ACTIVATED AT 0:12 ✓` row. Idempotent; never a second dialog.

### 6. Pinned action dock (phone, only while a case runs)
- Fixed to the bottom, thumb zone, above `env(safe-area-inset-bottom)`.
  Three buttons, flex 1, 54px min-height.
- Slot colors are semantic and identical across every tool:
  **amber = intervention** (SHOCK / PPV ✓ / ATTEMPT), **purple = drug or
  deterioration** (EPI GIVEN / DESAT — never with a numeric threshold the
  tool's guideline doesn't publish; DAS has no SpO₂ cut-off), **blue =
  assessment** (RHYTHM ✓ / HR CHECK / SAT ✓). The assessment slot (or
  amber ATTEMPT for RSI) opens the picker.
- **LOG ticker** rides on top of the dock: one line, newest event +
  `LOG ▲`; tap → full timeline.
- ≥768px there is no bottom dock — the same three buttons live in layer 2.

### 7. Result picker (bottom sheet phone / centered modal ≥768px)
- Triggered by the assessment action and by its cadence chip. Dimmed
  scrim, caps title (`AT THE RHYTHM CHECK — WHAT DO YOU SEE?`), 2–4
  full-width options: name (bold white) + one-line consequence. Option
  colors: red = worst/shockable path, slate = middle, blue =
  organized/best.
- Picking logs the **result** (not just "check done") and restarts the
  cadence. ✕ closes without logging.

### 8. Case timeline
- Every action auto-logs with the case-clock stamp and a category color
  dot. Bottom sheet on phone; ~320px right side panel ≥768px (tool stays
  visible). Footer: `device only · no identifiers · cleared on reset`.
- Storage per CASE-STATE.md: localStorage where already contracted,
  PHI-free, cleared by RESET and the inactivity auto-clear. The PHI guard
  on log labels is unchanged.

### 9. Reset
- RESET lives in the ⋯ menu (phone) / inline red-bordered button (≥768px).
  Confirm stays the existing pattern (two-tap SURE? on the engines).
  One reset clears clock, cadences, weight, log, metronome state, Tele-ED
  state — the manual-wide `lrh-` sweep per CASE-STATE.md — then shows the
  amber "cleared" toast with OK.

## Behavior — exact rules

- Case clock ticks 1 s; all cadences derive from it. Cadence anchors reset
  on their satisfying action (a check resets its own; SHOCK also resets the
  rhythm cycle; EPI resets the epi cycle).
- Epi cadence shows `GIVE NOW` before the first dose, then a countdown
  (duration from SITE CONFIG), then `DUE NOW` red at zero.
- Rhythm/HR check opens the picker **and** starts the 10 s metronome pause
  immediately (the check is happening now); the cadence restarts only when
  a result is picked.
- Logged drug events include the computed dose when weight is set:
  `Epinephrine given — 0.16 mg (0.01 mg/kg)` (must still pass the
  CASE-STATE.md PHI guard: rates and doses, never the patient's weight).
- Starting a case seeds the log (`Code blue — CPR started` etc.); if
  Tele-ED was activated pre-case, seed `Tele-ED already on the line`.
- The case (weight, clock, log) is shared cross-tool state per
  CASE-STATE.md and survives navigation between tools during one case.
- Overflow rules: bar never wraps; strip flex-wraps; labels get
  `white-space:nowrap` and shorter text rather than mid-word clipping.
- Print: every shell layer is screen-only (`@media print` hides bar,
  strips, dock, sheets); card/reference content keeps its print styling.

## Per-tool mapping (the only things that vary)

| Tool | Clock tag | Start | Cadence timer(s) | Metronome | amber / purple / blue | Picker |
|---|---|---|---|---|---|---|
| arrest (adult) | CODE | NO PULSE — START CPR | rhythm (config), epi (config) | 30:2→CONT + ADV AIRWAY | SHOCK / EPI GIVEN / RHYTHM ✓ | Shockable / Non-shockable / Organized |
| arrest (peds mode) | CODE | same | same | same | same, weight-computed doses | same |
| neonatal (NRP) | NRP | BABY OUT — START THE CLOCK | HR check 0:30 | VENT cadence, no airway toggle | PPV ✓ / EPI GIVEN / HR CHECK | HR <60 / 60–99 / ≥100 |
| airway (RSI/DAS) | APNEA | per tool | sat check (config) | none | ATTEMPT / DESAT / SAT ✓ | Passed / Failed—reoxygenate / CICO |
| tca | TCA | per tool | per tool | per tool | 3 slots, same semantics | per tool |
| pph, dystocia | per tool | per tool | per tool | none | 3 slots, same semantics | per tool |
| reference pages | — | — | — | — | — | — |

Reference tools keep layer 1 (bar) and 9 (reset) and nothing else.

## Tokens

Map the prototype's skin onto the repo's existing tokens
(`design-system-live.css`): `--bg/--card/--card2/--ink/--ink2/--line`,
semantic `--red/--amber/--blue/--green/--gray` + each tool's `--accent`.
Shell-specific additions (tinted action backgrounds, the purple drug slot)
live in `design-system-live.css` once, not per tool.

**Card tools get the shell from `design-system-shell.css`.** The two full
sheets cannot be injected into the same page — `design-system-live.css` and
`design-system.css` set conflicting `body` rules, so a card tool that took
both would have every card restyled. A card tool therefore carries
`@design-system` (cards) + `@design-system-shell` (chrome). The shell block
is mirrored between the live sheet and the shell sheet, and
`verify_shell_parity.mjs` fails if the two copies drift by a single byte:
the shell is one design, and a fix applied to the engines must reach the
card tools in the same commit. Fonts stay the repo's
system stacks. Touch floor 44px everywhere; dock/action buttons 54px;
radii per the repo's existing values.

## State

No new **persisted** keys in phase 1 — in-memory `S` plus the existing
CASE-STATE.md contract (`lrh-case-startms`, `lrh-case-lastactive`, shared
clocks/log where already wired). Any future persisted key needs a
CASE-STATE.md entry in the same commit, per that contract.

## Migration order

arrest (reference, this document's source of truth) → tca → airway →
neonatal → pph/dystocia → codes/peds/ob-neonatal (card tools — bar +
applicable layers) → reference pages (bar only). Each migration maps the
tool's existing timers/actions into the slots above; **clinical content
and validated values do not change.**

Done so far: arrest, tca, airway, neonatal, pph, dystocia (engines);
**peds** (first card tool — layers 1, 4, 8, 9; `verify_peds_shell.mjs`
asserts it against arrest's live DOM rather than against re-typed numbers,
so the two cannot drift apart). Still on the old chrome: `codes`,
`ob-neonatal`, `trauma`, `procedures`, `clinical-pathways`.

Two decisions made during the peds port, worth reusing for the rest:

- **The tool switcher lists card tools too.** It listed only the six
  engines, so a shell-wearing card tool was reachable from nowhere. Peds is
  now in every switcher, and the next card tool joins the same list.
- **A band/severity color never repaints the bar.** peds used to paint its
  whole header the Broselow band color. Under the shell the bar stays the
  flat page ground in every tool and the band drives the tool square, the
  weight value and the zone chip instead — the same way arrest tints
  `--accent` rather than the chrome. Chrome that changes shape or color per
  patient is the second interface model this migration exists to remove.
