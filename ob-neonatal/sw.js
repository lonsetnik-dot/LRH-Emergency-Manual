/* {{site.hospitalShort}} OB Emergencies — offline shell. Bump CACHE on every deploy. */
var CACHE = 'edm-ob-2026-08-08a';
var ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', function(e){
  // Cache.addAll() is all-or-nothing: if ANY asset above 404s, the whole install rejects,
  // the worker never activates, and the app silently ends up with no offline shell at all.
  // Cache each asset independently so one missing file can never take the shell down.
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(url){
        return c.add(url)['catch'](function(err){
          if (typeof console !== 'undefined' && console.warn) console.warn('[sw] could not cache', url, err);
        });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){ return hit || caches.match('index.html'); });
    })
  );
});
