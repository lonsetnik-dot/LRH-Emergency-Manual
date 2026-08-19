/* LRH Emergency Manual — the mobile arrest screen (/arrest/).
 *
 * The design handoff is UI; the clinical logic is the manual's. This suite exists to prove the
 * second half of that sentence: that adopting the new interface did not quietly adopt the
 * prototype's dose math along with it. The prototype showed a flat 200 J for adults; LRH runs an
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
/* A clean slate per test group. The tool now shares the manual's lrh- case
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
/* The shell's weight strip (SHELL.md layer 4) is collapsed by default on a
   phone — open it before reaching for the inputs, the same tap a clinician
   makes. ESTIMATE closes it again, so every fill goes through this. */
const fillW = async (sel, v) => {
  if (!(await pg.locator(sel).isVisible().catch(() => false))) { await pg.click('#wtoggle'); await pg.waitForTimeout(200); }
  await pg.fill(sel, v);
};
/* The old EVENT LOG accordion is now the shell timeline (layer 8): the pill
   opens it while a case runs; the ⋯ menu opens it at idle. */
const openTL = async () => {
  if (await pg.locator('#shelltl').isVisible()) return;
  if (await pg.locator('#casepill').isVisible()) await pg.click('#casepill');
  else { await pg.click('#menubtn'); await pg.waitForTimeout(150); await pg.click('#tlbtn'); }
  await pg.waitForTimeout(250);
};
const tlText = async () => { await openTL(); const t = await txt('#tlrows'); await pg.click('#tlclose'); await pg.waitForTimeout(150); return t; };
const nBreaths = async () => parseInt(await txt('#breathn'), 10);
const openAcc = async id => { await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(250);
  return (await pg.locator('.accb').innerText()).replace(/\s+/g, ' ').trim(); };

/* ---- CONFIG-DRIVEN EXPECTATIONS (issue #117) -------------------------------
   Read the tool's own SITE block and assert the UI against THAT, rather than
   against LRH's numbers written out here a second time.

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
const J = CFG.defib.adultJ;                     // e.g. [120, 150, 200]
const JMAX = J[J.length - 1];

/* ---- 1. offline-safe: nothing is fetched from anywhere else ---- */
await fresh();
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. starts in the idle phase', await pg.locator('#idle').isVisible(), true);
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');

/* ---- 2. ADULT dose math — the site's escalating sequence, NOT the prototype's flat 200 ---- */
await fillW('#wIn', '80'); await pg.waitForTimeout(250);
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
await fillW('#wIn', '20'); await pg.waitForTimeout(250);
ck('3. pediatric mode on under 50 kg', await txt('#wnote'), '20 kg · pediatric');
/* The dismissible peds banner is retired (SHELL.md 2026-08-15 review): the
   dosing mode is stated by the weight strip's own collapsed row, and the
   compact drawer chip carries the Broselow wayfinding. */
ck('3. no dismissible peds-mode banner exists', await pg.locator('#pedsbanner').count(), 0);
ck('3. the weight strip row states the mode instead', await txt('#wlabel'), '20 kg · PALS (pediatric)');
ck('3. the drawer chip names the band + cart on one line', /BLUE 18–23 kg · PEDS CART/.test(await txt('#brosechip')), true);
ck('3. accent becomes the band color', await pg.evaluate(() =>
  getComputedStyle(document.body).getPropertyValue('--accent').trim()), '#2E86C1');
await pg.click('#startbtn'); await pg.waitForTimeout(300);
/* 2026-08-15 review: the computed dose/energy rides the dock button labels. */
ck(`3. dock SHOCK label carries the weight-computed energy`, await txt('#dockshocklabel'), `SHOCK ${CFG.peds.defibPerKg1 * 20} J`);
ck(`3. dock EPI label carries the weight-computed dose`, await txt('#dockepilabel'), `EPI ${CFG.peds.epiPerKg * 20} mg`);
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
await fillW('#wIn', '49'); await pg.waitForTimeout(250);
await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('[data-acc="defib"]'); await pg.waitForTimeout(200);
/* Universal invariant: per-kg energy must never exceed the adult ceiling,
   whatever either number is locally. At 49 kg, defibMaxPerKg would compute far
   past it. */
ck(`3. ${CFG.peds.defibMaxPerKg} J/kg is capped at the adult max (${JMAX} J)`,
   (await txt('.accb')).includes(`${JMAX} J`), true);

/* ---- 4. the age arm of the trigger, and refusing to invent a number ---- */
await fresh();
await fillW('#aIn', '6'); await pg.waitForTimeout(250);
ck('4. age alone triggers pediatric mode', /pediatric by age/.test(await txt('#wnote')), true);
await pg.click('#startbtn'); await pg.waitForTimeout(250);
ck('4. refuses to print an energy with no weight', /ENTER WEIGHT/.test(await txt('#shocklabel')), true);
ck('4. refuses to print an epi dose with no weight', /ENTER WEIGHT/.test(await txt('#epilabel')), true);
/* Universal invariant on the dock too: bare labels, never an invented number. */
ck('4. dock labels refuse a number with no weight',
   (await txt('#dockshocklabel')) === 'SHOCK' && (await txt('#dockepilabel')) === 'EPI', true);
if (!(await pg.locator('#estbtn').isVisible())) { await pg.click('#wtoggle'); await pg.waitForTimeout(200); }
await pg.click('#estbtn'); await pg.waitForTimeout(300);
/* APLS band for a 6-year-old is 3 x age + 7 — the manual's single estimator
   (same formula as peds/), which replaced the old 2 x age + 8 here. */
ck('4. ESTIMATE KG fills a weight (3 x age + 7)', await pg.inputValue('#wIn'), '25');
/* The estimator refuses beyond 12 y instead of flipping an adolescent into
   pediatric mode via a small estimated weight. */
ck('4. ESTIMATE KG refuses age > 12 y', await (async () => {
  await fillW('#aIn', '16'); await pg.waitForTimeout(250);
  await pg.click('#estbtn'); await pg.waitForTimeout(250);
  return /VALID TO 12/.test(await txt('#werr'));
})(), true);
ck('4. the estimate is logged AS an estimate', /ESTIMATED/.test(await tlText()), true);

/* ---- 4b. the NRP off-ramp and the write-side weight validation ------------
   A sub-3 kg weight asks "newly born? -> NRP" instead of silently dosing PALS
   (and no longer claims a Broselow Grey drawer); an implausible weight is
   refused with a visible message instead of being written to the shared key
   for other tools to trust. */
await fresh();
await fillW('#wIn', '2'); await pg.waitForTimeout(300);
ck('4b. under 3 kg shows the NRP banner', await pg.locator('#nrpbanner').isVisible(), true);
ck('4b. the banner links to the NRP engine', /neonatal\/\?from=arrest/.test(await pg.getAttribute('#nrpbanner a', 'href')), true);
ck('4b. under 3 kg claims no Broselow drawer', await pg.locator('#brosechip').isVisible(), false);
await pg.click('#dismissnrp'); await pg.waitForTimeout(250);
ck('4b. dismiss hides the banner but keeps PALS mode', await pg.locator('#nrpbanner').isVisible(), false);
ck('4b. PALS dosing still available after dismissal', /pediatric/.test(await txt('#wnote')), true);
await fillW('#wIn', '350'); await pg.waitForTimeout(300);
ck('4b. an implausible weight is refused loudly', /NOT SAVED/.test(await txt('#werr')), true);
ck('4b. and the last good weight survives it', /2 kg/.test(await txt('#wnote')), true);
ck('4b. and nothing implausible reached the shared key', await pg.evaluate(() => localStorage.getItem('lrh-case-wtkg')), '2');
await fresh();
await fillW('#aIn', '0'); await pg.waitForTimeout(300);
ck('4b. age 0 shows the NRP banner too', await pg.locator('#nrpbanner').isVisible(), true);

/* ---- 5. the override is loud and reversible, not a silent switch ----
   2026-08-15 review: leaving pediatric dosing is the explicitly labeled
   TREAT AS ADULT inside the weight form — never a DISMISS, which read as
   "hide this warning" while leaving the dosing mode ambiguous. */
await fresh();
await fillW('#wIn', '30'); await pg.waitForTimeout(250);
ck('5. the form states pediatric criteria are met', /Pediatric criteria met — dosing is weight-based PALS/.test(await txt('#pedscrit')), true);
ck('5. the way out is labeled TREAT AS ADULT, not DISMISS', await txt('#dismisspeds'), 'TREAT AS ADULT');
await pg.click('#dismisspeds'); await pg.waitForTimeout(250);
ck('5. TREAT AS ADULT switches to adult dosing', await txt('#wnote'), '30 kg · adult');
ck('5. the collapsed row states adult mode too', await txt('#wlabel'), '30 kg · adult');
ck('5. an override bar stays visible', await pg.locator('#overridebar').isVisible(), true);
ck('5. and the criteria line yields to it', await pg.locator('#pedscrit').isVisible(), false);
await pg.click('#undooverride'); await pg.waitForTimeout(250);
ck('5. undo returns to pediatric', await txt('#wnote'), '30 kg · pediatric');
ck('5. and the row says PALS again', await txt('#wlabel'), '30 kg · PALS (pediatric)');

/* ---- 6. cycle timer and the due state ---- */
await fresh();
await fillW('#wIn', '70'); await pg.waitForTimeout(200);
await pg.click('#startbtn'); await pg.waitForTimeout(300);
ck('6. countdown starts at 2:00', /^[12]:\d\d$/.test(await txt('#cycleclock')), true);
ck('6. shock button is showing, due button is not', await pg.locator('#duebtn').isVisible(), false);
// jump the clock forward past the cycle rather than waiting it out — derived
// from SITE.cpr.cycleSec so a fork with a different cycle stays green (#117)
await pg.evaluate(ms => { const real = Date.now; window.Date.now = () => real.call(Date) + ms; },
  (Math.max(CFG.cpr.cycleSec, CFG.epi.suggestSec) + 5) * 1000);
await pg.waitForTimeout(700);
ck('6. rhythm-check due button appears at 0:00', await pg.locator('#duebtn').isVisible(), true);
ck('6. shock button hides while due', await pg.locator('#shockbtn').isVisible(), false);
ck('6. epi shows DUE NOW once the interval passes', /DUE NOW|give now/.test(await txt('#episub')), true);
await pg.evaluate(() => { location.reload(); });
await pg.waitForTimeout(400);

/* ---- 7. rhythm-check sheet, both branches ---- */
await fresh();
await fillW('#wIn', '70'); await pg.click('#startbtn'); await pg.waitForTimeout(300);
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
const tl8 = await tlText();
ck('8. it reaches the timeline', /IO placed right tibia/.test(tl8), true);
ck('8. the refused text never reached the timeline', /4471129/.test(tl8), false);
/* The tool now shares the manual's ONE timeline: the accepted note lands in the
   shared, PHI-guarded lrh-case-log (tagged as the Codes arrest card); the
   refused identifier reaches neither the log nor storage; and only documented
   case/pref keys are ever written — no raw PHI, no undocumented key. */
const s8 = JSON.parse(await pg.evaluate(() => JSON.stringify({
  log: localStorage.getItem('lrh-case-log') || '', keys: Object.keys(localStorage) })));
ck('8. the accepted note reached the shared timeline', /IO placed right tibia/.test(s8.log), true);
ck('8. the refused identifier never reached the shared timeline', /4471129/.test(s8.log), false);
ck('8. only documented case/pref keys are persisted',
  s8.keys.every(k => k.startsWith('lrh-case-') || k.startsWith('lrh-pref-')), true);

/* ---- 9. metronome starts with the code clock ---- */
await fresh();
await pg.click('[data-acc="met"]'); await pg.waitForTimeout(200);
ck('9. metronome is off before the code starts', /START METRONOME/.test(await txt('.accb')), true);
// the accordion is already open — clicking it again would close it
await pg.click('#startbtn'); await pg.waitForTimeout(500);
ck('9. and running once the clock starts', /STOP METRONOME/.test(await txt('.accb')), true);

/* ---- 10. reset is two-tap, and clears everything (SHELL.md layer 9: the
   phone entry point is the ⋯ menu row; the same SURE? arm either way) ---- */
await fresh();
await fillW('#wIn', '70'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
await pg.click('#shockbtn'); await pg.waitForTimeout(200);
await pg.click('#menubtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn'); await pg.waitForTimeout(200);
ck('10. first tap only arms it', /SURE\?/.test(await txt('#resetbtn')), true);
ck('10. the code is still running', await pg.locator('#cpr').isVisible(), true);
await pg.click('#resetbtn'); await pg.waitForTimeout(300);
ck('10. second tap clears to idle', await pg.locator('#idle').isVisible(), true);
ck('10. weight cleared', await pg.inputValue('#wIn'), '');
ck('10. the amber cleared toast is up', await pg.locator('#shelltoast').isVisible(), true);
await pg.click('#toastok'); await pg.waitForTimeout(150);
ck('10. OK dismisses the toast', await pg.locator('#shelltoast').isVisible(), false);
ck('10. log cleared', /Nothing logged yet/.test(await tlText()), true);

/* ---- 11. no theme toggle, feedback link, hit targets, and the stamp ----
   Theme switching was removed from every tool except the landing page
   (issue: feedback/theme consolidation) — arrest/ is dark-only now. Feedback
   lives inline in the bar >=768px (#feedbacklink) and in the phone's
   ... menu (#feedbackmenu); both are mailto links. */
await fresh();
ck('11. no theme toggle button on this tool', await pg.locator('#themebtn').count(), 0);
ck('11. still dark (only theme now)', await pg.evaluate(() => document.body.dataset.theme), 'dark');
ck('11. the wide bar carries a feedback link', await pg.locator('#feedbacklink').count(), 1);
ck('11. it is a mailto: link', (await pg.getAttribute('#feedbacklink', 'href') || '').startsWith('mailto:'), true);
ck('11. the phone menu carries one too', (await pg.getAttribute('#feedbackmenu', 'href') || '').startsWith('mailto:'), true);
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
await fillW('#wIn', '80'); await pg.waitForTimeout(200);
await pg.click('#startbtn'); await pg.waitForTimeout(350);
ck('12. the code can be ceased at all', await pg.locator('#ceasebtn').count(), 1);
await pg.click('#ceasebtn'); await pg.waitForTimeout(220);
ck('12. ceasing takes a confirm, not one tap', await pg.locator('#ceaseconfirm').isVisible(), true);
const todBefore = Date.now();
await pg.click('#ceaseyes'); await pg.waitForTimeout(350);
ck('12. it reaches the ceased state', await pg.locator('#ceased').isVisible(), true);
const tod = await txt('#deathwall');
ck('12. time of death is a wall clock, not elapsed', /^\d{2}:\d{2}$/.test(tod), true);
/* The page stamped the minute it pronounced; this reads it a moment later.
   Comparing against a single new Date() fails whenever the minute rolls over in
   between — a 1-in-60 flake that turns CI red for no clinical reason (it did:
   got=19:53 want=19:54). Accept any minute the pronouncement actually spanned,
   and no others — a stamp outside that window is still a real failure. */
const todAfter = Date.now();
const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const spanned = new Set([hhmm(todBefore), hhmm(todAfter)]);
for (let t = todBefore; t < todAfter; t += 15000) spanned.add(hhmm(t));
ck('12. it agrees with the browser clock (within the pronouncement window)',
   spanned.has(tod) ? 'in [' + [...spanned].join(', ') + ']' : tod + ' NOT in [' + [...spanned].join(', ') + ']',
   'in [' + [...spanned].join(', ') + ']');
ck('12. elapsed is still shown beside it', /^\d+:\d\d$/.test(await txt('#deathat')), true);
ck('12. the time of death is logged', new RegExp('time of death ' + tod).test(await tlText()), true);
await pg.click('#resumearrest'); await pg.waitForTimeout(300);
ck('12. resuscitation can be resumed', await pg.locator('#ceased').isVisible(), false);
await fresh();

ck('11. version and disclaimer are stamped', /v\d+\.\d+(\.\d+)? · last reviewed/.test(await txt('#verstamp')), true);

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
await fillW('#wIn', '18'); await pg.waitForTimeout(250);
ck('12. and appears once the patient is a child', await vis('#bradygate'), true);
ck('12. it names the 60/min threshold', /pulse under 60\/min and poor perfusion/.test(await txt('#bradygate')), true);

/* ---- 13. CPR starts before the rhythm is known, then routes ---------------- */
await fresh();
await fillW('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(300);
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
ck('13. it is demoted by color, not by fading it out of legibility',
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
await fillW('#wIn', '80'); await pg.waitForTimeout(200);
await pg.click('#respstartbtn'); await pg.waitForTimeout(300);
ck('14. the rescue-breathing screen is up', await vis('#resp'), true);
ck('14. the CPR screen is not', await vis('#cpr'), false);
ck('14. the case pill tags the rescue-breathing phase', await txt('#pilltag'), 'RESP');
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
await fillW('#wIn', '18'); await pg.waitForTimeout(200);
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
await fillW('#wIn', '80'); await pg.click('#respstartbtn'); await pg.waitForTimeout(300);
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
await fillW('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
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
await fillW('#wIn', '80'); await pg.click('#startbtn'); await pg.waitForTimeout(250);
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
ck('18. and reaches the in-tool timeline', /naloxone 0\.4 mg IV, chest rising/.test(await tlText()), true);
const s18 = JSON.parse(await pg.evaluate(() => JSON.stringify({
  log: localStorage.getItem('lrh-case-log') || '', keys: Object.keys(localStorage) })));
ck('18. and the shared manual-wide timeline', /naloxone 0\.4 mg IV, chest rising/.test(s18.log), true);
ck('18. only documented case/pref keys are persisted',
  s18.keys.every(k => k.startsWith('lrh-case-') || k.startsWith('lrh-pref-')), true);

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
await fillW('#wIn', '80'); await pg.click('#respstartbtn'); await pg.waitForTimeout(400);
await pg.click('#menubtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn'); await pg.waitForTimeout(400);
ck('20. reset returns to idle from rescue breathing', await vis('#idle'), true);
ck('20. the breath tone stopped', await nBreaths(), 0);
ck('20. the weight is cleared', await pg.inputValue('#wIn'), '');
ck('20. the header is back to the pulse question', /CHECK A PULSE/.test(await txt('#plabel')), true);
await pg.click('#toastok').catch(() => {});
ck('20. the log is empty', /Nothing logged yet/.test(await tlText()), true);

/* ======================= THE CASE SHELL (SHELL.md) =========================
   Layers 1-9 on the reference implementation. Config-driven like everything
   above: cadence durations, rates and energies come from window.SITE; what is
   hardcoded is the universal shell contract — the timer/dose/action are one
   button (2026-08-15 review), DUE NOW at zero, semantic slot colors, the 10 s
   check pause, the PHI-free timeline footer. */

/* ---- 22. app bar: pill, tool switcher, tele-ED ---- */
await fresh();
ck('22. idle: no case pill, READY instead', (await vis('#casepill')) === false && (await vis('#statusword')), true);
await pg.click('#toolbtn'); await pg.waitForTimeout(200);
ck('22. the tool name opens the switcher', await vis('#toolmenu'), true);
const switcher = await txt('#toolmenu');
ck('22. it lists the six live engines + manual home',
   ['Arrest','TCA','Airway','Neonatal','PPH','Dystocia','Manual home'].every(n => switcher.includes(n)), true);
await pg.click('#toolbtn'); await pg.waitForTimeout(150);
ck('22. tele-ED is face up before the case starts', await vis('#telebtn'), true);
await pg.click('#telebtn'); await pg.waitForTimeout(200);
ck('22. one tap collapses it to a confirmation row', await vis('#teledone'), true);
ck('22. and the button is gone (idempotent)', await vis('#telebtn'), false);
await pg.click('#teledone').catch(() => {}); await pg.waitForTimeout(150);
ck('22. a second tap logs nothing twice',
   (await tlText()).split('Tele-ED activated').length - 1, 1);
await pg.click('#startbtn'); await pg.waitForTimeout(400);
ck('22. the pill owns the bar center while running', await vis('#casepill'), true);
ck('22. mono digits + the CODE tag', /^\d+:\d\d$/.test(await txt('#pillclock')) && await txt('#pilltag') === 'CODE', true);
ck('22. a pre-case tele activation seeds the log', /Tele-ED already on the line/.test(await tlText()), true);
ck('22. tapping the pill opens the timeline', await (async () => {
  await pg.click('#casepill'); await pg.waitForTimeout(250);
  const open = await vis('#shelltl');
  await pg.click('#tlclose'); await pg.waitForTimeout(150);
  return open;
})(), true);

/* ---- 23. dock: the timer, the dose and the action are ONE button ----
   2026-08-15 review: no phone cadence chips — a cadence with a dock slot
   renders inside that button (countdown as a second mono line, DUE NOW red at
   zero) and the computed energy/dose rides the label. */
await fresh();
await fillW('#wIn', '70'); await pg.waitForTimeout(200);
await pg.click('#wtoggle'); await pg.waitForTimeout(200);   /* collapse — the running screen a clinician sees */
await pg.click('#startbtn'); await pg.waitForTimeout(500);
ck('23. the strip and dock appear with the case', (await vis('#shellstrip')) && (await vis('#shelldock')), true);
ck('23. no phone cadence chips remain anywhere', await pg.locator('#chiprc, #chipepi, .shellchip').count(), 0);
ck('23. dock slots carry the semantic scheme colors', await pg.evaluate(() =>
  document.getElementById('dockshock').classList.contains('scheme-amber') &&
  document.getElementById('dockepi').classList.contains('scheme-purple') &&
  document.getElementById('dockrc').classList.contains('scheme-blue')), true);
ck('23. dock buttons hold the 54px floor', await pg.evaluate(() =>
  ['dockshock','dockepi','dockrc'].every(id => document.getElementById(id).getBoundingClientRect().height >= 54)), true);
ck('23. the dock never covers the last content', await pg.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingBottom) >= 120), true);
/* The user's core complaint, held from here on: with a case running and a
   weight set, the operating card's clock and every dock action fit on a
   390x844 phone with NO scrolling. */
ck('23. 390x844: cycle clock + all three dock buttons above the fold', await pg.evaluate(() => {
  window.scrollTo(0, 0);
  const vh = window.innerHeight;
  const ok = id => { const r = document.getElementById(id).getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= vh; };
  return ['cycleclock', 'dockshock', 'dockepi', 'dockrc'].every(ok);
}), true);
ck('23. the running screen leads with the operating card, dosing last as reference', await pg.evaluate(() => {
  const y = id => document.getElementById(id).getBoundingClientRect().top + window.scrollY;
  return y('cyclecard') < y('rolesstep') && y('rolesstep') < y('telewrap') && y('telewrap') < y('dosingblock');
}), true);
ck('23. the dosing block is retitled as reference while running', await txt('#dosingtitle'), 'DOSING REFERENCE');
{
  const rc = await txt('#dockrcclock');
  const full = CFG.cpr.cycleSec;
  const [m, sec] = rc.split(':').map(Number);
  ck(`23. RHYTHM ✓ counts down inside the button from SITE.cpr.cycleSec (${full}s)`, (m * 60 + sec) > full - 6 && (m * 60 + sec) <= full, true);
}
ck('23. the EPI button reads GIVE NOW before the first dose', await txt('#dockepiclock'), 'GIVE NOW');
ck(`23. the EPI label carries the config dose (${CFG.epi.adultMg} mg)`, await txt('#dockepilabel'), `EPI ${CFG.epi.adultMg} mg`);
ck(`23. the SHOCK label carries the config energy (${J[0]} J)`, await txt('#dockshocklabel'), `SHOCK ${J[0]} J`);
/* The dock renders on the 200ms paint loop, so a click issued the instant
   after the assertions above can land before the button is stable — this
   line has timed out three times on a loaded runner while passing in
   isolation. Wait for the control rather than for a fixed interval. */
await pg.locator('#dockepi').waitFor({ state: 'visible', timeout: 10000 });
await pg.click('#dockepi'); await pg.waitForTimeout(300);
ck('23. the EPI button IS the epi action (logs a dose)', /EPI .*dose #1/.test(await txt('#tickertext')), true);
{
  const ec = await txt('#dockepiclock');
  const [m, sec] = ec.split(':').map(Number);
  ck(`23. then counts down from SITE.epi.suggestSec (${CFG.epi.suggestSec}s)`, (m * 60 + sec) > CFG.epi.suggestSec - 6 && (m * 60 + sec) <= CFG.epi.suggestSec, true);
}
/* Jump past both cadences: both in-button countdowns must escalate to DUE NOW red. */
await skew((Math.max(CFG.cpr.cycleSec, CFG.epi.suggestSec) + 5) * 1000);
ck('23. the RHYTHM countdown escalates to DUE NOW at zero', await txt('#dockrcclock'), 'DUE NOW');
ck('23. and turns red (the .due state)', await pg.evaluate(() => document.getElementById('dockrcclock').classList.contains('due')), true);
ck('23. the EPI countdown escalates to DUE NOW too', await txt('#dockepiclock'), 'DUE NOW');
await pg.click('#dockshock'); await pg.waitForTimeout(300);
ck('23. SHOCK resets the rhythm cadence', (await txt('#dockrcclock')) !== 'DUE NOW', true);
ck('23. and logs the configured energy', new RegExp('SHOCK ' + J[0] + ' J').test(await txt('#tickertext')), true);
ck('23. the ticker rides on the dock with LOG ->', /LOG/.test(await txt('#ticker')), true);

/* ---- 24. picker + metronome pause (layers 3/7) ---- */
await pg.click('#dockrc'); await pg.waitForTimeout(300);
ck('24. RHYTHM opens the picker', await vis('#sheet'), true);
ck('24. and pauses the metronome with a visible countdown', /paused \d+ s/.test(await txt('#metstatus')), true);
await pg.click('#rcclose'); await pg.waitForTimeout(200);
ck('24. the X closes without logging a check', /Rhythm check/.test(await txt('#tickertext')), false);
await pg.click('#rcbtn'); await pg.waitForTimeout(250);
ck('24. the cycle card\'s RHYTHM CHECK opens the same picker', await vis('#sheet'), true);
await pg.click('#rcnon'); await pg.waitForTimeout(300);
ck('24. picking a result logs the RESULT', /Non-shockable/.test(await txt('#tickertext')), true);
ck('24. and restarts the cadence', (await txt('#dockrcclock')) !== 'DUE NOW', true);
ck('24. metronome mode reads the config ratio', await txt('#metmode'),
   CFG.cpr.compressionsPerCycle + ':' + CFG.cpr.breathsPerCycle + ' · ' + CFG.cpr.bpm);
await pg.click('#advchip'); await pg.waitForTimeout(250);
ck('24. ADV AIRWAY flips the mode to continuous', await txt('#metmode'), 'CONT · ' + CFG.cpr.bpm);
ck('24. and is logged to the timeline', /Advanced airway placed/.test(await txt('#tickertext')), true);
await pg.click('#mutechip'); await pg.waitForTimeout(250);
ck('24. MUTE stills the dot (gray, not beating)', await pg.evaluate(() =>
  document.getElementById('metdot').classList.contains('off')), true);
ck('24. and says the timing continues', /muted/.test(await txt('#metstatus')), true);
ck('24. the timeline footer states the privacy contract', await (async () => {
  await openTL(); const f = await txt('#shelltl'); await pg.click('#tlclose'); await pg.waitForTimeout(150);
  return /device only · no identifiers · cleared on reset/.test(f);
})(), true);

/* ---- 25. >=768px: dock moves into the strip, weight stays open, reset inline ---- */
const wideP = await b.newPage({ viewport: { width: 820, height: 1100 } });
wideP.on('pageerror', e => errs.push('wide: ' + e));
const wtxt = async sel => (await wideP.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
await wideP.goto(BASE + '/arrest/', { waitUntil: 'networkidle' });
await wideP.evaluate(() => localStorage.clear());
await wideP.reload({ waitUntil: 'networkidle' }); await wideP.waitForTimeout(300);
ck('25. wide: the weight form is open until a weight is set', await wideP.locator('#wform').isVisible(), true);
ck('25. wide: MANUAL breadcrumb replaces the bare chevron', await wideP.locator('#backlinkwide').isVisible(), true);
ck('25. wide: TIMELINE / FEEDBACK / RESET sit inline', await wideP.locator('#tlbtnwide').isVisible()
   && await wideP.locator('#feedbacklink').isVisible() && await wideP.locator('#resetwide').isVisible(), true);
ck('25. wide: no ... menu button', await wideP.locator('#menubtn').isVisible(), false);
await wideP.fill('#wIn', '70'); await wideP.waitForTimeout(250);
await wideP.click('#wdone'); await wideP.waitForTimeout(250);
ck('25. wide: DONE collapses to a slim confirmed row', await wideP.locator('#wform').isVisible(), false);
ck('25. wide: which offers tap-to-change', /tap to change/.test(await wtxt('#wtoggle')), true);
ck('25. wide: secondary doses are face up (no toggle)', (await wideP.locator('#otherstoggle').isVisible()) === false
   && (await wideP.locator('#otherrows').isVisible()), true);
await wideP.click('#startbtn'); await wideP.waitForTimeout(500);
ck('25. wide: no bottom dock', await wideP.locator('#shelldock').isVisible(), false);
ck('25. wide: the three actions render in the strip instead', await wideP.locator('#stripshock').isVisible()
   && await wideP.locator('#stripepi').isVisible() && await wideP.locator('#striprc').isVisible(), true);
ck('25. wide: with the countdown embedded in the button', /^\d+:\d\d$|^DUE NOW$/.test(await wtxt('#striprcclock')), true);
ck('25. wide: strip shock carries the configured energy', new RegExp('SHOCK ' + J[0] + ' J').test(await wtxt('#stripshocklabel')), true);
ck(`25. wide: strip EPI label carries the config dose too`, await wtxt('#stripepilabel'), `EPI ${CFG.epi.adultMg} mg`);
ck('25. wide: epi cadence rides that button as well', /^GIVE NOW$|^\d+:\d\d$|^DUE NOW$/.test(await wtxt('#stripepiclock')), true);
await wideP.click('#tlbtnwide'); await wideP.waitForTimeout(300);
ck('25. wide: the timeline is a side panel, not a sheet', await wideP.evaluate(() => {
  const r = document.getElementById('shelltl').getBoundingClientRect();
  return Math.round(r.width) === 320 && r.top === 0;
}), true);
await wideP.click('#tlclose'); await wideP.waitForTimeout(200);
await wideP.click('#resetwide'); await wideP.waitForTimeout(200);
ck('25. wide: inline reset arms with SURE?', await wtxt('#resetwide'), 'SURE?');
await wideP.click('#resetwide'); await wideP.waitForTimeout(400);
ck('25. wide: and clears to idle with the toast', (await wideP.locator('#idle').isVisible())
   && (await wideP.locator('#shelltoast').isVisible()), true);
await wideP.close();

ck('21. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('21. still no off-origin requests after the whole run', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
