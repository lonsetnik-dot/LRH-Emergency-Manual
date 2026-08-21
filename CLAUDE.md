# CLAUDE.md — operating rules for AI assistants in this repo

This repository is a set of **client-side, bedside emergency-department
decision-support tools**.

> ## THE BRANCH IS `main`, AND NETLIFY MUST AGREE.
>
> **`main` is the trunk and the deploy branch** — the LRH reference
> implementation, localized to Littleton Regional Healthcare, and the live
> bedside instrument at lrhemergencymanual.net. Branch from it, and open every
> pull request against it. It is the only branch; an `lrh` branch existed for a
> while and was consolidated into `main` and deleted.
>
> **THE REPO CANNOT TELL YOU IF THIS IS TRUE.** Which branch actually deploys
> lives in Netlify — Project configuration → Build & deploy → Branches and
> deploy contexts → *Production branch* — and nothing in these files is checked
> against it. This sentence has been wrong before, and the cost was concrete: a
> full session of work was built, verified, reviewed and merged to a branch
> nothing served, while the live manual sat 37 commits behind, and no test
> caught it because no test can. **If a doc and the deployment disagree, the
> deployment wins.** If work you merged is not showing up on the live site,
> check that Netlify field before you look anywhere else.

`demo-build.mjs` produces a showroom copy of the same content (DEMO ribbon,
`noindex`) from this same branch; it has no site attached at the moment.
`cairnready.org` is a **separate set of sites in another repository** — not
this one. **There is no generic trunk branch, and `main` must not be reverted
to a generic identity** — that would swap a hospital's live manual for a demo.
Another hospital's edition is a new branch/fork that localizes
`site.config.json` and the per-tool SITE CONFIG blocks. See `SITES.md`. Follow
these rules on every task. The reasoning behind them is in `PROJECT.md` — read it if a rule seems
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
   // ===== SITE CONFIG (site-specific — edit to localize) =====
   ```
   Identity strings (manual title, hospital line, domain, transfer/poison
   phone lines) do NOT get hand-typed per tool: use `{{SITE.*}}` tokens,
   substituted from the root `site.config.json` at build (`build.mjs` fails
   on unknown or leftover tokens). Internal namespaces — `lrh-case-*` /
   `lrh-pref-*` localStorage keys, `.lrh-*` classes, `--lrh-*` custom
   properties — are the cross-tool contract (`CASE-STATE.md`) and stay
   as-is in every edition; never rename them during localization work.
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
   Mobile accessibility is part of the skeleton, not a polish step:
   `ACCESSIBILITY.md` is the normative standard (zoom never disabled, LAYOUT.md
   target floors, 4.5:1 token contrast in both themes, 320px reflow, reduced
   motion, one `h1` + `lang` + unique title per page) and
   `verify_accessibility.mjs` enforces the machine-checkable half. A new tool
   or card must pass it before delivery.

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

12. **Content has exactly one home.** Before writing any clinical sentence, kit
    string, glyph or threshold, **search the repo for it.** If it already
    exists: transclude it (`{{PROC:…}}`), inject it (`inventory.js`, the icon
    sets), or link to it. If it genuinely must appear in two places and no
    mechanism exists, **build the mechanism or flag the gap — never paste.**
    A card is the home; live engines borrow. Never "fix" a borrowed row in the
    engine that borrowed it.
    The scar: CLOSE THE HEART, CLAMSHELL EXTENSION and HILAR TWIST were written
    into `procedures/` card 02 and then hand-typed into `tca/` **the same day,
    by the same author, hours apart.** Nothing looked wrong; editing either copy
    would have left the other saying the old thing. Duplication is not a tidiness
    problem here — two versions of a procedure is two different instructions to
    somebody with their hands inside a chest.
    **What enforces this today, and what does not.** Kit strings are held by
    `verify_kit_consistency.mjs`, drawings by `verify_procedure_icons.mjs` and
    `verify_vems.mjs`, borrowed card sections by `verify_transclusion.mjs`.
    **Free prose is not held by anything** — the duplication above was found by a
    person, not a run. Until a duplicate-prose scanner exists, this rule is
    carried by the search in **Before you build** and by nothing else. Do not
    read the green suite as evidence that nothing was retyped.

13. **A test you have not broken is not a test.** Every new assertion gets
    mutation-tested before delivery: break the behavior it claims to check,
    watch it go red, restore it. And **never scope a check by the field it is
    checking** — derive membership from content (a link, a rendered element),
    never from an optional wiring field, or deleting the field takes the subject
    out of the check as well as out of the product.
    The scar: three checks written in one session passed against a page that had
    been deliberately broken — one scoped itself to the wiring it was verifying,
    one looped over sheets that declared an optional card id, and one matched the
    word "output" inside the list of things that do **not** count as output.

14. **When Lon supplies an artifact, port it.** If you are handed a file, a
    design or a model, the deliverable is *that thing* working in this repo —
    same words, same flow, same colors. Anything you would add, rename, reorder
    or improve is a **proposal made before building**, not a discovery made
    afterwards. Deviating and then explaining is the expensive order.
    The scar: a 1,660-line TCA "engine" built instead of the aid that was
    uploaded, then five further commits grafting the real aid onto it, then the
    whole thing deleted. Two sessions to arrive back at the supplied file.

15. **A medical conflict is a STOP, not a note.** If content you are about to
    write or change disagrees with an upstream recommendation, **or with
    anything else in this manual**, do not resolve it and do not pick the
    plausible option. **Stop and ask, with the options laid out as a choice that
    can be answered in one tap** (`AskUserQuestion`), each option saying plainly
    what it means clinically and what would change on screen.

    This is the one place blocking is right. Ordinary ambiguity — wording,
    layout, naming, how to structure a build step — is a judgment call to make
    and mention. A disagreement about **what a clinician should do to a patient**
    is not, and no amount of confident prose from an AI substitutes for the
    physician whose name the manual carries. Both directions count:

    - **Against an upstream body** — the manual says one thing, the cited
      guideline says another, or the edition in `guidelines.js` has moved.
    - **Against itself** — a card, a poster, a label, an engine and a simulation
      disagree. Now that engines transclude cards (rule 12), a conflict between
      two screens is often a conflict inside one source, which is worse.

    While waiting: finish everything that does **not** depend on the answer, and
    say clearly what is parked on it. Afterwards: record the decision where the
    next person will look — the commit message, and `guidelines.js` when an
    upstream body is involved. A `reconciled` flag or a `lastVerified` date moves
    on a clinician's sign-off, never on the strength of the argument that
    produced it.
    The scar: `/tca/` step 10 asked "do you have signs of life?" and listed
    pupillary response and organized ECG — the criteria for deciding whether to
    *open* a chest, presented as the criteria for deciding whether to *keep
    going*. It was written confidently, it read plausibly, it survived a full
    green suite, and it was caught by a clinician reading the screen. The same
    conflation was on the thoracotomy wall poster.

## Before you build

Four things, in this order, before writing code. Every one of them is cheaper
than the rework it prevents.

1. **Search for what already exists.** Grep the distinctive phrase you are about
   to write. Check `inventory.js` for the item, both icon registries for the
   drawing, `guidelines.js` for the source, and the card folders for the
   procedure. Rule 12 is unenforceable if this step is skipped, because you
   cannot reuse what you did not know was there.
2. **State the shape and wait**, for anything past one card or roughly a hundred
   lines. Three lines is enough: what it will be, what it replaces, what it
   leaves alone. A yes costs one message; rule 14's scar cost two sessions.
3. **Name what you cannot verify.** The repo cannot tell you which branch
   Netlify serves, whether a deploy is live, or what a clinician meant. Say so
   in the same breath as the claim, rather than inferring and sounding certain.
   A whole session was merged to a branch nothing served because a doc sounded
   confident.
4. **Version-stamp anything user-visible**, in the same commit. The footer stamp
   is what makes "am I even looking at my change?" a one-glance question.

## Tempo — running the harness

The suite is slow enough that how it is run matters.

- **Affected suites while iterating, one full run before push.** Re-running all
  35 for a docs edit buys nothing and costs ten minutes.
- **Do not `pkill` by pattern.** `pkill -f run-tests.sh` matches the wrapper the
  command is running inside and kills the shell, which reports as a mystery exit
  code. Use `TaskStop`, or a distinct port.
- **Do not override `PORT` to dodge a busy socket.** `verify_offline.mjs` starts
  its own server on it so it can stop it mid-run, and it will collide with the
  harness's — a green codebase then reports a failed suite.
- **A failing suite and a failing assertion are different news.** Say which:
  "2,344 assertions passed; one suite crashed on a port collision" is the honest
  form, and it is not the same as a red check.

## Adding a new tool

0. Run **Before you build** above — search first, state the shape, wait.
1. Create a folder `<tool>/` with `index.html`, copying an existing tool as the
   skeleton so the shared header/CSS/disclaimer come along.
2. Fill in the SITE CONFIG block and the tool's logic; cite every threshold.
   Any procedure that already has a card is **transcluded, not retyped** — see
   golden rule 12. Any value that disagrees with a guideline or with another
   part of the manual **stops here and gets asked** — golden rule 15.
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

0. Run **Before you build** above. A new card is the most common place a
   sentence gets written for the second time — golden rule 12.
1. Copy an existing card's structure inside the tool's `index.html`; add a
   menu tile if the tool has one.
2. Add a `SEARCH_INDEX` entry in the landing page's `index.html` pointing to
   the card's `#cXX` anchor — see golden rule 9.
3. Write all prose in US English — see golden rule 10.
4. Add the card to its source's `dependents` in `guidelines.js`, or add a row
   if it cites a body not in the registry yet — see golden rule 11.
5. Cite every clinical value; verify the logic; stamp version + last-reviewed
   date on the tool file the card lives in. If a value conflicts with an
   existing card, poster, label or engine, **stop and ask** — golden rule 15.

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

## Shared procedure icons (`design/ICONOGRAPHY.md`)

`procedure-icons.js` is a **second, separate** icon set — and the distinction is
the point. The equipment glyphs above draw *objects* (the thing in the drawer).
These draw *procedures*: anatomy plus the one thing you do to it. Same injection
mechanism, marker `/* @proc-icons */`. Consumers today: `procedures/` (14 cards),
`codes/` (RSI, FONA) and `ob-neonatal/` (UVC, hysterotomy).

Same rule as the equipment set — **do not paste a procedure glyph inline into a
tool.** `verify_procedure_icons.mjs` compares the *rendered* markup across pages,
so an inline copy fails the run even if it looks identical.

The grammar is four rules, in the header of `procedure-icons.js` and in full in
`design/ICONOGRAPHY.md`:

- **Anatomy in ink, action in red.** `currentColor` for primary anatomy, `--ink2`
  for landmarks and labels, and exactly **one** `--red` idea per figure — the cut,
  the tube, the band. Two red ideas means the figure has stopped saying one thing.
- **Same base, honest difference.** Chest tube / pigtail / thoracotomy share the
  rib base; CVC / Cordis share the neck base; RSI / SALAD share the face; JADA /
  hysterotomy share the uterus. The suite asserts the shared prefix survives, so
  a redrawn base propagates instead of forking.
- **Two tiers, one drawing.** Glyph `0 0 48 48` (must survive 16px); detail
  `0 0 160 116` for posters and checklists, with its caption in HTML *below* the
  SVG — never drawn inside it, where it overruns the grid.
- Nothing is filled but action tips; dashed means under the skin, a landmark, or
  the thing that follows.

The anatomical decisions in `design/ICONOGRAPHY.md` were locked in clinical
review — left chest for thoracotomy, patient's right IJ, "measure depth by CT"
rather than fixed-pupil side. Do not regress them. The penetrating neck graphic
was left un-iconed at that same review, then later requested by a clinician and
wired to `procedures/#c11` — see `design/ICONOGRAPHY.md` for what it draws.

Decorative glyphs are `aria-hidden` with no role or label. That is not a detail —
a labeled decorative SVG shadows the real figure for any selector or screen
reader looking for the drawing that carries the meaning.

## Transcluded card sections (`{{PROC:tool#cNN|SECTION}}`)

A live engine that walks somebody through a procedure the manual already has a
card for **does not re-type that card.** It names the section and gets the card's
own rows, substituted at build like `{{SITE.*}}`:

```js
l: {{PROC:procedures#c02|CLOSE THE HEART — PICK THE FASTEST THING THAT HOLDS}}
```

The token becomes a JSON array of `{do, why}` — the two tiers of the checklist
row — so the consuming page renders them in **its own** visual language while the
words have exactly one home. `tca/` is the first consumer; it borrows six
sections from `procedures/` cards 02, 09, 10 and 15, the hysterotomy from
`ob-neonatal/` card 10, and the debrief from `conversations/` card 04.

This exists because the second copy already happened. CLAMSHELL EXTENSION, CLOSE
THE HEART and HILAR TWIST were written into `procedures/` card 02 and then
hand-typed again into `tca/` **the same day**. Nothing looked wrong; editing
either one afterwards would have left the other saying the old thing, and no test
could have told. Four things follow:

- **Live markup does not travel.** A row's tap-to-log button writes into the
  *card's* case timeline and its cross-links are relative to the card's folder;
  both are wrong once the row is somewhere else, so they are dropped. What
  transclusion moves is the text — which is why every transcluded sheet is paired
  with a link to the full card, and why the glyph beside that link is derived
  from the link rather than declared next to it.
- **The build fails on a section that does not resolve**, and the error names the
  headings that do exist. A renamed section is a silent content loss otherwise.
- **A card is still the place to edit.** Change the card; the engine moves on the
  next build. Never "fix" a transcluded row by pasting it into the engine.
- **`verify_transclusion.mjs` compares the RENDERED text**, page against page —
  the same thing `verify_procedure_icons.mjs` does for drawings — rather than
  trusting that both went through the same build. It also builds a probe with a
  bad token (`BUILD_OUT` sends that build to a temp directory so `dist/` is never
  disturbed) and asserts it fails.

Finger thoracostomy is the one gap: it is a *row* inside the chest-tube card's
technique list, not a card, so `tca/`'s sheet for it stays hand-written and says
so. A card of its own is worth having — three tools name the procedure and none
of them owns it.

## The case shell's reveal behavior (`case-shell.js`)

`case-shell.js` is the shared runtime for the case shell, injected at the marker
`/* @shell-js */` exactly like `design-system.css` and `inventory.js`. Consumers: all six
live-protocol engines (`arrest/`, `airway/`, `tca/`, `neonatal/`, `pph/`, `dystocia/`).

It exists because **the next step was off the top of the screen.** A clinician scrolls down
to read the ladder, taps the action it just told them to take, and the operating card — now
showing the next step — is a thousand pixels above the viewport. Measured on every engine
before the fix: dystocia −883, neonatal −585, pph −902, arrest −1132, airway −441. During a
shoulder dystocia the head-to-body interval is the clock, so this was spending the one
resource the tool exists to protect.

**Wiring is one attribute.** Mark the operating card `data-opcard` and nothing else. A new
engine gets the behavior by carrying that attribute and the marker; a page without one gets
no behavior and no error. Never hand-write scrolling into an engine.

**The operating card is a REGION.** Mark every element that is part of "what to do now",
not just the box at the bottom of it: `arrest/` marks the rhythm-unknown bar and the rhythm
bar alongside its cycle card, `pph/` its blood-loss adder, `dystocia/` its head-to-body
clock, `tca/` its workstream list. The module anchors on whichever marked element is
currently topmost on screen and ignores ones that are `display:none`, so a bar that exists
in one phase participates only in that phase — and a bar appearing or disappearing counts
as a step change. Marking only the last box scrolled arrest's amber "PADS ON — CHECK THE
RHYTHM" button off the top of the screen at the start of every case: the module hid the
next action while dutifully revealing the card below it.

**A reveal never scrolls a visible control off the top.** Content pushed above the sticky
bar cannot be reached by scrolling the way the page invites you to, and nothing on screen
suggests it is up there. `reveal()` refuses rather than compromises, which is why several
engines simply do not move at the start of a case — that is the correct outcome, not a
missing feature.

**The hard part is NOT scrolling.** An unrequested jump mid-code takes the text away from
whoever is reading it — the same reason the offline shell never reloads a page by itself.
Four rules, and every one of them was written after a real defect:

- **The step must have changed, not just the DOM.** Engines re-render the whole card on the
  1 s tick, so "the card mutated" is nearly meaningless — it made *any* tap within the
  gesture window scroll the page, including opening a reference accordion. What is compared
  is the card's text **with digits and punctuation stripped**: a countdown going 2:31 → 2:30
  leaves that signature identical, advancing PRESSURE → LEGS changes it.
- **A deliberate scroll wins**, and it is detected from `wheel`/`touchmove`, never the
  `scroll` event — advancing a step shortens the page, the browser clamps `scrollY`, and
  that emits `scroll` with nobody having touched anything. Listening to it silently
  cancelled the very reveals this module exists to perform.
- **One decision per gesture.** Concluding "already visible, nothing to do" without
  disarming let a later clock tick act on a stale gesture and scroll seconds after the tap.
- **A picker suspends the decision rather than resolving it**, and the module polls for the
  sheet to close rather than waiting for a mutation, because some engines repaint every
  second and some only on a state change. The baseline signature is captured only when
  arming *fresh*, so dismissing a picker with ✕ does not re-baseline against a card that has
  already advanced.

`verify_case_shell.mjs` asserts the pair that matters: **the step changed → the card is on
screen below the bar; the step did not change → the page was not scrolled.** Note that
"was not scrolled" cannot be a raw `scrollY` comparison, for the clamping reason above.

## Checklist rows: ACTION on screen, WHY behind a tap

Every checklist row in the manual is two tiers — `<b>ACTION</b><i class="t-why">reasoning</i>`
— because a row is read mid-task by someone whose hands are busy. `.t-why` is hidden until
the tool's one WHY control is tapped, always shown in print, and remembered as a preference
(`lrh-pref-why`). Full rationale and the writing rules are in `DESIGN-SYSTEM.md` §6b.

Three things to know before editing or adding a row:

- **The action must stand alone.** A number the step cannot be performed without belongs in
  the action, never only behind the WHY. `verify_checklist_clarity.mjs` fails a row that
  hides a dose-shaped value from its own action, and `tools_clarify.mjs` refuses to write
  one. `data-ref` is the only sanctioned way to hide a number, per row, on purpose.
- **Do not rewrite a kit-contents row for readability.** Those strings are byte-identical
  across the card, the poster, the cart label and `inventory.js`; rewording one is a
  different task, done to all four at once. Several rows stay over the length target for
  exactly this reason, and the suite's budget block names them.
- **A row rendered from config gets its tiers in config.** A `SITE.withdrawal` rung accepts
  `{do, why}`, so a fork that localizes its ladder localizes the reasoning with it.

`tools_clarify.mjs` is the dev-only helper that applies these rewrites; it refuses rather
than warns whenever a replacement would drop live markup (a `.wdose` span, a tap-to-log
button, a cross-card link, any `data-*` hook), because every one of those failures is
invisible on screen afterwards.

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

That open item is now closed, and how it closed is the worked example: `nrp` carried
`reconciled:false` because `neonatal/` had content inherited from an uncited card and
never checked line-by-line. On 2026-08-18 a clinician reviewed it, so the flag went true,
`SITE.review.on` in `neonatal/index.html` went false, and both changes cite the same
sign-off. Flip a `reconciled` flag on a clinician's sign-off, never because a banner came
down or a review "looks done" — and set it back to false whenever the content it covers
moves again.

`verify_neonatal_screen.mjs` shows the shape a banner guard should take once its banner is
allowed to come down. It used to assert "the review banner is visible", which stops being
a useful test the moment the review it was waiting for happens — and would have pushed the
next editor to delete the check. It now asserts the banner matches `SITE.review.on` **and**
that switching it off is accompanied by a name and a date in `SITE.review.signedOff`. The
thing being guarded was never "the banner exists"; it was "nobody makes this look reviewed
without saying who reviewed it."

## Deploy & test workflow

Give Lon this four-step close-out after every deliverable that touches a
live file (not needed for pure documentation-only changes) — adjust it for
whatever's actually pending (e.g. don't say "open a PR" if one's already
open on this branch):

1. **Commit & push** to a feature branch off `main` (never straight to
   `main` — it is what lrhemergencymanual.net serves).
2. **Test on the Netlify branch deploy** — pushing to any connected branch
   automatically builds a live, fully-working deploy at its own URL,
   completely separate from production. Find it on Netlify → Deploys → the
   latest entry for that branch → **"Open branch deploy."** This is the real
   pre-merge test step: safe, live, and it doesn't require merging first. The
   URL persists and auto-updates on every new push to that branch, so it's
   worth bookmarking for the duration of the branch's life.
3. **Once it checks out on the branch deploy, merge the PR** into `main` on
   GitHub (compare URL pattern: `.../compare/main...<branch-name>`). Check the
   base branch on the PR page before merging — GitHub may still default the
   base to another branch, and a PR merged into the wrong one looks exactly
   like success while changing nothing on the live site.
4. **Netlify auto-builds `main`** → `build.mjs` → production
   (`lrhemergencymanual.net`). One more quick check on production closes the
   loop. If a change touches `site.config.json` or any `{{SITE.*}}` token, run
   `demo-build.mjs` too: it has its own substitution pass and its own failure
   check, and it published 363 raw `{{SITE.x}}` markers for a while because it
   had neither — even though no site is attached to that build today.

**THE OFFLINE SHELL WILL SHOW YOU A STALE BRANCH DEPLOY.** This bit them
once and it looks exactly like "the change was never made": a phone that had
opened that preview URL before kept serving a build five commits old, with no
warning on screen. The worker is cache-first by design (see **Offline shell**
above), so the first load after a push renders the *previous* version. The
"MANUAL UPDATED — reload when it is safe to" bar is what covers this — but it
is `position:fixed; bottom:0`, and on a Netlify deploy preview that is exactly
where Netlify's own "Collaborate / Log in" widget sits. So on the one URL used
for testing, the staleness warning is the thing most likely to be hidden.

Three consequences for how a test checklist is written:

- **Name the version stamp as the first check.** Every tool's footer carries
  `v<x.y.z> · last reviewed <date>`, so "the footer should read v1.2.1" is a
  one-glance answer to "am I even looking at my change?" Bump the version in
  the same commit as any user-visible change, or that check is worthless.
- **Tell them how to force it.** Tap RELOAD on the update bar if it is visible;
  otherwise reload twice (the first load installs the new worker, the second
  is served by it), or open the preview in a **private tab** — service workers
  do not persist there, which is the one reliable way to see a deploy cold.
- **A screenshot that contradicts the diff is a caching question first.** Before
  re-reading the code, ask which version the footer claims. Rendering the step
  from the local `dist/` and comparing takes a minute and settles it.

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
  and `tca/`, not a card. Clinically reviewed and signed off 2026-08-18 — the
  review banner is down and `guidelines.js` `nrp` is `reconciled: true`. The
  sign-off is recorded in `SITE.review.signedOff`, and the suite requires it:
  the banner may only be off while a name and a date are named there.
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
- `clinical-pathways/` — Diagnostic and workup pathways: Chest Pain / HEART,
  the PE clinical categories, plus `sepsis/` and `dka/`, which moved out of
  `codes/` in the 2026-08 clinical review (issues #178, #176). The dividing line
  the review drew: `codes/` is for what you grab while a patient is crashing;
  a workup that unfolds over hours off a departmental order set belongs here.
  Their old anchors (`codes/#c28`, `#c31`) hash-redirect so printed QR codes and
  old links still resolve.
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
