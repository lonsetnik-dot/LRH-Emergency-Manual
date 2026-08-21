/* ===========================================================================
   theme-boot.js — the manual's light/dark preference, applied before paint.

   Injected by build.mjs wherever a page's <script> carries the marker
   (slash-star) @theme-boot (star-slash), the same mechanism as
   design-system.css and case-shell.js, so deployed tools stay self-contained
   and offline (CLAUDE.md rule 1) and this is edited ONCE for every page.

   WHY THIS EXISTS: the theme is chosen in exactly one place — the LIGHT/DARK
   control on the landing page, next to the master search. Every other page in
   the manual only *reads* the choice. Before this file, only the landing page
   read it, so a clinician who switched to light and then opened any tool got
   dark again — the preference lasted precisely one navigation.

   It runs immediately after <body> rather than on DOMContentLoaded: reading it
   later means the page paints dark first and then flips, which is a flash of
   the wrong theme in a dark resuscitation bay.

   lrh-pref-theme is a PREFERENCE, not case state: it survives RESET FOR NEXT
   CASE, because ambient lighting is not a fact about this patient. It shares
   the lrh-pref- namespace with lrh-pref-why. See CASE-STATE.md.
   =========================================================================== */
(function () {
  try {
    document.body.dataset.theme =
      localStorage.getItem('lrh-pref-theme') === 'light' ? 'light' : 'dark';
  } catch (e) {
    /* Private mode, disabled storage, or a locked-down enterprise profile:
       fall back to the default rather than leaving the attribute unset. */
    document.body.dataset.theme = 'dark';
  }
})();
