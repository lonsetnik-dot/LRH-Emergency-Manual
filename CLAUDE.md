# CLAUDE.md — operating rules for AI assistants in this repo

This repository is a set of **client-side, bedside emergency-department
decision-support tools** (starting with Littleton Regional Hospital) built so it
*could* later be forked and customized by any ED. Follow these rules on every
task. The reasoning behind them is in `PROJECT.md` — read it if a rule seems
unclear. If a request conflicts with a rule below, flag it before proceeding.

## Golden rules

1. **One tool = one folder.** Each tool is a single self-contained `index.html`
   in its own folder (e.g. `heart/index.html` → `/heart/`). Inline all CSS and
   JS; no external dependencies; must work offline. The landing page is the only
   top-level `index.html`.

2. **Isolate site-specific values.** Put everything an adopting ED would change
   — clinical thresholds, assay names, hospital name, colors, phone numbers — in
   a clearly marked block at the top of the file:
   ```js
   // ===== SITE CONFIG (LRH) — edit these to adapt to another site =====
   ```
   Keep the *universal* clinical logic (score math, pathway structure) separate
   and generic, reading its numbers from that block. Never scatter local values
   through the logic.

3. **Never hold PHI; keep state on the device only.** No patient identifiers
   (name, MRN, DOB), no transmission off the device, no servers, no analytics
   that capture inputs. Device-local, ephemeral operational state IS allowed —
   a tool may use localStorage for running timers, checklist progress, and an
   on-device case timeline of times/events — provided it carries no identifiers,
   never leaves the browser, and is cleared by a RESET control. Tools calculate,
   display, and time a case; they are never a patient-data system. Hard rule.

4. **Reuse the shared skeleton.** Same `:root` CSS variables (brand colors),
   same header and disclaimer markup, same class names across all tools. Keep
   tools visually and structurally identical to each other.

5. **Show the logic and cite it.** Every tool displays its criteria/thresholds
   and includes a source for each clinical value (comment or footer). Never a
   black box.

6. **Stamp every tool.** Include a version number, a "last reviewed" date, and
   the standard disclaimer: *personal/unofficial aid, not part of the hospital
   IT system/EHR, not a substitute for clinical judgment; thresholds are
   assay-specific — verify locally.*

7. **Verify before delivering.** Test calculator logic against boundary cases
   (values just inside/outside each threshold) and report the results.

8. **Git is the source of truth.** Changes deploy via GitHub → Netlify. Do not
   use Netlify drag-and-drop deploys.

9. **Register every new tool or card in the search index.** The landing page's
   `index.html` carries a hand-maintained `SEARCH_INDEX` array — nothing gets
   found by site search unless it has an entry there, and there's no automatic
   link between a tool/card existing and it being indexed. Any new tool folder
   *or* any new card added inside an existing tool (a new `id="cXX"` article)
   needs a `SEARCH_INDEX` entry before the task is done. Before delivering:
   search 2–3 of the real terms a clinician would actually type and confirm
   the new entry surfaces. Also check the new entry's keywords against
   existing entries for confusing overlap — a keyword string that's a near-
   duplicate of another entry's, or that would make an ambiguous query
   surface the wrong card first. Don't silently resolve an overlap you're not
   sure about; flag it to the user instead of guessing which entry should win.

10. **Write in US English.** LRH is a US hospital, so all prose you write or
    edit — checklist text, headers, UI copy, code comments — uses US medical
    spelling and drug-naming conventions, not British/Commonwealth ones
    (adrenaline → epinephrine, colour → color, paralysed → paralyzed,
    salbutamol → albuterol, trauma centre → trauma center, etc.). See
    `TERMINOLOGY.md` for the full alias list and for what's exempt.
    **Exception:** never rewrite text inside a direct quote or a real proper
    name — a paper title, an institution's own name, a named program like
    "Tactical Combat Casualty Care" — even if it's spelled the Commonwealth
    way. Quote it exactly as the source has it.

## Adding a new tool

1. Create a folder `<tool>/` with `index.html`, copying an existing tool as the
   skeleton so the shared header/CSS/disclaimer come along.
2. Fill in the SITE CONFIG block and the tool's logic; cite every threshold.
3. Add a card to the landing page (`index.html`) linking to `<tool>/`.
4. Add a `SEARCH_INDEX` entry for the tool (and for each of its cards) in the
   landing page's `index.html` — see golden rule 9.
5. Write all prose in US English — see golden rule 10.
6. Verify the logic; stamp version + last-reviewed date.

## Adding a new card (inside an existing tool)

Same obligations as a new tool, minus the new folder — easy to forget the
search-index step since it lives in a different file than the one you're
editing:

1. Copy an existing card's structure inside the tool's `index.html`; add a
   menu tile if the tool has one.
2. Add a `SEARCH_INDEX` entry in the landing page's `index.html` pointing to
   the card's `#cXX` anchor — see golden rule 9.
3. Write all prose in US English — see golden rule 10.
4. Cite every clinical value; verify the logic; stamp version + last-reviewed
   date on the tool file the card lives in.

## Current tools

- `codes/` — Codes (cardiac arrest, stroke, RSI, STEMI, status epilepticus,
  and other resuscitation cards).
- `ob-neonatal/` — OB & Neonatal emergencies (delivery, PPH, shoulder
  dystocia, neonatal resuscitation, hysterotomy, and more).
- `peds/` — Pediatric Emergencies.
- `procedures/` — Rare, high-stakes procedure checklists (chest tube,
  thoracotomy, burr hole, canthotomy, CVC, TVP, tourniquet, JADA, etc.).
- `trauma/` — Trauma activation and resuscitation pathways.
- `clinical-pathways/` — Diagnostic pathways (e.g. Chest Pain / HEART).
- `posters/` — Printable one-page posters generated from procedure content.
- `debrief/` — Post-code/critical-event debrief tool.
