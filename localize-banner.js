/* localize-banner.js — the "this manual is not yours yet" bar.
 *
 * Inlined into every published page by build.mjs, next to the offline
 * registration, so no tool hand-maintains a copy (CLAUDE.md rule 1 keeps tools
 * self-contained; the build is what keeps them identical).
 *
 * WHAT IT IS FOR. A forked manual is at its most dangerous in the window
 * between "it deployed" and "somebody validated it", because it looks finished.
 * Every screen has a header, a checklist, a version stamp and a citation, and
 * none of that changes when the numbers behind it belong to a hospital three
 * states away. This bar is the one thing on the page that knows the difference.
 *
 * It renders only when site.config.json still has unanswered REQUIRED values.
 * A fully localized site never sees it. That is deliberate: a warning that is
 * always on is a warning nobody reads, so this one has to be able to go away.
 *
 * It is dismissible per page load, never per device. Dismissing it is for
 * reading the screen underneath during localization work — not for deciding the
 * warning does not apply. It comes back on the next load, and it will keep
 * coming back until the answers exist.
 *
 * PRINT: hidden on paper. A poster carries its own placeholder text in the
 * content itself, so the bar would be duplicated noise on a page that is
 * already shouting — and an extra strip is what spills a card deck onto
 * another sheet.
 */
(function () {
  var S = null;
  try { S = window.SITE_CONFIG; } catch (e) { return; }
  if (!S || !S.counts) return;

  var goLive = S.counts.missingGoLive || 0;
  var sim = S.counts.missingSim || 0;
  if (!goLive && !sim) return;                 /* localized — say nothing */

  function build() {
    if (document.getElementById('edm-localize-bar')) return;

    var pct = Math.round((S.counts.answered / S.counts.total) * 100);
    var bar = document.createElement('div');
    bar.id = 'edm-localize-bar';
    bar.setAttribute('role', 'status');

    /* Inline styles, not a class: this must render identically on a tool whose
       stylesheet failed, half-loaded, or was never migrated to the design
       system. It is the last thing that should depend on anything.

       pointer-events:none on the strip, auto on its own controls. Several
       tools park their own fixed UI at the bottom of the screen — the neonatal
       Apgar sheet is one — and a bar that swallowed taps there would disable a
       control in the middle of a resuscitation to deliver a message about
       configuration. It may cover a button; it may never be one. */
    bar.style.cssText = [
      /* STICKY, NOT FIXED. Sticky participates in normal flow: it pins to the
         bottom of the viewport while there is page below it, then settles at
         the end of the document — so it never covers a control and needs no
         reserved padding. The fixed version did, and reserving that space with
         body padding oscillated (padding → scrollbar → narrower viewport →
         text wraps → taller bar → more padding), leaving the page reflowing
         several times a second. Invisible to a reader; fatal to anyone trying
         to tap a button on a tool that re-renders on a clock. */
      /* A LOW stacking order, deliberately. Sticky already keeps the strip
         above ordinary page content; a high z-index would additionally put it
         on top of a tool's own modal — and the neonatal Apgar sheet is a
         bottom-anchored overlay whose "NOT NOW" button then sits underneath
         this bar's dismiss button. A configuration notice must never be the
         thing standing between a clinician and a control. While a tool's own
         overlay is up, this can be covered; it comes back when the overlay
         closes. */
      'position:sticky', 'left:0', 'right:0', 'bottom:0', 'z-index:1',
      'margin-top:16px',
      'background:#7a1420', 'color:#fff5f5',
      'font-family:"IBM Plex Mono","SF Mono",ui-monospace,Menlo,monospace',
      'font-size:11.5px', 'line-height:1.3', 'padding:6px 10px',
      'display:flex', 'gap:8px', 'align-items:center',
      'border-top:3px solid #e0b93c', 'box-shadow:0 -2px 12px rgba(0,0,0,.35)',
      'padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))',
      'flex-wrap:wrap'
    ].join(';');

    /* One line. A bedside screen has no room for a paragraph, and the detail
       is one tap away in WHAT IS MISSING. */
    var msg = document.createElement('div');
    msg.style.cssText = 'flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    msg.innerHTML =
      '<b style="letter-spacing:.08em">&#9888; NOT LOCALIZED &middot; ' + pct + '%</b> ' +
      '<span style="color:#f3c9cd">' +
      (goLive ? goLive + ' required answer' + (goLive === 1 ? '' : 's') + ' missing'
              : 'required answers complete') +
      (sim ? ' &middot; ' + sim + ' more surface in sim' : '') +
      ' &middot; &laquo;\u2026&raquo; = placeholder, not clinical content</span>';

    var list = document.createElement('button');
    list.type = 'button';
    list.textContent = 'WHAT IS MISSING';
    list.style.cssText = 'min-height:40px;padding:0 10px;background:transparent;' +
      'color:#fff5f5;border:2px solid #f3c9cd;font:inherit;font-weight:700;letter-spacing:.06em;cursor:pointer';
    list.addEventListener('click', function () { toggleList(bar); });

    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Hide this notice for this page load');
    x.textContent = '×';
    x.style.cssText = 'min-height:40px;min-width:40px;background:transparent;' +
      'color:#fff5f5;border:2px solid #f3c9cd;font:inherit;font-size:17px;font-weight:700;cursor:pointer';
    x.addEventListener('click', function () {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });

    bar.appendChild(msg); bar.appendChild(list); bar.appendChild(x);

    /* Reserve the space the bar occupies instead of floating over the page.
       A fixed bar at the bottom of a bedside checklist would otherwise sit on
       top of whatever control happens to be last — and the last control on a
       resuscitation screen is routinely the one somebody needs. */
    var style = document.createElement('style');
    /* Hidden on paper: a poster already carries its own placeholder text in
       the content itself, and an extra strip is what pushes a laminated card
       deck onto a fifth sheet. verify_vems.mjs counts those sheets, which is
       how that was caught rather than discovered at the laminator. */
    style.textContent = '@media print{#edm-localize-bar{display:none!important}}' +
      '#edm-localize-bar{max-height:60vh;overflow:auto}';
    document.head && document.head.appendChild(style);

    document.body.appendChild(bar);
  }

  /* The list is grouped by onboarding section so the answer to "what do I do
     about this" is "open ONBOARDING.md at section C", not "fix 47 things". */
  function toggleList(bar) {
    var open = document.getElementById('edm-localize-list');
    if (open) { open.parentNode.removeChild(open); return; }

    var box = document.createElement('div');
    box.id = 'edm-localize-list';
    box.style.cssText = 'pointer-events:auto;flex:1 1 100%;max-height:42vh;overflow:auto;margin-top:6px;' +
      'padding:8px 10px;background:#4d0c14;border:1px solid #f3c9cd';

    var bySection = {};
    for (var i = 0; i < S.missing.length; i++) {
      var m = S.missing[i];
      (bySection[m.section] = bySection[m.section] || []).push(m);
    }
    var html = '';
    Object.keys(bySection).sort().forEach(function (sec) {
      html += '<div style="margin:6px 0 2px;font-weight:700;letter-spacing:.08em">ONBOARDING &sect;' + sec + '</div>';
      bySection[sec].forEach(function (m) {
        html += '<div style="padding:3px 0;color:#f3c9cd">' +
          '<span style="display:inline-block;min-width:62px;font-weight:700;color:' +
          (m.required === 'go-live' ? '#ffd9a8' : '#cfd8e3') + '">' +
          (m.required === 'go-live' ? 'REQUIRED' : m.required.toUpperCase()) + '</span> ' +
          esc(m.key) + ' &mdash; ' + esc(m.q) + '</div>';
      });
    });
    box.innerHTML = html;
    bar.appendChild(box);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, false);
  } else { build(); }
})();
