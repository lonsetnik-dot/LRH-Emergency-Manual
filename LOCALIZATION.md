# Localization

How the generic base is kept free of any one hospital's truth, and how a hospital
puts its own truth back in.

This document is both the **inventory** — everything that is site-specific and
where it lives — and the **process** an adopting ED walks through. It supersedes
the "seven things" section of `LOCALIZING.md`, which was written before the full
sweep and understates the surface considerably.

---

## The principle

> **The generic base ships no local truth, and no plausible default for anything
> that could hurt someone.**

Two halves, and the second is the one that matters.

Stripping LRH's values is easy. The trap is what replaces them. A generic base
that ships `norepinephrine 4 mg/250 mL` as a "sensible default" is more dangerous
than one that ships nothing, because a hospital that hangs 8 mg/250 mL and never
touches the config reads **exactly half** the rate it needs, in a confident large
font, forever. The codebase already says this in a comment at
`codes/index.html:2900`. It is the governing insight of this whole document.

So every safety-critical value is removed and replaced by an **unset state that
is impossible to mistake for a value**. The manual already does this correctly in
one place — an unset weight renders `set weight`, never a stale or default dose.
That pattern generalizes to everything in Tier 1 below.

---

## Risk tiers

Every localization carries a tier. The tier decides what the base ships, and what
gate the fork has to pass.

| Tier | Meaning | Base ships | Gate to go live |
|---|---|---|---|
| **1 — Safety-critical** | A wrong value could contribute to patient harm | Nothing. An explicit `NOT SET` that blocks the dependent display. | **Named clinician sign-off**, recorded with a date. No sign-off, no value. |
| **2 — Operational** | Wrong is unhelpful or slow, but visibly wrong | A neutral placeholder that reads as a placeholder | Reviewed by whoever owns that domain (pharmacy, materials, ED ops) |
| **3 — Cosmetic** | Identity and presentation | A neutral generic value | Edit and move on |

**31 Tier-1 items, 27 Tier-2, 6 Tier-3** were found in the sweep. Tier 1 is not
a formality — several of these change what a clinician does.

---

## Tier 1 — Safety-critical (31)

### Assay values

**hs-troponin thresholds** — `clinical-pathways/heart/`. The SITE block holds
`ruleInValue`, `ruleInDelta`, `ruleOutValue`, `ruleOutDelta`, `singleLoD`,
`grayLow`/`grayHigh`, and sex-specific normal limits (male 19.8, female 14.9).
Every one is bound to a specific analyzer. The page says so itself.

> **The mirror bug — fix this first.** Ten of these numbers are also re-typed as
> plain text in the page's own reference tables (`:179`, `:180`, `:200`,
> `:218`–`:222`, `:301`, `:303`). A fork that correctly edits the SITE block
> **still displays LRH's cutoffs** in the table a clinician actually reads.
> Nothing tests that the two agree. This is the single highest-risk defect the
> sweep found.

### Device and equipment

- **Defibrillator make and energy ladder** — ZOLL 120→150→200 J, held in **two**
  SITE blocks (`codes/`, `arrest/`) that must be changed together.
- **Pediatric defibrillation** — 2→4 J/kg, 10 J/kg cap.
- **Pediatric airway sizes by Broselow band** — `peds/`, explicitly "resolved to
  the half-size actually packed in each colour drawer of this department's cart."
  Another hospital's drawers hold different sizes.
- **`INV_BROSELOW_PACK`** — nine bands of ETT / blade / OPA / suction / IV / NG
  sizes, labelled a universal summary but functioning as a stock claim.
- **Blakemore vs Minnesota tube** — the 250–300 mL inflation figure is the
  Sengstaken-Blakemore number. A hospital stocking a Minnesota tube needs
  450–500 mL. The poster warns about this in prose; a fork that swaps tubes and
  not the number **under-inflates by roughly 200 mL**.
- **LMA sizing** — NRP names size 1; the card follows LRH's shelf, which stocks
  LMA 0 and 0.5 on the OB cart.
- **DAS airway ladder** — attempt ceilings, ETO₂ 0.9, head-up 30°, HFNO 30 L/min,
  cricoid 10 N/30 N, and the FONA kit contents.

### Formulary

- **Pressor bag concentrations** — seven agents. Every mL/hr on the page derives
  from these. The halving failure mode described above lives here.
- **Push-dose recipes** — dilution instructions, not computed.
- **RSI and post-intubation agents** — house first-choice drugs, per-kg doses,
  and the rounding increment.
- **Arrest drugs** — epinephrine concentration, amiodarone and lidocaine ladders,
  pediatric ceilings. Held in **two** blocks.
- **Uterotonic sequence** — oxytocin, TXA, misoprostol, methylergonovine,
  carboprost, with contraindication guards; O-negative unit count.
- **Chest-tube prophylaxis antibiotic** — an antibiogram decision.

### Capability and scope of practice

These are the ones that change behavior rather than a number, and they are easy
to miss because they read as prose rather than config.

- **"No on-site cath lab — TNK then transfer."** A PCI-capable hospital that
  inherits this **lyses a STEMI it should have cathed.**
- **"No platelets on site"** — stated twice on the massive transfusion card and
  used to change what the clinician does ("don't wait on them to start").
- **Level III trauma center, no in-house neurosurgery** — on three cards.
- **No endoscopy, no IR, no TIPS** — routes GI bleeds off-site.
- **MTP activation criteria and who may activate** — local policy.
- **Which transfer destination each card offers** — a clinical routing decision,
  deliberately different per card, not an identity setting.
- **Tele-ED and tele-NICU availability** — a fork without the service gets a
  prominent button that activates nothing.

### Contacts

- Default transfer center and phone; three named receiving hospitals with dial
  strings. Used by trauma, GI bleed, epistaxis, STEMI, PE, and HEART.
- **Blood bank / MTP activation number — there is nowhere to put it.** The
  manual says "say it, don't dial," and no config field exists. The generic base
  must add one.

### Governance — and this one is a credential, not a value

- **Sixteen "CLINICALLY REVIEWED — Lon Setnik" assertions** rendered into pages,
  plus `reviewedBy` fields in two SITE blocks and signed-off names in the review
  flags.

  A fork inherits a **named clinician's sign-off it never earned**, on a bedside
  instrument, inviting exactly the unverified reliance the whole project warns
  against. Every attribution is stripped from the base. The field exists; it is
  empty; it is filled only by the person who actually did the review.

### Cross-tool duplication

Five values are duplicated by design across two tools, with a comment saying so.
A fork that edits one gets **two screens disagreeing mid-code**:

`arrest/` ↔ `codes/` arrest config · weight/age routing triggers (50 kg / 12 yr
vs 40 kg / 12 yr — deliberately different) · NRP off-ramp thresholds ·
`neonatal/` ↔ `ob-neonatal/` cord-management timing · `peds/` ↔ `codes/` stale
weight window.

---

## Tier 2 — Operational (27)

**Physical locations — roughly 250 strings, the largest single surface.**
`inventory.js` holds 84 `loc:` entries and a directory of five named carts;
`labels/` holds 75 label objects plus hardware dimensions measured from LRH's
actual drawer fittings; `system/` prints the generated map; `codes/` carries a
cart infographic; nine posters print a location banner. All of it is one
hospital's furniture.

**Gap claims.** `INV_GAP_ISSUES` asserts five items are *absent* at LRH. A fork
inherits being told it lacks stock it has.

**Equipment readiness state.** Confirmed and `verify:true` flags encode a cart
walk that happened at LRH, not at the fork.

**Identity that leaks past the config.** The feedback address is a personal Gmail
reached from 31 buttons. Eighteen hardcoded links point at the upstream GitHub
repo's issues. Poison control is hardcoded on one card while the same page uses
the token twice elsewhere — and it is a US number.

**The QR codes are the sharp one.** Sixty-one QR pixel matrices in `labels/` have
LRH's domain baked into their modules, while the printed caption uses the token.
A label printed at another hospital shows *their* name and **scans a clinician
into LRH's clinical values.** Regeneration is required, not optional.

**Also:** lorazepam as first-line preference, EMTALA escalation chain, alcohol
withdrawal ladder, anticoagulant reversal stock claims, scene-security
escalation, an external download link that breaks the offline guarantee, and the
worked LRH examples inside the localization docs themselves.

---

## Tier 3 — Cosmetic (6)

Hospital name, abbreviation, eyebrow, footer, domain, title — all already
parameterized in `site.config.json` and clean. Brand accent color (`#00693E`,
"Dartmouth green") and `theme-color` are still hardcoded across 14 files and move
into tokens. Design-document titles and file comments name LRH. The `vems` room
and paper-size strings.

---

## What the base ships instead

| Kind | Generic base ships |
|---|---|
| Tier-1 number | `NOT SET`, and the dependent display is **suppressed**, not defaulted. A dose that cannot be computed is not shown as a guess. |
| Tier-1 capability claim | A neutral question the fork must answer — "Is there a cath lab on site?" — with both branches authored, rather than one branch baked in as prose. |
| Tier-1 attribution | Empty. Never backfilled. Follows the existing `guidelines.js` pattern where `lastVerified: null` until a human checks. |
| Tier-2 location | `LOCATION NOT SET`, obviously a placeholder, never a plausible cart name. |
| Tier-2 contact | Empty, and the renderer prints plain text rather than a link that dials nothing — the existing `Tel` convention, generalized. |
| Tier-3 identity | A neutral generic value. |

**Universal clinical logic stays.** The HEART math, the arrest cycle, the DAS
ladder structure, the NRP sequence, the pathway shapes — these are not local and
are not stripped. The engine is generic; only the truth is local.

---

## The process a hospital walks through

Written for a clinician with an AI assistant, not for a developer. Each step
produces a recorded answer; the fork cannot go live with Tier-1 answers missing.

**Step 1 — Identity (an hour).** Edit `site.config.json`: name, abbreviation,
domain, footer, feedback address. Replace the brand accent token. Nothing
clinical happens here.

**Step 2 — Capability interview (a conversation, with your medical director).**
Answer the scope questions before any number: cath lab, platelets on site,
trauma level, neurosurgery, endoscopy/IR, obstetric service, tele-ED, tele-NICU,
who may activate MTP. **These answers change which content renders**, so they
come first. Getting them wrong is how a fork lyses a STEMI it could have cathed.

**Step 3 — Contacts.** Transfer center and every receiving hospital, with dial
strings. Blood bank and MTP activation. Poison control for your country. Leave a
number empty rather than guessing — the renderer handles empty correctly and
handles wrong very badly.

**Step 4 — Equipment and devices (walk the room).** Defibrillator make and its
published energy ladder from the manufacturer label, not from this manual.
Broselow band packing — open the drawers and record what is actually in them.
Balloon tamponade tube type and its inflation volumes. Airway kit contents.

**Step 5 — Formulary (with pharmacy).** Every bag concentration. Push-dose
recipes. RSI agents and doses. Arrest drugs. Uterotonics. Prophylactic
antibiotic, against your antibiogram.

**Step 6 — Assays (with the lab).** Your hs-troponin analyzer's thresholds and
sex-specific limits. This is the step most likely to be done from memory and most
likely to be wrong.

**Step 7 — Locations (walk the carts).** Every drawer, every cabinet, every kit.
Expect this to be the longest step and the least intellectually demanding one.

**Step 8 — Regenerate artifacts.** QR codes, the system map, printed labels and
posters. A stale QR sends a clinician to another hospital's manual.

**Step 9 — Review and sign off.** A named clinician reviews each tool and records
their name and date. Until then the tool renders its unreviewed banner. **This
step cannot be automated and cannot be skipped**; it is what the empty
attribution fields are for.

**Step 10 — Run the suite.** `bash run-tests.sh`. `verify_localization.mjs` fails
while any Tier-1 value is still `NOT SET` or any attribution is empty — so a
fork cannot accidentally go live half-localized.

---

## Enforcement

Prose does not hold. Four suites make this real:

- **`verify_localization.mjs`** — no LRH-specific string outside `site.config.json`
  and the marked SITE CONFIG blocks. Every tool has a marked block. Fails the
  build for a fork with unfilled Tier-1 values.
- **`verify_config_mirror.mjs`** — every value that appears both in SITE CONFIG
  and in on-page text is *generated from* the config, never re-typed. This is the
  troponin bug, generalized so it cannot recur.
- **`verify_config_pairs.mjs`** — the five duplicate-by-design pairs agree. A
  comment saying "change both by hand" is not a mechanism.
- **`verify_attribution.mjs`** — no clinician name, sign-off, or review date
  appears in the generic base. A fork's own names are permitted only where a
  matching date exists.

---

## Repository topology

This changes what the project *is*, and the change has to be made explicitly.

`CLAUDE.md` currently states *"There is no generic trunk branch,"* and
`site.config.json` states *"There is no generic edition on main, deliberately."*
`README.md` states the opposite. `LOCALIZING.md` already calls the project "the
CairnReady generic trunk." Four documents, three positions.

The decision this work implements: **`main` becomes the generic base. LRH becomes
a fork of it, like any other hospital.** That is the only topology in which the
base is genuinely tested — because if LRH's own deployment consumes the generic
base through the localization process, then the process is exercised every time
LRH changes anything, and it cannot quietly rot.

The consequence to accept: LRH's edition becomes a downstream copy with its own
review dates, and updates flow trunk → fork rather than being edited in place.
`CLAUDE.md`, `SITES.md`, `README.md`, and `site.config.json`'s comment are all
amended to say this, once, consistently.
