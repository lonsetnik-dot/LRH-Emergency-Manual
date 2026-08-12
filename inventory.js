/* ===========================================================================
   inventory.js — LRH Emergency Manual equipment inventory (single source).

   Injected by build.mjs wherever a tool's <script> contains the marker
   (slash-star) @inventory (star-slash), so deployed tools stay fully
   self-contained and offline (CLAUDE.md rule 1). Edit the inventory ONCE here.
   Design: INVENTORY-DESIGN.md. Consumers today: equipment-readiness/.
   (labels/ and simulations/ migrate onto this in a later phase.)

   TWO LAYERS (design decision, Lon 2026-08-12):
   - CATALOG + STANDARDS + BROSELOW_PACK are UNIVERSAL — a fork keeps them.
   - LOCATIONS is the LOCAL MAP — the only block another ED edits.
   Granularity: sizes only where a standard names sizes. Par yes, expiry no.
   =========================================================================== */

/* ===== LAYER 1 — STANDARD CATALOG (universal; forks do not edit) ========== */
var INV_CATALOG = {
  /* --- monitoring --- */
  "bp-cuffs-peds-range": { name:"BP cuffs — neonatal / infant / child / adult", cat:"monitoring", std:["NPRP"] },
  "doppler":             { name:"Doppler ultrasound (pulses / BP)", cat:"monitoring", std:["NPRP"] },
  "defib-peds":          { name:"Monitor–defibrillator with pediatric capability + peds pads", cat:"monitoring", std:["NPRP"] },
  "pulseox-peds":        { name:"Pulse oximeter with pediatric + infant probes", cat:"monitoring", std:["NPRP"] },
  "etco2":               { name:"Continuous end-tidal CO2 (pediatric + adult)", cat:"monitoring", std:["NPRP"] },
  "thermometer-hypo":    { name:"Hypothermia-capable thermometer (reads < 35 °C)", cat:"monitoring", std:["NPRP"] },
  "scale-kg":            { name:"Scale weighing in kilograms only", cat:"monitoring", std:["NPRP"] },
  "broselow-tape":       { name:"Length-based resuscitation tape (Broselow)", cat:"monitoring", std:["NPRP"] },
  /* --- vascular access --- */
  "io-needles":          { name:"Intraosseous needles — pediatric + adult", cat:"vascular", std:["NPRP"] },
  "iv-cath-22-24":       { name:"IV catheters 22–24 g", cat:"vascular", std:["NPRP"] },
  "uvc-3.5-5":           { name:"Umbilical vein catheters 3.5 Fr + 5 Fr", cat:"vascular", std:["NPRP"] },
  "cvc-peds-4-7":        { name:"Central venous catheters 4–7 Fr (pediatric sizes)", cat:"vascular", std:["NPRP"] },
  "iv-sets-calibrated":  { name:"Calibrated-chamber IV sets / infusion pumps", cat:"vascular", std:["NPRP"] },
  "fluid-warmer":        { name:"Fluid / blood warming capability", cat:"vascular", std:["NPRP"] },
  /* --- airway --- */
  "bvm-infant-adult":    { name:"Self-inflating BVM — infant (450 mL) + adult (1000 mL), masks neonatal–adult", cat:"airway", std:["NPRP"] },
  "o2-masks-range":      { name:"Oxygen masks incl. infant/child NRB; nasal cannulae all sizes", cat:"airway", std:["NPRP"] },
  "opa-0-5":             { name:"Oropharyngeal airways sizes 0–5", cat:"airway", std:["NPRP"] },
  "npa-range":           { name:"Nasopharyngeal airways infant–adult", cat:"airway", std:["NPRP"] },
  "blades-peds":         { name:"Laryngoscope blades — straight 0/1/2, curved 2/3 (+ handles)", cat:"airway", std:["NPRP"] },
  "ett-range":           { name:"ETTs — uncuffed 2.5–3.5, cuffed 3.0–8.0 + pediatric/adult stylets", cat:"airway", std:["NPRP"] },
  "sga-1-5":             { name:"Supraglottic airways sizes 1–5 (iGel)", cat:"airway", std:["NPRP"] },
  "magill-peds-adult":   { name:"Magill forceps — pediatric + adult", cat:"airway", std:["NPRP"] },
  "suction-cath-5-14":   { name:"Suction catheters 5–14 Fr + Yankauer", cat:"airway", std:["NPRP"] },
  "ng-8-18":             { name:"Nasogastric tubes 8–18 Fr", cat:"airway", std:["NPRP"] },
  "trach-tubes-0-6":     { name:"Tracheostomy tubes sizes 0–6", cat:"airway", std:["NPRP"] },
  /* --- procedures / trauma / other --- */
  "chest-tubes-8-40":    { name:"Chest tubes 8–40 Fr (pediatric sizes included)", cat:"procedure", std:["NPRP"] },
  "c-collars-range":     { name:"Cervical collars — infant through adult", cat:"procedure", std:["NPRP"] },
  "femur-splints":       { name:"Femur splints — pediatric + adult", cat:"procedure", std:["NPRP"] },
  "lp-trays":            { name:"Lumbar puncture trays — 22 g infant/peds + adult", cat:"procedure", std:["NPRP"] },
  "urinary-cath-5-22":   { name:"Urinary catheters 5–22 Fr", cat:"procedure", std:["NPRP"] },
  "ob-delivery-kit":     { name:"Newborn delivery kit + radiant warmer", cat:"procedure", std:["NPRP"] },
  "peds-dosing-ref":     { name:"Length-based pediatric drug dosing reference", cat:"reference", std:["NPRP"] },
  /* --- named kits (drawer/kit granularity — no standard names their sizes) --- */
  "kit-canthotomy":      { name:"Canthotomy Kit", cat:"kit" },
  "kit-blakemore":       { name:"Blakemore Kit", cat:"kit" },
  "kit-lung-isolation":  { name:"Lung Isolation Kit", cat:"kit" },
  "kit-epistaxis":       { name:"Epistaxis Kit", cat:"kit" },
  "kit-salad":           { name:"SALAD Suction Kit", cat:"kit" },
  "kit-pigtail":         { name:"Pigtail Thoracostomy Kit", cat:"kit" },
  "kit-pacer-magnet":    { name:"Pacemaker Magnet", cat:"kit" },
  "kit-chest-tube":      { name:"Chest Tube Kit", cat:"kit" },
  "kit-thoracotomy":     { name:"Thoracotomy Tray", cat:"kit" },
  "kit-burr-hole":       { name:"Burr Hole Kit", cat:"kit" },
  "kit-tvp":             { name:"Transvenous Pacing Kit", cat:"kit" },
  "kit-escharotomy":     { name:"Escharotomy Kit", cat:"kit" },
  "kit-neck-tamponade":  { name:"Neck Tamponade Kit", cat:"kit" },
  "kit-junctional":      { name:"Junctional Hemorrhage Kit", cat:"kit" },
  "kit-jada":            { name:"JADA Kit", cat:"kit" },
  "kit-resus-line":      { name:"Resuscitation Line Kit (Cordis / AVA 3Xi)", cat:"kit" },
  "kit-pneumo-tray":     { name:"Pneumothorax Tray", cat:"kit" }
};

/* ===== STANDARDS (universal; versioned by checklist year) ================= */
var INV_STANDARDS = {
  "NPRP": {
    name: "National Pediatric Readiness Project — equipment checklist",
    cite: "AAP/ACEP/ENA joint policy, Pediatric Readiness in the Emergency Department (Pediatrics 2018;142:e20182459), equipment appendix",
    items: ["bp-cuffs-peds-range","doppler","defib-peds","pulseox-peds","etco2",
      "thermometer-hypo","scale-kg","broselow-tape","io-needles","iv-cath-22-24",
      "uvc-3.5-5","cvc-peds-4-7","iv-sets-calibrated","fluid-warmer",
      "bvm-infant-adult","o2-masks-range","opa-0-5","npa-range","blades-peds",
      "ett-range","sga-1-5","magill-peds-adult","suction-cath-5-14","ng-8-18",
      "trach-tubes-0-6","chest-tubes-8-40","c-collars-range","femur-splints",
      "lp-trays","urinary-cath-5-22","ob-delivery-kit","peds-dosing-ref"]
  }
  /* ACS-TRAUMA, AIM-OB, DAS-AIRWAY follow the same shape in a later phase. */
};

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
   loc: where it lives HERE. par: minimum stocked count where tracked.
   verify:true = believed present at this location but not yet confirmed on a
   cart walk (converts to confirmed by deleting the flag).
   An NPRP item with NO entry here = GAP (see INV_GAP_ISSUES). ============== */
var INV_LOCATIONS = {
  "bp-cuffs-peds-range": { loc:"Broselow Cart · band drawers + Room 7 · Monitoring", verify:true },
  "defib-peds":          { loc:"Resus bay — monitor/defibrillator (outside cart data)", verify:true },
  "pulseox-peds":        { loc:"Room 7 · Monitoring", verify:true },
  "etco2":               { loc:"Code Cart · End-Tidal CO2 drawer", par:2 },
  "scale-kg":            { loc:"Peds room / triage", verify:true },
  "broselow-tape":       { loc:"Pediatric (Broselow) Cart — top", par:1 },
  "io-needles":          { loc:"Code Cart · EZ-IO drawer", par:2 },
  "iv-cath-22-24":       { loc:"Broselow Cart · band drawers + Trauma Cart · IV Supplies", verify:true },
  "uvc-3.5-5":           { loc:"OB / Neonatal Cart · Circulation drawer (UVC kit)", par:1 },
  "cvc-peds-4-7":        { loc:"Room 7 · Vascular Access", verify:true, note:"adult CVC confirmed; pediatric sizes unconfirmed" },
  "iv-sets-calibrated":  { loc:"Clean utility / pump storage", verify:true },
  "bvm-infant-adult":    { loc:"Broselow Cart · band drawers + OB Cart · Airway/Breathing", verify:true },
  "o2-masks-range":      { loc:"Respiratory storage + Broselow Cart", verify:true },
  "opa-0-5":             { loc:"Code Cart · OPA/NPA drawer", verify:true, note:"pediatric sizes unconfirmed" },
  "npa-range":           { loc:"Code Cart · OPA/NPA drawer", verify:true },
  "blades-peds":         { loc:"Code Cart · Direct Laryngoscopy drawer", verify:true, note:"Miller 0–1 unconfirmed" },
  "ett-range":           { loc:"Code Cart · ETT/Bougie drawer + Broselow Cart · band drawers", verify:true },
  "sga-1-5":             { loc:"Code Cart · iGel drawer", verify:true, note:"pediatric sizes unconfirmed" },
  "magill-peds-adult":   { loc:"Code Cart · Intubation drawer", verify:true },
  "suction-cath-5-14":   { loc:"Code Cart · Suction drawer", verify:true },
  "ng-8-18":             { loc:"Trauma Cart · NG Tube drawer", verify:true, note:"size range unconfirmed" },
  "chest-tubes-8-40":    { loc:"Trauma Cart · Chest Tube Insertion + Room 7 · Pigtail Thoracostomy", verify:true, note:"sub-12 Fr unconfirmed" },
  "femur-splints":       { loc:"Room 7 · Splints", verify:true },
  "lp-trays":            { loc:"Room 7 · Procedure Trays", verify:true, note:"infant 22 g needles unconfirmed" },
  "urinary-cath-5-22":   { loc:"Clean utility", verify:true },
  "ob-delivery-kit":     { loc:"OB / Neonatal Cart · Vaginal Delivery drawer + radiant warmer", par:1 },
  "peds-dosing-ref":     { loc:"Broselow tape + the peds/ tool itself", par:1 },
  /* kits (all locations confirmed from labels/ + cards) */
  "kit-canthotomy":     { loc:"Trauma Cart · Canthotomy drawer", par:1 },
  "kit-blakemore":      { loc:"Room 7 · GI Hemorrhage", par:1 },
  "kit-lung-isolation": { loc:"Room 7 · Lung Isolation", par:1 },
  "kit-epistaxis":      { loc:"Room 7 · Epistaxis", par:1 },
  "kit-salad":          { loc:"Room 7 · SALAD Suction", par:1 },
  "kit-pigtail":        { loc:"Room 7 · Chest Drainage (pigtail)", par:2 },
  "kit-pacer-magnet":   { loc:"Code Cart · side panel", par:1 },
  "kit-chest-tube":     { loc:"Trauma Cart · Chest Tube Insertion shelf", par:1 },
  "kit-thoracotomy":    { loc:"Trauma Cart · Thoracostomy + Rib Spreader shelves", par:1 },
  "kit-burr-hole":      { loc:"Trauma Cart · Burr Hole shelf", par:1 },
  "kit-tvp":            { loc:"Room 7 · Transvenous Pacing", par:1 },
  "kit-escharotomy":    { loc:"Room 7 · Procedure Trays (escharotomy)", par:1 },
  "kit-neck-tamponade": { loc:"Trauma Cart · Hemorrhage Control", par:1 },
  "kit-junctional":     { loc:"Trauma Cart · Drawer 3 · Hemorrhage Control", par:1 },
  "kit-jada":           { loc:"OB / Neonatal Cart · Postpartum Hemorrhage drawer", par:1 },
  "kit-resus-line":     { loc:"Room 7 · Vascular Access", par:1 },
  "kit-pneumo-tray":    { loc:"Trauma Cart · Pneumothorax Tray drawer", par:1 }
};

/* NPRP items with NO location = tracked gaps, filed as GitHub issues. */
var INV_GAP_ISSUES = {
  "doppler": 98, "thermometer-hypo": 99, "fluid-warmer": 100,
  "trach-tubes-0-6": 101, "c-collars-range": 102
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
