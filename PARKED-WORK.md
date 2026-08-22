# Parked work

Issues that cannot be folded into the redesign and must not be built by an agent
unattended. Each is scoped here so it is ready to pick up, not re-investigated.

Also records two defects found during triage that are more serious than the
issues that surfaced them.

---

## Issue disposition summary

| Issue | Finding | Disposition |
|---|---|---|
| #20 IV dosing in mL and mg, link to airway | Done — both units on the card, live mcg→mL calculator, links to card 06 | **Close** |
| #24 massive hematemesis | Done — card 23, Blakemore poster linked three ways, own 40-assertion suite | **Close** |
| #25 massive hemoptysis | Done — card 24, three-trajectories framing, links to SALAD | **Close** |
| #26 epistaxis | Done — card 25, links to SALAD, kit + QR | **Close** |
| #31 peds cart color clarity | Done — Broselow drawer chip renders swatch + band name + kg range + "PEDS CART" + link | **Close** |
| #33 procedure infographic + expiry line | Done — 17 kit cards, expiry is the stated point of the artifact | **Close** (all marked DRAFT · NOT YET ASSEMBLED — a bench job, not code) |
| #34 pigtail chest tube | Done — procedures card 16, glyph registered, kit card | **Close** |
| #28 poster QR codes | Authored on all 10; pixels carry the wrong domain | **Fold** → Phase L step 8 |
| #29 cart QR codes | Authored, 61 entries; same pixel problem, generator unwired | **Fold** → Phase L step 8 |
| #36 pacemaker / ICD | Card done; the magnet glyph never reaches the card | **Fold** → iconography pass |
| #27 SALAD | Card done; **never inserted into the intubation algorithm** | **Parked** — below |
| #30 DSED / vector change | Reference block written but **orphaned — no trigger, no test, no figure** | **Parked** — below |

On #31 specifically: retiring the drawer color tokens `--d1`–`--d6` does **not**
affect this. Those were documentation-only and never implemented. The Broselow
band colors are a separate, physical-world standard, explicitly ring-fenced in
`DESIGN.md` §1, and the chip already carries a word and a number alongside the
swatch — so it satisfies the "color is never the sole carrier" rule as built.
Nothing to redo.

---

## PARKED — #27: SALAD in the intubation algorithm

**What shipped.** `procedures/#c15`, "SALAD — Suction-Assisted Laryngoscopy," with
its glyph, its search index entry, its kit and QR, reachable from `tca/`,
`vems/`, `simulations/`, and the three bleeding cards.

**What did not.** The issue body asks to *"add to intubation procedure at right
spot in algorithm."* `codes/#c06` (Intubation / RSI) contains zero occurrences of
"SALAD." The `airway/` engine mentions it only inside a CSS comment; the line
about active vomiting neither names nor links the technique. No test asserts the
insertion.

**Why this is parked and not folded.** The remaining work is not authoring
content — it is deciding **where in a live intubation algorithm a decontamination
branch interrupts the ladder**. That is a clinical decision about a screen
someone follows with a laryngoscope in hand, and an agent should not place it.

**Scope when picked up.** A branch point in `airway/`, with a matching row in
`codes/#c06`'s pre-induction block, firing on anticipated *or* encountered
soiling, offering the three-trajectories fork:

- **Gut origin** — park the catheter in the esophagus; deliberate esophageal
  intubation is a legitimate first move.
- **Lung origin** — drive the bougie at the froth; cuff and PEEP urgently.
- **Above origin** — navigate on suction only; do *not* park deep.

**The decision to make first:** does this sit *before* induction as a
setup/two-suction check, or as a rescue rung *after* a failed view — or both? If
both, does the rescue rung outrank the DAS ladder position it would displace?
That last question is a conflict with a published ladder, so per golden rule 15
it is a stop requiring clinical sign-off, not a judgment call.

Two suction units tested before induction is the actionable prep step and belongs
as a checklist row wherever this lands.

**Constraints.** Must transclude `{{PROC:procedures#c15|…}}` per rule 12, never
retype. Two values stay unprinted because no source gives them: suction tubing
size and vacuum setting.

---

## PARKED — #30: DSED / vector change prompt

**What shipped.** The reference block at `arrest/index.html:1060` — `REFRACTORY
VF — VECTOR CHANGE / DSED` — is genuinely good: the DOSE-VF definition, the
recurrent-vs-incessant caveat, technique for both, trial numbers, and an honest
note that AHA 2025 rates both Class 2b with the fragility index named.

**What did not, on four independent lines of evidence.**

1. **Nothing triggers it.** The id `rvf` appears exactly once in the file.
   `doShock()` increments the counter, logs, and repaints — no cue, no threshold,
   no reference to the block.
2. **The test does not exist.** `verify_issues_20260809.mjs` declares #30 in its
   header and contains zero matches for `rvf|refractory|vector|dsed`. The claimed
   assertion that the cue ranks below the rhythm-check and epi-due cues is not in
   the repo — most likely lost when `codes/#c01` was merged into the engine.
3. `TEST-CHECKLIST-2026-08-09.md` still carries the unchecked box: *"tap the
   shock button 4 times → a REFRACTORY VF cue appears."*
4. **The infographic was never built.** No pad-placement figure exists in either
   icon registry.

**Why this is parked.** It is gated on your own unanswered question from the
August round: **is DSED in scope at LRH at all?** It needs two identical manual
defibrillators, a second pad set, a designated operator, and a post-use device
check. If the answer is no, the card must say *vector change only* and the prompt
must never offer DSED — which changes what gets built. Building first is wasted
work.

**Scope, assuming yes.**

- A cue in the `arrest/` engine firing at three consecutive standard shocks at
  max energy with 2-minute cycles — the DOSE-VF definition — **in a shockable
  rhythm**. Not a raw shock counter; the trigger is the pattern, not the count.
- Rendered in the engine's existing cue vocabulary, and **explicitly ranked below
  the rhythm-check-due and epi-due cues**. An option to consider must never
  displace a basic. Per rule 13 that ordering needs an assertion in *both*
  directions — one proving the cue appears, one proving it yields.
- Wording preserves the Class 2b framing already written. The cue offers; it does
  not instruct.
- A new `procedure-icons.js` figure showing both pad sets on one chest —
  anterior-lateral and anterior-posterior, distinguishable in greyscale, obeying
  the one-red-idea grammar. Likely the second pad set is the single red idea
  against the first drawn in ink. **Anatomical placement is a clinical-review
  decision, not an illustrator's.**

---

## Two defects worth more attention than the issues that surfaced them

### 1. A verify suite whose header overstates its scope

`verify_issues_20260809.mjs` claims coverage of issue #30 and asserts nothing
about it. That is precisely the failure mode golden rule 13 exists to prevent —
and it is what allowed an orphaned reference block to read as shipped for two
weeks.

**Recommendation:** audit every suite header against its actual assertions. A
suite that names an issue it does not test is worse than no suite, because it
converts an open question into a false green. This is a small, mechanical job and
it belongs in Phase 0 alongside the new suites.

### 2. The QR generator is not wired into the build

`generate_qr_codes.py` is referenced by nothing — not `build.mjs`, not
`netlify.toml`, not `run-tests.sh`, not any workflow. It writes to `/tmp` for a
human to paste back. Meanwhile every one of the 61 QR entries in `labels/` pairs
a tokenized caption with a **static pixel matrix generated against LRH's domain**.

The existing `verify_qr_scan.mjs` / `verify_qr_decode.py` pair confirms a code
*decodes* — not that it points anywhere real, and not that it points at *this*
deployment.

**Recommendation:** the deliverable that actually closes #28 and #29 is not
"codes regenerated once," it is **"the generator runs in `build.mjs`."** Until
then both issues are permanently re-openable, once per fork, and every fork ships
labels that scan into someone else's clinical values.

---

## Open clinical questions riding along

Not issues, but they surfaced during triage and belong somewhere visible.

- **The 17 procedure kits are designed, not assembled.** Every card reads
  `DRAFT · NOT YET ASSEMBLED`. Closing #33 closes the code; the bench work is
  separate.
- **Pigtail vs 28–32 Fr for traumatic hemothorax.** Card 16 prints both positions
  as lettered options. A `CLINICAL-REVIEW-QUEUE` item.
- **Andexxa stock.** Card 10 says it was withdrawn December 2025 and to confirm
  with pharmacy whether institutional stock remains. That confirmation has an
  expiry date of its own.
