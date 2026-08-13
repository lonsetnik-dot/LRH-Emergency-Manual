# Test checklist — 2026-08-09 release

Everything that changed in this round, in the order worth testing it. Twelve GitHub issues, plus
four structural changes that were not issues.

**Where to test.** Nothing is deployed yet, so localhost is the only place this exists:

```
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Documents/Lon/Job\ <site>/Emergency\ Manual/dev.nosync/edm-clinical-site
python3 -m http.server 8123
```

**Are you on the right build?** Open `/codes/?from=home` — if card 23 Massive Hematemesis is not in
the menu, you are on an old build. Second tell: the cart section says 5 DRAWERS, and drawer 2 is
Surgical / Supraglottic.

---

## 1. Automated — run these first, they cover most of it

- [ ] `node verify_issues_20260809.mjs` → **120 passed, 0 failed**
- [ ] `node verify_ws24_hematemesis.mjs` → **40 passed, 0 failed**
- [ ] `node verify_kit_consistency.mjs` → **all kits consistent** (16 kits)
- [ ] `node verify_poster_pages.mjs` → **10/10 print to exactly one page**
- [ ] `node verify_bugfix_20260808.mjs` → 31 passed
- [ ] `node verify_arrest_merge.mjs` → 41 passed
- [ ] `node verify_qr_scan.mjs` then decode → **62/62** (needs pyzbar; the script prints how)

If any of these fail, stop and send me the output. The rest of this list is the things a test cannot
judge: whether the clinical content is right, and whether the thing reads well at the bedside.

---

## 2. New cards — is the medicine right?

This is the part only you can do. Every card is a draft; the question on each is whether you would
hand it to a colleague at 3am.

### #24 · Codes card 23 · Massive Hematemesis
- [ ] Resuscitate-first framing is right: blood not crystalloid, permissive hypotension
- [ ] Hb targets ≥7 non-variceal / ~8 variceal match your practice
- [ ] Octreotide 50 mcg bolus then 50 mcg/hr, ceftriaxone 1 g — dosing and the "not optional" framing
- [ ] **PPI shown as two options (A: none, First10EM / B: pantoprazole, WikEM)** — is that the right call, or does this site have a house position?
- [ ] **TXA said to be contraindicated (HALT-IT)** — confirm no local order set still includes it
- [ ] Aortoenteric fistula warning is prominent enough
- [ ] Balloon tamponade numbers match the Blakemore poster

### #25 · Codes card 24 · Massive Hemoptysis
- [ ] "Bleeding lung DOWN" and the do-not-reflexively-intubate framing
- [ ] ETT ≥8.0 and the reason given for it
- [ ] Blind mainstem numbers (95% right, 73% left) and the bougie technique for the left
- [ ] Nebulized TXA 500 mg vs IV 1 g — is the both-routes option right for this site?
- [ ] The explicit contrast with card 23, where TXA is contraindicated

### #26 · Codes card 25 · Epistaxis
- [ ] The escalation check at the top — bleeding into the oropharynx treated as an airway
- [ ] Pressure on cartilage not bridge, held uninterrupted
- [ ] Rapid Rhino: sterile water 30 s, **air only** — matches the devices you stock
- [ ] Foley volumes 5–7 mL, max 15 mL
- [ ] Every posterior pack admitted on telemetry — is that your rule?
- [ ] **Antibiotics after packing shown as two options** — house position, or leave it as a choice?

### #36 · Codes card 26 · Pacemaker / ICD
- [ ] **The magnet asymmetry** — ICD: shocks off, pacing unchanged; pacemaker: asynchronous. This is the highest-risk statement in the whole release.
- [ ] Magnet rates by manufacturer — cross-check against a device card if you have one to hand
- [ ] Do-not-magnet list (appropriate shocks, pacing-dependent, no pads on)
- [ ] Electrical storm: **first-line drug shown as two options** (beta-blocker WikEM / procainamide First10EM)
- [ ] Brugada exception — isoproterenol, not beta-blockers
- [ ] Pads ≥8 cm from the generator, anterior-posterior

### #27 · Procedures card 15 · SALAD
- [ ] The three trajectories are the right framing and the actions match each
- [ ] Trajectory 3 (from above) — do NOT park deep. Confirm that reads clearly
- [ ] Evidence section is honest about how thin it is
- [ ] Cross-links to cards 23, 24 and 25 land in the right places

### #34 · Procedures card 16 · Pigtail chest tube
- [ ] Triangle of safety and the above-the-rib rule
- [ ] **Traumatic haemothorax shown as two options (28–32 Fr vs 14 Fr, P-CAT)** — this one needs your surgeons before it ships
- [ ] Lidocaine ceiling 3 mg/kg / 250 mg
- [ ] Never clamp a bubbling drain; 1.5 L then clamp
- [ ] The note that the anterior 2nd-space approach is deliberately not described

---

## 3. Interactive behaviour — click these

### #30 DSED / vector change
- [ ] On card 01, tap the shock button 4 times → a **REFRACTORY VF** cue appears
- [ ] It does **not** appear before the rhythm-check or epi-due cues — those still take priority
- [ ] The REFRACTORY VF section says Class 2b and "not recommended" as plainly as the DOSE-VF numbers
- [ ] Decide: **is DSED in scope at this site at all?** It needs two identical defibrillators, a second pad set, a designated operator and a post-use device check

### #31 Broselow colour
- [ ] Enter 20 kg on card 01 → chip appears reading **BLUE ZONE 19–23 kg**, coloured blue
- [ ] Tapping it goes to the peds cart labels
- [ ] Enter 80 kg → chip disappears
- [ ] Try 5.5 kg and 36 kg — the band edges

### #20 Epinephrine in mg and mL
- [ ] Card 01 arrest epi reads **1 mg = 10 mL of 0.1 mg/mL**
- [ ] Card 08 IM epi reads **0.3–0.5 mg = 0.3–0.5 mL of 1 mg/mL**, with the warning off the cardiac syringe
- [ ] Epi drip shows a mL/hr equivalent — **check the 16 mcg/mL bag assumption against what pharmacy actually hangs**
- [ ] Escalation step 3 links to the airway card

### Search
- [ ] From the landing page, search finds: hematemesis, hemoptysis, nosebleed, magnet, salad, pigtail, blakemore

---

## 4. The code cart — the structural change

- [ ] Cart section says **5 DRAWERS · BOTTOM DRAWER IS DEEP**
- [ ] Drawer 2 is **Surgical / Supraglottic**; drawer 5 is **I.V. Supplies + Miscellaneous**
- [ ] The old drawer 6 contents (PPE, sharps, documentation, spare pads) are inside drawer 5
- [ ] Every card badge points somewhere sensible — no badge says 6
- [ ] Drawer 2 badges are blue with a diamond; drawer 5 gold with a pill (colour and shape follow position, not contents)
- [ ] **Decide on the EZ-IO.** It is now in the deep drawer as part of I.V. Supplies. Promote it to drawer 4 with the fluids, or leave the category intact?
- [ ] **Physical job: move the contents, and reprint the cart's own label strip.** Right now the app describes the swapped cart and the sticker on the front describes the old one — that mismatch is worse than either alone.

---

## 5. Labels and print — open /labels/ and hit Cmd+P

Everything here is judged in **print preview**, not on screen. The screen view is a proof sheet.

- [ ] **#29** Every drawer face and every cabinet door carries a QR
- [ ] Slim inserts still have none, and the printed reason is still on the sheet
- [ ] **#33** The 4 × 6 in procedure cards render, one per kit, each with EARLIEST EXPIRY / NEXT CHECK DUE / CHECKED BY / RESTOCKED BY
- [ ] Kit build sheets render — one per kit, with a quantity column and four signature fields
- [ ] New the resus room door labels: **GI Hemorrhage, Lung Isolation, Epistaxis, SALAD Suction, Transvenous Pacing**
- [ ] Nothing is clipped at a page edge; no QR is split across a page break
- [ ] Print one page in **black and white** — every drawer must still be identifiable by number, word and shape

---

## 6. Draft kits — the ten new ones

For each: is the split between what is in the bag and what is not correct, and are the quantities sane?

- [ ] Chest Tube Kit — tubes and the primed seal deliberately outside the bag
- [ ] Thoracotomy Tray — sealed; PPE deliberately outside it
- [ ] Burr Hole Kit — **confirm the perforator stocked is the clutched, self-stopping type**
- [ ] Central Line Kit
- [ ] Transvenous Pacing Kit — generator beside the bag, not in it. **Does a generator exist and where?**
- [ ] Escharotomy Kit
- [ ] Neck Tamponade Kit
- [ ] Junctional Hemorrhage Kit — **do you stock a junctional tourniquet at all?**
- [ ] JADA Kit — **can the vacuum source hold a gauge-visible 80 mmHg?**
- [ ] Resuscitation Line Kit
- [ ] Agree that pelvic binder and tourniquet correctly get **no** kit — they are single devices

---

## 7. Layout change — figures moved to the top

- [ ] Eleven procedure cards now open with the figure above the checklist
- [ ] TVP and JADA deliberately keep theirs lower (they are settings references, not orientation) — agree or not?
- [ ] **The one to watch:** on a phone the figure now pushes the first checklist item below the fold. Card 05 canthotomy is the test case — if you are doing one you already know what it looks like, and the drawing is now between you and the steps. Does that feel wrong?

---

## 8. Only testable after it is live

The QR codes encode absolute `your-manual-domain` URLs, so a scanned code ignores localhost and
any branch preview entirely. **Do not print labels until the cards are live.**

- [ ] After merging to main, scan one code from each family with a phone: a drawer face, a cabinet door, a kit card, a wall poster
- [ ] Blakemore poster QR lands on card 23
- [ ] `BASE=https://your-manual-domain node verify_issues_20260809.mjs` passes against production

---

## 9. Known gaps — not testable, just true

- Sixteen kits have labels, build sheets and expiry cards. **None of them physically exist.**
- All PAR counts are placeholders.
- Cabinet contents are best-guess pending a walk-round.
- "the resus room" and "resus bay cabinet" have been unified to `the resus room CABINET` — **confirm they are the same cupboard.**
- Slim-slot dimensions are from photographs, not measured.
- `/favicon.ico` 404s sitewide; there is no favicon in the repo.
