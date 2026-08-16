/* CairnReady Emergency Manual — offline shell (build input, not shipped as-is).
 *
 * build.mjs reads this file, substitutes __CACHE__ and __ASSETS__, and writes
 * dist/sw.js. Do NOT edit dist/sw.js — edit this template.
 *
 * WHY A GENERATED CACHE NAME (issue #120): the previous per-tool worker carried
 * a hand-written version string ("lrh-ob-2026-08-08a") that a human had to
 * remember to bump on every deploy. Forgetting it means phones keep serving the
 * previous clinical content indefinitely, silently — the exact failure this
 * system cannot afford. __CACHE__ is a content hash of everything precached, so
 * any change to any card produces a new cache name automatically and a stale
 * shell is impossible to ship by omission.
 *
 * WHY ONE ROOT WORKER instead of one per tool: the whole manual is ~2.9 MB
 * (~0.5 MB gzipped) across 28 pages, so a single worker scoped at / can
 * precache ALL of it. A clinician who has opened any one page has the entire
 * manual — including cross-tool links (codes -> procedures, arrest -> airway) —
 * available in a dead zone. Per-tool workers would leave those links dead.
 *
 * WHY CACHE-FIRST: the failure this exists for is a wifi dead zone during a
 * resuscitation, where a network-first fetch does not fail fast — it hangs.
 * Cache-first opens instantly and never depends on the radio. The cost is that
 * a freshly deployed change is not shown until reload, so staleness is made
 * VISIBLE rather than silent: the worker revalidates in the background, and the
 * page shows a dismissible "manual updated" prompt (see sw-register.js).
 * Nothing here ever reloads the page on its own — a forced reload mid-code
 * would wipe the screen someone is reading. The user chooses when.
 */
var CACHE = '__CACHE__';
var ASSETS = __ASSETS__;

self.addEventListener('install', function (e) {
  /* Cache each asset independently. Cache.addAll() is all-or-nothing: one 404
     rejects the whole install, the worker never activates, and the app silently
     ends up with no offline shell at all. Inherited from the ob-neonatal
     worker, where that lesson was already learned the hard way. */
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (url) {
        return c.add(new Request(url, { cache: 'reload' }))['catch'](function (err) {
          if (typeof console !== 'undefined' && console.warn) console.warn('[sw] could not cache', url, err);
        });
      }));
    })
  );
  /* Deliberately NOT skipWaiting() here. The new worker waits until the page
     tells it to take over (see the SKIP_WAITING message below), so an update
     can never swap content under someone mid-case. */
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        /* Only ever touch our own caches — never another origin's or another
           app's, in case this is deployed alongside something else. */
        return (k !== CACHE && k.indexOf('lrh-') === 0) ? caches.delete(k) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  /* The page asks for the update only when the user taps RELOAD. */
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   /* never touch third parties */

  e.respondWith(
    /* ignoreSearch is load-bearing, not a nicety. Cache keys include the query
       string, but every internal link in this manual carries one —
       /codes/?from=home, /arrest/?from=codes, /peds/?startnewcase=1. Matching
       strictly meant the precached '/codes/' never satisfied a real navigation
       to '/codes/?from=home': it fell through to the offline fallback, which
       served the LANDING page at the tool's URL. The landing page's own
       relative links then resolved against that wrong base, missed again, and
       fell back again — so a clinician tapping around offline got bounced to
       the beta splash and could not proceed. Found in live testing on a phone;
       the first version of verify_offline.mjs missed it by navigating to bare
       paths that no link in the manual actually uses. */
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      /* Background revalidate: refresh the cache for next time, but never make
         the user wait on it. A failure here is normal (offline) and silent. */
      var fresh = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })['catch'](function () { return null; });

      if (hit) return hit;

      return fresh.then(function (res) {
        if (res) return res;
        /* Offline and never cached. For a navigation, try this tool's own shell
           first — a deep link like /codes/some-new-thing should land in Codes,
           not be thrown back to the manual's front door — and only fall back to
           the landing page if even that is unknown. It lists every tool, so the
           clinician still gets somewhere useful rather than the browser's
           dinosaur. */
        if (req.mode === 'navigate') {
          var toolShell = url.pathname.replace(/[^/]*$/, '') + 'index.html';
          return caches.match(toolShell, { ignoreSearch: true }).then(function (own) {
            return own || caches.match('/index.html', { ignoreSearch: true });
          }).then(function (shell) {
            return shell || new Response('Offline, and this page was never cached.', {
              status: 503, headers: { 'Content-Type': 'text/plain' }
            });
          });
        }
        return new Response('', { status: 504 });
      });
    })
  );
});
