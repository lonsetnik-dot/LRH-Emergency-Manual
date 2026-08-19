# Handoff: VF/VT Cognitive Aid — Mobile Redesign

## Package contents
- `README.md` — this file: VF/VT cognitive aid spec
- `DESIGN_LANGUAGE.md` — site-wide design system (tokens, chrome, page types, print)
- `ICONOGRAPHY.md` — procedure icon system (grammar, anatomical decisions, integration)
- `*.dc.html` — living design references; open in a browser alongside `support.js`

## Overview
Mobile-first redesign of the "01 Pulseless VF/VT" screen of the LRH Emergency Manual (lrhemergencymanual.net). Built for phones held one-handed during a code and iPads on a stand. Replaces the desktop three-column layout with a single-column flow: sticky code clock → weight/peds → one big "now" card with one-tap logging → guided step cards (roles, airway) → accordion reference sections → event log.

## About the Design Files
`VF Cognitive Aid.dc.html` is a **design reference / working prototype built in HTML** — it shows the intended look and behavior, it is not production code to copy directly. The task is to **recreate this design inside the existing lrhemergencymanual.net codebase** using its established framework, routing, state, and metronome/timer utilities. Where the prototype and the existing site's logic differ (e.g. dose math already implemented on the site), keep the site's clinical logic and adopt this UI.

## Fidelity
**High-fidelity.** Colors, type, spacing, hit-target sizes, and interactions are final intent. Recreate pixel-perfectly, adapting only to the codebase's component conventions.

## Design Tokens
Two themes via CSS variables on `body[data-theme]`, dark is default:

Dark: `--bg #0D1420 · --card #161F2E · --card2 #1D2A3C · --ink #EAF0F7 · --ink2 #8FA0B5 · --line rgba(255,255,255,.10) · --red #E5484D · --gray #5C6B7E · --blue #4C8DDA · --green #3DA35D · --amber #F0B429 · --accent #2FA372`

Light: `--bg #EFF2F5 · --card #FFFFFF · --card2 #F4F6F9 · --ink #141E2B · --ink2 #5A6A7D · --line rgba(15,35,60,.13) · --red #C63238 · --gray #6B7A8D · --blue #2F6FB5 · --green #1F7F49 · --amber #B07E13 · --accent #00693E (Dartmouth green)`

**Dynamic accent:** adult = Dartmouth green (#00693E light / #2FA372 dark). Pediatric mode (<50 kg) = the patient's Broselow band color: Grey #8E8E93 (≤5 kg), Pink #E75480 (≤7), Red #D22B2B (≤9), Purple #7D3C98 (≤11), Yellow #D4AC0D (≤14), White #B9BEC4 (≤18), Blue #2E86C1 (≤23), Orange #E67E22 (≤29), Green #229954 (≤36); 37–49 kg has no band (label "PALS dosing", keep green accent). Yellow/White bands use dark text (#141E2B) on the accent.

Typography: **Source Sans 3** (400/600/700/800) for UI; **JetBrains Mono** (500/700) for all timers and log timestamps. Section headers: 11px/800/letter-spacing .1–.12em uppercase. Body reference text 14.5px/1.6. Cycle countdown 54px mono. Code clock 26px mono.

Shape: cards radius 14–16px, buttons 12px, chips 999px. 1px `--line` borders; guided step cards use **dashed** borders (accent or blue).

Hit targets: ≥44px everywhere; primary actions 64–96px tall.

## Screens / Views (single screen, phased)

Max-width 680px, centered, 14px side padding. One column.

### 1. Sticky header (always)
Protocol label "01 · PULSELESS VF / VT" (11px, accent color) over the code clock (mono 26px) + blinking red dot while running (1.4s opacity blink) + status word (READY / CODE RUNNING / ROSC). Right: LIGHT/DARK toggle; RESET button — **two-tap confirm**: first tap turns it red reading "SURE?", auto-reverts after 2.5 s.

### 2. Weight row (always)
Card with weight (kg) input, age input + "ESTIMATE KG" (age→kg: 2×age+8, infants months×0.5+4, cap 70), and a live note "40 kg · pediatric/adult". Below, when <50 kg and not dismissed: peds banner with a vertical accent-colored bar, "**Pediatric mode — X kg (<50 kg) (Broselow Band).** Doses and defib energy below are weight-based PALS." + DISMISS.

### 3. Idle phase
One huge red button (96px): heart icon + "START CPR — CODE BLUE", sub "Starts the code clock and the 2:00 cycle timer". Below, muted line: "Call a code · start compressions · attach the defibrillator · enter weight above". Starting sets code clock + cycle timer and logs "Code blue called — CPR started, defibrillator attached".

### 4. CPR phase — the "now" card
- Header row: "CPR CYCLE — RHYTHM CHECK AT 0:00" left; "SHOCKS n" (mono, red) right.
- 54px mono countdown from 2:00 + mode label "30:2 · 110/min" (or "continuous · breath q6s · 110/min" after airway).
- When countdown ≤ 0: card border turns 2px amber and an amber button (64px) pulses (1.2s opacity) — "RHYTHM CHECK DUE — WHAT DO YOU SEE?" → opens the rhythm sheet. The red shock button hides while due.
- Otherwise: red 72px button, bolt icon, "SHOCK {J} J — LOG IT", sub "shock #n — resume compressions immediately, pause <10 s". Tapping logs the shock and restarts the cycle.
- 2×2 grid: EPI {mg} mg (drop icon; sub cycles "IV/IO — give now if non-shockable" → "next due in m:ss" countdown → amber "DUE NOW — dose #n"), AMIO {mg} mg (sub "dose n of 3" / "max 3 doses reached", still tappable — log flags "beyond max 3"), RHYTHM CHECK, + LOG EVENT (reveals inline free-text input + LOG; Enter submits).
- Footer note: "Anything can be tapped at any time — the algorithm is a guide, not a lock." **Off-algorithm use is a requirement**: nothing is ever locked or forced into sequence.

### 5. Guided step cards (dashed-border, one at a time)
1. **GET ORGANIZED — NAME THE ROLES** (accent dashed): chips Compressor · Airway/ventilation · Meds/IV-IO · Defibrillator · Recorder, sub "Assign aloud · rotate compressor every 2 min", button "ASSIGNED — LOG IT".
2. **Advanced airway placed?** (blue dashed, appears after roles logged): "AIRWAY IN — SWITCH" → logs, switches mode label to continuous + breath q6s.

### 6. ROSC
Green-outline 60px button (heart+pulse icon) "ROSC — PULSE RETURNED", always visible during CPR. ROSC phase shows a green-bordered card: "Pulse returned at m:ss" + post-arrest checklist (SpO₂ 94–99%, avoid hyperventilation; BP support; 12-lead ECG, glucose, temperature; H's & T's) + red "RE-ARREST — RESUME CPR".

### 7. Rhythm-check bottom sheet (overlay)
Backdrop rgba(5,10,18,.72); sheet slides from bottom, 20px top radii, respects safe-area inset. Title "AT THE RHYTHM CHECK — WHAT DO YOU SEE?" Three 76px left-justified buttons, each with a mini ECG waveform SVG on the left:
- Red **SHOCKABLE — VF/pVT** (chaotic squiggle) — sub "Charge {J} J → shock → resume compressions immediately"
- Gray **NON-SHOCKABLE — PEA/ASYSTOLE** (near-flatline) — sub "Resume CPR — epinephrine as early as possible" (resumes cycle on tap)
- Blue **ORGANIZED RHYTHM** (QRS complexes) — sub "Check pulse — next screen" → second screen: green **PULSE PRESENT — ROSC** / gray **NO PULSE — PEA** (resumes cycle)
- "CANCEL — BACK TO CPR" ghost button. Tap on backdrop also closes.
Left-justified stacked options are intentional (fast ragged-left scanning); keep them left-aligned.

### 8. Reference accordions (one open at a time)
DEFIBRILLATION · EPINEPHRINE · ANTIARRHYTHMIC · HIGH-QUALITY CPR TARGETS · COMPRESSION METRONOME · EVENT LOG. 52px headers with +/− chevron. Content mirrors the current site's copy, with computed doses bolded inline; peds vs adult paragraphs swap based on weight. Metronome section has a start/stop button (WebAudio click at 110/min, 880 Hz short blip) and the rate-only disclaimer. Event log lists newest-first: mono accent timestamp (elapsed m:ss) + label.

Footer disclaimer: "Cognitive aid — verify doses against your device labels and local policy."

## Dose math (prototype values — defer to site's existing logic)
Peds (<50 kg): shock1 = min(2×kg, 200) J; shock2+ = min(4×kg, 200) J; max 10×kg capped 200. Epi 0.01 mg/kg (max 1 mg) = 0.1 mL/kg of 0.1 mg/mL; ETT 0.1 mg/kg. Amio 5 mg/kg max 300/dose ×3. Lido 1 mg/kg, repeat 0.5 mg/kg.
Adult: 200 J (LRH ZOLL max), epi 1 mg q3–5 min, amio 300 then 150 mg, lido 100/50 mg.

## Interactions & Behavior
- **One big tap per action, no confirm dialogs** (only RESET is two-tap).
- Quick actions before START implicitly start the code.
- Every action appends a timestamped log entry (elapsed time since code start).
- Timers tick on a 400 ms interval; epi reminder interval 180 s (configurable 120–300); cycle 120 s (configurable 60–300); metronome 100–120 bpm.
- Only overdue things animate: blinking run-dot, pulsing amber due button. Nothing else moves — deliberate.
- Theme + accent set as CSS vars on body; accent recomputed whenever weight changes.

## Assets
No external assets. All icons are tiny inline SVGs (heart, bolt, drop, heart+pulse, three ECG waveforms) — copy paths from the prototype. Fonts from Google Fonts.

## Files
- `VF Cognitive Aid.dc.html` — the full working prototype (markup + logic in one file; the `<x-dc>` template holds the UI, the `Component` class at the bottom holds all state/handlers/dose math).
