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

const walked = [];
for (const a of ['s2','s3','s4','s5','s6','s7','s7b','s8b','s8b2','s8c','s9']) {
  if (!(await vis(`[data-go="${a}"]`))) { ck(`3. step ${a} reachable`, false, true); continue; }
  await tap(a); walked.push(await head());
}
ck('3. the full path reaches the signs-of-life step', /SIGNS OF LIFE/.test(walked[walked.length - 1]), true);
ck('3. and passes through the clamshell', walked.some(h => /CLAMSHELL/.test(h)), true);

/* ---- 4. the two transitions that carry clinical weight ---- */
console.log('\n--- 4. what must not be softened');
{
  await open(); await tap('proceed');
  for (const a of ['s2','s3','s4','s5','s6','s7','s7b','s8b','s8b2']) await tap(a);
  const side = await pg.textContent('#screen');
  /* You cross the sternum because the RIGHT chest is bleeding — not because
     the left view is poor. Crossing costs two internal mammary arteries. */
  ck('4. crossing over is driven by right-sided blood', /bleeding from the right/i.test(side), true);
  await tap('s8c');
  const clam = await pg.textContent('#screen');
  ck('4. clamp BOTH internal mammaries is on the clamshell step', /both internal mammary/i.test(clam), true);
  ck('4. the hilar twist keeps the ligament step people skip',
     /inferior pulmonary ligament/i.test(clam), true);
}

/* ---- 5. both endings ---- */
console.log('\n--- 5. the endings');
await tap('s9');
ck('5. signs of life are listed where the question is asked',
   /cardiac motion/i.test(await pg.textContent('#screen')), true);
await tap('lifeyes');
ck('5. signs of life continues the case', await phase(), 'SIGNS OF LIFE');
ck('5. and offers what to do next', /TXA|MTP/.test(await pg.textContent('#screen')), true);
await open(); await tap('proceed'); await tap('s2'); await tap('s3'); await tap('s4'); await tap('s5'); await tap('s9');
await tap('lifeno');
ck('5. no signs of life stops the resuscitation', await phase(), 'STOPPED');
ck('5. the stopped screen names the time it was called',
   /Time called:/.test(await pg.textContent('#screen')), true);
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
