/* LRH Emergency Manual — service-worker registration + update prompt.
 *
 * Build input (issue #120), not shipped as a file: build.mjs injects this
 * inline into every published page, so the deployed HTML stays self-contained
 * per CLAUDE.md rule 1 and no tool has to hand-maintain a copy. Edit here.
 *
 * Two jobs:
 *   1. Register the root worker so the whole manual is available offline.
 *   2. When a new version is waiting, SAY SO — visibly, once, and let the
 *      clinician choose the moment. Cache-first means a page can otherwise be
 *      quietly a deploy behind, and silent staleness in clinical content is the
 *      thing this whole mechanism exists to prevent.
 *
 * What it deliberately does NOT do: reload on its own. A page that reloads
 * itself mid-resuscitation takes the checklist away from someone who is reading
 * it. The bar waits, and it can be dismissed.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  /* Service workers require a secure context. localhost counts as secure, which
     is what lets verify_offline.mjs exercise this against the local server. */
  var secure = location.protocol === 'https:' ||
               location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;

  function showUpdateBar(reg) {
    if (document.getElementById('lrh-sw-update')) return;   /* only ever one */
    var bar = document.createElement('div');
    bar.id = 'lrh-sw-update';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed; left:0; right:0; bottom:0; z-index:9999;' +
      'display:flex; align-items:center; gap:10px; padding:10px 14px;' +
      'padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));' +
      'background:#16324f; color:#fffefb; box-shadow:0 -4px 14px rgba(0,0,0,0.28);' +
      "font-family:'IBM Plex Mono','SF Mono',ui-monospace,Menlo,monospace; font-size:12.5px; line-height:1.35;";
    bar.innerHTML =
      '<span style="flex:1;">MANUAL UPDATED &mdash; reload when it is safe to. ' +
      'This page is still showing the previous version.</span>' +
      '<button type="button" id="lrh-sw-reload" style="flex:none; min-height:38px; padding:6px 12px;' +
      'background:#fffefb; color:#16324f; border:none; font:inherit; font-weight:700; cursor:pointer;">RELOAD</button>' +
      '<button type="button" id="lrh-sw-dismiss" aria-label="Dismiss" style="flex:none; min-height:38px; padding:6px 10px;' +
      'background:none; color:#fffefb; border:1px solid rgba(255,255,255,0.55); font:inherit; cursor:pointer;">LATER</button>';

    /* Meaningless on paper, and it would waste a strip of every printed poster. */
    var st = document.createElement('style');
    st.textContent = '@media print { #lrh-sw-update { display:none !important; } }';
    document.head.appendChild(st);
    document.body.appendChild(bar);

    document.getElementById('lrh-sw-dismiss').addEventListener('click', function () { bar.remove(); });
    document.getElementById('lrh-sw-reload').addEventListener('click', function () {
      document.getElementById('lrh-sw-reload').textContent = 'RELOADING…';
      /* Ask the waiting worker to take over; reload once it has. */
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(function () { location.reload(); }, 400);   /* fallback if no controllerchange */
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      /* A new version was already sitting there when this page opened. */
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg);

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          /* installed + an existing controller == an update, not a first install.
             On a first install there is nothing stale to warn about. */
          if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(reg);
        });
      });
    })['catch'](function () { /* offline, or workers blocked — the tool still works */ });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* Only reload if the user asked for it (the bar is on screen). */
      if (reloading || !document.getElementById('lrh-sw-update')) return;
      reloading = true;
      location.reload();
    });
  });
})();
