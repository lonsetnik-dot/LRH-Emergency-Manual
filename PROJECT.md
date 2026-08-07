# ED Clinical Support — Project Charter

> Working name: **LRH Clinical Support Tools** (may become a general, forkable
> emergency-department cognitive-aid framework).

This is the human source of truth for *why* the project is built the way it is.
The operational rules Claude and contributors follow live in `CLAUDE.md`; this
document explains the thinking behind them. When in doubt, this file wins.

---

## 1. Mission

Build a set of fast, trustworthy, bedside decision-support tools for the
emergency department — starting with Littleton Regional Hospital (LRH) — in a
way that *could later* be adopted and customized by any ED, without a rewrite.

## 2. Vision & scope

**Now:** a clean, reliable manual of calculators and pathways for LRH, deployed
as a static website (GitHub → Netlify).

**Later (optional):** a template other EDs can fork and adapt by editing their
own local values — think "Stanford Emergency Manual, but forkable and
version-controlled." Each adopting site runs its *own* copy on its *own*
hosting and owns its *own* content and clinical validation.

**Explicit non-goals:**
- Not a patient-data system. It never stores, transmits, or processes PHI.
- Not a hosted multi-tenant service. Adoption is by fork, not sign-up.
- Not a replacement for clinical judgment, and not an FDA-cleared device.

## 3. Design principles (the "why")

**P1 — Separate the engine from local truth.**
Universal clinical logic (e.g. the HEART score math) is generic and shared.
Site-specific values (troponin cutoffs, assay names, colors, phone numbers, the
hospital name) are *isolated* in one obvious place per tool. This is the single
most important principle: it is what makes a later fork a matter of editing one
block instead of rewriting code.

**P2 — Uniform, self-contained tools.**
Every tool is one self-contained file in its own folder, using the same visual
skeleton and the same CSS variable names. Identical stationery, different
content. Uniformity is what lets a shared template be extracted later mechanically.

**P3 — Client-side only; on-device, PHI-free state.**
Tools run entirely in the browser and never send or receive patient data. They
may keep *ephemeral operational state* on the device (e.g. via localStorage) —
running timers, checklist progress, and an on-device case timeline of times and
events — but only if it carries no patient identifiers (no name, MRN, or DOB),
never leaves the device, and is cleared by a RESET control. No servers, no
analytics on inputs, no PHI, ever. This keeps the project clear of HIPAA and the
regulated-data tier. It is a hard rule, not a default.

**P4 — Transparent clinical logic.**
Every tool shows its criteria and the source of its thresholds. The clinician
can always see *why* a result was produced and independently review it. This is
good clinical practice and supports the "non-device decision support" posture.

**P5 — Keep a paper trail.**
Each tool carries a version number, a "last reviewed" date, the standard
disclaimer, and a citation for every clinical threshold. The repo carries a
license. These habits cost little now and are essential at any scale.

**P6 — Discoverable by design.**
A card that exists but can't be found under pressure is functionally
unfinished. Site search is a hand-maintained index (`SEARCH_INDEX` in the
landing page), not something that updates itself when a tool or card is
added — so registering a new card there, and sanity-checking its keywords
against existing entries, is part of *finishing* the card, not a follow-up.

**P7 — One dialect, documented aliases.**
Content is written in the deploying site's own English dialect — US medical
English for LRH — so a clinician's search terms, reading level, and drug
names match what's on screen without translation. A documented alias list
(`TERMINOLOGY.md`) records the mapping so a fork in another dialect region
can revert quickly instead of re-deriving it, and so a reviewer can tell a
deliberate proper-noun/citation exception from a missed localization.

## 4. Conventions (the "how")

- **One tool = one folder** containing `index.html` (e.g. `heart/index.html` →
  `/heart/`). The landing page is the only top-level `index.html`.
- **SITE CONFIG block:** every tool puts its LRH-specific values in a clearly
  marked block at the top of the file; the logic reads from it.
- **Shared skeleton:** reuse the same `:root` CSS variables (brand colors) and
  the same header + disclaimer markup across all tools.
- **Stamp every tool:** version, last-reviewed date, disclaimer, threshold
  sources.
- **Verify logic:** calculators are checked against boundary test cases before
  release.
- **Git is the source of truth:** deploy via GitHub → Netlify continuous
  deployment. Do not use Netlify drag-and-drop once Git is connected.
- **Search index registration:** every new tool, and every new card inside an
  existing tool, gets a `SEARCH_INDEX` entry in the landing page's
  `index.html` — checked for real-keyword hits and for confusing overlap with
  existing entries.
- **US English, documented aliases:** prose is written in US medical English;
  non-US spelling/drug-naming survives only inside direct quotes or real
  proper names. See `TERMINOLOGY.md`.

## 5. Repository structure

```
index.html                    landing page + site search index -> /
codes/index.html               Codes (arrest, stroke, RSI, STEMI...) -> /codes/
ob-neonatal/index.html         OB & Neonatal emergencies -> /ob-neonatal/
peds/index.html                Pediatric Emergencies -> /peds/
procedures/index.html          Rare, high-stakes procedures -> /procedures/
trauma/index.html              Trauma activation/resuscitation -> /trauma/
clinical-pathways/             Diagnostic pathways (e.g. Chest Pain/HEART)
posters/                       Printable one-page posters
debrief/index.html             Post-code/critical-event debrief -> /debrief/
<tool>/index.html              future tools -> /<tool>/
netlify.toml                   Netlify config (publishes repo root)
CLAUDE.md                      operating rules for AI assistants
PROJECT.md                     this charter
TERMINOLOGY.md                 US-English localization alias list
CASE-STATE.md                  cross-tool localStorage contract
LAYOUT.md                      shared touch-target sizing scaffold (.console)
README.md                      human overview
LICENSE                        (to add) code license, e.g. MIT or Apache-2.0
```

## 6. Roadmap (phased, no step forces rework of an earlier one)

1. **Build the LRH manual** following the conventions above. (Current phase.)
2. **Make it adoptable:** mark the repo as a GitHub *template*, write a
   "deploy your own" guide, turn on Issues/Discussions with templates.
3. **Content-driven:** move tool content into Markdown/YAML behind a static site
   generator so non-coders can contribute.
4. **Community & governance:** co-maintainers, clinical review panel,
   contribution guide, roadmap board.

## 7. Legal & clinical posture

*Not legal advice — confirm with a health-law attorney and your medical
direction before wide release.*

- **Disclaimer everywhere:** personal/unofficial aid, not part of any hospital
  IT/EHR, not a substitute for clinical judgment, not FDA-cleared. Each site is
  responsible for validating content against its own protocols and assays.
- **PHI-free by design** (see P3) keeps HIPAA out of scope.
- **Transparent CDS** (see P4) supports the clinician-independent-review posture
  that keeps non-autonomous decision support outside medical-device regulation —
  to be confirmed with counsel as it grows.
- **Licensing:** plan for a permissive code license (MIT / Apache-2.0, both with
  an "AS IS, no warranty" clause) and, if clinical prose is shared, a separate
  content license (e.g. CC-BY).
- **Sourcing:** clinical content must be original or from openly-licensed /
  primary sources with citations. Do not copy copyrighted manuals.

## 8. Governance (for when others join)

- Maintained by volunteers on a best-effort basis; set that expectation openly.
- Protect the default branch; changes land via reviewed pull requests.
- Use issue/PR templates so reports and contributions arrive actionable.
- Recruit co-maintainers and a small clinical review panel early.

---

*Maintainer: Lon (LRH, Emergency Medicine). This is a personal passion project,
not an official LRH product.*
