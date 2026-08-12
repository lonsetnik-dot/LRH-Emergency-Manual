# Branch-deploy test checklist — weight routing fixes — 2026-08-12

Branch: `claude/weight-routing-edge-cases-19jsz0`
Test on the **Netlify branch deploy** (Netlify → Deploys → latest entry for this
branch → **"Open branch deploy"**). Not the GitHub compare page — that's only a
diff. Do this before merging to `main`.

Tap **RESET FOR NEXT CASE** between sections — several tests turn on per-case
state (the NRP banner's dismissal, the adult override).

---

## 1. Peds — the 1 kg case (the one you asked about)

Open `/peds/`.

1. Weight **1** → red banner appears under the weight bar: *"NEWLY BORN (first
   days of life)? → NEONATAL RESUSCITATION (NRP)"*, naming epi 0.02 vs 0.01 mg/kg.
   - Tap the **NRP link** → lands on OB & Neonatal card 03. Come back.
   - Zone strip reads **OUTSIDE BROSELOW-LUTEN RANGE (3–36 kg)**.
   - **Doses still calculate** (this is the point — dismissing must not be
     required to keep working). Check a dose is showing a number, not a dash.
2. Tap **DISMISS** → banner goes; doses unchanged. Change weight to **2** →
   banner stays dismissed (same case).
3. Weight **12** → no banner. Weight **2.9** → banner returns only after a
   RESET (dismissal is per-case, by design).
4. Age unit **months**, age **0.5** → banner appears from the age path too.
   Clear the age → banner goes.

## 2. Codes — pediatric guard now switched on (40 kg)

Open `/codes/`.

5. Weight **1** → NRP banner (as above) **and** every adult card's strip turns
   **red**: "⚠ 1 kg PATIENT · THIS CARD IS ADULT DOSES → …".
6. Weight **30** → still red (below 40 kg). Weight **45** → strip goes quiet
   grey **and is still tappable** ("45 kg · ADULT DOSES · TAP FOR …") — tap it,
   confirm it routes somewhere sensible, come back.
7. Card **03 Symptomatic Bradycardia** — its strip should say **"(OPENS ARREST
   TOOL)"** and land in `/arrest/` when tapped (it used to point at a peds card
   that doesn't exist).
8. Card **06 RSI**, weight **1** → etomidate reads **0.30 mg**, never "0 mg".
9. Card **21 STEMI**, weight **10** → the TNK band table refuses: *"this band
   table is an ADULT STEMI regimen…"* instead of highlighting "30 mg (<60 kg)".
   Weight **120** → band 50 mg highlights normally.
10. Card **10 Anticoagulant reversal**, weight **120** → 4F-PCC shows **5000
    units** (the 100 kg dosing-weight cap the card always promised), Kcentra
    INR 2–<4 shows **2500 units**.
11. Weight bar on a phone: enter **70** and confirm you can **see** the
    "70 kg (measured)" readout without scrolling the bar sideways.
12. Age unit **months**, age **9** → reload the page → field still reads **9**
    with **months** selected (not 0.75 / years).
13. With a measured weight entered, tap **ESTIMATE KG FROM AGE** → it asks for
    confirmation before replacing a measured weight. Cancel → weight unchanged.
    Then clear the age and tap ESTIMATE → error appears in its own line and the
    weight readout stays put.

## 3. Arrest — estimator, validation, caps

Open `/arrest/`.

14. Age **6** → **ESTIMATE KG** → **25 kg** (the manual's APLS formula; it used
    to say 20).
15. Age **16** → ESTIMATE → refuses: *"AGE ESTIMATE VALID TO 12 y — USE A
    MEASURED WEIGHT"*. (Before, it produced 40 kg and silently flipped the tool
    into pediatric shock energies.)
16. Age unit **mo**, age **3** → ESTIMATE → **5.5 kg**, not 14.
17. Weight **350** → red *"CHECK WEIGHT — … NOT SAVED"*, and the previous
    weight keeps driving the doses. Weight **2** → NRP banner; Broselow chip
    does **not** claim a Grey drawer.
18. Weight **45**, start a code, open the **EPI** accordion → "Via ETT … =
    **2.5 mg**" (capped; it used to read 4.5 mg).

## 4. OB & Neonatal — grams, and the checks around it

Open `/ob-neonatal/`, card 03 (or card 02's birth banner).

19. Weight **650** → panel header reads **"650 g = 0.65 kg"** and epi shows
    **0.013 mg = 0.13 mL**. (Your example.)
20. Weight **3500** → **"3500 g = 3.5 kg"**, epi **0.07 mg = 0.7 mL**.
21. Weight **25** or **70** → **hard stop**, no sizes and no doses: *"not a
    plausible birth weight … Older infant/child → Peds tool"* (the link works).
22. Weight **3.2**, gestation **37** → **no** "WEIGHT AND DATES DISAGREE"
    banner (a normal term baby used to trip it). Weight **3.5**, gestation
    **24** → the banner **does** fire.
23. Clear the weight, gestation **30** → **UVC 3.5 Fr** (was wrongly 5 Fr for
    28–33 weeks). Gestation **38** → 5 Fr.
24. Gestation **9** or **280** → visible *"CHECK WEEKS GESTATION … months or
    days?"*.
25. In the compressions section there are now **two separate epi items**:
    - **EPI · IV/UVC** → "this baby IV/UVC: 0.07 mg = 0.7 mL" (at 3.5 kg)
    - **EPI · ETT (NO ACCESS YET)** → "this baby ETT (once): 0.175–0.35 mg =
      1.8–3.5 mL" — the larger volume, now calculated rather than left to
      mental math beside the IV figure.
26. Card 02 birth banner: type a weight → the echo line under it reads back
    what the tool understood ("= 3.5 kg · drives sizes + doses on cards 03/04").
27. Tap the **Multiple — team per baby** chip with a weight entered → amber
    warning that this is one shared weight field.
28. **Check against your stock:** the ETT table on card 03 now reads "ETT 3.5
    (≥3 kg: 3.5–4.0)" to match the engine, per your "keep 3.5–4.0" answer.

## 5. TCA — now part of the shared case

Open `/tca/`.

29. Enter weight **25** in `/arrest/`, then open `/tca/` → the **25 kg is
    already there** (it used to start blank every time).
30. At 25 kg the pediatric bar shows; **TXA 375 mg**, **crystalloid 500 mL
    (max 1 L/bolus)**. Tap **ADULT — OVERRIDE** → TXA switches to the adult
    "1 g IV over 10 min…" regimen and an amber undo bar appears. (A 45 kg frail
    adult had no way out of pediatric dosing before.)
31. Change the weight → the override **clears itself** and says so in the log.
32. Weight **3.06** → crystalloid reads **61 mL**, not "61.20000000000001 mL".
33. Start the resus, then find the **pregnancy toggle inside the running
    screen** → tapping it makes the **OBSTETRIC** workstream appear, which now
    carries a **Neonatal resuscitation (NRP)** link and a "baby delivered = a
    second patient" line. (Mid-case flagging was impossible before.)
34. Open the **debrief/case timeline** from another tool → TCA's events are now
    in it (they were invisible to the shared timeline before).
35. **RESET** in TCA now clears the whole manual's case, like arrest's
    identical-looking button — confirm that's what you want it to do.
36. Toggle the theme in another tool, then open TCA → it opens in that theme
    (it used to always load dark). A **MANUAL** back-link is now in the header.

## 6. Labels — print check

Open `/labels/`.

37. Code cart **i-gel** label now lists **1 · 2–5 kg** through **5 · 90+ kg**,
    plus the line *"Newborn / under 2 kg → LMA 0 or 0.5 on the OB cart"*.
    **Confirm the weight bands match what's actually in the drawer**, then
    print one and check it still fits the label slot with 7 size chips.
38. **EZ-IO** label carries *"Under 3 kg / newly born → umbilical vein catheter
    (OB cart), not an IO."*

## 7. Cross-tool sanity

39. Open `/peds/` and `/codes/` in two tabs. Enter **18** in peds → switch to
    codes → **it now shows 18** and its doses have recomputed (each tab used to
    keep its load-time weight forever).
40. Site search: **"newborn"**, **"newly born"**, **"birth weight"** all
    surface the NRP card. **"epinephrine"** still ranks Cardiac Arrest and
    Anaphylaxis first (unchanged).
41. `/airway/` says **succinylcholine**, not suxamethonium, in both the
    pre-induction card and the Plan A detail.

---

## Two things needing your judgment

- **Dose caps** are display ceilings I set from common practice and marked
  "verify locally" in the files: arrest ETT epi 2.5 mg, lidocaine 100/50 mg;
  codes TXA 1 g, etomidate 40 mg, ketamine/propofol/sux 200 mg, rocuronium
  120 mg, crystalloid 2 L/bolus, PCC per the 100 kg dosing-weight cap; TCA
  crystalloid 1 L peds / 2 L adult. Change any of them and I'll re-push.
- **Site search can't find "newborn epinephrine"** — it matches contiguous
  substrings, and I left "epinephrine" out of the NRP entry's keywords
  deliberately (adding it made NRP outrank Cardiac Arrest and Anaphylaxis for a
  plain "epinephrine" search). Say the word if you'd rather have it the other
  way.

**Not done, and why:** the audit's item 9 note that codes' RSI card doses off
total body weight with no ideal-body-weight model for obesity — that's new
clinical content, not a bug fix, so it stays in the audit doc for you to scope.
