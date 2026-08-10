# Issue round — 2026-08-09

Draft solutions for the nine remaining open GitHub issues, built after #24 and #28 closed earlier
the same day. Every one is built to the same definition of done: the card is reachable from the
menu **and** from search, it states where its kit lives, a label carries a working QR back to it,
and it appears in the system map. A test enforces each of those, because each lives in a different
self-contained file with no shared dependency (CLAUDE.md rule 1) and nothing else keeps them
attached.

**Nothing here is signed off.** These are drafts for clinical review — see the questions at the end.

---

## What was built

**#25 massive hemoptysis** → Codes card 24. Framed as an asphyxiation problem rather than a blood
loss problem: bleeding lung down, biggest tube you own (≥8.0, because a bronchoscope and a bronchial
blocker both have to fit down it later), then lung isolation by intubating the *good* mainstem —
95% blind success on the right, 73% on the left. Nebulized versus IV TXA with the Gopinath and Wand
numbers. The card explicitly contrasts itself with card 23, where TXA is now contraindicated, so the
two rules do not bleed into each other.

**#26 epistaxis** → Codes card 25. Opens with the escalation check, because a patient bleeding into
the oropharynx is an airway, not a nosebleed. Then the step that actually works and is almost always
done wrong: pressure on the soft cartilage, not the bony bridge, held without peeking. Full ladder
through cautery, anterior packing, posterior packing and failure, with the Rapid Rhino specifics
(sterile water for 30 seconds, air only) and the Foley volume ceiling.

**#36 pacemaker / ICD** → Codes card 26. Built around the asymmetry that gets people hurt: a magnet
over an ICD stops shocks and changes nothing about pacing; a magnet over a pacemaker forces
asynchronous pacing and changes nothing about shocks. Electrical storm, the four pacemaker
malfunctions with their ECG appearances, and defibrillation with a device in situ.

**#27 SALAD** → procedures card 15, and the best card of the round because of the link you sent.
Cliff Reid's **three trajectories** framework is what makes it more than a generic SALAD
description: where the contamination is coming *from* changes the technique. Coming up from the gut
→ park the catheter in the oesophagus, and deliberately intubate the oesophagus first if you have
to. Coming up from the lung → drive the bougie at the froth, cuff and PEEP urgently. Coming down
from above → navigate with suction only and do *not* park deep, because the source is above you.
That is now a figure, a key-numbers block, and three cross-links to cards 23, 24 and 25 — which is
what turns four separate cards into one system.

**#34 pigtail chest tube** → procedures card 16. Triangle of safety, above-the-rib rule, full
Seldinger sequence with the wire-free-movement check that prevents the named serious complication.

**#30 DSED / vector change** → a refractory-VF prompt in the card 01 arrest engine plus the
reference block it points at. The cue is deliberately ranked *below* the rhythm-check and epi-due
cues, and the test asserts that ordering — an option to consider must never displace a basic.

**#20 epinephrine in mg and mL** → every dose now states both with the concentration named, and the
anaphylaxis card warns off the 10×-more-dilute cardiac syringe. Escalation step 3 links to the
airway card.

**#31 pediatric cart colour** → a Broselow chip on the arrest cards. In pediatric mode it names the
colour, the band and the kg range, and links to the peds cart labels. The kilograms are what the
doses come from; the colour is what someone runs to the cart with.

**#29 QR on every cart label** → every full drawer face and every cabinet door now carries one, and
the test fails if any lacks it. Four cabinets with no card of their own (arterial line, suture,
specimens, splints) resolve to the system map's Room 7 index rather than getting an invented target.
Slim inserts still have none, and the reason stays printed on the sheet.

**#33 per-procedure infographic with an expiry line** → a new 4×6 in card in `labels/`, one per
kit, with contents as tick boxes, four dated fields and a QR. Deliberately a *third* artifact rather
than a bigger drawer label: "is this kit complete and in date" is asked once a month by one person
at the cabinet with a pen, which is a different question from "which drawer do I pull" at three
metres.

---

## Options, not controversies

Where two good sources support different courses, the cards now present them as **lettered
options with the source on each** rather than as a disagreement the reader has to referee. A
clinician at the bedside does not need to know that the literature is unsettled in the abstract;
they need to know that there are two defensible things to do and who backs each.

PPIs in upper GI bleeding — A: none in the ED (First10EM), B: pantoprazole 80 mg then 8 mg/hr
(WikEM). Antibiotics after nasal packing — A: antistaphylococcal cover (StatPearls, Iowa), B: none
(Core EM, REBEL EM), with EM Cases offering a middle course at 72 hours. First-line drug for
electrical storm — A: beta-blockade (WikEM), B: procainamide (First10EM), both agreeing
beta-blockade goes in early. Traumatic haemothorax — A: 28–32 Fr open tube (MRCEM), B: 14 Fr
pigtail (P-CAT). Guidewire depth — 15–20 cm, or just enough to clear the needle.

Where it is a number rather than a course, the published values are simply listed as options and
not narrowed to one: epistaxis pressure duration (≥10, 15–20, ≥20 minutes), TXA intervals, and the
four thresholds in print for "massive" hemoptysis. Topical TXA for epistaxis is labelled an option
rather than a step, because Zahed is strongly positive and NoPAC is flatly negative.

Two places where no source gives a number, so none is printed: the ETT insertion depth in cm for
blind mainstem intubation, and the suction tubing size and vacuum setting for SALAD.

One place where the guideline says less than the trial: DSED and vector change are **Class 2b,
"usefulness has not been established"**, and the AHA highlights document says not recommended. The
card offers the option and says so plainly rather than implying DOSE-VF settled it.

---

## The code cart now matches the actual cart

From your photograph: five drawers, the bottom one deep, and its own printed categories —
**Intubation / I.V. Supplies / Medications / Suction + I.V. Fluids / Surgical + Supraglottic +
Miscellaneous**.

Both models were wrong, in different directions. The app modelled six drawers, so its drawer 6 has
been merged into the deep drawer 5 with its contents intact, and the two cards that badged drawer 6
now badge 5 in drawer-5 colour. The label sheet was worse: it was still carrying the
airway-escalation ladder from the layout PDF, which is a better design but is not what is standing
in the department. It has been rebuilt drawer by drawer to the photograph, with a cart-front
category face for each drawer and the item faces filed under the drawer they actually live in.
Drawer 5 carries two category faces, tied by one spine colour — which is the "one label = one
thing, not one drawer" rule doing exactly what it was written for.

This was the blocker on printing anything, so it is worth stating plainly: it is now consistent
across the app, the label sheet, the QR destinations and the system map, and a test fails if any of
them drifts.

**The drawers were swapped — done 2026-08-09.** **Surgical / Supraglottic moved up to drawer 2**, and
**I.V. Supplies moved down into the deep drawer** alongside Miscellaneous. The cricothyroidotomy kit
was in the slowest drawer in the room to reach — you crouch for it, under everything — and it is the
most time-critical item on the cart. I.V. supplies are reached for early and calmly instead.

Colour and shape follow the **position**, not the contents, so drawer 2 is still blue with a diamond
and drawer 5 is still gold with a pill; only the words and pictograms moved. Every card badge, every
`USED BY` list and every QR destination moved with them, and the tests assert that the shapes did
*not* travel with the contents.

Two physical jobs follow, and neither can be done from here: move the contents, and **reprint the
cart's own printed label strip** — the app now says something different from the sticker on the
front. The cart section carries that warning until someone clears it.

One cost worth naming: the EZ-IO is now in the deep drawer, because it belongs to I.V. Supplies. If
that bothers you it can be promoted to drawer 4 with the fluids, at the price of splitting a
category across two drawers. Say which you prefer.

---

## Draft kits — ten of them

Ten procedures had a full equipment list on the card and no bag anywhere in the building. Each now
has a **draft kit**, generated from that card's own equipment section rather than invented
alongside it: chest tube, thoracotomy tray, burr hole, central line, transvenous pacing,
escharotomy, neck tamponade, junctional hemorrhage, JADA, and the resuscitation line. With the
canthotomy, Blakemore, SALAD, pigtail and pacemaker-magnet kits already defined, kit coverage on the
system map goes from **4/19 to 14/19**.

Each kit produces three artifacts from one table, so they cannot drift apart. An **IN THE KIT**
block on the card, with quantities and an explicit *ALSO NEEDED — NOT IN THE KIT* list. A **4 × 6 in
cabinet card** with the contents as tick boxes and four dated fields. And a new **build sheet** —
the artifact that was missing, because "how do I build this bag" is a job done once at a bench with
a box of stock beside you, which is not the same job as "is this bag complete and in date" done
monthly at the cabinet.

The split between what goes in the bag and what does not is where the thinking is. The chest tube
kit holds the scalpel, clamps, suture and prep, but the tubes and the primed underwater seal stay
loose on the shelf, because you pick the size at the bedside. The thoracotomy tray is sealed and the
PPE is deliberately outside it, since you gown before you open it. The pacing kit does not contain
the generator — that sits beside the bag so its battery gets found on the monthly check rather than
at 3am. Every sheet names what is missing on purpose.

Two procedures got no kit and that is the right answer: the **pelvic binder** and the **tourniquet**
are single devices, not bags. A kit card for a tourniquet would be a box with a tourniquet in it.

Every list is a draft. Quantities are starting proposals, not PAR levels, and every card carries a
visible **DRAFT — not yet assembled or signed off** line so nobody mistakes a proposal for stock.

**One real bug fell out of this.** Two of the new kit-card QRs rendered perfectly and decoded to
nothing. The codes are generated with a zero-module border, so the SVG has to supply the four-module
quiet zone the spec requires — without it a dense code printed small sits flush against the label
border and decoders fail. Every QR in `labels/` now carries a quiet zone, and the kit cards print
theirs slightly larger. This was only caught because `verify_qr_scan.mjs` decodes screenshots of the
*rendered page* rather than trusting the generator, which passed its own round-trip on all 61 codes.

---

## Test results

| Suite | Result |
|---|---|
| `verify_issues_20260809.mjs` (new, this round) | **120 passed, 0 failed** |
| `verify_ws24_hematemesis.mjs` | 40 passed, 0 failed |
| `verify_kit_consistency.mjs` | **6 kits × their artifacts, all consistent** |
| `verify_poster_pages.mjs` | 10/10 posters print to exactly one page |
| `verify_qr_scan.mjs` + pyzbar decode | **62/62 QRs decode to their stated destination** (was 29) |
| `verify_bugfix_20260808.mjs` | 31 passed, 0 failed |
| `verify_arrest_merge.mjs` | 41 passed, 0 failed |
| `verify_cross_tool.mjs` | pass, no page errors |
| `final_regression.mjs` | full menu crawl, 1 console error |

Static checks: extracted `<script>` blocks pass `node --check` in every edited tool; tags balance;
no duplicate `data-k`.

The single `final_regression` console error is still the pre-existing **404 on `/favicon.ico`** —
there is no favicon in the repo. Unrelated to this work; a response-level crawl of every page finds
no other 4xx or 5xx.

System map coverage: 13/19 figure, 9/19 poster, 9/19 QR poster→card, **18/19 located, 18/19 label,
14/19 kit contents defined**.

---

## Questions for you

1. **Room 7 versus resus bay.** Everything now reads `ROOM 7 (RESUS BAY) CABINET`. Confirm they are
   the same cupboard, or tell me which is which.

2. **Traumatic haemothorax: pigtail or 28–32 Fr?** The card shows both positions and says do not
   decide alone at 3am. Your surgeons' answer is the one that should be printed.

3. **DSED — is it in scope at LRH at all?** It needs two identical manual defibrillators, a second
   pad set, one designated operator and a post-use device check. If that is not realistic, the card
   should say vector change only.

4. **Antibiotics after nasal packing.** House position, or leave the disagreement printed?

5. **Sixteen kits now have labels, build sheets and expiry cards — and none of them exist.**
   That is the single biggest remaining gap, and it is a bench job with a box of stock, not a
   code change. The build sheets are designed to be carried to that bench.

6. **PAR counts are still all placeholders**, and the cabinet contents are still best-guess pending
   a walk-round.

7. **The EZ-IO is now in the deep drawer** as part of I.V. Supplies. Promote it to drawer 4 with
   the fluids, or leave the category intact?

8. **Reprint the cart's label strip.** The app and the labels sheet now describe the swapped cart;
   the sticker on the front of the cart still describes the old one.
