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

## Adding a new tool

1. Create a folder `<tool>/` with `index.html`, copying an existing tool as the
   skeleton so the shared header/CSS/disclaimer come along.
2. Fill in the SITE CONFIG block and the tool's logic; cite every threshold.
3. Add a card to the landing page (`index.html`) linking to `<tool>/`.
4. Verify the logic; stamp version + last-reviewed date.

## Current tools

- `heart/` — Chest Pain hs-Troponin 0/1-hr ADP + HEART pathway.
- `ob/` — OB emergencies manual.
