/* ===========================================================================
   inventory.js — LRH Emergency Manual equipment inventory (single source).

   Injected by build.mjs wherever a tool's <script> contains the marker
   (slash-star) @inventory (star-slash), so deployed tools stay fully
   self-contained and offline (CLAUDE.md rule 1). Edit the inventory ONCE here.
   Design + process: INVENTORY-DESIGN.md. Consumers today:
   equipment-readiness/ and simulations/ (which share ONE capture store — see
   INV_CAPTURE below). labels/ migrates on later.

   TWO LAYERS (design decision, Lon 2026-08-12):
   - CATALOG + STANDARDS + BROSELOW_PACK are UNIVERSAL — a fork keeps them.
   - LOCATIONS is the LOCAL MAP — the only block another ED edits.

   THREE THINGS CHANGED IN v2 (2026-08-12), all of them because a readiness
   audit that cannot name a size cannot find a hole:

   1. SIZES ARE ROWS. An item may carry `sizes:[...]`; each size is its own
      auditable row, keyed `id#size`. "Supraglottic airways 1–5: MAPPED" hides
      the only question worth asking, which is whether the size for the patient
      in front of you is in that drawer. LMA 0 and 0.5 live on the OB cart and
      the i-gels start at 1 — that is invisible at item granularity and obvious
      at size granularity.
   2. STANDARDS ARE PLURAL. NPRP is the pediatric checklist only; it says
      nothing about a pelvic binder, a rapid infuser, dantrolene, or a
      difficult-airway trolley. Six more national standards now sit alongside
      it (see INV_STANDARDS). An item belongs to a standard by listing it in
      `std` — the `items` array on each standard is DERIVED from that at the
      bottom of this file, so membership is edited in exactly one place.
   3. KITS CARRY CONTENTS. A kit is audited as a kit: one location, and the
      contents underneath it. The content strings are byte-identical to the
      labels/ build sheets and the procedure cards on purpose —
      verify_kit_consistency.mjs asserts that across every artifact.

   Granularity rule: sizes where a standard (or this department's own stock
   reality) names sizes; drawer/kit level elsewhere. Par yes, expiry no.
   =========================================================================== */

/* ===== LAYER 1 — STANDARD CATALOG (universal; forks do not edit) ==========
   name : what a clinician calls it.        cat : grouping for the UI.
   std  : which national standards ask for it (drives the scorecards).
   sizes: each entry becomes its own auditable row, id#size.
   note : universal caveat about the item — NOT a local location note.       */
var INV_CATALOG = {

  /* ---------------- MONITORING & DIAGNOSTICS ---------------------------- */
  "bp-cuffs": { name:"Blood-pressure cuffs", cat:"monitoring", std:["NPRP"],
    sizes:["neonatal","infant","child","small adult","adult","large adult / thigh"] },
  "ecg-electrodes": { name:"ECG cables + electrodes", cat:"monitoring", std:["NPRP","NRP"],
    sizes:["neonatal / infant","pediatric","adult"] },
  "defib": { name:"Monitor–defibrillator with pediatric capability", cat:"monitoring", std:["NPRP","ACS-COT"],
    sizes:["adult pads","pediatric pads / attenuator","internal paddles (thoracotomy)"] },
  "pulseox": { name:"Pulse oximeter with probes across the age range", cat:"monitoring", std:["NPRP","NRP"],
    sizes:["neonatal","infant","pediatric","adult"] },
  "etco2": { name:"Continuous waveform end-tidal CO2", cat:"monitoring", std:["NPRP","ACS-COT"],
    sizes:["pediatric line","adult line"] },
  "co2-detector": { name:"Colorimetric CO2 detector (tube confirmation)", cat:"monitoring", std:["ASA-DA","NRP"],
    sizes:["neonatal","pediatric / adult"] },
  "thermometer-hypo": { name:"Hypothermia-capable thermometer (reads below 35 °C)", cat:"monitoring", std:["NPRP","ACS-COT"] },
  "scale-kg": { name:"Scale weighing in kilograms only", cat:"monitoring", std:["NPRP"] },
  "broselow-tape": { name:"Length-based resuscitation tape (Broselow)", cat:"monitoring", std:["NPRP"] },
  "glucometer": { name:"Bedside glucose meter", cat:"monitoring", std:["NPRP","NRP"] },
  "doppler": { name:"Doppler ultrasound (pulses / BP)", cat:"monitoring", std:["NPRP"] },
  "ultrasound": { name:"Ultrasound at the bedside — FAST, vascular, cardiac", cat:"monitoring", std:["ACS-COT","AIM-OB"] },
  "xray-portable": { name:"Portable radiography into the resuscitation bay", cat:"monitoring", std:["ACS-COT"] },
  "abg-syringes": { name:"Blood-gas syringes + point-of-care analyzer access", cat:"monitoring", std:["MHAUS","ACS-COT"] },

  /* ---------------- AIRWAY ---------------------------------------------- */
  "opa": { name:"Oropharyngeal airways", cat:"airway", std:["NPRP","NRP"],
    sizes:["0 · 40 mm","1 · 50 mm","2 · 60 mm","3 · 70 mm","4 · 80 mm","5 · 90 mm"] },
  "npa": { name:"Nasopharyngeal airways", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["infant / child","small adult · 6.5 mm","adult · 7.5 mm","large adult · 8.5 mm"] },
  "sga-neonatal": { name:"Supraglottic airway — neonatal LMA", cat:"airway", std:["NPRP","NRP"],
    sizes:["LMA 0 · under 2 kg","LMA 0.5 · 2 kg and over"],
    note:"NRP names a size 1 laryngeal mask; LRH stocks LMA 0 and 0.5 instead and the i-gels start at size 1. Audit what is on the shelf, not what the checklist prints." },
  "sga-igel": { name:"Supraglottic airway — i-gel", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["1 · 2–5 kg","1.5 · 5–12 kg","2 · 10–25 kg","2.5 · 25–35 kg","3 · 30–60 kg","4 · 50–90 kg","5 · 90+ kg"],
    note:"Weight bands are the manufacturer's — verify against the brand actually stocked." },
  "ett-uncuffed": { name:"Endotracheal tubes — uncuffed", cat:"airway", std:["NPRP","NRP"],
    sizes:["2.5","3.0","3.5"] },
  "ett-cuffed": { name:"Endotracheal tubes — cuffed", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["3.0","3.5","4.0","4.5","5.0","5.5","6.0","6.5","7.0","7.5","8.0"] },
  "ett-90": { name:"Endotracheal tube 9.0 (lung isolation / bronchoscopy)", cat:"airway", std:["ACS-COT"] },
  "stylets": { name:"ETT stylets", cat:"airway", std:["NPRP","ASA-DA","NRP"],
    sizes:["neonatal / pediatric 6 Fr","adult 14 Fr"] },
  "bougie": { name:"Tube introducers (bougie)", cat:"airway", std:["ASA-DA","ACS-COT"],
    sizes:["pediatric 10 Fr","adult 15 Fr","coudé tip (lung isolation)"] },
  "exchange-catheter": { name:"Airway exchange catheter", cat:"airway", std:["ASA-DA"] },
  "blades-mac": { name:"Laryngoscope blades — Macintosh (curved)", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["2","3","4"] },
  "blades-miller": { name:"Laryngoscope blades — Miller (straight)", cat:"airway", std:["NPRP","ASA-DA","NRP"],
    sizes:["00","0","1","2","3"] },
  "laryngoscope-handles": { name:"Laryngoscope handles + spare batteries / bulbs", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["pediatric (short) handle","adult handle","spare batteries"] },
  "videolaryngoscope": { name:"Videolaryngoscope + charged spare blade", cat:"airway", std:["ASA-DA","ACS-COT"],
    sizes:["adult blade","hyperangulated blade","pediatric blade"] },
  "flex-scope": { name:"Flexible intubation scope (or single-use equivalent)", cat:"airway", std:["ASA-DA"],
    note:"ASA lists a flexible scope in the portable difficult-airway unit. Many critical-access EDs do not stock one — record that as a gap rather than leaving the row blank." },
  "fona-kit": { name:"Front-of-neck access — scalpel, bougie, tube 6.0", cat:"airway", std:["ASA-DA","ACS-COT"] },
  "jet-vent": { name:"Transtracheal jet ventilation setup", cat:"airway", std:["ASA-DA"] },
  "topical-airway": { name:"Topical anesthetic + vasoconstrictor for an awake airway", cat:"airway", std:["ASA-DA"] },
  "magill": { name:"Magill forceps", cat:"airway", std:["NPRP","ASA-DA"],
    sizes:["pediatric","adult"] },
  "trach-tubes": { name:"Tracheostomy tubes", cat:"airway", std:["NPRP"],
    sizes:["0","1","2","3","4","5","6"] },
  "suction-cath": { name:"Suction catheters", cat:"airway", std:["NPRP","NRP"],
    sizes:["5 Fr","6 Fr","8 Fr","10 Fr","12 Fr","14 Fr"] },
  "suction-rigid": { name:"Rigid suction — Yankauer + large-bore (DuCanto)", cat:"airway", std:["ACS-COT","ASA-DA"],
    sizes:["Yankauer","large-bore rigid"] },
  "suction-units": { name:"Two working suction units at the resuscitation bay", cat:"airway", std:["ACS-COT"] },
  "ng-tubes": { name:"Nasogastric / orogastric tubes", cat:"airway", std:["NPRP","MHAUS"],
    sizes:["8 Fr","10 Fr","12 Fr","14 Fr","16 Fr","18 Fr"] },

  /* ---------------- BREATHING / OXYGEN ---------------------------------- */
  "bvm": { name:"Self-inflating bag–valve–mask", cat:"breathing", std:["NPRP","NRP"],
    sizes:["infant · 450 mL","adult · 1000 mL"] },
  "face-masks": { name:"Ventilation face masks", cat:"breathing", std:["NPRP","NRP"],
    sizes:["preterm / 00","neonatal / 0","infant / 1","child / 2","adult / 3–5"] },
  "tpiece-resus": { name:"T-piece resuscitator with manometer + PEEP", cat:"breathing", std:["NRP"] },
  "o2-blender": { name:"Oxygen blender with flowmeter (delivery-room titration)", cat:"breathing", std:["NRP"] },
  "o2-masks": { name:"Oxygen masks — non-rebreather across the age range", cat:"breathing", std:["NPRP"],
    sizes:["infant","child","adult"] },
  "nasal-cannula": { name:"Nasal cannulae", cat:"breathing", std:["NPRP"],
    sizes:["neonatal","infant","pediatric","adult"] },
  "meconium-aspirator": { name:"Meconium aspirator", cat:"breathing", std:["NRP"] },
  "bulb-syringe": { name:"Bulb syringe", cat:"breathing", std:["NRP"] },

  /* ---------------- VASCULAR ACCESS & TRANSFUSION ----------------------- */
  "io-needles": { name:"Intraosseous needles", cat:"vascular", std:["NPRP","ACS-COT"],
    sizes:["15 mm · 3–39 kg","25 mm · 40 kg and over","45 mm · humeral / large habitus"] },
  "iv-cath": { name:"IV catheters", cat:"vascular", std:["NPRP","ACS-COT"],
    sizes:["24 g","22 g","20 g","18 g","16 g","14 g"] },
  "uvc": { name:"Umbilical vein catheters", cat:"vascular", std:["NPRP","NRP"],
    sizes:["3.5 Fr","5 Fr"] },
  "umbilical-tray": { name:"Umbilical line tray — scalpel, tape, clamp, stopcock", cat:"vascular", std:["NRP"] },
  "cvc-peds": { name:"Central venous catheters — pediatric sizes", cat:"vascular", std:["NPRP"],
    sizes:["4 Fr","5 Fr","7 Fr"] },
  "art-line": { name:"Arterial line set — catheter, transducer, pressure bag", cat:"vascular", std:["ACS-COT"],
    sizes:["20 g adult","22 g pediatric"] },
  "iv-sets-calibrated": { name:"Calibrated-chamber IV sets / infusion pumps", cat:"vascular", std:["NPRP"] },
  "pressure-infuser": { name:"Pressure infuser bags", cat:"vascular", std:["ACS-COT","AIM-OB"] },
  "rapid-infuser": { name:"Rapid infuser / high-flow transfusion device", cat:"vascular", std:["ACS-COT"] },
  "fluid-warmer": { name:"Fluid / blood warming capability", cat:"vascular", std:["NPRP","ACS-COT","AIM-OB"] },
  "mtp-cooler": { name:"Massive transfusion cooler — immediate uncrossmatched red cells", cat:"vascular", std:["ACS-COT","AIM-OB"] },
  "blood-tubing-filters": { name:"Blood administration sets with filters", cat:"vascular", std:["ACS-COT","AIM-OB"] },
  "warming-device": { name:"Patient warming — forced-air or warmed blankets", cat:"vascular", std:["ACS-COT"] },
  "radiant-warmer": { name:"Radiant warmer (infant)", cat:"vascular", std:["NPRP","NRP"] },

  /* ---------------- HEMORRHAGE & TRAUMA --------------------------------- */
  "tourniquet": { name:"Extremity tourniquet (CAT or equivalent)", cat:"hemorrhage", std:["ACS-COT"] },
  "hemostatic-gauze": { name:"Hemostatic gauze", cat:"hemorrhage", std:["ACS-COT"] },
  "pressure-dressings": { name:"Pressure dressings + roller gauze for packing", cat:"hemorrhage", std:["ACS-COT"] },
  "pelvic-binder": { name:"Pelvic binder (or correctly applied sheet)", cat:"hemorrhage", std:["ACS-COT"] },
  "chest-seal": { name:"Vented occlusive chest seals", cat:"hemorrhage", std:["ACS-COT"] },
  "needle-decompression": { name:"Needle decompression catheter — 14 g, 3.25 in", cat:"hemorrhage", std:["ACS-COT"] },
  "txa": { name:"Tranexamic acid", cat:"hemorrhage", std:["ACS-COT","AIM-OB"] },
  "trauma-shears": { name:"Trauma shears", cat:"hemorrhage", std:["ACS-COT"] },

  /* ---------------- PROCEDURAL / IMMOBILIZATION ------------------------- */
  "chest-tubes": { name:"Chest tubes", cat:"procedure", std:["NPRP","ACS-COT"],
    sizes:["8–10 Fr (infant)","12 Fr","14 Fr pigtail","20 Fr","24 Fr","28 Fr","32 Fr","36–40 Fr"] },
  "drainage-system": { name:"Underwater-seal drainage system, primed", cat:"procedure", std:["ACS-COT"] },
  "c-collars": { name:"Cervical collars", cat:"procedure", std:["NPRP","ACS-COT"],
    sizes:["infant","pediatric","short-neck adult","regular adult","tall adult"] },
  "femur-splints": { name:"Femoral traction splints", cat:"procedure", std:["NPRP","ACS-COT"],
    sizes:["pediatric","adult"] },
  "lp-trays": { name:"Lumbar puncture trays", cat:"procedure", std:["NPRP"],
    sizes:["22 g infant / pediatric","20 g adult"] },
  "urinary-cath": { name:"Urinary catheters", cat:"procedure", std:["NPRP","AIM-OB","MHAUS"],
    sizes:["5 Fr feeding tube","8 Fr","10 Fr","12 Fr","14 Fr","16 Fr","22 Fr"] },
  "urimeter": { name:"Urimeter (hourly output during a crisis)", cat:"procedure", std:["MHAUS","AIM-OB"] },
  "ppe-splash": { name:"Splash PPE — gown, double gloves, eye protection", cat:"procedure", std:["ACS-COT"] },

  /* ---------------- OBSTETRIC & NEONATAL -------------------------------- */
  "ob-delivery-kit": { name:"Precipitous delivery kit", cat:"obstetric", std:["NPRP","NRP","AIM-OB"] },
  "neo-thermal": { name:"Neonatal thermal bundle — warm towels, hat, polyethylene bag under 32 weeks", cat:"obstetric", std:["NRP"] },
  "epi-neonatal": { name:"Epinephrine 0.1 mg/mL with a dosing chart at the warmer", cat:"obstetric", std:["NRP"] },
  "volume-expander-neo": { name:"Normal saline for neonatal volume expansion + flushes", cat:"obstetric", std:["NRP"] },
  "uterotonics": { name:"Uterotonics, immediately available", cat:"obstetric", std:["AIM-OB"],
    sizes:["oxytocin","methylergonovine","carboprost","misoprostol"] },
  "intrauterine-balloon": { name:"Intrauterine balloon tamponade device", cat:"obstetric", std:["AIM-OB"] },
  "ob-long-instruments": { name:"Long instruments — weighted speculum, sponge / ring forceps, long needle holder", cat:"obstetric", std:["AIM-OB"] },
  "vaginal-packing": { name:"Vaginal packing gauze", cat:"obstetric", std:["AIM-OB"] },
  "qbl-kit": { name:"Quantitative blood loss — graduated drape + gram scale", cat:"obstetric", std:["AIM-OB"] },
  "pph-instruction-cards": { name:"Hemorrhage cart checklist + balloon / compression-suture instruction cards", cat:"obstetric", std:["AIM-OB"] },

  /* ---------------- ANTIDOTE / RESCUE STOCK ----------------------------- */
  "dantrolene": { name:"Dantrolene — full initial + repeat dosing on hand", cat:"medication", std:["MHAUS"],
    sizes:["Ryanodex 250 mg vials","dantrolene 20 mg vials"],
    note:"MHAUS expects enough for repeat dosing, not a single vial. Stock ONE presentation and mark the other a gap — mixing the two invites a reconstitution error under pressure." },
  "sterile-water-mh": { name:"Preservative-free sterile water for dantrolene reconstitution", cat:"medication", std:["MHAUS"] },
  "cold-saline": { name:"Cold normal saline 3 L (refrigerated) + ice", cat:"medication", std:["MHAUS"] },
  "mh-hotline-card": { name:"MH hotline number posted with the cart", cat:"reference", std:["MHAUS"] },
  "lipid-emulsion": { name:"Lipid emulsion 20% — 1000 mL", cat:"medication", std:["ASRA-LAST"] },
  "last-tubing": { name:"Large-bore IV tubing + two 50 mL syringes for lipid rescue", cat:"medication", std:["ASRA-LAST"] },
  "last-checklist": { name:"LAST checklist card stored with the lipid", cat:"reference", std:["ASRA-LAST"] },

  /* ---------------- REFERENCE ------------------------------------------- */
  "peds-dosing-ref": { name:"Length-based pediatric drug dosing reference", cat:"reference", std:["NPRP"] },
  "mtp-protocol-card": { name:"Massive transfusion protocol card at the bedside", cat:"reference", std:["ACS-COT","AIM-OB"] },

  /* ---------------- NAMED KITS (audited as kits, contents underneath) ----
     Content strings are byte-identical to labels/ build sheets and the
     procedure cards — verify_kit_consistency.mjs asserts that. ----------- */
  "kit-canthotomy": { name:"Canthotomy Kit", cat:"kit", std:["ACS-COT"], contents:[
    "3 mL syringe","Needle to draw","Needle to inject","Mosquito clamp","Toothed forceps","Blunt-tipped iris scissors"] },
  /* SUPERSEDED 2026-08-14 — Lon supplied the department's own typed kit sheet,
     which replaces BOTH earlier reconstructions. Two Claude sessions had rebuilt
     this bag hours apart from different sources (a cart walk vs. a build photo),
     disagreed, and were adjudicated by hand; the typed sheet ends that argument
     and is the source of truth now.

     What the sheet changed, relative to what was here:
       - BOTH preps are in the bag — a ChloraPrep 10.5 mL swab AND a
         povidone-iodine swab. The previous list carried one or the other and
         the two sessions had argued about which; the answer is both. (The typed
         sheet spells it "Chloropropyl"; Lon confirmed 2026-08-14 that it is
         ChloraPrep, so the product name is corrected here rather than
         transcribed. The 10.5 mL applicator size is kept from the sheet.)
       - Silk 0 is TWO sutures, not one, and the sheet does not specify the
         needle. "on a cutting needle" is therefore dropped rather than carried
         forward unverified.
       - Scissors are LONG CURVED BLUNT, not curved Mayo.
       - Kelly clamps are one LARGE and one MEDIUM — two different sizes, which
         "curved Kelly clamps x2" hid.
       - The needle driver is the LARGE one.
       - The syringe, the blunt draw needle and the 25 gauge 1½ needle are three
         separate peel packs, not one combined line.
       - OUT of the bag: the Foley catheter 16 Fr, the toothed tissue forceps,
         and the large Tegaderm. All three were on the previous list.
       - Fenestrated drape and half drape stay in, confirmed directly.

     The dressing supplies are a SEPARATE nursing bag and are now itemized as
     their own kit below rather than described in prose. PPE is not in either
     bag — it is Trauma Cart drawer 5 (cart walk, 2026-08-13).

     Lidocaine is still not bagged: only the draw and inject supplies are, and
     the drug comes from the Omnicell. */
  "kit-chest-tube": { name:"Chest Tube Kit", cat:"kit", std:["ACS-COT"],
    contents:[
    "ChloraPrep 10.5 mL swab","Povidone-iodine swab","Silk 0 sutures",
    "Scalpel No. 10","Blunt needle","10 mL syringe","25 gauge 1½ needle",
    "Long curved blunt scissors","Large needle driver","Large Kelly clamp",
    "Medium Kelly clamp","Fenestrated drape","Half drape"],
    absent:["Foley catheter 16 Fr","Toothed tissue forceps","Curved Mayo scissors","Large Tegaderm"] },
  /* The nursing half of the same procedure. Kept as its own kit because it is
     its own physical bag, carried by different people at a different moment —
     a provider reaching into the insertion kit for a dressing will not find one.
     No INV_LOCATIONS entry yet: nobody has recorded where this bag lives, and
     NOT REVIEWED is the honest state for that (INVENTORY-DESIGN.md). */
  "kit-chest-tube-dressing": { name:"Chest Tube Dressing Kit (nursing)", cat:"kit", std:["ACS-COT"],
    contents:[
    "Large Op-Site 6x8","4x4 drain sponge","2x2 gauze",
    "Xeroform (or petroleum) dressing 5x9","Safety pin","3 inch tape",
    "Chest tube clamp","Chest tube troubleshooting resource"] },
  "kit-pigtail": { name:"Pigtail Thoracostomy Kit", cat:"kit", std:["ACS-COT"], contents:[
    "Sterile gown, mask, eye protection, gloves, drapes","Ultrasound with a sterile probe cover and gel",
    "25 G and 21 G needles","Lidocaine 1%","Introducer needle","Marked guidewire","Sequential dilators",
    "Pigtail catheter with stiffener","Kelly clamps","Connecting tubing","Underwater-seal drain with sterile water"] },
  "kit-thoracotomy": { name:"Thoracotomy Tray", cat:"kit", std:["ACS-COT"], contents:[
    "Finochietto rib spreader","Gigli saw with handles","Mayo scissors, heavy","Scalpel No. 20 blade",
    "Long artery forceps","Vascular (aortic) cross-clamp","3-0 monofilament on a large needle",
    "Skin stapler","Foley 16 Fr + 20 mL syringe"] },
  "kit-burr-hole": { name:"Burr Hole Kit", cat:"kit", std:["ACS-COT"], contents:[
    "Codman disposable perforator","Hudson brace or driver","Scalpel No. 10 blade","Self-retaining retractor",
    "Sharp dural hook","Bone nibbler","Lidocaine 1% with epinephrine 10 mL + syringe","Clippers",
    "Sterile saline 500 mL for irrigation"] },
  "kit-neck-tamponade": { name:"Neck Tamponade Kit", cat:"kit", std:["ACS-COT"], contents:[
    "Foley catheter 16 Fr","20 mL syringe","Umbilical tape or clamp","Gauze packs","Occlusive dressing"] },
  "kit-junctional": { name:"Junctional Hemorrhage Kit", cat:"kit", std:["ACS-COT"], contents:[
    "Hemostatic gauze","Plain roller gauze / Kerlix","Pressure dressing","Permanent marker","Trauma shears"] },
  "kit-escharotomy": { name:"Escharotomy Kit", cat:"kit", std:["ACS-COT"], contents:[
    "Scalpel No. 10 blade","Scalpel No. 20 blade","Marking pen","Artery forceps","Topical hemostatic gauze",
    "Gauze packs","Antiseptic prep + sterile drapes","Petroleum gauze + burn dressing"] },
  "kit-resus-line": { name:"Resuscitation Line Kit (Cordis / AVA 3Xi)", cat:"kit", std:["ACS-COT"], contents:[
    "Introducer sheath 8–9 Fr","18 g introducer needle + syringe","J-tip guidewire","Dilator",
    "Sterile probe cover + gel","Suture 3-0 non-absorbable + needle driver","Non-return valve caps",
    "Biopatch + Tegaderm"] },
  "kit-central-line": { name:"Central Line Kit", cat:"kit", contents:[
    "Triple-lumen catheter 7 Fr, 15–20 cm","Sterile probe cover + gel","Scalpel No. 11 blade",
    "Luer-lock syringes","Needles","Suture 3-0 non-absorbable + needle driver",
    "Biopatch + Tegaderm 10x12 and 6x7","Non-return valve caps"] },
  "kit-tvp": { name:"Transvenous Pacing Kit", cat:"kit", contents:[
    "Introducer sheath 6–7 Fr with sterile sleeve","Balloon-tipped bipolar pacing catheter 5 Fr",
    "Balloon syringe capped at 1.5 mL","Connecting cable","Suture 2-0 + needle driver",
    "Sterile probe cover + gel","External generator with a fresh battery"] },
  "kit-blakemore": { name:"Blakemore Kit", cat:"kit", contents:[
    "Sengstaken-Blakemore tube","Two 60 mL syringes","Insufflation manometer","Roller gauze",
    "Scissors taped within reach"] },
  "kit-lung-isolation": { name:"Lung Isolation Kit", cat:"kit", contents:[
    "ETT 8.0 and 9.0","Coude bougie","Nebulizer setup for TXA","TXA 1 g vials","Suction x2 for the good lung"] },
  "kit-epistaxis": { name:"Epistaxis Kit", cat:"kit", contents:[
    "Nasal speculum + headlamp","Rapid Rhino","Merocel","Silver nitrate","Foley",
    "Oxymetazoline 0.05%"] },
  "kit-salad": { name:"SALAD Suction Kit", cat:"kit", contents:[
    "DuCanto rigid catheter x2","HI-D Big Stick","Meconium aspirator","Suction tubing + canisters"] },
  "kit-jada": { name:"JADA Kit", cat:"kit", std:["AIM-OB"], contents:[
    "JADA System single-use kit","Sterile syringes","Straight catheter or Foley kit","Speculum",
    "Antiseptic prep + sterile gloves","Tape","Regulated vacuum source holding 80 mmHg"] },
  "kit-pneumo-tray": { name:"Pneumothorax Tray", cat:"kit", std:["ACS-COT"] },
  "kit-pacer-magnet": { name:"Pacemaker Magnet", cat:"kit" },
  "kit-mh": { name:"Malignant Hyperthermia Cart", cat:"kit", std:["MHAUS"] },
  "kit-difficult-airway": { name:"Difficult Airway Trolley / portable unit", cat:"kit", std:["ASA-DA"],
    note:"ASA's expectation is that the difficult-airway equipment travels together as one portable unit. At LRH it is spread across code cart drawers 1 and 2 — record where it actually is, then decide whether that counts." }
};

/* ===== STANDARDS (universal; versioned by checklist year) =================
   `items` is DERIVED at the bottom of this file from each catalog entry's
   `std` array — do not hand-maintain a second list.
   kind: "itemized"  = the source publishes a parts list, transcribed here.
         "narrative" = the source states a capability; the rows are this
                       manual's reading of it, and are marked as such on
                       screen so nobody cites them as the standard's own words. */
var INV_STANDARDS = {
  "NPRP": {
    name: "National Pediatric Readiness Project — pediatric equipment checklist",
    short: "NPRP · pediatric",
    kind: "itemized",
    scope: "Every ED that sees children, which is every ED. This checklist is what the national readiness score is built on.",
    cite: "AAP/ACEP/ENA joint policy, Pediatric Readiness in the Emergency Department (Pediatrics 2018;142:e20182459), equipment and supplies appendix"
  },
  "ACS-COT": {
    name: "American College of Surgeons Committee on Trauma — resuscitation equipment",
    short: "ACS · trauma",
    kind: "narrative",
    scope: "Any ED that receives trauma. Level III/IV expectations are the ones a critical-access department is measured against.",
    cite: "ACS Committee on Trauma, Resources for Optimal Care of the Injured Patient: 2022 Standards — resuscitation equipment and immediate-availability requirements",
    note: "The ACS standard states capability rather than printing a parts list, so these rows are this manual's reading of it. A red row here is a question for the trauma committee, not a quotation from the standard."
  },
  "ASA-DA": {
    name: "ASA difficult airway guideline — portable storage unit contents",
    short: "ASA · difficult airway",
    kind: "itemized",
    scope: "Anywhere an airway is managed. The point of the list is that the rescue equipment is together and portable, not scattered.",
    cite: "ASA Practice Guidelines for Management of the Difficult Airway 2022 (Anesthesiology 2022;136:31–81), which continues the guideline's suggested contents for a portable difficult-airway storage unit"
  },
  "NRP": {
    name: "Neonatal Resuscitation Program — delivery-room supplies and equipment",
    short: "NRP · newborn",
    kind: "itemized",
    scope: "Every birth, including the unplanned ones that arrive in the ED. NRP expects this checked before each delivery.",
    cite: "AAP/AHA Neonatal Resuscitation Program, 8th edition (2021), delivery-room supplies and equipment checklist"
  },
  "AIM-OB": {
    name: "AIM obstetric hemorrhage bundle — hemorrhage cart and immediate-access supplies",
    short: "AIM · OB hemorrhage",
    kind: "itemized",
    scope: "Any department where a postpartum patient can hemorrhage — including an ED with no obstetric service.",
    cite: "Alliance for Innovation on Maternal Health, Obstetric Hemorrhage patient safety bundle (readiness element: hemorrhage cart with supplies, checklist and instruction cards; immediate access to hemorrhage medications and a massive transfusion protocol); item detail per the CMQCC Obstetric Hemorrhage Toolkit V3.0 cart list"
  },
  "MHAUS": {
    name: "MHAUS malignant hyperthermia cart contents",
    short: "MHAUS · MH cart",
    kind: "itemized",
    scope: "Any site that gives a triggering agent — succinylcholine in RSI counts — or that receives an MH patient from a surgical center.",
    cite: "Malignant Hyperthermia Association of the United States, recommended contents of the MH cart"
  },
  "ASRA-LAST": {
    name: "ASRA local anesthetic systemic toxicity — lipid rescue kit",
    short: "ASRA · LAST rescue",
    kind: "itemized",
    scope: "Any department that performs nerve blocks or infiltrates large-volume local anesthetic.",
    cite: "ASRA practice advisory on local anesthetic systemic toxicity and the ASRA LAST checklist (lipid emulsion 20%, dedicated tubing and syringes, checklist stored together)"
  }
};

/* Standards deliberately NOT scored here, and why — so the next person does
   not re-litigate it (see INVENTORY-DESIGN.md §7):
   - AHA/ACLS: publishes no crash-cart parts list; the cart is local convention.
   - The Joint Commission / CMS Conditions of Participation: require that
     emergency equipment be available and checked, without itemizing it.
   - ENA / ACEP department-planning guidance: describes capability, already
     covered by the ACS and NPRP rows.
   - ATLS: a course, not an equipment standard.                              */

/* Standard Broselow band packing (universal summary; design decision 2:
   transcribe standard first, diff against the real cart on the walk). */
var INV_BROSELOW_PACK = {
  "GREY (3–5 kg)":    "ETT 3.0 uncuffed + stylet 6F · blade Miller 0–1 · BVM infant · OPA 50 mm · suction 6–8F · IV 22–24g · IO 15 mm · NG 5–8F · BP cuff neonatal",
  "PINK (6–7 kg)":    "ETT 3.5 · Miller 1 · OPA 50 mm · suction 8F · IV 22–24g · NG 5–8F · urinary cath 5–8F · BP cuff infant",
  "RED (8–9 kg)":     "ETT 4.0 · Miller 1 · OPA 60 mm · suction 8–10F · IV 20–24g · NG 8F",
  "PURPLE (10–11 kg)":"ETT 4.5 · Miller 1 · OPA 60 mm · suction 10F · IV 20–24g · NG 10F · BP cuff child",
  "YELLOW (12–14 kg)":"ETT 5.0 · Mac/Miller 2 · OPA 60 mm · suction 10F · IV 18–22g · NG 10F",
  "WHITE (15–18 kg)": "ETT 5.5 · Mac/Miller 2 · OPA 70 mm · suction 10F · IV 18–22g · NG 10–12F",
  "BLUE (19–23 kg)":  "ETT 6.0 cuffed · Mac/Miller 2 · OPA 70 mm · suction 10F · IV 18–20g · NG 12–14F",
  "ORANGE (24–29 kg)":"ETT 6.5 cuffed · Mac/Miller 2–3 · OPA 80 mm · suction 12F · IV 16–20g · NG 14–18F · BP cuff adult",
  "GREEN (30–36 kg)": "ETT 7.0 cuffed · Mac 3 · OPA 80 mm · suction 12–14F · IV 16–18g · NG 16–18F"
};

/* ===== LAYER 2 — LOCAL MAP (SITE CONFIG — the ONLY block a fork edits) ====
   Key is an item id, or `id#size` to override one size of an item.
   Resolution for a size row: LOCATIONS["id#size"] || LOCATIONS["id"].
   loc: where it lives HERE.  par: minimum stocked count where tracked.
   verify:true = believed present at this location but not yet confirmed on a
   cart walk (converts to confirmed by deleting the flag).
   NO entry = NOT YET REVIEWED — which is not the same claim as a gap. A gap
   is an assertion that the department does not stock the thing, and it is
   made either here (gap:true, with an issue number in INV_GAP_ISSUES) or by a
   champion on the walk using the tool's own dropdown. ==================== */
var INV_LOCATIONS = {
  /* --- monitoring --- */
  "bp-cuffs":            { loc:"Broselow Cart · band drawers + Room 7 · Monitoring", verify:true },
  "ecg-electrodes":      { loc:"Room 7 · Monitoring", verify:true },
  "defib":               { loc:"Resus bay — monitor/defibrillator (outside cart data)", verify:true },
  "defib#internal paddles (thoracotomy)": { loc:"With the defibrillator, not in the thoracotomy tray", verify:true },
  "pulseox":             { loc:"Room 7 · Monitoring", verify:true },
  "etco2":               { loc:"Code Cart · Drawer 1 · End-Tidal CO2", par:2 },
  "scale-kg":            { loc:"Peds room / triage", verify:true },
  "broselow-tape":       { loc:"Pediatric (Broselow) Cart — top", par:1 },
  "glucometer":          { loc:"Resus bay / triage point-of-care", verify:true },
  "ultrasound":          { loc:"Resus bay — shared machine", verify:true },
  "xray-portable":       { loc:"Radiology — portable into the bay", verify:true },
  "abg-syringes":        { loc:"Room 7 · Specimens", verify:true },
  /* --- airway --- */
  "opa":                 { loc:"Code Cart · Drawer 1 · OPA / NPA", verify:true },
  "npa":                 { loc:"Code Cart · Drawer 1 · OPA / NPA", verify:true },
  "sga-neonatal":        { loc:"OB / Neonatal Cart · Drawer 1 · Airway / Breathing", verify:true },
  "sga-igel":            { loc:"Code Cart · Drawer 2 · iGel", par:3 },
  "ett-uncuffed":        { loc:"Broselow Cart · band drawers + OB Cart · Drawer 1", verify:true },
  "ett-cuffed":          { loc:"Code Cart · Drawer 1 · ETT / Bougie + Broselow Cart · band drawers", verify:true },
  "ett-90":              { loc:"Room 7 · Lung Isolation", verify:true },
  "stylets":             { loc:"Code Cart · Drawer 1 · ETT / Bougie", verify:true },
  "bougie":              { loc:"Code Cart · Drawer 1 · ETT / Bougie", par:2 },
  "bougie#coudé tip (lung isolation)": { loc:"Room 7 · Lung Isolation", verify:true },
  "blades-mac":          { loc:"Code Cart · Drawer 1 · Direct Laryngoscopy", verify:true },
  "blades-miller":       { loc:"Code Cart · Drawer 1 · Direct Laryngoscopy", verify:true },
  "laryngoscope-handles":{ loc:"Code Cart · Drawer 1 · Direct Laryngoscopy", verify:true },
  "videolaryngoscope":   { loc:"Code Cart · Drawer 1 · Video Laryngoscopy (McGrath MAC)", par:1 },
  "fona-kit":            { loc:"Code Cart · Drawer 2 · Front of Neck Access", par:1 },
  "jet-vent":            { loc:"Code Cart · Drawer 2 · Jet Ventilation", par:1 },
  "magill":              { loc:"Code Cart · Drawer 1 · Intubation", verify:true },
  "suction-cath":        { loc:"Code Cart · Drawer 4 · Suction", verify:true },
  "suction-rigid":       { loc:"Code Cart · Drawer 4 · Suction + Room 7 · SALAD Suction", verify:true },
  "suction-units":       { loc:"Resus bay wall + portable unit", verify:true },
  "ng-tubes":            { loc:"Trauma Cart · Drawer 2 · NG Tube", verify:true },
  /* --- breathing --- */
  "bvm":                 { loc:"Broselow Cart · band drawers + OB Cart · Drawer 1", verify:true },
  "face-masks":          { loc:"Broselow Cart · band drawers + OB Cart · Drawer 1", verify:true },
  "o2-masks":            { loc:"Respiratory storage + Broselow Cart", verify:true },
  "nasal-cannula":       { loc:"Respiratory storage", verify:true },
  "meconium-aspirator":  { loc:"Room 7 · SALAD Suction + OB Cart · Drawer 1", verify:true },
  /* --- vascular --- */
  "io-needles":          { loc:"Code Cart · Drawer 5 · EZ-IO", par:2 },
  "iv-cath":             { loc:"Code Cart · Drawer 5 · I.V. Supplies + Trauma Cart · Drawer 1 · IV Supplies", verify:true },
  "iv-cath#24 g":        { loc:"Broselow Cart · band drawers", verify:true },
  "iv-cath#22 g":        { loc:"Broselow Cart · band drawers", verify:true },
  "uvc":                 { loc:"OB / Neonatal Cart · Drawer 2 · Circulation (UVC kit)", par:1 },
  "cvc-peds":            { loc:"Room 7 · Vascular Access", verify:true, note:"adult sizes confirmed; pediatric sizes unconfirmed" },
  "art-line":            { loc:"Room 7 · Arterial Line", verify:true },
  "iv-sets-calibrated":  { loc:"Clean utility / pump storage", verify:true },
  "pressure-infuser":    { loc:"Code Cart · Drawer 4 · I.V. Fluids", verify:true },
  "radiant-warmer":      { loc:"OB / Neonatal — radiant warmer in the bay", verify:true },
  /* --- hemorrhage / trauma --- */
  "tourniquet":          { loc:"Trauma Cart · Drawer 4 · Hemorrhage Control 2", verify:true },
  "hemostatic-gauze":    { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control 1", verify:true },
  "pressure-dressings":  { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control 1", verify:true },
  "pelvic-binder":       { loc:"Trauma Cart · Drawer 4 · Hemorrhage Control 2", verify:true },
  "needle-decompression":{ loc:"Trauma Cart · Drawer 1 · Needle Decompression", verify:true },
  "trauma-shears":       { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control 1", verify:true },
  "txa":                 { loc:"Omnicell + Room 7 · Lung Isolation (nebulized)", verify:true },
  "ppe-splash":          { loc:"Trauma Cart · Drawer 5 · PPE", verify:true },
  /* --- procedural --- */
  "chest-tubes":         { loc:"Trauma Cart · Chest Tube Insertion shelf + Room 7 · Chest Drainage", verify:true, note:"14 Fr pigtail is the only small-bore size named on the cards" },
  "drainage-system":     { loc:"Room 7 · Chest Drainage", verify:true },
  "femur-splints":       { loc:"Room 7 · Splints", verify:true },
  "lp-trays":            { loc:"Room 7 · Procedure Trays", verify:true, note:"infant 22 g needles unconfirmed" },
  "urinary-cath":        { loc:"Clean utility", verify:true },
  /* --- obstetric / neonatal --- */
  "ob-delivery-kit":     { loc:"OB / Neonatal Cart · Drawer 6 · Vaginal Delivery + radiant warmer", par:1 },
  "intrauterine-balloon":{ loc:"OB / Neonatal Cart · Drawer 4 · Postpartum Hemorrhage", verify:true },
  "uterotonics":         { loc:"Omnicell + OB / Neonatal Cart · Drawer 4", verify:true },
  "peds-dosing-ref":     { loc:"Broselow tape + the peds/ tool itself", par:1 },
  /* --- kits (locations confirmed from labels/ + procedure cards) --- */
  "kit-canthotomy":      { loc:"Trauma Cart · Drawer 6 · Canthotomy Kit", par:1 },
  "kit-chest-tube":      { loc:"Room 7 · Chest Drainage", par:1 },
  /* Co-located with the insertion kit, confirmed by Lon 2026-08-14. Same
     section, two bags: the provider takes one and the nurse takes the other,
     which is exactly why they are separate kits rather than one long list. */
  "kit-chest-tube-dressing": { loc:"Room 7 · Chest Drainage", par:1 },
  "kit-pigtail":         { loc:"Room 7 · Chest Drainage (pigtail)", par:2 },
  "kit-thoracotomy":     { loc:"Trauma Cart · Shelf A · Thoracostomy + Rib Spreader", par:1 },
  "kit-burr-hole":       { loc:"Trauma Cart · Shelf A · Burr Hole", par:1 },
  "kit-neck-tamponade":  { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control", par:1 },
  "kit-junctional":      { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control", par:1 },
  "kit-escharotomy":     { loc:"Room 7 · Procedure Trays (escharotomy)", par:1 },
  "kit-resus-line":      { loc:"Room 7 · Vascular Access", par:1 },
  "kit-central-line":    { loc:"Room 7 · Vascular Access", par:1 },
  "kit-tvp":             { loc:"Room 7 · Transvenous Pacing", par:1 },
  "kit-blakemore":       { loc:"Room 7 · GI Hemorrhage", par:1 },
  "kit-lung-isolation":  { loc:"Room 7 · Lung Isolation", par:1 },
  "kit-epistaxis":       { loc:"Room 7 · Epistaxis", par:1 },
  "kit-salad":           { loc:"Room 7 · SALAD Suction", par:1 },
  "kit-jada":            { loc:"OB / Neonatal Cart · Drawer 4 · Postpartum Hemorrhage", par:1 },
  "kit-pneumo-tray":     { loc:"Trauma Cart · Drawer 6 · Pneumothorax Tray", par:1 },
  "kit-pacer-magnet":    { loc:"Code Cart · side panel", par:1 }
};

/* Items asserted ABSENT at LRH, each filed as a GitHub issue. This is the
   only place a gap is claimed in source — everything else with no LOCATIONS
   entry is simply not reviewed yet. */
var INV_GAP_ISSUES = {
  "doppler": 98, "thermometer-hypo": 99, "fluid-warmer": 100,
  "trach-tubes": 101, "c-collars": 102
};

/* Location directory (browse view): cart -> drawers, from labels/ (photo-
   verified). Universal-ish structure, local names — lives with LOCATIONS. */
var INV_DIRECTORY = {
  "Code Cart": ["Intubation","ETT / Bougie","Video Laryngoscopy","Direct Laryngoscopy","OPA / NPA","End-Tidal CO2","Surgical / Supraglottic","iGel","Jet Ventilation","Front of Neck Access","Medications","Suction","I.V. Fluids","I.V. Supplies","EZ-IO","Miscellaneous","Pacemaker Magnet"],
  "Trauma Cart": ["ChloraPrep","IV Supplies","Scalpel","Needle Decompression","NG Tube","Hemorrhage Control 1","Hemorrhage Control 2","PPE","Canthotomy Kit","Pneumothorax Tray","Burr Hole","Thoracostomy","Rib Spreader","Chest Tube Insertion"],
  "OB / Neonatal Cart": ["Airway / Breathing","Circulation","Labs / Misc.","Postpartum Hemorrhage","C-section","Vaginal Delivery"],
  "Pediatric (Broselow) Cart": ["GREY (3–5 kg)","PINK (6–7 kg)","RED (8–9 kg)","PURPLE (10–11 kg)","YELLOW (12–14 kg)","WHITE (15–18 kg)","BLUE (19–23 kg)","ORANGE (24–29 kg)","GREEN (30–36 kg)"],
  "Room 7 cabinets": ["Airway","Vascular Access","Arterial Line","Fluids","Chest Drainage","GI Hemorrhage","Lung Isolation","Epistaxis","SALAD Suction","Procedure Trays","Suture / Wound","Specimens","Splints","Monitoring","Transvenous Pacing"]
};

/* Human labels for the catalog's `cat` values (UI grouping order). */
var INV_CATEGORIES = [
  ["monitoring","Monitoring & diagnostics"],
  ["airway","Airway"],
  ["breathing","Breathing & oxygen"],
  ["vascular","Vascular access & transfusion"],
  ["hemorrhage","Hemorrhage & trauma"],
  ["procedure","Procedural & immobilization"],
  ["obstetric","Obstetric & neonatal"],
  ["medication","Antidote & rescue stock"],
  ["reference","Reference at the bedside"],
  ["kit","Named kits"]
];

/* ===== DERIVED (do not hand-edit) =========================================
   Each standard's item list comes from the catalog's `std` arrays, so an item
   is filed under a standard in exactly one place. Row ids used by the audit
   are also generated here: an item with `sizes` contributes one row per size
   (`id#size`) and no row for the bare item. */
var INV_ROWS = {};   /* rowId -> {id, size, name, cat} */
(function(){
  Object.keys(INV_STANDARDS).forEach(function(s){ INV_STANDARDS[s].items = []; });
  Object.keys(INV_CATALOG).forEach(function(id){
    var c = INV_CATALOG[id];
    (c.std || []).forEach(function(s){
      if (INV_STANDARDS[s]) INV_STANDARDS[s].items.push(id);
    });
    if (c.sizes && c.sizes.length) {
      c.sizes.forEach(function(sz){
        INV_ROWS[id + '#' + sz] = { id:id, size:sz, name:c.name + ' — ' + sz, cat:c.cat };
      });
    } else {
      INV_ROWS[id] = { id:id, size:null, name:c.name, cat:c.cat };
    }
  });
})();

/* Baseline location for a row id, falling back from `id#size` to `id`. */
function invBaseline(rowId){
  return INV_LOCATIONS[rowId] || INV_LOCATIONS[rowId.split('#')[0]] || null;
}

/* ===== SHARED CAPTURE (device-local; CLAUDE.md rule 3) ====================
   ONE store, written by every tool that lets someone confirm where a thing is:
   the readiness walk in equipment-readiness/, and the equipment walk inside a
   simulation. A new nurse finding the pediatric pads during an orientation
   drill is the same fact as the readiness champion finding them on a cart
   walk, and it would be absurd to record it twice — so the sims feed the
   audit, and the audit is what the orientation session leaves behind.

   Contents: equipment row ids, a state, a typed location string, and which
   activity recorded it. No patient data, ever, and no network. Cleared by the
   RESET control in equipment-readiness/.

   state: 'loc'  set to a location   'in'  confirmed inside its kit
          'gap'  asserted absent     'na'  not applicable at this site       */
var INV_STORE_KEY = 'lrh-eq-readiness-v1';
var INV_CAPTURE = (function(){
  var ST = { rows:{}, label:'' };
  try {
    var raw = localStorage.getItem(INV_STORE_KEY);
    if (raw) { var p = JSON.parse(raw); if (p && p.rows) ST = { rows:p.rows, label:p.label || '' }; }
  } catch(e){}
  function save(){ try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(ST)); } catch(e){} }
  return {
    key: INV_STORE_KEY,
    rows: function(){ return ST.rows; },
    get:  function(rowId){ return ST.rows[rowId] || null; },
    /* whence records WHERE it was confirmed ("SIM 3", "cart walk") so the
       export can say so — an item found during a drill and an item found on a
       deliberate audit are the same fact with different provenance. */
    set: function(rowId, state, loc, whence){
      if (!state) { delete ST.rows[rowId]; }
      else {
        var r = ST.rows[rowId] || {};
        r.s = state;
        if (loc !== null && loc !== undefined) r.l = loc;
        if (whence) r.w = whence;
        ST.rows[rowId] = r;
      }
      save();
    },
    label: function(v){ if (v === undefined) return ST.label; ST.label = v; save(); },
    clear: function(){ ST = { rows:{}, label:'' }; try { localStorage.removeItem(INV_STORE_KEY); } catch(e){} }
  };
})();

/* The four states a row can be in, resolved once for every consumer.
   'set' beats everything (a human looked), then an asserted gap, then the
   manual's own baseline, and 'new' means nobody has looked — which is NOT a
   claim that the item is missing. */
function invStatus(rowId){
  var u = INV_CAPTURE.get(rowId);
  if (u && u.s) return (u.s === 'loc' || u.s === 'in') ? 'set' : u.s;   /* gap | na | set */
  if (INV_GAP_ISSUES[rowId.split('#')[0]]) return 'gap';
  var b = invBaseline(rowId);
  if (!b) return 'new';
  return b.verify ? 'vf' : 'ok';
}

/* Every row id belonging to a catalog item (one per size, or just the item). */
function invRowIds(id){
  var c = INV_CATALOG[id];
  if (!c) return [];
  if (c.sizes && c.sizes.length) return c.sizes.map(function(sz){ return id + '#' + sz; });
  return [id];
}
