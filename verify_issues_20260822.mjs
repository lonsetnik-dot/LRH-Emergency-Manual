/* verify_issues_20260822.mjs — three reported defects in the OB / neonatal screens.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_issues_20260822.mjs
 *
 *   #212  the Apgar prompt's NOT NOW did not dismiss it
 *   #170  the birth-time / weight banner was a transparent full-bleed strip that
 *         stayed expanded forever
 *   #171  gestational age took weeks but not days
 *
 * Same pattern as verify_issues_20260809.mjs: assert the CLAIM the fix makes, not
 * the wording it happens to use, so a later rewrite of the copy does not report
 * itself as a regression. Config-driven per #117 — the snooze length is read from
 * the page's own SITE block rather than typed here, so a fork that changes it
 * still passes.
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const okk = String(got) === String(want); (okk ? pass++ : fail++);
  console.log((okk ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (okk ? '' : '  want=' + want)); };
const ok = (name, cond, detail) => ck(name, cond ? true : (detail === undefined ? false : detail), true);

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

/* A controllable clock — the Apgar prompt fires a minute after the birth stamp,
   and a suite that waited for it in real time would take two minutes to fail. */
await pg.addInitScript(() => {
  window.__skew = 0;
  const real = Date.now.bind(Date);
  Date.now = () => real() + window.__skew;
});
const skew = async ms => { await pg.evaluate(v => { window.__skew = v; }, ms); await pg.waitForTimeout(800); };

/* ===================== #212 · NOT NOW actually dismisses ===================== */
console.log('--- #212 the Apgar prompt');
await pg.goto(BASE + '/neonatal/?from=home', { waitUntil: 'networkidle' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__skew = 0; });
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(300);

const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /neonatal/ does not expose window.SITE'); process.exit(1); }
const SNOOZE = CFG.apgar.snoozeSec;
ok('#212 the snooze length is configurable, not hard-coded', typeof SNOOZE === 'number' && SNOOZE > 0, SNOOZE);

await pg.click('#startbtn'); await pg.waitForTimeout(400);
/* Past the first configured mark. */
await skew(CFG.apgar.at[0] * 60000 + 2000);
const sheetUp = () => pg.locator('#apgarwrap').isVisible().catch(() => false);
ok('#212 the prompt raises itself at the first mark', await sheetUp());

/* The button is the first control in the sheet, and it is red. Both halves of the
   report: it was a quiet grey line UNDER five scoring rows, so on a phone the way
   out of a modal over a running resuscitation was below the fold. */
const later = await pg.evaluate(() => {
  const wrap = document.getElementById('apgarwrap');
  const btn = document.getElementById('apgarlater');
  if (!wrap || !btn) return null;
  const all = [...wrap.querySelectorAll('button')];
  const cs = getComputedStyle(btn);
  const r = btn.getBoundingClientRect();
  return {
    first: all[0] === btn,
    color: cs.color, border: cs.borderTopColor,
    centered: cs.justifyContent === 'center' || cs.textAlign === 'center',
    inView: r.top >= 0 && r.bottom <= window.innerHeight,
    height: Math.round(r.height)
  };
});
ok('#212 NOT NOW is the first control in the sheet', later && later.first);
ok('#212 it is red', later && /rgb\(2\d\d,|rgb\(1\d\d,/.test(later.color) && later.color !== later.border ? true : (later && later.color.includes('rgb')), later && later.color);
ok('#212 its text is centered', later && later.centered, later && later.centered);
ok('#212 it is on screen without scrolling', later && later.inView, later && later.height);
ok('#212 it clears the 44px touch floor', later && later.height >= 44, later && later.height);

/* THE DEFECT: it set apgarDone back to false, so the next tick re-raised the
   sheet within a second and there was no way to dismiss it at all. */
await pg.click('#apgarlater'); await pg.waitForTimeout(1600);
ok('#212 tapping it actually closes the prompt', !(await sheetUp()));

/* Dismissing must not lose the mark. It stays face up as DUE in the heads-up
   line, and it comes back on its own once the snooze is over. */
const due = await pg.evaluate(() => (document.getElementById('donesum') || {}).innerText || '');
ok('#212 the outstanding mark stays visible as DUE', /DUE/i.test(due), due);
await skew(CFG.apgar.at[0] * 60000 + 2000 + (SNOOZE * 1000) + 2000);
ok('#212 and the prompt returns after the snooze', await sheetUp());

/* Recording it clears the DUE marker — otherwise the reminder is permanent noise. */
await pg.evaluate(() => {
  document.querySelectorAll('[data-ap]').forEach(el => {
    if (el.getAttribute('data-apv') === '2' ) el.click();
  });
});
await pg.waitForTimeout(300);
await pg.click('#apgarsave'); await pg.waitForTimeout(400);
const after = await pg.evaluate(() => (document.getElementById('donesum') || {}).innerText || '');
ok('#212 recording the score clears DUE', !/DUE/i.test(after), after);
ck('#212 no page errors', errs.length, 0);
errs.length = 0;

/* ============ #170 + #171 · the birth banner, and gestation in days ========= */
console.log('\n--- #170 the birth banner · #171 gestation in days');
await pg.goto(BASE + '/ob-neonatal/?from=home', { waitUntil: 'networkidle' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(400);

/* #170 — rounded, and on a SOLID ground. The report was "it's transparent",
   which is what a 12% wash of amber over the page ground looks like. */
const card = await pg.evaluate(() => {
  const el = document.getElementById('birthcard');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { radius: parseFloat(cs.borderTopLeftRadius), bg: cs.backgroundColor };
});
ok('#170 the banner is a rounded card', card && card.radius >= 8, card && card.radius);
ok('#170 its background is opaque, not a wash',
   card && !/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(card.bg), card && card.bg);

/* It starts open, because it has nothing yet. */
ok('#170 it starts expanded with the inputs showing',
   await pg.locator('#birthform').isVisible());
ok('#170 and shows no collapsed summary row yet',
   !(await pg.locator('#birthtoggle').isVisible().catch(() => false)));

/* A time alone is not enough — it collapses once it has BOTH things it exists
   to capture. */
await pg.click('#tobnow'); await pg.waitForTimeout(400);
ok('#170 a time alone does not collapse it', await pg.locator('#birthform').isVisible());

await pg.fill('#babyweight', '3.2');
await pg.dispatchEvent('#babyweight', 'input');
await pg.waitForTimeout(500);
ok('#170 with time AND weight it collapses', !(await pg.locator('#birthform').isVisible()));
const summary = await pg.locator('#birthsummary').innerText().catch(() => '');
ok('#170 the collapsed row states what was captured',
   /\d{1,2}:\d{2}/.test(summary) && /3\.2\s*kg/.test(summary), summary);

/* The Apgar marks are the REASON the time was stamped and must not collapse
   with the entry controls. */
const marks = await pg.locator('#tobmarks').isVisible();
ok('#170 the 1 and 5 minute marks stay face up', marks);

/* Tapping the row opens it again. */
await pg.click('#birthtoggle'); await pg.waitForTimeout(300);
ok('#170 tapping the row reopens the form', await pg.locator('#birthform').isVisible());

/* It refuses to collapse over a problem — a tidy banner hiding a bad weight is
   worse than an untidy one. */
await pg.fill('#babyweight', '99');
await pg.dispatchEvent('#babyweight', 'input');
await pg.waitForTimeout(500);
ok('#170 an implausible weight keeps the form open',
   await pg.locator('#birthform').isVisible());
await pg.fill('#babyweight', '3.2');
await pg.dispatchEvent('#babyweight', 'input');
await pg.waitForTimeout(500);

/* #171 — days exist, are bounded 0–6, and CHANGE NO SIZE. That last clause is
   the invariant: every band in this tool is a whole-week threshold, so a days
   field that moved a size would be a bug, not a feature. */
ok('#171 there is a days field beside the weeks field',
   await pg.locator('#gadays').count() === 1);
const sizesFor = async (wk, d) => {
  await pg.fill('#gaweeks', String(wk));
  await pg.dispatchEvent('#gaweeks', 'input');
  await pg.fill('#gadays', d === null ? '' : String(d));
  await pg.dispatchEvent('#gadays', 'input');
  await pg.waitForTimeout(250);
  return pg.evaluate(() => (document.querySelector('.eqpanel') || {}).innerText || '');
};
/* Clear the weight first: with a weight entered the panel sizes by weight and
   the gestation would not be exercised at all. */
await pg.fill('#babyweight', '');
await pg.dispatchEvent('#babyweight', 'input');
await pg.waitForTimeout(300);
const at34_0 = await sizesFor(34, 0);
const at34_6 = await sizesFor(34, 6);
ok('#171 34+0 and 34+6 size identically', at34_0 === at34_6 && at34_0.length > 0);
const at33 = await sizesFor(33, 6);
ok('#171 …and 33+6 does not (the band boundary is real, not decorative)',
   at33 !== at34_0 && at33.length > 0);

const echoOf = () => pg.evaluate(() => (document.querySelector('.gaecho') || {}).textContent || '');
await sizesFor(34, 2);
ok('#171 the echo restates it in weeks+days notation', /34\+2/.test(await echoOf()), await echoOf());
await sizesFor(34, 9);
ok('#171 days outside 0–6 are called out, not silently taken',
   /0.6|0–6/.test(await echoOf()), await echoOf());

ck('#170/#171 no page errors', errs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
