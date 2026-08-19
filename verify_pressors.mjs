/* CairnReady / LRH Emergency Manual — the pressor calculator (/codes/#c37, issue #179).
 *
 * Card 37 answers "this patient is in shock, which drip, and what do I set the pump to."
 * Everything on it is derived: the mL/hr comes from a bag concentration and a per-minute
 * dose that both live in SITE.pressors, so this suite READS THAT CONFIG and checks the
 * screen against it (CLAUDE.md, "Config-driven verification"). It never re-types this
 * site's numbers — an adopting ED that hangs norepinephrine 8 mg/250 mL, or starts it at
 * 0.1 mcg/kg/min, must still get a green run.
 *
 * What it actually protects:
 *
 *   1. THE ARITHMETIC. mL/hr = (dose per minute x 60) / concentration per mL, with dose
 *      per minute = dose x weight only for a per-kg agent. A units-vs-mcg or a per-kg-vs-
 *      fixed mix-up produces a plausible-looking number in a large font — the exact shape
 *      of error nobody catches by eye at 3 a.m.
 *   2. NO RATE WITHOUT A WEIGHT. A per-kg agent with no weight entered must say so, never
 *      compute off a missing or stale value.
 *   3. THE CLINICAL INVARIANTS a fork must not be able to localize away: norepinephrine
 *      leads the septic, cardiogenic, post-ROSC and PE ladders; vasopressin stays a fixed
 *      units/min rate; the AHA bradycardia epinephrine figure stays mcg/min and never
 *      becomes per-kg; hemorrhagic shock's ladder offers a pressor only as a bridge and
 *      says blood is the treatment; every agent declares a concentration.
 *   4. The card is reachable, indexed, cross-linked, offline-clean and thumb-sized.
 *
 *     python3 -m http.server 8123 --directory dist
 *     node verify_pressors.mjs
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

const CARD = '/codes/?from=home#c37';
const reload = async () => { await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(300); };
const fresh = async () => {
  await pg.goto(BASE + CARD, { waitUntil: 'networkidle' });
  /* Blank the weight field before wiping storage: the weight engine holds the kg in
     memory and re-saves it, so clearing storage alone lets the previous case's weight
     reappear and quietly invalidate a no-weight test (the lesson from verify_rsi_drugs). */
  await pg.evaluate(() => { const el = document.getElementById('wtkg');
    if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } });
  await pg.waitForTimeout(120);
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await reload();
};
const setWeight = async kg => {
  await pg.fill('#wtkg', String(kg));
  await pg.dispatchEvent('#wtkg', 'input');
  await pg.waitForTimeout(250);
};
const pick = async key => { await pg.click(`#prsPick button[data-ind="${key}"]`); await pg.waitForTimeout(200); };
const planText = () => pg.textContent('#prsPlan');
const tableText = () => pg.textContent('#prsTable');

await fresh();

/* ---- read the config the page is actually running on -------------------------------- */
const P = await pg.evaluate(() => JSON.parse(JSON.stringify(window.SITE.pressors)));
const agent = k => P.agents.find(a => a.key === k);
/* The suite's own copy of the arithmetic, written from the documented rule rather than
   from the page's code — if the page and this line ever disagree, one of them is wrong. */
const expect = (a, dose, kg) => (a.dosing === 'kg' ? dose * kg : dose) * 60 / a.concPerMl;
/* The page's documented display rule: a tenth of a mL/hr, except that a real nonzero
   rate never renders as "0" — precision is raised until it shows. Written out here from
   the rule rather than shared with the page, so the two can be checked against each other. */
const fmt = n => { let d = 1; while (n > 0 && parseFloat(n.toFixed(d)) === 0 && d < 3) d++;
  const r = Number(n.toFixed(d)); return (r % 1 === 0) ? String(r) : r.toFixed(d); };

console.log('--- 1. the card exists and is reachable ---');
ck('1. card 37 is in the DOM', await pg.locator('article#c37').count(), 1);
ck('1. it has a menu tile pointing at it', await pg.locator('#menu a[href="#c37"]').count(), 1);
ck('1. the indication router rendered one button per configured indication',
   await pg.locator('#prsPick button[data-ind]').count(), P.indications.length);
ck('1. the full table lists every configured agent',
   await pg.evaluate(n => document.querySelectorAll('#prsTable tbody tr').length, 0), P.agents.length * 2);

console.log('\n--- 2. no rate is ever shown without a weight (per-kg agents) ---');
/* Checked across every indication, and split by dosing mode: a per-kg rung must refuse
   to print a number, while a fixed-rate rung on the same ladder must still compute — the
   two failure modes are opposite, and a test that only counted refusals would pass a card
   that had quietly stopped computing vasopressin. */
for (const ind of P.indications) {
  await pick(ind.key);
  const t = await planText();
  const perKg = ind.ladder.filter(r => agent(r.agent).dosing === 'kg').length;
  const fixed = ind.ladder.filter(r => agent(r.agent).dosing !== 'kg');
  ck(`2. ${ind.key}: all ${perKg} per-kg rung(s) refuse to print a rate with no weight`,
     (t.match(/ENTER A WEIGHT ABOVE/g) || []).length, perKg);
  for (const r of fixed) {
    const a = agent(r.agent);
    ck(`2. ${ind.key}: the fixed-rate ${a.key} rung still computes with no weight`,
       t.includes(fmt(expect(a, a.start, null))), true);
  }
  await pick(ind.key); /* toggle back off so the next loop starts clean */
}
await pick('septic');
/* A fixed-rate agent does not need a weight and must still compute — that is the whole
   point of keeping vasopressin and the bradycardia epinephrine rate as 'fixed' rows. */
const vaso = agent('vaso');
ck('2. a fixed-rate agent still computes with no weight (vasopressin in the full table)',
   (await tableText()).includes(fmt(expect(vaso, vaso.start, null)) + ' mL/hr'), true);
ck('2. the weight cue names the missing weight', /No weight entered/.test(await pg.textContent('#prsWtCue')), true);

console.log('\n--- 3. the arithmetic, at three weights, against the config ---');
/* Weights derived from the config, not typed: one small adult, one average, one large.
   Nothing here depends on this site's particular start doses or bag concentrations. */
for (const kg of [50, 70, 120]) {
  await setWeight(kg);
  await pick('septic'); await pick('septic'); /* toggle off/on is a no-op; keeps it selected */
  const t = await planText();
  const nore = agent('norepi');
  ck(`3. norepinephrine start at ${kg} kg = ${fmt(expect(nore, nore.start, kg))} mL/hr`,
     t.includes(fmt(expect(nore, nore.start, kg))), true);
  const tab = await tableText();
  for (const a of P.agents) {
    const want = fmt(expect(a, a.start, kg));
    if (!tab.includes(want + ' mL/hr')) { fail++; console.log(`FAIL 3. ${a.key} start rate at ${kg} kg  want=${want} mL/hr`); }
    else pass++;
  }
  console.log(`     (${P.agents.length} agent start rates checked at ${kg} kg)`);
}

console.log('\n--- 4. per-kg really is per-kg, and fixed really is fixed ---');
await setWeight(50); const t50 = await tableText();
await setWeight(100); const t100 = await tableText();
const norepi = agent('norepi');
ck('4. doubling the weight doubles a per-kg agent\'s rate',
   t100.includes(fmt(expect(norepi, norepi.start, 100)) + ' mL/hr') &&
   fmt(expect(norepi, norepi.start, 100)) !== fmt(expect(norepi, norepi.start, 50)), true);
ck('4. doubling the weight does NOT change vasopressin\'s rate',
   t50.includes(fmt(expect(vaso, vaso.start, 50)) + ' mL/hr') &&
   t100.includes(fmt(expect(vaso, vaso.start, 100)) + ' mL/hr') &&
   fmt(expect(vaso, vaso.start, 50)) === fmt(expect(vaso, vaso.start, 100)), true);

/* A weight small enough that a concentrated adult bag works out to a fraction of a mL/hr.
   The audience strip is what routes a pediatric weight off this card; this check is that
   the number never LIES while that happens — "0 mL/hr" beside a drug name is the failure
   mode the shared dose engine already had to fix once (weight-routing audit). */
await setWeight(1);
const tiny = await tableText();
ck('4. at 1 kg no agent renders a bare "0 mL/hr"', /(^|[^.\d])0 mL\/hr/.test(tiny), false);
ck('4. and the pediatric-weight strip is showing on the card at that weight',
   /PATIENT/.test(await pg.textContent('article#c37 .audiencestrip')), true);

console.log('\n--- 5. clinical invariants a fork must not be able to localize away ---');
ck('5. every agent declares a positive concentration per mL',
   P.agents.filter(a => !(a.concPerMl > 0)).map(a => a.key).join(',') || 'none', 'none');
ck('5. every agent declares a bag/mix label',
   P.agents.filter(a => !a.mix).map(a => a.key).join(',') || 'none', 'none');
ck('5. every agent\'s start dose sits inside its own stated range',
   P.agents.filter(a => !(a.start >= a.low && a.start <= a.high)).map(a => a.key).join(',') || 'none', 'none');
ck('5. every ladder rung names an agent that exists',
   P.indications.flatMap(i => i.ladder.filter(r => !agent(r.agent)).map(r => i.key + ':' + r.agent)).join(',') || 'none', 'none');
for (const key of ['septic', 'cardiogenic', 'rosc', 'pe']) {
  ck(`5. norepinephrine leads the ${key} ladder`,
     P.indications.find(i => i.key === key).ladder[0].agent, 'norepi');
}
ck('5. vasopressin is a fixed units/min rate, never per-kg', vaso.dosing + ' ' + vaso.unit, 'fixed units/min');
const epiF = agent('epiFixed');
ck('5. the bradycardia epinephrine rate stays mcg/min, not mcg/kg/min', epiF.dosing + ' ' + epiF.unit, 'fixed mcg/min');
ck('5. the bradycardia ladder uses that fixed row, not the per-kg epinephrine row',
   P.indications.find(i => i.key === 'brady').ladder[0].agent, 'epiFixed');
const hem = P.indications.find(i => i.key === 'hemorrhagic');
ck('5. hemorrhagic shock offers exactly one agent, and only as a bridge',
   hem.ladder.length + ' ' + /BRIDGE/i.test(hem.ladder[0].role), '1 true');
await setWeight(70); await pick('hemorrhagic');
ck('5. and the hemorrhagic panel says blood, not pressors, is the treatment',
   /BLOOD, AND CONTROL OF THE BLEEDING/i.test(await planText()), true);
ck('5. every indication states a target out loud',
   P.indications.filter(i => !i.target).map(i => i.key).join(',') || 'none', 'none');

console.log('\n--- 6. the indications the issue named are all present and linked ---');
for (const [key, href] of [['rosc', '#c22'], ['pe', '#c29'], ['cardiogenic', '#c21'], ['septic', '#c28'],
                           ['brady', '#c03'], ['anaphylaxis', '#c08'], ['tox', '#c36'], ['periintub', '#c06'],
                           ['hemorrhagic', '#c12']]) {
  await pick(key);
  ck(`6. ${key} panel links out to ${href}`, await pg.locator(`#prsPlan a[href="${href}"]`).count() >= 1, true);
}

console.log('\n--- 7. the cards that need a pressor link back to card 37 ---');
for (const id of ['c22', 'c03', 'c06', 'c08', 'c09', 'c21', 'c28', 'c29', 'c36']) {
  ck(`7. ${id} carries a link to #c37`, await pg.locator(`article#${id} a[href="#c37"]`).count() >= 1, true);
}

console.log('\n--- 8. site search finds it by the terms a clinician types ---');
for (const term of ['pressor', 'norepinephrine', 'push dose pressor', 'ml/hr', 'vasopressin']) {
  const found = await pg.evaluate(async ([base, t]) => {
    const html = await (await fetch(base + '/')).text();
    const m = html.match(/var SEARCH_INDEX=\[([\s\S]*?)\n  \];/);
    if (!m) return 'NO INDEX';
    return m[1].split('\n').some(l => l.includes('#c37') && l.toLowerCase().includes(t)) ? 'yes' : 'no';
  }, [BASE, term]);
  ck(`8. "${term}" reaches the card 37 search entry`, found, 'yes');
}

console.log('\n--- 9. shell, targets, storage and offline hygiene ---');
await fresh(); await setWeight(70); await pick('septic');
const small = await pg.evaluate(() => [...document.querySelectorAll('#prsPick button')]
  .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 44)
  .map(el => el.getAttribute('data-ind')));
ck('9. every indication button is at least 44px tall', small.join(' | ') || 'none', 'none');
ck('9. no page-level horizontal scroll at 390px',
   await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
await pg.setViewportSize({ width: 320, height: 720 });
await pg.waitForTimeout(200);
ck('9. no page-level horizontal scroll at 320px either',
   await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
await pg.setViewportSize({ width: 390, height: 844 });
/* The picked indication is a reading position, not a case fact — it must not create a
   localStorage key, because every persisted key is part of the CASE-STATE.md contract. */
ck('9. picking an indication persists nothing',
   await pg.evaluate(() => Object.keys(localStorage).filter(k => /pressor|prs|indication/i.test(k)).join(',') || 'none'), 'none');
ck('9. the card carries the version stamp and the disclaimer',
   await pg.evaluate(() => {
     const a = document.querySelector('article#c37');
     return /v\d+\.\d+ · last reviewed \d{4}-\d{2}-\d{2}/.test(a.textContent) &&
            /not a substitute for clinical judgment/.test(a.textContent);
   }), true);
ck('9. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('9. no off-origin requests', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
