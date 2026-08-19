/* LRH Emergency Manual — card 06's tap-to-log drug lanes (/codes/#c06).
 *
 * The lanes replace a pair of generic "PUSHED — START CLOCK" buttons with a drug menu: one tap
 * stamps the time, computes the dose from the shared case weight, and writes drug + dose to the
 * case timeline. That makes three things checkable that a human clicking through cannot reliably
 * check, and they are what this suite is for:
 *
 *   1. The dose on the button and the dose in the permanent record are the same string. They are
 *      produced by different code paths (the shared .wdose engine paints the button; the lane
 *      controller reads the painted text back), and a drift between them would be invisible on
 *      screen and wrong forever in the chart.
 *   2. A tap with NO weight entered still logs the drug and the time, and never a guessed dose.
 *   3. The awake-paralysis check fires on an ABSENCE — a paralytic logged with nothing given for
 *      pain or sedation. Nothing on the screen goes wrong in that state, so nothing prompts unless
 *      something is actively looking for the hole.
 *
 *     python3 -m http.server 8123 --directory dist
 *     node verify_rsi_drugs.mjs
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

/* ?from= dismisses the beta splash, the same way an arrival from the landing page or a
   cross-tool link does — without it the splash sits over the whole card. */
const CARD = '/codes/?from=home#c06';
/* reload(), not a second goto(): navigating to a URL that differs only by its #hash is a
   same-document navigation, so the modules keep their in-memory state and a "fresh" page is
   not fresh at all. That silently invalidated an earlier draft of this suite. */
const reload = async () => { await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(350); };
const fresh = async () => {
  await pg.goto(BASE + CARD, { waitUntil: 'networkidle' });
  /* Blank the weight field before wiping storage: the weight engine holds the kg in memory
     and re-saves it, so clearing storage alone leaves the previous case's weight to
     reappear on the next load and quietly invalidate a no-weight test. */
  await pg.evaluate(() => {
    const el = document.getElementById('wtkg');
    if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await pg.waitForTimeout(120);
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await reload();
};
/* The weight form is the shared case-shell ribbon (SHELL.md layer 4) — collapsed
   on a phone until tapped, so filling #wtkg blind would time out on a hidden
   input. Open it the way a clinician does, then fill. */
const openWeightForm = async () => {
  if (!(await pg.locator('#wtkg').isVisible().catch(() => false))) {
    await pg.click('#wtoggle').catch(() => {});
    await pg.waitForTimeout(200);
  }
};
const setWeight = async kg => {
  await openWeightForm();
  await pg.fill('#wtkg', String(kg));
  await pg.dispatchEvent('#wtkg', 'input');
  await pg.waitForTimeout(250);
};
/* Tap a lane's drug by its config label — the same string the config, the button and the
   timeline entry all use, so the test never has to know a DOM index. */
const tapDrug = async (laneId, label) => {
  await pg.click(`#${laneId} button[data-drug="${label}"]`);
  await pg.waitForTimeout(200);
};
const doseOnButton = (laneId, label) => pg.evaluate(([l, d]) => {
  const el = document.querySelector(`#${l} button[data-drug="${d}"] .wdose`);
  return el ? el.textContent.trim() : '(no dose span)';
}, [laneId, label]);
/* The shared case log IS the record — read it the way the summary modal does, not by
   scraping the on-screen lane. */
const caseLog = () => pg.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('lrh-case-log') || '[]') || []).map(e => e.label); }
  catch (e) { return []; }
});
const laneCue = laneId => pg.locator('#' + laneId).innerText();

/* ---- CONFIG-DRIVEN EXPECTATIONS (issue #117) -------------------------------
   Read codes' own SITE.rsiDrugs block and assert the screen against THAT, never against a
   second hand-typed copy of LRH's menu. An adopting ED whose pharmacy stocks a different
   induction agent, doses rocuronium differently, or rounds to 5 mg instead of 10 is editing
   exactly the block it is meant to edit; a suite full of LRH's own drug names would turn red
   for that site and teach it that a red run is normal.

   What stays written out below, deliberately — the things a fork must NOT be able to
   localize away:
     · every lane ends in an "other" entry (the menu is a shortcut, never the list of drugs a
       clinician is allowed to give)
     · every dosed entry declares a max (a display ceiling for extreme weights)
     · a per-kg dose is capped at that max and never exceeds it
     · analgesia is offered before sedation (PADIS analgesia-first)
     · a tap with no weight logs the drug and the time but never a guessed dose
     · the awake-paralysis check fires on paralytic-with-nothing-after
     · the record and the button agree
     · the PHI rule: nothing in a lane's storage or its log entries is an identifier   */
const CFG = await (async () => {
  await fresh();
  const c = await pg.evaluate(() => (window.SITE && window.SITE.rsiDrugs) ? window.SITE.rsiDrugs : null);
  if (!c) { console.error('FATAL: /codes/ does not expose window.SITE.rsiDrugs — cannot verify against config'); process.exit(1); }
  return c;
})();
const LANES = [
  { key: 'induction',     id: 'rsiinductpick',    storeT: 'lrh-codes-rsiinduct',     storeD: 'lrh-codes-rsiinductdrug' },
  { key: 'paralytic',     id: 'rsiparalyticpick', storeT: 'lrh-codes-rsiparalytic',  storeD: 'lrh-codes-rsiparalyticdrug' },
  { key: 'postAnalgesia', id: 'c06analgesiapick', storeT: 'lrh-codes-c06analgesia',  storeD: 'lrh-codes-c06analgesiadrug' },
  { key: 'postSedation',  id: 'c06sedationpick',  storeT: 'lrh-codes-c06sedation',   storeD: 'lrh-codes-c06sedationdrug' }
];
const dosed = lane => CFG[lane].drugs.filter(d => !d.other);
/* Derive test weights from config rather than picking round numbers, so a fork that changes a
   max keeps a case on the intended side of it. Below every max, and above every max. */
const UNDER_KG = 70;
const OVER_KG = Math.max(...LANES.flatMap(l => dosed(l.key).map(d => d.max / d.perKg))) + 10;

/* ---- 1. the menus render from config, in config order ---- */
await fresh();
for (const lane of LANES) {
  const labels = await pg.evaluate(id => [...document.querySelectorAll(`#${id} button[data-drug]`)]
    .map(el => el.getAttribute('data-drug')), lane.id);
  ck(`1. ${lane.key} renders every configured drug, in order`,
     labels.join(' | '), CFG[lane.key].drugs.map(d => d.label).join(' | '));
}
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');

/* ---- 2. invariants the config must not be able to localize away ---- */
for (const lane of LANES) {
  const drugs = CFG[lane.key].drugs;
  ck(`2. ${lane.key} keeps an "other" entry, and it is last`,
     !!(drugs.length && drugs[drugs.length - 1].other), true);
  ck(`2. ${lane.key} has exactly one "other" entry`, drugs.filter(d => d.other).length, 1);
  ck(`2. ${lane.key} offers at least one dosed drug`, dosed(lane.key).length > 0, true);
  ck(`2. ${lane.key} — every dosed drug declares a max`,
     dosed(lane.key).every(d => typeof d.max === 'number' && d.max > 0), true);
  ck(`2. ${lane.key} — every dosed drug declares a rounding increment`,
     dosed(lane.key).every(d => typeof d.round === 'number' && d.round > 0), true);
  const otherLabel = drugs[drugs.length - 1].label;
  ck(`2. ${lane.key} — the "other" entry carries no dose (it stamps the time only)`,
     await pg.evaluate(([i, l]) => !document.querySelector(`#${i} button[data-drug="${l}"] .wdose`),
       [lane.id, otherLabel]), true);
  ck(`2. ${lane.key} — every dosed entry does carry a dose span`,
     await pg.evaluate(([i, labels]) => labels.every(l =>
       !!document.querySelector(`#${i} button[data-drug="${l}"] .wdose`)),
       [lane.id, dosed(lane.key).map(d => d.label)]), true);
}
/* PADIS is analgesia-first: the opioid lane must sit above the sedative lane on the page. A
   fork may swap the drugs in either; it must not swap the order of the two lanes. */
ck('2. analgesia is offered above sedation on the page', await pg.evaluate(() => {
  const a = document.getElementById('c06analgesiapick'), s = document.getElementById('c06sedationpick');
  return !!(a && s) && (a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}), true);
/* The "other" escape hatch exists so the menu is never read as the permitted list. */
ck('2. an "other" entry is present in all four lanes',
   LANES.every(l => CFG[l.key].drugs.some(d => d.other)), true);

/* ---- 3. doses are computed from the shared weight, capped, and rounded ---- */
await fresh();
await setWeight(UNDER_KG);
for (const lane of LANES) {
  for (const d of dosed(lane.key)) {
    const shown = await doseOnButton(lane.id, d.label);
    const raw = d.perKg * UNDER_KG;
    const want = (Math.round(Math.min(raw, d.max) / d.round) * d.round).toFixed(d.decimals) + ' ' + d.unit;
    ck(`3. ${lane.key}/${d.label} at ${UNDER_KG} kg is ${d.perKg} ${d.unit}/kg rounded to ${d.round}`, shown, want);
  }
}
await setWeight(OVER_KG);
for (const lane of LANES) {
  for (const d of dosed(lane.key)) {
    const shown = await doseOnButton(lane.id, d.label);
    ck(`3. ${lane.key}/${d.label} at ${OVER_KG} kg is capped at its max`,
       shown, d.max.toFixed(d.decimals) + ' ' + d.unit);
    /* The invariant behind the cap, stated independently of the arithmetic above: no
       displayed dose may ever exceed the configured ceiling, whatever the weight. */
    ck(`3. ${lane.key}/${d.label} never displays above ${d.max} ${d.unit}`,
       parseFloat(shown) <= d.max, true);
  }
}

/* ---- 4. one tap = one timeline entry that matches the button ---- */
await fresh();
await setWeight(UNDER_KG);
for (const lane of LANES) {
  const d = dosed(lane.key)[0];
  const shown = await doseOnButton(lane.id, d.label);
  await tapDrug(lane.id, d.label);
  const log = await caseLog();
  const want = `${CFG[lane.key].logPrefix} — ${d.label} ${shown}`;
  ck(`4. ${lane.key} logs the drug and the dose exactly as the button showed it`,
     log.includes(want), true);
  if (!log.includes(want)) console.log('    log was: ' + JSON.stringify(log));
  ck(`4. ${lane.key} stamped its clock on the tap`,
     await pg.evaluate(k => !!localStorage.getItem(k), lane.storeT), true);
  ck(`4. ${lane.key} marks the tapped drug`,
     await pg.evaluate(([i, l]) => document.querySelector(`#${i} button[data-drug="${l}"]`).classList.contains('picked'),
       [lane.id, d.label]), true);
}
/* Two drugs in one lane: both recorded, one clock, measured from the first. */
await fresh();
await setWeight(UNDER_KG);
const induct = dosed('induction');
if (induct.length > 1) {
  await tapDrug('rsiinductpick', induct[0].label);
  const firstT = await pg.evaluate(() => +localStorage.getItem('lrh-codes-rsiinduct'));
  await pg.waitForTimeout(1100);
  await tapDrug('rsiinductpick', induct[1].label);
  ck('4. a second drug in the same lane does not restart the clock',
     await pg.evaluate(() => +localStorage.getItem('lrh-codes-rsiinduct')), firstT);
  const log = await caseLog();
  ck('4. both drugs are in the record as two separate entries',
     log.filter(l => l.indexOf(CFG.induction.logPrefix) === 0).length, 2);
  ck('4. and each entry names its own drug',
     [induct[0], induct[1]].every(d => log.some(l => l.indexOf(d.label) >= 0)), true);
}

/* ---- 5. no weight — the tap still logs the drug and the time, never a guessed dose ---- */
await fresh();
for (const lane of LANES) {
  const d = dosed(lane.key)[0];
  ck(`5. ${lane.key}/${d.label} shows NO WEIGHT instead of a number`,
     await doseOnButton(lane.id, d.label), 'NO WEIGHT');
  await tapDrug(lane.id, d.label);
}
const noWtLog = await caseLog();
ck('5. every lane still logged its drug with no weight entered',
   LANES.every(l => noWtLog.some(e => e.startsWith(CFG[l.key].logPrefix + ' — ' + dosed(l.key)[0].label))), true);
ck('5. and every one of those entries says the dose was not recorded, rather than guessing one',
   noWtLog.filter(e => LANES.some(l => e.startsWith(CFG[l.key].logPrefix)))
          .every(e => /dose not recorded/.test(e)), true);
ck('5. no digit-bearing dose leaked into a no-weight entry',
   noWtLog.filter(e => LANES.some(l => e.startsWith(CFG[l.key].logPrefix)))
          .every(e => !/\d+(\.\d+)?\s*(mg|mcg|mg\/hr)\b/.test(e)), true);
/* The unset chip inside a drug button must not also be its own control: the page-wide
   "tap an unset dose to jump to the weight bar" affordance would pull focus into a text
   input — and slide a keyboard over the card — at the moment the drug is being pushed. */
ck('5. an in-button dose chip is not separately focusable', await pg.evaluate(() =>
  [...document.querySelectorAll('.drugpick .wdose')].every(el =>
    !el.hasAttribute('tabindex') && !el.hasAttribute('role'))), true);
/* Land the tap ON the red "NO WEIGHT" chip, not on the surrounding button — that is where a
   thumb goes when the number is what you are looking at, and it is the only place the
   page-wide focus-the-weight-bar handler can be reached from. */
await fresh();
const chipLane = LANES[1], chipDrug = dosed(chipLane.key)[0].label;
await pg.click(`#${chipLane.id} button[data-drug="${chipDrug}"] .wdose`);
await pg.waitForTimeout(250);
ck('5. tapping the dose chip itself still logs the drug',
   (await caseLog()).some(e => e.indexOf(chipDrug) >= 0), true);
ck('5. and does not pull focus into the weight field (no keyboard over the card mid-push)',
   await pg.evaluate(() => (document.activeElement && document.activeElement.id) === 'wtkg'), false);

/* ---- 6. the awake-paralysis check — a prompt that fires on an absence ---- */
await fresh();
await setWeight(UNDER_KG);
ck('6. hidden before anything is given', await pg.locator('#c06awakepara').isVisible(), false);
await tapDrug('rsiinductpick', dosed('induction')[0].label);
ck('6. still hidden after induction alone (no paralytic yet)', await pg.locator('#c06awakepara').isVisible(), false);
await tapDrug('rsiparalyticpick', dosed('paralytic')[0].label);
ck('6. fires once a paralytic is in with nothing given after it',
   await pg.locator('#c06awakepara').isVisible(), true);
await tapDrug('c06analgesiapick', dosed('postAnalgesia')[0].label);
ck('6. clears once analgesia is logged', await pg.locator('#c06awakepara').isVisible(), false);
/* Sedation alone must clear it too — either lane is evidence somebody dealt with it. */
await fresh();
await setWeight(UNDER_KG);
await tapDrug('rsiparalyticpick', dosed('paralytic')[0].label);
await tapDrug('c06sedationpick', dosed('postSedation')[0].label);
ck('6. sedation alone also clears it', await pg.locator('#c06awakepara').isVisible(), false);
/* The wording is the point of the prompt — it must name the harm, not just flag a gap. */
await fresh();
await setWeight(UNDER_KG);
await tapDrug('rsiparalyticpick', dosed('paralytic')[0].label);
ck('6. the prompt names the harm (awake and unable to move or signal)',
   /awake and unable to move or signal/i.test(await pg.locator('#c06awakepara').innerText()), true);

/* ---- 7. UNDO clears the lane; the record is append-only ---- */
await fresh();
await setWeight(UNDER_KG);
await tapDrug('rsiparalyticpick', dosed('paralytic')[0].label);
const beforeUndo = (await caseLog()).length;
await pg.click('#rsiparalyticreset');
await pg.waitForTimeout(200);
ck('7. UNDO clears the lane clock', await pg.evaluate(() => localStorage.getItem('lrh-codes-rsiparalytic')), 'null');
ck('7. UNDO clears the lane drug list', await pg.evaluate(() => localStorage.getItem('lrh-codes-rsiparalyticdrug')), 'null');
ck('7. UNDO returns the cue to its idle text', /Tap the paralytic as it is pushed/.test(await laneCue('rsiparalyticcue')), true);
ck('7. UNDO does not retract the timeline entry (the case log is append-only)',
   (await caseLog()).length, beforeUndo);
ck('7. UNDO un-marks the drug', await pg.evaluate(l =>
   !document.querySelector(`#rsiparalyticpick button[data-drug="${l}"]`).classList.contains('picked'),
   dosed('paralytic')[0].label), true);

/* ---- 8. RESET FOR NEXT CASE clears all four lanes at once ----
   The lanes' own keys are swept by the confirmed reset's lrh- prefix sweep rather than by a
   per-lane listener (the confirm dialog calls stopImmediatePropagation, so per-card listeners
   on #resetbtn never fire). That is exactly why it is worth asserting: a new key that the
   sweep somehow missed would leave one case's drugs sitting on the next patient's screen. */
await fresh();
await setWeight(UNDER_KG);
for (const lane of LANES) await tapDrug(lane.id, dosed(lane.key)[0].label);
await pg.click('#resetbtn');
await pg.waitForTimeout(250);
ck('8. RESET asks before it wipes the case', await pg.locator('#resetmodal').isVisible(), true);
await pg.click('#resetmodalgo');
await pg.waitForTimeout(600);
for (const lane of LANES) {
  ck(`8. RESET clears ${lane.key}`, await pg.evaluate(([a, b2]) =>
     (localStorage.getItem(a) === null) && (localStorage.getItem(b2) === null), [lane.storeT, lane.storeD]), true);
}
await pg.goto(BASE + CARD, { waitUntil: 'networkidle' });
await pg.waitForTimeout(350);
ck('8. RESET clears the awake-paralysis prompt', await pg.locator('#c06awakepara').isVisible(), false);
ck('8. RESET returns every lane to its idle clock', await pg.evaluate(() =>
   ['rsiinductclock', 'rsiparalyticclock', 'c06analgesiaclock', 'c06sedationclock']
     .map(i => document.getElementById(i).textContent.trim()).join(',')), '0:00,0:00,0:00,0:00');
ck('8. RESET un-marks every drug', await pg.evaluate(() =>
   document.querySelectorAll('.drugpick button.picked').length), 0);

/* ---- 9. state survives a reload (the phone locks mid-case) ---- */
await fresh();
await setWeight(UNDER_KG);
const rocLike = dosed('paralytic')[0];
const rocDose = await doseOnButton('rsiparalyticpick', rocLike.label);
await tapDrug('rsiparalyticpick', rocLike.label);
await reload();
ck('9. the lane cue still names the drug and dose after a reload',
   new RegExp(rocLike.label + '\\s+' + rocDose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(await laneCue('rsiparalyticcue')), true);
ck('9. the drug is still marked after a reload', await pg.evaluate(l =>
   document.querySelector(`#rsiparalyticpick button[data-drug="${l}"]`).classList.contains('picked'), rocLike.label), true);
ck('9. the awake-paralysis prompt survives the reload too',
   await pg.locator('#c06awakepara').isVisible(), true);

/* ---- 10. PHI and the golden rules ---- */
await fresh();
await setWeight(UNDER_KG);
for (const lane of LANES) await tapDrug(lane.id, dosed(lane.key)[0].label);
const stored = await pg.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); }
  return out;
});
/* Every lane key holds times, drug names and doses — never a name, MRN or date of birth.
   Asserted structurally: the drug keys parse to {drug,dose} objects whose drug is a
   configured label, and nothing else. */
const laneKeys = LANES.map(l => l.storeD);
ck('10. lane storage holds only configured drug names and their doses', laneKeys.every(k => {
  const v = stored[k]; if (!v) return false;
  let arr; try { arr = JSON.parse(v); } catch (e) { return false; }
  return Array.isArray(arr) && arr.every(e => Object.keys(e).sort().join(',') === 'dose,drug' &&
    Object.values(CFG).some(l => l.drugs.some(d => d.label === e.drug)));
}), true);
ck('10. no lane key holds anything that looks like an identifier',
   laneKeys.every(k => !/\b\d{3}-?\d{2}-?\d{4}\b|\bmrn\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i.test(stored[k] || '')), true);
ck('10. all four lanes are namespaced lrh-codes- so the existing RESET sweep reaches them',
   LANES.every(l => l.storeT.startsWith('lrh-codes-') && l.storeD.startsWith('lrh-codes-')), true);
/* Golden rule 6 — the card that changed carries a version and a last-reviewed date, read
   from config so a fork that edits its menu and bumps the stamp gets a stamp that moved. */
const stamp = await pg.evaluate(() => document.querySelector('#c06 .verstamp').textContent);
const SITE_META = await pg.evaluate(() => ({ v: window.SITE.version, d: window.SITE.lastReviewed }));
ck('10. card 06 is stamped with the config version and review date',
   stamp.indexOf('v' + SITE_META.v) === 0 && stamp.indexOf(SITE_META.d) > 0, true);
/* The card shows the same drug twice — rounded on a button, exact in the ranges section
   below it (etomidate at 78 kg: 20 mg vs 23 mg). Two numbers for one drug on one screen is
   the self-contradiction CLAUDE.md's config-driven-verification note warns about, so the
   card must say which is which and why. A future edit that deletes that sentence puts the
   contradiction back silently. */
ck('10. the card reconciles its rounded button doses with its exact printed ranges',
   /Why this section and the tap-to-log buttons above show different numbers/
     .test(await pg.locator('#c06').innerText()), true);
ck('10. and says which number goes in the syringe',
   /the rounded number is the one that goes in the syringe/.test(await pg.locator('#c06').innerText()), true);
ck('10. the standard disclaimer is on the card',
   /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/
     .test(await pg.locator('#c06').innerText()), true);
/* An idle lane clock must be readable in BOTH themes. The retired version of this module
   painted a hardcoded light-theme hex onto the clock on every idle paint, which left the
   induction clock navy-on-navy in dark mode until the first drug went in — invisible in a
   light-theme screenshot, and the dark theme is the default on this manual. Asserted as
   "the color still comes from a token", which is the property that makes it theme-safe. */
await fresh();
const CLOCKS = ['rsiinductclock', 'rsiparalyticclock', 'c06analgesiaclock', 'c06sedationclock'];
ck('10. an idle lane clock takes its color from a theme token, not a hardcoded hex',
   await pg.evaluate(ids => ids.every(i => /^var\(--/.test(document.getElementById(i).style.color)), CLOCKS), true);
for (const theme of ['dark', 'light']) {
  await pg.evaluate(t => { document.body.dataset.theme = t; }, theme);
  await pg.waitForTimeout(150);
  ck(`10. no idle lane clock is the same color as its own background (${theme})`,
     await pg.evaluate(ids => ids.every(i => {
       const el = document.getElementById(i), cs = getComputedStyle(el);
       let bgEl = el, bg = 'rgba(0, 0, 0, 0)';
       while (bgEl && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(bgEl).backgroundColor; bgEl = bgEl.parentElement; }
       return cs.color !== bg;
     }), CLOCKS), true);
}
await pg.evaluate(() => { document.body.dataset.theme = 'dark'; });
/* Every button in the lanes has to be thumb-sized in a resuscitation (LAYOUT.md). */
const small = await pg.evaluate(() => [...document.querySelectorAll('.drugpick button')]
  .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 44)
  .map(el => (el.getAttribute('data-drug') || '').slice(0, 24)));
ck('10. every drug button is at least 44px tall', small.join(' | ') || 'none', 'none');

ck('11. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('11. still no off-origin requests after the whole run', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
