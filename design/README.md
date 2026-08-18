# design/ — the design reference package

These are **references to build FROM, not pages the site ships.** `build.mjs`
skips this whole folder (`SKIP_DIRS`), so nothing here lands in `dist/` or in the
offline precache. Open the `.dc.html` prototypes in a browser with `support.js`
alongside them; read the `.md` files as the spec.

## Contents

| File | What it is |
|---|---|
| `DESIGN_LANGUAGE.md` | the site-wide system — tokens, two-row chrome, page types, print rules, migration order |
| `ICONOGRAPHY.md` | the procedure icon grammar and the anatomical decisions locked in review |
| `VF-VT-REDESIGN.md` | the VF/VT live-protocol screen spec (the package's own `README.md`, renamed so it doesn't collide with this one) |
| `LRH_Design_Language.dc.html` | prototype: home, category, card, tokens (DEMO row at the bottom switches views) |
| `LRH_Procedure_Iconography.dc.html` | prototype: every glyph and detail figure, with live `mouthOpen`/`jawSize` sliders |
| `VF_Cognitive_Aid.dc.html` | prototype: the full VF/VT screen, markup + state in one file |
| `support.js` | the `<x-dc>` runtime the prototypes need — a viewer shim, not production code |

## What is implemented in the repo, and what is not

**Iconography — done.** `procedure-icons.js` (root) is the production extraction:
20 glyphs and 14 detail figures transcribed verbatim from the prototype, with
`mouthOpen`/`jawSize` baked at 50/50 per the spec. It is injected at build
wherever a tool's `<script>` carries the `/* @proc-icons */` marker, the same way
`design-system.css`, `inventory.js` and `equipment-icons.js` are — so no tool
hand-maintains a copy and a card, a poster and a label cannot drift apart.
`verify_procedure_icons.mjs` asserts the grammar (one red idea, nothing filled,
shared bases still shared) against the rendered markup on real pages.

The penetrating-neck glyph exists in `procedure-icons.js` but is deliberately
**not** in the card map — `ICONOGRAPHY.md` removed that graphic in review. Do not
wire it up.

The **glyph** tier (48-grid) is placed: 14 procedure cards, plus RSI/FONA in
`codes/` and UVC/hysterotomy in `ob-neonatal/`. The **detail** tier (160-grid,
`PROC_ICONS.detail()` + `PROC_ICONS.caption()`) is built and correct but is not
placed anywhere yet. That is a content decision, not a wiring one: several
procedure cards already carry their own line-drawing figures, and whether a
detail figure replaces one, sits beside it, or belongs only on the poster has to
be answered card by card by someone who knows what each existing figure is
teaching.

**Tokens — already conformant.** The repo's `:root` values match the table in
`DESIGN_LANGUAGE.md` §1 exactly. Nothing to migrate.

**Not started.** The rest of `DESIGN_LANGUAGE.md` §8 is a staged migration and
none of it has been begun:

1. the two-row chrome (48px bar + chip strip) replacing the current header stack
2. home hub and category index presentation
3. the NAME / CLAIM / AIM strip and checklist accordions on cards
4. the VF/VT live-protocol rebuild per `VF-VT-REDESIGN.md`
5. retiring the old blue band and filled category tiles

Step 1 is the one with a trap in it, called out in the spec: the win comes from
*removing* rows. Adding the new bar while the old band, the breadcrumb line and
the standalone weight row all stay leaves the top of a phone screen worse than
it started.

Two standing repo rules apply to any of that work. Clinical content and dose
logic stay as the site has them — where a prototype's numbers differ from the
site's, the site wins (`DESIGN_LANGUAGE.md` says so too). And a live-protocol
page's local values come from its own config block, so a `verify_*.mjs` suite
reads that config rather than re-typing LRH's numbers (CLAUDE.md, issue #117).
