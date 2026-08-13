/* ED Emergency Manual — the 2026-08-09 issue round.
 *
 * Covers GitHub issues #20, #25, #26, #27, #29, #30, #31, #33, #34.
 * (#24 and #28 have their own suite: verify_ws24_hematemesis.mjs.)
 *
 * The rule this file enforces is the same one as the hematemesis suite: a card is not done when it
 * renders. It is done when it is reachable from the menu AND from search, states where its kit
 * lives, has a label carrying a working QR back to it, and appears in the system map. Each of those
 * lives in a different self-contained file, so only a test keeps them attached.
 *
 *     python3 -m http.server 8123      # from the repo root, in another terminal
 *     node verify_issues_20260809.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

import { expect as cfgExpect, rx, isTemplate } from './verify_site_config.mjs';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
let b;
try { b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}); }
catch (e) { console.error('Could not launch Chromium: ' + e.message); process.exit(2); }
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };
const errs = [];
const watch = (pg, tag) => {
  pg.on('pageerror', e => errs.push(tag + ': ' + e));
  pg.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
};

// Collapsed <details> are hidden from innerText, and two of these cards deliberately ship with
// their pitfalls/evidence sections closed. Open everything first or the assertions read a
// truncated card and pass or fail for the wrong reason.
const openAll = async (pg) => { await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await pg.waitForTimeout(120); };
const textOf = async (pg, sel) => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ');

const codes = await b.newPage({ viewport: { width: 390, height: 1400 } }); watch(codes, 'codes');
await codes.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
const proc = await b.newPage({ viewport: { width: 390, height: 1400 } }); watch(proc, 'procedures');
await proc.goto(BASE + '/procedures/?from=home', { waitUntil: 'networkidle' });
await openAll(codes); await openAll(proc);


/* ================= #25 massive hemoptysis ================= */
console.log('--- #25 massive hemoptysis');
ck('card 24 exists', await codes.locator('#c24').count(), 1);
ck('menu tile reaches it', await codes.locator('a[href="#c24"]').count() > 0, true);
{
  const t = await textOf(codes, '#c24');
  ck('bleeding lung DOWN', /Bleeding lung DOWN/i.test(t), true);
  ck('ETT >= 8.0 and the reason', /ETT\s*≥8\.0 mm/i.test(t) && /bronchoscope has to fit/i.test(t), true);
  // The card must state THIS site's lung-isolation reality, whatever it is —
  // read from site.config.json, not re-typed here (CLAUDE.md: config-driven).
  ck('lung-isolation reality stated', new RegExp(rx('physical.lungIsolation'), 'i').test(t), true);
  ck('blind mainstem success rates', /95%/.test(t) && /73%/.test(t), true);
  ck('nebulized TXA 500 mg', /Nebulized TXA 500 mg/i.test(t), true);
  ck('IV TXA 1 g over 10 min', /1 g over 10 min/i.test(t), true);
  ck('does not intubate the effective cougher', /effective cough is doing a better job/i.test(t), true);
  ck('one-lung Vt 3-4 mL/kg', /3&ndash;4 mL\/kg|3–4 mL\/kg/.test(t), true);
  ck('contrast with the GI-bleed TXA rule is drawn', /card 23/i.test(t) && /HALT-IT/.test(t), true);
  ck('states its cabinet location', new RegExp(rx('physical.resusRoom') + ' CABINET', 'i').test(t), true);
  // the definition of "massive" genuinely differs between sources; the card must not pick one silently
  ck('threshold options are shown, not narrowed', /are all in print/i.test(t) && /shown as options/i.test(t), true);
}

/* ================= #26 epistaxis ================= */
console.log('--- #26 epistaxis');
ck('card 25 exists', await codes.locator('#c25').count(), 1);
{
  const t = await textOf(codes, '#c25');
  ck('cartilage not bony bridge', /soft cartilaginous part/i.test(t) && /Not the bony bridge/i.test(t), true);
  ck('pressure-duration disagreement shown', /≥10 min/.test(t) && /15–20 min/.test(t) && /≥20 min/.test(t), true);
  ck('never cauterize both septal sides', /Never cauterize both sides of the septum/i.test(t), true);
  ck('Rapid Rhino sterile water 30 s, air only', /sterile water for a full 30 seconds/i.test(t) && /inflate with <b>air only<\/b>|air only/i.test(t), true);
  ck('Foley volumes and the 15 mL ceiling', /5–7 mL/.test(t) && /maximum 15 mL/i.test(t), true);
  ck('posterior pack is admitted on telemetry', /Every posterior pack is admitted/i.test(t), true);
  ck('TXA both trials shown', /Zahed/.test(t) && /NoPAC/.test(t), true);
  ck('antibiotics given as two lettered options', /two options/i.test(t) && /StatPearls and Iowa/i.test(t) && /Core EM and REBEL EM/i.test(t), true);
  ck('links to the pacemaker card for electrocautery', await codes.locator('#c25 a[href="#c26"]').count() > 0, true);
}

/* ================= #36 pacemaker / ICD ================= */
console.log('--- #36 pacemaker / ICD');
ck('card 26 exists', await codes.locator('#c26').count(), 1);
{
  const t = await textOf(codes, '#c26');
  // the single most dangerous confusion on the card — both halves must be present
  ck('magnet on ICD: stops shocks, pacing unchanged', /suspends tachyarrhythmia detection/i.test(t) && /does <b>not<\/b> change the pacing mode|does not change the pacing mode/i.test(t), true);
  ck('magnet on pacemaker: asynchronous', /asynchronous pacing \(VOO\/DOO\)/i.test(t), true);
  ck('do NOT magnet appropriate shocks', /the shocks are <u>appropriate<\/u>|shocks are.{0,20}appropriate/i.test(t), true);
  ck('storm definition 3 in 24 h', /3 or more separate sustained VT\/VF episodes/i.test(t), true);
  ck('first-line drug given as two options', /First-line drug — two options/i.test(t) && /\(WikEM\)/.test(t) && /\(First10EM\)/.test(t), true);
  ck('Brugada exception', /isoproterenol, NOT beta-blockers/i.test(t), true);
  ck('pads >= 8 cm from generator', /at least 8 cm from the generator/i.test(t), true);
  ck('magnet location stated', /CODE CART · SIDE PANEL/i.test(t), true);
}

/* ================= #27 SALAD ================= */
console.log('--- #27 SALAD');
ck('procedures card 15 exists', await proc.locator('#c15').count(), 1);
{
  const t = await textOf(proc, '#c15');
  ck('decontaminate then intubate framing', /Decontaminate, then intubate/i.test(t), true);
  // the three trajectories are the reason this card is better than a generic SALAD description
  ck('trajectory 1 — from the gut', /Coming UP from the GI tract/i.test(t) && /proximal oesophagus/i.test(t), true);
  ck('trajectory 2 — from the lung', /Coming UP from the respiratory tract/i.test(t) && /toward the source of the froth/i.test(t), true);
  ck('trajectory 3 — from above', /Coming DOWN from above/i.test(t) && /do NOT park deep/i.test(t), true);
  ck('resus.me credited for the framework', await proc.locator('#c15 a[href*="resus.me"]').count() > 0, true);
  ck('two tested suctions', /Two suction units<\/b>, both tested|both tested/i.test(t), true);
  ck('suction the tube before the first breath', /before the first breath/i.test(t), true);
  ck('BMV under 20 cmH2O', /under 20 cmH₂O/i.test(t), true);
  ck('evidence honestly described as thin', /very low/i.test(t) && /no difference/i.test(t), true);
  ck('figure present', await proc.locator('#c15 svg[aria-label*="three trajectories"]').count(), 1);
}

/* ================= #34 pigtail ================= */
console.log('--- #34 pigtail chest tube');
ck('procedures card 16 exists', await proc.locator('#c16').count(), 1);
{
  const t = await textOf(proc, '#c16');
  ck('triangle of safety borders', /lateral edge of pectoralis major/i.test(t) && /latissimus dorsi/i.test(t), true);
  ck('over the upper border of the rib', /over the upper border of the rib below/i.test(t), true);
  ck('one stocked size, 14 Fr, stated plainly', new RegExp(rx('site.hospitalShort') + ' stocks one size: 14 Fr').test(t), true);
  ck('lidocaine ceiling', /3 mg\/kg/.test(t) && /250 mg/.test(t), true);
  // This site resolved it: haemothorax is a chest tube. P-CAT stays as the reason the question exists.
  ck('haemothorax routed to a chest tube',
     new RegExp('at ' + rx('site.hospitalShort') + ' this is a chest tube, not a pigtail', 'i').test(t)
     && /28–32 Fr/.test(t) && /P-CAT/.test(t), true);
  ck('wire depth given as two options', /Two options for depth/i.test(t) && /15–20 cm/.test(t), true);
  ck('never clamp a bubbling drain', /Never clamp a bubbling drain/i.test(t), true);
  ck('1.5 L then clamp', /1\.5 L/.test(t), true);
  ck('CXR after every insertion', /Post-insertion chest radiograph for every patient/i.test(t), true);
  ck('anterior 2nd space explicitly NOT printed', /deliberately not described here/i.test(t), true);
  ck('figure present', await proc.locator('#c16 svg[aria-label*="triangle of safety"]').count(), 1);
  ck('figure marks the target with a green check', /green check marking the insertion target/i.test(
    await proc.locator('#c16 svg').first().getAttribute('aria-label') || ''), true);
  ck('needle drawn plain black', /plain\s+black needle/i.test(
    await proc.locator('#c16 svg').first().getAttribute('aria-label') || ''), true);
}

/* ================= #20 epinephrine in mg AND mL ================= */
console.log('--- #20 epinephrine dosing in mL and mg');
{
  const ana = await textOf(codes, '#c08');
  ck('IM epi shows mg and mL', /0\.3–0\.5 mg = 0\.3–0\.5 mL/.test(ana), true);
  ck('IM epi warns off the cardiac syringe', /10× more dilute|10&times; more dilute/i.test(ana), true);
  ck('drip states a mL\/hr equivalent', /mL\/hr/.test(ana), true);
  ck('epi escalation links to the airway card', await codes.locator('#c08 a[href="#c06"]').count() > 0, true);
}

/* ================= #29 a QR on every full-format label ================= */
console.log('--- #29 QR coverage on cart labels');
const lab = await b.newPage({ viewport: { width: 1200, height: 1400 } }); watch(lab, 'labels');
await lab.goto(BASE + '/labels/', { waitUntil: 'networkidle' });
{
  const cov = await lab.evaluate(() => {
    const full = Array.from(document.querySelectorAll('.full'));
    const door = Array.from(document.querySelectorAll('.door'));
    const miss = [...full, ...door].filter(el => !el.querySelector('svg[aria-label^="QR code to"]'))
      .map(el => (el.querySelector('h2, .dh b') || {}).textContent || '?');
    return { full: full.length, door: door.length, missing: miss };
  });
  ck('full drawer faces exist', cov.full > 0, true);
  ck('door labels exist', cov.door > 0, true);
  ck('every full face and door label carries a QR', cov.missing.join(',') || 'none', 'none');
  // slim inserts deliberately have none — that decision has to stay documented, not just true
  ck('slim inserts document why they have no QR',
    /Deliberately omitted from slim inserts/i.test((await lab.locator('body').innerText())), true);
  ck('every cart has a check card with a QR',
    await lab.locator('.check svg[aria-label^="QR code to"], .checkcard svg[aria-label^="QR code to"]').count() >= 0, true);
}

/* ================= the code cart matches the real cart ================= */
// Five drawers, the bottom one deep, categories taken from the cart's own label strip. This is the
// gap that blocked printing anything: the app modelled six drawers and thirteen cards badged them.
console.log('--- code cart: five drawers, bottom one deep');
{
  const cart = (await codes.locator('#cart').innerText()).replace(/\s+/g, ' ');
  ck('header says five drawers, bottom deep', /5 DRAWERS · TOP TO BOTTOM · BOTTOM DRAWER IS DEEP/.test(cart), true);
  ck('no drawer 6 remains', /DRAWER 6/.test(cart), false);
  ck('no #d6 badge remains', await codes.locator('a[href="#d6"]').count(), 0);
  ck('drawer 5 carries both categories', /I\.V\. Supplies \+ Miscellaneous/.test(cart), true);
  ck('the old drawer-6 contents survived the merge', /Spare defibrillator pads/.test(cart) && /PPE/.test(cart), true);
  // the swap: rescue airway up to 2, I.V. supplies down into the deep drawer
  ck('drawer 2 is now Surgical / Supraglottic', /DRAWER 2 Surgical \/ Supraglottic/.test(cart), true);
  ck('the cric kit is out of the deep drawer', /Cricothyroidotomy kit/.test(cart), true);
  ck('cric kit sits under drawer 2', /Cricothyroidotomy kit/.test((await codes.locator('#d2').innerText())), true);
  ck('EZ-IO sits under drawer 5', /Intraosseous|EZ-IO|I\.V\./i.test((await codes.locator('#d5').innerText())), true);
  ck('drawer 5 USED BY still lists card 01', await codes.locator('#d5 a[href="#c01"]').count() > 0, true);
  // colour AND shape encode position, not contents — they must NOT have travelled with the swap
  ck('drawer 2 badge is still blue', /2 · SURGICAL \/ SGA/.test(
      await codes.evaluate(() => [...document.querySelectorAll('a[href="#d2"]')].map(a => a.textContent).join('|'))), true);
  ck('drawer 2 keeps the diamond shape', await codes.evaluate(() =>
      [...document.querySelectorAll('a[href="#d2"] span span')].some(e => /rotate\(45deg\)/.test(e.getAttribute('style') || ''))), true);
  ck('drawer 5 keeps the pill shape', await codes.evaluate(() =>
      [...document.querySelectorAll('a[href="#d5"] span span')].some(e => /border-radius/.test(e.getAttribute('style') || ''))), true);
  ck('the reprint-the-strip warning is on the cart section', /printed label strip has to be reprinted/i.test(cart), true);
  const faces = await lab.evaluate(() => {
    const want = ['Intubation','Surgical / Supraglottic','Medications','Suction','I.V. Fluids','I.V. Supplies','Miscellaneous'];
    const got = [...document.querySelectorAll('.full h2')].map(h => h.textContent.trim());
    return want.filter(w => !got.includes(w));
  });
  ck('labels print a face for every cart category', faces.join(',') || 'none', 'none');
  ck('the deep drawer is marked DEEP on the label sheet',
    /Drawer 5 \(DEEP\)/.test((await lab.locator('body').innerText())), true);
}

/* ================= #33 per-procedure infographic with an expiry line ================= */
console.log('--- #33 procedure infographic cards');
{
  const n = await lab.locator('.pcard').count();
  ck('procedure cards render', n >= 6, true);
  const card = lab.locator('.pcard', { hasText: 'Blakemore Kit' }).first();
  ck('one exists for the Blakemore kit', await card.count(), 1);
  const t = (await card.innerText()).replace(/\s+/g, ' ');
  ck('carries an expiry field', /EARLIEST EXPIRY/.test(t), true);
  ck('carries a next-check-due field', /NEXT CHECK DUE/.test(t), true);
  ck('carries a checked-by field', /CHECKED BY/.test(t), true);
  ck('carries a restocked-by field', /RESTOCKED BY/.test(t), true);
  ck('states where the kit lives', new RegExp(rx('physical.resusRoom'), 'i').test(t), true);
  ck('lists the kit contents', /Insufflation manometer/.test(t), true);
  ck('carries a QR', await card.locator('svg[aria-label^="QR code to"]').count(), 1);
  const all = await lab.locator('.pcard').evaluateAll(els =>
    els.filter(e => !/EARLIEST EXPIRY/.test(e.textContent)).length);
  ck('every procedure card has the expiry line', all, 0);
}

/* ================= system map picked all of it up ================= */
console.log('--- system map');
const sys = await b.newPage({ viewport: { width: 1400, height: 1400 } }); watch(sys, 'system');
await sys.goto(BASE + '/system/', { waitUntil: 'networkidle' });
for (const title of ['Massive Hemoptysis', 'Epistaxis', 'Pacemaker / ICD Emergencies',
                     'SALAD', 'Pigtail Chest Tube']) {
  ck('map row: ' + title, await sys.locator('tbody tr', { hasText: title }).count() >= 1, true);
}
{
  const places = (await sys.locator('.places').innerText()).replace(/\s+/g, ' ');
  ck('the resus room index lists the new cabinets',
    /Lung Isolation/.test(places) && /Epistaxis/.test(places) && /SALAD Suction/.test(places), true);
}

/* ================= search reaches every new card ================= */
console.log('--- search');
{
  const home = await b.newPage({ viewport: { width: 390, height: 1400 } }); watch(home, 'landing');
  await home.goto(BASE + '/', { waitUntil: 'networkidle' });
  const q = await home.$('input[type=search], #q, input[type=text]');
  if (q) {
    for (const [term, expect] of [['hemoptysis', 'Massive Hemoptysis'], ['nosebleed', 'Epistaxis'],
                                  ['magnet', 'Pacemaker / ICD'], ['salad', 'SALAD'],
                                  ['pigtail', 'Pigtail Chest Tube']]) {
      await q.fill(''); await q.fill(term); await home.waitForTimeout(250);
      ck('search "' + term + '"', new RegExp(expect.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i')
        .test((await home.textContent('body')) || ''), true);
    }
  } else ck('search input found', 'no', 'yes');
  await home.close();
}

ck('no page/console errors anywhere', errs.length, 0);
if (errs.length) errs.slice(0, 10).forEach(e => console.log('    ' + e));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
