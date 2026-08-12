# INVENTORY-DESIGN.md — ED equipment inventory: design for review

Status: **DESIGN FOR REVIEW — nothing built yet.** (Lon, 2026-08-12: "adjust
design first · include the equipment.") Edit this file directly or comment;
Phase 1 starts only after sign-off.

## 1. Goals

1. **One editable source of truth** for every physical item the manual
   references — sims equipment lists, procedure "IN THE KIT" sections,
   posters, cart labels, and the system map all read from it.
2. **WHAT is universal, WHERE is local.** A fork keeps the catalog and
   standards untouched and rewrites only location strings — CLAUDE.md rule 2
   applied to physical stock.
3. **Standards-auditable.** The catalog knows which national standard asks
   for each item, so "are we NPRP-complete?" becomes a generated green/red
   view like the system map, not an annual binder exercise.
4. Tools stay self-contained and offline (rule 1) — solved by the existing
   build-time injection pattern, not by runtime fetches.

## 2. Architecture

One hand-edited file at the repo root, injected at build:

```
inventory.js  ── build.mjs injects at  /* @inventory */  markers ──►
    labels/      (renders cart labels from it — replaces its private CARTS)
    system/      (link audit gains an equipment dimension)
    simulations/ (equipment lists resolve locations by item id)
    inventory/   (new: searchable "where is X?" browser + standards audit)
```

Same mechanism as `design-system.css`: edited once, appears everywhere,
deployed pages stay fully self-contained.

### The two layers, concretely

```js
// ===== LAYER 1 — STANDARD CATALOG (universal; a fork does not edit this) =====
// Canonical items. `std` ties an item to the standards that call for it.
var CATALOG = {
  "io-needle-peds":   { name:"Intraosseous needle — pediatric (EZ-IO 15 mm)",
                        cat:"vascular", std:["NPRP"] },
  "ett-cuffed-3.0":   { name:"Endotracheal tube, cuffed 3.0",
                        cat:"airway",   std:["NPRP"] },
  "chest-tube-12f":   { name:"Chest tube 12 Fr (pigtail)",
                        cat:"procedure", std:["NPRP","ACS-TRAUMA"] },
  "uvc-5f":           { name:"Umbilical vein catheter 5 Fr",
                        cat:"vascular", std:["NPRP"] },
  // ... one entry per item, ~200–300 total
};

// ===== LAYER 2 — LOCAL MAP (SITE CONFIG — the ONLY block a fork edits) =====
// item id -> where it physically lives at THIS hospital (+ par, brand notes).
var LOCATIONS = {
  "io-needle-peds":   { loc:"Code Cart · EZ-IO drawer",            par:2 },
  "ett-cuffed-3.0":   { loc:"Broselow Cart · PINK–RED drawers",    par:2 },
  "chest-tube-12f":   { loc:"Room 7 · Pigtail Thoracostomy",       par:2 },
  "uvc-5f":           { loc:"OB Cart · Circulation drawer",        par:2,
                        note:"in the UVC kit" },
  // ...
};

// ===== STANDARDS LISTS (universal; versioned by checklist year) =====
var STANDARDS = {
  "NPRP": { name:"National Pediatric Readiness Project equipment checklist",
            cite:"AAP/ACEP/ENA joint policy, Pediatric Readiness in the ED (2018)",
            items:[ "ett-cuffed-3.0", "io-needle-peds", /* ... */ ] },
  // "ACS-TRAUMA", "AIM-OB", "DAS-AIRWAY" follow the same shape later.
};
```

Audit logic is then trivial and CI-testable: an NPRP item with no `LOCATIONS`
entry is a **GAP**; a location string that names a cart/drawer the label data
doesn't know is a **typo caught at build**.

## 3. THE EQUIPMENT — current state (Layer 2 seed)

Everything below is what the manual already knows about, consolidated from
`labels/` (rebuilt from photographs of the real carts), the procedures cards'
"IN THE KIT" lists, and `verify_kit_consistency.mjs` (which already carries
machine-readable kit contents). This becomes the initial `LOCATIONS` data.

### Code Cart (17 drawers/faces)
Intubation · ETT / Bougie · Video Laryngoscopy · Direct Laryngoscopy ·
OPA / NPA · End-Tidal CO₂ · Surgical / Supraglottic · iGel · Jet Ventilation ·
Front of Neck Access · Medications · Suction · I.V. Fluids · I.V. Supplies ·
EZ-IO · Miscellaneous · Pacemaker Magnet

### Trauma Cart (14 drawers/shelves)
ChloraPrep · IV Supplies · Scalpel · Needle Decompression · NG Tube ·
Hemorrhage Control 1 · Hemorrhage Control 2 · PPE · Canthotomy Kit ·
Pneumothorax Tray · Burr Hole · Thoracostomy · Rib Spreader ·
Chest Tube Insertion

### OB / Neonatal Cart (6 drawers)
Airway / Breathing · Circulation · Labs / Misc. · Postpartum Hemorrhage ·
C-section · Vaginal Delivery

### Pediatric (Broselow) Cart (9 weight-band drawers)
GREY (3–5 kg) · PINK (6–7) · RED (8–9) · PURPLE (10–11) · YELLOW (12–14) ·
WHITE (15–18) · BLUE (19–23) · ORANGE (24–29) · GREEN (30–36)
> Note: labels/ knows the drawers but not their inside contents — the
> standard Broselow packing list becomes catalog items mapped to bands in
> Phase 1, then verified against the physical cart (see §6 open question 2).

### Room 7 cabinets (13 sections)
Airway · Vascular Access · Arterial Line · Fluids · Chest Drainage ·
GI Hemorrhage · Lung Isolation · Epistaxis · SALAD Suction · Procedure Trays ·
Suture / Wound · Specimens · Splints · Monitoring · Transvenous Pacing

### Named kits (17 — item-level contents already defined on cards/labels)
Canthotomy Kit · Blakemore Kit · Lung Isolation · Epistaxis Kit ·
SALAD Suction · Pigtail Thoracostomy · Pacemaker Magnet · Chest Tube Kit ·
Thoracotomy Tray · Burr Hole Kit · Transvenous Pacing Kit · Escharotomy Kit ·
Neck Tamponade Kit · Junctional Hemorrhage Kit · JADA Kit ·
Resuscitation Line Kit · Pneumothorax Tray

## 4. THE EQUIPMENT — NPRP standards overlay (Layer 1 seed)

The National Pediatric Readiness Project equipment checklist (AAP/ACEP/ENA
joint policy appendix), transcribed by category, with today's best-guess
mapping status. Legend: **✓ MAPPED** (location known) · **? VERIFY**
(expected in standard Broselow packing or a named drawer — confirm at the
physical cart) · **✗ GAP** (no known home anywhere in the manual's data).

### Monitoring
| Item | Status |
|---|---|
| BP cuffs — neonatal / infant / child / adult | ? VERIFY — Broselow drawers + Room 7 · Monitoring |
| Doppler ultrasound (pulses/BP) | ✗ GAP |
| ECG monitor–defibrillator with pediatric capability + peds pads/paddles | ? VERIFY — defib lives outside cart data today |
| Pulse oximeter with pediatric + infant probes | ? VERIFY — Room 7 · Monitoring |
| Continuous end-tidal CO₂ (peds + adult) | ✓ MAPPED — Code Cart · End-Tidal CO₂ |
| Hypothermia-capable thermometer (reads < 35 °C) | ✗ GAP — also needed by codes c27 |
| Scale in kilograms only | ? VERIFY |
| Length-based resuscitation tape (Broselow) | ✓ MAPPED — Broselow Cart |

### Vascular access
| Item | Status |
|---|---|
| IO needles — pediatric + adult | ✓ MAPPED — Code Cart · EZ-IO |
| IV catheters 22–24 g | ? VERIFY — Broselow drawers / Trauma Cart · IV Supplies |
| Umbilical vein catheters 3.5 Fr + 5 Fr | ✓ MAPPED — OB Cart (UVC kit, card c04) |
| Central venous catheters 4–7 Fr (peds sizes) | ? VERIFY — Room 7 · Vascular Access stocks adult CVC; peds sizes unconfirmed |
| Calibrated-chamber IV sets / infusion pumps | ? VERIFY |
| Fluid/blood warming capability | ✗ GAP in data — exists in hospital, no mapped home |

### Airway
| Item | Status |
|---|---|
| Self-inflating BVM — infant (450 mL) + adult (1000 mL) with neonatal/infant/child/adult masks | ? VERIFY — Broselow drawers + OB Cart · Airway/Breathing |
| Oxygen masks incl. infant/child non-rebreather; nasal cannulae all sizes | ? VERIFY |
| OPAs sizes 0–5 · NPAs infant–adult | ✓ MAPPED — Code Cart · OPA/NPA (peds range VERIFY) |
| Laryngoscope blades — straight 0/1/2, curved 2/3 (+ handles, peds) | ? VERIFY — Code Cart · Direct Laryngoscopy; peds blades unconfirmed |
| ETTs — uncuffed 2.5–3.5, cuffed 3.0–8.0 + stylets peds/adult | ? VERIFY — Code Cart · ETT/Bougie + Broselow drawers |
| Supraglottic airways sizes 1–5 (iGel) | ✓ MAPPED — Code Cart · iGel (peds sizes VERIFY) |
| Magill forceps — pediatric + adult | ? VERIFY |
| Suction catheters 5–14 Fr + Yankauer | ? VERIFY — Code Cart · Suction |
| Nasogastric tubes 8–18 Fr | ✓ MAPPED — Trauma Cart · NG Tube (size range VERIFY) |
| Tracheostomy tubes 0–6 | ✗ GAP — codes c17 (trach emergency) has no mapped kit |

### Procedures / trauma / other
| Item | Status |
|---|---|
| Chest tubes 8–40 Fr (peds sizes matter) | ✓ MAPPED — Trauma Cart + Room 7 · Pigtail; sub-12 Fr VERIFY |
| Cervical collars — infant through adult | ✗ GAP in data |
| Femur splints — pediatric + adult | ? VERIFY — Room 7 · Splints |
| Lumbar puncture trays — 22 g infant/peds + adult | ? VERIFY — Room 7 · Procedure Trays |
| Urinary catheters 5–22 Fr | ? VERIFY |
| Newborn delivery kit + warmer | ✓ MAPPED — OB Cart + warmer |
| Pediatric drug dosing reference (length-based) | ✓ MAPPED — Broselow tape + peds/ tool itself |

**Honest summary: ~8 mapped, ~18 verify-at-the-cart, ~5 true data gaps**
(doppler, hypothermia thermometer, fluid warmer, trach tubes, c-collar
range). The VERIFY column is the real Phase-1 work product: one walk to the
carts with this list turns every ? into ✓ or ✗.

### Standards to add after NPRP (same shape)
- **ACS-TRAUMA** — Resources for Optimal Care equipment expectations.
- **AIM-OB** — obstetric hemorrhage safety-bundle cart contents.
- **DAS-AIRWAY** — difficult-airway cart conventions (maps to the existing
  Code Cart airway drawers almost 1:1).
- **AHA code cart** conventions for the medication drawer.

## 5. Consumers (what changes where)

| Tool | Change |
|---|---|
| `labels/` | Renders from injected inventory instead of its private `CARTS` — zero visual change, one source of truth. |
| `simulations/` | Equipment boxes resolve locations by item id — a moved kit updates every sim on rebuild. |
| `system/` | Gains an equipment audit column (standards coverage %). |
| `inventory/` (new) | Search box: "pigtail" → *Room 7 · Pigtail Thoracostomy*; plus the NPRP green/red audit view. |
| `verify_kit_consistency.mjs` | Extends naturally: kit contents move into the inventory and the test checks all consumers against it. |
| Fork/localization | Another ED edits `LOCATIONS` only (and their own par levels); catalog + standards ship as-is. |

## 6. Open questions for Lon

1. **Granularity floor:** track to the *item* level everywhere (every ETT
   size its own row), or item-level only where a standard demands sizes and
   drawer-level elsewhere? (Recommend: standard-driven — sizes where NPRP
   names sizes, drawer-level otherwise. Keeps the file ~250 rows, not 1000.)
2. **Broselow drawer contents:** transcribe the standard Broselow packing
   list into the catalog now and verify on a cart walk, or photograph/
   inventory the real drawers first? (Recommend: standard first, walk second
   — the diff IS the readiness audit.)
3. **Par levels & expiry:** in scope? (Recommend: par yes — one number per
   location row; expiry no — that's a stocking workflow, not a reference,
   and drifts instantly. The labels' build-sheet cards already handle expiry
   at the physical cart.)
4. **The 5 true gaps** (doppler, hypothermia-capable thermometer, fluid
   warmer, trach tube range, c-collar sizes): file as coverage-gap issues
   like #84–96, or resolve on the cart walk first?
5. Naming: `inventory/` as tool name, or fold the browser into `labels/`?
