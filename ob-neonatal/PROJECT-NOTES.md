# this site OB Emergencies — project notes

Beta cognitive aids for OB and neonatal emergencies in the Emergency Department.
Live at https://your-manual-domain/ob/ — hosted on Netlify from a git repo.
**Beta: practice and feedback only, not for clinical use.** A splash screen says so on first open.

## The artifact

`ob/index.html` is the entire app: one self-contained HTML file, no external assets,
no build step. It works from a phone home screen, offline, and opens in any browser.

## Cards

01 index · 02 imminent normal delivery · 03 neonatal resuscitation · 04 UVC placement
05 ED C-section · 06 postpartum hemorrhage · 07 shoulder dystocia · 08 breech
09 cord prolapse · 10 perimortem hysterotomy · plus the cart drawer reference.

## Design language

- Colors: navy #16324f, red #9b1c2e, amber #8a6d1f, teal #0e7c86, grey #5a6a78, paper #fffefb.
- IBM Plex Mono for labels and timers; system serif/sans for body copy.
- Every card: header (name / claim / aim) → sticky banner where relevant → numbered
  step panes with checkboxes → infographics → handoff pane → ↑ INDEX.
- Cart drawers are color- AND shape-coded (ring, diamond, square, triangle, bar,
  double-bar) so they read in greyscale and low light. Equipment badges link to drawers.
- All SVG figures are hand-drawn geometry, labels never below ~9px in-figure, 10.5px in UI.

## Interactive behavior

- **Banner bars** (cards 02, 03, 06, 07) are sticky at top:76px and carry a running clock
  plus a horizontally scrolling log of timestamped interventions.
- **Card 02**: time-of-birth stamp → live clock since birth with 1 and 5 minute Apgar
  markers; Apgar calculator at 1/5/10/15/20 min.
- **Card 03**: HR triage buttons (≥100 / 60–100 / <60) set the metronome mode, start the
  right timer, ring the right step pane, and set the recheck interval (60 / 30 / 60 s).
  Tapping <60 without a secured airway routes to a 30 s "airway + chest-rising PPV" phase
  first. LMA pane opens itself two rounds into compressions.
- **Card 07**: HELPERR as five numbered maneuver panes; done ones collapse with a ✓;
  "run the sequence again" restarts the round while total elapsed time keeps counting.
- State persists in localStorage; RESET FOR NEXT CASE clears everything.

## Deploying

Replace `ob/index.html`, bump `CACHE` in `ob/sw.js`, commit, push. `netlify.toml`
sets no-cache on the shell so phones pick up the new version on next open.

## Open questions

- Drawer contents were inferred from the manual text; a photo of the actual cart drawer
  labels would make them exact.
- The four-question gate on card 02 includes "mother stable?" — a local addition to the
  standard three NRP questions.
