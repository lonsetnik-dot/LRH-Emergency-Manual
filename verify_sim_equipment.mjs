/* LRH Emergency Manual — the sims as an orientation walk-through (/simulations/ × /equipment-readiness/).
 *
 * The claim being protected is a specific one: a new nurse who finds the pediatric pads during SIM 3
 * has established exactly the fact the readiness audit exists to establish, and should not have to
 * record it twice. So the two tools write ONE device-local record, and this suite drives the sim,
 * then opens the readiness tool in the same browser and asserts the fact arrived — rather than
 * trusting that both files include inventory.js.
 *
 * The other thing worth a test is quieter: a sim can only ask for equipment rows that exist. An id
 * typo in SIM_EQUIPMENT would render nothing at all, and an orientation checklist that silently
 * drops the chest tube is worse than no checklist.
 *
 * CONFIG-DRIVEN (#117): the row ids, the sims, and the expected counts are all read off the page's
 * own SIM_EQUIPMENT and inventory. A site that runs different sims, or stocks different sizes, is
 * still checked against its own config. Section 4 is what a fork must not localize away.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_sim_equipment.mjs
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

const errs = [], reqs = [];
/* ONE context for the whole run: the shared record lives in localStorage, and the point of the
   feature is that it crosses from one tool to the other on the same device. */
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });
pg.on('dialog', d => d.accept());

await pg.goto(BASE + '/simulations/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(300);

const CFG = await pg.evaluate(() => (typeof SITE === 'object' ? SITE : null));
const SIMEQ = await pg.evaluate(() => (typeof SIM_EQUIPMENT === 'object' ? SIM_EQUIPMENT : null));
if (!SIMEQ) { console.error('FATAL: /simulations/ does not expose SIM_EQUIPMENT'); process.exit(1); }
const INV = await pg.evaluate(() => ({
  rows: Object.keys(INV_ROWS), catalog: Object.keys(INV_CATALOG), key: INV_STORE_KEY,
  locations: INV_LOCATIONS, gaps: INV_GAP_ISSUES
}));
const simIds = Object.keys(SIMEQ);
const allRows = [...new Set(simIds.flatMap(s => SIMEQ[s]))];

/* ---- 1. loads clean, still offline-safe, still stamped ---- */
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. version and last-reviewed are stamped',
  new RegExp('v' + CFG.version + ' · last reviewed ' + CFG.lastReviewed).test(await pg.locator('.verstamp').first().innerText()), true);
ck('1. the in-situ sim safety banner is still the first thing on the page',
  /IN-SITU SIM SAFETY/.test(await pg.innerText('body')), true);

/* ---- 2. EVERY ROW A SIM ASKS FOR EXISTS ----
   The failure this catches is silent: a mistyped id renders nothing, so an orientation
   checklist quietly loses an item. The page marks unresolved ids instead of dropping them. */
ck('2. no sim asks for an inventory row that does not exist',
  (await pg.$$eval('[data-unknown]', els => els.map(e => e.getAttribute('data-unknown')))).join(',') || 'none', 'none');
const resolvable = allRows.filter(r => INV.rows.includes(r) || INV.catalog.includes(r));
ck('2. and every configured row resolves against the injected inventory', resolvable.length, allRows.length);
ck('2. every sim has a FIND IT block', await pg.locator('[data-simwalk]').count(), simIds.length);
for (const sid of simIds) {
  ck('2. ' + sid + ' renders one row per configured item',
    await pg.locator(`[data-simrows="${sid}"] .swrow`).count(), SIMEQ[sid].length);
}

/* Kits are listed at KIT level, never as contents. The sims say point, don't open — a sealed
   tray costs a full re-check to reseal, so a drill must never ask someone to tick its contents. */
ck('2. no sim asks anyone to open a kit and tick its contents',
  allRows.filter(r => r.includes('@')).length, 0);

/* ---- 3. THE ORIENTATION FLOW, END TO END ----
   Test targets are derived: the first configured row the manual has a location for, and the
   first it does not. A fork's own data picks its own case. */
await pg.click('#sw-expand');
const mapped = allRows.find(r => INV.locations[r] || INV.locations[r.split('#')[0]]);
const baseline = (INV.locations[mapped] || INV.locations[mapped.split('#')[0]]).loc;
const unmapped = allRows.find(r => !INV.locations[r] && !INV.locations[r.split('#')[0]] && !INV.gaps[r.split('#')[0]]);
const rowSel = r => `.swrow[data-row="${r.replace(/"/g, '\\"')}"]`;

const optLabels = await pg.$$eval(rowSel(mapped) + ' .swsel option', els => els.map(e => e.textContent));
ck('3. a mapped row offers the one-tap confirmation', optLabels.some(t => /^FOUND — where the manual says/.test(t)), true);
ck('3. an unmapped row offers no one-tap option — there is nothing to confirm',
  (await pg.$$eval(rowSel(unmapped) + ' .swsel option', els => els.map(e => e.textContent)))
    .some(t => /where the manual says/.test(t)), false);

await pg.selectOption(rowSel(mapped) + ' .swsel', 'here');
ck('3. one tap marks it FOUND', await pg.getAttribute(rowSel(mapped), 'data-state'), 'set');
ck('3. and records the manual\'s location without anyone typing it',
  (await pg.locator(rowSel(mapped) + ' .where').first().innerText()).includes(baseline), true);
ck('3. the row says which sim it was found in',
  /recorded at SIM /i.test(await pg.locator(rowSel(mapped) + ' .where').first().innerText()), true);

await pg.selectOption(rowSel(unmapped) + ' .swsel', 'gap');
ck('3. a missing item is logged as a gap from inside the drill',
  await pg.getAttribute(rowSel(unmapped), 'data-state'), 'gap');

const homeSim = simIds.find(s => SIMEQ[s].includes(mapped));
ck('3. that sim\'s counter moves',
  /1\/|[1-9]\d*\//.test(await pg.locator(`[data-simsum="${homeSim}"]`).innerText()), true);
ck('3. the orientation total counts across every sim',
  /of \d+ items found across every sim/.test(await pg.locator('#sw-total').innerText()), true);

await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
await pg.click('#sw-expand');
ck('3. what the drill recorded survives a reload', await pg.getAttribute(rowSel(mapped), 'data-state'), 'set');

/* ---- 4. THE INTEGRATION ITSELF — one record, two tools ----
   Asserted by crossing to the other tool in the same browser, not by trusting that both
   files include inventory.js. */
await pg.goto(BASE + '/equipment-readiness/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
const eqSel = r => `.eqrow[data-row="${r.replace(/"/g, '\\"')}"]`;
ck('4. the readiness audit shows the sim\'s find as RECORDED',
  (await pg.locator(eqSel(mapped) + ' .st').first().innerText()).trim(), 'RECORDED');
ck('4. the readiness audit shows the sim\'s gap as GAP',
  (await pg.locator(eqSel(unmapped) + ' .st').first().innerText()).trim(), 'GAP');

await pg.click('#btn-export');
const exp = await pg.inputValue('#exportbox');
ck('4. the export carries the location the drill confirmed',
  exp.includes('"' + mapped + '": { loc:"' + baseline + '" }'), true);
ck('4. and says the drill is where it was found, not a cart walk',
  /found at SIM /.test(exp), true);
ck('4. the gap is exported with its sim for provenance',
  new RegExp('GAP  ' + unmapped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,120}?SIM ').test(exp), true);

/* One store, one RESET. A second clear-button living in the sims would be a second thing to
   forget, and orientation data surviving a reset the champion thought was total is worse. */
ck('4. the sims expose no second reset of their own',
  await (await ctx.newPage().then(async p => { await p.goto(BASE + '/simulations/?from=home'); const n = await p.locator('button').filter({ hasText: /RESET/i }).count(); await p.close(); return n; })), 0);
await pg.click('#btn-reset');
await pg.waitForTimeout(200);
ck('4. RESET in the readiness tool clears what the sims recorded',
  await pg.evaluate(k => localStorage.getItem(k), INV.key), null);

await pg.goto(BASE + '/simulations/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
await pg.click('#sw-expand');
ck('4. and the sim rows fall back to the manual\'s baseline, not to blank',
  (await pg.locator(rowSel(mapped) + ' .where').first().innerText()).includes(baseline), true);

/* ---- 5. GOVERNANCE INVARIANTS ---- */
const fieldNames = await pg.$$eval('input,textarea,select', els =>
  els.map(e => [e.id, e.name, e.placeholder, e.getAttribute('aria-label')].join(' ').toLowerCase()).join(' | '));
ck('5. no field asks for patient identity (PHI guard)',
  /\b(mrn|medical record|patient name|patient id|dob|date of birth|ssn|first name|last name)\b/.test(fieldNames), false);
ck('5. the sim safety rule about real stock is still on the page',
  /never enter real stock/i.test(await pg.innerText('body')), true);
ck('5. the orientation block says sealed trays stay sealed',
  /Sealed trays stay sealed/i.test(await pg.innerText('body')), true);
ck('5. it points the user at the readiness tool to export',
  await pg.locator('#orient a[href*="equipment-readiness"]').count() > 0, true);

/* Sims stay out of the site-wide search (CLAUDE.md rule 9 exception): an orientation script
   must never surface next to a clinical card at the bedside. */
/* SEARCH_INDEX lives inside the landing page's IIFE rather than on window, so this reads the
   source: an index entry is a `u:"…"` target, which the category tile is not. */
const leaked = await (async () => {
  const p2 = await ctx.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  const html = await p2.content();
  await p2.close();
  return (html.match(/u:\s*"simulations\//g) || []).length;
})();
ck('5. no simulations entry leaked into the site search index', leaked, 0);

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
