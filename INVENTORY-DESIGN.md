# INVENTORY-DESIGN.md — ED equipment inventory: design for review

Status: **PHASE 2 SHIPPED (2026-08-12).** Phase 1 built the two-layer
inventory and the read-only NPRP audit. Phase 2 turned it into a **process**:
sizes are auditable rows, six more national standards sit alongside NPRP, kits
are audited as kits, and the walk is captured in the tool itself rather than on
a marked-up printout. §7 and §8 below are the Phase 2 record — read those first
if you are picking this up.

Decisions (Lon, 2026-08-12):

1. **Granularity:** sizes only where a standard names sizes; drawer/kit level
   elsewhere. *(Phase 2: sizes are now their own rows — see §7.1.)*
2. **Broselow:** transcribe the standard packing list first, then diff it
   against the real cart — the diff is the readiness audit.
3. **Par levels yes, expiry no.**
4. **The 5 true gaps are filed as issues:** doppler #98 · hypothermia-capable
   thermometer #99 · fluid/blood warmer #100 · trach tube range #101 ·
   c-collar sizes #102 (label `coverage-gap` + `equipment`).
5. **Tool name: `equipment-readiness/`** ("Equipment Readiness").

Phase 1 scope (this build): `inventory.js` + build-time injection + the
equipment-readiness browser/audit tool. The labels/ and simulations/
consumers migrate onto the injected data in a follow-up phase, so this ships
without touching the label generator.

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

---

## 7. Phase 2 — what changed, and why (2026-08-12)

Phase 1 produced an honest read-only picture: ~8 mapped, ~18 verify, 5 gaps
against one standard. Using it exposed three limits, each fixed below.

### 7.1 Sizes are rows, not adjectives

*"Supraglottic airways 1–5: MAPPED"* answers a question nobody asks. The
question at the head of the bed is whether **this** size is in **that** drawer.
So a catalog item may carry `sizes:[…]`, and each size becomes its own
auditable row keyed `id#size`; `INV_LOCATIONS` accepts either an item key or a
size key, and a size key wins.

The first thing this surfaced was already true and already invisible: LRH
stocks **LMA 0 and 0.5 on the OB cart** and **i-gel 1 through 5 on the code
cart**. At item granularity that is one green row. At size granularity it is
two devices, two carts, and a handover fact worth knowing at 3 a.m.

The catalog now sizes ~40 items — airways, tubes, blades, cannulae, chest
tubes, collars, cuffs, IO needles, catheters — for ~230 standard rows, plus a
row per kit and per kit-content line.

### 7.2 Seven standards, not one

NPRP is the **pediatric** checklist. It says nothing about a pelvic binder, a
rapid infuser, a difficult-airway trolley, a hemorrhage cart or dantrolene, so
a department at 100% NPRP could still be missing everything an adult trauma or
an obstetric hemorrhage needs. The tool now scores:

| Key | Standard | Why it is here |
|---|---|---|
| `NPRP` | AAP/ACEP/ENA pediatric readiness equipment appendix (Pediatrics 2018) | The national pediatric readiness score is built on it. |
| `ACS-COT` | ACS *Resources for Optimal Care of the Injured Patient: 2022 Standards* | The adult/trauma half NPRP does not cover. |
| `ASA-DA` | ASA difficult airway guideline 2022, portable storage unit contents | The rescue equipment must be **together**, not scattered. |
| `NRP` | Neonatal Resuscitation Program 8th ed., delivery-room supplies | Unplanned births arrive in the ED. |
| `AIM-OB` | AIM obstetric hemorrhage bundle (hemorrhage cart), item detail per CMQCC toolkit | A postpartum hemorrhage can present to an ED with no OB service. |
| `MHAUS` | MHAUS malignant hyperthermia cart contents | Succinylcholine in RSI is a triggering agent. |
| `ASRA-LAST` | ASRA LAST advisory — lipid rescue kit | Nerve blocks and large-volume local. |

**Deliberately not scored**, so nobody re-litigates it: AHA/ACLS (publishes no
cart parts list), Joint Commission and CMS Conditions of Participation (require
that emergency equipment be available and checked, without itemizing it), ENA
and ACEP department-planning guidance (capability language already covered by
the ACS and NPRP rows), ATLS (a course, not an equipment standard).

**Itemized vs narrative.** `ACS-COT` is marked `kind:"narrative"` because the
ACS standard states capability rather than printing a parts list. Its rows are
this manual's reading of it and the tool says so on screen, in a caution box,
above the rows. That distinction has to survive: a survey is exactly where
somebody quotes our list back as the standard's own words.

### 7.3 A gap is an assertion, not an empty cell

Phase 1 had two states, MAPPED and GAP, so an item nobody had looked at scored
identically to an item somebody had confirmed absent. There are now four:

- **MAPPED** — a location already in `inventory.js`, no `verify` flag.
- **VERIFY** — believed present at that location, unconfirmed on a cart walk.
- **NOT REVIEWED** — nobody has looked. The default, and not a claim.
- **GAP** — asserted absent, either in source (`INV_GAP_ISSUES`, with an issue
  number) or by whoever walked the cart.

Only **MAPPED** and **RECORDED** (set on the walk) count toward a percentage.
A readiness number that rises because nobody looked is worse than no number.

### 7.4 One row, one control

Half these items belong to two or three standards, and every kit belongs to the
KITS section as well. Each row therefore renders its control exactly **once**,
in its home standard (`std[0]`), and renders a read-only echo everywhere else;
multi-size items echo as a roll-up ("3 of 7 ready"). Two controls writing one
row is how a walk ends up disagreeing with itself halfway down the page.

Catalog items belonging to **no** scored standard — a local addition, or an
item whose standard a fork dropped — render in a `LOCAL` section. Without it
they would exist in the data and appear nowhere on screen, which is worse than
not carrying them at all.

## 8. The readiness process (what the tool is actually for)

1. **Print or carry it.** `PRINT WALK` prints every section, including the ones
   left collapsed, with a blank location line and a GAP box per row.
2. **Walk the carts.** For each row, set the dropdown: a location (type where
   it actually is — the manual's own guess is prefilled, so usually you are
   confirming or correcting a string) or **GAP**. Kit contents get IN THE KIT /
   MISSING / ELSEWHERE. `N/A at this site` exists so a fork is not permanently
   red for a service it does not run.
3. **Nothing leaves the device.** Capture is `localStorage` on that browser
   only — no PHI, no network, no server (CLAUDE.md rule 3). `RESET THIS DEVICE`
   clears it and returns every row to the manual's baseline.
4. **Hand it back to git.** `BUILD EXPORT` emits paste-ready `INV_LOCATIONS`
   lines plus a gap list. Paste the locations into `inventory.js`, delete the
   `verify:true` flags that were personally confirmed, and open one issue per
   gap (`coverage-gap` + `equipment`). That is how a walk becomes the manual's
   new baseline instead of a photograph of a clipboard.
5. **Re-walk on a cadence.** The percentage is only true as of the last walk;
   the tool deliberately does not decay it, because a number that rots quietly
   is worse than a date on a page.

`verify_equipment_readiness.mjs` protects the parts of this that a refactor
could break silently: that every configured size has a row, that a typed
location survives a reload, that RESET clears the device and not the baseline,
that an untouched row reads NOT REVIEWED rather than MAPPED, that each standard
carries its citation, and that no field asks for anything patient-identifying.
Per CLAUDE.md's config-driven rule it reads all of that from the page's own
injected inventory, so a fork with different sizes, locations or standards
stays green — proven both ways before shipping, including a mutation run where
the page's logic was broken with the config left alone.

## 9. Phase 3 — the sims are the orientation walk (2026-08-12)

The readiness walk assumed a champion with an hour and a clipboard. The
department already runs a thing where people stand in the resuscitation bay and
reach for equipment under time pressure, and it already knows exactly which
items each case needs: the sims. So each sim now carries a **FIND IT** block —
the equipment that case actually requires, with where the manual says it lives
— and it writes into the **same** device-local record as the cart walk.

That is the whole design: a new nurse locating the pediatric pads during SIM 3
has established precisely the fact the readiness audit exists to establish. It
would be absurd to make someone record it twice, and worse to let the two
records disagree.

### 9.1 What it means for orientation

An orientation session stops being a tour and becomes an audit. The person
being oriented finds each item and says the location out loud; the preceptor
taps **FOUND** when it matches the manual, types where it really was when it
does not, and logs a **gap** when it is not there at all. The new hire learns
the room; the department learns what is missing. Same hour, two products.

### 9.2 Design constraints that shaped it

- **One tap is the common case.** The default option is *FOUND — where the
  manual says*, which stores the manual's own location string without anyone
  typing. Typing is reserved for the case worth capturing in words: reality
  disagreeing with the manual. A row the manual has no location for offers no
  one-tap option, because there is nothing to confirm.
- **Kits at kit level only.** The sims say *point, don't open* — a sealed tray
  costs a full re-check to reseal. Kit contents are audited in
  `equipment-readiness/`, never in a drill. `verify_sim_equipment.mjs` asserts
  no sim asks for a `kit@n` row.
- **Provenance travels with the fact.** Each record carries *where it was
  confirmed* ("SIM 3", "cart walk") and the export prints it, because a champion
  reviewing findings deserves to know which came from a drill.
- **One store, one RESET.** The clear control lives only in
  `equipment-readiness/`. A second reset button in the sims would be a second
  thing to forget, and orientation data surviving a reset someone believed was
  total is worse than no reset at all.
- **Sims stay out of site search** (CLAUDE.md rule 9's standing exception), so
  nothing here adds a `SEARCH_INDEX` entry. An orientation checklist must never
  surface next to a clinical card at the bedside. The landing tile carries the
  orientation framing instead.

### 9.3 Where the code lives

`INV_CAPTURE` and `invStatus()` moved into `inventory.js`, which both tools
already inject — so the store, the four states, and what MAPPED / RECORDED /
GAP / NOT REVIEWED mean are defined exactly once. `SIM_EQUIPMENT` (which rows
each case needs) stays in `simulations/` as site config, since it describes the
scenario rather than the inventory. A mistyped id renders an **UNKNOWN ROW**
line on screen and fails the suite, because an orientation checklist that
silently drops the chest tube is worse than no checklist.
