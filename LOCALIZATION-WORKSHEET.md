# Localization worksheet

> **Purpose (issue #48).** Every value another emergency department would need to
> change to adopt this manual, written as a plain-English question a physician
> can answer — not a code diff. Read the whole list first; a fill-in form can
> come later.
>
> **How to read each row.** *Field* = the setting. *Question* = what to decide.
> *LRH's answer* = the value in the repo today, as a worked example (not a
> recommendation for you). *Where it lives* = the tool(s) it affects. *Required?*
> = must you set it before go-live, or is the default fine to start.
>
> **Two rules that never change**, no matter the site:
> - **No patient data, ever** — the tools stay device-local and PHI-free.
> - **You validate every clinical number** against your own assays, formulary,
>   equipment, and medical direction before the manual touches a patient. The
>   values below are LRH's, shown so you can see the shape of the answer.

A ⚑ marks a value that is currently **repeated in more than one place** in the
code rather than set once — so changing it means changing each spot (or waiting
for the consolidation work in this repo). Everything else already lives in a
single `SITE CONFIG` block in its tool.

---

## A. Site identity & branding

| Field | Question | LRH's answer | Where it lives | Required? |
|---|---|---|---|---|
| Hospital name | What is your hospital's full name? | Littleton Regional Hospital | HEART `SITE.hospital`; ⚑ also in prose across most tools | **Yes** |
| Hospital short name / abbreviation | What short code do staff use? | LRH | HEART `SITE.hospitalShort`; ⚑ repeated across tools | **Yes** |
| Public web address | What domain will your copy live at? | lrhemergencymanual.net | posters/labels QR targets, footers | **Yes** |
| Brand / accent color | Your primary UI accent (adult mode) | Dartmouth green `#00693E` (light) / `#2FA372` (dark) | `--accent` design token per tool | Recommended |
| Department label | How should the ED be named on headers? | "LRH · Emergency Department" | tool headers | Optional |

---

## B. Contacts & transfer network

These are the "who do I call, and where does this patient go" values. All are
**site-specific and safety-relevant** — a wrong transfer number in a code is a
real harm.

| Field | Question | LRH's answer | Where it lives | Required? |
|---|---|---|---|---|
| Transfer centers (destinations) | Who are your transfer/tertiary centers and their numbers? | DHMC Transfer Center (877) 999-9870 (urgent/emergent); Concord Hospital Transfer Center (800) 992-9399 | codes transfer picker (stroke, STEMI, ICH, BIG), OB | **Yes** |
| Poison control | Your regional poison control line | national US line is 1-800-222-1222 — confirm/set yours | tox-related cards | **Yes** |
| Blood bank / MTP activation | How is massive transfusion activated and who's called? | (per MTP policy) | codes MTP (card 12), trauma, OB | **Yes** |
| Stroke / STEMI destination & agreement | Where do lytic/thrombectomy and PCI patients go? | Per DHMC agreement | codes stroke (04), STEMI (21) | **Yes** |

---

## C. Cardiac arrest & ACLS  *(tool: `arrest/`, `codes/` card 01)*

All from the arrest `SITE` config unless noted.

| Field | Question | LRH's answer | Required? |
|---|---|---|---|
| Defibrillator manufacturer | What monitor/defibrillator do you run? | ZOLL | **Yes** |
| Adult shock energies | Your device's escalating joules | 120 → 150 → 200 J | **Yes** |
| Epinephrine (adult) | Dose, interval, concentration | 1 mg q3–5 min, 0.1 mg/mL | **Yes** |
| Amiodarone (adult) | First and second dose | 300 mg, then 150 mg | **Yes** |
| CPR cycle length | Seconds per cycle before rhythm check | 120 s | Default OK |
| Compression rate / metronome | Target rate | 100–120/min (metronome 110) | Default OK |
| Compressor rotation | Rotate every … | 2 min | Default OK |
| Ventilation (adult, advanced airway) | Breath interval / rate | q6 s / 10 per min | Default OK |

---

## D. Pediatric resuscitation  *(tools: `arrest/`, `peds/`)*

| Field | Question | LRH's answer | Required? |
|---|---|---|---|
| Adult/peds trigger | Weight and age cutoffs for peds dosing | ≤ 50 kg **or** ≤ 12 yr | **Yes** |
| Broselow bands & colors | Your length-based tape bands and their colors | Grey ≤5 kg, Pink ≤7, Red ≤9, Purple ≤11, Yellow ≤14, White ≤18, Blue ≤23, Orange ≤29, Green ≤36 | Default OK (verify vs your tape) |
| Peds defibrillation | J/kg first, subsequent, max | 2 → 4 J/kg, max 10 J/kg (cap 200 J) | **Yes** |
| Peds epinephrine | mg/kg, max, concentration, ETT | 0.01 mg/kg, max 1 mg, 0.1 mg/mL; ETT 0.1 mg/kg | **Yes** |
| Peds amiodarone | mg/kg, max/dose, max doses | 5 mg/kg, max 300/dose, ×3 | **Yes** |
| Peds lidocaine | mg/kg first / repeat | 1 mg/kg, then 0.5 mg/kg | **Yes** |
| Peds bradycardia CPR threshold | HR below which to start CPR (with poor perfusion) | < 60 | Default OK |

---

## E. Chest pain / ACS — HEART pathway  *(tool: `clinical-pathways/heart/`)*

The most assay-specific tool in the manual. **Every number here is tied to your
hs-troponin assay** — do not inherit LRH's.

| Field | Question | LRH's answer | Required? |
|---|---|---|---|
| Troponin units | What units does your assay report? | ng/L | **Yes** |
| Rule-in value | hs-Trop at/above which ACS rules in | ≥ 50 ng/L | **Yes** |
| Rule-in delta | 0/1-hr (or 3-hr) change that rules in | ≥ 15 ng/L | **Yes** |
| Rule-out value / delta | Value + change that rules out | < 5 ng/L and delta < 4 | **Yes** |
| Rule-out with chest pain | Below-this-with-pain rules out | < 4 ng/L (pain > 3 h) | **Yes** |
| Limit of detection | Single-troponin rule-out threshold | ≤ 3 ng/L | **Yes** |
| Gray zone (display) | Indeterminate band shown to the user | 5–49 ng/L | **Yes** |
| HEART normal limit by sex | Assay's sex-specific normal limit | M 19.8 / F 14.9 ng/L | **Yes** |
| Chest-pain duration threshold | Hours of pain used in the logic | 3 h | **Yes** |

---

## F. Other clinical thresholds & drugs  *(tool: `codes/`, `airway/`, `trauma/`, `ob-neonatal/`)*

Each of these tools has its own `SITE CONFIG` block; the high-value knobs:

| Area | Question | Where | Required? |
|---|---|---|---|
| Massive transfusion (MTP) | Your product ratio, calcium dosing, TXA regimen | codes card 12; trauma; OB | **Yes** |
| Anticoagulant reversal | Your on-formulary agents (PCC, andexanet, idarucizumab…) | codes card 10 | **Yes** |
| RSI drugs & doses | Induction/paralytic agents you stock and dose | codes card 06 / `airway/` | **Yes** |
| Hyperkalemia protocol | Your crash-protocol agents and sequence | codes card 11 | **Yes** |
| OB hemorrhage / TXA | Uterotonic sequence, TXA timing | ob-neonatal | **Yes** |
| Neonatal resuscitation | Ratios, timers (e.g. 3:1) | ob-neonatal, peds | **Yes** |

*(This group is a pointer, not the full list — each tool's `SITE CONFIG` block
enumerates its own values with source citations in comments.)*

---

## G. Physical system: cart, drawers, kits  *(tools: `labels/`, `system/`)*

The digital tools mirror your **physical** cart. These describe your room, not a
universal standard.

| Field | Question | LRH's answer | Required? |
|---|---|---|---|
| Cart drawer count & order | How many drawers, and what's in each? | 5 drawers (deep bottom); Intubation / Surgical+Supraglottic / Meds / Suction+Fluids / IV Supplies+Misc | **Yes** |
| Drawer colors & numbers | Color/number per drawer (color = *where*, never severity) | `--d1`…`--d6` tokens | **Yes** |
| Kit contents & PAR levels | What's in each procedure kit, and how many | Draft lists (all marked "not yet assembled") | **Yes** |
| Room / cabinet names | Your storage locations | "Room 7 (Resus Bay) cabinet" etc. | **Yes** |
| Poster → card QR targets | The URL each printed QR points to | absolute URLs on your domain, `?from=home` | **Yes** |

---

## H. Wording, dialect & stamps  *(all tools)*

| Field | Question | LRH's answer | Required? |
|---|---|---|---|
| English dialect | US or Commonwealth spelling/drug names? | US (epinephrine, albuterol…) — see `TERMINOLOGY.md` | Recommended |
| Version number | Your version for each adapted tool | per-tool (e.g. HEART v1.8) | **Yes** |
| Last-reviewed date | When *you* clinically reviewed it | per-tool date | **Yes** |
| Disclaimer text | Your institution's cognitive-aid disclaimer | standard "not EHR / not FDA-cleared / verify locally" | **Yes** |

---

## What this worksheet tells us about the code

Building this surfaced the consolidation work still worth doing (feeds the
forkability mission and #48's "build a form around it" follow-up):

1. **Hospital name/abbreviation (⚑)** is the biggest gap — it's typed into prose
   across most tools instead of read from one `SITE.hospitalShort`. A find/replace
   works today, but "set it once" is the goal.
2. **Contacts (transfer, poison)** appear in several cards each; worth pulling
   into one shared contacts block per tool.
3. **The HEART pathway is the model** every other tool should match: one `SITE`
   object, every clinical number read from it, each with a source comment.

Once you've read this and confirmed the groupings/questions make sense, the next
step is a fill-in form (a single YAML/JSON a non-coder edits) that writes these
values into the tools — turning "hunt through the files" into "answer the list."
