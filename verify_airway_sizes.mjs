/* verify_airway_sizes.mjs — pediatric + neonatal airway equipment size guidance
   (peds/ card 16 · neonatal/ airway ladder · ob-neonatal/ equipment engine).

   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
         node verify_airway_sizes.mjs

   Config-driven (issue #117): every local number asserted here is READ from the
   page's own exposed config (window.SITE on peds/ and neonatal/, window.EQ_SIZES
   on ob-neonatal/) — never re-typed. Test weights are derived from the config
   band boundaries. Clinical invariants (tube sizes never shrink as the child
   grows, depth/suction derive from the tube, cuffed-preferred, the citations,
   the drawer-color contract) are written out literally — a fork must not be
   able to localize those away. A mutation pass changes config in-page and
   asserts the screen follows, proving no number is hand-typed in the UI.

   Set SHOTDIR to also capture the key rendered results as PNGs. */

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = process.env.BASE || 'http://localhost:8123';
const SHOTDIR = process.env.SHOTDIR || null;
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};
const ok = (name, cond, detail) => ck(name, cond ? true : (detail || false), true);
async function shot(el, name) {
  if (!SHOTDIR) return;
  try { await el.screenshot({ path: SHOTDIR + '/' + name + '.png' }); console.log('     shot: ' + name + '.png'); }
  catch (e) { console.log('     shot FAILED: ' + name + ' ' + e.message.split('\n')[0]); }
}

const errs = [], reqs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

/* ============================= 1 · peds/ card 16 ========================== */
await pg.goto(BASE + '/peds/?from=home', { waitUntil: 'networkidle' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await pg.reload({ waitUntil: 'networkidle' });

const P = await pg.evaluate(() => ({
  site: (typeof window.SITE === 'object') ? window.SITE : null,
  bands: (window.PEDS_WT && window.PEDS_WT.bands) ? window.PEDS_WT.bands : null
}));
ok('peds: exposes window.SITE with airway config', P.site && P.site.airway && P.site.airway.byBand);
ok('peds: PEDS_WT exposes the Broselow band table', Array.isArray(P.bands) && P.bands.length > 0);
if (!P.site || !P.site.airway || !P.bands) { console.error('FATAL: peds config not exposed'); process.exit(1); }
const A = P.site.airway;

/* invariant: every band the weight engine knows has a sizing row, and tube
   sizes never shrink as the bands (and the child) grow. */
let lastEtt = 0, allCovered = true, monotonic = true;
for (const bd of P.bands) {
  const sz = A.byBand[bd.name];
  if (!sz) { allCovered = false; continue; }
  if (sz.ett < lastEtt) monotonic = false;
  lastEtt = sz.ett;
}
ok('peds invariant: every Broselow band has a byBand sizing entry', allCovered);
ok('peds invariant: ETT size never decreases up the bands', monotonic);
ok('peds invariant: depth and suction multipliers are positive', A.depthPerId > 0 && A.suctionPerId > 0);
ok('peds invariant: cuffed formula addon below uncuffed addon', A.cuffedIdAddon < A.uncuffedIdAddon);

async function setPedsWeight(kg) {
  await pg.fill('#wtkg', kg === null ? '' : String(kg));
  await pg.dispatchEvent('#wtkg', 'input');
  await pg.waitForTimeout(60);
}
const fmtId = n => (Math.round(n * 10) / 10).toFixed(1);
const depth = id => Math.round(id * A.depthPerId * 10) / 10;
const sFr = id => Math.round(id * A.suctionPerId);

/* every band, entered at its lower bound: chip names the drawer, chip carries
   the drawer color, and each tile matches config-derived values. */
for (const bd of P.bands) {
  const sz = A.byBand[bd.name]; if (!sz) continue;
  await setPedsWeight(bd.lo);
  const t = await pg.evaluate(() => document.getElementById('airsizes').innerText);
  ok('peds ' + bd.name + ' @' + bd.lo + 'kg: chip says PULL THE ' + bd.name + ' DRAWER', t.includes('PULL THE ' + bd.name + ' DRAWER'));
  ok('peds ' + bd.name + ': ETT ' + fmtId(sz.ett) + ' mm shown', t.includes(fmtId(sz.ett) + ' mm'));
  ok('peds ' + bd.name + ': depth ' + depth(sz.ett) + ' cm shown', t.includes(depth(sz.ett) + ' cm'));
  ok('peds ' + bd.name + ': suction ' + sFr(sz.ett) + ' Fr shown', t.includes(sFr(sz.ett) + ' Fr'));
  ok('peds ' + bd.name + ': blade "' + sz.blade + '" shown', t.includes(sz.blade));
  ok('peds ' + bd.name + ': supraglottic ' + sz.sga + ' shown', t.includes(sz.sga));
  const chipBg = await pg.evaluate(() => {
    const chip = document.querySelector('#airsizes > div');
    return chip ? getComputedStyle(chip).backgroundColor : '';
  });
  const hex = bd.mid.replace('#', '');
  const rgb = 'rgb(' + parseInt(hex.slice(0, 2), 16) + ', ' + parseInt(hex.slice(2, 4), 16) + ', ' + parseInt(hex.slice(4, 6), 16) + ')';
  ck('peds ' + bd.name + ': chip background is the drawer color ' + bd.mid, chipBg, rgb);
}

/* contiguity: a weight in the printed gap between two zones belongs to the
   LOWER zone's drawer (a 5.5 kg child still gets a drawer). */
for (let i = 0; i < P.bands.length - 1; i++) {
  const gapW = (P.bands[i].hi + P.bands[i + 1].lo) / 2;
  if (gapW <= P.bands[i].hi) continue; /* zones touch — no gap */
  await setPedsWeight(gapW);
  const t = await pg.evaluate(() => document.getElementById('airsizes').innerText);
  ok('peds contiguity: ' + gapW + ' kg falls in ' + P.bands[i].name, t.includes('PULL THE ' + P.bands[i].name + ' DRAWER'));
}

/* off both ends of the tape: hand off, never guess. */
await setPedsWeight(Math.round((P.bands[0].lo - 0.5) * 10) / 10);
let t = await pg.evaluate(() => document.getElementById('airsizes').innerText + '|' + document.getElementById('airsizes').innerHTML);
ok('peds floor: below ' + P.bands[0].lo + ' kg routes to the newborn tool', t.includes('../neonatal/'));
await setPedsWeight(P.bands[P.bands.length - 1].hi + 1);
t = await pg.evaluate(() => document.getElementById('airsizes').innerHTML);
ok('peds ceiling: above ' + P.bands[P.bands.length - 1].hi + ' kg routes to the adult airway tool', t.includes('../airway/'));

/* age cross-check: an age consistent with the drawer pick says so; an age a
   half-size off warns. Ages derived from config, not typed. */
const midBand = P.bands[Math.floor(P.bands.length / 2)];
const midSz = A.byBand[midBand.name];
const agreeYrs = Math.max(1, Math.round((midSz.ett - A.cuffedIdAddon) * 4));
await setPedsWeight(midBand.lo);
await pg.fill('#wtage', String(agreeYrs));
await pg.dispatchEvent('#wtage', 'input');
await pg.waitForTimeout(60);
t = await pg.evaluate(() => document.getElementById('airsizes').innerText);
ok('peds age check: consistent age (' + agreeYrs + ' y) reads consistent', t.includes('consistent with the drawer pick'));
await pg.fill('#wtage', String(agreeYrs + 8));
await pg.dispatchEvent('#wtage', 'input');
await pg.waitForTimeout(60);
t = await pg.evaluate(() => document.getElementById('airsizes').innerText);
ok('peds age check: discordant age (' + (agreeYrs + 8) + ' y) warns to re-check', t.includes('re-check the weight and the age'));
await pg.fill('#wtage', '');
await pg.dispatchEvent('#wtage', 'input');

/* full ladder table: one row per configured band, active row highlighted. */
await setPedsWeight(midBand.lo);
const tbl = await pg.evaluate(() => ({
  rows: document.querySelectorAll('#airtable tbody tr').length,
  hl: document.querySelectorAll('#airtable tbody tr.hl').length,
  hlText: (document.querySelector('#airtable tbody tr.hl') || {}).innerText || ''
}));
ck('peds ladder: one table row per configured band', tbl.rows, P.bands.filter(bd => A.byBand[bd.name]).length);
ck('peds ladder: exactly one highlighted row', tbl.hl, 1);
ok('peds ladder: highlighted row is ' + midBand.name, tbl.hlText.includes(midBand.name));

/* the words a fork must not localize away (open the collapsed sections first —
   innerText skips unrendered content) */
const cardText = await pg.evaluate(() => {
  document.querySelectorAll('#p16 details').forEach(d => { d.open = true; });
  return document.getElementById('p16').innerText;
});
ok('peds cites PALS 2020 (Circulation 2020;142:S469)', /Circulation.*2020;142:S469/.test(cardText));
ok('peds invariant: cuffed tube first-line language present', cardText.includes('Cuffed tube first-line'));
ok('peds invariant: capnography confirmation present', /capnography/i.test(cardText));
ok('peds invariant: DOPE present', cardText.includes('DOPE'));
ok('peds invariant: cuff pressure ceiling shown from config', cardText.includes('under ' + A.cuffMaxCmH2O + ' cm H'));
ok('peds invariant: drawer contents beat formulas', /drawer.{0,30}(win|packed sizes win)/i.test(cardText));
const stamp = await pg.evaluate(() => document.querySelector('#p16 .verstamp').textContent);
ok('peds verstamp carries SITE.version', stamp.includes('v' + P.site.version) && stamp.includes(P.site.lastReviewed));

/* screenshots of the key results */
if (SHOTDIR) {
  const white = P.bands.find(x => x.name === 'WHITE') || midBand;
  await setPedsWeight(white.lo + 1);
  await pg.evaluate(() => document.getElementById('p16').scrollIntoView());
  await pg.waitForTimeout(150);
  await shot(pg.locator('#p16'), 'peds-p16-' + (white.lo + 1) + 'kg-' + white.name.toLowerCase());
  const blue = P.bands.find(x => x.name === 'BLUE');
  if (blue) { await setPedsWeight(blue.lo + 1); await pg.waitForTimeout(120); await shot(pg.locator('#airsizes'), 'peds-tiles-' + (blue.lo + 1) + 'kg-blue'); }
  await setPedsWeight(2.5); await pg.waitForTimeout(120);
  await shot(pg.locator('#airsizes'), 'peds-under-3kg-offramp');
}

/* mutation pass: change config in-page → the screen must follow. */
await setPedsWeight(P.bands[P.bands.length - 1].lo);
const mut = await pg.evaluate(() => {
  const last = window.PEDS_WT.bands[window.PEDS_WT.bands.length - 1];
  window.SITE.airway.byBand[last.name].ett = 7.0;
  window.PEDSAIR.recompute(window.PEDS_WT.getKg());
  return document.getElementById('airsizes').innerText;
});
ok('peds mutation: localized ETT 7.0 flows to the tile', mut.includes('7.0 mm'));
ok('peds mutation: depth follows the localized tube', mut.includes((Math.round(7.0 * A.depthPerId * 10) / 10) + ' cm'));
ok('peds mutation: suction follows the localized tube', mut.includes(Math.round(7.0 * A.suctionPerId) + ' Fr'));

ck('peds: zero console/page errors', errs.length, 0);
ck('peds: zero off-origin requests', reqs.length, 0);
errs.length = 0; reqs.length = 0;

/* ============================ 2 · neonatal/ ladder ======================== */
await pg.goto(BASE + '/neonatal/', { waitUntil: 'networkidle' });
const N = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
ok('neonatal: exposes window.SITE', !!N);
ok('neonatal: every airway row carries mask and suction', N.airway.every(r => r.mask && r.suction));
ok('neonatal: oroSuction configured', !!N.oroSuction);

/* neonatal's reference accordions are custom buttons (data-acc), content built
   only while open — drive the real control. */
async function neoAcc(re) {
  await pg.evaluate(pat => {
    const btn = Array.from(document.querySelectorAll('button[data-acc]'))
      .find(x => new RegExp(pat, 'i').test(x.textContent));
    if (btn) btn.click();
  }, re.source);
  await pg.waitForTimeout(700); /* accordion body renders on the paint loop */
  return pg.evaluate(() => {
    const body = document.querySelector('.accb');
    return body ? body.innerText : '';
  });
}
let ladder = await neoAcc(/WHICH AIRWAY FITS/);
ok('neonatal: WHICH AIRWAY FITS accordion renders', ladder.length > 0);
for (const r of N.airway) {
  ok('neonatal ladder row "' + r.note + '": mask ' + r.mask, ladder.includes('mask ' + r.mask));
  ok('neonatal ladder row "' + r.note + '": ETT suction ' + r.suction, ladder.includes('ETT suction ' + r.suction));
}
ok('neonatal ladder: mouth/nose suction note from config', ladder.includes(N.oroSuction));
ok('neonatal ladder: depth rule from config (+' + N.ettDepthAddCm + ' cm)', ladder.includes(N.ettDepthAddCm + ' cm'));

/* weight entry highlights the right row (this baby) — the ladder is open from
   the neoAcc call above; entering a weight repaints it. */
await pg.click('#wtoggle');
await pg.fill('#wIn', '3.2');
await pg.dispatchEvent('#wIn', 'input');
await pg.waitForTimeout(700);
ladder = await pg.evaluate(() => {
  const body = document.querySelector('.accb');
  return body ? body.innerText : '';
});
ok('neonatal: 3.2 kg highlights a "this baby" row', ladder.includes('this baby'));
if (SHOTDIR) {
  await pg.evaluate(() => { const b = document.querySelector('.accb'); if (b) b.scrollIntoView(); });
  await pg.waitForTimeout(150);
  await shot(pg.locator('.accb'), 'neonatal-airway-ladder-3.2kg');
}
const prov = await neoAcc(/SOURCE|PROVENANCE/);
ok('neonatal: provenance names the added mask/suction columns', /mask and suction-catheter/i.test(prov));
ck('neonatal: zero console/page errors', errs.length, 0);
errs.length = 0; reqs.length = 0;

/* ========================= 3 · ob-neonatal/ engine ======================== */
await pg.goto(BASE + '/ob-neonatal/?from=home', { waitUntil: 'networkidle' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
const EQ = await pg.evaluate(() => (typeof window.EQ_SIZES === 'object' ? window.EQ_SIZES : null));
ok('ob-neonatal: exposes window.EQ_SIZES', !!EQ);
ok('ob-neonatal: 4 bands in every sizing array',
  EQ && ['ETT', 'blade', 'mask', 'suction', 'depthGA'].every(k => Array.isArray(EQ[k]) && EQ[k].length === 4));

/* band boundaries are the engine's own <1 / <2 / <3 / ≥3 kg rule (clinical
   invariant, written out); expected sizes come from EQ_SIZES. */
async function obPanel(kg) {
  await pg.evaluate(w => {
    localStorage.setItem('lrh-ob-weight', String(w));
    const el = document.querySelector('.wt-sync');
    if (el) { el.value = String(w); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }, kg);
  await pg.waitForTimeout(120);
  return pg.evaluate(() => (document.querySelector('.eqpanel') || {}).innerText || '');
}
const obCases = [[0.9, 0], [1.5, 1], [2.5, 2], [3.5, 3]];
for (const [kg, band] of obCases) {
  const p = await obPanel(kg);
  ok('ob-neonatal @' + kg + 'kg: ETT ' + EQ.ETT[band], p.includes(EQ.ETT[band]));
  ok('ob-neonatal @' + kg + 'kg: mask ' + EQ.mask[band], p.includes(EQ.mask[band]));
  ok('ob-neonatal @' + kg + 'kg: suction ' + EQ.suction[band], p.includes(EQ.suction[band]));
  ok('ob-neonatal @' + kg + 'kg: blade ' + EQ.blade[band], p.includes(EQ.blade[band]));
}
const p35 = await obPanel(3.5);
ok('ob-neonatal invariant: mouth suction guidance on the suction tile', /mouth: 10–12 Fr or bulb/.test(p35));
ok('ob-neonatal invariant: mask seal landmark shown', /bridge of nose to chin/.test(p35));

if (SHOTDIR) {
  await obPanel(3.5);
  await pg.evaluate(() => document.querySelector('.eqpanel').scrollIntoView());
  await pg.waitForTimeout(120);
  await shot(pg.locator('.eqpanel'), 'ob-neonatal-eqpanel-3.5kg-term');
  await obPanel(0.9);
  await pg.waitForTimeout(120);
  await shot(pg.locator('.eqpanel'), 'ob-neonatal-eqpanel-0.9kg-preterm');
}

/* mutation pass: a fork edits EQ_SIZES → the tiles must follow. */
const obMut = await pg.evaluate(() => {
  window.EQ_SIZES.suction[3] = '9 Fr';
  const el = document.querySelector('.wt-sync');
  el.value = '3.6'; el.dispatchEvent(new Event('input', { bubbles: true }));
  return (document.querySelector('.eqpanel') || {}).innerText || '';
});
ok('ob-neonatal mutation: localized suction 9 Fr flows to the tile', obMut.includes('9 Fr'));

ck('ob-neonatal: zero console/page errors', errs.length, 0);
ck('ob-neonatal: zero off-origin requests', reqs.length, 0);

/* ================= 4 · just-in-time links where airways get controlled ==== */
/* arrest engine: pediatric weight → AIRWAY SIZES chip next to the drawer chip,
   deep-linking to peds/#p16 (weight is shared, so the card lands pre-filled). */
await pg.goto(BASE + '/arrest/', { waitUntil: 'networkidle' });
await pg.evaluate(() => {
  try { localStorage.clear(); localStorage.setItem('lrh-case-wtkg', '19'); localStorage.setItem('lrh-case-wtsrc', 'measured'); } catch (e) {}
});
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
const chip = await pg.evaluate(() => {
  const el = document.getElementById('airchip');
  return el ? { shown: getComputedStyle(el).display !== 'none', href: el.getAttribute('href'), text: el.innerText } : null;
});
ok('arrest: AIRWAY SIZES chip exists', !!chip);
ok('arrest: chip visible in pediatric mode (19 kg)', chip && chip.shown);
ok('arrest: chip deep-links to peds card 16', chip && chip.href === '../peds/?from=arrest#p16');
ok('arrest: chip names ETT/blade/suction', chip && /ETT/.test(chip.text) && /blade/.test(chip.text) && /suction/.test(chip.text));
if (SHOTDIR && chip && chip.shown) {
  await pg.evaluate(() => document.getElementById('airchip').scrollIntoView({ block: 'center' }));
  await pg.waitForTimeout(120);
  await shot(pg.locator('#brosechip'), 'arrest-drawer-chip-19kg');
  await shot(pg.locator('#airchip'), 'arrest-airway-sizes-chip-19kg');
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(120);
  await shot(pg, 'arrest-full-screen-19kg'); /* full viewport: chip in context */
}
/* adult weight hides it */
await pg.evaluate(() => { try { localStorage.setItem('lrh-case-wtkg', '80'); } catch (e) {} });
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
ok('arrest: chip hidden in adult mode (80 kg)', await pg.evaluate(() =>
  getComputedStyle(document.getElementById('airchip')).display === 'none'));
ck('arrest: zero console/page errors', errs.length, 0);
errs.length = 0; reqs.length = 0;

/* tca: workstream A carries the pediatric-sizes link */
await pg.goto(BASE + '/tca/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(200);
ok('tca: workstream A links to peds card 16', await pg.evaluate(() =>
  !!document.querySelector('a[href="../peds/?from=tca#p16"]') ||
  document.body.innerHTML.includes('../peds/?from=tca#p16')));
ck('tca: zero console/page errors', errs.length, 0);
errs.length = 0;

/* airway (adult DAS ladder): scope bar carries the pediatric off-ramp */
await pg.goto(BASE + '/airway/', { waitUntil: 'networkidle' });
ok('airway: scope bar links pediatric patients to peds card 16', await pg.evaluate(() => {
  const sb = document.getElementById('scopebar');
  return !!(sb && sb.querySelector('a[href="../peds/?from=airway#p16"]'));
}));
ck('airway: zero console/page errors', errs.length, 0);
errs.length = 0;

/* trauma: primary-survey A item + burn airway line */
await pg.goto(BASE + '/trauma/', { waitUntil: 'networkidle' });
ck('trauma: two airway decision points link to peds card 16',
  await pg.evaluate(() => document.querySelectorAll('a[href="../peds/?from=trauma#p16"]').length), 2);
errs.length = 0;

/* codes: RSI equipment item (c06) + respiratory-arrest escalation (c05) */
await pg.goto(BASE + '/codes/', { waitUntil: 'networkidle' });
ok('codes c06: RSI equipment item links to peds card 16', await pg.evaluate(() =>
  !!document.querySelector('#c06 a[href="../peds/?from=codes#p16"]')));
ok('codes c05: respiratory-arrest escalation links to peds card 16', await pg.evaluate(() =>
  !!document.querySelector('#c05 a[href="../peds/?from=codes#p16"]')));
errs.length = 0; reqs.length = 0;

/* peds: every intubation decision point links to card 16 */
await pg.goto(BASE + '/peds/?from=home', { waitUntil: 'networkidle' });
for (const card of ['p02', 'p03', 'p04', 'p05', 'p06', 'p08', 'p10', 'p14', 'p15']) {
  ok('peds ' + card + ': links to card 16 at its airway decision point', await pg.evaluate(id =>
    !!document.querySelector('#' + id + ' a[href="#p16"]'), card));
}
/* the zone chip in the sticky weight bar links to card 16 whenever a band is
   in effect — the from-anywhere path */
await pg.fill('#wtkg', '19');
await pg.dispatchEvent('#wtkg', 'input');
await pg.waitForTimeout(100);
ok('peds: zone chip links to card 16 (from-anywhere path)', await pg.evaluate(() =>
  !!document.querySelector('#wtzone a[href="#p16"]')));
ok('peds: zone chip advertises AIRWAY SIZES', await pg.evaluate(() =>
  /AIRWAY SIZES/.test(document.getElementById('wtzone').innerText)));
if (SHOTDIR) await shot(pg.locator('#wtbar'), 'peds-weight-bar-zone-chip-19kg');

/* the arrest deep link must land on the sizes, not the consent splash */
await pg.goto(BASE + '/peds/?from=arrest#p16', { waitUntil: 'networkidle' });
await pg.waitForTimeout(600); /* the post-load re-anchor fires ~150 ms after load */
ok('peds: ?from=arrest#p16 skips the beta splash', await pg.evaluate(() => !document.getElementById('betasplash')));
ok('peds: deep link lands with card 16 in view', await pg.evaluate(() => {
  const r = document.getElementById('p16').getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}));

/* ===================== 5 · landing page search surfacing ================== */
await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
async function search(q) {
  await pg.fill('#q', q);
  await pg.dispatchEvent('#q', 'input');
  await pg.waitForTimeout(120);
  return pg.evaluate(() => document.body.innerText);
}
const qEl = await pg.evaluate(() => !!document.getElementById('q'));
if (qEl) {
  for (const q of ['ett size', 'blade size', 'broselow drawer']) {
    const r = await search(q);
    ok('search "' + q + '" surfaces Pediatric Airway Equipment Sizes', r.includes('Pediatric Airway Equipment Sizes'));
  }
  const r2 = await search('neonatal mask size');
  ok('search "neonatal mask size" surfaces the neonatal engine', r2.includes('Neonatal resuscitation'));
} else {
  console.log('NOTE: landing search input #q not found — search checks skipped');
  ok('landing search input present', false);
}

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
