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

/* ---- 2. provenance — what this screen claims about its own sourcing ----
   Written out, not read from config as a pass/fail. The engine is now aligned to
   the 2025 AHA/AAP guideline for the named items and inherited for everything
   else, and it has to keep saying BOTH halves. Dropping the second half would be
   the dangerous edit: a screen that looks fully sourced when only part of it is.

   The citation is asserted by DOI because a guideline reference that drifts is
   worse than none — someone checks it and finds the wrong document. */
ck('2. the provenance banner is showing', await pg.locator('#revbanner').isVisible(), true);
const rev = await txt('#revbanner');
ck('2. it names the 2025 AHA/AAP guidelines', /2025 AHA\/AAP GUIDELINES/i.test(rev), true);
ck('2. it says which items were aligned', /cord management/i.test(rev) && /supraglottic/i.test(rev), true);
ck('2. it also says what was NOT verified', /not.{0,30}individually verified/i.test(rev), true);
const src = await openAcc('src');
ck('2. the source cites Part 5 by DOI', /10\.1161\/CIR\.0000000000001367/.test(src), true);
ck('2. the source cites the ILCOR CoSTR by DOI', /10\.1161\/CIR\.0000000000001363/.test(src), true);
ck('2. it names NRP 9th edition and the 1 June 2026 date',
   /NRP 9th edition/i.test(src) && /1 June 2026/.test(src), true);
ck('2. it still admits the old card carried no citation', /no citation of its own/i.test(src), true);
ck('2. and that nothing was authored fresh',
   /carried across unchanged/i.test(src) && /no number was altered/i.test(src), true);
ck('2. it separates what was NOT verified', /NOT individually verified/i.test(src), true);

/* ---- 2b. the 2025 algorithm changes actually appear in the pathway ---- */
await tap('#startbtn', 320);
const first = await txt('#phasebox');
ck(`2b. cord management is the first step, deferring ≥${CFG.cord.deferSec} s (SITE.cord)`,
   /Cord management plan/i.test(first) && lit('at least ' + CFG.cord.deferSec + ' s').test(first), true);
ck(`2b. intact cord milking is offered from ${CFG.cord.milkingFromWeeks} weeks`,
   lit(CFG.cord.milkingFromWeeks + ' weeks or more').test(first), true);
ck('2b. it does not clamp early just because a baby is preterm',
   /clamp.{0,20}now.{0,20}preterm|preterm.{0,30}clamp/i.test(first), false);
const airAcc = await openAcc('airway');
ck(`2b. the supraglottic airway is primary above ${CFG.sgaPrimaryFromWeeks} weeks`,
   /primary/i.test(airAcc) && lit(CFG.sgaPrimaryFromWeeks + ' weeks').test(airAcc), true);
await fresh();

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
ck('4. no Apgar sheet before its minute', await pg.locator('#apgarwrap').count(), 0);

/* The calculator raises ITSELF at each due minute. An Apgar reconstructed after
   the fact is the failure this whole screen is built around, so the assertion is
   that nobody has to remember to open it. */
const scoreApgar = async v => {
  for (let i = 0; i < CFG.apgar.rows.length; i++) {
    await pg.click(`[data-ap="${i}"][data-apv="${v}"]`);
    await pg.waitForTimeout(60);
  }
  await tap('#apgarsave', 300);
};
await skew(CFG.apgar.at[0] * 60 * 1000 + 2000);
ck(`4. the ${CFG.apgar.at[0]}-minute calculator opens on its own`, await pg.locator('#apgarwrap').count(), 1);
ck('4. it offers all five signs, three options each',
   await pg.locator('[data-ap]').count(), CFG.apgar.rows.length * 3);
await scoreApgar(2);
ck('4. scoring closes it', await pg.locator('#apgarwrap').count(), 0);
ck(`4. the score is logged with its minute`,
   lit(`Apgar at ${CFG.apgar.at[0]} min = 10/10`).test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);

/* A low 5-minute score has to keep the calculator coming back — the rule nobody
   should be holding in their head while running a resuscitation. */
await skew(CFG.apgar.at[1] * 60 * 1000 + 2000);
ck(`4. the ${CFG.apgar.at[1]}-minute calculator opens too`, await pg.locator('#apgarwrap').count(), 1);
await scoreApgar(0);
const nextMin = CFG.apgar.at[1] + CFG.apgar.repeatEveryMin;
await skew(nextMin * 60 * 1000 + 2000);
ck(`4. a score under ${CFG.apgar.repeatIfBelow} re-raises it at ${nextMin} min`,
   await pg.locator('#apgarwrap').count(), 1);
ck(`4. and it is labelled ${nextMin} minutes`, lit('APGAR AT ' + nextMin).test(await txt('#apgarwrap')), true);
/* Dismissing must not lose the mark. */
await tap('#apgarlater', 700);
ck('4. NOT NOW re-raises rather than losing the score', await pg.locator('#apgarwrap').count(), 1);
await scoreApgar(2);

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
/* Since the shared case-clock (CASE-STATE.md's lrh-case-startms) landed, this
   engine also touches lrh-case-lastactive and — once a clock anywhere in the
   case has started — lrh-case-startms. Neither carries anything patient-
   identifying (a timestamp only); everything else must still be just theme. */
ck('9. localStorage holds only theme + the shared case-clock keys',
   keys.filter(k => !['lrh-pref-theme','lrh-case-lastactive','lrh-case-startms'].includes(k)).join(',') || 'none', 'none');

/* ---- 10. reset is two taps and clears the case ---- */
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await tap('#resetbtn');
ck('10. the first tap only arms it', await txt('#resetbtn'), 'SURE?');
ck('10. the pathway is still up', await pg.locator('#live').isVisible(), true);
await tap('#resetbtn', 320);
ck('10. the second tap returns to idle', await pg.locator('#idle').isVisible(), true);
ck('10. the clock is cleared', await txt('#clock'), '0:00');
ck('10. the log is empty again', /Nothing logged yet/.test(await openAcc('log')), true);

/* ---- 10b. the audio pacer ----
   It shipped missing and was the one gap found in bedside testing. Synthesised
   rather than a file, so the offline shell still holds. Sound defaults ON —
   the START tap is itself the user gesture browsers require, so it is used to
   start audio immediately rather than making someone find a second button
   (same opt-out convention /arrest/'s compression tone already uses). */
await fresh(); await tap('#startbtn', 300);
ck('10b. the pacer is on the running screen', await pg.locator('#pacerbox').isVisible(), true);
ck('10b. sound starts ON — the START tap is the gesture', /SOUND ON/.test(await txt('#soundbtn')), true);
ck(`10b. a PPV rate button per configured rate (${CFG.pacer.ppvRates.join('/')})`,
   await pg.locator('[data-rate]').count(), CFG.pacer.ppvRates.length);
await tap('#soundbtn');
ck('10b. tapping it again mutes it', /SOUND OFF/.test(await txt('#soundbtn')), true);
await tap('#soundbtn');
ck('10b. tapping it a third time turns sound back on', /SOUND ON/.test(await txt('#soundbtn')), true);
ck('10b. it explains what the sounds mean', lit(CFG.pacer.note).test(await txt('#pacerbox')), true);
ck('10b. it warns about the iPhone silent switch', /silent switch/i.test(await txt('#pacerbox')), true);
await tap('#toassess'); await tap('[data-hr="low"]');
ck(`10b. under compressions it paces ${CFG.compressions.ratio} at ${CFG.pacer.cprEventsPerMin} events/min`,
   lit(CFG.pacer.cprEventsPerMin + ' events/min').test(await txt('#pacerbox')), true);
ck('10b. and the rate picker is gone — 3:1 is not a choice',
   await pg.locator('[data-rate]').count(), 0);
/* No audio files anywhere: a fetched sound would be a silent metronome in a
   dead zone, which is worse than none. */
ck('10b. no audio files are requested', reqs.filter(u => /\.(mp3|wav|ogg|m4a)/i.test(u)).length, 0);

/* ---- 10c. the three figures ---- */
await fresh();
const mr = await openAcc('mrsopa');
ck('10c. MR SOPA draws one figure per letter', await pg.locator('.accb svg').count(), 6);
['Mask adjust', 'Reposition', 'Suction', 'Open the mouth', 'Pressure up', 'Airway alternative']
  .forEach(step => ck(`10c. MR SOPA — ${step}`, lit(step).test(mr), true));
await openAcc('sats');
ck('10c. the SpO₂ target is drawn, not just listed', await pg.locator('.accb svg').count(), 1);
await openAcc('airway');
ck('10c. the airway ladder draws a figure per size band',
   await pg.locator('.accb svg').count(), CFG.airway.length);

/* ---- 10d. GESTATIONAL AGE IN WEEKS AND DAYS (issue #144) ----
   Days cannot move a baby across an integer completed-weeks threshold, so what
   is asserted here is what days actually buy: a gestation the screen PRINTS as
   w+d rather than rounding, and a days field that refuses a value outside 0–6.
   Test inputs are derived from the config, not typed, so a fork that moves its
   milking line stays green. */
await fresh();
await tap('#startbtn', 320);
const GA = async (w, d) => { await pg.fill('#gIn', String(w)); await pg.fill('#gdIn', String(d)); await pg.waitForTimeout(320); };
await pg.fill('#wIn', '2.4'); await pg.waitForTimeout(200);

const MILK = CFG.cord.milkingFromWeeks;
await GA(MILK - 1, 6);
ck(`10d. ${MILK - 1}+6 renders as weeks+days, not a decimal`,
   lit(`${MILK - 1}+6 wks`).test(await txt('#wnote')), true);
ck(`10d. and ${MILK - 1}+6 is BELOW the ${MILK}-week milking line`,
   /below the/i.test(await txt('#phasebox')), true);
await GA(MILK, 0);
ck(`10d. ${MILK}+0 is AT the milking line`,
   /at or above/i.test(await txt('#phasebox')), true);
/* The whole reason days matter: one day either side of the same week. */
await GA(MILK - 1, 6);
ck(`10d. one day back across the line flips it again`,
   /below the/i.test(await txt('#phasebox')), true);
await pg.fill('#gdIn', '9'); await pg.waitForTimeout(300);
ck('10d. a day count outside 0–6 is refused rather than swallowed',
   /days must be 0.6/i.test(await txt('#gerr')), true);

/* ---- 10e. UNDER THE WRAP THRESHOLD THE BABY IS NOT DRIED (issue #143) ----
   Not a softer version of "warm, dry, stimulate" — the opposite instruction.
   The threshold is config; that the two branches CONTRADICT each other, and
   that the headline follows the branch, is the invariant. */
const WRAP = CFG.temp.wrapUnderWeeks;
const WRAPG = CFG.temp.wrapUnderGrams;
/* A weight comfortably ABOVE the gram arm, so the gestation tests isolate
   gestation. Derived from config, not typed, so a fork that raises its gram
   threshold does not silently turn these into weight tests. */
const HEAVY = WRAPG ? ((WRAPG + 1500) / 1000).toFixed(1) : '3.2';
await fresh();
await tap('#startbtn', 320);
await pg.fill('#wIn', HEAVY); await pg.waitForTimeout(200);

await GA(WRAP, 0);
const atThreshold = await txt('#phasebox');
ck(`10e. at exactly ${WRAP}+0 (and ${HEAVY} kg) the baby IS dried`, /dry and stimulate/i.test(atThreshold), true);
ck(`10e. and ${WRAP}+0 is not told to skip drying`, /do not dry/i.test(atThreshold), false);

await GA(WRAP - 1, 6);
const below = await txt('#phasebox');
ck(`10e. one day under — at ${WRAP - 1}+6 — the screen says DO NOT DRY`,
   /do not dry this baby/i.test(below), true);
ck('10e. it names the wrap bundle from config', lit(CFG.temp.wrapBundle).test(below), true);
ck('10e. and it does NOT also say "dry and stimulate"', /dry and stimulate/i.test(below), false);
ck('10e. stimulation still happens — through the wrap', /stimulate through the wrap/i.test(below), true);
ck('10e. the headline follows the branch', /wrap, do not dry/i.test(below), true);
ck('10e. the weight bar flags it too', /WRAP, DO NOT DRY/i.test(await txt('#wnote')), true);
ck('10e. and it says WHICH number put the baby in the band', lit(`under ${WRAP} weeks`).test(below), true);

/* ---- 10f. THE GRAM ARM IS AN OR, NOT AN AND ----
   The clinical point Lon confirmed: either trigger is enough. A
   growth-restricted baby well past 32 weeks can still be under 1500 g, and an
   estimated gestation can be wrong or simply not known yet. A suite that only
   ever tested the gestation arm would pass with the OR silently built as an
   AND — which is the failure that leaves a 1200 g 33-weeker being towel-dried. */
if (WRAPG) {
  const LIGHT = ((WRAPG - 200) / 1000).toFixed(2);   /* under the gram line */
  const ATG   = (WRAPG / 1000).toFixed(2);           /* exactly on it */
  await fresh();
  await tap('#startbtn', 320);

  /* Gestation WELL ABOVE the week line, weight below the gram line. */
  await GA(WRAP + 6, 0);
  await pg.fill('#wIn', LIGHT); await pg.waitForTimeout(320);
  const byWt = await txt('#phasebox');
  ck(`10f. ${WRAP + 6}+0 but ${LIGHT} kg — the gram arm alone triggers the wrap`,
     /do not dry this baby/i.test(byWt), true);
  ck('10f. and it names the GRAM reason, not the gestation',
     lit(`under ${WRAPG} g`).test(byWt), true);
  ck('10f. it does not also say "dry and stimulate"', /dry and stimulate/i.test(byWt), false);

  /* Exactly on the gram line is NOT under it. */
  await pg.fill('#wIn', ATG); await pg.waitForTimeout(320);
  ck(`10f. exactly ${WRAPG} g is not under ${WRAPG} g — baby IS dried`,
     /dry and stimulate/i.test(await txt('#phasebox')), true);

  /* Both arms firing at once names both. */
  await GA(WRAP - 2, 0);
  await pg.fill('#wIn', LIGHT); await pg.waitForTimeout(320);
  ck('10f. when both arms fire the screen names both',
     /under both/i.test(await txt('#phasebox')), true);
}

/* With nothing entered the fork is invisible unless the screen says so — the
   person holding a 28-weeker has not typed anything yet. */
await fresh();
await tap('#startbtn', 320);
const blank = await txt('#phasebox');
ck(`10e. with nothing entered it warns that under ${WRAP} weeks this changes`,
   lit(`Under ${WRAP} weeks`).test(blank), true);
if (WRAPG) ck(`10e. and that it also changes under ${WRAPG} g`,
   lit(`${WRAPG} g`).test(blank), true);

/* The thresholds must be cited on screen, not just in a source comment. */
const srcTxt = await openAcc('src');
ck('10e. the wrap threshold is cited in SOURCE & PROVENANCE',
   /S524.S550/.test(srcTxt) && lit(`under ${WRAP} weeks`).test(srcTxt), true);
if (WRAPG) ck('10e. and the OR is stated, not left for the reader to infer',
   /either trigger is enough/i.test(srcTxt), true);

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
