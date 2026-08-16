# CairnReady — Emergency Department Cognitive Aids

Static, client-side, offline-capable bedside decision-support tools for
emergency departments: resuscitation codes, rare procedures, OB/neonatal
emergencies, trauma, pediatric references, equipment readiness, drills, and
more. Launching at **cairnready.org**.

**This is the generic edition.** It is not localized to any hospital: identity
strings come from `site.config.json`, clinical values are national-guideline
defaults or clearly flagged placeholders, and every page carries a
"localize before clinical use" note. Nothing here replaces clinical judgment,
and nothing here is part of any hospital IT system / EHR.

## How the multi-site model works

See `SITES.md` for the full picture. In one paragraph: this repository is the
**generic trunk**. A hospital adopts it by making its own branch or fork and
then localizing two layers — `site.config.json` (name, domain, transfer/phone
lines; substituted into every page at build) and the marked
`SITE CONFIG` block at the top of each tool (clinical thresholds, assay names,
cart locations). The first two hospital editions (Littleton Regional Hospital,
plus a second pilot site) are the test cases for that pathway. The original
LRH-localized manual lives in this repository's history and at
`lrhemergencymanual.net` until its rebuilt edition ships.

## Structure

```
index.html            landing page + site search        ->  /
<tool>/index.html     one self-contained tool per folder ->  /<tool>/
site.config.json      site identity — the one file a hospital edits first
build.mjs             build: inject shared CSS/JS, substitute {{SITE.*}}, emit dist/
design-system*.css    shared design language, injected at build
inventory.js          equipment inventory (CATALOG+STANDARDS generic; LOCATIONS = example)
guidelines.js         upstream guideline registry (editions, review dates)
verify_*.mjs          the safety harness — run `bash run-tests.sh`
netlify.toml          Netlify config (builds with node build.mjs, publishes dist/)
```

Every tool is a single self-contained `index.html` in its own folder — inline
CSS/JS, no external dependencies, works offline (a generated service worker
precaches the whole site). Operating rules for contributors and AI assistants
are in `CLAUDE.md`; the reasoning behind them is in `PROJECT.md`.

## Develop

```
node build.mjs        # build dist/
bash run-tests.sh     # build + full verify suite against dist/
```

## Deploy

Connected to Netlify via continuous deployment: every push builds `dist/` and
publishes automatically. Git is the source of truth — no drag-and-drop deploys.
