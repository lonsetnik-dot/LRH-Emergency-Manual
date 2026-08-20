/* LRH Emergency Manual — the traumatic cardiac arrest screen (/tca/).
 *
 * Covers the clinical logic (weight-routed crystalloid/TXA/calcium, the
 * sequential-vs-simultaneous site setting, the reversible-cause workstreams,
 * the cessation criteria, the PHI guard) AND the case shell (SHELL.md) the
 * tool now renders through: app bar + tool switcher, case pill, weight strip,
 * tele-ED, face-up dose rows, the two-slot dock with the REASSESS cadence,
 * the shell timeline and the reset toast.
 *
 * CONFIG-DRIVEN (issue #117): every local value is read from the page's own
 * window.SITE and asserted against THAT, so a fork that correctly localizes
 * its numbers stays green. What stays hardcoded, deliberately: the clinical
 * structure a fork must not localize away — adult TXA/calcium are FIXED while
 * pediatric doses are per-kg and capped, the obstetric workstream appears only
 * when pregnancy is flagged, the PHI guard, and the shell contract itself
 * (two-tap reset, DUE NOW at zero, the timeline privacy footer).
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_tca_screen.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
  catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

/* A controllable clock skew, injected before the page script runs — the only
   way to test the REASSESS cadence hitting zero without waiting the configured
   minutes for real. Starts at 0 so everything else runs on real time. */
await pg.addInitScript(() => {
  window.__skew = 0;
  const real = Date.now.bind(Date);
  Date.now = () => real() + window.__skew;
});
const skew = async ms => { await pg.evaluate(v => { window.__skew = v; }, ms); await pg.waitForTimeout(450); };

const txt = async sel => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const vis = async sel => pg.locator(sel).isVisible();
const fresh = async () => {
  await pg.goto(BASE + '/tca/', { waitUntil: 'networkidle' });
  await pg.evaluate(() => { localStorage.clear(); window.__skew = 0; });
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
};
/* The shell's weight strip (SHELL.md layer 4) is collapsed by default on a
   phone — open it before reaching for the inputs, the same tap a clinician
   makes. */
const fillW = async v => {
  if (!(await pg.locator('#wIn').isVisible().catch(() => false))) { await pg.click('#wtoggle'); await pg.waitForTimeout(200); }
  await pg.fill('#wIn', String(v));
  await pg.waitForTimeout(250);
};
/* The old EVENT LOG accordion is now the shell timeline (layer 8): the pill
   opens it while a case runs; the ⋯ menu opens it at idle. */
const openTL = async () => {
  if (await pg.locator('#shelltl').isVisible()) return;
  if (await pg.locator('#casepill').isVisible()) await pg.click('#casepill');
  else { await pg.click('#menubtn'); await pg.waitForTimeout(150); await pg.click('#tlbtn'); }
  await pg.waitForTimeout(250);
};
const tlText = async () => { await openTL(); const t = await txt('#shelltl'); await pg.click('#tlclose'); await pg.waitForTimeout(150); return t; };
/* RESET on a phone lives behind the ⋯ menu (SHELL.md layer 9), two-tap SURE?,
   then the amber toast — dismiss it so it never intercepts the next tap. */
/* Condition-based, not sleep-based: under full-suite load the fixed sleeps
   let the SURE? confirm tap slip past the arm window, the reset never fired,
   and the next #startbtn click timed out on a still-running case. Wait for
   the armed state before confirming, and for the idle screen (the proof the
   sweep ran) before returning. */
const doReset = async () => {
  await pg.click('#menubtn');
  await pg.click('#resetbtn');
  await pg.waitForFunction(() => /SURE/.test(document.querySelector('#resetbtn').textContent), null, { timeout: 5000 });
  await pg.click('#resetbtn');
  await pg.waitForSelector('#startbtn', { state: 'visible', timeout: 10000 });
  if (await pg.locator('#shelltoast').isVisible().catch(() => false)) { await pg.click('#toastok'); await pg.waitForTimeout(150); }
};
const circText = () => pg.evaluate(() => {
  const c = [...document.querySelectorAll('#worksteps .wcard')].find(e => /CIRCULATION/.test(e.textContent));
  return c ? c.textContent : '';
});
const doseRowsText = () => pg.evaluate(() => [...document.querySelectorAll('#doserows .shelldose')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));

/* ---- CONFIG-DRIVEN EXPECTATIONS (issue #117) ---- */
const CFG = await (async () => {
  await pg.goto(BASE + '/tca/', { waitUntil: 'networkidle' });
  const c = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
  if (!c) { console.error('FATAL: /tca/ does not expose window.SITE — cannot verify against config'); process.exit(1); }
  return c;
})();
/* Derived from the configured threshold so the cases stay on the intended side
   of it whatever a fork sets it to. */
const PEDS_KG = Math.min(20, CFG.trigger.maxKg - 10);
const NEAR_PEDS_KG = CFG.trigger.maxKg - 1;
const ADULT_KG = CFG.trigger.maxKg + 30;
const perKg = (n, kg, cap) => Math.round(cap ? Math.min(n * kg, cap) : n * kg);

/* ---- 1. idle shell: bar, switcher, no pill, no bedside mode toggle ---- */
await fresh();
ck('1. loads with no page errors', errs.length, 0);
ck('1. starts idle, READY in the bar, no case pill', (await vis('#idle')) && (await vis('#statusword')) && !(await vis('#casepill')), true);
ck('1. active screen hidden at idle', await vis('#active'), false);
ck('1. protocol label set', /TRAUMATIC CARDIAC ARREST/.test(await txt('#plabel')), true);
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');
ck('1. no bedside team-mode toggle (SITE.mode is a localization setting)',
   await pg.evaluate(() => !document.getElementById('modeSeq') && !document.getElementById('modeSim')), true);
await pg.click('#toolbtn'); await pg.waitForTimeout(200);
ck('1. the tool name opens the switcher', await vis('#toolmenu'), true);
const switcher = await txt('#toolmenu');
ck('1. it lists the six live engines + manual home',
   ['Arrest', 'TCA', 'Airway', 'Neonatal', 'PPH', 'Dystocia', 'Manual home'].every(n => switcher.includes(n)), true);
ck('1. TCA is marked as the current tool', await pg.evaluate(() => {
  const on = document.querySelector('#toolmenu .shellmenurow.on');
  return !!on && /TCA/.test(on.textContent);
}), true);
ck('1. the current-tool square carries TCA\'s own accent (orange)', await pg.evaluate(() => {
  const sq = document.querySelector('#toolmenu .shellmenurow.on .shellsq');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return sq.getAttribute('style').includes('var(--accent)') && accent !== '';
}), true);
await pg.click('#toolbtn'); await pg.waitForTimeout(150);
ck('1. dock and strip absent at idle', !(await vis('#shelldock')) && !(await vis('#shellstrip')), true);

/* Print: every shell layer is screen-only (SHELL.md). */
await pg.emulateMedia({ media: 'print' });
ck('1. print hides the shell chrome', await pg.evaluate(() =>
  ['shellbar', 'shelldock', 'wtoggle', 'telebtn'].every(id => {
    const el = document.getElementById(id);
    return !el || getComputedStyle(el).display === 'none';
  })), true);
await pg.emulateMedia({ media: 'screen' });

/* ---- 2. dosing — face up (layer 5.3): weight-routed, config-driven ---- */
let rows = await doseRowsText();
ck('2. three face-up dose rows at idle', rows.length, 3);
ck('2. adult no-weight crystalloid refuses to invent a number ("set weight")',
   /set weight/.test(rows[0]), true);
ck(`2. crystalloid rule reads SITE.fluid (${CFG.fluid.crystalloidMlPerKg} mL/kg)`,
   rows[0].includes(CFG.fluid.crystalloidMlPerKg + ' mL/kg'), true);
ck('2. adult TXA is the configured FIXED dose (SITE.txa.adult)', rows[1].includes(CFG.txa.adult), true);
ck(`2. adult calcium is the configured fixed ${CFG.cal.adultChlorideG} g CaCl2`,
   rows[2].includes(CFG.cal.adultChlorideG + ' g calcium chloride'), true);

await fillW(PEDS_KG);
rows = await doseRowsText();
{
  const ml = perKg(CFG.fluid.crystalloidMlPerKg, PEDS_KG, 1000);
  const txa = perKg(CFG.txa.pedsMgPerKg, PEDS_KG, CFG.txa.pedsMaxMg);
  const cacl = perKg(CFG.cal.pedsChlorideMgPerKg, PEDS_KG, CFG.cal.pedsChlorideMaxMg);
  const glu = perKg(CFG.cal.pedsGluconateMgPerKg, PEDS_KG, CFG.cal.pedsGluconateMaxMg);
  ck(`2. peds ${PEDS_KG}kg crystalloid row = ${ml} mL`, rows[0].includes(ml + ' mL'), true);
  ck(`2. peds ${PEDS_KG}kg TXA row = ${txa} mg (${CFG.txa.pedsMgPerKg} mg/kg)`, rows[1].includes(txa + ' mg'), true);
  ck(`2. peds ${PEDS_KG}kg calcium row = CaCl2 ${cacl} mg + gluconate ${glu} mg`,
     rows[2].includes('CaCl₂ ' + cacl + ' mg') && rows[2].includes('Ca gluconate ' + glu + ' mg'), true);
  ck('2. weight strip label shows the set weight in green', await pg.evaluate(k => {
    const w = document.getElementById('wlabel');
    return w.textContent.includes(k + ' kg') && w.className.includes('set');
  }, PEDS_KG), true);
  ck(`2. wnote flags pediatric at ${PEDS_KG}kg`, /pediatric/.test(await txt('#wnote')), true);
}
/* Structural invariant: just under the threshold still doses as peds; above
   it, TXA and calcium stop scaling with weight. */
await fillW(NEAR_PEDS_KG);
rows = await doseRowsText();
ck(`2. ${NEAR_PEDS_KG}kg (just under SITE.trigger.maxKg) still doses TXA per-kg`,
   rows[1].includes(perKg(CFG.txa.pedsMgPerKg, NEAR_PEDS_KG, CFG.txa.pedsMaxMg) + ' mg'), true);
await fillW(ADULT_KG);
rows = await doseRowsText();
ck(`2. adult ${ADULT_KG}kg crystalloid computes (${perKg(CFG.fluid.crystalloidMlPerKg, ADULT_KG, 2000)} mL, capped)`,
   rows[0].includes(perKg(CFG.fluid.crystalloidMlPerKg, ADULT_KG, 2000) + ' mL'), true);
ck(`2. adult ${ADULT_KG}kg TXA stays the fixed dose, not weight-scaled`, rows[1].includes(CFG.txa.adult), true);
ck(`2. adult ${ADULT_KG}kg calcium stays fixed, not weight-scaled`,
   rows[2].includes(CFG.cal.adultChlorideG + ' g calcium chloride'), true);

/* ---- 3. tele-ED (layer 5.2): idempotent, logs, seeds the case ---- */
await fresh();
ck('3. tele-ED is face up before the case starts', await vis('#telebtn'), true);
await pg.click('#telebtn'); await pg.waitForTimeout(200);
ck('3. one tap collapses it to a confirmation row', (await vis('#teledone')) && !(await vis('#telebtn')), true);
await pg.click('#teledone').catch(() => {}); await pg.waitForTimeout(150);
ck('3. a second tap logs nothing twice', (await tlText()).split('Tele-ED activated').length - 1, 1);
await pg.click('#startbtn'); await pg.waitForTimeout(400);
ck('3. a pre-case tele activation seeds the case log', /Tele-ED already on the line/.test(await tlText()), true);

/* ---- 3b. DECIDE FIRST — the stop gate (2026-08-20) ----
   Traumatic cardiac arrest is the one arrest where the first decision is
   whether to resuscitate at all. Asserted against SITE.stop rather than
   against four hardcoded sentences, so a centre that deletes the "no surgical
   support" criterion — the localization this exists to allow — keeps a green
   run. What is written out is the INVARIANT a fork must not be able to
   localize away: any single criterion blocks the start. */
await fresh();
{
  const cfg = await pg.evaluate(() => ({ n: SITE.stop.length, win: SITE.stopWindowMin, first: SITE.stop[0] }));
  ck('3b. the gate renders one row per configured stop criterion',
     await pg.locator('[data-stop]').count(), cfg.n);
  /* The window is a localized number in a templated string; the screen must
     show the value, never the raw {window} token. */
  const firstTxt = await pg.locator('[data-stop]').first().textContent();
  ck('3b. the arrest window is substituted from config, not printed raw',
     firstTxt.includes(String(cfg.win)) && !/\{window\}/.test(firstTxt), true);
  ck('3b. START is offered while nothing is checked', await vis('#startbtn'), true);
  ck('3b. no DECLARE button while nothing is checked', await vis('#declarebtn'), false);

  /* Every criterion independently, because "any one stops it" is the claim.
     A gate that only honoured the first would pass a spot check. */
  for (let i = 0; i < cfg.n; i++) {
    await pg.click(`[data-stop="${i}"]`); await pg.waitForTimeout(120);
    ck(`3b. criterion ${i} alone removes START`, await vis('#startbtn'), false);
    ck(`3b. criterion ${i} alone offers DECLARE instead`, await vis('#declarebtn'), true);
    await pg.click(`[data-stop="${i}"]`); await pg.waitForTimeout(120);
  }
  ck('3b. clearing every criterion restores START', await vis('#startbtn'), true);

  /* The gate must not be able to start a case it has just refused. Asserted as
     "the control is gone", not "a warning appeared": a caution beside a live
     red button is not a gate in a room where someone has already reached for
     the chest. */
  await pg.click('[data-stop="0"]'); await pg.waitForTimeout(150);
  ck('3b. no case can be started while a stop criterion stands',
     await pg.evaluate(() => document.querySelector('#casepill') && getComputedStyle(document.querySelector('#casepill')).display !== 'none'), false);

  /* And the decision resets with the case — a criterion left checked from the
     last patient would hide START on a patient nobody has assessed. */
  await doReset();
  ck('3b. RESET clears the gate for the next patient', await vis('#startbtn'), true);
  ck('3b. RESET clears the checked criteria too',
     await pg.evaluate(() => [...document.querySelectorAll('[data-stop]')].every(b => b.getAttribute('aria-pressed') === 'false')), true);
}

/* ---- 3c. SAY IT OUT LOUD (2026-08-20) ----
   The start button already declares the arrest. What it cannot carry is the
   second sentence — what we are NOT doing. Running the practised ACLS
   algorithm is the commonest failure in a traumatic arrest, and it is
   prevented by somebody saying so once, out loud, at the start. Asserted from
   SITE.declare so a department can put the sentence in its own voice. */
await fresh();
await pg.click('#startbtn'); await pg.waitForTimeout(400);
{
  const cfg = await pg.evaluate(() => ({ call: SITE.declare.call, script: SITE.declare.script }));
  ck('3c. the declaration card is up as the case opens', await vis('#saybox'), true);
  ck('3c. it speaks the configured call, not a hardcoded one',
     (await pg.textContent('#saycall')).includes(cfg.call), true);
  /* The invariant, written out rather than read from config: whatever a site
     puts in the script, it has to say that this is NOT normal ACLS. That is
     the entire reason the card exists, and a fork must not localize it away
     into a pleasantry. */
  ck('3c. the script says out loud that this is not normal ACLS',
     /not\s+doing\s+normal\s+ACLS/i.test(cfg.script), true);
  ck('3c. and the script is on screen, not just in config',
     (await pg.textContent('#sayscript')).includes(cfg.script), true);
  await pg.click('#saidbtn'); await pg.waitForTimeout(300);
  ck('3c. tapping it stands the card down', await vis('#saybox'), false);
  ck('3c. and puts the moment on the timeline', /Declared traumatic cardiac arrest/i.test(await tlText()), true);
}

/* ---- 4. declare: pill, dock, ticker, workstreams ---- */
await fresh();
await pg.click('#startbtn'); await pg.waitForTimeout(400);
ck('4. active screen visible after declare', await vis('#active'), true);
ck('4. the pill owns the bar center while running', await vis('#casepill'), true);
ck('4. mono digits + the TCA tag', /^\d+:\d\d$/.test(await txt('#pillclock')) && await txt('#pilltag') === 'TCA', true);
ck('4. tapping the pill opens the timeline', await (async () => {
  await pg.click('#casepill'); await pg.waitForTimeout(250);
  const open = await vis('#shelltl');
  return open;
})(), true);
ck('4. the timeline footer states the privacy contract',
   /device only · no identifiers · cleared on reset/.test(await txt('#shelltl')), true);
ck('4. the declaration is on the timeline', /TRAUMATIC CARDIAC ARREST declared/.test(await txt('#tlrows')), true);
await pg.click('#tlclose'); await pg.waitForTimeout(150);
ck('4. the dock appears with the case (phone)', await vis('#shelldock'), true);
ck('4. dock slots carry the semantic schemes (amber intervention / blue log)', await pg.evaluate(() =>
  document.getElementById('dockaddr').classList.contains('scheme-amber') &&
  document.getElementById('docklog').classList.contains('scheme-blue')), true);
ck('4. dock buttons hold the 54px floor', await pg.evaluate(() =>
  ['dockaddr', 'docklog'].every(id => document.getElementById(id).getBoundingClientRect().height >= 54)), true);
ck('4. the dock never covers the last content', await pg.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingBottom) >= 120), true);
ck('4. the ticker rides on the dock with the newest event', /LOG/.test(await txt('#ticker')), true);
ck('4. no REASSESS strip before the causes are addressed (phone)', await vis('#shellstrip'), false);

let names = await pg.$$eval('#worksteps .wcard', els => els.map(e => e.textContent));
ck('4. five workstreams when not pregnant (obstetric hidden)', names.length, 5);
ck('4. order: hemorrhage, airway, breathing, circulation, cardiac',
   /HEMORRHAGE/.test(names[0]) && /AIRWAY/.test(names[1]) && /BREATHING/.test(names[2]) &&
   /CIRCULATION/.test(names[3]) && /CARDIAC/.test(names[4]), true);
ck('4. OBSTETRIC hidden when not pregnant', names.join('').includes('OBSTETRIC'), false);
ck('4. hemorrhage card holds only mechanical control (no MTP/TXA)',
   !/massive transfusion|tranexamic/i.test(names[0]), true);
ck('4. circulation carries crystalloid + TXA + calcium inline',
   /Crystalloid[\s\S]*Tranexamic[\s\S]*Calcium/i.test(names[3]), true);
ck('4. airway names i-gel, not LMA', names[1].includes('i-gel') && !names[1].includes('LMA'), true);
ck('4. breathing says no chest tube now', /no chest tube now/i.test(names[2]), true);
const links = await pg.$$eval('#worksteps a.wlink', as => as.map(a => ({ t: a.textContent.trim(), h: a.getAttribute('href') })));
const hasLink = (t, h) => links.some(l => l.t.includes(t) && l.h.includes(h));
ck('4. AVA 3Xi access link present', hasLink('AVA 3Xi', 'procedures/?from=home#c14'), true);
ck('4. MTP link present', hasLink('Massive transfusion', 'codes/?from=home#c12'), true);
ck('4. thoracotomy link present', hasLink('Resuscitative thoracotomy', 'procedures/?from=home#c02'), true);
ck('4. tourniquet link present', hasLink('Tourniquet', 'procedures/?from=home#c10'), true);
ck('4. sequential mode shows priority numbers', await pg.$eval('#worksteps', e => /1|2|3/.test(e.textContent)), true);
ck('4. sequential worktitle mentions priority order', /ORDER/.test(await txt('#worktitle')), true);
ck('4. plabel reflects the configured sequential mode', /SEQUENTIAL/.test(await txt('#plabel')), true);
ck('4. CPR-in-progress pause note present', /pause/i.test(await txt('#cprnote')), true);

/* the inline circulation numbers still route by weight (same math as the rows) */
await fillW(PEDS_KG);
{
  const circ = await circText();
  const txa = perKg(CFG.txa.pedsMgPerKg, PEDS_KG, CFG.txa.pedsMaxMg);
  ck(`4. circulation inline TXA at ${PEDS_KG}kg = ${txa} mg`, circ.includes(txa + ' mg'), true);
}

/* checking a task logs it to the shell timeline */
await pg.click('#worksteps .wrow'); await pg.waitForTimeout(200);
ck('4. checking a task logs it', /Compress external bleeding/.test(await tlText()), true);
ck('4. checked box shows the tick', await pg.$eval('#worksteps .wrow .wbox', e => e.textContent), '✓');
ck('4. and the ticker shows it as the newest event', /Compress external bleeding/.test(await txt('#tickertext')), true);

/* ---- 5. the REASSESS cadence (layers 2/6): timer and action one target ---- */
await pg.click('#dockaddr'); await pg.waitForTimeout(300);
ck('5. the amber dock slot IS the MARK ADDRESSED action', await vis('#convstrip'), true);
ck('5. addressed is on the timeline', /Reversible causes addressed/.test(await txt('#tickertext')), true);
ck('5. the in-card MARK ADDRESSED button retires', await vis('#addressedbtn'), false);
ck('5. the REASSESS chip appears in the strip (phone)', (await vis('#shellstrip')) && (await vis('#chipreassess')), true);
{
  const full = CFG.conventionalResusMin * 60;
  const [m, s] = (await txt('#chipreassessclock')).split(':').map(Number);
  ck(`5. it counts down from SITE.conventionalResusMin (${CFG.conventionalResusMin} min)`,
     (m * 60 + s) > full - 8 && (m * 60 + s) <= full, true);
  const [cm, cs] = (await txt('#convclock')).split(':').map(Number);
  ck('5. the in-card conventional clock agrees', (cm * 60 + cs) > full - 8 && (cm * 60 + cs) <= full, true);
  ck('5. the dock slot now carries the same countdown', /^\d+:\d\d$/.test(await txt('#dockaddrclock')), true);
}
await skew((CFG.conventionalResusMin * 60 + 5) * 1000);
ck('5. the chip escalates to DUE NOW at zero', await txt('#chipreassessclock'), 'DUE NOW');
ck('5. and turns red (the .due state)', await pg.evaluate(() => document.getElementById('chipreassess').classList.contains('due')), true);
ck('5. the dock clock reads DUE NOW too', await txt('#dockaddrclock'), 'DUE NOW');
await skew(0);

/* ---- 6. ROSC and cessation ---- */
await pg.click('#roscbtn'); await pg.waitForTimeout(250);
ck('6. ROSC screen visible', await vis('#rosc'), true);
ck('6. the pill tag reads ROSC', await txt('#pilltag'), 'ROSC');
ck('6. ROSC targets read the config (SITE.bp)', await pg.evaluate(bp => {
  const t = document.getElementById('rosc').textContent;
  return t.includes('SBP ' + bp.sbp) && t.includes('SBP ' + bp.tbiSbp);
}, CFG.bp), true);
await pg.click('#rearrestbtn'); await pg.waitForTimeout(250);
ck('6. re-arrest returns to active with the TCA tag', (await vis('#active')) && (await txt('#pilltag')) === 'TCA', true);
await pg.click('#ceasebtn'); await pg.waitForTimeout(200);
ck('6. cessation criteria card shows (both-true gate)', await vis('#ceasecard'), true);

/* The list of what counts as a sign of life, at the moment somebody has to
   answer it. It used to be left to recall, and this is the worst moment of a
   case to be recalling a list. From SITE.signsOfLife, so a site can add one —
   but the INVARIANT is that cardiac motion is on it, because that is the
   finding the eFAST above is looking for and the one the cessation decision
   turns on. */
{
  const sol = await pg.evaluate(() => SITE.signsOfLife);
  const shown = await pg.textContent('#solist');
  ck('6. every configured sign of life is printed at the decision',
     sol.every(x => shown.includes(x)), true);
  ck('6. cardiac motion is among them', sol.some(x => /cardiac motion/i.test(x)), true);
  ck('6. and they are framed as ANY one, not all',
     /ANY ONE OF THESE/i.test(await pg.textContent('#ceasecard')), true);
}await pg.click('#ceaseconfirm'); await pg.waitForTimeout(250);
ck('6. ceased screen visible', await vis('#ceased'), true);
ck('6. the pill tag reads CEASED', await txt('#pilltag'), 'CEASED');
ck('6. the time of death is on the timeline', /Resuscitation ceased/.test(await tlText()), true);

/* ---- 7. pregnancy reveals the obstetric workstream ---- */
await doReset();
ck('7. reset returns to idle', await vis('#idle'), true);
await pg.click('#pregidle'); await pg.waitForTimeout(150);
await pg.click('#startbtn'); await pg.waitForTimeout(300);
names = await pg.$$eval('#worksteps .wcard', els => els.map(e => e.textContent));
ck('7. six workstreams when pregnant', names.length, 6);
ck('7. OBSTETRIC shown when pregnant', names.join('').includes('OBSTETRIC'), true);
ck('7. hysterotomy aims at the configured minutes (SITE.hysterotomyByMin)',
   names.join('').includes('aim < ' + CFG.hysterotomyByMin + ' min'), true);
ck('7. resuscitative hysterotomy link present',
   await pg.$$eval('#worksteps a.wlink', as => as.some(a => a.getAttribute('href').includes('ob-neonatal/?from=home#c10'))), true);

/* ---- 8. simultaneous rendering via a config-swapped copy ---- */
{
  const fs = await import('fs');
  const distFile = join(__dirname, 'dist', 'tca', 'index.html');
  const src = fs.readFileSync(distFile, 'utf8');
  const swapped = src.replace('mode: "sequential"', 'mode: "simultaneous"');
  ck('8. SITE.mode config swap point present', swapped !== src, true);
  const tmp = join(__dirname, 'dist', 'tca', '_verify_simultaneous.html');
  fs.writeFileSync(tmp, swapped);
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p2.goto(BASE + '/tca/_verify_simultaneous.html');
  await p2.waitForTimeout(250);
  await p2.click('#startbtn'); await p2.waitForTimeout(250);
  ck('8. simultaneous config: worktitle mentions parallel', /PARALLEL/.test(await p2.$eval('#worktitle', e => e.textContent)), true);
  ck('8. simultaneous config: plabel reflects it', /SIMULTANEOUS/.test(await p2.$eval('#plabel', e => e.textContent)), true);
  ck('8. simultaneous config: CPR note says concurrent', /concurrent/.test(await p2.$eval('#cprnote', e => e.textContent.toLowerCase())), true);
  await p2.close();
  fs.unlinkSync(tmp);
}

/* ---- 9. PHI guard on the free-text log ---- */
await doReset();
await pg.click('#startbtn'); await pg.waitForTimeout(300);
await pg.click('#docklog'); await pg.waitForTimeout(250);
ck('9. the blue dock slot opens the composer', await vis('#customrow'), true);
await pg.fill('#customin', 'MRN 12345678 john doe');
await pg.click('#customlog'); await pg.waitForTimeout(200);
ck('9. PHI-like text is refused with a warning', await vis('#customwarn'), true);
await pg.fill('#customin', 'IO placed right humeral head');
await pg.click('#customlog'); await pg.waitForTimeout(200);
ck('9. clean text accepted', !(await vis('#customwarn')) || (await txt('#customwarn')) === '', true);
ck('9. and lands on the timeline', /IO placed right humeral head/.test(await tlText()), true);

/* ---- 10. reset: the lrh- sweep + the cleared toast ---- */
await fillW('44');
await pg.click('#menubtn'); await pg.waitForTimeout(200);
await pg.click('#resetbtn');
await pg.waitForFunction(() => /SURE/.test(document.querySelector('#resetbtn').textContent), null, { timeout: 5000 });
ck('10. reset arms with SURE?', /SURE\?/.test(await txt('#resetbtn')), true);
await pg.click('#resetbtn');
await pg.waitForSelector('#idle', { state: 'visible', timeout: 10000 });
ck('10. reset returns to idle', await vis('#idle'), true);
ck('10. the amber cleared toast is up', await vis('#shelltoast'), true);
ck('10. reset sweeps lrh-case-* (heartbeat aside)', await pg.evaluate(() => {
  const left = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
    if (k.indexOf('lrh-case-') === 0 && k !== 'lrh-case-lastactive') left.push(k); }
  return left.join(',') || 'none';
}), 'none');
ck('10. the weight is cleared', await pg.evaluate(() => document.getElementById('wIn').value), '');
await pg.click('#toastok'); await pg.waitForTimeout(150);
ck('10. OK dismisses the toast', await vis('#shelltoast'), false);
ck('10. the log is empty for the next case', /Nothing logged yet/.test(await tlText()), true);

/* ---- 11. ≥768px: strip instead of dock, weight open, inline reset ---- */
const wideP = await b.newPage({ viewport: { width: 820, height: 1100 } });
wideP.on('pageerror', e => errs.push('wide: ' + e));
const wtxt = async sel => (await wideP.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
await wideP.goto(BASE + '/tca/', { waitUntil: 'networkidle' });
await wideP.evaluate(() => localStorage.clear());
await wideP.reload({ waitUntil: 'networkidle' }); await wideP.waitForTimeout(300);
ck('11. wide: the weight form is open until a weight is set', await wideP.locator('#wform').isVisible(), true);
ck('11. wide: MANUAL breadcrumb replaces the bare chevron', await wideP.locator('#backlinkwide').isVisible(), true);
ck('11. wide: TIMELINE / FEEDBACK / RESET sit inline', await wideP.locator('#tlbtnwide').isVisible()
   && await wideP.locator('#feedbacklink').isVisible() && await wideP.locator('#resetwide').isVisible(), true);
ck('11. wide: no ⋯ menu button', await wideP.locator('#menubtn').isVisible(), false);
await wideP.fill('#wIn', '70'); await wideP.waitForTimeout(250);
await wideP.click('#wdone'); await wideP.waitForTimeout(250);
ck('11. wide: DONE collapses to a slim confirmed row', await wideP.locator('#wform').isVisible(), false);
ck('11. wide: which offers tap-to-change', /tap to change/.test(await wtxt('#wtoggle')), true);
await wideP.click('#startbtn'); await wideP.waitForTimeout(400);
ck('11. wide: no bottom dock', await wideP.locator('#shelldock').isVisible(), false);
ck('11. wide: the two actions render in the strip instead',
   (await wideP.locator('#stripaddr').isVisible()) && (await wideP.locator('#striplog').isVisible()), true);
await wideP.click('#stripaddr'); await wideP.waitForTimeout(300);
ck('11. wide: the strip slot runs MARK ADDRESSED', await wideP.locator('#convstrip').isVisible(), true);
ck('11. wide: with the countdown embedded in the button', /^\d+:\d\d$|^DUE NOW$/.test(await wtxt('#stripaddrclock')), true);
await wideP.click('#tlbtnwide'); await wideP.waitForTimeout(300);
ck('11. wide: the timeline is a side panel, not a sheet', await wideP.evaluate(() => {
  const r = document.getElementById('shelltl').getBoundingClientRect();
  return Math.round(r.width) === 320 && r.top === 0;
}), true);
await wideP.click('#tlclose'); await wideP.waitForTimeout(200);
await wideP.click('#resetwide');
await wideP.waitForFunction(() => /SURE/.test(document.querySelector('#resetwide').textContent), null, { timeout: 5000 });
ck('11. wide: inline reset arms with SURE?', await wtxt('#resetwide'), 'SURE?');
await wideP.click('#resetwide');
await wideP.waitForSelector('#idle', { state: 'visible', timeout: 10000 });
ck('11. wide: and clears to idle with the toast', (await wideP.locator('#idle').isVisible())
   && (await wideP.locator('#shelltoast').isVisible()), true);
await wideP.close();

ck('12. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 8).forEach(e => console.log('    ' + e));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
