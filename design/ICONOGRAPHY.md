# LRH Emergency Manual — Procedure Iconography

Companion to `DESIGN_LANGUAGE.md`. Reference implementation: `LRH Procedure Iconography.dc.html` (open in a browser; all figures are inline SVG paths in the logic class — extract them verbatim).

## The grammar (four rules)

1. **Anatomy in ink, action in red.** The body is neutral strokes (`--ink` primary anatomy, `--ink2` secondary landmarks/labels); the ONE red element (`--red`) is what you do — the cut, the tube, the band. Never more than one red idea per figure.
2. **Same base, honest difference.** Related procedures share a base drawing and differ only by their key idea:
   - Chest tube / pigtail / thoracotomy share the **rib base** (ribs numbered 3–6, dashed triangle of safety)
   - CVC / Cordis share the **neck base** (patient's right IJ, mid-neck entry) — thin triple lumen vs one thick central + two thin side ports
   - RSI / SALAD share the **burr-hole face** (sagittal profile: nose, open mouth, tongue, short esophagus line below tongue level)
   - JADA / hysterotomy share the **uterus base**
3. **Glyph = one landmark + one action.** Two tiers from the SAME drawing:
   - **Glyph** (48×48 viewBox): cards, door labels, small chrome. Must survive 16px.
   - **Detail figure** (160×116 viewBox): posters, procedure checklists. Adds dashed landmarks, small mono labels (ribs, zones, ESOPH, STERNUM), plus an HTML caption line below — never a different drawing.
4. **Construction:** 2.2 stroke (2 for detail anatomy), round caps/joins, `fill="none"`, nothing filled except action tips (small red dots). Dashed = under the skin, landmark, or "the thing that follows" (SALAD's ETT).

## Colors (CSS variables, both themes work automatically)
- `--ink` primary anatomy: #EAF0F7 dark / #141E2B light
- `--ink2` landmarks + labels: #8FA0B5 dark / #5A6A7D light
- `--red` the action: #E5484D dark / #C63238 light
- Labels: JetBrains Mono 700, 6.5px in the 160-grid, letter-spacing .08em

## Anatomical decisions locked in review (do not regress)
- **Thoracotomy**: LEFT chest, sternum with costal margin on the figure's left, incision ABOVE rib 5, ribs numbered
- **Chest tube / pigtail**: enter from BOTTOM-lateral going up; under-skin portion dashed; chest tube thick (5.5/4.6 stroke), pigtail thin with dashed coil; both show triangle of safety
- **Burr hole**: ear opens backward; sites 1 temporal / 2 frontal / 3 parietal; "measure depth and location by CT" — never "fixed pupil side"
- **CVC / Cordis**: patient's RIGHT IJ, entry mid-neck, catheter runs deep toward the clavicle; CVC = 3 long thin lumens off the skin entry; Cordis = 1 thick central + 2 thin side ports
- **Pelvic binder**: AP-X-ray pelvis (iliac wings, brim, obturator ring, femoral heads); binder is RECTANGULAR with a central Z-lacing cable; centered on trochanters, crest crossed out
- **Tourniquet**: wide rectangular device with windlass, DISTAL laceration marked ✕
- **Junctional**: axilla target — thorax (double-width, rib hints) + shoulder + abducted arm
- **FONA**: trachea side-on, ETT curving IN the trachea via cricothyroid membrane
- **RSI / SALAD**: burr-hole face; tube behind the tongue; SALAD = solid suction leads (1) + dashed ETT follows (2) + secretion dots; short ESOPH line ends below tongue level
- **Penetrating neck**: left un-iconed at first review, later requested and wired to `procedures/#c11` — neck silhouette, dashed zone lines I/II/III, one red wound mark (current teaching triages by hard/soft signs, not zone alone — the glyph does not pick a zone)

## Tweakable parameters
`mouthOpen` and `jawSize` (0–100, default 50) parametrize the RSI/SALAD profiles. For production, bake at 50/50 unless told otherwise.

## Integration notes
- Extract each figure as an inline SVG component keyed by procedure id; glyph + detail are separate exports from shared path constants.
- Glyphs: `viewBox="0 0 48 48"`. Details: `viewBox="0 0 160 116"` + caption text BELOW the SVG in HTML (10px mono, `--ink2`), not inside it.
- Cross-linked procedures (FONA, RSI, sedation, hysterotomy, UVC) get glyphs only; their detail lives with their home category.
