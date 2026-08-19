# COVERAGE-GAPS.md — major ED situations not yet covered

A running log of significant emergency-department situations that have **no
card anywhere in the manual**, kept while building the simulations pack
(2026-08-12, per Lon's request). Each open row is also filed as a GitHub issue (label `coverage-gap`, #84–#96). This is a log, not a work order — each row is
a candidate for a future card, ranked by how likely it is to matter at a rural
critical-access ED like LRH. When one of these gets a card, move the row to
the bottom section.

Method: compared every live card (codes 24, peds 15, OB 9, trauma 8,
procedures 16, airway, arrest, tca, conversations 4, HEART pathway) against
the common "high-acuity ED presentations" space. "Nearest coverage" = the
closest thing a clinician would find by searching today.

## Open gaps

| # | Situation | Why it matters here | Nearest existing coverage | Natural home |
|---|-----------|--------------------|---------------------------|--------------|
| 1 | **Eclampsia / severe preeclampsia — magnesium protocol** ([#84](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/84)) | The OB tool covers delivery-side emergencies but not the hypertensive ones; a seizing pregnant patient is exactly the rare-but-time-critical case this manual exists for. Mag dosing, BP agents, delivery decision. | OB tool (adjacent cards only); peds status epilepticus (wrong patient) | `ob-neonatal/` new card |
| 2 | **Adult sepsis / septic shock** ([#85](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/85)) | Highest-volume killer on the list; bundle timing, pressor start, peripheral-pressor guidance for a shop that may not place a CVC quickly. | Codes hemorrhagic shock (wrong shock) | `codes/` new card |
| 3 | **Massive / high-risk pulmonary embolism** ([#86](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/86)) | The lytic decision under pressure, mirror of STEMI's TNK logic; PE arrest is also a named H&T with nowhere to click through to. **Drafted:** `codes/` c29 (the Category D–E action card) plus `clinical-pathways/pe/` (the classification calculator, [#181](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/181)). Row stays open until a clinician signs both off. | Arrest H's & T's mention; STEMI card (drug logistics analogue) | `codes/` card + PE pathway |
| 4 | **Toxicology set — opioid OD, TCA OD, beta-blocker/CCB OD, tox-induced arrest** ([#87](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/87)) | No tox anywhere in the manual. Naloxone drips, bicarb for wide QRS, high-dose insulin, lipid emulsion — all rare-and-forgettable, all card-shaped. | Nothing | `codes/` cards or a small `tox/` tool |
| 5 | **Accidental hypothermia / cold-water drowning** ([#88](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/88)) | Littleton sits in the White Mountains — hypothermic arrest ("not dead until warm and dead"), rewarming ladder, and the transfer-for-ECMO decision are regional bread-and-butter rarities. | Arrest engine (no hypothermia branch) | `codes/` new card |
| 6 | **Adult severe agitation / behavioral emergency** ([#89](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/89)) | Peds has an agitation card (p09); adults — the far more common case — have none. Ketamine/droperidol dosing, restraint documentation, staff safety. | `peds/` p09 only | `codes/` new card |
| 7 | **Adult DKA / HHS** ([#90](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/90)) | Peds has DKA (p07); adult DKA is a daily reality and the insulin/fluids/potassium sequencing is protocol-shaped. | `peds/` p07 only | `codes/` or clinical-pathways |
| 8 | **Aortic catastrophe (dissection / ruptured AAA)** ([#91](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/91)) | Recognition + anti-impulse therapy + the transfer call; another "90 minutes from definitive care" pathway like STEMI. | Nothing | `codes/` new card |
| 9 | **Heat stroke / severe hyperthermia** ([#92](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/92)) | Seasonal mirror of hypothermia; cooling ladder and when to stop. | Nothing | `codes/` new card |
| 10 | **Mass-casualty / surge (MCI) opening moves** ([#93](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/93)) | Rural ED + interstate + ski country: the first 15 minutes of a 10-patient event (triage roles, call tree, space plan) is a checklist nobody remembers cold. | Nothing | new tool or `system/` adjunct |
| 11 | **Severe alcohol withdrawal / DTs** ([#94](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/94)) | Phenobarbital-vs-benzo escalation is protocol-shaped and commonly fumbled. | Status epilepticus (adjacent) | `codes/` new card |
| 12 | **Transfusion reaction** ([#95](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/95)) | MTP exists; the "stop the unit, now what" card does not. | Codes MTP c12 (adjacent) | `codes/` new card |
| 13 | **Electrical / lightning injury** ([#96](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/96)) | Mountain recreation region; triage myths (reverse triage in lightning MCI) worth one card. | Trauma burn c05 (adjacent) | `trauma/` new card |

## Noted, lower priority

- Adult hypoglycemia / adrenal crisis (usually reflexive, but a two-liner card is cheap).
- Sickle cell vaso-occlusive crisis (demographics make it rarer here; still a bounce-risk).
- Neutropenic fever (pathway-shaped, low acuity-per-minute).
- Hyponatremia with seizure (3% saline dosing — could ride on status epilepticus).
- Post-tonsillectomy bleed (peds airway-adjacent; procedures SALAD partially covers the airway side).

## Filled since this log started

**2026-08-12 — draft cards shipped for all 13 open gaps** (issues stay open
until each card passes clinical review; every card carries a DRAFT banner):

| Gap | Draft card |
|---|---|
| Eclampsia / severe preeclampsia (#84) | `ob-neonatal/` c11 |
| Adult sepsis / septic shock (#85) | `codes/` c28 |
| Massive PE (#86) | `codes/` c29 |
| Toxicology set (#87) | `codes/` c36 (opioid · wide-QRS/TCA · BB/CCB · tox arrest) |
| Accidental hypothermia (#88) | `codes/` c27 |
| Adult severe agitation (#89) | `codes/` c30 |
| Adult DKA / HHS (#90) | `codes/` c31 |
| Aortic catastrophe (#91) | `codes/` c32 |
| Heat stroke (#92) | `codes/` c33 |
| MCI first 15 minutes (#93) | `trauma/` c09 (needs the LRH call tree filled in) |
| Severe alcohol withdrawal (#94) | `codes/` c34 |
| Transfusion reaction (#95) | `codes/` c35 |
| Electrical / lightning (#96) | `trauma/` c10 |

**2026-08-17/18 — first clinical review pass** (`Crash_Card_Review__AHA_2023_Update.csv`,
Lon Setnik). Seven of the thirteen were reviewed; the DRAFT banner came down on those and
was replaced by a dated sign-off bar naming the reviewer. Where the review asked for a
change, the change shipped with it:

| Gap | Outcome | Where it lives now |
|---|---|---|
| Eclampsia (#84) | approved + refractory-seizure step and head imaging (#180) | `ob-neonatal/` c11 |
| Sepsis (#85) | approved, **moved out of Codes** (#178); banner now "broad overview — follow local protocols" | `clinical-pathways/sepsis/` |
| Massive PE (#86) | rewritten against the 2026 AHA/ACC guideline; **card 29 itself is still unreviewed** and keeps its DRAFT banner | `clinical-pathways/pe/` + `codes/` c29 |
| Toxicology (#87) | approved + the stale pediatric banner replaced (#173) | `codes/` c36 |
| Agitation (#89) | approved + restraint documentation split into its own step (#177) | `codes/` c30 |
| DKA / HHS (#90) | approved, **moved out of Codes** (#176); banner now "basic overview — follow local DKA protocol" | `clinical-pathways/dka/` |
| Alcohol withdrawal (#94) | rebuilt with **two pathways**, benzodiazepine-first and phenobarbital-first (#175) | `codes/` c34 |

Also signed off in the same pass, outside the gap list: the `neonatal/` engine as a whole
(its review banner came down and `guidelines.js` `nrp` flipped to `reconciled: true`), the
neonatal airway ladder's mask and ETT-suction columns, `ob-neonatal/` card 04's equipment
tiles, and `peds/` p16 airway equipment sizes.

**Still unreviewed, banners still up:** hypothermia (#88), aortic catastrophe (#91), heat
stroke (#92), MCI (#93), transfusion reaction (#95), electrical/lightning (#96), hazmat
(#124). The reviewer left those rows blank — an unreviewed card must keep saying so.
