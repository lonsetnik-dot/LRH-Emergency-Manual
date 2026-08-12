/* LRH Emergency Manual — offline shell verification (issue #120).
 *
 * Golden rule 1 says the tools "must work offline." Before this suite that was
 * a promise with no mechanism and no test: only ob-neonatal registered a
 * worker, and nothing would have caught its removal.
 *
 * WHY THIS SUITE RUNS ITS OWN SERVER AND THEN KILLS IT:
 * the obvious approach — Playwright's context.setOffline(true) — does NOT cut
 * off fetches made *by a service worker*. The worker runs in its own context
 * and happily reached the still-running test server, so every "offline" check
 * passed while the network was in fact available. The suite proved nothing.
 * (Caught when the uncached-URL check returned a real 404 from python's
 * http.server instead of the worker's fallback.)
 *
 * So the dead zone is simulated the only unambiguous way: the server is stopped
 * and its sockets destroyed. Nothing is listening. If a page still renders, it
 * genuinely came out of the cache.
 *
 *     node build.mjs && node verify_offline.mjs
 *
 * Service workers need a secure context; http://localhost counts, which is why
 * this works without TLS.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const ROOT = 'dist';
const PORT = Number(process.env.PORT || 8130);
const BASE = `http://localhost:${PORT}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/* Minimal static server. Mirrors the two Netlify behaviours the worker depends
   on: directory URLs serve index.html, and sw.js is never cached. */
function startServer() {
  const sockets = new Set();
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, BASE).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      const body = await readFile(file);
      const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
      if (file.endsWith('sw.js')) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Service-Worker-Allowed'] = '/';
      }
      res.writeHead(200, headers); res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found');
    }
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise(resolve => server.listen(PORT, () => resolve({
    server,
    stop: () => new Promise(done => {
      for (const s of sockets) s.destroy();       // kill keep-alives, or close() hangs
      server.close(() => done());
    }),
  })));
}

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  got=${got} want=${want}`));
};

let srv = await startServer();
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext();
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', e => errors.push(String(e)));

/* ---- 1. the worker registers, activates, and precaches the whole manual ---- */
await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
const activated = await pg.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (reg.active && reg.active.state === 'activated') return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return reg.active ? reg.active.state : 'no active worker';
});
ck('1. service worker activates on the landing page', activated, true);

const cached = await pg.evaluate(async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const mine = (await caches.keys()).filter(n => n.startsWith('lrh-manual-'));
    if (mine.length) {
      const keys = await (await caches.open(mine[0])).keys();
      if (keys.length >= 28) return keys.length;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  const mine = (await caches.keys()).filter(n => n.startsWith('lrh-manual-'));
  return mine.length ? (await (await caches.open(mine[0])).keys()).length : 0;
});
ck('1. whole manual precached (>= 28 entries)', cached >= 28, true);

/* ---- 2. THE DEAD ZONE. Server stopped; nothing is listening. ---- */
await srv.stop();
await ctx.setOffline(true);   // belt and braces for page-initiated requests

/* Control: prove the network really is gone, so a pass below cannot be the
   server quietly answering.
   A same-origin fetch can never throw here — the worker intercepts every
   same-origin GET, so it always answers something. The distinguishing signal is
   WHICH answer: the test server returns 404 for an unknown path, whereas the
   worker's own offline path returns 504 (see sw-template.js). 504 therefore
   means "nothing was listening and the worker said so"; a 404 would mean the
   server is still up and the dead zone is fake. */
const control = await pg.evaluate(async () => {
  try {
    const res = await fetch('/__nothing_should_answer__', { cache: 'no-store' });
    return res.status === 504 ? 'offline (worker answered 504)' : 'server answered ' + res.status;
  } catch { return 'offline (fetch rejected)'; }
});
ck('2. control: the network is genuinely down', control, 'offline (worker answered 504)');

/* Expected text only appears once a page has rendered its own content — not a
   nav label a fallback shell would also carry, which would let a broken page pass. */
const TOOLS = [
  ['/',                     'Emergency Manual'],
  ['/codes/',               'Codes'],
  ['/peds/',                'Pediatric'],
  ['/arrest/',              'CHECK A PULSE'],
  ['/ob-neonatal/',         'Neonatal'],
  ['/tca/',                 'TRAUMATIC CARDIAC ARREST'],
  ['/trauma/',              'Trauma'],
  ['/airway/',              'AIRWAY'],
  ['/procedures/',          'Procedures'],
  ['/clinical-pathways/',   'Pathways'],
  ['/labels/',              'CART & CABINET LABELS'],
  ['/equipment-readiness/', 'Equipment'],
  ['/conversations/',       'Conversations'],
  ['/simulations/',         'Simulation'],
  ['/posters/',             'Posters'],
];

for (const [path, expect] of TOOLS) {
  let text = '';
  try {
    const res = await pg.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    text = (res && res.status() >= 400)
      ? `(http ${res.status()})`
      : await pg.evaluate(() => document.body.innerText.slice(0, 6000));
  } catch (e) { text = '(navigation failed: ' + e.message.split('\n')[0] + ')'; }
  ck(`2. dead zone: ${path} still opens`, text.includes(expect) ? true : JSON.stringify(text.slice(0, 90)), true);
}

/* ---- 2b. THE URLS THE MANUAL ACTUALLY LINKS TO --------------------------
   Regression for a bug found in live phone testing, not by this suite: every
   internal link carries a query string (?from=home, ?from=codes,
   ?startnewcase=1), and cache keys include the query string. The precached
   '/codes/' therefore did not satisfy a navigation to '/codes/?from=home' —
   it fell through to the fallback, which served the LANDING page at the tool's
   URL, whose relative links then missed and fell back again. Tapping around
   offline bounced to the beta splash with no way forward.

   The original checks all used bare paths that no link in the manual uses,
   which is exactly why they passed while the real thing was broken. */
const LINKED = [
  ['/codes/?from=home',      'Codes'],
  ['/peds/?from=home',       'Pediatric'],
  ['/arrest/?from=codes',    'CHECK A PULSE'],
  ['/ob-neonatal/?from=home','Neonatal'],
  ['/procedures/?from=home', 'Procedures'],
  ['/codes/?from=home#c06',  'Codes'],
];
for (const [path, expect] of LINKED) {
  let text = '';
  try {
    await pg.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    text = await pg.evaluate(() => document.body.innerText.slice(0, 6000));
  } catch (e) { text = '(navigation failed: ' + e.message.split('\n')[0] + ')'; }
  ck(`2b. dead zone: ${path} opens the TOOL, not the landing page`,
     text.includes(expect) ? true : JSON.stringify(text.slice(0, 90)), true);
}

/* Click-through is the journey a clinician actually takes: land, tap a tool,
   tap onward. goto() alone would not have caught the bounce. */
await pg.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await pg.click('a[href*="codes/"]').catch(() => {});
await pg.waitForTimeout(600);
const clicked = await pg.evaluate(() => document.body.innerText.slice(0, 4000));
ck('2b. dead zone: tapping a tool from the landing page opens that tool',
   clicked.includes('Codes') && !clicked.includes('Tap a card to open') ? true
     : JSON.stringify((await pg.url()) + ' :: ' + clicked.slice(0, 70)), true);

/* ---- 3. cross-tool links survive the dead zone ----
   The whole reason for one root worker rather than one per tool: a link from
   codes to the arrest engine has to work too, not just the page already open. */
await pg.goto(BASE + '/codes/', { waitUntil: 'domcontentloaded' });
const crossTool = await pg.evaluate(async () => (await fetch('/arrest/')).ok);
ck('3. dead zone: codes can still reach /arrest/', crossTool, true);

/* ---- 4. an uncached URL degrades to the manual, not a browser error page ---- */
let fallbackText = '';
try {
  await pg.goto(BASE + '/definitely-not-a-real-page/', { waitUntil: 'domcontentloaded' });
  fallbackText = await pg.evaluate(() => document.body.innerText.slice(0, 2000));
} catch (e) { fallbackText = '(navigation failed: ' + e.message.split('\n')[0] + ')'; }
ck('4. dead zone: an uncached URL falls back to the manual',
   fallbackText.includes('Emergency Manual') ? true : JSON.stringify(fallbackText.slice(0, 90)), true);

/* ---- 5. back online: nothing was poisoned ---- */
await ctx.setOffline(false);
srv = await startServer();
await pg.goto(BASE + '/codes/', { waitUntil: 'networkidle' });
ck('5. back online: codes still renders',
   await pg.evaluate(() => document.body.innerText.includes('Codes')), true);

/* ---- 6. no update bar on a first install ----
   A "manual updated" prompt on someone's first ever visit is nonsense, and it
   would train people to ignore the bar on the day it actually matters. */
ck('6. no spurious update bar on first install', await pg.locator('#lrh-sw-update').count(), 0);

/* ---- 7. a new deploy ANNOUNCES itself and never reloads on its own ----------
   This is the half of cache-first that carries the clinical risk. Serving a
   cached page instantly is only safe if the user can tell when a newer version
   exists; otherwise a phone quietly runs a superseded protocol forever. And the
   prompt must never act by itself — a page that reloads mid-resuscitation takes
   the checklist away from whoever is reading it.

   Simulates a deploy by editing the built site and re-stamping the worker's
   cache name (which build.mjs derives from content, so a real deploy does the
   same thing). dist/ is generated and gitignored, so mutating it is safe. */
const distIndex = join(ROOT, 'index.html');
const distSW = join(ROOT, 'sw.js');
const originalIndex = await readFile(distIndex, 'utf8');
const originalSW = await readFile(distSW, 'utf8');
try {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(distIndex, originalIndex.replace('</body>', '<p id="deploy-marker">NEW DEPLOY MARKER</p></body>'));
  await writeFile(distSW, originalSW.replace(/lrh-manual-[a-f0-9]+/, 'lrh-manual-deadbeef1234'));

  await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
  await pg.waitForSelector('#lrh-sw-update', { timeout: 15000 }).catch(() => {});

  const barShown = await pg.locator('#lrh-sw-update').count();
  ck('7. new deploy: the update bar appears', barShown, 1);

  /* The bar says a newer version exists; the page must still be showing the old
     one, untouched, until the clinician says otherwise. */
  const stillOld = await pg.evaluate(() => !document.getElementById('deploy-marker'));
  ck('7. new deploy: page is NOT auto-reloaded', stillOld, true);

  const wording = await pg.evaluate(() => {
    const el = document.getElementById('lrh-sw-update');
    return el ? el.innerText.toUpperCase() : '';
  });
  ck('7. new deploy: the bar says the page is showing the previous version',
     wording.includes('UPDATED') && wording.includes('PREVIOUS VERSION') ? true : JSON.stringify(wording.slice(0, 90)), true);

  /* LATER dismisses without acting — the whole point of a non-disruptive prompt. */
  await pg.click('#lrh-sw-dismiss');
  ck('7. new deploy: LATER dismisses without reloading',
     (await pg.locator('#lrh-sw-update').count()) === 0 &&
     (await pg.evaluate(() => !document.getElementById('deploy-marker'))), true);

  /* RELOAD is the only thing that swaps content.

     This is the one place in the suite that deliberately provokes a navigation,
     and sw-register.js reloads belt-and-braces: once on controllerchange, plus a
     400 ms fallback for browsers that never fire it. So a SECOND navigation can
     land underneath the assertion below and destroy the execution context out
     from under page.evaluate. That is not a failure of the thing under test —
     the thing under test is that the new content arrives — so read through the
     navigation instead of failing on it. Seen only on CI, where the runner is
     slow enough for the two reloads not to coalesce. */
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('#lrh-sw-update', { timeout: 15000 }).catch(() => {});
  if (await pg.locator('#lrh-sw-reload').count()) {
    await pg.click('#lrh-sw-reload');
    await pg.waitForFunction(() => !!document.getElementById('deploy-marker'), null, { timeout: 15000 }).catch(() => {});
  }
  const evalSettled = async (fn, tries = 6) => {
    for (let i = 0; i < tries; i++) {
      try { return await pg.evaluate(fn); }
      catch (e) {
        if (!/Execution context was destroyed|Target closed|navigation/i.test(String(e))) throw e;
        await pg.waitForLoadState('load').catch(() => {});
        await pg.waitForTimeout(300);
      }
    }
    return pg.evaluate(fn);            /* last attempt, and let it throw if it still fails */
  };
  ck('7. new deploy: RELOAD brings in the new version',
     await evalSettled(() => !!document.getElementById('deploy-marker')), true);
} finally {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(distIndex, originalIndex);
  await writeFile(distSW, originalSW);
}

/* ---- 8. the injected registration snippet breaks nothing ---- */
ck('8. no page errors across the run', errors.length ? errors.join(' | ') : 0, 0);

await browser.close();
await srv.stop();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
