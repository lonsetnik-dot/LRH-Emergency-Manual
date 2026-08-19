# SITES.md — the reference edition and hospital editions

> How one codebase serves lrhemergencymanual.net (the reference
> implementation), demo.cairnready.org (the same content as a showroom copy),
> cairnready.org (the explainer), and any number of hospital-localized
> editions.

## The model

```
main  —  the LRH reference implementation
├── site.config.json      LRH identity, real phone lines
├── <tool>/SITE CONFIG    LRH's validated clinical values
│
├─ build.mjs      → dist/       → lrhemergencymanual.net   (production)
├─ demo-build.mjs → dist-demo/  → demo.cairnready.org      (DEMO ribbon + noindex)
├─ cairn/         → published in place → cairnready.org    (explainer)
│
└─ hospital edition: <site #2>   (branch or fork — deploys to its own domain)
     site.config.json rewritten  + per-tool SITE CONFIG values validated
```

**There is no separate generic branch, and `main` is not generic.** That is a
deliberate change from the original model (a CairnReady generic trunk on
`main`, LRH on a branch), retired when the demo became a *build* of the real
thing rather than a fork of it. `demo-build.mjs` says so in its header: the
demo serves "the same tool content as build.mjs's dist/ — the real reference
implementation, nothing generic or fake", differing only by a DEMO ribbon,
`noindex`, and no offline shell. A prospective site is shown a manual that a
real ED actually uses at the bedside, which is the whole argument.

> **Do not "restore" a generic identity to `main`.** It would swap the
> hospital's live manual for a demo edition and pull the ground out from under
> `demo-build.mjs` at the same time. If a generic edition is ever wanted again,
> it is a new branch off `main` with `site.config.json` rewritten — the same
> pathway as any other edition below.

A **hospital edition** is a branch or fork that changes only the two
localization layers below. It never rewrites logic, layout, or the verify
suites — that is the whole point of the separation, and the config-driven
verify suites (CLAUDE.md, issue #117) are written to stay green across
localized values.

## Layer 1 — `site.config.json` (identity, one file)

Every `{{SITE.key}}` token in any page is replaced from this file at build
time (`build.mjs`). The build fails loudly on an unknown key or a leftover
token, so identity can never half-apply. This covers: manual title, short
name, hospital line, eyebrow, domain, edition note, footer, transfer-center
name and phone, poison-control line.

Standing up a new hospital edition therefore *starts* with editing one file —
the site's name is on every page in the first commit.

## Layer 2 — per-tool `SITE CONFIG` blocks (clinical truth)

Each tool keeps its clinical site-specific values (thresholds, assay names,
doses that vary by formulary, defib energies, cart locations) in the marked
block at the top of its own file:

```js
// ===== SITE CONFIG (site-specific — edit to localize) =====
```

These stay per-tool deliberately: a threshold belongs next to the logic that
uses it and the citation for it. On `main` they hold LRH's validated values,
or national-guideline defaults where LRH has not diverged, or clearly flagged
placeholders where nobody has decided yet. **Every one of them requires local
clinical validation before another hospital's edition goes live** — see
`LOCALIZING.md` and `LOCALIZATION-WORKSHEET.md` for the walk-through, and
`inventory.js` for the third localized surface (the `LOCATIONS` block — the
only part of the inventory a hospital rewrites; `main` ships LRH's layout as
a worked example).

## What is deliberately NOT localized

- **Internal namespaces.** localStorage keys (`lrh-case-*`, `lrh-pref-*`),
  CSS class names (`.lrh-*`), and custom properties (`--lrh-*`) are a
  historical internal namespace, invisible to users, and form the cross-tool
  shared-state contract (`CASE-STATE.md`). They are the same in every
  edition. Renaming them is cosmetic churn with real risk to the live
  engines; if it ever happens it happens once, on the trunk, for all sites.
- **Clinical invariants.** Escalating energy sequences, per-kg caps at adult
  ceilings, ladder ordering, PHI guards, scope disclaimers, citations. The
  verify suites assert these as written-out invariants a fork cannot
  localize away.

## Keeping editions in sync with the trunk

Hospital editions should merge (or rebase onto) the trunk regularly. Because
localization is confined to `site.config.json`, the SITE CONFIG blocks, and
`inventory.js` LOCATIONS, trunk updates to logic/design/content merge without
touching the localized layers in the common case. A conflict inside a SITE
CONFIG block is a *feature*: it means upstream changed a default a site had
localized, and a human should look.

## Division of responsibility

- The **trunk** owns: logic, design system, verify suites, guideline registry
  wiring, national-default values, docs.
- Each **hospital edition** owns: its identity file, its validated clinical
  values, its cart/location truth, its version stamps and review dates, its
  medical-direction sign-off, and its hosting.
