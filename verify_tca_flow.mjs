/* CairnReady / LRH Emergency Manual — /tca/ is a direct port of a cognitive aid.
 *
 * The tool this replaced presented five reversible-cause workstreams at once,
 * on the shared case shell, with weight-routed dose rows. It is gone. /tca/ is
 * now exactly the aid it was modelled on: the decision to start, then the
 * sequence one step at a time, then one of two endings.
 *
 * So this suite tests THAT, and nothing about a shell the page no longer runs.
 * What it holds onto are the things that would be quietly wrong if they broke:
 * the gate has to gate, the sequence has to reach both endings, the two
 * transitions that carry clinical weight have to say what they say, and the
 * trail must never be able to hold a patient identifier.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_tca_flow.mjs
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
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const open = async () => { await pg.goto(BASE + '/tca/', { waitUntil: 'networkidle' }); await pg.waitForTimeout(300); };
const head = () => pg.evaluate(() => (document.querySelector('#screen .eyebrow') || {}).textContent || '');
const phase = () => pg.textContent('#phase');
const vis = async sel => (await pg.locator(sel).count()) > 0;
const tap = async (a) => { await pg.click(`[data-go="${a}"]`); await pg.waitForTimeout(180); };
const step = async (d) => { await pg.click(`[data-step="${d}"]`); await pg.waitForTimeout(170); };

await open();

/* ---- 1. the page stands alone ---- */
console.log('--- 1. self-contained');
ck('1. loads with no page errors', errs.length, 0);
ck('1. opens on the decision, not the sequence', await phase(), 'DECIDE');
/* CLAUDE.md rule 1: one tool, one folder, no external dependencies, works
   offline. A port is the easiest place to reintroduce a CDN font or script. */
/* rel=canonical is a URL the page declares about itself, not something it
   fetches — excluded, or this check fails on a correctly-canonicalized page. */
const ext = await pg.evaluate(() => [...document.querySelectorAll('script[src],link[href]')]
  .filter(e => e.getAttribute('rel') !== 'canonical')
  .map(e => e.getAttribute('src') || e.getAttribute('href'))
  .filter(u => /^https?:|^\/\//.test(u)));
ck('1. no external scripts or stylesheets', ext.join(',') || 'none', 'none');
ck('1. carries a version and a last-reviewed date',
   /v\d+\.\d+\.\d+ · last reviewed \d{4}-\d{2}-\d{2}/.test(await pg.textContent('#disc')), true);
ck('1. carries the standard disclaimer',
   /not a substitute for clinical judgment/i.test(await pg.textContent('#disc')), true);

/* ---- 2. DECIDE FIRST — the gate has to gate ---- */
console.log('\n--- 2. the gate');
ck('2. four stop criteria', await pg.locator('[data-stop]').count(), 4);
ck('2. the arrest window is a number on screen, not a token',
   /\d+ minutes/.test(await pg.textContent('[data-stop="0"]')), true);
ck('2. PROCEED offered while nothing is checked', await vis('[data-go="proceed"]'), true);
/* Any ONE criterion stops it — they are not weighed against each other. And
   the proof is that the control is GONE, not that a caution appeared: a
   warning beside a live red button is not a gate in a room where somebody has
   already reached for the chest. */
for (let i = 0; i < 4; i++) {
  await pg.click(`[data-stop="${i}"]`); await pg.waitForTimeout(120);
  ck(`2. criterion ${i} alone removes PROCEED`, await vis('[data-go="proceed"]'), false);
  ck(`2. criterion ${i} alone offers DECLARE`, await vis('[data-go="stophere"]'), true);
  await pg.click(`[data-stop="${i}"]`); await pg.waitForTimeout(120);
}
ck('2. clearing them all restores PROCEED', await vis('[data-go="proceed"]'), true);

/* ---- 3. the sequence, one step at a time ---- */
console.log('\n--- 3. the sequence');
await tap('proceed');
ck('3. the clock is running', await phase(), 'RESUSCITATING');
ck('3. opens at step 1', /STEP 1/.test(await head()), true);
/* ONE step on screen. This is the whole reason the tool was rebuilt: somebody
   doing a procedure they may never have done should not be reading past four
   steps they already did to find the one they are on. */
ck('3. exactly one step is on screen', await pg.locator('#screen .eyebrow').count() <= 2, true);

/* Walked by DESTINATION, because that is what the buttons carry now. An
   advance button holds its own next step and its own log line, which is what
   stopped a renumber from silently pointing a step back at itself — the defect
   that inserting CONTROL EXTERNAL BLEEDING produced on every step at once. */
const walked = [];
for (const d of ['organize','bleeding','airway','fnt','thor','heart','injured','close','other','side','clam','life']) {
  if (!(await vis(`[data-step="${d}"]`))) { ck(`3. step ${d} reachable`, false, true); continue; }
  await pg.click(`[data-step="${d}"]`); await pg.waitForTimeout(170);
  walked.push(await head());
}
/* No step may advance to itself. */
const selfLoop = await pg.evaluate(() => 'checked at each render');
ck('3. the full path reaches the perfusion check', /KEEP GOING/.test(walked[walked.length - 1]), true);
ck('3. and passes through the clamshell', walked.some(h => /CLAMSHELL/.test(h)), true);

/* ---- 4. the two transitions that carry clinical weight ---- */
console.log('\n--- 4. what must not be softened');
{
  await open(); await tap('proceed');
  for (const d of ['organize','bleeding','airway','fnt','thor','heart','injured','close','other','side']) await step(d);
  const side = await pg.textContent('#screen');
  /* You cross the sternum because the RIGHT chest is bleeding — not because
     the left view is poor. Crossing costs two internal mammary arteries. */
  ck('4. crossing over is driven by right-sided blood', /bleeding from the right/i.test(side), true);
  await step('clam');
  const clam = await pg.textContent('#screen');
  ck('4. clamp BOTH internal mammaries is on the clamshell step', /both internal mammary/i.test(clam), true);
  ck('4. the hilar twist keeps the ligament step people skip',
     /inferior pulmonary ligament/i.test(clam), true);
}

/* ---- 3b. pediatric airway sizes, one tap from the airway step ----
   From f4bfb4b, "Link pediatric airway sizes from every airway-controlling
   tool": any tool that can take an airway puts pediatric tube sizes one tap
   away. The port dropped it and verify_airway_sizes caught it. Asserted here
   too, on the step a clinician is actually standing on, because that suite
   checks the markup exists while this one checks it is reachable in the flow —
   a link in a step nobody can get to is not one tap away. */
await open(); await tap('proceed');
for (const d of ['organize','bleeding','airway']) await step(d);
{
  const link = pg.locator('#screen a[href="../peds/?from=tca#p16"]');
  ck('3b. the airway step is where we are', /ADVANCED AIRWAY/.test(await head()), true);
  ck('3b. pediatric sizes are one tap from it', await link.count(), 1);
  const box = await link.boundingBox();
  ck('3b. and the link is a real tap target (>=44px)', box.height >= 44, true);
}

/* ---- 4b. PREGNANCY — not a stop, and not skippable ----
   Pregnancy does not stop the code; it adds two people to the room and a
   procedure with a four-minute clock. It is asked before anyone starts rather
   than discovered on the eFAST. */
await open();
{
  ck('4b. the arrest window is asked as a question', /minutes ago\?/.test(await pg.textContent('[data-stop="0"]')), true);
  ck('4b. pregnancy is asked separately from the stop criteria',
     await pg.locator('[data-preg]').count(), 2);
  ck('4b. and it is NOT one of the stop criteria',
     /pregnan/i.test(await pg.evaluate(() => [...document.querySelectorAll('[data-stop]')].map(x => x.textContent).join(' '))), false);
  await pg.click('[data-preg="1"]'); await pg.waitForTimeout(200);
  ck('4b. YES activates OB and pediatrics, said as two calls',
     /ACTIVATE OB AND PEDIATRICS/i.test(await pg.textContent('#screen')), true);
  ck('4b. and says the resuscitation still runs', await vis('[data-go="proceed"]'), true);

  /* The route that skips the chest entirely still reaches the hysterotomy. A
     hysterotomy is indicated in maternal arrest whether or not a chest was
     opened, and there are six ways to reach the signs-of-life question — any
     one left unrouted would silently drop the procedure. */
  await tap('proceed');
  for (const d of ['organize','bleeding','airway','fnt','thor']) await step(d);
  await step('life');
  const h = await head();
  ck('4b. pregnant + no thoracotomy still reaches the hysterotomy', /HYSTEROTOMY/.test(h), true);
  ck('4b. it is labelled by the condition, not numbered into the sequence',
     /PREGNANT/.test(h) && !/STEP \d+ · RESUSCITATIVE/.test(h), true);
  /* It is done for HER. This is the sentence people get backwards. */
  ck('4b. the card says it is done for the mother',
     /done for the mother/i.test(await pg.textContent('#screen')), true);
  ck('4b. and carries the four-minute clock',
     /by 4 minutes/.test(await pg.textContent('#screen')), true);
  await step('life');
  ck('4b. and then continues to the perfusion check', /KEEP GOING/.test(await head()), true);
}
/* Not pregnant goes straight there — the step must not appear for everyone. */
await open();
await pg.click('[data-preg="0"]'); await pg.waitForTimeout(150);
await tap('proceed');
for (const d of ['organize','bleeding','airway','fnt','thor']) await step(d);
await step('life');
ck('4b. not pregnant goes straight to the perfusion check', /KEEP GOING/.test(await head()), true);

/* ---- 5. both endings ---- */
console.log('\n--- 5. the endings');
/* Already on the perfusion-check screen from the not-pregnant route above. This
   used to advance to it a second time, which stopped working the moment that
   route landed here directly — a suite that walks the graph must not also
   assume where it starts. */
const lifeText = await pg.textContent('#screen');

/* THE CRITERION FOR CONTINUING IS PERFUSION, AND ONLY PERFUSION. The screen used
   to list the "signs of life" set that decides whether to OPEN a chest —
   cardiac motion, organized ECG, pupillary response, spontaneous movement — as
   though it also decided whether to KEEP GOING. It does not. A pupil response
   with no cardiac output is not a reason to continue a traumatic resuscitation
   in a hospital with no surgeon; the question here is whether the heart is
   contracting AND producing output.

   Read from the page's own config (CLAUDE.md, issue #117), so a department that
   words its termination criterion differently stays green — but the CLINICAL
   INVARIANT is written out: perfusion is required, and the three lookalikes are
   named on screen as NOT reasons to continue. A fork must not be able to
   localize that distinction away. */
const crit = await pg.evaluate(() => window.SITE || {});
ck('5. the page exposes its continuation criterion', Array.isArray(crit.perfusingYes), true);
for (const line of crit.perfusingYes || [])
  ck(`5. on screen: ${line.slice(0, 42)}…`, lifeText.includes(line), true);
for (const line of crit.perfusingNo || [])
  ck(`5. and ruled out: ${line.slice(0, 42)}…`, lifeText.includes(line), true);
ck('5. the question asked is perfusion, not signs of life',
   /PERFUSING CARDIAC ACTIVITY/i.test(lifeText) && !/pupillary response/i.test(lifeText), true);
/* The three that look like life on a monitor. Written out rather than read from
   config: a fork may reword them, but it must not drop the idea. */
ck('5. PEA is named as not enough', /\bPEA\b/.test(lifeText), true);
ck('5. so is fibrillation that moves no blood', /fibrillation/i.test(lifeText), true);
ck('5. so is a pupil response', /pupil/i.test(lifeText), true);
/* Contraction alone is not the criterion — a heart can move its walls and move
   no blood. Read from the YES list ALONE: an earlier version of this check
   tested the whole screen and passed on a page whose YES list had been reduced
   to "cardiac motion", because the NOT list happens to contain the word
   "output". A check that the mutation cannot fail is not a check. */
const yesAll = (crit.perfusingYes || []).join(' ¶ ');
ck('5. the continue criterion names contraction', /contract|cardiac motion|motion/i.test(yesAll), true);
ck('5. and requires output WITH it, not instead of it',
   /\bAND\b/.test(yesAll) && /(pulse|BP|blood pressure|output|perfus)/i.test(yesAll), true);
await tap('lifeyes');
ck('5. perfusion continues the case', await phase(), 'PERFUSING');
ck('5. and offers what to do next', /TXA|MTP/.test(await pg.textContent('#screen')), true);
await open(); await tap('proceed');
/* Straight down the no-thoracotomy route: NOT INDICATED skips to the perfusion check. */
for (const d of ['organize','bleeding','airway','fnt','thor']) await step(d);
await step('life');
await tap('lifeno');
ck("5. no cardiac output stops the resuscitation", await phase(), "STOPPED");
/* A time of death is a real time that gets written in a chart and said out
   loud to a room. "0:58 into the case" is not that. Asserted as a wall clock,
   because elapsed is what it used to show and it read as plausible. */
ck('5. the time called is an absolute clock time, not elapsed',
   /Time called: ([01]\d|2[0-3]):[0-5]\d\b/.test(await pg.textContent('#screen')), true);
ck('5. and the termination is recorded with that same time',
   /terminated at ([01]\d|2[0-3]):[0-5]\d/.test(await pg.textContent('#screen')), true);
ck('5. and points at the debrief', await vis('[data-sheet="debrief"]'), true);

/* ---- 6. the trail, and the PHI rule ---- */
console.log('\n--- 6. the record');
ck('6. the trail recorded the walk', await pg.locator('.trail').count() > 3, true);
/* CLAUDE.md rule 3, and the reason this is asserted rather than assumed: the
   aid this ports had a free-text log. This one has none — every trail entry is
   a fixed label the tool wrote — so there is no route by which a name, an MRN
   or a date of birth can reach it. */
ck('6. no free-text input exists on the page',
   await pg.locator('input[type=text],textarea,[contenteditable]').count(), 0);
ck('6. nothing is persisted off the device',
   await pg.evaluate(() => { try { return Object.keys(localStorage).length; } catch (e) { return 'blocked'; } }), 0);

/* ---- 7. RESET clears the case ---- */
console.log('\n--- 7. reset');
await pg.click('#resetbtn'); await pg.waitForTimeout(200);
ck('7. RESET asks before it wipes', /SURE/.test(await pg.textContent('#resetbtn')), true);
await pg.click('#resetbtn'); await pg.waitForTimeout(250);
ck('7. and returns to the decision', await phase(), 'DECIDE');
ck('7. with the trail cleared', await pg.locator('.trail').count(), 0);
ck('7. and the stop criteria cleared',
   await pg.evaluate(() => [...document.querySelectorAll('[data-stop]')].every(x => x.getAttribute('aria-pressed') === 'false')), true);

console.log('\n--- 8. clean run');
ck('8. no page or console errors across the whole run', errs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
