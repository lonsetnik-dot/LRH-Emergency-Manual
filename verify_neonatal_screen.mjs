/* LRH Emergency Manual — the neonatal resuscitation engine (/neonatal/), issue #135.
 *
 * This screen exists because a card cannot hold a clock. The things it does that the card could not
 * are therefore the things asserted hardest: that the time of birth is stamped rather than remembered,
 * that the Apgar marks fire off that stamp on their own, and that the SpO2 target shown is the one for
 * the minute the baby is actually in rather than a whole printed table.
 *
 * Clinical numbers are read from the page's own SITE block, per the config-driven convention (#117).
 * What stays written out is what a fork must NOT be able to localize away — including, for now, the
 * provenance banner: the content was carried over from an uncited card and has not been reconciled
 * with NRP 9th edition, and shipping this screen without saying so would be the worst outcome here.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_neonatal_screen.mjs
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
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

/* A controllable clock. The screen reads wall time for everything it owns, so
   pushing the skew forward is the only way to test a 10-minute-of-life target
   without the suite taking ten minutes. */
await pg.addInitScript(() => {
  window.__skew = 0;
  const real = Date.now.bind(Date);
  Date.now = () => real() + window.__skew;
});
const skew = async ms => { await pg.evaluate(v => { window.__skew = v; }, ms); await pg.waitForTimeout(700); };

const txt = async sel => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const fresh = async () => {
  await pg.goto(BASE + '/neonatal/?from=home', { waitUntil: 'networkidle' });
  await pg.evaluate(() => { window.__skew = 0; });
  await pg.waitForTimeout(300);
};
const tap = async (sel, ms = 260) => { await pg.click(sel); await pg.waitForTimeout(ms); };
const openAcc = async id => { await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(250);
  return (await pg.locator('.accb').innerText()).replace(/\s+/g, ' ').trim(); };

await fresh();
const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /neonatal/ does not expose window.SITE'); process.exit(1); }
const lit = s => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');

/* ---- 1. opening state, offline-safe ---- */
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. starts idle', await pg.locator('#idle').isVisible(), true);
ck('1. the pathway is hidden until birth is stamped', await pg.locator('#live').isVisible(), false);
ck('1. clock starts at zero', await txt('#clock'), '0:00');
ck('1. status reads READY', await txt('#statusword'), 'READY');
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');

/* ---- 2. the provenance banner — the most important thing on this screen ----
   Written out, not read from config as a pass/fail: an unreviewed engine must
   not be able to ship silently. If a site reconciles its content and sets
   review.on to false, this assertion is what forces them to update the suite
   deliberately rather than by accident. */
ck('2. the review banner is showing', await pg.locator('#revbanner').isVisible(), true);
const rev = await txt('#revbanner');
ck('2. it names NRP 9th edition', /NRP 9th EDITION/i.test(rev), true);
ck('2. it says the content was not reconciled', /NOT YET RECONCILED/i.test(rev), true);
ck('2. it names the two known 9th-edition changes',
   /cord management/i.test(rev) && /laryngeal mask/i.test(rev), true);
const src = await openAcc('src');
ck('2. the source note admits the old card carried no citation', /no citation/i.test(src), true);
ck('2. the source note says nothing was authored fresh',
   /carried across unchanged/i.test(src) && /no number was altered/i.test(src), true);

/* ---- 3. routing — a newborn is not a small child ---- */
const scope = await txt('#scopebar');
ck('3. scope bar names the newborn at delivery', /newborn at delivery/i.test(scope), true);
ck('3. scope bar routes an older infant to peds', /pediatric resuscitation/i.test(scope), true);
ck('3. scope bar says the doses differ', /doses differ/i.test(scope), true);
ck('3. scope bar routes the mother elsewhere', /for the mother/i.test(scope), true);
ck('3. ventilation is named as the treatment', /Ventilation is the treatment/i.test(scope), true);

/* ---- 4. THE REASON THIS IS AN ENGINE — the birth clock ---- */
await fresh();
await tap('#startbtn', 320);
ck('4. stamping birth opens the pathway', await pg.locator('#live').isVisible(), true);
ck('4. it opens on the initial steps', await txt('#statusword'), 'INITIAL STEPS');
ck('4. the birth stamp is logged', /Time of birth/i.test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
ck(`4. the initial-steps window is ${CFG.cycle.initialStepsSec} s (SITE.cycle)`,
   lit(`FIRST ${CFG.cycle.initialStepsSec} SECONDS`).test(await txt('#phasebox')), true);

/* Apgar marks fire off the stamp, unprompted. This is the single thing the card
   could not do, and the reason the birth time is a button. */
ck('4. no Apgar mark before its minute', /minute mark/i.test(await openAcc('log')), false);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await skew(CFG.apgarMin[0] * 60 * 1000 + 2000);
ck(`4. the ${CFG.apgarMin[0]}-minute mark fires on its own`,
   lit(`${CFG.apgarMin[0]}-minute mark`).test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await skew(CFG.apgarMin[1] * 60 * 1000 + 2000);
ck(`4. the ${CFG.apgarMin[1]}-minute mark fires too`,
   lit(`${CFG.apgarMin[1]}-minute mark`).test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);

/* ---- 5. the live SpO2 target — one row, for the minute you are in ---- */
await fresh();
await tap('#startbtn', 300);
ck('5. no SpO₂ target inside the first minute', /No published SpO₂ target/i.test(await txt('#satbox')), true);
for (const row of CFG.satTargets) {
  await skew(row.min * 60 * 1000 + 3000);
  ck(`5. at ${row.min} min of life the target is ${row.t} (SITE.satTargets)`,
     lit(row.t).test(await txt('#satbox')), true);
}
/* Universal, not localizable: the targets must climb, and none of them may be
   100% — chasing 100% in a newborn is the error the table exists to prevent. */
const lows = CFG.satTargets.map(r => parseInt(String(r.t), 10));
ck('5. the targets rise with time', lows.every((v, i) => i === 0 || v >= lows[i - 1]), true);
ck('5. no target reaches 100%', CFG.satTargets.some(r => /100/.test(r.t)), false);
ck('5. the screen says not to chase 100%', /Do not chase 100/i.test(await txt('#satbox')), true);

/* ---- 6. heart rate drives the pathway, and only these three ways ---- */
await fresh(); await tap('#startbtn', 300); await tap('#toassess');
ck('6. exactly three heart-rate bands', await pg.locator('[data-hr]').count(), 3);
const bands = await txt('#phasebox');
ck(`6. the good band is ≥${CFG.hr.good} (SITE.hr.good)`, lit('≥' + CFG.hr.good).test(bands), true);
ck(`6. the low band is <${CFG.hr.low} (SITE.hr.low)`, lit('<' + CFG.hr.low).test(bands), true);
ck('6. apnea or gasping starts PPV whatever the rate', /Apnea or gasping/i.test(bands), true);

await tap('[data-hr="mid"]');
ck('6. the middle band goes to PPV', await txt('#statusword'), 'PPV');
ck(`6. PPV rate is ${CFG.ppv.ratePerMin} (SITE.ppv)`, lit('PPV ' + CFG.ppv.ratePerMin + ' / min').test(await txt('#phasebox')), true);
ck('6. no chest rise routes to MR SOPA', /MR SOPA/.test(await txt('#phasebox')), true);

await fresh(); await tap('#startbtn', 300); await tap('#toassess'); await tap('[data-hr="low"]');
ck('6. the low band goes straight to compressions', await txt('#statusword'), 'COMPRESSIONS');
const cpr = await txt('#phasebox');
ck(`6. compressions are ${CFG.compressions.ratio}`, lit(CFG.compressions.ratio).test(cpr), true);
ck(`6. ${CFG.compressions.perMin} compressions + ${CFG.compressions.breathsPerMin} breaths`,
   lit(`${CFG.compressions.perMin} compressions + ${CFG.compressions.breathsPerMin} breaths`).test(cpr), true);

await fresh(); await tap('#startbtn', 300); await tap('#toassess'); await tap('[data-hr="good"]');
ck('6. the good band goes to routine care', await txt('#statusword'), 'STABLE');
ck('6. routine care sends someone back to the mother', /check the mother/i.test(await txt('#stablebody')), true);

/* ---- 7. dose math, computed from the weight actually entered ---- */
await fresh(); await tap('#startbtn', 300);
/* Grams, because a birth weight is spoken in grams and typed in a hurry. */
await pg.fill('#wIn', '3200'); await pg.waitForTimeout(300);
ck('7. a gram weight is read as kilograms', await txt('#wnote'), '3.2 kg');
await tap('#toassess'); await tap('[data-hr="low"]');
const dose = await txt('#phasebox');
const kg = 3.2;
const ivMg = +(CFG.epi.ivPerKg * kg).toFixed(3);
const ivMl = +(ivMg / CFG.epi.ivConc).toFixed(2);
ck(`7. IV epi ${CFG.epi.ivPerKg} mg/kg = ${ivMg} mg at ${kg} kg`, lit(ivMg + ' mg').test(dose), true);
ck(`7. and the volume is spelled out (${ivMl} mL)`, lit(ivMl + ' mL').test(dose), true);
ck(`7. volume replacement is ${CFG.volume.mlPerKg} mL/kg = ${CFG.volume.mlPerKg * kg} mL`,
   lit(CFG.volume.mlPerKg * kg + ' mL').test(dose), true);
/* Universal invariant: the ETT dose is a LARGER volume than the IV dose, and
   the screen has to say so — giving the IV volume down the tube is the error. */
ck('7. the ETT dose is flagged as a larger volume', /larger volume than the IV dose/i.test(dose), true);
ck('7. ETT epi is dosed higher per kg than IV', CFG.epi.ettPerKgLow > CFG.epi.ivPerKg, true);

/* An ambiguous weight must be refused rather than guessed at. */
await pg.fill('#wIn', '50'); await pg.waitForTimeout(300);
ck('7. an ambiguous 50 is refused, not guessed', await pg.locator('#werr').isVisible(), true);
ck('7. and it says how to disambiguate', /grams or kilograms/i.test(await txt('#werr')), true);

/* ---- 8. airway sizing comes from config ---- */
const aw = await openAcc('airway');
CFG.airway.forEach(a => {
  ck(`8. ${a.note}: ${a.lma}, ETT ${a.ett}`, lit(a.lma).test(aw) && lit('ETT ' + a.ett).test(aw), true);
});
ck(`8. ETT depth is weight + ${CFG.ettDepthAddCm} cm`, lit('kg + ' + CFG.ettDepthAddCm + ' cm').test(aw), true);

/* ---- 9. PHI guard and state hygiene ---- */
await fresh(); await tap('#startbtn', 300);
await tap('#logtoggle');
await pg.fill('#customin', 'MRN 4457821'); await tap('#customlog');
ck('9. a record number is refused', await pg.locator('#customwarn').isVisible(), true);
await pg.fill('#customin', '04/12/2026'); await tap('#customlog');
ck('9. a date of birth style date is refused', /date of birth/i.test(await txt('#customwarn')), true);
await pg.fill('#customin', 'LMA 0.5 in, chest rising'); await tap('#customlog');
ck('9. a clinical note is accepted', await pg.locator('#customrow').isVisible(), false);
ck('9. and appears in the log', /LMA 0.5 in, chest rising/.test(await openAcc('log')), true);
const keys = await pg.evaluate(() => Object.keys(localStorage));
ck('9. localStorage holds only the theme preference',
   keys.filter(k => k !== 'lrh-pref-theme').join(',') || 'none', 'none');

/* ---- 10. reset is two taps and clears the case ---- */
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await tap('#resetbtn');
ck('10. the first tap only arms it', await txt('#resetbtn'), 'SURE?');
ck('10. the pathway is still up', await pg.locator('#live').isVisible(), true);
await tap('#resetbtn', 320);
ck('10. the second tap returns to idle', await pg.locator('#idle').isVisible(), true);
ck('10. the clock is cleared', await txt('#clock'), '0:00');
ck('10. the log is empty again', /Nothing logged yet/.test(await openAcc('log')), true);

/* ---- 11. stamp and disclaimer ---- */
await fresh();
ck(`11. stamped v${CFG.version}, last reviewed ${CFG.lastReviewed}`,
   lit(`v${CFG.version} · last reviewed ${CFG.lastReviewed}`).test(await txt('#verstamp')), true);
ck('11. the standard disclaimer is present',
   /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await pg.innerText('body')), true);
ck('11. links back to the manual', await pg.getAttribute('#backlink', 'href'), '../?from=tool');

ck('12. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('12. still no off-origin requests', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
