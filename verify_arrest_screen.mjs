/* ED Emergency Manual — the mobile arrest screen (/arrest/).
 *
 * The design handoff is UI; the clinical logic is the manual's. This suite exists to prove the
 * second half of that sentence: that adopting the new interface did not quietly adopt the
 * prototype's dose math along with it. The prototype showed a flat 200 J for adults; this site runs an
 * escalating ZOLL sequence, and that difference is the single thing most likely to be lost in a
 * redesign, so it is asserted first and hardest.
 *
 *     python3 -m http.server 8123
 *     node verify_arrest_screen.mjs
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

const errs = [];
const reqs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

/* A controllable clock skew, injected before the page script runs. The screen
   reads wall time through Date.now() for every timer it owns, so pushing the
   skew forward two minutes is the only way to test the recurring pulse-check
   prompt without the suite itself taking two minutes. The skew starts at 0, so
   everything that does not explicitly move it runs on real time. */
await pg.addInitScript(() => {
  window.__skew = 0;
  const real = Date.now.bind(Date);
  Date.now = () => real() + window.__skew;
});
const skew = async ms => { await pg.evaluate(v => { window.__skew = v; }, ms); await pg.waitForTimeout(400); };

const txt = async sel => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
/* A clean slate per test group. The tool now shares the manual's edm- case
   state (weight, timeline, lastactive), so isolation requires clearing storage
   between groups — otherwise a weight or log entry set in one group leaks into
   the next through the shared keys. */
const fresh = async () => {
  await pg.goto(BASE + '/arrest/', { waitUntil: 'networkidle' });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
};
const vis = async sel => pg.locator(sel).isVisible();
const nBreaths = async () => parseInt(await txt('#breathn'), 10);
const openAcc = async id => { await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(250);
  return (await pg.locator('.accb').innerText()).replace(/\s+/g, ' ').trim(); };

/* ---- CONFIG-DRIVEN EXPECTATIONS (issue #117) -------------------------------
   Read the tool's own SITE block and assert the UI against THAT, rather than
   against this site's numbers written out here a second time.

   Why: this suite is the safety harness that makes champion+AI maintenance of
   clinical logic viable. If a forking ED correctly localizes its defibrillator
   to, say, 150/200/200 J, a suite full of hardcoded 120/150/200 turns red for
   doing the right thing — which teaches an adopting site that a red test run is
   normal, at the exact moment the harness is what protects them.

   What stays hardcoded, deliberately: everything universal — that energies
   escalate and then stop, that a per-kg dose is capped at the adult ceiling,
   that peds mode refuses to invent a number without a weight. Those are the
   clinical invariants a fork must NOT be able to localize away. */
const CFG = await (async () => {
  await pg.goto(BASE + '/arrest/', { waitUntil: 'networkidle' });
  const c = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
  if (!c) { console.error('FATAL: /arrest/ does not expose window.SITE — cannot verify against config'); process.exit(1); }
  return c;
})();
/* Three states, not two. A fork that localizes to 150/200/200 is CORRECT and
   must stay green; a template with no answer at all is also correct, and must
   assert that the screen prints no number rather than defaulting to one. */
const J = CFG.defib.adultJ;                     // e.g. [120, 150, 200], or null
if (!J || !J.length) {
  await fresh();
  await pg.fill('#wIn', '80'); await pg.waitForTimeout(250);
  await pg.click('#startbtn'); await pg.waitForTimeout(300);
  const lbl = await txt('#shocklabel');
  ck('TEMPLATE: no configured energies', CFG.defib.adultJ, null);
  ck('TEMPLATE: the shock control prints no joule value', /\d+\s*J\b/.test(lbl), false);
  const ref = await openAcc('defib');
  ck('TEMPLATE: the defibrillation reference says NOT LOCALIZED', /NOT LOCALIZED/.test(ref), true);
  ck('TEMPLATE: and names the key to answer', /defib\.adultJoules/.test(ref), true);
  ck('TEMPLATE: no page errors while refusing', errs.length, 0);
  console.log(`\n=== ${pass} passed, ${fail} failed (template build: energy assertions skipped) ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
}
const JMAX = J[J.length - 1];

/* ---- 1. offline-safe: nothing is fetched from anywhere else ---- */
await fresh();
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. starts in the idle phase', await pg.locator('#idle').isVisible(), true);
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');

/* ---- 2. ADULT dose math — the site's escalating sequence, NOT the prototype's flat 200 ---- */
await pg.fill('#wIn', '80'); await pg.waitForTimeout(250);
ck('2. adult weight reads back', await txt('#wnote'), '80 kg · adult');
await pg.click('#startbtn'); await pg.waitForTimeout(300);
ck(`2. first adult shock is ${J[0]} J (SITE.defib.adultJ[0])`, (await txt('#shocklabel')).includes(`SHOCK ${J[0]} J`), true);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
ck(`2. second adult shock is ${J[1]} J`, (await txt('#shocklabel')).includes(`SHOCK ${J[1]} J`), true);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
ck(`2. third adult shock is ${J[2]} J`, (await txt('#shocklabel')).includes(`SHOCK ${J[2]} J`), true);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
/* Universal invariant, not a local value: the sequence must PLATEAU at the
   configured maximum rather than keep climbing, whatever that maximum is. */
ck(`2. fourth stays at the ${JMAX} J ceiling, not higher`, (await txt('#shocklabel')).includes(`SHOCK ${JMAX} J`), true);
ck('2. shock counter tracks', await txt('#shockn'), '3');
ck(`2. adult epi is ${CFG.epi.adultMg} mg (SITE.epi.adultMg)`, (await txt('#epilabel')).includes(`EPI ${CFG.epi.adultMg} mg`), true);
ck(`2. adult amio first dose ${CFG.amio.adultDose1} mg`, (await txt('#amiolabel')).includes(`AMIO ${CFG.amio.adultDose1} mg`), true);
await pg.click('#amiobtn'); await pg.waitForTimeout(200);
ck(`2. adult amio second dose ${CFG.amio.adultDose2} mg`, (await txt('#amiolabel')).includes(`AMIO ${CFG.amio.adultDose2} mg`), true);

/* ---- 3. PEDIATRIC dose math, computed from the exact kg ---- */
await fresh();
await pg.fill('#wIn', '20'); await pg.waitForTimeout(250);
ck('3. pediatric mode on under 50 kg', await txt('#wnote'), '20 kg · pediatric');
ck('3. peds banner names the Broselow band', /Broselow Blue/.test(await txt('#pedsbanner')), true);
ck('3. accent becomes the band colour', await pg.evaluate(() =>
  getComputedStyle(document.body).getPropertyValue('--accent').trim()), '#2E86C1');
await pg.click('#startbtn'); await pg.waitForTimeout(300);
ck(`3. first peds shock is ${CFG.peds.defibPerKg1} J/kg = ${CFG.peds.defibPerKg1 * 20} J`,
   (await txt('#shocklabel')).includes(`SHOCK ${CFG.peds.defibPerKg1 * 20} J`), true);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
ck(`3. later peds shocks are ${CFG.peds.defibPerKgN} J/kg = ${CFG.peds.defibPerKgN * 20} J`,
   (await txt('#shocklabel')).includes(`SHOCK ${CFG.peds.defibPerKgN * 20} J`), true);
ck(`3. peds epi ${CFG.peds.epiPerKg} mg/kg = ${CFG.peds.epiPerKg * 20} mg`,
   (await txt('#epilabel')).includes(`EPI ${CFG.peds.epiPerKg * 20} mg`), true);
ck(`3. peds amio ${CFG.peds.amioPerKgDose1} mg/kg = ${CFG.peds.amioPerKgDose1 * 20} mg`,
   (await txt('#amiolabel')).includes(`AMIO ${CFG.peds.amioPerKgDose1 * 20} mg`), true);
await pg.click('[data-acc="epi"]'); await pg.waitForTimeout(200);
ck('3. epi reference gives mg AND mL', (await txt('.accb')).includes(`${CFG.peds.epiPerKg * 20} mg`)
   && (await txt('.accb')).includes(`${(CFG.peds.epiPerKg * 20) / CFG.peds.epiConc} mL`), true);

/* a weight that would exceed the adult ceiling must be capped, not extrapolated */
await fresh();
await pg.fill('#wIn', '49'); await pg.waitForTimeout(250);
await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('[data-acc="defib"]'); await pg.waitForTimeout(200);
/* Universal invariant: per-kg energy must never exceed the adult ceiling,
   whatever either number is locally. At 49 kg, defibMaxPerKg would compute far
   past it. */
ck(`3. ${CFG.peds.defibMaxPerKg} J/kg is capped at the adult max (${JMAX} J)`,
   (await txt('.accb')).includes(`${JMAX} J`), true);

/* ---- 4. the age arm of the trigger, and refusing to invent a number ---- */
await fresh();
await pg.fill('#aIn', '6'); await pg.waitForTimeout(250);
ck('4. age alone triggers pediatric mode', /pediatric by age/.test(await txt('#wnote')), true);
await pg.click('#startbtn'); await pg.waitForTimeout(250);
ck('4. refuses to print an energy with no weight', /ENTER WEIGHT/.test(await txt('#shocklabel')), true);
ck('4. refuses to print an epi dose with no weight', /ENTER WEIGHT/.test(await txt('#epilabel')), true);
await pg.click('#estbtn'); await pg.waitForTimeout(300);
/* APLS band for a 6-year-old is 3 x age + 7 — the manual's single estimator
   (same formula as peds/), which replaced the old 2 x age + 8 here. */
ck('4. ESTIMATE KG fills a weight (3 x age + 7)', await pg.inputValue('#wIn'), '25');
/* The estimator refuses beyond 12 y instead of flipping an adolescent into
   pediatric mode via a small estimated weight. */
ck('4. ESTIMATE KG refuses age > 12 y', await (async () => {
  await pg.fill('#aIn', '16'); await pg.waitForTimeout(250);
  await pg.click('#estbtn'); await pg.waitForTimeout(250);
  return /VALID TO 12/.test(await txt('#werr'));
})(), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(200);
ck('4. the estimate is logged AS an estimate', /ESTIMATED/.test(await txt('.accb')), true);

/* ---- 4b. the NRP off-ramp and the write-side weight validation ------------
   A sub-3 kg weight asks "newly born? -> NRP" instead of silently dosing PALS
   (and no longer claims a Broselow Grey drawer); an implausible weight is
   refused with a visible message instead of being written to the shared key
   for other tools to trust. */
await fresh();
await pg.fill('#wIn', '2'); await pg.waitForTimeout(300);
ck('4b. under 3 kg shows the NRP banner', await pg.locator('#nrpbanner').isVisible(), true);
ck('4b. the banner links to the NRP card', /ob-neonatal\/\?from=arrest#c03/.test(await pg.getAttribute('#nrpbanner a', 'href')), true);
ck('4b. under 3 kg claims no Broselow drawer', await pg.locator('#brosechip').isVisible(), false);
await pg.click('#dismissnrp'); await pg.waitForTimeout(250);
ck('4b. dismiss hides the banner but keeps PALS mode', await pg.locator('#nrpbanner').isVisible(), false);
ck('4b. PALS dosing still available after dismissal', /pediatric/.test(await txt('#wnote')), true);
await pg.fill('#wIn', '350'); await pg.waitForTimeout(300);
ck('4b. an implausible weight is refused loudly', /NOT SAVED/.test(await txt('#werr')), true);
ck('4b. and the last good weight survives it', /2 kg/.test(await txt('#wnote')), true);
ck('4b. and nothing implausible reached the shared key', await pg.evaluate(() => localStorage.getItem('edm-case-wtkg')), '2');
await fresh();
await pg.fill('#aIn', '0'); await pg.waitForTimeout(300);
ck('4b. age 0 shows the NRP banner too', await pg.locator('#nrpbanner').isVisible(), true);

/* ---- 5. the override is loud and reversible, not a silent switch ---- */
await fresh();
await pg.fill('#wIn', '30'); await pg.waitForTimeout(250);
await pg.click('#dismisspeds'); await pg.waitForTimeout(250);
ck('5. dismiss switches to adult dosing', await txt('#wnote'), '30 kg · adult');
ck('5. an override bar stays visible', await pg.locator('#overridebar').isVisible(), true);
await pg.click('#undooverride'); await pg.waitForTimeout(250);
ck('5. undo returns to pediatric', await txt('#wnote'), '30 kg · pediatric');

/* ---- 6. cycle timer and the due state ---- */
await fresh();
await pg.fill('#wIn', '70'); await pg.waitForTimeout(200);
await pg.click('#startbtn'); await pg.waitForTimeout(300);
ck('6. countdown starts at 2:00', /^[12]:\d\d$/.test(await txt('#cycleclock')), true);
ck('6. shock button is showing, due button is not', await pg.locator('#duebtn').isVisible(), false);
// jump the clock forward past the cycle rather than waiting two minutes
await pg.evaluate(() => { const real = Date.now; window.Date.now = () => real.call(Date) + 125000; });
await pg.waitForTimeout(700);
ck('6. rhythm-check due button appears at 0:00', await pg.locator('#duebtn').isVisible(), true);
ck('6. shock button hides while due', await pg.locator('#shockbtn').isVisible(), false);
ck('6. epi shows DUE NOW once the interval passes', /DUE NOW|give now/.test(await txt('#episub')), true);
await pg.evaluate(() => { location.reload(); });
await pg.waitForTimeout(400);

/* ---- 7. rhythm-check sheet, both branches ---- */
await fresh();
await pg.fill('#wIn', '70'); await pg.click('#startbtn'); await pg.waitForTimeout(300);
await pg.click('#rcbtn'); await pg.waitForTimeout(250);
ck('7. sheet opens with three options', await pg.locator('#rcmain .rcbtn').count(), 3);
await pg.click('#rcorg'); await pg.waitForTimeout(250);
ck('7. organized rhythm asks for a pulse', await pg.locator('#rcorgstep').isVisible(), true);
await pg.click('#rcnopulse'); await pg.waitForTimeout(250);
ck('7. no pulse returns to CPR', await pg.locator('#cpr').isVisible(), true);
await pg.click('#rcbtn'); await pg.waitForTimeout(200);
await pg.click('#rcorg'); await pg.waitForTimeout(200);
await pg.click('#rcpulse'); await pg.waitForTimeout(300);
ck('7. pulse present goes to ROSC', await pg.locator('#rosc').isVisible(), true);
ck('7. ROSC records the time', /^\d+:\d\d$/.test(await txt('#roscat')), true);
await pg.click('#rearrestbtn'); await pg.waitForTimeout(300);
ck('7. re-arrest returns to CPR', await pg.locator('#cpr').isVisible(), true);

/* ---- 8. PHI guard on the free-text log — CLAUDE.md rule 3 ---- */
await fresh();
await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('#logtoggle'); await pg.waitForTimeout(250);
await pg.fill('#customin', 'MRN 4471129 arrived');
await pg.click('#customlog'); await pg.waitForTimeout(250);
ck('8. an identifier is refused', await pg.locator('#customwarn').isVisible(), true);
ck('8. and says why', /never stores patient identifiers/.test(await txt('#customwarn')), true);
await pg.fill('#customin', 'IO placed right tibia');
await pg.click('#customlog'); await pg.waitForTimeout(250);
ck('8. a clinical note is accepted', await pg.locator('#customwarn').isVisible(), false);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(250);
ck('8. it reaches the log', /IO placed right tibia/.test(await txt('.accb')), true);
ck('8. the refused text never reached the log', /4471129/.test(await txt('.accb')), false);
/* The tool now shares the manual's ONE timeline: the accepted note lands in the
   shared, PHI-guarded edm-case-log (tagged as the Codes arrest card); the
   refused identifier reaches neither the log nor storage; and only documented
   case/pref keys are ever written — no raw PHI, no undocumented key. */
const s8 = JSON.parse(await pg.evaluate(() => JSON.stringify({
  log: localStorage.getItem('edm-case-log') || '', keys: Object.keys(localStorage) })));
ck('8. the accepted note reached the shared timeline', /IO placed right tibia/.test(s8.log), true);
ck('8. the refused identifier never reached the shared timeline', /4471129/.test(s8.log), false);
ck('8. only documented case/pref keys are persisted',
  s8.keys.every(k => k.startsWith('edm-case-') || k.startsWith('edm-pref-')), true);

/* ---- 9. metronome starts with the code clock ---- */
await fresh();
await pg.click('[data-acc="met"]'); await pg.waitForTimeout(200);
ck('9. metronome is off before the code starts', /START METRONOME/.test(await txt('.accb')), true);
// the accordion is already open — clicking it again would close it
await pg.click('#startbtn'); await pg.waitForTimeout(500);
ck('9. and running once the clock starts', /STOP METRONOME/.test(await txt('.accb')), true);

/* ---- 10. reset is two-tap, and clears everything ---- */
await fresh();
await pg.fill('#wIn', '70'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn'); await pg.waitForTimeout(200);
ck('10. first tap only arms it', await txt('#resetbtn'), 'SURE?');
ck('10. the code is still running', await pg.locator('#cpr').isVisible(), true);
await pg.click('#resetbtn'); await pg.waitForTimeout(300);
ck('10. second tap clears to idle', await pg.locator('#idle').isVisible(), true);
ck('10. shock count cleared', await pg.inputValue('#wIn'), '');
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(250);
ck('10. log cleared', /Nothing logged yet/.test(await txt('.accb')), true);

/* ---- 11. theme, hit targets, and the stamp ---- */
await fresh();
await pg.click('#themebtn'); await pg.waitForTimeout(250);
ck('11. theme toggles to light', await pg.evaluate(() => document.body.dataset.theme), 'light');
ck('11. light accent is Dartmouth green', await pg.evaluate(() =>
  getComputedStyle(document.body).getPropertyValue('--accent').trim()), '#00693E');
await pg.click('#startbtn'); await pg.waitForTimeout(300);
const small = await pg.evaluate(() => [...document.querySelectorAll('button')]
  .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 38)
  .map(el => (el.textContent || '').trim().slice(0, 24)));
ck('11. every visible button is at least 38px tall', small.join(' | ') || 'none', 'none');
/* ---- time of death is a WALL-CLOCK time (issue #129) ----
   Elapsed answers "how long have we been going". The chart and the death
   certificate need "at what time", and nobody reconstructs that from a
   stopwatch afterwards — so the wall time is what is asserted, and the format
   is asserted too, because HH:MM is what gets written down. */
await fresh();
await pg.fill('#wIn', '80'); await pg.waitForTimeout(200);
await pg.click('#startbtn'); await pg.waitForTimeout(350);
ck('12. the code can be ceased at all', await pg.locator('#ceasebtn').count(), 1);
await pg.click('#ceasebtn'); await pg.waitForTimeout(220);
ck('12. ceasing takes a confirm, not one tap', await pg.locator('#ceaseconfirm').isVisible(), true);
await pg.click('#ceaseyes'); await pg.waitForTimeout(350);
ck('12. it reaches the ceased state', await pg.locator('#ceased').isVisible(), true);
const tod = await txt('#deathwall');
ck('12. time of death is a wall clock, not elapsed', /^\d{2}:\d{2}$/.test(tod), true);
ck('12. it agrees with the browser clock', tod, (d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'))(new Date()));
ck('12. elapsed is still shown beside it', /^\d+:\d\d$/.test(await txt('#deathat')), true);
ck('12. the time of death is logged', new RegExp('time of death ' + tod).test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await pg.click('#resumearrest'); await pg.waitForTimeout(300);
ck('12. resuscitation can be resumed', await pg.locator('#ceased').isVisible(), false);
await fresh();

/* The stamp names the LOCAL review, not the upstream one — and says so loudly
   when there has not been one. Both spellings are correct; a stamp that reads
   "last reviewed" on a fork nobody has reviewed is the failure. */
{
  const st = await txt('#verstamp');
  ck('11. version is stamped', /v\d+\.\d+/.test(st), true);
  ck('11. stamp states the local review status',
     /reviewed \d{4}-\d{2}-\d{2}/.test(st) || /NOT LOCALLY REVIEWED/.test(st), true);
}

/* ---- 12. the code blue front door: pulse first, rhythm later --------------- */
await fresh();
const gate = await txt('#pulsegate');
ck('12. idle asks for a pulse before anything else', /FEEL FOR A PULSE/.test(gate), true);
ck('12. ten seconds is the stated ceiling', /TEN SECONDS, NO LONGER/.test(gate), true);
ck('12. uncertainty resolves toward compressions', /not certain there is a pulse, there is no pulse/i.test(gate), true);
ck('12. the primary button is NO PULSE, not START CPR', /NO PULSE — START CPR/.test(await txt('#startbtn')), true);
ck('12. there is a second door for pulse-but-not-breathing', /PULSE, NOT BREATHING/.test(await txt('#respstartbtn')), true);
ck('12. the header does not name a rhythm at idle', /CHECK A PULSE/.test(await txt('#plabel')), true);
ck('12. the paeds bradycardia note is hidden for an adult', await vis('#bradygate'), false);
await pg.fill('#wIn', '18'); await pg.waitForTimeout(250);
ck('12. and appears once the patient is a child', await vis('#bradygate'), true);
ck('12. it names the 60/min threshold', /pulse under 60\/min and poor perfusion/.test(await txt('#bradygate')), true);

/* ---- 13. CPR starts before the rhythm is known, then routes ---------------- */
await fresh();
await pg.fill('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(300);
ck('13. the unknown-rhythm bar is up', await vis('#unknownbar'), true);
ck('13. the header says the rhythm is not yet known', /RHYTHM NOT YET KNOWN/.test(await txt('#plabel')), true);
ck('13. it says the first rhythm chooses the algorithm', /first rhythm you see chooses the algorithm/i.test(await txt('#unknownbar')), true);
ck('13. no named-rhythm bar yet', await vis('#rhythmbar'), false);
await pg.click('#firstrcbtn'); await pg.waitForTimeout(250);
ck('13. the pads-on button opens the rhythm sheet', await vis('#sheet'), true);
await pg.click('#rcshock'); await pg.waitForTimeout(250);
ck('13. shockable names the algorithm in the header', /SHOCKABLE — VF \/ pVT/.test(await txt('#plabel')), true);
ck('13. the unknown bar is gone', await vis('#unknownbar'), false);
ck('13. the rhythm bar explains what shockable means', /Shock, then compressions immediately/.test(await txt('#rhythmbar')), true);
await pg.click('#rhythmchange'); await pg.waitForTimeout(250);
await pg.click('#rcnon'); await pg.waitForTimeout(250);
ck('13. re-checking can switch to non-shockable', /NON-SHOCKABLE — PEA \/ ASYSTOLE/.test(await txt('#plabel')), true);
ck('13. non-shockable pushes epinephrine, not shocks', /Epinephrine as early as possible/.test(await txt('#rhythmbar')), true);
ck('13. amiodarone is de-emphasised in a non-shockable rhythm', await txt('#amiosub'), 'shockable rhythms only');
ck('13. but is still tappable — nothing is locked', await pg.locator('#amiobtn').isEnabled(), true);
ck('13. the shock button no longer says a joule count', /SHOCK — NOT FOR THIS RHYTHM/.test(await txt('#shocklabel')), true);
ck('13. and says why', /PEA and asystole are not shocked/.test(await txt('#shocksub')), true);
ck('13. it is demoted by colour, not by fading it out of legibility',
  await pg.evaluate(() => { const cs = getComputedStyle(document.getElementById('shockbtn'));
    return cs.opacity + '|' + (cs.backgroundColor === 'rgb(198, 50, 56)' || cs.backgroundColor === 'rgb(229, 72, 77)'); }), '1|false');
ck('13. but still tappable if the rhythm has changed', await pg.locator('#shockbtn').isEnabled(), true);
ck('13. epinephrine is promoted instead', /GIVE NOW — as early as possible/.test(await txt('#episub')), true);
await pg.click('#rhythmchange'); await pg.waitForTimeout(200);
await pg.click('#rcshock'); await pg.waitForTimeout(250);
ck('13. switching back to shockable restores the joule count', (await txt('#shocklabel')).includes(`SHOCK ${J[0]} J`), true);
ck('13. and restores the red shock button', await pg.evaluate(() =>
  getComputedStyle(document.getElementById('shockbtn')).backgroundColor !== getComputedStyle(document.getElementById('cyclecard')).backgroundColor), true);
ck('13. re-arrest from ROSC returns to an unknown rhythm', await (async () => {
  await pg.click('#roscbtn'); await pg.waitForTimeout(250);
  await pg.click('#rearrestbtn'); await pg.waitForTimeout(250);
  return /RHYTHM NOT YET KNOWN/.test(await txt('#plabel'));
})(), true);

/* ---- 14. rescue breathing — the adult rate ---------------------------------
   AHA 2025 Part 7: 1 ventilation every 6 s, 10/min. Class 2a, LOE C-LD. */
await fresh();
await pg.fill('#wIn', '80'); await pg.waitForTimeout(200);
await pg.click('#respstartbtn'); await pg.waitForTimeout(300);
ck('14. the rescue-breathing screen is up', await vis('#resp'), true);
ck('14. the CPR screen is not', await vis('#cpr'), false);
ck('14. status word says rescue breathing', await txt('#statusword'), 'RESCUE BREATHING');
ck('14. the header names respiratory arrest with a pulse', /RESPIRATORY ARREST · PULSE PRESENT/.test(await txt('#plabel')), true);
ck('14. the adult rate is 1 breath every 6 s, 10/min', /1 breath every 6 s \(10\/min\) · adult/.test(await txt('#ventlabel')), true);
ck('14. the first breath is prompted immediately', (await nBreaths()) >= 1, true);
ck('14. the cue reads BREATHE NOW at the moment of the breath', /BREATHE/.test(await txt('#ventcue')), true);
ck('14. it warns against hyperventilation', /Hyperventilation raises intrathoracic pressure/i.test(await txt('#ventcard')), true);
ck('14. the compression metronome is not also running',
  /START METRONOME/.test(await openAcc('met')), true);
const adultAt0 = await nBreaths();
await pg.waitForTimeout(3600);
ck('14. no second adult breath inside 3.6 s', await nBreaths(), adultAt0);
await pg.waitForTimeout(2900);
ck('14. the second adult breath lands by 6.5 s', await nBreaths(), adultAt0 + 1);

/* ---- 15. rescue breathing — the pediatric rate ----------------------------
   AHA/AAP 2025 Part 6: 1 breath every 2-3 s, 20-30/min. Class 2a, LOE C-EO.
   Faster than the adult rate, which is the number most often got wrong. */
await fresh();
await pg.fill('#wIn', '18'); await pg.waitForTimeout(200);
await pg.click('#respstartbtn'); await pg.waitForTimeout(300);
ck('15. the child rate is 1 breath every 2–3 s, 20–30/min',
  /1 breath every 2–3 s \(20–30\/min\) · pediatric/.test(await txt('#ventlabel')), true);
ck('15. the pediatric bradycardia card is showing', await vis('#bradycard'), true);
ck('15. it says compressions despite a palpable pulse', /even though you can feel a pulse/i.test(await txt('#bradycard')), true);
const pedsAt0 = await nBreaths();
await pg.waitForTimeout(3400);
ck('15. a child gets a second breath inside 3.4 s where an adult does not',
  (await nBreaths()) >= pedsAt0 + 1, true);
ck('15. the paced child rate is faster than the paced adult rate',
  (await nBreaths()) - pedsAt0 > 0, true);

/* ---- 16. the recurring pulse check, and losing the pulse ------------------- */
await fresh();
await pg.fill('#wIn', '80'); await pg.click('#respstartbtn'); await pg.waitForTimeout(300);
ck('16. no pulse prompt at the start', await vis('#pulsedue'), false);
await skew(121000);
ck('16. the prompt appears at two minutes', await vis('#pulsedue'), true);
ck('16. it caps the check at ten seconds', /Ten seconds, no longer/.test(await txt('#pulsedue')), true);
await pg.click('#pulseyes'); await pg.waitForTimeout(300);
ck('16. answering "still a pulse" clears the prompt', await vis('#pulsedue'), false);
ck('16. and stays in rescue breathing', await vis('#resp'), true);
await skew(242000);
ck('16. the prompt returns another two minutes later', await vis('#pulsedue'), true);
await pg.click('#pulseno'); await pg.waitForTimeout(350);
ck('16. answering "no pulse" starts CPR', await vis('#cpr'), true);
ck('16. and does so with the rhythm unknown', /RHYTHM NOT YET KNOWN/.test(await txt('#plabel')), true);
ck('16. the breath tone stopped when CPR started', /STOP METRONOME/.test(await openAcc('met')), true);

/* ---- 17. every other door into and out of rescue breathing ----------------- */
await fresh();
await pg.fill('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('#rcbtn'); await pg.waitForTimeout(200);
await pg.click('#rcorg'); await pg.waitForTimeout(200);
ck('17. the organized-rhythm step offers three answers, not two',
  await pg.locator('#rcorgstep button').count(), 3);
await pg.click('#rcpulsenobreath'); await pg.waitForTimeout(350);
ck('17. pulse-but-not-breathing at the rhythm check goes to rescue breathing', await vis('#resp'), true);
await pg.click('#respok'); await pg.waitForTimeout(300);
ck('17. "breathing on their own" stops the tone', /TONE STOPPED/.test(await txt('#ventcue')), true);
ck('17. and shows the keep-watching card', await vis('#spontcard'), true);
const frozen = await nBreaths();
await pg.waitForTimeout(1500);
ck('17. no further breaths are counted once it is stopped', await nBreaths(), frozen);
await pg.click('#respresume'); await pg.waitForTimeout(300);
ck('17. apnoeic again resumes the tone', await vis('#spontcard'), false);
await pg.click('#respcpr'); await pg.waitForTimeout(350);
ck('17. losing the pulse from rescue breathing starts CPR', await vis('#cpr'), true);
await fresh();
await pg.fill('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('#roscbtn'); await pg.waitForTimeout(250);
await pg.click('#roscvent'); await pg.waitForTimeout(350);
ck('17. post-ROSC apnoea routes to rescue breathing too', await vis('#resp'), true);
ck('17. there is a way out to the airway ladder',
  await pg.getAttribute('#resplink', 'href'), '../airway/');

/* ---- 18. the PHI guard covers the second log field too -------------------- */
await pg.click('#resplog'); await pg.waitForTimeout(250);
await pg.fill('#customin2', 'MRN 883210');
await pg.click('#customlog2'); await pg.waitForTimeout(250);
ck('18. a record number is refused in rescue breathing too', await vis('#customwarn2'), true);
ck('18. with the same explanation', /mentions a record or account number/.test(await txt('#customwarn2')), true);
await pg.fill('#customin2', 'naloxone 0.4 mg IV, chest rising');
await pg.click('#customlog2'); await pg.waitForTimeout(250);
ck('18. a clinical note is accepted', await vis('#customrow2'), false);
ck('18. and reaches the in-tool log', /naloxone 0\.4 mg IV, chest rising/.test(await openAcc('log')), true);
const s18 = JSON.parse(await pg.evaluate(() => JSON.stringify({
  log: localStorage.getItem('edm-case-log') || '', keys: Object.keys(localStorage) })));
ck('18. and the shared manual-wide timeline', /naloxone 0\.4 mg IV, chest rising/.test(s18.log), true);
ck('18. only documented case/pref keys are persisted',
  s18.keys.every(k => k.startsWith('edm-case-') || k.startsWith('edm-pref-')), true);

/* ---- 19. the rescue-breathing reference, with its sources ------------------ */
await fresh();
const ventAcc = await openAcc('vent');
ck('19. states it is neither an arrest nor a difficult airway', /not a cardiac arrest and not a difficult airway/i.test(ventAcc), true);
ck('19. adult 6 s / 10 per min with its class', /1 breath every 6 s \(10\/min\)\. AHA 2025 Part 7, Adult BLS — Class 2a, LOE C-LD/.test(ventAcc), true);
ck('19. child 2–3 s / 20–30 per min with its class', /1 breath every 2–3 s \(20–30\/min\)\. AHA\/AAP 2025 Part 6, Pediatric BLS — Class 2a, LOE C-EO/.test(ventAcc), true);
ck('19. says which number the metronome picked and why', /slow end, because over-ventilating a small chest is the commoner error/i.test(ventAcc), true);
ck('19. cites the adult DOI', /10\.1161\/CIR\.0000000000001369/.test(ventAcc), true);
ck('19. cites the pediatric DOI', /10\.1161\/CIR\.0000000000001370/.test(ventAcc), true);
ck('19. names the gap it exists to fill', /Neither the arrest algorithm nor DAS 2025 covers this patient/.test(ventAcc), true);
const cprAcc = await openAcc('cpr');
ck('19. the advanced-airway line now carries both rates',
  /every 6 s in an adult \(10\/min\) or every 2–3 s in a child \(20–30\/min\)/.test(cprAcc), true);
ck('19. and flags that the child rate is the faster one', /child rate is faster than the adult one/.test(cprAcc), true);

/* ---- 20. reset clears the rescue-breathing state as well ------------------- */
await fresh();
await pg.fill('#wIn', '80'); await pg.click('#respstartbtn'); await pg.waitForTimeout(400);
await pg.click('#resetbtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn'); await pg.waitForTimeout(400);
ck('20. reset returns to idle from rescue breathing', await vis('#idle'), true);
ck('20. the breath tone stopped', await nBreaths(), 0);
ck('20. the weight is cleared', await pg.inputValue('#wIn'), '');
ck('20. the header is back to the pulse question', /CHECK A PULSE/.test(await txt('#plabel')), true);
ck('20. the log is empty', /Nothing logged yet/.test(await openAcc('log')), true);

ck('21. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('21. still no off-origin requests after the whole run', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
