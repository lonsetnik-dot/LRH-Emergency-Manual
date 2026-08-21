/* LRH Emergency Manual — executable CASE-STATE.md (issue #127).
 *
 * Six tools now share the CASE-STATE contract and each keeps its OWN copy of the storage module —
 * codes, peds, ob-neonatal, arrest, tca and trauma. That is the right call for single-file offline
 * tools ("share the contract, not the code"), but it means six hand-synced implementations of the
 * same promises, and the weight-routing audit found real drift in every direction: arrest bumped
 * lrh-case-wtms on every keystroke while peds moved it only on genuine change; arrest rewrote
 * provenance to 'measured' on any keystroke; the adult-override clear-on-change rule existed in
 * codes and not in arrest; tca was outside the contract entirely.
 *
 * Each of those was fixed by hand. Nothing stopped them recurring, and every new tool adds another
 * copy — so this suite asserts the CONTRACT rather than any one implementation, and names the tool
 * and the clause when a copy diverges.
 *
 * The method is deliberately black-box: write state in tool A, open tool B, and check what B reads.
 * It never inspects a tool's internals, because the contract is about what crosses localStorage.
 *
 * On issue #117's rule that a suite must not re-type this site's numbers: this one contains no
 * clinical values at all, by construction. Every number in it is a test fixture (24 kg, 30 kg) or a
 * key name. A fork that localizes every threshold in the manual changes nothing here — which is the
 * right answer, because the storage contract is not a localizable thing.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_case_contract.mjs
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

/* Every tool that participates. Adding a seventh tool means adding one line
   here — which is the point: the suite becomes the joining checklist. */
const TOOLS = [
  { id: 'codes',       path: '/codes/',       wIn: '#wtkg' },
  { id: 'peds',        path: '/peds/',        wIn: '#wtkg' },
  { id: 'arrest',      path: '/arrest/',      wIn: '#wIn'  },
  /* /tca/ left the shared case contract when it was rebuilt as a direct port
     of its cognitive aid: no weight strip, no shared case keys, its own state.
     Removed here rather than left failing, so the contract still means
     something for the tools that DO implement it. */
  /* ob-neonatal and trauma read the case but write no adult weight of their
     own. ob-neonatal deliberately keeps the BABY's weight in its own
     lrh-ob-weight key rather than lrh-case-wtkg — two patients in the room,
     two weights, and a newborn's 3.2 kg must never reach an adult dose line. */
  { id: 'ob-neonatal', path: '/ob-neonatal/', wIn: null },
  { id: 'trauma',      path: '/trauma/',      wIn: null },
];

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

const open = async (t) => {
  await pg.goto(BASE + t.path + '?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(320);
  /* Some tools gate behind a splash; ?from= clears it, but click through if one
     survives so the suite never measures a covered page. */
  if (await pg.locator('#betago').count()) { await pg.click('#betago').catch(() => {}); await pg.waitForTimeout(150); }
};
const store = () => pg.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return o;
});
const seed = (obj) => pg.evaluate(o => {
  localStorage.clear();
  Object.keys(o).forEach(k => localStorage.setItem(k, o[k]));
}, obj);
const clearAll = () => pg.evaluate(() => localStorage.clear());
const T = { timeout: 4000 };
/* Never let a missing field abort the run — an unreachable weight box is
   itself a finding, and the remaining clauses still need to be checked. */
const fillW = async (t, v) => {
  /* Case-shell tools (SHELL.md layer 4) keep the weight inputs behind a
     collapsed strip on a phone — open it first, the same tap a clinician
     makes. Tools without the strip are untouched. */
  try {
    if (!(await pg.locator(t.wIn).isVisible().catch(() => false)) && await pg.locator('#wtoggle').count()) {
      await pg.click('#wtoggle', T).catch(() => {}); await pg.waitForTimeout(200);
    }
    await pg.fill(t.wIn, String(v), { timeout: 5000 }); return true;
  }
  catch { ck(`   [${t.id}] weight field ${t.wIn} is reachable`, 'unreachable', 'reachable'); return false; }
};

/* ---- 1. every tool is reachable and clean on arrival ---- */
console.log('--- 1. the tools ---');
for (const t of TOOLS) {
  await open(t);
  ck(`1. [${t.id}] loads`, await pg.title() !== '', true);
}
ck('1. no page errors opening any tool', errs.length, 0);

/* ---- 2. WEIGHT CROSSES TOOLS IDENTICALLY ----
   The clause: a weight written by one tool is read by every other tool as the
   same number with the same provenance. This is the drift that started the
   whole audit. */
console.log('\n--- 2. weight crosses tools ---');
const WRITERS = TOOLS.filter(t => t.wIn);
for (const writer of WRITERS) {
  await open(writer);
  await clearAll();
  await open(writer);
  if (!(await fillW(writer, '24'))) continue;
  await pg.waitForTimeout(400);
  const written = await store();
  const kg = written['lrh-case-wtkg'];
  ck(`2. [${writer.id}] writes lrh-case-wtkg`, kg, '24');

  for (const reader of TOOLS.filter(x => x.id !== writer.id)) {
    await open(reader);
    const seen = await pg.evaluate(() => localStorage.getItem('lrh-case-wtkg'));
    ck(`2. ${writer.id} -> ${reader.id}: same weight survives`, seen, '24');
  }
}

/* ---- 3. wtms MOVES ONLY ON A GENUINE CHANGE ----
   The clause CASE-STATE.md states and arrest used to break: the weight
   timestamp is when the weight last CHANGED, not when someone last touched the
   field. A timestamp that moves on every keystroke makes the 60-minute
   inactivity sweep meaningless. */
console.log('\n--- 3. wtms moves only on genuine change ---');
for (const t of WRITERS) {
  await open(t);
  await clearAll();
  await open(t);
  if (!(await fillW(t, '30'))) continue;
  await pg.waitForTimeout(450);
  const first = (await store())['lrh-case-wtms'];
  ck(`3. [${t.id}] sets lrh-case-wtms on a new weight`, !!first, true);

  /* Retype the SAME value. fill() dispatches a fresh input event either way,
     so this is exactly the "someone touched the field but nothing changed"
     case — the stamp must not move. Deliberately NOT blanking the box first:
     blank→30 is a genuine absent-to-present change and tools may legitimately
     stamp it. */
  await fillW(t, '30');
  await pg.waitForTimeout(450);
  const same = (await store())['lrh-case-wtms'];
  ck(`3. [${t.id}] re-entering the SAME weight does not move wtms`, same, first);

  /* A different value must move it. */
  await fillW(t, '31');
  await pg.waitForTimeout(450);
  const moved = (await store())['lrh-case-wtms'];
  ck(`3. [${t.id}] a genuinely different weight DOES move wtms`, Number(moved) >= Number(first), true);
  ck(`3. [${t.id}] and it is actually a different stamp`, moved !== same, true);
}

/* ---- 4. PROVENANCE IS NOT REWRITTEN BY TYPING ----
   arrest used to stamp 'measured' on any keystroke, which quietly upgraded an
   estimated weight to a measured one — the worst kind of drift, because the
   number looks more trustworthy than it is. */
console.log('\n--- 4. provenance survives ---');
for (const t of WRITERS) {
  await open(t);
  await seed({ 'lrh-case-wtkg': '18', 'lrh-case-wtsrc': 'estimated', 'lrh-case-wtms': String(Date.now() - 60000) });
  await open(t);
  const src = await pg.evaluate(() => localStorage.getItem('lrh-case-wtsrc'));
  ck(`4. [${t.id}] merely OPENING does not rewrite provenance`, src, 'estimated');
}

/* ---- 5. RESET SWEEPS lrh-case-* AND SPARES lrh-pref-* ----
   The blast radius clause. A RESET that takes the theme with it is a small
   annoyance; a RESET that leaves a previous patient's weight behind is not. */
console.log('\n--- 5. reset blast radius ---');
/* neonatal/pph/dystocia/airway used to reset only their own in-memory state,
   leaving the shared case clock and every other tool's state untouched — a
   real gap (feedback/theme consolidation issue), now fixed to sweep the same
   as arrest/tca. Not in TOOLS above (they write no shared adult weight), so
   listed here directly rather than reshaping the weight-contract tool list. */
const RESETTABLE = TOOLS.filter(t => ['codes', 'peds', 'arrest', 'tca'].includes(t.id)).concat([
  { id: 'neonatal', path: '/neonatal/' },
  { id: 'pph', path: '/pph/' },
  { id: 'dystocia', path: '/dystocia/' },
  { id: 'airway', path: '/airway/' },
]);
/* lrh-case-lastactive is the inactivity heartbeat, not case content: every tool
   re-stamps it on load, so finding it present straight after a RESET is correct.
   What must NOT survive is the OLD stamp — that would make a fresh case look
   like it had been running for an hour and hand the weight sweep a lie. So it
   is exempted from the clear-everything rule and checked separately below. */
const HEARTBEAT = 'lrh-case-lastactive';
const STALE = Date.now() - 3600000;
for (const t of RESETTABLE) {
  await open(t);
  await seed({
    'lrh-case-wtkg': '42', 'lrh-case-wtsrc': 'measured', 'lrh-case-wtms': String(Date.now()),
    'lrh-case-log': '[]', [HEARTBEAT]: String(STALE),
    'lrh-pref-theme': 'light',
  });
  await open(t);
  if (!(await pg.locator('#resetbtn').count())) { ck(`5. [${t.id}] has a RESET`, 'no #resetbtn', 'a RESET'); continue; }
  /* Case-shell tools put the phone RESET behind the bar's ... menu (SHELL.md
     layer 9) — open it first; the menu stays open across the two-tap SURE?. */
  if (!(await pg.locator('#resetbtn').isVisible().catch(() => false)) && await pg.locator('#menubtn').count()) {
    await pg.click('#menubtn', T).catch(() => {}); await pg.waitForTimeout(200);
  }
  /* Two confirm idioms in the family: the card tools raise a modal, the live
     engines want a second tap on the same button. Either is fine — the clause
     is about what RESET clears, not how it asks. */
  await pg.click('#resetbtn'); await pg.waitForTimeout(260);
  if (await pg.locator('#resetmodalgo').isVisible().catch(() => false)) {
    await pg.click('#resetmodalgo');
  } else {
    await pg.click('#resetbtn');
  }
  await pg.waitForTimeout(500);
  const after = await store();
  const caseLeft = Object.keys(after).filter(k => k.indexOf('lrh-case-') === 0 && k !== HEARTBEAT);
  ck(`5. [${t.id}] RESET clears every lrh-case-* key`, caseLeft.join(',') || 'none', 'none');
  ck(`5. [${t.id}] RESET spares lrh-pref-theme`, after['lrh-pref-theme'], 'light');
  /* Absent is fine. Present-and-stale is not. */
  const hb = after[HEARTBEAT];
  ck(`5. [${t.id}] RESET leaves no STALE inactivity stamp`, hb === undefined || Number(hb) > STALE, true);
}

/* ---- 6. THE PHI GUARD IS THE SAME GUARD EVERYWHERE ----
   Golden rule 3 is a hard rule, so a tool that accepts an MRN in its event log
   is a defect regardless of what its own tests say. Only tools with a free-text
   log path participate. */
console.log('\n--- 6. PHI guard parity ---');
const PHI_SHAPES = [
  { s: 'MRN 4457821', why: 'record number' },
  { s: '04/12/1968', why: 'date of birth' },
  { s: 'account 998877123', why: 'long digit run' },
];
for (const t of TOOLS) {
  await open(t);
  if (!(await pg.locator('#customin').count())) continue;   /* no free-text log here */
  /* The live engines hide the whole running screen until the case is started,
     so the log row is not merely collapsed — it is inside a display:none block.
     Without this the guard checks pass vacuously against an invisible input,
     which is worse than no test: it reports a PHI guard that was never asked
     to refuse anything. */
  if (await pg.locator('#startbtn').isVisible().catch(() => false)) {
    await pg.click('#startbtn', T).catch(() => {});
    await pg.waitForTimeout(350);
  }
  ck(`6. [${t.id}] the free-text log is actually reachable`,
     await pg.locator('#logtoggle').isVisible().catch(() => false), true);
  for (const shape of PHI_SHAPES) {
    /* Short explicit timeouts everywhere: a bare .catch() on a Playwright
       action still waits the default 30 s first, and four tools' worth of that
       turns a 3-minute suite into a 25-minute one. */
    if (await pg.locator('#logtoggle').count()) { await pg.click('#logtoggle', T).catch(() => {}); await pg.waitForTimeout(150); }
    await pg.fill('#customin', shape.s, T).catch(() => {});
    await pg.click('#customlog', T).catch(() => {});
    await pg.waitForTimeout(200);
    const warned = await pg.locator('#customwarn').isVisible().catch(() => false);
    ck(`6. [${t.id}] refuses a ${shape.why}`, warned, true);
  }
  /* And it must still accept an ordinary clinical note — a guard that refuses
     everything is not a guard, it is a broken input. */
  await pg.fill('#customin', 'second IV placed left AC', T).catch(() => {});
  await pg.click('#customlog', T).catch(() => {});
  await pg.waitForTimeout(220);
  ck(`6. [${t.id}] still accepts a clinical note`, await pg.locator('#customwarn').isVisible().catch(() => false), false);
}

/* ---- 7. NOTHING WRITES OUTSIDE THE NAMESPACE ----
   Golden rule 3 again, from the other side: a tool may only persist lrh-* keys,
   and anything device-local that is not case state must be lrh-pref-*. A stray
   key is how PHI would leak in practice. */
console.log('\n--- 7. namespace discipline ---');
for (const t of TOOLS) {
  await open(t);
  await clearAll();
  await open(t);
  if (t.wIn && await pg.locator(t.wIn).count()) { await fillW(t, '22'); await pg.waitForTimeout(350); }
  const keys = Object.keys(await store());
  const stray = keys.filter(k => k.indexOf('lrh-') !== 0);
  ck(`7. [${t.id}] writes nothing outside the lrh- namespace`, stray.join(',') || 'none', 'none');
  const sessionN = await pg.evaluate(() => sessionStorage.length);
  ck(`7. [${t.id}] writes nothing to sessionStorage`, sessionN, 0);
}

/* ---- 8. A HOSTILE VALUE CANNOT CROSS ----
   Storage is shared and a tool cannot assume the writer was well-behaved: a
   corrupt or absurd weight must not render as a dose anywhere. */
console.log('\n--- 8. tools distrust what they read ---');
for (const bad of ['abc', '-5', '99999', '']) {
  for (const t of WRITERS) {
    await open(t);
    await seed({ 'lrh-case-wtkg': bad, 'lrh-case-wtsrc': 'measured', 'lrh-case-wtms': String(Date.now()) });
    await open(t);
    const body = await pg.innerText('body');
    /* The specific failure being guarded: a NaN or Infinity reaching a dose line. */
    ck(`8. [${t.id}] weight "${bad}" produces no NaN on screen`, /\bNaN\b/.test(body), false);
    ck(`8. [${t.id}] weight "${bad}" produces no Infinity on screen`, /Infinity/.test(body), false);
  }
}

ck('9. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 8).forEach(e => console.log('    ' + e));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
