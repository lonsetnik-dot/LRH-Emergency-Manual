# Localizing this manual for your own hospital

This project started as Littleton Regional Healthcare's (LRH) emergency manual and
is now the **CairnReady generic trunk** (cairnready.org) — built to be **forked
and adapted by any emergency department**: your copy, your hosting, your
content, your clinical validation. This guide is the map of *what* is
site-specific, *where* it lives, and *how* to make it yours. The architecture
of trunk vs. hospital editions is in `SITES.md`.

**Start with `site.config.json`.** Identity (manual title, hospital line,
domain, transfer-center name/phone, poison line) now lives in one root file,
substituted into every page at build as `{{SITE.*}}` tokens. Editing that one
file puts your hospital's name on every page. The rest of this guide covers
the second layer: the per-tool SITE CONFIG blocks holding clinical values.

> **This is a living target.** Isolating every local value into one obvious place
> is an explicit goal, and it is **partly done, not finished** — see
> [Current state](#current-state-and-how-you-can-help) at the end for an honest
> accounting of what's consolidated and what's still scattered. Related work:
> GitHub issue #48 (Localization pathway).

---

## The one principle

> **Separate the engine from local truth.** (PROJECT.md, principle P1.)

The *universal* clinical logic — the HEART-score math, the arrest cycle, the
pathway structure — is generic and shared. The *local* values — your hospital's
name, colors, phone numbers, troponin cutoff, assay names, cart layout — are
meant to live in clearly-marked blocks you edit, without rewriting any logic.

Every tool that follows the convention marks its local block like this:

```js
/* ===== SITE CONFIG (site-specific — edit to localize) ===== */
```

Find those blocks (Claude can list them all instantly), change the values, and
the tool adapts. You should not have to touch the code around them.

---

## The seven things that are site-specific

Here is everything an adopting ED changes, and where it currently lives.

### 1. Hospital identity — name, abbreviation, domain
Strings like **"LRH"**, **"Littleton Regional Healthcare"**, and the
`lrhemergencymanual.net` domain.
*Where:* referenced across many tool files (today this is the **least
consolidated** value — e.g. "LRH" appears dozens of times in `codes/index.html`).
Consolidating this into one config string per tool is active cleanup work.

### 2. Colors and branding
The whole color scheme is moving into **CSS design tokens** — named variables in
a `:root { }` block at the top of a file — so re-skinning is editing a short list,
not hunting through thousands of color codes.
*Where:* `:root` token blocks in `index.html`, `labels/`, `system/`,
`clinical-pathways/` (incl. `heart/`), `arrest/`, `airway/`; poster accents in
each poster's SITE CONFIG block. The token names follow `DESIGN-SYSTEM.md`
(`--d1`…`--d6` for cart drawers, semantic `--danger/--caution/--safe/--info`,
plus brand/accent). **Color encodes *where* on a cart — never severity** — so
when you re-skin, keep that rule (DESIGN-SYSTEM.md §2).
*Status:* token migration is partial — several tools still carry inline colors.

### 3. Phone numbers
Transfer center, poison control, blood bank, etc. LRH's current set includes the
DHMC transfer number and poison-control line (e.g. `(877) 999-9870`,
`800-992-9399`).
*Where:* inside SITE CONFIG blocks and clinical content; Claude can list every
number and its context so you can swap the whole set at once.

### 4. Clinical thresholds and assay-specific values
Troponin cutoff and assay name, drug concentrations, energy settings, weight
cutoffs — anything that is **true for LRH's equipment and protocols but not
universally.** These are the values PROJECT.md's P1 is most about.
*Where:* the SITE CONFIG block of each tool (e.g. `arrest/index.html`,
`clinical-pathways/heart/`, `peds/`, `ob-neonatal/`, `procedures/`).
**These require local clinical validation before you go live — see below.**

### 5. Cart, drawer, and kit layout
Which drawer holds what, drawer colors/numbers, kit contents and PAR levels, the
room/cabinet map.
*Where:* `labels/` (drawer faces, stock strips, kit cards), `system/` (the
generated system map). Governed by `DESIGN-SYSTEM.md`. Your physical carts will
differ from LRH's — this is expected local work, not a code change.

### 6. Wording and dialect
LRH writes in **US medical English** (epinephrine, not adrenaline; albuterol, not
salbutamol). A fork in another dialect region reverts using the documented map.
*Where:* `TERMINOLOGY.md` records every alias and what's exempt (direct quotes,
proper names, program titles).

### 7. Version and review stamps
Each tool carries a version number and a "last reviewed" date. When *you* review
and adapt a tool, these become **your** dates and **your** sign-off — not LRH's.
*Where:* the footer/stamp of each tool.

---

## Steps to stand up your own copy

None of these require you to be a developer; an AI assistant like Claude can do
each mechanical step for you.

1. **Fork** `github.com/lonsetnik-dot/LRH-Emergency-Manual` into your own GitHub
   account. (This gives you an independent copy with its own history.)
2. **Connect Netlify** (or any static host) to your fork. Netlify auto-publishes
   your `main` branch to a URL you control. The repo is plain static HTML — there
   is no build step and no server.
3. **Work through the seven categories above**, tool by tool, editing the SITE
   CONFIG blocks and design tokens. Do this on a branch, not directly on `main`.
4. **Validate every clinical value locally.** This is the non-negotiable part:
   every threshold, dose, and protocol must be checked against *your* assays,
   *your* formulary, and *your* medical direction. The manual is a cognitive aid,
   not a source of truth you inherit unverified.
5. **Run the tests** (`bash run-tests.sh`, or let the included CI do it on your
   pull requests) so structural breakage is caught automatically.
6. **Re-stamp** each adapted tool with your version and review date, and put your
   institution's disclaimer in place.

---

## Legal and clinical posture (read before going live)

From PROJECT.md §7, and it applies fully to any fork:

- This is a **cognitive aid**, not part of any hospital EHR/IT system, **not a
  substitute for clinical judgment, and not FDA-cleared.**
- **Each adopting site is responsible for validating all content** against its own
  protocols, assays, formulary, and equipment.
- The project holds **no patient data** by design (PROJECT.md P3) — keep it that
  way; never add anything that stores or transmits PHI.
- Confirm licensing and medical-legal posture with your own counsel and medical
  direction before wide release.

---

## Current state, and how you can help

Honest accounting, so you know what you're adopting:

- **Consolidated:** most tools have a marked SITE CONFIG block; colors are moving
  into named design tokens; terminology is documented in `TERMINOLOGY.md`; the
  test suite runs automatically on every change.
- **Not yet consolidated:** the hospital name/abbreviation is still repeated
  throughout several tools rather than set once; the color-token migration
  doesn't cover every tool yet; phone numbers and some thresholds live in more
  than one spot.
- **The goal:** one obvious place per site-specific value, per tool — so a fork is
  "edit this block," never "hunt through the file." Progress toward that is
  tracked in issue #48, and every improvement to it makes the next hospital's
  adoption easier.

If you fork this and hit a value that was hard to find, that's a bug in the
localization surface — please open an issue. Making adoption effortless *is* the
mission.
