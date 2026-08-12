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
| 3 | **Massive / high-risk pulmonary embolism** ([#86](https://github.com/lonsetnik-dot/LRH-Emergency-Manual/issues/86)) | The lytic decision under pressure, mirror of STEMI's TNK logic; PE arrest is also a named H&T with nowhere to click through to. | Arrest H's & T's mention; STEMI card (drug logistics analogue) | `codes/` new card |
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

*(none yet — move rows here as cards ship)*
