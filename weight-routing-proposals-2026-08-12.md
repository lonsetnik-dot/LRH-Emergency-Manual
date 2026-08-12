# Weight & Age Routing — Proposed Fixes & Options — 2026-08-12

Companion to `weight-routing-audit-2026-08-12.md`. One entry per finding:
**Recommended** = what I'd build unless you say otherwise; **Options** = the
real alternatives; **Your call** = the specific number/wording only you can
sign off. Items marked ✅ AGREED are locked in from your reply.

Reply with item numbers to change; anything you don't object to gets built as
Recommended.

---

## 1. ✅ AGREED — NRP off-ramp banner (audit §A)

Locked in as proposed. Implementation spec so we agree on the details:

- **Trigger:** committed weight **< 3 kg**, OR age entered as **< 1 month**
  (peds months field, or <0.09 y elsewhere). Broselow's own floor (3 kg) is
  the citable line.
- **Behavior:** a red, full-width, *dismissible* banner directly under the
  weight bar in **peds, arrest, and codes**:
  > **NEWLY BORN (first days of life)? → Use NEONATAL RESUSCITATION (NRP)**
  > [open card] — doses differ: epi 0.02 mg/kg (NRP) vs 0.01 mg/kg (PALS).
  > If this is an older infant who simply weighs <3 kg, dismiss and continue.
  Link: `../ob-neonatal/?from=<tool>#c03`. Dismissal stored per case
  (`lrh-case-nrpdismiss`, so RESET and the 60-min sweep clear it — a new
  patient gets the banner again). PALS math stays available after dismissal
  (the ex-preemie case).
- **Also in this item:** arrest gets peds' Broselow floor (<3 kg → "OUTSIDE
  BROSELOW-LUTEN RANGE", not "GREY ≤5 kg"); TCA's obstetric workstream gains
  an NRP link next to the hysterotomy link ("baby delivered → NRP card"); the
  age-estimate paths (age 0/<1 mo) trigger the same banner.
- Citation in-file: NRP 8th ed (epi 0.02 mg/kg IV/UO), Broselow-Luten 3–36 kg.

---

## 2. Codes — pediatric guard disabled (`thresholdKg: null`) (audit §B1)

**Recommended: set `thresholdKg: 40`, cite it, and keep the strip tappable in
every state (fixes B3 at the same time).**

- Why 40 and not 50: the strip's red state fires on **adult cards** to say
  "this weight looks pediatric." At 50 kg it would flag a lot of small adults
  (a 48 kg elderly patient on the ACS card) — alarm fatigue on the cards
  adults actually use. 40 kg ≈ the top of the Broselow range plus margin, and
  is a common "adult dosing above this" convention. The arrest tool keeps its
  own 50 kg *arrest trigger* — different question (which algorithm) from this
  one (does this weight belong on an adult card at all).
- **Options:**
  - **A. 40 kg (recommended)** — fewer false alarms on adult cards.
  - **B. 50 kg** — one constant everywhere, matches `arrestTrigger.maxKg`;
    accept the small-adult false positives.
  - **C. 36 kg** — strict Broselow ceiling; maximal specificity, misses the
    37–45 kg 11-year-old.
- **Your call:** the number (40 / 50 / 36 / other).

## 3. ob-neonatal — grams vs kg, unbounded weight (audit §E1–E2)

**Recommended: interpret-and-echo, with a hard stop in the impossible zone.**

- **A (recommended) — smart unit handling + always-visible echo:**
  - value **≥ 300** → interpret as **grams**, convert, and echo it loudly:
    header and panel read *"3500 g = **3.5 kg**"*. No newborn weighs 300 kg;
    no birth weight is under 300 g that survives to a dose, so the zones
    can't collide.
  - value **> 6.5 and < 300** → **hard stop, no doses**: *"Not a plausible
    birth weight. Enter kg (e.g. 3.5) or grams (e.g. 3500). Older
    infant/child → Peds tool."* (link).
  - value **< 0.2** → stop: *"below plausible birth weight — check entry."*
  - Permanent unit label next to every weight box (not placeholder text), and
    a persistent echo line ("= 3.5 kg") that survives typing.
- **B — explicit g/kg toggle** next to the input. More honest, but one more
  thing to mis-set at a delivery; and 90% of entries will be grams anyway.
- **C — grams-only input** ("birth weight (g)") converting internally.
  Matches how OB speaks, but diverges from every other tool's kg convention.
- **Your call:** A vs B vs C, and the 6.5 kg macrosomia ceiling (7 kg fine
  too).

## 4. Arrest + TCA — age→weight estimator (audit §C2, D3)

**Recommended: replace both estimators with peds' `estimateFromAge` verbatim
(single source of truth), plus a months/years unit select copied from peds.**

- Gets us, in one move: the **>12 y refusal** ("USE A MEASURED WEIGHT" — no
  more 16-year-olds silently flipped into peds mode), kills the hardcoded
  "70 kg estimate" at age ≥31, ends the 30% formula disagreement on the shared
  key, and fixes the years-only field (typing 3 for a 3-month-old).
- Empty-age ESTIMATE gets peds' visible "ENTER A VALID AGE FIRST" instead of
  a silent no-op.
- **Option B:** keep `2a+8` but add the >12 y refusal — smaller diff, still
  leaves two formulas writing one key. Not recommended.
- **Your call:** none, unless you prefer B. (The 5-year discontinuity in the
  APLS bands — 5.0 y → 18 kg, 5.1 y → 22.3 kg — is inherent to the published
  formulas; I'd leave it and not invent a smoothing of my own. Say the word if
  you want interpolation instead.)

---

## The rest, grouped — recommended fixes

### 5. One validation rule for the shared weight key (audit §C1, F2)
Every tool that writes `lrh-case-wtkg` (arrest, codes, peds) enforces the same
band **at write time**: `0 < kg < 300`, with a *visible* rejection —
*"Check weight — must be between 0 and 300 kg"* — instead of today's mix of
silent-accept / silent-drop / silent-blank. `1e3` and 350 get the same message.
Reads keep a matching guard as backstop. **Your call:** none (300 is arbitrary
but only needs to be shared; shout if you want 250 or 350).

### 6. Arrest — provenance + keystroke hygiene (audit §C5)
Copy peds' `save()` semantics into arrest: `wtsrc` only becomes `'measured'`
when the *user types a changed value* (loading or retyping the same number
keeps `estimated`); `wtms` bumps only on a real change; and transient states
while correcting a number (`""`, `"."`, `"0"`) stop deleting the shared weight
— deletion commits on blur or after a short debounce, not per keystroke. Same
debounce fix applied to peds, which shares the per-keystroke-delete behavior.

### 7. Adult override lifecycle (audit §B6/C3)
Arrest implements the documented clear-on-changed-weight/age (copy codes'
800 ms debounce); codes' clear becomes *visible* (one-line toast: "Adult
override cleared — weight changed"); the dead `ARRESTMODE`/`__codeCPR` hooks
are deleted. TCA gets arrest's dismiss/undo override bar verbatim (audit §D2)
— a 45 kg adult can be dosed as an adult in TCA at last.

### 8. Arrest — stale-weight strip + 60-min sweep (audit §C6)
Copy peds' `paintStale` strip and the manual-wide inactivity clear into
arrest, so it stops being the one case-state tool that pre-fills yesterday's
weight without a cue.

### 9. Dose caps (audit §C4, B8, B9) — plumbing now, numbers yours
I wire `data-max` on every currently-uncapped per-kg row and the missing
`epiEttMaxMg`/`lidoMaxMg` in arrest's SITE block, using the values below as
**placeholders you verify before merge** (each cited in-file):

| Row | Suggested cap | Basis — verify locally |
|---|---|---|
| arrest ETT epi (peds) | 2.5 mg | adult ETT dose 2–2.5 mg |
| arrest lidocaine dose 1 / 2 | 100 mg / 50 mg | adult bolus convention |
| codes TXA (ICH) 10/15 mg/kg | 1000 mg / 1000 mg | CRASH-3 regimen |
| codes RSI: etomidate 0.3 | 40 mg | ~130 kg ceiling |
| codes RSI: ketamine 1–2 | 200 mg | common induction ceiling |
| codes RSI: propofol 1–2 | 200 mg | common induction ceiling |
| codes RSI: sux 1–1.5 | 200 mg | common ceiling |
| codes RSI: roc 1–1.2 | 120 mg | ~100 kg TBW |
| codes crystalloid 20 mL/kg | 1000 mL/bolus | matches peds' own 1 L/bolus cap |
| codes asthma ketamine | 200 mg | as above |
| codes PCC rows | implement the **stated** 100 kg dosing-weight cap as real spans (50 u/kg→5000 u ✂ stated 4000 u; 25/35 u/kg→2500/3500 u) | the card's own text |

**Your call:** confirm/replace each number. Anything you strike, I ship
uncapped-but-flagged (a "no max — verify" footnote) rather than inventing.

### 10. Codes — small-weight and TNK-band floors (audit §B5, B7)
- `.wdose` spans that would print "0 mg" auto-raise precision until non-zero
  (min 2 dp): etomidate at 1 kg renders "0.30 mg", never "0 mg".
- STEMI TNK band refuses below the audience threshold from item 2: *"weight
  band is an adult regimen — pediatric STEMI dosing not covered here"* instead
  of "30 mg (<60 kg)" for a 10 kg entry. The stroke-vs-STEMI TNK interlock:
  each TNK line gains a one-word context tag ("STROKE dose" / "STEMI band") —
  cheap, and makes a mis-read visibly wrong.

### 11. Codes — audience strip + broken peds links (audit §B3, B4)
Strip stays tappable in **every** state (grey confirmation included) whenever
`data-peds-alt` exists; warning state reads "⚠ N kg PATIENT · ADULT DOSES ·
PEDS CARD →". `peds#p16` (dead) — **your call:** c03 is which peds card it
should target; likely candidates are an existing card or dropping the alt.
I'd point it at `peds/?from=codes` (menu) until you name the card. The two
strips that jump to `../arrest/` get an explicit "opens the Arrest tool"
label.

### 12. Codes — weight bar UX (audit §B11–B15, B21)
Age unit select persisted per case (`lrh-case-ageunit`) so "9 months" never
reloads as a years-flavored 0.75; ESTIMATE with a measured weight already
present asks one inline confirm before overwriting; estimate errors render in
their own slot (the "80 kg (measured)" readout never disappears) and
auto-clear; `#wtbar` wraps on narrow screens so the readout is always visible;
weights <1 kg display at 2 dp ("0.04 kg", never "0 kg"); the "or AGE" label
becomes "or AGE → ESTIMATE" to stop implying age alone does something.

### 13. Cross-tab weight re-sync (audit §B13)
peds/codes/arrest add a `storage` listener + visibilitychange re-read for
weight (mirroring what codes' checkbox module already does), so two tabs — or
peds-then-codes on one phone — stop disagreeing. The stale strip then always
describes the weight actually on screen.

### 14. TCA joins the case-state contract (audit §D1, D4–D6)
- **Recommended: full adoption** — TCA reads/writes `lrh-case-wtkg`/`ageyrs`
  (with items 4–6's rules), logs to `lrh-case-log` (PHI guard included), its
  RESET becomes the manual-wide confirm-modal sweep like arrest's, and it
  honors `lrh-pref-theme`. **Option B:** keep it standalone but say so on
  screen ("weights and events here don't carry to other tools") and rename
  its RESET. B is less work but leaves the timeline hole in debrief.
- Regardless: crystalloid line gets `Math.round` + the item-9 cap, and is
  gated on the same peds/adult switch as TXA/calcium.
- Pregnancy flag moves into the running screen (a toggle in the workstream
  header), which un-deadens the OBSTETRIC workstream mid-case; add item 1's
  NRP link beside the hysterotomy link; add the standard back-link header.
- **Your call:** A vs B.

### 15. ob-neonatal — clinical-value fixes (audit §E3–E6)
- **Conflict banner:** replace the mismatched band comparison with a ratio
  test against the GA-expected weight (`[0.8, 1.5, 2.5, 3.5]` kg by band):
  warn only if entered weight is **<0.6× or >1.6×** expected. Kills the
  false alarm on a 3.2 kg 37-weeker; still catches 3.5 kg @ 24 wk (4.4×).
- **UVC on the GA-only path:** bands 0–1 (<34 wk) → 3.5 Fr, bands 2–3 → 5 Fr
  — matches card 04's own "<1.5 kg → 3.5 Fr" rule for the population it was
  missing. Weight-entered path unchanged.
- **ETT size:** engine band 3 becomes **"3.5"** (drop "–4.0"), and the static
  card-03 table and engine then agree at "2 kg and over": NRP convention
  (<1 kg: 2.5, 1–2 kg: 3.0, >2 kg: 3.5). **Your call:** confirm against LRH
  stock; if you stock 4.0 for large terms I keep "3.5–4.0" and fix the table
  instead.
- **Epi ETT/IV collision:** split into two bullets; the ETT bullet gets its
  own computed span ("ETT once if no access: 0.05–0.1 mg/kg = X–Y mL") so the
  larger volume is calculated, labeled, and physically separate from the IV
  line.

### 16. ob-neonatal — smaller hardening (audit §E7–E9, E11)
Card 02 gets an echo line under the birth banner ("= 3.5 kg · drives sizes on
cards 03/04") so entry-time typos are visible where they're typed; when the
"Multiple" chip is active, a warning appears on the weight boxes ("one weight
field — this is baby ___'s; re-enter per baby") — full per-baby scoping
deferred as its own future task; epi volumes < 0.1 mL render with the
dilution note pulled up beside them instead of an affirmative "0 mg = 0 mL";
GA enforced 20–44 in JS with a visible message (and a "months? days?" hint on
9/280-style entries); `lrh-ob-weight` gains the same changed-timestamp +
stale strip the case weight has.

### 17. Labels + printed carts (audit §LB-2/LB-3)
Code-cart label rows for i-gel and EZ-IO gain one printed line: *"<3 kg /
newborn → OB cart (NRP sizes)"*. **Your call:** whether LRH stocks pediatric
i-gel sizes (1/1.5/2/2.5) on the code cart — if yes I add the rows; that's a
stock question I can't answer from here.

### 18. Terminology (audit §F3)
`suxamethonium` → `succinylcholine` in `airway/index.html` (2 spots) + update
`verify_airway_screen.mjs:65` + add the pair to TERMINOLOGY.md's alias table.
(DAS is a UK guideline, but this is our prose, not a quote — rule 10's
exception doesn't apply.)

### 19. Cleanups riding along
Delete codes' dead `SITE.peds`/`arrestTrigger` config + the stale comments
describing removed behavior (audit §B2); delete the never-firing `#resetbtn`
listeners in codes and ob-neonatal *or* leave them with a one-line "dead —
interceptor swallows this" comment (**Recommended: delete**); tca's `r()`
default-precision divergence from arrest gets aligned while item 14 touches
the file.

---

## What I need from you (everything else proceeds as Recommended)

| # | Decision | Default if you just say "go" |
|---|---|---|
| 2 | Codes pediatric-warning threshold | **40 kg** |
| 3 | Grams handling model (A/B/C) + macrosomia ceiling | **A, 6.5 kg** |
| 9 | Dose-cap numbers table | **ship suggested values, each cited "verify locally"** |
| 11 | Real target for the dead `peds#p16` link | **peds menu until you name a card** |
| 14 | TCA: full case-state adoption vs labeled-standalone | **full adoption** |
| 15 | Term ETT "3.5" vs keep "3.5–4.0" | **3.5** |
| 17 | Peds i-gel sizes stocked on the code cart? | **pointer line only, no new sizes** |

Sequencing when you green-light: items 1–4 first (one PR-able chunk on this
branch, with a per-card test checklist for the Netlify branch deploy), then
5–13 (codes/arrest/peds mechanics), then 14 (TCA), 15–16 (OB), 17–19.
