# TERMINOLOGY.md — US English localization

This repo is written in US medical English because LRH is a US hospital. If you
fork this for a site outside the US, this file is your checklist for reverting
back to your own dialect — search each row's **US term** and swap in your
preferred alias.

This is a language/spelling localization list, distinct from the **SITE
CONFIG** blocks each tool carries for clinical thresholds, drug names, and
site-specific values (see `CLAUDE.md` golden rule 2). Terminology below is
prose style, not clinical content — changing it doesn't change any dose,
threshold, or citation.

## Audit — 2026-08-07

Swept every live tool (`codes/`, `ob-neonatal/`, `peds/`, `procedures/`,
`trauma/`, `clinical-pathways/`, `posters/`) plus the landing page for
non-US medical and general-English terms. Findings and fixes below.

| Found (non-US) | Replaced with (US) | Where |
|---|---|---|
| adrenaline | epinephrine | `procedures/index.html` (×4 — burr hole, chest tube, canthotomy, tourniquet-adjacent drug prep), `posters/burr-hole/index.html` (×2), `posters/canthotomy/index.html` (×2) |
| paralysed | paralyzed | `procedures/index.html`, `posters/burr-hole/index.html` |
| colour | color | `ob-neonatal/index.html`, `codes/index.html` (×2, one user-facing, one code comment), `peds/index.html` (×5, all code comments) |
| trauma centre | trauma center | `procedures/index.html` |
| salbutamol (paired with albuterol) | albuterol only | `peds/index.html` — was `Bronchodilators (albuterol/salbutamol)`, simplified to `Bronchodilators (albuterol)` since the US card doesn't need the INN alongside the USAN |

## Audit — 2026-08-12 (second sweep)

The 2026-08-07 pass caught the drug names and the obvious spellings but missed
whole clusters of clinical vocabulary, because it searched for the terms it
already expected. This pass ran the full alias table below as one regex across
every `.html`, `.js` and `.mjs` in the repo and inspected each hit in context.

| Found (non-US) | Replaced with (US) | Where |
|---|---|---|
| oesophagus / oesophageal / OESOPHAGUS | esophagus / esophageal / ESOPHAGUS | `procedures/` SALAD card (×11, incl. the infographic label and the search keywords), `system/` (×1), `airway/` DOPE line (×1), landing `index.html` search keywords (×1) |
| haemothorax / Haemothorax | hemothorax / Hemothorax | `procedures/` pigtail card (×8) |
| haemoptysis / Haemoptysis | hemoptysis / Hemoptysis | `procedures/` SALAD card (×2) |
| haemorrhage | hemorrhage | `procedures/` (×3), `labels/` (×1) |
| haemodynamic / haemodynamically | hemodynamic / hemodynamically | `procedures/` pigtail card (×2) |
| oedema (standalone) | edema | `procedures/` (×4 — pulmonary edema, re-expansion edema) |
| anaesthetic / anaesthesia | anesthetic / anesthesia | `procedures/` (×1), `labels/` (×1), `airway/` (×3 — our sentences *about* DAS, which is British; the prose is ours, not a quotation) |
| centred / receiving centre | centered / receiving center | `procedures/` (×2), `system/` (×2), `codes/` (×2) |
| litres | liters | `procedures/`, `system/`, `posters/ava3xi/` (×2 each) |
| behaviour | behavior | `codes/` (magnet behavior), `arrest/`, `verify_offline.mjs` comment |
| colour / colours / Colour / COLOUR | color / colors / Color / COLOR | `labels/` (×13 — the whole design-rationale comment block and the cart notes), `airway/` (a JS parameter name), `verify_arrest_screen.mjs` (×2 test labels) |

Test suites were updated in the same pass where they assert on the changed
prose (`verify_issues_20260809.mjs` — "proximal esophagus", "hemothorax routed
to a chest tube"; `verify_airway_screen.mjs` — "written for anesthesia"). A
terminology fix that leaves a suite red teaches people to ignore a red suite.

**Note on `angioedema`:** that IS the US spelling. A naive `oedema → edema`
search-and-replace corrupts it in `codes/`, `peds/`, `simulations/`, `vems/`
and the landing page. Any future sweep must exclude it explicitly.

## Deliberately left unchanged — not our prose

A few instances of British/Commonwealth spelling survive on purpose because
they're inside verbatim citations, not our own writing. Changing these would
misquote the source:

- `peds/index.html` — `"Timing of repeat epinephrine to inform paediatric
  anaphylaxis observation periods"` (Dribin TE, et al., *Lancet Child Adolesc
  Health* 2025) — this is the paper's actual title, quoted directly.
- `peds/index.html` — **Canadian Paediatric Society** — the organization's own
  legal name; they spell it with a "ae".
- `procedures/index.html` — **Alfred Emergency Academic Centre** (Alfred
  Health, Melbourne, Australia) and **Royal College of Surgeons Edinburgh** —
  real institution names in citations.
- `codes/index.html` — **LITFL, "Haemoptysis"** — the linked page's own title on
  an Australian site.
- `airway/index.html`, `codes/index.html`, `verify_airway_screen.mjs` — **Br J
  Anaesth** — the journal's name.
- `airway/index.html` — **"paediatric (APA/DAS)"** in the list of DAS
  guidelines — that is the guideline's actual title.
- `arrest/index.html` — the `LOCALE` block's `/* UK: adrenaline */`,
  `/* UK: lignocaine */`, `/* UK: paediatric */`, `/* UK: anaesthetic */`
  comments, and the same convention in `verify_airway_screen.mjs`
  (`UK: suxamethonium`). These comments exist *to* name the alias; "fixing"
  them deletes the localization map.
- Anywhere **Tactical Combat Casualty Care (TCCC)** appears — "casualty" here
  is the actual name of a US DoD program, not the British word for an ED.
- "Mass casualty," "multiple casualties" — standard US EMS/trauma terminology,
  not a localization issue at all.

General rule going forward: fix spelling/word-choice in *our own* prose: fix
drug names, checklist text, headers, UI copy, code comments. Never edit the
text inside a direct quote or a proper name, even if it uses non-US spelling
— cite it as written and note the US equivalent alongside if it matters
clinically.

## Common aliases to watch for (not all found yet, kept here as a checklist)

Useful for future review passes or for a non-US fork reverting this list.
US term first, then the common Commonwealth/international alias.

| US | Alias | Notes |
|---|---|---|
| epinephrine | adrenaline | drug name |
| norepinephrine | noradrenaline | drug name |
| acetaminophen | paracetamol | drug name — also brand "Panadol"/"Calpol" outside the US |
| albuterol | salbutamol | drug name (USAN vs INN) |
| succinylcholine | suxamethonium | drug name (USAN vs INN) — found and fixed in `airway/index.html` (×2) 2026-08-12; DAS is a UK guideline, but our prose is not a quotation |
| nitroglycerin | glyceryl trinitrate (GTN) | drug name |
| lactated Ringer's | Hartmann's solution | IV fluid |
| color / colored | colour / coloured | spelling |
| center | centre | spelling |
| liter | litre | spelling |
| program | programme | spelling |
| paralyzed / paralyze | paralysed / paralyse | spelling |
| organize / recognize / analyze | organise / recognise / analyse | spelling (-ize/-ise) |
| labor | labour | spelling |
| pediatric | paediatric | spelling |
| edema | oedema | spelling |
| hemorrhage | haemorrhage | spelling |
| anesthesia | anaesthesia | spelling |
| esophagus | oesophagus | spelling |
| fetal / fetus | foetal / foetus | spelling |
| ED (emergency department) | A&E, Casualty | department name |
| OR (operating room) | theatre | room name |
| resident / fellow | registrar, SHO, F1/F2 | UK training-grade titles have no direct US equivalent — don't auto-map, they map to different years of training |
| attending | consultant | role title |
| vitals | obs (observations) | shorthand |
| page / pager | bleep | shorthand |
| nothing by mouth / NPO | nil by mouth / NBM | Latin abbreviation convention differs |
| discharge prescription | TTA / TTO ("to take away"/"to take out") | UK discharge-meds shorthand |

None of the alias-column terms above were found in the current codebase as of
this audit — this table exists so the next reviewer (or a non-US fork) has a
ready checklist instead of re-deriving it.

## LOCALE layer — `arrest/index.html` (the VF/arrest engine)

`arrest/` is the first tool with a **runtime locale switch** for the parts of
its content that are generated in JavaScript (dose strings, the reference
accordions, status labels). Instead of hunting those terms through the logic, a
fork edits one block near the top of the script:

```js
var LOCALE = {
  epinephrine: 'epinephrine',   // UK: adrenaline
  lidocaine:   'lidocaine',     // UK: lignocaine
  amiodarone:  'amiodarone',    // (same)
  pediatric:   'pediatric',     // UK: paediatric
  anesthetic:  'anesthetic'     // UK: anaesthetic
};
```

Every dynamic string reads these through `L()` (lowercase), `Lc()`
(Capitalized) or `Lu()` (UPPERCASE), so changing a value here re-localizes all
JS-generated content on the next paint — verified: setting `adrenaline` /
`lignocaine` / `paediatric` flips the epinephrine accordion, the antiarrhythmic
doses and the pediatric-mode banner together. **Scope:** this covers the
JS-generated content only. **Static HTML prose** in the same file (the idle
pulse-check gate, the ROSC checklist, the rhythm-check sheet) is still swept to
the site's dialect by hand — the US default is what ships. Direct citations and
proper names (AHA "Part 6, Pediatric BLS", journal titles) are left exact in
both layers, per the exemptions above.

This is the "isolate site-specific values" rule (CLAUDE.md rule 2) applied to
terminology: clinical thresholds live in `SITE`, and locale-specific wording
lives in `LOCALE`, both editable in one place per tool.
