/* ===========================================================================
   procedure-icons.js — the LRH Emergency Manual PROCEDURE icon set (single
   source). Companion to equipment-icons.js, and deliberately a different
   system: that file draws THINGS (what you pull out of a drawer), this one
   draws ANATOMY + AN ACTION (what you are about to do to a patient).

   Injected by build.mjs wherever a tool's <script> contains the marker
   (slash-star) @proc-icons (star-slash), so deployed tools stay fully
   self-contained and offline (CLAUDE.md rule 1). Edit a figure ONCE here.

   Source: design/ICONOGRAPHY.md + the reviewed prototype `design/LRH_Procedure_Iconography.dc.html`. Path data is transcribed VERBATIM from that prototype
   — the anatomical decisions in it were settled in review and are listed in
   design/ICONOGRAPHY.md under "do not regress". Do not redraw from memory.

   THE GRAMMAR (four rules — design/ICONOGRAPHY.md §1):
   1. Anatomy in ink, action in red. Body = currentColor / --ink2; the ONE red
      element is what you do — the cut, the tube, the band. Never more than one
      red idea per figure.
   2. Same base, honest difference. Related procedures share a base drawing and
      differ only by their key idea: chest tube / pigtail / thoracotomy share
      the rib base; CVC / Cordis share the neck base; RSI / SALAD share the
      face; JADA / hysterotomy share the uterus.
   3. Glyph = one landmark + one action. TWO TIERS FROM THE SAME DRAWING —
      never a different drawing:
        glyph()  0 0 48 48    cards, labels, small chrome. Must survive 16px.
        detail() 0 0 160 116  posters, procedure checklists. Adds dashed
                              landmarks and mono labels, plus an HTML caption
                              line BELOW the svg (not inside it).
   4. Construction: 2.2 stroke (2 for detail anatomy), round caps/joins,
      fill:none, nothing filled except action tips (small red dots). Dashed =
      under the skin, a landmark, or "the thing that follows" (SALAD's ETT).

   COLOR comes from the page's own tokens, so both themes work automatically
   and print keeps the anatomy black: currentColor for primary anatomy,
   var(--ink2) for landmarks/labels, var(--red) for the action.

   mouthOpen / jawSize parametrized the RSI + SALAD profiles in the prototype.
   Per design/ICONOGRAPHY.md §"Tweakable parameters" they are BAKED AT 50/50 here:
     glyph  gap=5    jx=2    jy=1.5
     detail dgap=11  djx=4.5 djy=3.5
   =========================================================================== */
var PROC_ICONS = (function () {
  "use strict";

  /* ---- builders (verbatim from the prototype's logic class) ---- */
  function ink(d, w, dash) { return '<path d="' + d + '" stroke="currentColor" stroke-width="' + (w || 2.2) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
  function ink2(d, w, dash) { return '<path d="' + d + '" style="stroke:var(--ink2)" stroke-width="' + (w || 1.6) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
  function red(d, w, dash) { return '<path d="' + d + '" style="stroke:var(--red)" stroke-width="' + (w || 2.6) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
  function rc(cx, cy, r, w) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="stroke:var(--red)" stroke-width="' + (w || 2.6) + '"/>'; }
  function rdot(cx, cy, r) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="fill:var(--red)" stroke="none"/>'; }
  function ic(cx, cy, r, w) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="currentColor" stroke-width="' + (w || 2.2) + '"/>'; }
  function txt(x, y, s, anchor) { return '<text x="' + x + '" y="' + y + '" style="fill:var(--ink2);font:700 6.5px JetBrains Mono,ui-monospace,monospace;letter-spacing:.08em" text-anchor="' + (anchor || 'start') + '">' + s + '</text>'; }

  /* ---- GLYPHS · 0 0 48 48 ---- */
  var G = {};
  var ribs = ink('M5 16 Q24 9 43 16') + ink('M5 27 Q24 20 43 27') + ink('M5 38 Q24 31 43 38');
  G.chest = ribs + red('M45 45 L31 31', 4.6) + red('M31 31 L18 18', 4, '4 3');
  G.pigtail = ribs + red('M45 45 L33 33', 2) + red('M33 33 L27 27', 2, '3.5 3') + red('M27 27 Q21 22 25 17 Q29 12 32 18 Q33 22 28 21', 2, '3.5 3');
  G.thora = ink('M12 16 Q28 8 44 16') + ink('M12 27 Q28 19 44 27') + ink('M12 38 Q28 30 44 38') + ink2('M5 5 L5 26 Q5 34 11 38', 2.2) + ink2('M5 12 L12 15 M5 22 L12 26', 1.5) + red('M14 33 Q28 25 42 33', 3);
  G.burr = ink('M42 26 Q42 5 25 5 Q9 5 9 20 L9 24 L5 30 L9 31 L9 36 Q9 40 15 40 L18 40 L18 44') + ink('M33 27 Q36 29 33 32') + rc(30, 20, 3.6, 2.2) + rc(18, 12, 3.6, 2.2) + rc(38, 12, 3.6, 2.2);
  G.canth = ink('M6 24 Q24 8 42 24 Q24 40 6 24 Z') + ic(24, 24, 5) + red('M40 24 L46 19') + red('M40 24 L46 29');
  var neckBase = ink('M34 5 Q28 8 28 14 L28 21') + ink('M16 5 L16 21 Q16 27 10 30') + ink('M4 33 Q24 26 44 33');
  G.cvc = neckBase + red('M20 15 L27 27 Q28 31 25 33', 2.4) + red('M20 15 L9 5', 1.8) + red('M20 15 L15 3', 1.8) + red('M20 15 L22 2', 1.8);
  G.cordis = neckBase + red('M20 15 L28 29', 5.5) + red('M20 15 L11 3', 3.2) + red('M17 11 L8 9', 1.8) + red('M14 7 L18 2', 1.8);
  G.tvp = ink('M24 43 C8 31 6 18 14 12 C19 8 24 12 24 17 C24 12 29 8 34 12 C42 18 40 31 24 43 Z') + ink2('M3 9 L7 9 L9 4 L11 13 L13 9 L17 9', 1.8) + red('M30 3 Q27 12 25 18 Q24 22 21 26', 2.2) + rdot(20.5, 27.5, 2.2);
  G.eschar = ink('M16 4 Q13 24 15 44') + ink('M32 4 Q35 24 33 44') + red('M24 7 Q23 24 24 41', 2.6, '6 4.5');
  G.binder = ink('M13 5 Q6 12 10 20 L16 25') + ink('M35 5 Q42 12 38 20 L32 25') + ic(14, 28, 4) + ic(34, 28, 4) + ink('M12 31 L9 42 M36 31 L39 42') + red('M4 24 L44 24 L44 38 L4 38 Z', 2.4) + red('M18 27 L30 27 L18 31 L30 31 L18 35 L30 35', 1.8);
  G.tq = ink('M18 4 Q16 24 18 44') + ink('M32 4 Q34 24 32 44') + ink2('M22 34 L28 40 M28 34 L22 40', 2) + red('M13 14 L37 14 L37 24 L13 24 Z', 2.6) + red('M25 19 L44 11', 3) + rdot(44, 11, 2.2);
  G.neck = ink('M14 6 Q25 2 36 6') + ink('M18 6 L18 44') + ink('M32 6 L32 44') + ink2('M18 17 L32 17', 1.6, '3 3') + ink2('M18 31 L32 31', 1.6, '3 3') + red('M4 22 L16 25') + red('M16 25 L11 21') + red('M16 25 L11 29');
  G.junc = ink('M8 44 L8 16 Q8 9 15 7 L20 6') + ink('M20 6 Q28 1 35 6 L45 13') + ink('M27 19 Q33 16 39 20 L45 25') + ink('M36 26 Q34 34 35 44') + rc(24, 21, 5.5) + rdot(24, 21, 1.8);
  G.jada = ink('M15 11 Q24 3 33 11 Q41 20 33 30 Q28 36 26 40 L22 40 Q20 36 15 30 Q7 20 15 11 Z') + red('M24 45 L24 25', 2.4) + rc(24, 20, 4.5, 2.4);

  /* RSI + SALAD share this face; gap/jx/jy baked at 50/50 (see header). */
  var face = ink('M42 26 Q42 5 25 5 Q9 5 9 20 L9 24 L5 30 L9 31 Q11 32 9 33', 2.2)
    + ink('M33 27 Q36 29 33 32')
    + ink('M42 26 Q42 36 38 46', 2.2)
    + ink('M8 38 Q8 40.5 14 39.5 L18.4 39.5 L18.4 46', 2.2)
    + ink('M10.2 38 Q17 33.5 22 38 Q24 40 21 40.5', 2)
    + ink('M35 38 L35 46', 2);
  G.rsi = face + red('M2 29 Q14 26 21 32 Q26 36 26 46', 2.6);
  G.salad = face
    + '<circle cx="30" cy="41" r="1.6" style="fill:var(--ink2)" stroke="none"/><circle cx="31" cy="45" r="1.6" style="fill:var(--ink2)" stroke="none"/>'
    + red('M2 31 Q13 29 19 34 Q24 38 24 46', 2.4) + red('M24 46 L20 41', 2.4) + red('M24 46 L28 41', 2.4)
    + ink2('M2 26 Q15 23 23 30 Q28 34 28 46', 2, '4 3.5');

  /* cross-links — glyph only; their detail figure lives in their home category */
  G.fona = ink('M14 6 L14 42') + ink('M28 6 L28 42') + ink2('M14 12 L28 12 M14 34 L28 34 M14 41 L28 41', 1.5) + red('M44 6 Q36 10 31 17 Q25 25 23 34 L23 42', 2.8);
  G.sedation = ink('M8 20 L30 20 L30 30 L8 30 Z') + ink('M4 25 L8 25') + ink('M13 20 L13 30') + red('M30 25 L44 25', 2.4);
  G.hyst = ink('M15 11 Q24 3 33 11 Q41 20 33 30 Q28 36 26 40 L22 40 Q20 36 15 30 Q7 20 15 11 Z') + red('M24 13 L24 31', 2.8);
  G.uvc = ic(24, 24, 15) + ink2('M19 28 a2.5 2.5 0 1 0 .1 0', 1.6) + ink2('M29 28 a2.5 2.5 0 1 0 .1 0', 1.6) + ic(24, 19, 4) + red('M42 4 L27 17', 2.4);

  /* ---- DETAIL FIGURES · 0 0 160 116 ---- */
  var D = {};
  var ribBase = ink('M14 26 Q80 12 146 26', 2) + ink('M14 44 Q80 30 146 44', 2) + ink('M14 62 Q80 48 146 62', 2) + ink('M14 80 Q80 66 146 80', 2) + ink2('M8 14 L58 4', 1.6) + txt(8, 30, '3') + txt(8, 48, '4') + txt(8, 66, '5') + txt(8, 84, '6');
  D.chest = ribBase + ink2('M62 42 L108 42 L84 74 Z', 1.5, '4 3') + red('M150 106 L96 62', 5.5) + red('M96 62 L58 30', 4.6, '6 4');
  D.pigtail = ribBase + ink2('M62 42 L108 42 L84 74 Z', 1.5, '4 3') + red('M150 106 L100 64', 2.2) + red('M100 64 L82 48', 2, '5 4') + red('M82 48 Q70 38 78 30 Q86 22 92 32 Q95 40 84 38', 2, '5 4');
  D.thora = ink('M28 26 Q86 12 152 26', 2) + ink('M28 44 Q86 30 152 44', 2) + ink('M28 62 Q86 48 152 62', 2) + ink('M28 80 Q86 66 152 80', 2) + ink2('M14 12 L14 52 Q14 66 24 74 L30 79', 2.4) + ink2('M14 22 L30 25 M14 38 L29 42 M14 54 L28 59', 1.6) + txt(8, 8, 'STERNUM') + txt(156, 24, '3', 'end') + txt(156, 42, '4', 'end') + txt(156, 60, '5', 'end') + txt(156, 78, '6', 'end') + red('M38 58 Q94 44 148 58', 3.4);
  D.burr = ink('M132 60 Q136 22 100 12 Q56 2 40 28 L40 38 L28 52 L38 55 L38 66 Q38 74 50 74 L58 74 L58 92', 2) + ink('M64 34 L76 34', 2) + ink('M104 58 Q110 62 104 68', 2) + rc(96, 42, 7, 2.2) + rc(64, 20, 7, 2.2) + rc(112, 20, 7, 2.2) + txt(96, 45, '1', 'middle') + txt(64, 23, '2', 'middle') + txt(112, 23, '3', 'middle') + ink2('M96 49 L100 56', 1.4, '3 3');
  D.canth = ink('M22 55 Q80 17 138 55 Q80 93 22 55 Z', 2) + ic(80, 55, 13, 2) + red('M136 55 L152 44') + red('M136 55 L152 66') + red('M136 55 Q146 63 143 72', 2.2, '4 3');
  var neckD = ink('M116 10 Q104 18 104 32 L104 44', 2) + ink('M64 8 L64 40 Q64 50 52 56', 2) + ink('M18 74 Q80 58 142 74', 2) + ink2('M78 20 L72 58', 5, '0') + txt(84, 20, 'RIJ') + txt(12, 90, 'R');
  D.cvc = neckD + red('M75 36 L70 54 Q69 60 74 63', 2.6) + red('M75 36 L48 14', 2) + red('M75 36 L60 8', 2) + red('M75 36 L74 6', 2);
  D.cordis = neckD + red('M75 36 L70 56', 8) + red('M75 36 L56 12', 3.6) + red('M68 27 L50 24', 2) + red('M63 18 L66 4', 2);
  D.tvp = ink('M80 78 C48 56 44 30 60 20 C70 13 80 20 80 30 C80 20 90 13 100 20 C116 30 112 56 80 78 Z', 2) + red('M92 4 Q86 20 82 34 Q79 46 70 56', 2.2) + rdot(68, 58, 3) + ink2('M16 98 L52 98 L54 84 L56 98 L64 98 Q70 88 76 98 L96 98 L98 84 L100 98 L108 98 Q114 88 120 98 L146 98', 1.8);
  D.eschar = ink('M14 34 Q80 26 148 34', 2) + ink('M14 78 Q80 86 148 78', 2) + ink2('M40 44 L52 56 M62 42 L74 54 M86 42 L98 54 M110 44 L122 56', 1.4) + red('M22 57 Q84 57 142 57', 2.6, '8 6');
  D.binder = ink('M56 12 Q36 18 40 38 Q42 50 54 56 L62 60', 2) + ink('M104 12 Q124 18 120 38 Q118 50 106 56 L98 60', 2) + ink('M62 60 L64 50 Q66 42 74 42 L86 42 Q94 42 96 50 L98 60', 2) + ink('M70 60 Q74 68 80 68 Q86 68 90 60', 2) + ink('M70 60 L70 74 Q75 78 80 78 Q85 78 90 74 L90 60', 1.6) + ic(58, 64, 8, 2) + ic(102, 64, 8, 2) + ink('M54 70 L46 96 M106 70 L114 96', 2) + ink2('M36 20 L124 20', 1.5, '4 4') + txt(128, 23, '&#10005; CREST') + red('M24 52 L136 52 L136 78 L24 78 Z', 2.6) + red('M62 58 L98 58 L62 65 L98 65 L62 72 L98 72', 2);
  D.tq = ink('M14 34 Q80 26 150 32', 2) + ink('M14 80 Q80 88 150 82', 2) + ink2('M112 46 L124 62 M124 44 L112 64', 2.2) + red('M46 26 L74 26 L74 90 L46 90 Z', 3) + red('M60 22 L104 10', 3.4) + rdot(104, 10, 3.4) + txt(112, 78, 'LACERATION');
  D.junc = ink('M20 108 L20 32 Q20 20 32 16 L48 12', 2) + ink('M48 12 Q64 2 82 10 L128 34', 2) + ink('M66 40 Q80 34 94 42 L124 56', 2) + ink('M88 48 Q82 76 84 108', 2) + ink2('M26 64 Q48 60 78 64 M26 82 Q48 78 78 82', 1.6) + rc(58, 42, 13) + rdot(58, 42, 4) + txt(96, 18, 'ARM ABDUCTED') + txt(24, 102, 'THORAX');
  D.jada = ink('M55 22 Q80 8 105 22 Q124 42 105 62 Q92 74 88 84 L72 84 Q68 74 55 62 Q36 42 55 22 Z', 2) + ink('M72 84 L70 96 M88 84 L90 96', 2) + red('M80 104 L80 48', 2.6) + '<ellipse cx="80" cy="40" rx="13" ry="8" style="stroke:var(--red)" stroke-width="2.6"/>';
  /* dgap/djx/djy baked at 50/50 (see header) */
  D.salad = ink('M132 60 Q136 22 100 12 Q56 2 40 28 L40 38 L28 52 L38 55 Q41 58 38 60', 2)
    + ink('M104 58 Q110 62 104 68', 2)
    + ink('M132 60 Q131 80 118 92 L118 108', 2)
    + ink('M35.8 71 Q35.8 84 48.5 85.5 L57.1 85.5 L60 108', 2)
    + ink('M42.2 66.8 Q60 57.7 72 64.6 Q78 68.6 72 74.6 Q60 77.7 46.65 72.8', 2)
    + ink('M88 84 L88 108', 2)
    + txt(96, 88, 'ESOPH')
    + txt(30, 100, 'TONGUE')
    + '<circle cx="79" cy="92" r="2.4" style="fill:var(--ink2)" stroke="none"/><circle cx="77" cy="101" r="2.4" style="fill:var(--ink2)" stroke="none"/>'
    + red('M8 66 Q40 60 62 72 Q74 80 74 106', 2.8) + red('M74 106 L68 99', 2.8) + red('M74 106 L80 99', 2.8)
    + ink2('M12 56 Q48 48 70 62 Q82 70 82 106', 2.2, '5 4')
    + txt(4, 60, '1') + txt(4, 48, '2');

  /* ---- captions for the detail figures (HTML line BELOW the svg, §3) ---- */
  var CAP = {
    chest: 'TRIANGLE OF SAFETY · GO OVER THE RIB',
    pigtail: 'SELDINGER · TAIL COILS IN THE PLEURA',
    cvc: 'US-GUIDED · 45° · THIN TRIPLE LUMEN',
    cordis: '8.5 FR INTRODUCER · BUILT FOR VOLUME',
    /* the prototype also drew this line inside the svg, where it clipped;
       design/ICONOGRAPHY.md says the caption is HTML below the figure, so it lives
       only here now: */
    thora: 'PATIENT SUPINE · LEFT CHEST · INCISION ABOVE RIB 5 — EXTEND = CLAMSHELL',
    burr: '1 TEMPORAL · 2 FRONTAL · 3 PARIETAL — SITE & DEPTH BY CT',
    canth: 'CANTHOTOMY, THEN CUT THE INFERIOR CRUS',
    tvp: 'BALLOON TO RV · CAPTURE = SPIKE + WIDE QRS',
    eschar: 'FULL-THICKNESS · RELEASE TO FAT, MIDLATERAL',
    binder: 'AP VIEW · CENTER ON THE GREATER TROCHANTERS, NOT THE CREST',
    tq: 'PROXIMAL OF THE LACERATION · TWIST UNTIL IT STOPS',
    junc: 'AXILLA / GROIN · PACK & PRESS WHERE NO TQ FITS',
    jada: 'VACUUM → THE UTERUS CLAMPS DOWN',
    salad: 'NOSE → MOUTH → BEHIND THE TONGUE · 1 SUCTION LEADS · 2 TUBE FOLLOWS'
  };

  /* Which card each figure belongs to, so a consumer can bind by card id
     rather than by hand. Penetrating neck trauma (c11) is deliberately absent:
     design/ICONOGRAPHY.md removed that graphic in review. */
  var BY_CARD = {
    c01: 'chest', c02: 'thora', c04: 'burr', c05: 'canth', c06: 'cvc',
    c07: 'tvp', c08: 'eschar', c09: 'binder', c10: 'tq', c12: 'junc',
    c13: 'jada', c14: 'cordis', c15: 'salad', c16: 'pigtail'
  };

  /* A glyph sitting beside a title that already names the procedure is
     decorative: pass no label and it is hidden from assistive tech rather than
     announcing a key name. Pass a label and it becomes a labelled image. */
  function wrap(box, body, label, cls) {
    return '<svg viewBox="' + box + '" fill="none" stroke-linecap="round" stroke-linejoin="round"'
      + (cls ? ' class="' + cls + '"' : '')
      + (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true" focusable="false"')
      + '>' + body + '</svg>';
  }
  return {
    /* 48-grid glyph for cards, labels, chrome. Must survive 16px. */
    glyph: function (key, label) { return G[key] ? wrap('0 0 48 48', G[key], label, 'proc-glyph') : ''; },
    /* 160x116 detail figure for posters and checklists. */
    detail: function (key, label) { return D[key] ? wrap('0 0 160 116', D[key], label, 'proc-detail') : ''; },
    caption: function (key) { return CAP[key] || ''; },
    forCard: function (id) { return BY_CARD[id] || null; },
    keys: function () { return Object.keys(G); },
    detailKeys: function () { return Object.keys(D); },
    cards: function () { return BY_CARD; }
  };
})();
