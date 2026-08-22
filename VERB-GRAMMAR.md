# Verb grammar

The manual is **read aloud**. A team leader says one step, the room does it, they
say the next. Everything on a card is judged against that: can it be spoken, one
action at a time, by someone who is also watching a patient?

That makes this a **verb-driven** document, not a descriptive one. The verb is
the thing that scans, the thing that gets spoken, and the thing that gets done.
Everything else is subordinate and most of it is cuttable.

**Cut to the maximum.** Assume fewer words is better. Clarity is the only limit,
and a human reviews every page afterward and adds back what the room actually
needs. Under-cutting is the expensive error, because nobody ever goes back to
delete.

---

## Row grammar

Two row types. Almost every line in the manual is one of them.

### Step row — verb first

```
GIVE 1 L LR — first hour.
ATTACH pads. CONFIRM rhythm.
RECHECK potassium at 2 h.
```

The first word is the verb, in the imperative. Dose, then route, then timing.
No preamble.

### Branch row — condition first, verb second

```
K < 3.3        → HOLD insulin. REPLACE potassium first, 20–40 mEq/h.
Glucose < 250  → ADD D5. DO NOT stop insulin.
Headache or AMS during treatment → SUSPECT cerebral edema.
```

When the row exists *because* of a condition, the condition is the selector and
must lead — a clinician scanning for their branch needs it first. The verb comes
immediately after the arrow.

**Never invert this to save words.** "HOLD insulin" without its condition is a
different and dangerous instruction.

---

## The verb set

One controlled vocabulary, so the same action always reads the same way across
every tool. A verb outside this list is a signal that the row is describing
rather than instructing.

| Verb | Means |
|---|---|
| **ASSESS** / **CHECK** | obtain a value or a state |
| **CONFIRM** | verify something already believed |
| **RECHECK** | repeat a measurement at an interval |
| **GIVE** | administer a drug or fluid |
| **START** | begin an infusion, timer, or process |
| **STOP** | end one |
| **HOLD** | deliberately withhold |
| **ADD** | add to something already running |
| **TITRATE** | adjust toward a stated target |
| **SWITCH** | change from one thing to another |
| **REPEAT** | do the same action again |
| **PLACE** | insert or position a device |
| **ATTACH** | connect monitoring, pads, leads |
| **APPLY** | external device — tourniquet, binder, pressure |
| **OPEN** | the airway |
| **SHOCK** | defibrillate |
| **PREPARE** | set up before it is needed |
| **CALL** | summon a person or service |
| **ASSIGN** | give a role to a named person |
| **SAY** | speak something out loud |
| **ASK** | request information |
| **FIND** | search for a cause |
| **SUSPECT** | raise a diagnosis |
| **ESCALATE** | move up a defined ladder |
| **TRANSFER** | move the patient |
| **LOG** | record a time or event |

`DO NOT` prefixes any of these to make a prohibition: `DO NOT stop insulin.`

### Banned openers

These signal a descriptive sentence wearing an instruction's clothes. Rewrite the
row around a real verb, or delete it.

> Consider · Remember · Note that · Be aware · It is important to ·
> Ensure that · You should · Make sure to · May want to · Think about ·
> Keep in mind · This is where

**"Consider" is the worst offender** because it feels clinical. It almost always
means either *do it* or *here is the branch*. Decide which, and write that.

---

## What survives the cut

- **The verb.** Always.
- **The number, with its unit and route.** Never touched.
- **The condition.** A conditional stays a conditional.
- **The prohibition.** "do not stop insulin" is an instruction, not commentary.
- **The one-line safety statement** where a section has one. Not a paragraph —
  one line, at the end of the section, in the caution style.

## What goes

- **Mechanism and rationale.** "the drip treats the ketoacid, the dextrose treats
  the number" teaches; it does not direct. Delete it. A reviewer adds it back if
  the room genuinely needs it.
- **Anything the reader can already see.** Section order, sort order, "this page
  covers…".
- **Hedging and softeners.** "generally", "usually", "in most cases" — unless the
  hedge *is* the clinical point, in which case it is a condition and gets branch
  grammar.
- **Second clauses joined by "and".** Usually two rows.
- **Parenthetical asides.** They cannot be read aloud. Promote to a row or cut.

### Linked row — the destination is a noun in the sentence

```
CONTROL the airway.
CALL for blood. Activate massive transfusion early.
Bleeding uncontrolled → PLACE a balloon tamponade tube.
```

The underlined words are the links. No card numbers, ever — not in the link, not
in the heading it points to. A link is the shortest noun that names its
destination, sitting inside the row where the clinician needs it.

**Never** `(see card 06)`, a bare number, or a separate "Related cards" block.
Underline already means navigation.

The anchors keep their numbers — `#c06` is frozen because printed QR codes point
at it — but a number never appears on screen.

### Log row — a major step that will be asked about

```
GIVE 4 units O-negative.              LOG IT
RECHECK haemoglobin.                  DUE 0:00
CONTROLLED the airway.                18:41 ✓
```

Same verb grammar. The difference is that tapping the row records the time, so
it needs no checkbox — and once logged, **the verb flips to past tense** and the
row reads as a record rather than an instruction still waiting.

Read aloud, the leader says the row and taps it: *"Give four units O-neg."* —
someone does it — tap. The screen now says when.

`DESIGN.md` §5 has the test for which rows get one. The short version: **will
someone ask "when?"** Most rows are checkboxes.

---

## Speakability

The test is whether a person can say the row out loud, once, and be understood.

- No nested parentheses.
- No mid-clause em-dash asides.
- Symbols are fine to *see* — `<`, `≥`, `→` — because the speaker says "under",
  "at least", "then". Do not spell them out on screen.
- Abbreviations that are said aloud stay (LR, IV, AMS). Abbreviations nobody says
  get expanded or cut.
- One idea per row. If the speaker has to take a breath mid-row, split it.

---

## What may never be cut

Repeated from `DESIGN.md` §12b because it is the boundary that matters:

- Doses, thresholds, rates, intervals, and any number with a unit.
- Citations and source references.
- Any caveat that **changes what the clinician does** — a contraindication, a
  device-specific warning, a "do not carry that number across".
- Disclaimers and medico-legal text.

The harness holds the first two mechanically in both passes. The last two are
judgment, and they are why every cut is written to `CUTS.md` for review.
