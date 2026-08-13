/* ===========================================================================
   equipment-icons.js — the {{site.hospitalShort}} Emergency Manual equipment icon set (single
   source).

   Injected by build.mjs wherever a tool's <script> contains the marker
   (slash-star) @icons (star-slash), so deployed tools stay fully self-contained
   and offline (CLAUDE.md rule 1). Edit an icon ONCE here.

   WHY THIS IS SHARED, not copied (issue #131): these glyphs are what a
   clinician has already learned to recognize from the CART DRAWER LABELS. The
   VEMS kit hands people laminated equipment cards representing the same items,
   and a card whose picture does not match the drawer it comes out of teaches
   the wrong association — the opposite of what a drill is for. Sharing the file
   makes that match structural instead of a thing someone has to remember.

   Consumers: labels/ (cart + cabinet labels), vems/ (simulation card deck).

   DRAWING RULES (from DESIGN-SYSTEM.md section 3, learned the hard way):
   - viewBox is always 0 0 100 100; every icon fills that box.
   - Solid black silhouettes (#111), white only for cut-outs and detail. These
     print on a mono laser printer and stay legible laminated, at arm's length,
     under bad light.
   - Two items that are clinically different must not share a silhouette. See
     the `blakemore` and `blocker` comments below for the case that taught us.
   =========================================================================== */
var I = {
 ett:'<path d="M20 74 C14 44 36 18 72 13" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/>'+
     '<rect x="8" y="64" width="19" height="17" rx="4" fill="#111"/>'+
     '<ellipse cx="60" cy="17" rx="13.5" ry="9.5" transform="rotate(-13 60 17)" fill="#111"/>'+
     '<path d="M33 40 L50 49" fill="none" stroke="#111" stroke-width="2.6"/><ellipse cx="55" cy="51" rx="7.5" ry="5.5" fill="#111"/>'+
     '<path d="M10 91 C40 91 64 87 84 80" fill="none" stroke="#111" stroke-width="5.5" stroke-linecap="round"/>'+
     '<path d="M84 80 L95 72" fill="none" stroke="#111" stroke-width="5.5" stroke-linecap="round"/>',
 airway:'<g fill="none" stroke="#111" stroke-width="11" stroke-linecap="round"><path d="M20 22 C46 22 50 42 46 60 C43 74 32 82 22 84"/></g>'+
     '<rect x="10" y="14" width="20" height="13" rx="4" fill="#111"/>'+
     '<g fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"><path d="M66 20 C88 30 90 58 74 82"/></g>'+
     '<ellipse cx="65" cy="18" rx="11" ry="7" fill="#111"/>',
 etco2:'<rect x="6" y="22" width="88" height="56" rx="6" fill="#111"/>'+
     '<path d="M14 68 L24 68 L26 38 L40 38 L42 68 L50 68 L52 38 L66 38 L68 68 L76 68 L78 38 L90 38" fill="none" stroke="#fff" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>',
 vl:'<rect x="30" y="8" width="34" height="26" rx="4" fill="#111"/><rect x="35" y="13" width="24" height="16" rx="2" fill="#fff"/>'+
     '<rect x="38" y="34" width="18" height="30" rx="4" fill="#111"/>'+
     '<path d="M40 62 C40 78 54 88 76 88 L88 88" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round"/><circle cx="52" cy="70" r="4.5" fill="#fff"/>',
 dl:'<rect x="22" y="8" width="20" height="42" rx="5" fill="#111"/>'+
     '<g fill="#fff"><rect x="26" y="15" width="12" height="3"/><rect x="26" y="23" width="12" height="3"/><rect x="26" y="31" width="12" height="3"/></g>'+
     '<path d="M24 50 C24 72 44 86 78 86 L92 86" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/><circle cx="70" cy="80" r="5" fill="#fff"/>',
 igel:'<path d="M60 12 C82 20 90 44 78 62 C70 74 56 76 48 68 C40 60 42 42 52 28 Z" fill="#111"/>'+
     '<path d="M50 66 C40 78 28 84 12 86" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/>'+
     '<rect x="4" y="78" width="14" height="17" rx="4" fill="#111"/><path d="M62 26 C74 34 78 48 71 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
 ezio:'<path d="M8 66 h84 v16 H8 z" fill="#111"/><path d="M8 66 C26 60 40 60 50 60 C60 60 74 60 92 66" fill="#111"/>'+
     '<rect x="44" y="10" width="13" height="34" rx="3" fill="#111"/><rect x="47.5" y="44" width="6" height="20" fill="#111"/>'+
     '<path d="M34 22 h10 M34 30 h10" stroke="#111" stroke-width="4" stroke-linecap="round"/>',
 jet:'<path d="M14 78 C34 62 52 46 88 22" fill="none" stroke="#111" stroke-width="10" stroke-linecap="round"/>'+
     '<circle cx="90" cy="20" r="9" fill="#111"/><path d="M22 44 l14 6 M28 30 l12 10" stroke="#111" stroke-width="5" stroke-linecap="round"/>',
 fona:'<g fill="#e9ecef" stroke="#111" stroke-width="3.5"><rect x="24" y="10" width="52" height="12" rx="6"/>'+
     '<path d="M24 26 h52 v22 h-52 z"/><rect x="24" y="66" width="52" height="14" rx="6"/><rect x="30" y="84" width="40" height="9" rx="4.5"/></g>'+
     '<path d="M42 26 L50 38 L58 26" fill="none" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/><rect x="24" y="50" width="52" height="14" fill="#111"/>',
 meds:'<g fill="#111"><rect x="12" y="18" width="7" height="10" rx="2"/><path d="M9 28h13v46a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/>'+
     '<rect x="30" y="18" width="7" height="10" rx="2"/><path d="M27 28h13v46a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/>'+
     '<rect x="50" y="44" width="34" height="17" rx="3"/><rect x="84" y="49" width="9" height="7"/><rect x="93" y="51" width="6" height="3"/><rect x="44" y="47" width="6" height="11" rx="2"/></g>'+
     '<g fill="#fff"><rect x="11" y="56" width="9" height="20"/><rect x="29" y="62" width="9" height="14"/></g>',
 magnet:'<rect x="18" y="58" width="46" height="30" rx="7" fill="#e9ecef" stroke="#111" stroke-width="3.5"/>'+
     '<path d="M64 66 C80 60 88 50 90 36" fill="none" stroke="#111" stroke-width="4"/><circle cx="46" cy="34" r="25" fill="#111"/><circle cx="46" cy="34" r="10" fill="#fff"/>',
 iv:'<g fill="#111"><rect x="10" y="39" width="14" height="24" rx="4"/><rect x="24" y="44" width="42" height="14" rx="4"/>'+
     '<rect x="66" y="48" width="30" height="6" rx="3"/><path d="M34 44 L24 24 L48 36 Z"/><path d="M34 58 L24 78 L48 66 Z"/></g>',
 fluid:'<g fill="#111"><rect x="45" y="4" width="10" height="12" rx="3"/>'+
     '<path d="M30 16 h40 a5 5 0 0 1 5 5 v36 a13 13 0 0 1 -13 13 h-24 a13 13 0 0 1 -13 -13 v-36 a5 5 0 0 1 5 -5 z"/>'+
     '<rect x="46" y="70" width="8" height="12"/><circle cx="50" cy="90" r="7"/></g>'+
     '<g fill="#fff"><rect x="34" y="24" width="32" height="4" rx="2"/><rect x="34" y="34" width="22" height="4" rx="2"/></g>',
 scalpel:'<path d="M8 72 L56 36 C63 31 70 36 67 44 L61 60 Z" fill="#111"/>'+
     '<rect x="58" y="50" width="36" height="12" rx="6" transform="rotate(-17 58 50)" fill="#111"/>',
 needle:'<g fill="#111"><rect x="14" y="42" width="46" height="18" rx="3"/><rect x="60" y="47" width="12" height="8"/>'+
     '<rect x="72" y="49" width="24" height="4" rx="2"/><rect x="4" y="45" width="12" height="12" rx="3"/></g>'+
     '<g fill="#fff"><rect x="24" y="45" width="3" height="12"/><rect x="34" y="45" width="3" height="12"/><rect x="44" y="45" width="3" height="12"/></g>',
 ngt:'<path d="M50 10 C24 26 22 56 34 76 C42 90 58 94 72 88" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round"/>'+
     '<circle cx="76" cy="86" r="9" fill="#111"/><path d="M40 34 h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
 hemo:'<path d="M50 6 C50 6 81 39 81 58 C81 75 67 88 50 88 C33 88 19 75 19 58 C19 39 50 6 50 6 Z" fill="#111"/>',
 /* balloon-tamponade tube. Deliberately NOT a variant of `ngt` above: a plain curved tube and a
    tube-with-balloons read the same at 2 m, which is exactly the failure DESIGN-SYSTEM.md section 3
    warns about. Straight shaft + two clearly different balloon shapes (elongated esophageal above,
    round gastric below) so the silhouette is unmistakable in greyscale. Same idea as the card 23
    menu glyph and the Blakemore poster FIG 1. */
 blakemore:'<path d="M50 4 V96" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>'+
     '<ellipse cx="50" cy="36" rx="15" ry="23" fill="#111"/><circle cx="50" cy="78" r="17" fill="#111"/>',
 /* bronchial blocker: a tube that FORKS, so it cannot be mistaken for the single-lumen `ett`
    or the balloon tube above. The inflated cuff sits on one limb only - that IS the idea. */
 blocker:'<path d="M50 6 V44 M50 44 L28 92 M50 44 L72 92" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'+
     '<ellipse cx="66" cy="72" rx="13" ry="10" fill="#111"/>',
 /* nose in profile - unmistakable at 2 m and shares nothing with any other glyph on the door */
 nose:'<path d="M62 8 C44 26 38 46 38 60 L38 74 C38 82 46 88 58 88 L78 88" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'+
     '<circle cx="50" cy="72" r="6" fill="#111"/>',
 /* rigid suction catheter: angled tip + flare. Distinct from `ett` (smooth curve) by design. */
 suction:'<path d="M20 88 L20 40 C20 22 34 12 52 12 L74 12" fill="none" stroke="#111" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'+
     '<path d="M68 4 L92 12 L68 20 Z" fill="#111"/>',
 /* transvenous pacing wire: balloon at the tip plus depth bands. Shares nothing with `blakemore`
    (two balloons, straight) or `ngt` (plain curve) at two metres, which is the whole test. */
 pacer:'<path d="M18 88 C18 50 34 22 62 14" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>'+
     '<ellipse cx="70" cy="12" rx="13" ry="9" fill="#111"/>'+
     '<path d="M24 70 h14 M30 54 h14 M40 40 h14" stroke="#111" stroke-width="5" stroke-linecap="round"/>',
 tourniquet:'<circle cx="50" cy="50" r="34" fill="none" stroke="#111" stroke-width="13"/>'+
     '<rect x="42" y="4" width="16" height="28" rx="5" fill="#111"/><rect x="20" y="42" width="60" height="16" rx="8" fill="#fff"/>'+
     '<rect x="24" y="44" width="52" height="12" rx="6" fill="#111"/>',
 ppe:'<path d="M18 34 L38 20 L50 28 L62 20 L82 34 L76 56 L68 52 L68 86 H32 V52 L24 56 Z" fill="#111"/>'+
     '<rect x="34" y="44" width="32" height="18" rx="4" fill="#fff"/>',
 lp:'<path d="M50 8 C46 26 46 40 50 56 C54 72 54 82 50 94" fill="none" stroke="#111" stroke-width="8"/>'+
     '<g fill="#111"><circle cx="34" cy="22" r="7"/><circle cx="34" cy="42" r="7"/><circle cx="34" cy="62" r="7"/><circle cx="34" cy="82" r="7"/></g>'+
     '<rect x="60" y="46" width="34" height="7" rx="3" fill="#111"/><rect x="90" y="42" width="8" height="15" rx="3" fill="#111"/>',
 chest:'<path d="M18 26 C40 16 60 16 82 26 L76 78 C60 88 40 88 24 78 Z" fill="#e9ecef" stroke="#111" stroke-width="3.5"/>'+
     '<path d="M30 40 C46 34 58 34 72 40" fill="none" stroke="#111" stroke-width="3"/>'+
     '<circle cx="62" cy="56" r="9" fill="#111"/><path d="M62 56 L96 44" stroke="#111" stroke-width="7" stroke-linecap="round"/>',
 burr:'<path d="M50 12 C74 12 88 30 88 50 C88 72 72 88 50 88 C28 88 12 72 12 50 C12 30 26 12 50 12 Z" fill="#e9ecef" stroke="#111" stroke-width="3.5"/>'+
     '<circle cx="62" cy="40" r="11" fill="#111"/><circle cx="34" cy="34" r="7" fill="none" stroke="#111" stroke-width="3.5"/>'+
     '<circle cx="32" cy="62" r="7" fill="none" stroke="#111" stroke-width="3.5"/>',
 spreader:'<g fill="#111"><rect x="10" y="30" width="80" height="10" rx="5"/><rect x="10" y="60" width="80" height="10" rx="5"/>'+
     '<rect x="44" y="30" width="12" height="40"/></g><path d="M20 18 v10 M80 18 v10 M20 72 v10 M80 72 v10" stroke="#111" stroke-width="7" stroke-linecap="round"/>',
 baby:'<g fill="#111"><circle cx="50" cy="30" r="18"/><path d="M26 54 h48 a7 7 0 0 1 7 7 v9 c0 13-14 22-31 22 s-31-9-31-22 v-9 a7 7 0 0 1 7-7 z"/></g>',
 mask:'<rect x="41" y="8" width="18" height="20" rx="6" fill="#111"/><circle cx="50" cy="58" r="32" fill="#111"/><circle cx="50" cy="58" r="16" fill="#fff"/>',
 tube:'<g fill="#111"><rect x="31" y="6" width="38" height="15" rx="4"/><path d="M36 21 h28 v47 a14 14 0 0 1 -28 0 z"/></g><rect x="41" y="30" width="18" height="20" rx="3" fill="#fff"/>',
 box:'<g fill="#111"><circle cx="31" cy="31" r="14"/><rect x="55" y="17" width="28" height="28" rx="5"/><rect x="17" y="55" width="28" height="28" rx="5"/><path d="M69 53 L86 85 L52 85 Z"/></g>',
 artline:'<path d="M8 58 C34 50 62 50 92 58" fill="none" stroke="#9b1c2e" stroke-width="13" stroke-linecap="round"/>'+
     '<path d="M10 78 C34 72 60 72 86 78" fill="none" stroke="#2b5c93" stroke-width="8" stroke-linecap="round"/>'+
     '<path d="M30 18 L54 52" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>'+
     '<path d="M60 30 q7 -14 14 0 t14 0" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>',
 pigtail:'<path d="M14 24 C46 24 74 34 86 52" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>'+
     '<path d="M86 52 a13 13 0 1 1 -20 10" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>'+
     '<rect x="6" y="16" width="16" height="16" rx="4" fill="#111"/>',
 splint:'<g fill="#111"><rect x="10" y="30" width="80" height="11" rx="5.5"/><rect x="10" y="60" width="80" height="11" rx="5.5"/></g>'+
     '<path d="M22 20 v12 M78 20 v12 M22 69 v12 M78 69 v12" stroke="#111" stroke-width="7" stroke-linecap="round"/>',
 monitor:'<rect x="6" y="20" width="88" height="52" rx="6" fill="#111"/>'+
     '<path d="M14 56 L28 56 L34 34 L44 62 L52 46 L60 56 L88 56" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>',
 suture:'<path d="M12 78 C34 34 66 30 90 20" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>'+
     '<path d="M64 20 a20 20 0 0 1 4 34" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/>',
 child:'<circle cx="50" cy="24" r="15" fill="#111"/>'+
     '<path d="M50 41 C64 41 74 50 74 63 v10 h-11 v18 H37 V73 H26 V63 C26 50 36 41 50 41 Z" fill="#111"/>',
 canth:'<path d="M8 50 Q50 16 92 50 Q50 84 8 50 Z" fill="none" stroke="#111" stroke-width="6.5" stroke-linejoin="round"/>'+
     '<circle cx="50" cy="50" r="13.5" fill="none" stroke="#111" stroke-width="6"/>'+
     '<path d="M80 61 L97 70" stroke="#111" stroke-width="7.5" stroke-linecap="round"/>',
 prep:'<g fill="#111"><rect x="36" y="6" width="28" height="16" rx="4"/><path d="M30 22 h40 v46 a12 12 0 0 1 -12 12 h-16 a12 12 0 0 1 -12 -12 z"/>'+
     '<rect x="40" y="80" width="20" height="14" rx="4"/></g><rect x="36" y="34" width="28" height="22" rx="3" fill="#fff"/>'
};
