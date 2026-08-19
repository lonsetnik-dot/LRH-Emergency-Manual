/* verify_logit.mjs — critical steps are loggable, look like controls, and
 * actually timestamp.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_logit.mjs
 *
 * Three properties, in the order they matter clinically:
 *
 *   1. THE TIME IS REALLY RECORDED. A tap writes {tMs, tool, card, label} to
 *      the shared lrh-case-log, the entry survives a reload, and it shows up
 *      in ANOTHER tool's CASE TIMELINE. A button that looks like it recorded
 *      something but didn't is worse than no button.
 *   2. IT LOOKS LIKE A CONTROL, NOT PROSE. Round, bordered, never underlined —
 *      the DESIGN-SYSTEM.md §7 idiom: a pill records, underlined text
 *      navigates, and they never share a shape.
 *   3. THE LABELS ARE CANONICAL AND PHI-FREE. The same act uses one string
 *      everywhere (or the merged timeline shows it twice under two names), and
 *      no label can carry a weight or a 6+ digit run.
 */

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = process.env.BASE || 'http://localhost:8123';
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let pass = 0, fail = 0;
const ck = (n, got, want) => { const o = String(got) === String(want); (o ? pass++ : fail++);
  console.log((o ? 'PASS ' : 'FAIL ') + n + '  got=' + got + (o ? '' : '  want=' + want)); };
const ok = (n, c, d) => ck(n, c ? true : (d || false), true);

const errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

const openAll = () => pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));

/* The steps the user named, plus the ones an after-action review asks for. */
const MUST_LOG = {
  '/procedures/': ['LATERAL CANTHOTOMY CUT', 'PERICARDIUM OPENED', 'AORTA CROSS-CLAMPED',
                   'TOURNIQUET APPLIED', 'FINGER THORACOSTOMY DONE', 'BURR HOLE OPENED'],
  '/trauma/':     ['BLOOD STARTED', 'TXA GIVEN', 'TOURNIQUET APPLIED', 'MCI DECLARED',
                   'HERNIATION RECOGNIZED', 'PELVIC BINDER APPLIED']
};

for (const [path, labels] of Object.entries(MUST_LOG)) {
  console.log('\n--- ' + path + ' ---');
  await pg.goto(BASE + path + '?from=home', { waitUntil: 'networkidle' });
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await pg.reload({ waitUntil: 'networkidle' });
  await openAll(); await pg.waitForTimeout(300);

  for (const label of labels) {
    const sel = `[data-logevent="${label}"]`;
    const n = await pg.locator(sel).count();
    ok(`${path} has a control for "${label}"`, n > 0);
    if (!n) continue;
    const el = pg.locator(sel).first();

    /* 2. shape: a control, not prose */
    const look = await el.evaluate(e => {
      const c = getComputedStyle(e);
      return { tag: e.tagName, radius: parseFloat(c.borderRadius), border: c.borderStyle,
               underlined: /underline/.test(c.textDecorationLine),
               h: Math.round(e.getBoundingClientRect().height) };
    });
    ck(`   "${label}" is a <button>, not a link`, look.tag, 'BUTTON');
    ok(`   "${label}" is rounded and bordered`, look.radius >= 8 && look.border === 'solid');
    ok(`   "${label}" is NOT underlined (underline means navigate)`, !look.underlined);
    ok(`   "${label}" clears the 36px touch floor`, look.h >= 36, look.h);
  }

  /* 1. the time is really recorded */
  const first = labels[0];
  await pg.locator(`[data-logevent="${first}"]`).first().scrollIntoViewIfNeeded();
  const before = Date.now();
  await pg.locator(`[data-logevent="${first}"]`).first().click();
  await pg.waitForTimeout(200);
  const entry = await pg.evaluate(l => {
    const log = JSON.parse(localStorage.getItem('lrh-case-log') || '[]');
    return log.filter(e => e.label === l).pop() || null;
  }, first);
  ok(`   tapping "${first}" writes a log entry`, !!entry);
  ok(`   the entry carries a real timestamp`, entry && entry.tMs >= before - 2000 && entry.tMs <= Date.now() + 2000,
     entry && entry.tMs);
  ok(`   the entry names the tool`, entry && !!entry.tool, entry && entry.tool);
  ok(`   the button shows the time it recorded`,
     /\d{1,2}:\d{2}/.test(await pg.locator(`[data-logevent="${first}"]`).first().textContent()));

  /* it must survive a reload — a recorded event that looks unrecorded is a lie */
  await pg.reload({ waitUntil: 'networkidle' });
  await openAll(); await pg.waitForTimeout(400);
  ok(`   the stamp is restored after a reload`,
     /\d{1,2}:\d{2}/.test(await pg.locator(`[data-logevent="${first}"]`).first().textContent()));
}

/* 1c. cross-tool: the whole point of a shared log.
   Re-log one procedures event first — the per-tool loop above clears
   localStorage on entry, so by now only the last tool's entry survives. */
console.log('\n--- the shared timeline sees them ---');
await pg.goto(BASE + '/procedures/?from=home', { waitUntil: 'networkidle' });
await openAll(); await pg.waitForTimeout(300);
await pg.locator('[data-logevent="LATERAL CANTHOTOMY CUT"]').first().scrollIntoViewIfNeeded();
await pg.locator('[data-logevent="LATERAL CANTHOTOMY CUT"]').first().click();
await pg.waitForTimeout(200);
await pg.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
await pg.click('#summarybtn'); await pg.waitForTimeout(400);
const tl = await pg.evaluate(() => document.getElementById('summarybody').innerText);
ok('a procedures event appears in codes\' CASE TIMELINE', /LATERAL CANTHOTOMY CUT/.test(tl));
ok('a trauma event appears in codes\' CASE TIMELINE', /BLOOD STARTED/.test(tl));
ok('the timeline shows a time for them', /\d{1,2}:\d{2}/.test(tl));
ok('the timeline tags the source tool', /PROCEDURES|TRAUMA/.test(tl));

/* 3. canonical + PHI-safe labels */
console.log('\n--- labels ---');
const allLabels = {};
for (const path of ['/procedures/', '/trauma/', '/codes/', '/peds/', '/ob-neonatal/']) {
  await pg.goto(BASE + path + '?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(200);
  const ls = await pg.evaluate(() => [...document.querySelectorAll('[data-logevent]')].map(e => e.getAttribute('data-logevent')));
  allLabels[path] = ls;
}
const flat = Object.values(allLabels).flat();
ok('every label is PHI-safe (no weight, no 6+ digit run)',
   !flat.some(l => /\d{1,3}(\.\d+)?\s*(kg|lb)\b/i.test(l) || /\d{6,}/.test(l)),
   flat.filter(l => /\d{1,3}(\.\d+)?\s*(kg|lb)\b/i.test(l) || /\d{6,}/.test(l)).join('|'));
/* the same act, one string: tourniquet is logged in two tools and must match */
const tq = Object.entries(allLabels).filter(([, ls]) => ls.some(l => /TOURNIQUET/.test(l)));
const tqStrings = [...new Set(tq.flatMap(([, ls]) => ls.filter(l => /TOURNIQUET/.test(l))))];
ck('tourniquet uses ONE canonical label across tools', tqStrings.join(' | '), 'TOURNIQUET APPLIED');

/* the PHI trap: the "log the names" step must have no button */
await pg.goto(BASE + '/trauma/?from=home', { waitUntil: 'networkidle' });
await openAll(); await pg.waitForTimeout(300);
ok('the "log the names" staff-exposure step has NO log button (it would capture names)',
   await pg.evaluate(() => {
     const li = [...document.querySelectorAll('li')].find(x => /Log the names/i.test(x.textContent));
     return !li || !li.querySelector('[data-logevent]');
   }));

ck('zero console/page errors', errs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
