/* LRH Emergency Manual — one idiom per action (issue #71).
 *
 * Lon's observation: "it's not clear to me that we have a consistent design language for logging an
 * event vs linking to a procedure." Two controls that look alike and do completely different things —
 * one writes a line into the case record, the other takes you off the screen you are standing on.
 *
 * His rule, and what this suite pins:
 *
 *   LOGGING              → a ROUND button that says "LOG IT"
 *   LINK TO A PROCEDURE  → underlined text
 *
 * Both are enforced from the shared stylesheets rather than per tool, so a seventh engine inherits
 * the idiom by existing. This suite measures the RENDERED page, because the failure mode is a tool
 * whose inline style quietly beats the shared rule — which is exactly what the log buttons did
 * before this change: an inline border-radius:10px on the commit button overrode the shared pill.
 *
 * ONE DELIBERATE EXCEPTION, asserted rather than tolerated: a handful of procedure links are written
 * as bordered chips that set text-decoration:none inline. They keep the chip look, because a
 * bordered pill is already unmistakably a navigation control and an underline inside one reads as a
 * rendering fault. Asserting it means nobody later "fixes" it without deciding to.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_design_language.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };
const ok = (n, c, d) => ck(n, c ? true : (d === undefined ? false : d), true);

const pg = await b.newPage({ viewport: { width: 390, height: 844 } });

/* Every live engine. Adding a seventh means adding one line — which is the
   point: this list is the joining checklist for the idiom. */
const ENGINES = ['arrest', 'tca', 'neonatal', 'pph', 'dystocia', 'airway'];

console.log('--- 1. logging is a round button that says LOG IT ---');
for (const e of ENGINES) {
  await pg.goto(`${BASE}/${e}/?from=home`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(320);
  /* The engines hide the running screen until the case is started, and the
     composer until the toggle is tapped, so both have to be opened or the
     measurements below are taken on display:none elements and pass vacuously. */
  if (await pg.locator('#startbtn').isVisible().catch(() => false)) {
    await pg.click('#startbtn').catch(() => {}); await pg.waitForTimeout(320);
  }
  ck(`1. [${e}] has a log control at all`, await pg.locator('#logtoggle').isVisible().catch(() => false), true);
  await pg.click('#logtoggle').catch(() => {}); await pg.waitForTimeout(260);

  const rows = await pg.evaluate(() => ['logtoggle', 'customlog', 'customlog2'].map(id => {
    const el = document.getElementById(id); if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { id, label: (el.textContent || '').trim(),
             rad: parseFloat(cs.borderTopLeftRadius) || 0, h: Math.round(r.height) };
  }).filter(Boolean));

  ck(`1. [${e}] every log control says LOG IT`,
     rows.every(r => /^LOG IT$/i.test(r.label)) ? 'all' : rows.map(r => r.id + '="' + r.label + '"').join(','), 'all');
  /* "Round" measured against the control's own height, not a magic number, so a
     site that makes its buttons taller still has to keep them pill-shaped. */
  ck(`1. [${e}] every log control is a pill, not a rounded rectangle`,
     rows.filter(r => r.h > 0).every(r => r.rad >= r.h / 2 - 1) ? 'all' : rows.map(r => r.id + ' r=' + r.rad + '/h=' + r.h).join(','), 'all');
}

console.log('\n--- 2. prose navigation is underlined, everywhere ---');
/* Revised 2026-08-18 on the clinician's direction. The old rule underlined
   only links into procedures/; every other prose link — cross-tool, in-card,
   #cXX — was carried by color alone, which fails WCAG 1.4.1 and is nearly
   invisible on the dark ground. The distinction that matters mid-code is
   NAVIGATE vs RECORD, not which tool the destination happens to live in.

   So this now asserts the real invariant, in both directions:
     a) every INLINE PROSE link is underlined, on every page, and
     b) no chrome control is (tiles, chips, buttons, the LOG IT pill),
   which is what keeps the underline meaningful. A link already shaped as a
   control — bordered, filled, or laid out as a block/flex tile — is excluded
   by shape rather than by an allow-list, so a new chip cannot silently
   acquire an underline and a new prose link cannot silently lose one. */
const PAGES = ['/', '/codes/', '/peds/', '/trauma/', '/procedures/', '/ob-neonatal/',
               '/clinical-pathways/heart/', '/arrest/', '/tca/', '/airway/', '/neonatal/',
               '/pph/', '/dystocia/', '/system/', '/sources/', '/equipment-readiness/'];
let proseTotal = 0;
for (const p of PAGES) {
  await pg.goto(BASE + p + '?from=home', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(380);
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pg.waitForTimeout(180);
  const r = await pg.evaluate(() => {
    /* Shaped as a control? Then it is not prose and must NOT be underlined. */
    const isControl = a => {
      const c = getComputedStyle(a);
      /* Shaped as a control = it has chrome of its own: a border, a fill, or a
         block/flex/grid box it lays out as. NOT merely inline-block — several
         genuine prose links (a dependent path in sources/, an "issue #99" link
         in equipment-readiness/) are inline-block with no chrome at all, and
         treating those as controls would have quietly exempted them from the
         rule they most needed. */
      if (parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderLeftWidth) > 0) return true;
      if (c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent') return true;
      if (/^(block|flex|grid|inline-grid)$/.test(c.display)) return true;
      return /lrh-row|shellmenurow|ghost|logit|btn|chip|shellback|shelltool|lrh-cat/.test(a.className);
    };
    const as = [...document.querySelectorAll('a[href]')].filter(a => a.textContent.trim());
    const und = a => /underline/.test(getComputedStyle(a).textDecorationLine);
    const prose = as.filter(a => !isControl(a));
    const controls = as.filter(isControl);
    return {
      prose: prose.length,
      bare: prose.filter(a => !und(a)).map(a => a.textContent.trim().slice(0, 30)),
      controlsUnderlined: controls.filter(und).map(a => a.textContent.trim().slice(0, 30))
    };
  });
  proseTotal += r.prose;
  if (r.prose) ck(`2. [${p}] all ${r.prose} prose link(s) underlined`, r.bare.join(' | ') || 'none bare', 'none bare');
  ck(`2. [${p}] no control-shaped link is underlined`, r.controlsUnderlined.join(' | ') || 'none', 'none');
}
ok('2. the sweep actually covered the manual\'s prose links', proseTotal > 200, proseTotal);

console.log('\n--- 3. the underline still means something ---');
/* The idiom only carries information because its OPPOSITE holds: the thing
   that records an event is a pill and is never underlined. Check that on the
   tools that now carry LOG IT controls. */
for (const p of ['/procedures/', '/trauma/', '/codes/']) {
  await pg.goto(BASE + p + '?from=home', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(380);
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pg.waitForTimeout(180);
  const r = await pg.evaluate(() => {
    const logs = [...document.querySelectorAll('[data-logevent]')];
    return {
      n: logs.length,
      underlined: logs.filter(e => /underline/.test(getComputedStyle(e).textDecorationLine)).length,
      links: logs.filter(e => e.tagName === 'A').length
    };
  });
  if (!r.n) { console.log(`     [${p}] no log controls here`); continue; }
  ck(`3. [${p}] none of the ${r.n} log control(s) are underlined`, r.underlined, 0);
  ck(`3. [${p}] no log control is a bare <a> (a link navigates, a pill records)`, r.links, 0);
}


console.log('\n--- 4. the sanctioned dual-purpose control (ob-neonatal a.babyout) ---');
/* It both records and navigates, deliberately (DESIGN-SYSTEM.md §7). Pinned so
   nobody "fixes" it into two taps at the moment a baby is being delivered. */
await pg.goto(BASE + '/ob-neonatal/?from=home', { waitUntil: 'domcontentloaded' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
await pg.waitForTimeout(400);
const bo = pg.locator('a.babyout');
ck('4. the BABY IS OUT control still exists', await bo.count(), 1);
ck('4. it is shaped as a control, not prose (not underlined)',
   await bo.evaluate(e => /underline/.test(getComputedStyle(e).textDecorationLine)), false);
await bo.scrollIntoViewIfNeeded();
await bo.click();
await pg.waitForTimeout(700);
ck('4. one tap navigates to the neonatal engine', /\/neonatal\//.test(pg.url()), true);
const logged = await pg.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('lrh-case-log') || '[]');
  return l.some(e => e.label === 'BABY OUT' && !!e.tMs);
});
ck('4. and the SAME tap stamped the birth time into the case log', logged, true);
await pg.goBack({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(400);
ck('4. Back returns to ob-neonatal (interlinking must not trap the reader)',
   /\/ob-neonatal\//.test(pg.url()), true);

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
