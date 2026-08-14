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

   "Must work offline" is now enforced, not just asserted — see **Offline
   shell** below. Do not hand-write a per-tool service worker; a new tool gets
   offline support automatically by existing.

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

11. **Register every upstream source in `guidelines.js`.** Rule 5 says cite the
    value; this rule says the *body you cited* must also exist as a row in the
    registry, with the edition the content is written against and the tool or
    card listed under `dependents`. A citation in prose answers "where did this
    number come from"; only a registry row answers "AHA republished — what in
    this manual moves?" and "when did anyone last check this is still true?".
    If a new clinical value comes from a body already in the registry, add the
    tool/card to that row's `dependents`. If the body is new, add a row —
    `lastVerified: null` until a human has actually checked it, never a
    backfilled date. `verify_guidelines.mjs` fails when a clinical tool has no
    source row and no written exemption. See **Keeping content current** below.

## Adding a new tool

1. Create a folder `<tool>/` with `index.html`, copying an existing tool as the
   skeleton so the shared header/CSS/disclaimer come along.
2. Fill in the SITE CONFIG block and the tool's logic; cite every threshold.
3. Add a card to the landing page (`index.html`) linking to `<tool>/`.
4. Add a `SEARCH_INDEX` entry for the tool (and for each of its cards) in the
   landing page's `index.html` — see golden rule 9.
5. Write all prose in US English — see golden rule 10.
6. Register the tool's upstream guideline sources in `guidelines.js` — see
   golden rule 11.
7. Verify the logic; stamp version + last-reviewed date.

## Adding a new card (inside an existing tool)

Same obligations as a new tool, minus the new folder — easy to forget the
search-index step since it lives in a different file than the one you're
editing:

1. Copy an existing card's structure inside the tool's `index.html`; add a
   menu tile if the tool has one.
2. Add a `SEARCH_INDEX` entry in the landing page's `index.html` pointing to
   the card's `#cXX` anchor — see golden rule 9.
3. Write all prose in US English — see golden rule 10.
4. Add the card to its source's `dependents` in `guidelines.js`, or add a row
   if it cites a body not in the registry yet — see golden rule 11.
5. Cite every clinical value; verify the logic; stamp version + last-reviewed
   date on the tool file the card lives in.

## Offline shell (issue #120)

The manual works in a wifi dead zone because `build.mjs` generates a root
service worker that precaches **every page** — ~2.9 MB across the whole site, so
a clinician who has opened any one page has all of it, including cross-tool
links. Three things follow for anyone editing this repo:

- **Never edit `dist/sw.js`.** It is generated. The sources are `sw-template.js`
  (the worker) and `sw-register.js` (the registration + update prompt, inlined
  into every page at build so no tool hand-maintains a copy).
- **Never hand-bump a cache version.** The cache name is a content hash of
  everything precached, so any content change invalidates it automatically. The
  retired per-tool worker used a hand-written date string, and forgetting to
  bump it would have served stale clinical content silently and indefinitely.
- **Serving is cache-first**, because the failure being defended against is a
  dead zone where the network hangs rather than fails. The cost is that a fresh
  deploy is not shown until reload, so staleness is made *visible*: a dismissible
  "MANUAL UPDATED — reload when it is safe to" bar. Nothing ever reloads the page
  by itself; a forced reload mid-code would take the checklist away from whoever
  is reading it.

`verify_offline.mjs` proves all of this by stopping its own server mid-run.
Note that `context.setOffline()` alone does **not** cut off service-worker
fetches — an earlier version of that suite passed every "offline" check with the
server still answering. If you touch the worker, run it against `dist/`:

```
node build.mjs && node verify_offline.mjs
```

## Shared equipment icons (issue #131)

`equipment-icons.js` is the single source for the equipment glyphs. It is
injected at build wherever a tool's `<script>` carries the `/* @icons */`
marker, exactly like `design-system.css` and `inventory.js`. Consumers today:
`labels/` (cart and cabinet labels) and `vems/` (the simulation card deck).

**Do not paste an icon inline into a tool.** The reason is clinical, not
tidiness: a clinician learns a glyph from the cart drawer they open every shift,
and the VEMS deck hands them a card for the same item. If the card and the
drawer show different pictures, the drill teaches the wrong association — the
exact opposite of what it is for. `verify_vems.mjs` asserts this by loading
`/labels/` and `/vems/` and comparing the *rendered* SVG markup for every glyph
name they share, rather than trusting that both include the shared file.

Drawing rules live in the header of `equipment-icons.js`: a 0 0 100 100 viewBox,
solid `#111` silhouettes with white only for cut-outs, and no two clinically
different items sharing a silhouette.

A VEMS deck is also a paper product, so `verify_vems.mjs` renders the real print
output to PDF and counts pages. A deck that spills onto an extra sheet, or a run
sheet that prints along with the participant cards, is invisible on screen and
expensive at the laminator.
## Config-driven verification (issue #117)

The `verify_*.mjs` suites are the safety harness that makes it viable for a
readiness champion plus an AI to maintain clinical logic. That only holds if a
red run means something. So a suite must **read the tool's own config block and
assert the UI against that** — never re-type this site's numbers a second time.
An adopting ED that localizes its defibrillator to 150/200/200 J, its FONA tray
to a 5.5 mm tube, or its fluid bolus to 10 mL/kg is doing exactly the right
thing; a suite that turns red for it teaches that site a red run is normal, at
the moment the harness is the only thing protecting them.

Each live-protocol tool exposes its config for this (and so a champion can read
the in-effect values from the browser console instead of from source):

```js
try{ window.SITE = SITE; }catch(e){}   /* arrest/, tca/  — DAS for airway/ */
```

Two rules when writing or editing a suite:

1. **Local values come from config.** Doses, energies, attempt ceilings,
   thresholds, tube sizes, countdown minutes, the version stamp. Derive test
   inputs from config too — pick a pediatric weight as `trigger.maxKg - 1`, not
   as `49`, so the case stays on the intended side of a localized threshold.
2. **Clinical invariants stay written out.** Things a fork must *not* be able to
   localize away: that energies escalate and then plateau, that a per-kg dose is
   capped at the adult ceiling, that adult TXA is fixed while pediatric TXA is
   per-kg, that the ladder runs A → B → C → D, that DAS publishes no SpO₂
   cut-off, the scope disclaimers, the citations, and the PHI guards.

Prove both directions before delivering: the suite passes with LRH's config,
still passes with several values changed to a plausible fork's, and **fails**
when the page's logic is mutated with the config left alone. Converting the
airway suite this way is what surfaced that `/airway/` read its config for the
ladder's behavior but printed hand-typed numbers on screen — a localized site
would have got a screen that contradicted itself.

## Keeping content current — the guideline watch (`GUIDELINE-WATCH.md`)

`guidelines.js` is the single source for every upstream body the manual takes
numbers from, in the same spirit as `inventory.js` for physical items: injected
at build wherever a tool carries the `/* @guidelines */` marker (consumer today:
`sources/`), and read outside the browser by `check_guidelines.mjs`. A monthly
GitHub Actions job runs the watcher and opens a `guideline-watch` issue when
something needs a human.

Four rules when touching it:

- **The `edition` field is a claim about the CONTENT, not about the world.** It
  names the edition the manual is *written against*. Bump it only in the same
  commit that reconciles the content — never on merely noticing a newer edition
  exists. A row whose `edition` names an edition nobody reconciled to is the one
  failure this whole system is built to prevent.
- **`lastVerified: null` is a real answer, not a missing value.** It means
  nobody has checked through this process, and it is the honest state for a new
  row. Never backfill a date for a check that did not happen — the same
  distinction `inventory.js` draws between NOT REVIEWED and GAP. A fabricated
  date buys 180 days of silence and looks like diligence on screen.
- **A dependent that no longer exists breaks the scoping, silently.** The
  `dependents` list is the sentence a guideline change gets scoped from, so
  renaming or splitting a tool means updating every row that names it.
  `verify_guidelines.mjs` asserts every path and every `#cXX` anchor resolves.
- **Detection is partial and the wording must stay honest.** The probes miss a
  body that swaps a revised PDF in at the same URL. That is why every row also
  carries `reviewEvery`, and why the report, the page and the docs all say "no
  change detected" rather than "nothing changed". Do not tighten that wording,
  and do not drop a `reviewEvery` because a probe looks reliable.

Known open item carried in the registry itself: `nrp` has `reconciled:false` —
`neonatal/` still carries content not reconciled line-by-line with NRP 9th
edition. Flip it to true only on a clinician's sign-off, not when the review
banner comes down.

## Deploy & test workflow

Give Lon this four-step close-out after every deliverable that touches a
live file (not needed for pure documentation-only changes) — adjust it for
whatever's actually pending (e.g. don't say "open a PR" if one's already
open on this branch):

1. **Commit & push** to the active feature branch (currently
   `system-audit-fixes`).
2. **Test on the Netlify branch deploy** — pushing to any connected branch
   automatically builds a live, fully-working deploy at its own URL,
   completely separate from production. Find it on Netlify → Deploys → the
   latest entry for that branch → **"Open branch deploy."** This is the real
   pre-merge test step: safe, live, and it doesn't require merging first. The
   URL persists and auto-updates on every new push to that branch, so it's
   worth bookmarking for the duration of the branch's life.
3. **Once it checks out on the branch deploy, merge the PR** into `main` on
   GitHub (compare URL pattern: `.../compare/main...<branch-name>`).
4. **Netlify auto-builds `main`**; production (`lrhemergencymanual.net`)
   updates. One more quick check there closes the loop.

**Do not send Lon straight to the GitHub compare/PR page as the "test"
step** — that page only renders a diff, it is not a live, testable site.
Step 2 (the Netlify branch deploy) is the actual test environment, and it's
available immediately after step 1, before any PR or merge.

Netlify also has a separate "Preview Servers" feature (visible in its left
nav) — unrelated to this workflow; don't point Lon there.

**The assistant cannot fetch or confirm the branch deploy itself** — Netlify
branch deploys are access-gated (401 on a direct fetch), so "let me check if
it's live" is not a real offer; don't make it. What the assistant *can* and
must do instead: with every deliverable, hand Lon a concrete, change-specific
test checklist for that branch deploy — not "check that it works," but the
actual buttons/cards/fields to tap and what to look for, scoped to exactly
what changed in that update (new card → open it, tap every checkbox/button
once; touch-target resize → confirm the specific elements resized and still
function; search-index entry → search the specific new keywords; terminology
sweep → spot-check the specific lines that changed). Model: the WS11.6
Codes-family checklist ("what am I testing specifically" exchange) — list
each card, what to tap, and what a pass/fail looks like. A generic "please
test it" is not sufficient close-out for a deliverable.

## Current tools

- `codes/` — Codes (cardiac arrest, stroke, RSI, STEMI, status epilepticus,
  and other resuscitation cards).
- `ob-neonatal/` — OB & Neonatal emergencies (delivery, PPH, shoulder
  dystocia, neonatal resuscitation, hysterotomy, and more). Card 03 now points
  at `neonatal/` for the live version; the card stays as the reference view.
- `neonatal/` — the newborn resuscitation **engine** (issue #135): time of birth
  stamped on one tap, 30-second cycles off that clock, heart-rate driven
  pathway, Apgar marks that fire on their own, and the SpO₂ target for the
  minute the baby is actually in. A live-protocol peer of `arrest/`, `airway/`
  and `tca/`, not a card. **Its content was carried over unchanged from card 03
  and has not been reconciled with NRP 9th edition — the review banner stays up
  until a clinician signs it off, and `verify_neonatal_screen.mjs` fails if
  anyone switches it off quietly.**
- `pph/` — the postpartum hemorrhage **engine** (issue #135): clock from
  recognition, running blood loss as first-class state, escalation prompts that
  fire on the trend, and uterotonics greyed out by a contraindication asked once
  up front. Card 06 stays as the reference view.
- `dystocia/` — the shoulder dystocia **engine** (issue #135): the head-to-body
  interval as the clock, HELPERR one rung at a time, and a record of every
  maneuver with its time. **The clock does not restart when the sequence is run
  again** — the interval is continuous, and `verify_ob_engines.mjs` asserts it.
  Card 07 stays as the reference view.
- `peds/` — Pediatric Emergencies.
- `procedures/` — Rare, high-stakes procedure checklists (chest tube,
  thoracotomy, burr hole, canthotomy, CVC, TVP, tourniquet, JADA, etc.).
- `trauma/` — Trauma activation and resuscitation pathways.
- `clinical-pathways/` — Diagnostic pathways (e.g. Chest Pain / HEART).
- `posters/` — Printable one-page posters generated from procedure content.
- `debrief/` — redirect stub only; the debrief card lives in `conversations/`
  (card 04). Kept so old links and printed QR codes still resolve.
- `simulations/` — pillow-patient in-situ drill scripts chaining the tools'
  workflows (deliberately excluded from the site search). Each sim also carries
  a **FIND IT** equipment walk that writes into the shared readiness record
  (`INV_CAPTURE`), so a drill or a new-hire orientation doubles as an audit.
  Kits appear at kit level only — the sims say point, don't open.
- `vems/` — Visually Enhanced Mental Simulation kit: the printable, laminatable
  card deck (patient poster, monitor cards, equipment cards, facilitator run
  sheet) that runs a case on a table instead of a mannequin. See **Shared
  equipment icons** above — its equipment cards must carry the same glyphs as
  the cart drawer labels.
- `sources/` — the upstream guideline registry rendered for humans: which
  edition each tool is written against, when a human last checked it, and which
  cards move if it changes. Read-only; see **Keeping content current** above.
- `equipment-readiness/` — searchable equipment locations **size by size**, a
  readiness score against seven national standards, and the cart-walk capture
  that turns a walk into a git change. Rendered from the root `inventory.js`
  (injected at build like `design-system.css`; see `INVENTORY-DESIGN.md`).

## The equipment inventory (issue #117 family, `INVENTORY-DESIGN.md`)

`inventory.js` is the single source for every physical item the manual names.
Two layers: **CATALOG + STANDARDS travel with a fork; LOCATIONS is the only
block another ED rewrites.** Four rules when touching it:

- **Sizes are rows.** An item with `sizes:[…]` is audited once per size
  (`id#size`), because "supraglottic airways 1–5: present" hides the only
  question worth asking. Add sizes wherever a standard — or this department's
  own stock reality — names them.
- **A standard is joined, not listed twice.** An item declares `std:[…]`; each
  standard's `items` array is derived from that at the bottom of the file.
  Never hand-maintain a second list.
- **NOT REVIEWED is not GAP.** An item with no `INV_LOCATIONS` entry has not
  been looked at. A gap is an assertion someone makes — in `INV_GAP_ISSUES`
  with an issue number, or by a champion on the walk. Never let an unreviewed
  row score as either mapped or missing.
- **Kit contents are byte-identical across artifacts.** The strings in a kit's
  `contents` must match the procedure card, the poster and the cart label
  exactly; `verify_kit_consistency.mjs` asserts it across all four, inventory
  included.

Adding a standard means: catalog `std` tags, an `INV_STANDARDS` entry with a
real citation and a `kind` (`itemized` vs `narrative` — a narrative source gets
a "NOT A VERBATIM LIST" caution on screen), a `SEARCH_INDEX` entry for its
section, and a run of `verify_equipment_readiness.mjs`.
