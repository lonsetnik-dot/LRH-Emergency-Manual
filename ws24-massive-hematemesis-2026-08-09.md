# WS24 — Massive hematemesis (issue #24) and the Blakemore QR (issue #28)

2026-08-09. Closes GitHub issues **#24** (no massive-hematemesis card) and **#28** (the Blakemore
poster had no QR, because there was no card for it to point at).

This is the first card built to the expanded definition of done: not "the card renders" but the
whole loop — card → stated location → cabinet label → printed poster → QR back to the card → a row
in the system map — with a test that fails if any link in it comes apart.

---

## What was built

**`codes/index.html` → card 23, Massive Hematemesis** (v3.0 → v3.1). Five sections, 34 checklist
items: resuscitate first, airway, drugs, definitive control, and balloon tamponade as the rescue
step. Menu tile placed after card 12 so the bleeding cluster reads 09 Bleeding → 10 Reversal →
11 Hyperkalemia → 12 MTP → 23 Massive Hematemesis. Version and last-reviewed stamped.

**`labels/index.html`** — new `GI Hemorrhage` door label in the Room 7 lower cabinets, carrying the
Blakemore kit contents and its own QR to card 23. New `blakemore` pictogram: straight shaft, one
elongated balloon, one round balloon. It is deliberately not a variant of the existing `ngt` glyph —
a plain curved tube and a tube-with-balloons read identically at 2 m, which is the exact
discriminability failure DESIGN-SYSTEM.md §3 warns about.

**`posters/blakemore/index.html`** (v0.2 → v0.3) — gained the standard `.qr` block and CSS copied
verbatim from the other nine posters, so there is still one QR spec system-wide. Still prints to
exactly one page (908 px of a 969.6 px content box, 62 px spare).

**`index.html`** — search-index entry. The manual-wide search lives on the landing page, not inside
`codes/`, so a new card is unfindable until it is added there even though the card itself works.
That is an easy step to miss; the new test now checks it.

**`generate_system_map.py`** — extended from procedures-only to procedures + Codes. A Codes card
earns a row only once something physical hangs off it (a poster, a defined kit, or a cabinet
label). Symptomatic bradycardia does not need a drawer; massive hematemesis does. Without that rule
the denominator fills with cards that can never score and the coverage bars stop meaning anything.

**`verify_ws24_hematemesis.mjs`** — new, 40 assertions. **`verify_kit_consistency.mjs`** — gained a
second kit entry.

---

## One thing that needs a human

The poster called this cupboard the **resus bay cabinet**; the labels sheet calls it **Room 7**.
Both now read `ROOM 7 (RESUS BAY) CABINET · GI HEMORRHAGE / BLAKEMORE KIT`, and the test asserts all
three artifacts agree on that string. **Confirm on the walk-round that these are actually the same
cupboard.** If they are not, this is a two-minute fix in three places, but it has to be the right
two minutes.

The kit itself does not exist yet. The label prints a contents list; someone has to assemble the bag
and hang it behind the door.

---

## Sources, and the two places they disagree

Resuscitation sequence, permissive hypotension, blood-not-crystalloid, SALAD, two-suction setup,
head-of-bed 45°, ketamine 0.5 mg/kg / rocuronium 1.5 mg/kg, metoclopramide 10 mg IV, octreotide
50 mcg bolus then 50 mcg/hr, ceftriaxone 1 g IV and the aortoenteric-fistula warning are from
First10EM. Transfusion thresholds (≥7 g/dL non-variceal, ~8 g/dL variceal), endoscopy timing
(12 h variceal / 24 h non-variceal) and balloon tamponade as a ≤24 h temporizing measure are from
WikEM. The balloon-tamponade numbers are carried verbatim from this manual's own Blakemore poster,
which holds the primary citations for them.

**PPIs.** First10EM: no role in the emergency management of GI bleeds. WikEM: pantoprazole 80 mg
bolus then 8 mg/hr may be considered. Both positions are printed on the card and labelled as a
disagreement rather than silently resolved — the same treatment card 12 gives the magnesium
conflict. A card that quietly picks a winner is worse than one that shows the argument, because the
reader cannot tell which they are looking at.

**TXA.** The card says do **not** give it. HALT-IT (Lancet 2020;395:1927–36) found no reduction in
death from bleeding and more venous thromboembolic events. This reverses earlier practice, so the
card says so explicitly — if TXA is still in a local GI-bleed order set, that order set is out of
date.

---

## Test results

| Suite | Result |
|---|---|
| `verify_ws24_hematemesis.mjs` (new) | **40 passed, 0 failed** |
| `verify_kit_consistency.mjs` | 2 kits × 3 artifacts, **all consistent** |
| `verify_poster_pages.mjs` | **10/10 posters print to exactly one page** |
| `verify_qr_scan.mjs` + pyzbar decode | **29/29 QRs decode to their stated destination** (was 27) |
| `verify_bugfix_20260808.mjs` | 31 passed, 0 failed |
| `verify_arrest_merge.mjs` | 41 passed, 0 failed |
| `verify_cross_tool.mjs` | pass, no page errors |
| `final_regression.mjs` | 24 menu cards crawled, 1 console error |

Static checks: extracted `<script>` blocks pass `node --check` in both edited tools; tags balance;
no duplicate `data-k` anywhere in `codes/`.

The single `final_regression` console error is a **pre-existing 404 on `/favicon.ico`** — there is no
favicon in the repo. It is unrelated to this work (a response-level crawl of every page shows no
other 4xx/5xx). `final_regression.mjs` tries to filter favicon noise by matching the string
"favicon" in the console text, but Chrome's message is just "Failed to load resource…", so the
filter never catches it. Either ship a favicon or match on the request URL.

`verify_ws10.mjs` was not run — it hangs on this machine, and it hardcodes an old Playwright path.
Pre-existing; unrelated.

---

## System map coverage after this change

11/14 figure · 9/14 poster · 9/14 QR · 10/14 located · 10/14 cart label · **2/14 kit defined**.

Kits are still the weakest column by a distance. Canthotomy and Blakemore are now the two rows
connected end to end; they are the pattern the other twelve follow.
