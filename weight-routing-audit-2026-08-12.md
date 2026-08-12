# Weight & Age Routing Audit — 2026-08-12

**Scope:** every weight/age input and every per-kg calculation across `arrest/`,
`tca/`, `codes/`, `peds/`, `ob-neonatal/`, `labels/`, `airway/`, `trauma/`, plus
the shared `lrh-case-wtkg` / `lrh-ob-weight` localStorage contract between them.
Prompted by: *"if you put 1 kg, it should direct to NRP not peds resuscitation."*

**Method:** full read of the weight engines in each tool, boundary-value tracing
(0, negative, 0.5, 1, 3, 25, 50, 300, 350, 3500, `1e3`, comma decimals, lbs),
and cross-tool state tracing through localStorage. Line numbers are from this
branch's files. Nothing has been changed yet — this document is findings +
recommendations only.

---

## TL;DR — the five most dangerous things found

1. **There is no neonatal off-ramp anywhere in the manual.** Enter 1 kg (or age
   0) in peds, codes, or arrest and you get PALS numbers with no pointer to the
   NRP card (`ob-neonatal/#c03`). The word "NRP" appears zero times in
   `arrest/index.html` and `codes/index.html`. Your example is real, and it's
   worse than the example: arrest labels a 0.5 kg patient "Broselow GREY ≤5 kg"
   and points at the peds cart.
2. **Codes' only pediatric-weight guard is disabled by config.**
   `SITE.audience.thresholdKg: null` (`codes/index.html:2248`, an acknowledged
   TODO) means a 1 kg entry renders as a calm grey **"1 kg · ADULT DOSES"** on
   all 22 adult cards. The red warning state and the "pediatric weight on an
   adult card" modal exist in the code but are unreachable.
3. **ob-neonatal's weight input is unbounded, and birth weight is spoken in
   grams.** Type `3500` (grams, as it's charted) and the NRP card prints
   **"70 mg = 700 mL"** of epinephrine in the same confident red panel as a real
   dose. The one banner that could catch it ("WEIGHT AND DATES DISAGREE") stays
   silent for the grams case and false-alarms on normal term babies instead.
4. **Arrest and TCA's age→weight estimate silently flips teenagers and adults
   into pediatric dosing.** The formula `min(2·age+8, 70)` has no upper-age
   refusal: estimating a 16-year-old gives 40 kg, which trips the `<50 kg` peds
   trigger — first shock 80 J instead of 120 J, half-dose TXA in TCA. Ages ≥31
   return a flat "70 kg" logged as an estimate. Peds' own estimator refuses
   beyond 12 y; arrest/tca ship a variant peds explicitly removed.
5. **One shared weight key, three validation regimes.** Arrest's input accepts
   any value >0 and writes it to `lrh-case-wtkg`; its own reader silently drops
   ≥300; peds/codes have no ceiling at all. Enter 350 in arrest: the box shows
   350, arrest's dose lines say "enter weight," codes and peds happily dose off
   350 kg — and on reload arrest's box is blank while the others still hold it.

---

## A. The neonatal routing gap (the "1 kg" problem)

The clinically correct framing: NRP applies to the **newly born** (delivery
room / first hours–days, the transition period); PALS applies to infants beyond
that. A weight under ~3 kg doesn't *prove* the patient is newly born (an
ex-preemie at 2 months can weigh 2.8 kg and belongs in PALS), so the right UX
is a **loud, dismissible prompt** — "Newly born? Use the NRP card →" — not a
silent automatic reroute. Today there is no prompt of any kind:

| Tool | What happens at 1 kg / age 0 today | File:line |
|---|---|---|
| `peds/` | "OUTSIDE BROSELOW-LUTEN RANGE (3–36 kg)" note, but all PALS `.wdose` spans still compute; age-estimate at 0 mo silently yields 4 kg. No NRP link. | `peds/index.html:1456`, `1534-1543` |
| `arrest/` | No lower bound at all. 0.5 kg → 1 J shock, epi 0.01 mg, and the Broselow band function (`k<=bands[i][0]`, no floor) labels it **GREY ≤5 kg** with a link to the peds cart. Age 0 → estimate 4 kg → straight into PALS. | `arrest/index.html:522-527`, `1015-1029` |
| `codes/` | 1 kg → grey "1 kg · ADULT DOSES" strip (see B1 below); etomidate span prints **"0 mg"**. | `codes/index.html:2248`, `717` |
| `tca/` | Same trigger constants as arrest, same estimator, no neonatal concept. After a resuscitative hysterotomy the OB workstream links to the hysterotomy card but **not** to NRP — the one moment a TCA user has a fresh newborn in hand. | `tca/index.html:339-345` |
| `labels/` (printed carts) | Broselow drawer labels start at 3 kg; code-cart i-gel sizes start at 30 kg, EZ-IO at 3 kg. Nothing printed indexes a <3 kg patient or points to the OB cart. | `labels/index.html:485,503,551-559` |
| `ob-neonatal/` → outward | Zero clinical links out to peds; peds' own "Neonatal Fever" card doesn't link back. The NRP card is reachable only via its own menu or site search. | verified by link sweep |

**Recommendation (needs your sign-off on threshold + wording):** in peds,
arrest, and codes, when weight < 3 kg **or** age is entered as 0 (or <1 month),
show a prominent dismissible banner: *"Newly born (first days of life)? Use
NEONATAL RESUSCITATION (NRP) → ob-neonatal card 03. Doses differ (epi 0.02
mg/kg vs PALS 0.01 mg/kg)."* Keep the PALS math available after dismissal —
the ex-preemie case is real. Also fix arrest's Broselow band floor so <3 kg
shows out-of-range (peds already does this correctly).

---

## B. Codes — the pediatric guard that isn't

- **B1. `thresholdKg: null` disables the audience strip's warning state**
  (`codes/index.html:2248`, `3032`, `3115-3123`). Every entered weight —
  including 1 kg — takes the calm grey "N kg · ADULT DOSES" path. The red
  "⚠ N kg PATIENT · THIS CARD IS ADULT DOSES" state and the pediatric-redirect
  modal are dead code until a number is chosen. **This needs a clinical
  decision on the threshold (the existing `arrestTrigger.maxKg: 50` is the
  obvious candidate) — flagging, not guessing.**
- **B2. Codes has no adult/peds routing at all anymore.** `ARRESTMODE` and
  `__codeCPR` are called (`2830`, `2908`, `2930`) but never defined — the
  merged arrest card moved to `arrest/`, leaving `SITE.peds`, `SITE.arrestTrigger`
  (`2222-2234`), and four token-map entries as dead config, and comments that
  describe behavior that no longer exists.
- **B3. Entering a weight removes the peds cross-link.** The audience strip is
  tappable ("TAP FOR PEDIATRIC") only when *no* weight is set; once any weight
  is entered the click handler is cleared but the pointer cursor remains — it
  looks tappable, isn't, and the route to peds disappears exactly when a small
  weight makes it most needed (`3107-3124`).
- **B4. Broken peds link target:** `c03` has `data-peds-alt="peds#p16"` but
  peds' cards stop at `p15` (`codes/index.html:438`). Two other strips
  ("TAP FOR PEDIATRIC" on c22/c05) navigate the whole page to `../arrest/`
  with no warning.
- **B5. Small-weight dose truncation:** `data-decimals="0"` rows round to
  zero — etomidate 0.3 mg/kg prints **"0 mg"** below 1.67 kg (`717`), alteplase
  below 0.56 kg (`556`). A displayed "0 mg" is worse than the "enter weight"
  chip.
- **B6. Codes silently deletes arrest's adult override.** Any committed
  weight/age change (including clearing the field) removes
  `lrh-case-adultoverride` 800 ms later, with both repaint hooks undefined, so
  nothing visible happens in codes — but the arrest engine flips back into
  PALS mode for the same patient (`2821-2834`). The clear-on-change contract
  is right (per CASE-STATE.md); the invisibility is not, and arrest itself
  never implements the clear at all (see C3).
- **B7. STEMI TNK band floors at "<60 kg":** a 10 kg (or 3 kg) weight prints
  "This patient's band: 30 mg (<60 kg)" (`3139-3153`). The same `#wtkg` also
  drives stroke-dose TNK (0.25 mg/kg max 25 mg) on another card with no
  interlock — two TNK regimens, one field.
- **B8. Uncapped per-kg rows at high weight:** TXA (ICH), all five RSI drugs,
  20 mL/kg crystalloid, asthma ketamine have `data-perkg` but no `data-max` —
  at 500 kg (or a lbs entry) they print 7.5 g TXA, 10 L crystalloid, 600 mg
  rocuronium without comment. (TNK, alteplase, benzos, levetiracetam,
  valproate, heparin are correctly capped.)
- **B9. Stated-but-unimplemented cap:** the PCC row *says* "dosing weight
  capped at 100 kg" but is text-only — no `.wdose` span implements it (`975`).
  About a dozen other per-kg doses are also text-only (enoxaparin, DDAVP,
  dopamine, C1-INH, card-23 RSI…) in a tool that has trained users to expect
  per-kg doses to auto-fill.
- **B10. The only age-branching dose never sees the age field:** enoxaparin
  (age <75 vs ≥75, `1891`) is prose; `lrh-case-ageyrs` is collected and used
  by nothing in codes.
- **B11. Age-unit trap:** the months/years select isn't persisted. "9 months"
  stores 0.75 y; on reload the field shows `0.75` with the unit back on
  "years." A user who retypes "9" gets a 9-year-old estimate (34 kg vs 8.5 kg)
  from identical-looking UI (`289`, `2925-2933`).
- **B12. Estimate-button paper cuts:** a valid estimate silently overwrites a
  measured weight with no confirm; an estimate *error* replaces the "80 kg
  (measured)" readout with red error text while all 22 spans keep dosing off
  80 kg, and never repaints until the next input event (`2941-2944`).
- **B13. Weight is read from storage once, at load, and never re-synced** — no
  `storage` listener, no visibilitychange re-read (the *checkbox* module does
  re-sync on tab focus). Two tabs, or peds-then-codes on one device, disagree
  indefinitely; meanwhile the stale-strip re-reads the *timestamp* every 30 s,
  so codes can print "ENTERED 14:22 · 3 MIN AGO" beside a kg value frozen from
  an hour ago (`2799`, `2852-2876`).
- **B14. Sticky weight bar scrolls the readout off-screen on phones**
  (`flex-wrap:nowrap; overflow-x:auto`, `#wtdisplay` last child) — you can
  enter a weight and never see what the tool thinks it is (`120`). Also
  "or AGE" implies age alone does something on this page; it doesn't.
- **B15. Sub-0.1 kg display rounds to "0 kg (measured)"** while dosing off the
  real value (`2835`).

## C. Arrest — validation regimes at war with each other

- **C1. Three guards, one value** (the TL;DR #5 finding): input accepts any
  `v>0` (`1015`), write to the shared key is unguarded (`485`), `kg()` and the
  loader silently drop ≥300 (`480`, `519`). Typing 350: box shows 350, dose
  lines show "enter weight" — a direct on-screen contradiction with no error
  text — the adult branch prints adult doses (silent for a plausible 350 kg
  adult), 350 leaks to peds/codes which dose off it, and on arrest reload the
  box is blank. `1e3` parses to 1000 and does the same.
- **C2. The estimator** (TL;DR #4): no >12 y refusal (peds has one), flat
  70 kg at age ≥31 logged as "ESTIMATED," and formula `2a+8` disagrees with
  peds' `3y+7` above 5 y — same patient, age 8: arrest says 24 kg, peds says
  31 kg (29% apart), and whichever tool ran last wins the shared key. TCA
  copies arrest's version verbatim (`tca:666`).
- **C3. Adult override survives a patient change.** Arrest loads
  `lrh-case-adultoverride` and clears it only via the undo button or RESET —
  it never implements the clear-on-changed-weight/age contract CASE-STATE.md
  documents (codes implements it, invisibly — see B6). Previous patient
  overridden to adult + no RESET + new 15 kg child = **adult ACLS doses on a
  15 kg child**, amber bar the only tell (`482`, `1030-1041`).
- **C4. Uncapped peds doses:** ETT epinephrine (`0.1 mg/kg`, no
  `epiEttMaxMg`) prints 4.99 mg at 49.9 kg — adult ETT dose is 2–2.5 mg;
  lidocaine per-kg likewise uncapped (`538-542`, `SITE.peds` at `382-385`).
- **C5. Provenance laundering:** every keystroke in the weight box rewrites
  `lrh-case-wtsrc` to `'measured'` — retype the same number that peds
  estimated from age and the whole manual now calls it measured. Arrest also
  bumps `lrh-case-wtms` on every keystroke (contract says only on real
  change), falsely refreshing peds'/codes' stale-weight strip, and intermediate
  keystrokes (".", "0", clearing to correct) delete the shared weight outright
  (`1015`, `484-488`).
- **C6. No stale-weight strip and no 60-min inactivity sweep in arrest** —
  unlike peds/codes/ob/trauma. Opening arrest cold hours later pre-fills the
  previous patient's weight and doses off it with no cue (`1174-1176`).
- **C7. Age field is years-only** (`inputmode="numeric"`, no months select —
  peds has one). Typing "3" for a 3-month-old and tapping ESTIMATE gives 14 kg
  instead of ~5.5 kg. Empty-age ESTIMATE is a silent no-op (peds shows
  "ENTER A VALID AGE FIRST").
- **C8. Peds-by-age + out-of-range weight = unexplained refusal:** age 8 +
  weight 350 → "SHOCK — ENTER WEIGHT" while the box visibly shows 350.

## D. TCA — outside the case-state contract entirely

- **D1. TCA shares nothing.** No localStorage at all: weight/age from
  peds/codes/arrest don't carry in (re-enter under pressure or get generic
  per-kg strings), TCA's entries don't carry out, its events never reach the
  shared timeline the debrief tool reads — a hole exactly where the traumatic
  arrest was. Its RESET clears only itself while arrest's visually identical
  RESET wipes the whole manual — two identical buttons, opposite blast radius.
  It also ignores `lrh-pref-theme` and always loads dark.
- **D2. No adult override.** Same `<50 kg` trigger as arrest but no
  dismiss/override UI: a 45 kg frail adult silently gets pediatric TXA
  (675 mg instead of 1 g + 1 g) and pediatric calcium; the only tell is the
  word "pediatric" in a status note (`373`, `383`, `393`).
- **D3. Same ≥300 silent-drop and same estimator defects as arrest**
  (`662`, `666`).
- **D4. Crystalloid is uncapped, unrounded, and not gated on peds:**
  `20 mL/kg × 1.06 kg` renders **"21.200000000000003 mL"** in the workstream
  text (float artifact on ~a quarter of two-decimal weights); 200 kg renders
  "4000 mL" with no ceiling (`379`).
- **D5. The pregnancy flag is unreachable once the resus starts** — the
  checkbox lives on the idle screen, which is hidden at start; the handler
  even has a dead branch for the running-phase case. So the OBSTETRIC
  workstream can never appear mid-case, and there's no NRP handoff for the
  delivered neonate (see section A). Also: the on-screen weight is the
  *mother's* — typing the baby's weight to dose the baby silently flips the
  mother's TXA/calcium to pediatric.
- **D6. No back link out of the tool** (arrest has one).

## E. OB/Neonatal — the grams problem and its neighbors

- **E1. Unbounded weight, no plausibility gate** (TL;DR #3): validation is
  `w>0`, dose is `0.02·w` uncapped (`2894-2908`). 25 → 0.5 mg = 5 mL; 70 →
  1.4 mg = 14 mL; 3500 (grams) → 70 mg = 700 mL, ETT depth "3506 cm." Only
  tell is "weight 3500 kg" in the panel header.
- **E2. The unit exists only in placeholder text**, which vanishes on first
  keystroke; card 02's birth-banner weight box has no adjacent unit label and
  (E7) no visible output on that card at all — a grams entry at the moment of
  birth gets zero feedback.
- **E3. "WEIGHT AND DATES DISAGREE" false-alarms on normal term babies.**
  The weight bands (`<1/<2/<3`) and GA bands (`<28/<34/<38`) have incompatible
  cutpoints: 3.0–3.5 kg at 37 wk and 2.8–2.9 kg at 39 wk — textbook-normal
  babies — both trip the red banner (`2895-2900`). Alarm fatigue here is what
  buries the one banner that could catch E1's true positives.
- **E4. Calculated IV epi volume sits directly under the ETT instruction.**
  The `.epimini` line ("→ this baby: 0.07 mg = 0.7 mL") is computed only from
  the 0.02 mg/kg IV rate but renders as the last line of a bullet whose
  nearest preceding sentence is the ETT dose (0.05–0.1 mg/kg — 2.5–5× more
  volume, never computed) (`597`, `2951`).
- **E5. Engine ETT size contradicts the static table on the same card:**
  ≥3 kg → "3.5–4.0" from the engine vs "2 kg and over — ETT 3.0–3.5" in the
  card-03 list twelve lines above (`2903` vs `628`).
- **E6. GA-only UVC sizing is wrong for 28–33 wk:** band ref-weight 1.5 with
  a strict `refW<1.5` gives **5 Fr** for the exact preterm population most
  likely to need a 3.5 Fr (`2901`, `2907`) — and contradicts card 04's own
  header rule ("3.5 Fr <1.5 KG").
- **E7. Card 02's weight box drives a panel that isn't on card 02** — the
  `.eqpanel` output exists only on cards 03/04.
- **E8. One scalar weight for a twins delivery** while the tool's own
  "Multiple — team per baby" chip is active: entering baby B's weight
  instantly overwrites baby A's on the card the other team is reading.
- **E9. Smaller items:** sub-0.05 kg rounds to an affirmative "0 mg = 0 mL";
  no periviability/comfort-care branch though GA ≥20 wk is accepted; `min`/
  `max` attributes are decorative (no form, no checkValidity) — negative
  weight sits visibly in the box while the panel silently falls back to GA;
  GA `9` (months) or `280` (days) accepted silently; comma-decimal `3,5`
  *deletes* the stored weight; no staleness/provenance on `lrh-ob-weight`
  (previous delivery's weight reappears indistinguishable from fresh); mg
  rendered to 3 dp vs mL to 2 dp (inconsistent read-aloud widths).
- **E10. Good news worth keeping:** `lrh-ob-weight` (the baby) is correctly
  isolated from `lrh-case-wtkg` (the mother/child case weight) per
  CASE-STATE.md, and every tool's RESET sweep correctly clears both. But note
  the flip side: the same 3.5 kg newborn can legitimately exist in both keys
  at once, and codes/PALS says epi 0.035 mg while ob/NRP says 0.07 mg — two
  confident answers, no cross-detection. Another reason the NRP banner in
  section A should name the dose divergence.

## F. Cross-cutting

- **F1. Units:** no lbs affordance anywhere — "44" for a 44 lb child produces
  internally consistent, 2.2×-high doses in every tool; no locale
  comma-decimal handling despite LOCALIZING.md (`parseFloat("3,5")` → 3 where
  the string reaches parseFloat; empty-string deletion in ob).
- **F2. One shared key, divergent ceilings and formulas** (C1, C2): pick one
  validation band (suggest `0 < kg < 300` enforced at *write* in every tool,
  with a visible rejection message) and one age→weight formula (peds' version,
  with its >12 y refusal) and copy them verbatim, the way the CASESTATE module
  already is.
- **F3. Terminology (side finding, golden rule 10):** `airway/index.html`
  says **"suxamethonium"** twice in UI copy (lines 93, 286); US convention is
  succinylcholine, and every other tool uses it. Note
  `verify_airway_screen.mjs:65` asserts the British spelling, so a fix must
  update both. Not in TERMINOLOGY.md's alias table yet.

## G. Suggested fix order

**Tier 1 — decide-and-do (needs your clinical sign-off on numbers/wording):**
1. NRP banner at <3 kg or age <1 mo in peds/arrest/codes + NRP link from TCA's
   OB workstream + arrest Broselow floor (section A).
2. Set `codes` `SITE.audience.thresholdKg` (candidate: 50, matching
   `arrestTrigger.maxKg`) and cite it — turns the existing warning machinery on.
3. Add the >12 y refusal + peds formula to arrest/tca estimators; kill the
   flat-70 kg branch (C2).
4. Cap arrest ETT epi and lidocaine; add `data-max` to codes' uncapped rows;
   implement the PCC 100 kg dosing-weight cap it already promises (C4, B8, B9).
5. ob-neonatal: plausibility gate (e.g. warn ≥10 kg "is this grams?" and
   hard-stop ≥25), fix the conflict-banner cutpoints, fix the UVC `<1.5`
   boundary, reconcile the ETT table, separate the ETT-dose sentence from the
   IV `.epimini` line (E1–E6).

**Tier 2 — mechanical, low-risk:**
6. Unify weight validation at write across arrest/peds/codes with a visible
   rejection message; stop arrest laundering provenance/`wtms` on keystrokes
   (C1, C5).
7. Arrest: implement override-clear-on-weight-change (or make codes' clear
   visible); add the stale strip + 60-min sweep (C3, C6).
8. Codes: fix `peds#p16` → a real card; restore the peds link when a weight is
   set; fix "0 mg" truncation (floor to the "enter weight" chip or show one
   decimal); repaint after estimate errors; persist the age unit (B3–B5, B11,
   B12).
9. TCA: adopt the shared case-state contract (weight in/out, log, RESET sweep,
   theme), or clearly label it standalone; fix the crystalloid float artifact;
   move the pregnancy flag into the running phase (D1, D4, D5).
10. `suxamethonium` → `succinylcholine` in airway + its verify script (F3).

**Deliberately not done in this pass:** no code changes — several fixes hinge
on clinical thresholds (NRP cutoff, audience threshold, dose caps) that per
CLAUDE.md rule 9/"flag, don't guess" are yours to set. Say the word and any
tier above can be implemented.
