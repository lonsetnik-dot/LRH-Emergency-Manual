# SITES.md — the generic trunk and hospital editions

> How one codebase serves demo.cairnready.org (the generic edition; linked
> from the cairnready.org explainer page) and any number of hospital-localized
> editions, starting with LRH and a second pilot hospital.

## The model

```
cairnready generic trunk  (main — deploys to demo.cairnready.org)
├── site.config.json      generic identity, placeholder phone lines
├── <tool>/SITE CONFIG    national-guideline defaults, flagged "localize"
│
├─ hospital edition: LRH          (branch/fork — deploys to its own domain)
│    site.config.json rewritten   + per-tool SITE CONFIG values validated
└─ hospital edition: <site #2>    (same pathway — the proof it generalizes)
```

A **hospital edition** is a branch or fork of the trunk that changes only the
two localization layers below. It never rewrites logic, layout, or the verify
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
uses it and the citation for it. In the generic trunk these hold
national-guideline defaults or clearly flagged placeholders. **Every one of
them requires local clinical validation before a hospital edition goes
live** — see `LOCALIZING.md` and `LOCALIZATION-WORKSHEET.md` for the walk-
through, and `inventory.js` for the third localized surface (the `LOCATIONS`
block — the only part of the inventory a hospital rewrites; the trunk ships
the original pilot site's layout as a worked example).

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
