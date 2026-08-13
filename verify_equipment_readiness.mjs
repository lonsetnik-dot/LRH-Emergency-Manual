/* ED Emergency Manual — /equipment-readiness/ : the readiness walk sheet.
 *
 * This tool is the one place in the manual where a clinician WRITES rather than reads, and what they
 * write is the department's claim about where its equipment is. Two failure modes matter more than
 * anything cosmetic:
 *
 *   1. A row that silently loses what someone recorded. A cart walk is an hour of a charge nurse's
 *      shift; losing it once means it never happens again.
 *   2. A row that reads "MAPPED" when nobody has looked. NOT REVIEWED and GAP are different claims —
 *      "we don't stock it" is an assertion someone has to make, not a default.
 *
 * So this suite drives the real controls, reloads the page, and asserts what survived — rather than
 * only counting DOM nodes.
 *
 * CONFIG-DRIVEN (the #117 convention): every expectation about WHICH items, WHICH sizes and WHICH
 * locations comes from the page's own injected inventory. A fork that stocks i-gel 3–5 only, calls
 * its cabinet something else, or drops a standard it has no service for stays green. What is written
 * out here is what a fork must NOT be able to localize away — see section 4.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_equipment_readiness.mjs
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
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });
pg.on('dialog', d => d.accept());

const openAll = () => pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
await pg.goto(BASE + '/equipment-readiness/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
await openAll();

/* ---- read the tool's own config + inventory; every number below derives from it ---- */
const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /equipment-readiness/ does not expose window.SITE'); process.exit(1); }
const INV = await pg.evaluate(() => ({
  catalog:   INV_CATALOG,
  standards: Object.keys(INV_STANDARDS).map(k => ({ id:k, ...INV_STANDARDS[k] })),
  rows:      Object.keys(INV_ROWS),
  locations: INV_LOCATIONS,
  gaps:      INV_GAP_ISSUES,
  categories: INV_CATEGORIES.map(c => c[0])
}));

/* ---- 1. loads clean, offline-safe, stamped ---- */
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. version and last-reviewed are stamped',
  new RegExp('v' + CFG.version + ' · last reviewed ' + CFG.lastReviewed).test(await pg.locator('.verstamp').first().innerText()), true);
ck('1. the standard disclaimer is present',
  /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await pg.innerText('body')), true);

/* ---- 2. CONFIG-DRIVEN COVERAGE: the page audits exactly what the inventory says ----
   Every catalog item must be reachable, and every size must be its own row. Derived
   entirely from the injected data, so a fork that adds, drops or re-sizes an item is
   still checked against its own config rather than against this site's. */
const domRows    = await pg.$$eval('.eqrow[data-row]', els => els.map(e => e.getAttribute('data-row')));
const domRowSet  = new Set(domRows);
const kitIds     = Object.keys(INV.catalog).filter(id => INV.catalog[id].cat === 'kit');
const nonKitRows = INV.rows.filter(r => INV.catalog[r.split('#')[0]].cat !== 'kit');

ck('2. every size in the catalog has its own audit row',
  nonKitRows.filter(r => !domRowSet.has(r)).length, 0);
ck('2. every kit has a row for the kit itself',
  kitIds.filter(id => !domRowSet.has(id)).length, 0);
ck('2. every kit content line has its own row',
  kitIds.filter(id => (INV.catalog[id].contents || []).some((_, i) => !domRowSet.has(id + '@' + i))).length, 0);
ck('2. no row carries two controls (one row, one place to set it)',
  domRows.length - domRowSet.size, 0);

/* Sizes must actually be sizes, not one lumped row: any item the config gives sizes to
   contributes exactly that many rows and no bare row. */
const sized = Object.keys(INV.catalog).filter(id => (INV.catalog[id].sizes || []).length);
ck('2. sized items are audited per size, never lumped',
  sized.filter(id => domRowSet.has(id) || INV.catalog[id].sizes.some(s => !domRowSet.has(id + '#' + s))).length, 0);
ck('2. the catalog does size the airway rescue devices (a lumped SGA row is the bug this replaced)',
  sized.length > 10, true);

/* ---- 3. THE CAPTURE ACTUALLY WORKS — drive it, reload, assert what survived ----
   Test inputs are DERIVED: the first sized non-kit item in the config, and the first
   item the config leaves unmapped. A fork's own data picks its own test case. */
const probeRow  = nonKitRows.find(r => r.includes('#') && INV.locations[r.split('#')[0]]);
const probeItem = probeRow.split('#')[0];
const unmapped  = INV.rows.find(r => !INV.locations[r] && !INV.locations[r.split('#')[0]] && !INV.gaps[r.split('#')[0]]);
const TYPED     = 'TEST BAY · SHELF ' + INV.rows.length;   /* derived, never a real this site location */

const rowSel = r => `.eqrow[data-row="${r.replace(/"/g, '\\"')}"]`;
await pg.selectOption(rowSel(probeRow) + ' .eqsel', 'loc');
ck('3. choosing a location reveals the free-text field',
  await pg.locator(rowSel(probeRow) + ' .eqloc').isVisible(), true);
ck('3. the field is prefilled with the manual\'s own baseline for that row',
  await pg.inputValue(rowSel(probeRow) + ' .eqloc'), INV.locations[probeItem].loc);
await pg.fill(rowSel(probeRow) + ' .eqloc', TYPED);
ck('3. the typed location shows on the row immediately',
  (await pg.locator(rowSel(probeRow) + ' .where').first().innerText()).includes(TYPED), true);

await pg.selectOption(rowSel(unmapped) + ' .eqsel', 'gap');
ck('3. a row can be declared a GAP', await pg.getAttribute(rowSel(unmapped), 'data-state'), 'gap');

await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
await openAll();
ck('3. the typed location survives a reload', await pg.inputValue(rowSel(probeRow) + ' .eqloc'), TYPED);
ck('3. the GAP survives a reload', await pg.getAttribute(rowSel(unmapped), 'data-state'), 'gap');
ck('3. the row reads RECORDED, not MAPPED, once a human set it',
  (await pg.locator(rowSel(probeRow) + ' .st').first().innerText()).trim(), 'RECORDED');

/* An unreviewed row must not claim to be anything. This is the whole point of the
   NOT REVIEWED state: a blank row is not a gap and is not a location. */
const stillNew = INV.rows.find(r => r !== unmapped && !INV.locations[r] && !INV.locations[r.split('#')[0]] && !INV.gaps[r.split('#')[0]]);
if (stillNew) {
  ck('3. an untouched unmapped row reads NOT REVIEWED, not GAP and not MAPPED',
    (await pg.locator(rowSel(stillNew) + ' .st').first().innerText()).trim(), 'NOT REVIEWED');
}

/* ---- 3b. the export is the hand-back into inventory.js ---- */
await pg.fill('#walklabel', 'suite walk');
await pg.click('#btn-export');
const exp = await pg.inputValue('#exportbox');
ck('3b. export names the row and the typed location as a paste-ready LOCATIONS line',
  exp.includes('"' + probeRow + '": { loc:"' + TYPED + '" }'), true);
ck('3b. export lists the gap for an issue', exp.includes('GAP  ' + unmapped), true);
ck('3b. export carries the walk label', exp.includes('suite walk'), true);

/* ---- 3c. RESET clears the device, and only the device ---- */
await pg.click('#btn-reset');
await pg.waitForTimeout(200);
ck('3c. RESET clears the browser store', await pg.evaluate(k => localStorage.getItem(k), CFG.storeKey), null);
ck('3c. RESET returns the row to the manual\'s baseline, not to blank',
  (await pg.locator(rowSel(probeRow) + ' .where').first().innerText()).includes(INV.locations[probeItem].loc), true);

/* ---- 4. CLINICAL / GOVERNANCE INVARIANTS — a fork must not localize these away ---- */

/* Nothing patient-identifying may be collected. The tool holds equipment state only. */
const fieldNames = await pg.$$eval('input,textarea,select', els =>
  els.map(e => [e.id, e.name, e.placeholder, e.getAttribute('aria-label')].join(' ').toLowerCase()).join(' | '));
/* Identity tokens only — the catalog legitimately contains the word "patient"
   (patient warming, patient poster), and a guard that trips on it would be
   turned off rather than fixed. */
ck('4. no field asks for patient identity (PHI guard)',
  /\b(mrn|medical record|patient name|patient id|dob|date of birth|nhs number|ssn|first name|last name)\b/.test(fieldNames), false);
ck('4. no field collects a date or a contact detail either',
  await pg.$$eval('input', els => els.some(e => ['date','datetime-local','tel','email'].includes(e.type))), false);
ck('4. the walk-label field says in words that patient information does not go here',
  /never patient information/i.test(await pg.innerText('body')), true);

/* Every standard on screen must carry its citation — rule 5, show the logic and cite it. */
const citeText = await pg.innerText('#sources');
for (const s of INV.standards) {
  ck('4. ' + s.id + ' is cited on the page', citeText.includes(s.cite.slice(0, 60)), true);
}
ck('4. more than one national standard is scored (NPRP alone is the pediatric list only)',
  INV.standards.length > 1, true);
ck('4. a pediatric standard is scored', INV.standards.some(s => /pediatric|NPRP/i.test(s.id + s.name)), true);
ck('4. a trauma standard is scored', INV.standards.some(s => /trauma|ACS/i.test(s.id + s.name)), true);

/* A standard whose source states capability rather than printing a parts list must SAY so
   on screen, right where its rows are — otherwise the manual's reading gets quoted back as
   the standard's own words at a survey. */
const narrative = INV.standards.filter(s => s.kind === 'narrative');
for (const s of narrative) {
  const box = await pg.locator('#s-' + s.id + ' .t-localize').first().innerText().catch(() => '');
  ck('4. ' + s.id + ' is labeled as not a verbatim list', /NOT A VERBATIM LIST/.test(box), true);
}

/* Scoring invariants: readiness is claimed only for rows a human has confirmed, and an
   item asserted absent in source is a GAP with an issue behind it. */
const gapId = Object.keys(INV.gaps)[0];
const gapRow = (INV.catalog[gapId].sizes || []).length ? gapId + '#' + INV.catalog[gapId].sizes[0] : gapId;
ck('4. an item filed as a coverage-gap issue shows as GAP',
  (await pg.locator(rowSel(gapRow) + ' .st').first().innerText()).trim(), 'GAP');
ck('4. and links the issue that tracks it',
  await pg.locator(rowSel(gapRow) + ' .where a[href*="/issues/' + INV.gaps[gapId] + '"]').count() > 0, true);

const lead = await pg.locator('#score-lead').innerText();
ck('4. the scorecard states the standards count from the config',
  lead.includes('across ' + INV.standards.length + ' standards'), true);
ck('4. readiness is defined as human-confirmed, in words, on the scorecard',
  /ready only when a human has confirmed/.test(lead), true);

/* Kits are audited as kits: the kit's own location, then its contents underneath it. */
const kitWithContents = kitIds.find(id => (INV.catalog[id].contents || []).length);
ck('4. kits are grouped, not scattered through the item list',
  await pg.locator('#k-' + kitWithContents + ' .eqrow[data-row]').count(),
  1 + INV.catalog[kitWithContents].contents.length);

/* ---- 5. search reaches a size and a kit content line ---- */
const searchHits = async term => {
  await pg.fill('#eq', term);
  await pg.waitForTimeout(120);
  return pg.$$eval('#eqresults li', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
};
const sizedProbe = INV.catalog[probeItem].sizes[0];
ck('5. searching a size finds that size\'s row',
  (await searchHits(String(sizedProbe).split(' ')[0].toLowerCase())).length > 0, true);
const contentProbe = INV.catalog[kitWithContents].contents[0];
ck('5. searching a kit content line finds it',
  (await searchHits(contentProbe.slice(0, 12).toLowerCase())).some(t => t.includes(contentProbe.slice(0, 12))), true);
await pg.fill('#eq', '');

/* ---- 6. the walk prints — collapsed sections included ---- */
const pdf = await pg.pdf({ format: 'Letter', printBackground: true });
ck('6. the walk sheet renders to paper', pdf.length > 20000, true);
const printablePages = Number((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length);
ck('6. and it is a multi-page walk sheet, not one truncated page', printablePages > 3, true);

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
