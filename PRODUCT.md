# Product

Durable product truth for the CairnReady Emergency Manual. This file owns *what
the product is and who it serves*. It does not own visual decisions — those live
in `DESIGN.md`. It does not own clinical content — that lives in the tools and
their SITE CONFIG blocks, governed by `CLAUDE.md`.

Written to satisfy Impeccable's `init` contract so that `shape`, `critique`,
`audit`, and `polish` all run against real product truth rather than inference.

---

## Platform

Static, offline-first progressive web app. Installed to the home screen on
phones and tablets; also opened in a desktop browser on wall-mounted displays;
also **printed to paper** as posters and cart labels that live physically on
resuscitation carts.

Four output surfaces, all governed by the same system:

1. **Phone** — the primary device. A clinician's own phone, in a pocket,
   one-handed, often while doing something else with the other hand.
2. **Tablet** — usually shared and wall-mounted or cart-mounted. Nobody owns it;
   its settings are whatever the last user or IT left.
3. **Desktop / wall display** — a fixed screen in the resuscitation bay.
4. **Print** — posters taped near carts, labels adhered to cart drawers. Print is
   not a degraded copy of the screen; it is the fallback when the network, the
   device, or the power is gone.

## Stack

Vanilla HTML, CSS, and JavaScript. No framework, no runtime dependency, no CDN.
Each tool is one directory containing one self-contained `index.html` with inline
CSS and JS. `build.mjs` injects shared stylesheets and scripts at named markers
so the deployed files in `dist/` are fully self-contained and work with no
network. Deployed via GitHub → Netlify. A service worker precaches the entire
site for offline use.

Verification is a suite of Playwright-driven `verify_*.mjs` scripts run against
the built `dist/` by `run-tests.sh`, gated in CI.

## Users

**Primary:** emergency department clinicians at a rural hospital — physicians,
physician assistants, nurse practitioners, and nurses.

**Critical secondary:** the **locum** and the **new hire**. Someone who has never
opened this manual before, working a night shift, reaching for it during a
resuscitation. Every affordance must be legible to this person on first
encounter. This user is the reason novelty is a cost, not a feature.

**Tertiary:** clinicians at other rural hospitals who fork the manual for their
own site. The system must survive localization without redesign.

## Product Purpose

Put the right next action, and the correct dose for *this* patient, in front of a
clinician who is under time pressure and cognitive load, without requiring them
to read, search, or remember.

The manual is a **cognitive aid**, not a textbook and not a medical record. It
computes doses from a weight entered once, runs the cadences that are easy to
lose track of, and timestamps what happened so nobody has to reconstruct it
afterward.

## Positioning

The **generic base** of **Cairn**, an open-source rural-ED readiness project.
Rural emergency departments see high-acuity, low-frequency events with small
teams and no in-house specialists. This manual is the part of that project that
runs on a screen.

`main` is the generic base and holds no hospital's local truth. LRH's edition is
a fork of it, like any other adopting department's — which is what keeps the base
honest, since the localization process is exercised every time LRH changes
anything. `LOCALIZATION.md` is the inventory and the process.

It is deliberately *not* an EHR module, not an institutional IT system, and not a
substitute for clinical judgment. It states this on every tool.

## Operating Context

The design scene is not a desk. It is:

- A resuscitation bay with the lights up, or a night shift with them down.
- Gloved hands, possibly wet.
- Reading distance ranging from 30 cm on a phone to 2 m on a wall display.
- Divided attention — the clinician is talking, directing a team, and looking at
  a patient. The screen gets glances, not sessions.
- Devices whose theme, brightness, and orientation were set by someone else.
- A time budget measured in seconds.

Every design decision is evaluated against this scene. A choice that reads
better on a designer's monitor and worse at arm's length in a bright room is the
wrong choice.

## Capabilities and Constraints

**Hard constraints, non-negotiable** (these are `CLAUDE.md` golden rules and they
outrank every design consideration in this document):

- **Fully offline.** No external requests of any kind — no CDN, no webfont fetch,
  no analytics, no telemetry. Every asset is inline or precached.
- **No PHI, ever.** No patient identifiers are collected, stored, or transmitted.
  Operational state (weight, timers, checkmarks, event log) lives on the device
  only, and is cleared by RESET and by inactivity.
- **Config-driven clinical values.** Doses, energies, cadences, and thresholds
  come from the tool's validated SITE CONFIG block. The interface renders
  config; it never carries a number of its own.
- **Cited logic.** Every clinical value shows its criteria and its source. Never
  a black box.
- **One home for content.** Content exists in exactly one place and is
  transcluded, injected, or linked elsewhere. Never pasted.
- **A medical conflict is a stop.** Disagreement with an upstream body, or with
  the manual itself, blocks the work and escalates. It is never a note.

**Capabilities:**

- Shared case state across tools on one device — one weight, one clock, one event
  log, so moving between tools mid-case does not lose context.
- Live dose computation from weight, including pediatric weight-band routing.
- Cadence timers that are also the buttons that satisfy them.
- An auto-logged, PHI-free case timeline the clinician can copy out.
- A physical/digital loop: every card names where its equipment is; every drawer
  label, poster, and cart maps back to a card.

## Brand Commitments

- The **cairn** — a stacked-stone trail marker — is the identity of the network.
  It appears as the back/up mark in every deployment and is not localizable.
- The pulse trace is the app-icon motif.
- Localizable per fork: hospital name and abbreviation, equipment locations,
  device-specific energies, and the clinical review state. Everything else is
  shared.

## Evidence on Hand

- `design/DESIGN_LANGUAGE.md` and `design/ICONOGRAPHY.md` — the design handoff.
- `design/*.dc.html` — Claude Design artboards for the design language, the
  procedure iconography, the VF/VT aid, and the TCA aid.
- `SHELL.md`, `LAYOUT.md`, `CASE-STATE.md`, `ACCESSIBILITY.md`,
  `DESIGN-SYSTEM.md`, `TERMINOLOGY.md` — written contracts, several of which are
  currently contradicted by the code and are being amended as part of this work.
- 41 `verify_*.mjs` suites plus `verify_qr_decode.py`, covering clinical logic,
  cross-tool state, content duplication, and a small amount of visual
  consistency.
- `.impeccable/config.json` — detector suppressions with written reasons.

## Product Principles

1. **The next action is face up.** No accordion to open, no scroll to hunt. If a
   clinician has to look for it, the design failed.
2. **Familiarity is a feature.** This is an Operate surface. Invented affordances
   cost a stranger time they do not have. The tool disappears into the task.
3. **Nothing is re-learned mid-crisis.** One bar, one strip, one dock, one picker,
   reused everywhere. A tool differs only in words, timers, and doses.
4. **Color is never the only carrier.** Every meaning color encodes is also
   carried by a word, a number, a shape, or a position — because the artifact may
   be photocopied, printed in greyscale, or read by someone with a color vision
   deficiency.
5. **Show the reasoning.** A clinician who does not trust a number will not use
   it. Criteria and sources are visible, not buried.
6. **Portable by construction.** Anything specific to one hospital is data, not
   design.

## Accessibility & Inclusion

`ACCESSIBILITY.md` is normative and is part of the shared skeleton, not polish.

Committed floors:

- Contrast: 4.5:1 body text, 3:1 large text and non-text, **verified in both
  themes**.
- Target sizes: 24px global minimum; 44px minimum inside operational controls;
  documented per-class floors for destructive, routing, secondary, checkbox, and
  clock controls, stepping up at ≥760px.
- Body text ≥15px with line-height ≥1.4. Inputs ≥16px so iOS does not zoom.
- Reflow without horizontal scrolling at 320px.
- `prefers-reduced-motion` honored by every animation.
- Visible focus on every interactive control. `:focus-visible` is never removed.
- Icon-only controls carry an accessible label; disclosures expose their state.
- No interaction that requires long-press, double-tap, drag, or hover.
- Theme follows the device's `prefers-color-scheme`, with no in-app override.
  This knowingly accepts the shared-device hazard named under Operating Context
  above; see `DESIGN.md` §7 for the reasoning and the condition that would
  reopen it.

Known gaps as of this writing, all in scope for the current redesign: no focus
rules on shell controls, no `aria-expanded` anywhere, and target-size floors that
are dead CSS on three tools.
