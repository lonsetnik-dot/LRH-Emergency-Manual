/* LRH Emergency Manual — the neonatal resuscitation engine (/neonatal/), issue #135,
 * now on the case shell (SHELL.md).
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
 * The shell sections assert the SHELL.md contract for this tool: the NRP case pill, the HR CHECK
 * cadence chip counting the tool's own cycle lengths, the PPV / EPI / HR CHECK dock driving the same
 * handlers as the on-page buttons, the heart-rate picker built from SITE.hr, the VENT metronome row
 * with MUTE and no airway toggle, the tele-NICU slot (this tool's wording, never TELE-ED), the
 * timeline replacing the old EVENT LOG accordion, and the two-tap reset with the cleared toast.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_neonatal_screen.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

import { readFileSync } from 'node:fs';

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
/* The weight/GA inputs live in the shell's weight strip (SHELL.md layer 4) —
   collapsed behind #wtoggle on a phone, the same tap a clinician makes. */
const openW = async () => {
  if (!(await pg.locator('#wform').isVisible())) { await pg.click('#wtoggle'); await pg.waitForTimeout(200); }
};
/* The case timeline (SHELL.md layer 8) replaced the old EVENT LOG accordion.
   Reachable from the case pill while a case runs and from the ⋯ menu always. */
const tlText = async () => {
  if (!(await pg.locator('#shelltl').isVisible())) {
    if (await pg.locator('#casepill').isVisible()) await tap('#casepill');
    else { await tap('#menubtn'); await tap('#tlbtn'); }
  }
  const t = (await pg.locator('#tlrows').innerText()).replace(/\s+/g, ' ').trim();
  await tap('#tlclose', 150);
  return t;
};

await fresh();
const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /neonatal/ does not expose window.SITE'); process.exit(1); }
const lit = s => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');

/* ---- 1. opening state, offline-safe ---- */
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. starts idle', await pg.locator('#idle').isVisible(), true);
ck('1. the pathway is hidden until birth is stamped', await pg.locator('#live').isVisible(), false);
ck('1. no case pill before the birth is stamped', await pg.locator('#casepill').isVisible(), false);
ck('1. status reads READY', await txt('#statusword'), 'READY');
ck('1. no cadence strip and no dock while idle',
   (await pg.locator('#shellstrip').isVisible()) || (await pg.locator('#shelldock').isVisible()), false);
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');

/* ---- 1s. the case shell bar (SHELL.md layer 1) ---- */
ck('1s. the tool button names the tool', /NEONATAL/.test(await txt('#toolbtn')), true);
await tap('#toolbtn');
/* The switcher's list is tool-switcher.js, injected at build (SHELL.md layer 1),
   so the count comes FROM that file rather than being typed here — a hand-typed
   8 went red the moment a tool was added, which teaches the next editor that a
   red run is normal. verify_tool_switcher.mjs owns the deeper checks (same list
   on every page, source order, distinct colours, live destinations); this one
   just confirms the bar on THIS page is wired to it. */
const SWITCHER_ROWS = [...readFileSync('tool-switcher.js', 'utf8')
  .matchAll(/\{\s*id:\s*'([a-z-]+)'/g)].length + 1;   /* + manual home */
ck('1s. the switcher lists every tool in tool-switcher.js + manual home',
   await pg.locator('#toolmenu .shellmenurow').count(), SWITCHER_ROWS);
ck('1s. neonatal is marked as the current tool',
   /neonatal/i.test(await pg.locator('#toolmenu .shellmenurow.on').getAttribute('href')), true);
await pg.click('#foot'); await pg.waitForTimeout(200);
ck('1s. tapping elsewhere closes the switcher', await pg.locator('#toolmenu').isVisible(), false);
ck('1s. and started nothing', await pg.locator('#idle').isVisible(), true);
await tap('#menubtn');
ck('1s. the ⋯ menu holds timeline, feedback and reset',
   /Case timeline/.test(await txt('#moremenu')) && /Feedback/.test(await txt('#moremenu')) &&
   /Reset for next case/.test(await txt('#moremenu')), true);
await tap('#menubtn');

/* ---- 2. provenance — what this screen claims about its own sourcing ----
   THE BANNER CAME DOWN on 2026-08-18, when a clinician actually reviewed the engine
   (SITE.review.signedOff; guidelines.js `nrp` reconciled in the same change). It was
   never meant to be permanent — it was meant to stay up until exactly that happened.

   So the guard moved rather than disappeared. It used to be "the banner is visible",
   which stops being true the moment the review it was waiting for arrives. What is
   asserted now is the thing that must NEVER be true: that the banner is off and nobody
   is named. A future editor who quietly flips SITE.review.on to false to make a screen
   look finished fails here, which is the whole point of the original guard.

   The SOURCE & PROVENANCE panel is a separate matter and still has to say both halves —
   what was aligned to the 2025 guideline and what was inherited unchanged. A sign-off
   does not retroactively give the inherited values a citation, and the citations are
   asserted by DOI because a guideline reference that drifts is worse than none. */
const review = await pg.evaluate(() => ({
  on: !!(SITE.review && SITE.review.on),
  by: (SITE.review && SITE.review.signedOff && SITE.review.signedOff.by) || '',
  date: (SITE.review && SITE.review.signedOff && SITE.review.signedOff.date) || '',
}));
ck('2. the banner on screen matches SITE.review.on',
   await pg.locator('#revbanner').isVisible(), review.on);
ck('2. the banner is only off because someone SIGNED it off',
   review.on || (review.by.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(review.date)), true);
if (review.on) {
  const rev = await txt('#revbanner');
  ck('2. it names the 2025 AHA/AAP guidelines', /2025 AHA\/AAP GUIDELINES/i.test(rev), true);
  ck('2. it says which items were aligned', /cord management/i.test(rev) && /supraglottic/i.test(rev), true);
  ck('2. it also says what was NOT verified', /not.{0,30}individually verified/i.test(rev), true);
} else {
  console.log('     (banner off — signed off by ' + review.by + ' on ' + review.date + ')');
}
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
ck('4. it opens on the initial steps', await txt('#plabel'), 'NEONATAL · INITIAL STEPS');
ck('4. the case pill comes up tagged NRP', await pg.locator('#casepill').isVisible(), true);
ck('4. the pill tag is NRP', await txt('#pilltag'), 'NRP');
ck('4. the birth stamp is logged', /Time of birth/i.test(await tlText()), true);
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
   lit(`Apgar at ${CFG.apgar.at[0]} min = 10/10`).test(await tlText()), true);

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

/* ---- 4s. the HR CHECK cadence + picker (SHELL.md layers 2/6/7) ----
   The countdown RIDES the action button on both widths (layer 2, 2026-08-15
   revision): the dock's blue HR CHECK slot embeds the tool's OWN cycle
   lengths (SITE.cycle) as its second mono line, and a cadence with a dock
   slot never gets a duplicate phone chip. Tapping it opens the heart-rate
   picker, whose three options are SITE.hr's bands and drive the SAME band
   state machine the on-page grid drives. */
await fresh();
await tap('#startbtn', 320);
ck('4s. the countdown rides the dock button', await pg.locator('#dockhrclock').isVisible(), true);
ck('4s. no duplicate phone chip for a cadence with a dock slot',
   await pg.locator('.shellchip').count(), 0);
ck('4s. it is not DUE at birth', /DUE NOW/.test(await txt('#dockhrclock')), false);
await skew(CFG.cycle.initialStepsSec * 1000 + 2000);
ck(`4s. past ${CFG.cycle.initialStepsSec} s of initial steps it reads DUE NOW`,
   /DUE NOW/.test(await txt('#dockhrclock')), true);
ck('4s. and the countdown line carries the due styling',
   await pg.locator('#dockhrclock.due').count(), 1);
await tap('#dockhr', 320);
ck('4s. the dock HR CHECK opens the picker', await pg.locator('#sheet').isVisible(), true);
ck('4s. the picker offers exactly the three bands', await pg.locator('#sheet [data-hr]').count(), 3);
const pk = await txt('#sheetinner');
ck(`4s. the low band is <${CFG.hr.low} (SITE.hr.low)`, lit('UNDER ' + CFG.hr.low).test(pk), true);
ck(`4s. the middle band is ${CFG.hr.low}–${CFG.hr.good - 1}`,
   lit(CFG.hr.low + '–' + (CFG.hr.good - 1)).test(pk), true);
ck(`4s. the good band is ≥${CFG.hr.good} and breathing`, lit('≥' + CFG.hr.good).test(pk), true);
ck('4s. apnea or gasping starts PPV whatever the rate', /Apnea or gasping/i.test(pk), true);
/* Opening the check pauses the metronome with a visible countdown, and the
   pause expires on its own (SITE.pacer.checkPauseMs) — a slow decision must
   not leave the room unpaced. */
ck('4s. the metronome pauses for the check, countdown visible',
   /paused \d+ s/.test(await txt('#metstatus')), true);
await skew(CFG.cycle.initialStepsSec * 1000 + 2000 + CFG.pacer.checkPauseMs + 1500);
ck('4s. the pause expires on its own with the picker still open',
   /paused/.test(await txt('#metstatus')), false);
/* ✕ closes without logging a result — the check transition line may be in the
   log, but no BAND result may be. */
await tap('#pkclose', 300);
ck('4s. ✕ closes the picker', await pg.locator('#sheet').isVisible(), false);
ck('4s. no band result was logged by closing',
   new RegExp('Heart rate (under|≥|\\d+–\\d+)', 'i').test(await tlText()), false);
ck('4s. the on-page band grid is still beneath as the fallback',
   await pg.locator('#phasebox [data-hr]').count(), 3);
/* Picking a result drives the existing state machine and restarts the cadence. */
await tap('#dockhr', 320);
ck('4s. the dock button reopens the picker', await pg.locator('#sheet').isVisible(), true);
await tap('#sheet [data-hr="low"]', 320);
ck('4s. picking <60 lands on compressions', await txt('#plabel'), 'NEONATAL · COMPRESSIONS');
ck('4s. the pick is logged as the result',
   lit('Heart rate under ' + CFG.hr.low).test(await tlText()), true);
ck(`4s. the compression cycle restarts the cadence at ${CFG.cycle.compressionCycleSec} s`,
   /DUE NOW/.test(await txt('#dockhrclock')), false);

/* ---- 4t. the dock's PPV and EPI slots (SHELL.md layer 6) ---- */
await fresh();
await tap('#startbtn', 320);
await tap('#dockppv', 320);
ck('4t. PPV ✓ starts PPV through the same step machine', await txt('#plabel'), 'NEONATAL · PPV');
ck('4t. and logs it', /PPV started/i.test(await tlText()), true);
ck(`4t. the PPV screen paces ${CFG.ppv.ratePerMin}/min (SITE.ppv)`,
   lit('PPV ' + CFG.ppv.ratePerMin + ' / min').test(await txt('#phasebox')), true);
/* EPI without a weight refuses to invent a dose; with one, the logged line
   carries the computed dose (rates and doses, never the patient's weight). */
await tap('#dockepi', 320);
ck('4t. EPI with no weight logs that no dose was computed',
   /dose not computed — no weight/i.test(await tlText()), true);
const epiMg2 = +(CFG.epi.ivPerKg * 3.2).toFixed(3);
ck('4t. with no weight the EPI slot offers no number',
   await txt('#dockepilabel'), 'EPI GIVEN');
await openW();
await pg.fill('#wIn', '3200'); await pg.waitForTimeout(300);
ck(`4t. with a weight the computed dose rides the EPI button (SHELL.md layer 2)`,
   await txt('#dockepilabel'), `EPI ${epiMg2} mg`);
await tap('#dockepi', 320);
ck(`4t. EPI with a weight logs the computed dose (${epiMg2} mg)`,
   lit(epiMg2 + ' mg').test(await tlText()), true);
ck('4t. the LOG ticker rides on the dock with the newest event',
   lit(epiMg2 + ' mg').test(await txt('#tickertext')), true);

/* ---- 4t2. operating card first while running (SHELL.md layer 5, 2026-08-15) ----
   The pathway box must sit ABOVE the tele slot, the routing sentence and the
   review banner once a case runs — never below reference. Compared by real
   on-screen position, not DOM order. */
const yOf = async sel => (await pg.locator(sel).boundingBox())?.y ?? -1;
ck('4t2. the operating card leads the scroll area while running',
   (await yOf('#phasebox')) < (await yOf('#scopebar')) &&
   /* only meaningful while the banner is rendered; a hidden element has no box */
   (!review.on || (await yOf('#phasebox')) < (await yOf('#revbanner'))), true);
ck('4t2. the tele slot compacts beneath the operating card',
   (await yOf('#phasebox')) < (await yOf('#telebtn')), true);
ck('4t2. the SpO₂-by-minute row is part of the operating block',
   (await yOf('#satbox')) < (await yOf('#scopebar')), true);
/* The banner used to be asserted visible mid-case. Now that it is signed off, what
   matters is that it does not REAPPEAR unannounced while a resuscitation is running —
   a banner that materializes mid-code moves the buttons under someone's thumb. */
ck('4t2. the banner state does not change once a case is running',
   await pg.locator('#revbanner').isVisible(), review.on);
/* Idle keeps prompt → start → tele (the routing question stays ahead of START). */
await fresh();
ck('4t2. idle keeps the start button ahead of the tele slot',
   (await yOf('#startbtn')) < (await yOf('#telebtn')), true);
ck('4t2. idle keeps the routing sentence ahead of START',
   (await yOf('#scopebar')) < (await yOf('#startbtn')), true);

/* ---- 4u. the metronome row (SHELL.md layer 3) — VENT cadence, MUTE, no
   airway toggle ---- */
await fresh();
await tap('#startbtn', 320);
ck(`4u. the row reads VENT · ${CFG.pacer.defaultPpvRate} (SITE.pacer)`,
   await txt('#metmode'), 'VENT · ' + CFG.pacer.defaultPpvRate);
ck('4u. NRP has no airway toggle', await pg.locator('#advchip').count(), 0);
ck('4u. sound starts ON, so the chip offers MUTE', await txt('#mutechip'), 'MUTE');
await tap('#mutechip');
ck('4u. MUTE flips the same toggle the pacer box owns', /SOUND OFF/.test(await txt('#soundbtn')), true);
ck('4u. and the dot goes still', await pg.locator('#metdot.off').count(), 1);
await tap('#mutechip');
ck('4u. tapping again turns sound back on', /SOUND ON/.test(await txt('#soundbtn')), true);
/* A localized rate moves the row: pick a non-default configured rate. */
const altRate = CFG.pacer.ppvRates.find(r => r !== CFG.pacer.defaultPpvRate);
if (altRate !== undefined) {
  await tap(`[data-rate="${altRate}"]`, 320);
  ck(`4u. picking ${altRate}/min moves the VENT label with it`,
     await txt('#metmode'), 'VENT · ' + altRate);
}
await tap('#toassess', 320); await tap('#sheet [data-hr="low"]', 320);
ck(`4u. under compressions the row reads ${CFG.compressions.ratio} · ${CFG.pacer.cprEventsPerMin}`,
   await txt('#metmode'), CFG.compressions.ratio + ' · ' + CFG.pacer.cprEventsPerMin);

/* ---- 4v. tele-NICU (SHELL.md layer 5.2) — this tool's wording, idempotent ---- */
await fresh();
ck('4v. the slot says TELE-NICU, never TELE-ED',
   /TELE-NICU/.test(await txt('#telebtn')) && !/TELE-ED/.test(await txt('#telebtn')), true);
await tap('#telebtn', 320);
ck('4v. one tap collapses it to a confirmation row', await pg.locator('#teledone').isVisible(), true);
ck('4v. the button is gone — never a second dialog', await pg.locator('#telebtn').isVisible(), false);
await tap('#startbtn', 320);
const tl4v = await tlText();
ck('4v. a pre-case activation seeds the timeline', /Tele-NICU already on the line/i.test(tl4v), true);
ck('4v. and the activation itself was logged', /Tele-NICU activated/i.test(tl4v), true);

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
ck('6. the check opens the picker', await pg.locator('#sheet').isVisible(), true);
ck('6. exactly three heart-rate bands in the picker', await pg.locator('#sheet [data-hr]').count(), 3);
ck('6. and the same three on the page beneath', await pg.locator('#phasebox [data-hr]').count(), 3);
const bands = await txt('#phasebox');
ck(`6. the good band is ≥${CFG.hr.good} (SITE.hr.good)`, lit('≥' + CFG.hr.good).test(bands), true);
ck(`6. the low band is <${CFG.hr.low} (SITE.hr.low)`, lit('<' + CFG.hr.low).test(bands), true);
ck('6. apnea or gasping starts PPV whatever the rate', /Apnea or gasping/i.test(bands), true);

await tap('#sheet [data-hr="mid"]');
ck('6. the middle band goes to PPV', await txt('#plabel'), 'NEONATAL · PPV');
ck(`6. PPV rate is ${CFG.ppv.ratePerMin} (SITE.ppv)`, lit('PPV ' + CFG.ppv.ratePerMin + ' / min').test(await txt('#phasebox')), true);
ck('6. no chest rise routes to MR SOPA', /MR SOPA/.test(await txt('#phasebox')), true);

await fresh(); await tap('#startbtn', 300); await tap('#toassess'); await tap('#sheet [data-hr="low"]');
ck('6. the low band goes straight to compressions', await txt('#plabel'), 'NEONATAL · COMPRESSIONS');
const cpr = await txt('#phasebox');
ck(`6. compressions are ${CFG.compressions.ratio}`, lit(CFG.compressions.ratio).test(cpr), true);
ck(`6. ${CFG.compressions.perMin} compressions + ${CFG.compressions.breathsPerMin} breaths`,
   lit(`${CFG.compressions.perMin} compressions + ${CFG.compressions.breathsPerMin} breaths`).test(cpr), true);

await fresh(); await tap('#startbtn', 300); await tap('#toassess'); await tap('#sheet [data-hr="good"]');
ck('6. the good band goes to routine care', await txt('#pilltag'), 'STABLE');
ck('6. routine care sends someone back to the mother', /check the mother/i.test(await txt('#stablebody')), true);

/* ---- 7. dose math, computed from the weight actually entered ---- */
await fresh(); await tap('#startbtn', 300);
/* Grams, because a birth weight is spoken in grams and typed in a hurry. */
await openW();
await pg.fill('#wIn', '3200'); await pg.waitForTimeout(300);
ck('7. a gram weight is read as kilograms', await txt('#wnote'), '3.2 kg');
ck('7. the collapsed strip label would show it too', await txt('#wlabel'), '3.2 kg');
await tap('#toassess'); await tap('#sheet [data-hr="low"]');
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
ck('9. and appears in the timeline', /LMA 0.5 in, chest rising/.test(await tlText()), true);
const keys = await pg.evaluate(() => Object.keys(localStorage));
/* Since the shared case-clock (CASE-STATE.md's lrh-case-startms) landed, this
   engine also touches lrh-case-lastactive and — once a clock anywhere in the
   case has started — lrh-case-startms. Neither carries anything patient-
   identifying (a timestamp only); everything else must still be just theme.
   The case shell added NO persisted keys (SHELL.md: phase 1 is in-memory). */
ck('9. localStorage holds only theme + the shared case-clock keys',
   keys.filter(k => !['lrh-pref-theme','lrh-case-lastactive','lrh-case-startms'].includes(k)).join(',') || 'none', 'none');

/* ---- 10. reset is two taps in the ⋯ menu, sweeps the case, and says so ---- */
await tap('#menubtn');
await tap('#resetbtn');
ck('10. the first tap only arms it', /SURE\?/.test(await txt('#resetbtn')), true);
ck('10. the pathway is still up', await pg.locator('#live').isVisible(), true);
await tap('#resetbtn', 320);
ck('10. the second tap returns to idle', await pg.locator('#idle').isVisible(), true);
ck('10. the case pill is gone', await pg.locator('#casepill').isVisible(), false);
ck('10. the cleared toast comes up (SHELL.md layer 9)', await pg.locator('#shelltoast').isVisible(), true);
await tap('#toastok', 200);
ck('10. OK dismisses the toast', await pg.locator('#shelltoast').isVisible(), false);
ck('10. the timeline is empty again', /Nothing logged yet/.test(await tlText()), true);
ck('10. the shared case keys were swept (CASE-STATE.md)',
   await pg.evaluate(() => localStorage.getItem('lrh-case-startms')), null);

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
await tap('#toassess'); await tap('#sheet [data-hr="low"]');
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
await openW();
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
await openW();
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
  await openW();

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

/* ---- 10g. the timeline panel (SHELL.md layer 8) ---- */
await fresh(); await tap('#startbtn', 300);
await tap('#casepill', 300);
ck('10g. tapping the case pill opens the timeline', await pg.locator('#shelltl').isVisible(), true);
ck('10g. the timeline carries the device-only footer',
   /device only · no identifiers · cleared on reset/.test(await txt('#shelltl')), true);
ck('10g. the old EVENT LOG accordion is gone — one view of the log',
   await pg.locator('[data-acc="log"]').count(), 0);
await tap('#tlclose', 200);
ck('10g. ✕ closes it', await pg.locator('#shelltl').isVisible(), false);

/* ---- 10h. ≥768px — the same actions move homes, nothing changes behavior ---- */
const wideCtx = await b.newPage({ viewport: { width: 768, height: 1024 } });
await wideCtx.goto(BASE + '/neonatal/?from=home', { waitUntil: 'networkidle' });
await wideCtx.waitForTimeout(350);
ck('10h. the weight form is open by default on a wide screen',
   await wideCtx.locator('#wform').isVisible(), true);
await wideCtx.click('#startbtn'); await wideCtx.waitForTimeout(350);
ck('10h. no bottom dock ≥768px', await wideCtx.locator('#shelldock').isVisible(), false);
ck('10h. the three dock actions render in the strip instead',
   (await wideCtx.locator('#stripppv').isVisible()) && (await wideCtx.locator('#stripepi').isVisible()) &&
   (await wideCtx.locator('#striphr').isVisible()), true);
ck('10h. TIMELINE / FEEDBACK / RESET are inline in the bar',
   (await wideCtx.locator('#tlbtnwide').isVisible()) && (await wideCtx.locator('#resetwide').isVisible()), true);
await wideCtx.click('#striphr'); await wideCtx.waitForTimeout(300);
ck('10h. the strip HR CHECK opens the same picker', await wideCtx.locator('#sheet').isVisible(), true);
await wideCtx.click('#pkcancel'); await wideCtx.waitForTimeout(200);
await wideCtx.click('#resetwide'); await wideCtx.waitForTimeout(200);
ck('10h. the wide RESET arms with SURE?', /SURE\?/.test(await wideCtx.locator('#resetwide').innerText()), true);
await wideCtx.click('#resetwide'); await wideCtx.waitForTimeout(350);
ck('10h. and the second tap resets to idle', await wideCtx.locator('#idle').isVisible(), true);
await wideCtx.close();

/* ---- 11. stamp and disclaimer ---- */
await fresh();
ck(`11. stamped v${CFG.version}, last reviewed ${CFG.lastReviewed}`,
   lit(`v${CFG.version} · last reviewed ${CFG.lastReviewed}`).test(await txt('#verstamp')), true);
ck('11. the standard disclaimer is present',
   /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await pg.innerText('body')), true);
ck('11. links back to the manual', await pg.getAttribute('#backlink', 'href'), '../?from=tool');
/* ?from=<tool> routes the back link to the referring tool (arrest's NRP
   banner passes ?from=arrest), while ?from=home/tool keeps the manual. */
await pg.goto(BASE + '/neonatal/?from=arrest', { waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
ck('11. ?from=arrest routes the back link to /arrest/',
   await pg.getAttribute('#backlink', 'href'), '../arrest/?from=tool');

ck('12. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('12. still no off-origin requests', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
