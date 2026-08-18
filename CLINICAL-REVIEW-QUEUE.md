# CLINICAL-REVIEW-QUEUE.md — content written but not yet reviewed by a clinician

Everything in this manual was written by a clinician-directed AI against
published guidelines. Some of it has been read back by a clinician; the rows
below have **not**. This file is the worklist for closing that gap, generated
by auditing the repo's own review markers (2026-08-18) rather than from
memory — every row names where the marker lives, so the list can be
regenerated and never silently drifts.

Nothing here is a defect report. It is the difference between *"this was
written from the right source"* and *"a clinician has read it and signed it"*
— which is the only distinction that matters at the bedside.

**How to use it:** work a row, then remove its DRAFT banner (or flip its
registry flag) **in the same commit** that records who reviewed it and when.
A banner removed without a named reviewer is the one outcome this file exists
to prevent.

---

## 1. Cards that announce themselves as unreviewed (13)

Each carries a visible banner: *"⚠ DRAFT — NOT CLINICALLY REVIEWED: written
from the published guidelines cited below to fill coverage gap #NN. Verify
every dose and threshold against local protocol and pharmacy before this card
is trusted."* Drafted 2026-08-12 to fill the COVERAGE-GAPS.md list; the
GitHub issues stay open until each is signed off.

| Card | Title | Gap issue | Highest-risk content to check first |
|---|---|---|---|
| `codes/` c27 | Accidental Hypothermia | [#88](../../issues/88) | Rewarming ladder; when not to declare death; ECMO transfer trigger |
| `codes/` c28 | Sepsis / Septic Shock | [#85](../../issues/85) | Bundle timing; peripheral pressor start and concentration |
| `codes/` c29 | Massive Pulmonary Embolism | [#86](../../issues/86) | Thrombolytic dose and the contraindication list |
| `codes/` c30 | Severe Agitation (Adult) | [#89](../../issues/89) | Ketamine / droperidol doses; monitoring after sedation |
| `codes/` c31 | Adult DKA / HHS | [#90](../../issues/90) | Insulin start, potassium gate, fluid sequencing |
| `codes/` c32 | Aortic Catastrophe | [#91](../../issues/91) | Anti-impulse targets and agent order |
| `codes/` c33 | Heat Stroke | [#92](../../issues/92) | Cooling method and the stop-cooling endpoint |
| `codes/` c34 | Severe Alcohol Withdrawal / DTs | [#94](../../issues/94) | Phenobarbital-vs-benzodiazepine escalation and doses |
| `codes/` c35 | Transfusion Reaction | [#95](../../issues/95) | Stop-the-unit sequence; which reactions allow restart |
| `codes/` c36 | Toxicology Crash Card | [#87](../../issues/87) | Naloxone infusion, bicarb for wide QRS, high-dose insulin, lipid emulsion |
| `trauma/` c09 | MCI — First 15 Minutes | [#93](../../issues/93) | **Also needs the real LRH call tree filled in** |
| `trauma/` c10 | Electrical & Lightning Injury | [#96](../../issues/96) | Reverse-triage claim; monitoring duration |
| `ob-neonatal/` c11 | Eclampsia / Severe Preeclampsia | [#84](../../issues/84) | Magnesium load and infusion; BP agent choice; toxicity rescue |

## 2. A whole tool carrying unreconciled content

**`neonatal/` — the newborn resuscitation engine.** Its review banner is up and
`guidelines.js` carries `nrp: reconciled:false`. The 2025 AHA/AAP items named
in its SOURCE & PROVENANCE panel are aligned; **everything else** — doses, the
SpO₂ target table, the compression ratio, the airway sizes — was carried
across unchanged from the retired `ob-neonatal/` card 03, which itself carried
no citation. Nothing was authored fresh and no number was altered in the move,
but none of it has been checked line-by-line against the NRP 9th edition
textbook.

Flip `reconciled` to true only on a clinician's sign-off — not when the banner
comes down. `verify_neonatal_screen.mjs` fails if the banner is switched off
quietly.

## 3. New clinical content from the airway-sizes work (2026-08-17)

Written against the cited sources, **not yet read back by a clinician**, and —
unlike section 1 — **not banner-flagged**. Worth deciding explicitly whether
these should carry a DRAFT banner until reviewed.

| Where | What was written | Source it was written from |
|---|---|---|
| `peds/` card 16 | The whole sizing ladder: cuffed ETT, depth at lip, blade, supraglottic and suction-catheter size for all nine Broselow drawers, plus the age-based cross-check | AHA PALS 2020 (Circulation 2020;142:S469–S523); Khine cuffed formula; Walls 6th ed. for supraglottic weight ranges |
| `neonatal/` airway ladder | Mask size and ETT suction-catheter size columns added to the weight bands | NRP equipment checklist |
| `ob-neonatal/` equipment panel | MASK and ETT SUCTION tiles added to the weight/gestation calculator | NRP equipment checklist |

The per-drawer sizes are this department's stock resolved from those formulas —
so the review question is two-part: *is the formula right*, and *does the
drawer actually hold that size*. The second half is a cart walk, not a reading.

## 4. Upstream currency — nobody has verified any source yet

All **28** rows in `guidelines.js` carry `lastVerified: null`. That is the
honest state (the field is never backfilled), but it means no human has
confirmed that any tool still matches the current edition of the body it cites.
The watcher reports "no change detected", which is not the same as "nothing
changed" — it cannot see a body that swaps a revised PDF in at the same URL.

Highest-impact rows to verify first, by how much content moves if they change:

| Row | Body / edition | Tools that move |
|---|---|---|
| `aha-ecc-adult` | AHA / ILCOR 2025 | `arrest/` `codes/` `vems/` `simulations/` `peds/` |
| `aha-ecc-peds` | AHA / AAP 2025 (PALS) | `peds/` `arrest/` `codes/` `vems/` |
| `nrp` | AAP / AHA 9th edition | `neonatal/` `peds/` `arrest/` `ob-neonatal/` |
| `atls` | ACS-COT 11th edition (2025) | `trauma/` `tca/` `codes/` `simulations/` |
| `das-adult` | DAS 2025 | `airway/` `codes/#c18` `arrest/` `procedures/` |
| `walls-airway` | Walls 6th edition | `peds/#p16` (added 2026-08-17) |

Full list and cadences: `/sources/` in the running manual, or `guidelines.js`.

## 5. Not clinical review, but the same sign-off queue

- **9 procedure kits marked "DRAFT — not yet assembled or signed off"**: CVC,
  burr hole, escharotomy, resuscitative thoracotomy, TVP, penetrating neck
  trauma, junctional hemorrhage control, JADA, resuscitation line. The card
  content is written; the physical kit has not been built and checked against
  it.
- **Cart labels** in `labels/`: several marked DRAFT / NOT YET ASSEMBLED, and
  one marked *"CORRECTED 2026-08-13, NOT YET RE-VERIFIED"*.
- **Equipment gaps** filed as issues [#98](../../issues/98)–[#102](../../issues/102)
  (doppler, hypothermia-capable thermometer, fluid/blood warmer, tracheostomy
  tubes 0–6, cervical collar size range) — these are department stock
  questions, answered by a cart walk rather than a reading.

---

## Suggested order

1. **Section 3** — smallest, newest, and already in front of patients without a
   banner.
2. **Section 1's drug-dose cards** — c36 toxicology, c34 withdrawal, c31 DKA,
   c30 agitation, c28 sepsis. Wrong numbers here are the ones that hurt.
3. **Section 2** — `neonatal/`, because a whole tool rides on it.
4. **Section 1's remainder**, then **section 4** on the review cadence each row
   already carries (`reviewEvery`).
