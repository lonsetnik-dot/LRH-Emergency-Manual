# DESIGN-SYSTEM.md — the physical/digital system

Companion to PROJECT.md (why) and LAYOUT.md (page structure). This file governs how the
**physical** side — carts, cabinets, drawer faces, wall posters — and the **digital** side —
checklists on a phone — form one system rather than two that happen to share content.

Written 2026-08-08 after a full audit. The findings that drove it are in the last section.

---

## 1. The governing rule

> **Each artifact answers exactly one question, at exactly one reading distance, for exactly one
> reader.**

Most of what is currently wrong comes from one artifact trying to do two jobs. A drawer label
carrying an expiry field is unreadable across a resus bay; a wall poster carrying a full citation
list is unreadable with your hands in a patient.

| Artifact | Distance | Reader | The one question | Carries |
|---|---|---|---|---|
| **Drawer face** | 2–3 m | anyone, mid-resuscitation | *Which drawer do I pull?* | colour, number, one word, one pictogram, optional qualifier chip |
| **Stock strip** | 30 cm | whoever checks/restocks | *Is this stocked and in date?* | check + initials, earliest expiry, restock route, QR |
| **Wall poster** | 0.5–1 m, hands busy | operator doing the procedure | *How do I do this, now?* | steps, one figure, key numbers, location, QR |
| **Phone card** | in hand | operator or team lead | *Full checklist — and where is the kit?* | interactive checklist, timers, location back-link, sources |

If a piece of information does not serve the one question, it belongs on a different artifact.

---

## 2. Colour

**Colour encodes WHERE. Nothing else. Ever.**

Which cart, which drawer, which shelf. Not severity, not tool identity, not risk tier, not
acuity. Those get shape, position, size and words.

| Token | Value | Meaning |
|---|---|---|
| `--d1` | `#0f7a86` | drawer 1 |
| `--d2` | `#2f62a8` | drawer 2 |
| `--d3` | `#6f4fa8` | drawer 3 |
| `--d4` | `#9b1c2e` | drawer 4 |
| `--d5` | `#8a6011` | drawer 5 |
| `--d6` | `#2f7a3f` | drawer 6 |

Drawer 4 is red on every cart because red means *fourth drawer*. On the code cart that is suction
and fluids; on the OB cart it is postpartum haemorrhage. The word and the pictogram carry meaning;
colour only gets a hand to the right height on the cart.

Semantic colour, used **only** inside clinical content, never on a label:

| Token | Value | Meaning |
|---|---|---|
| `--danger` | `#9b1c2e` | critical / life-threat step |
| `--caution` | `#8a6d1f` | caution, pitfall, "wait / reflex" |
| `--safe` | `#2f7a3f` | ruled out / stable |
| `--info` | `#2f62a8` | neutral information, links |

Yes, these reuse drawer hues. That is acceptable *only* because they never appear in the same
context: a drawer badge is always a coloured square with a shape and a number inside it, and a
severity colour is always a text/box treatment. If that separation ever blurs, split the palettes.

**Three hard constraints.**

1. **Colour is never the sole carrier.** Every drawer has a number, a word and a shape. Every
   result box has a text tag. The system must survive greyscale, a photocopy, and a red-green
   colourblind reader. Test by printing in black and white and checking nothing is lost.
2. **Contrast floors:** 4.5:1 body text, 3:1 large text and non-text indicators.
3. **Print backgrounds must be forced.** Every tool needs
   `* { -webkit-print-color-adjust:exact; print-color-adjust:exact; }` in its `@media print`
   block. Without it, Chrome and Safari drop backgrounds, white knockout text lands on white
   paper, and the entire colour code silently disappears from every printout.

---

## 3. Pictograms

One object, black silhouette, on a white disc. No colour, no outline style, no detail that
disappears at 2 m.

The test is **discriminability, not accuracy**: any two pictograms on the same cart must be
distinguishable at a glance, at distance, by someone who is not looking carefully. A beautifully
accurate endotracheal tube and a beautifully accurate suction catheter that are both "a curved
tube" have failed, however good each is alone. Give them different silhouettes — smooth curve with
a cuff versus rigid angled tip with a thumb port — even at some cost to realism.

---

## 4. Numbers, letters and words

- The **drawer number** is the shared index across the physical drawer, the app's cart section,
  the drawer badge on a card, and any poster that references it. Never renumber without changing
  all four.
- **One word** on a face, two at most. "Intubation", not "Airway equipment and intubation adjuncts".
- A **qualifier chip** (weight band, patient group) only where it genuinely disambiguates two
  otherwise identical drawers.

---

## 5. The physical↔digital loop

Both arrows must exist, or the system is a one-way street.

**Physical → digital.** Every printed artifact carries a QR to its checklist. Encode absolute
URLs with `?from=home` so the beta splash is suppressed on arrival.

**Digital → physical.** Every card states where the kit lives, and links to that cart section.
This is the arrow that is currently missing almost everywhere, and it is the more important of the
two: the QR takes someone from the poster to the phone, and at that moment they lose the location
information the poster was carrying.

Rules:

- Every procedure/equipment card names its storage location and links to the drawer/shelf anchor.
- Every card with a poster links to it ("print this poster").
- Every drawer lists the cards that need it (`USED BY`), and every card badges the drawers it
  needs. Both directions, kept in sync — this is hand-maintained and has already drifted, so it
  needs a check in the verify suite.
- Every cart a poster names must actually be modelled in the app. Six posters currently direct
  people to a "TRAUMA CART" that exists nowhere in the site.

---

## 6. Simplification test

Before adding anything to an artifact, ask:

1. Does this serve the one question this artifact answers? If not, it belongs elsewhere.
2. Is it readable at this artifact's distance?
3. If colour were removed, would it still work?
4. Is there an existing element already carrying this, in a different form?

"As simple as possible, but no simpler" cuts both ways: the drawer face loses the expiry field,
but it keeps the number *and* the word *and* the pictogram, because each covers a different
failure mode — the number for cross-reference, the word for certainty, the pictogram for speed.

---

## 6b. A checklist row is ONE LINE: the action

A checklist row is glanced at, mid-task, by someone whose hands are busy. It carries the
action and nothing else.

It used to carry two tiers, with the reasoning in an `<i class="t-why">` revealed by a WHY
control in the banner. **Issue #216 removed both.** 764 rows of rationale were deleted; the
rows whose second tier held a real clinical VALUE had that value folded into the action.

```html
<span><b>Pantoprazole 80 mg IV bolus, then 8 mg/hr. Never let it delay blood or source control.</b></span>
```

Three rules follow, and the first is the one everything else serves:

- **Everything the step needs is on the line**, because there is nowhere else. A row that
  reads too long with its number in it is doing two jobs and wants splitting, not hiding.
- **Delete statistics unless they are necessary for the action.** How often a maneuver works,
  a trial's mortality split, a prevalence — none of it changes what the hands do. A percentage
  stays only when it is the threshold you act on: `MESS ≥7`, `NIHSS ≥6`, `discordant STE ≥25%`.
- **A source disagreement worth keeping is a NOTE, not a row.** A checkbox-free `<li>` at the
  end of the section, in `--ink2`. It is not an instruction and must not look like one.

`verify_checklist_clarity.mjs` asserts the inverse of what it used to: no WHY control exists,
and no reasoning tier is hidden anywhere. A tier that came back would fail the run.

## 7. Logging an event vs linking to a procedure (issue #71)

Two things a card asks a clinician to tap look superficially alike and are
opposites. One **records that something happened to this patient**; the other
**takes you somewhere else to read**. Confusing them mid-code either loses an
event from the record or throws the reader out of the card they were working.

So they never share a shape:

| Intent | Shape | Markup | What it does |
|---|---|---|---|
| **Log an event** | A round pill reading `LOG IT` (or the action's own name), sitting in the card's action row | `data-logevent` / `data-log` → `CASESTATE.addLog` | Writes a PHI-free, time-stamped row to the shared case log. Stays on the page. |
| **Go to a procedure** | Underlined text inside the sentence that mentions it | a plain `<a href="../procedures/…">` | Navigates. Never writes anything. |

**Prose navigation is underlined — everywhere** (revised 2026-08-18, clinician
direction). The earlier rule underlined only links into `procedures/`, leaving
every cross-tool, in-card and `#cXX` link carried by color alone. That is the
wrong axis: the question a reader answers mid-code is *does this take me
somewhere or does it record something*, not *which tool does the destination
live in*. Color alone also fails WCAG 1.4.1 and is close to invisible on the
dark ground. So every inline prose link is underlined, and every control —
tile, chip, button, LOG IT pill — explicitly is not. Those two halves together
are what make the underline carry information; `verify_design_language.mjs`
asserts both directions across all 16 pages, identifying controls by *shape*
(border, fill, or block layout) rather than by an allow-list, so a new chip
cannot silently acquire an underline and a new prose link cannot silently lose
one.

Rules that follow:

- **A logging control is never a bare link, and a link is never round.** The
  pill shape means "this is now in the record".
- **Logging is idempotent-ish and honest:** the log records the time it was
  tapped, not the time the thing happened, and the PHI guard refuses any label
  carrying a weight, a record number or a date (`CASE-STATE.md`).
- **A link into `procedures/` is always underlined** — the shared sheets carry
  `a[href*="procedures/"]{text-decoration:underline}` precisely so the idiom
  survives the mono and condensed faces.
- **One deliberate exception: `a.babyout` in `ob-neonatal/` card 08.** It both
  records and navigates — one tap stamps the birth time into the case log and
  then opens the neonatal engine. That is correct here and should not be
  "fixed": at the moment a baby is delivered in a breech the operator has one
  free hand and one decision, and splitting it into "log it, now also go there"
  buys tidiness at the cost of the thing being timed. It is shaped as a filled
  control, not prose, so it never reads as a sentence link. The suite pins both
  behaviors so the exception cannot quietly become the rule.

`verify_design_language.mjs` enforces this across the engines — it is the
reason the idiom stays a convention rather than a preference.

---

## 8. Audit findings behind this document (2026-08-08)

State at the time of writing, so future work knows what was true.

**Colour.** 134 distinct hex values, ~7,000 inline literals, and seven overlapping colour systems.
`#9b1c2e` alone carried seven meanings (danger, OB tool identity, drawer 4, Broselow red, life-
threat header, four poster accents, poster warning boxes). `#2f62a8` carried six. Six of eight
tools had no `:root` block at all, and no SITE CONFIG block contained a single colour — so
CLAUDE.md's claim that an adopting site can re-skin by editing one block per file was not true.
`ob-neonatal` used two teals 1.6 ΔE apart for different meanings.

**Print.** `print-color-adjust` was set on the posters only. Everywhere else, ~200 accordion
headers using white-on-dark printed as white-on-white, drawer badges printed blank, and the
tool-identity stripe vanished. The peds weight bar — the number every dose derives from — printed
invisible.

**The loop.** 9 of 10 posters had a working QR (all decoded and verified). Zero cards linked back
to a poster. Zero of 13 procedure cards stated a storage location, though the posters pointing at
them all did. No trauma cart existed in the app despite six posters naming its shelves. Six
`USED BY` mappings had drifted out of sync between drawer and card.

**Accessibility.** Completed-checklist text at 3.65:1 across five tools; several 3.4–4.4:1 pairs
in headers and result boxes.

---

## 9. Order of work

1. Print correctness — one CSS line per tool. Cheapest fix, largest recovery of meaning on paper.
2. Storage location on every procedure card, linked to its cart section.
3. Model the trauma cart; the posters already name its shelves.
4. Drawer faces + stock strips (`labels/`) for all three carts.
5. Contrast fixes.
6. Collapse colour onto the tokens above; add the `:root` block to every tool.
7. Card→poster links; `USED BY` symmetry check in the verify suite.
