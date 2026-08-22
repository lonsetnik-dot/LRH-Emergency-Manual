/* verify_backnav.mjs — interlinking is only safe if BACK always works.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_backnav.mjs
 *
 * The manual deliberately cross-links a lot: a card points at the procedure it
 * needs, the engine points at the sizes, the sizes point back at the engine.
 * That is only an improvement if a clinician who follows a link mid-code can
 * get back in one tap. Two ways back must BOTH hold:
 *
 *   1. The browser's own Back button returns to the exact page and card.
 *   2. The in-page back control honors ?from=<tool>, so it names where you
 *      came from rather than dumping you at the manual index.
 *
 * A link that strands the reader is worse than no link, so this suite walks
 * real cross-tool links and comes back from each one.
 */

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = process.env.BASE || 'http://localhost:8123';
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let pass = 0, fail = 0;
const ck = (n, got, want) => { const o = String(got) === String(want); (o ? pass++ : fail++);
  console.log((o ? 'PASS ' : 'FAIL ') + n + '  got=' + got + (o ? '' : '  want=' + want)); };
const ok = (n, c, d) => ck(n, c ? true : (d === undefined ? false : d), true);

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 900 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
const path = () => new URL(pg.url()).pathname;

/* Every cross-tool journey the manual now offers from a card body. */
const JOURNEYS = [
  { from: '/peds/',      link: 'a[href*="../neonatal/"]',              to: '/neonatal/' },
  { from: '/peds/',      link: 'a[href*="../airway/"]',                to: '/airway/'   },
  { from: '/trauma/',    link: 'a[href*="../peds/"]',                  to: '/peds/'     },
  { from: '/codes/',     link: 'a[href*="../peds/"]',                  to: '/peds/'     },
  { from: '/arrest/',    link: '#airchip',                             to: '/peds/'     },
  { from: '/trauma/',    link: 'a[href*="procedures/"]',               to: '/procedures/' },
];

console.log('--- 1. the browser Back button always returns ---');
for (const j of JOURNEYS) {
  await pg.goto(BASE + j.from + '?from=home', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => { try { localStorage.setItem('lrh-case-wtkg', '19'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pg.waitForTimeout(400);
  /* Take the first VISIBLE match: several of these selectors also match links
     inside retired/hidden blocks, and .first() would otherwise pick one the
     clinician can never tap. */
  const all = pg.locator(j.link);
  const n = await all.count();
  let el = null;
  for (let i = 0; i < n; i++) {
    const c = all.nth(i);
    await c.scrollIntoViewIfNeeded().catch(() => {});
    if (await c.isVisible().catch(() => false)) { el = c; break; }
  }
  if (!el) { console.log(`     [${j.from} → ${j.to}] no visible link of ${n} match(es) — skipped`); continue; }
  await el.click();
  await pg.waitForTimeout(700);
  ok(`1. ${j.from} → ${j.to} arrives`, path().startsWith(j.to), path());
  await pg.goBack({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(500);
  ok(`1. …and Back returns to ${j.from}`, path().startsWith(j.from), path());
}

console.log('\n--- 2. the in-page back control names where you came from ---');
/* The shell tools rewrite their back control from ?from=<tool>. A reader who
   hopped mid-code should be offered the tool they left, not the index. */
/* /codes/ joined this list when it took the shell bar (issue #219). It is the
   one that matters most: 38 cards, and the tool a clinician is likeliest to
   arrive at mid-case from somewhere else. */
for (const [from, tool] of [['arrest', '/peds/'], ['trauma', '/peds/'], ['codes', '/peds/'],
                            ['peds', '/neonatal/'], ['peds', '/codes/'], ['arrest', '/codes/']]) {
  await pg.goto(BASE + tool + '?from=' + from, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(450);
  const back = await pg.evaluate(() => {
    const a = document.getElementById('backlink') || document.querySelector('.shellback');
    const w = document.getElementById('backlinkwide');
    return a ? { href: a.getAttribute('href'), wide: w ? w.textContent.trim() : null } : null;
  });
  if (!back) { console.log(`     [${tool} ?from=${from}] no shell back control — skipped`); continue; }
  ck(`2. ${tool} entered from ${from}: back points at ../${from}/`, back.href, `../${from}/?from=tool`);
  if (back.wide !== null) ok(`2. …and the wide breadcrumb says ${from.toUpperCase()}`, new RegExp(from, 'i').test(back.wide), back.wide);
}

console.log('\n--- 3. a deep link still lands on the card, then Back leaves cleanly ---');
await pg.goto(BASE + '/peds/?from=arrest#p16', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => {
  const e = document.getElementById('p16'); if (!e) return false;
  const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0;
}, null, { timeout: 8000 }).catch(() => {});
ok('3. peds/#p16 deep link lands with the card in view', await pg.evaluate(() => {
  const r = document.getElementById('p16').getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0;
}));
ck('3. no splash is covering it', await pg.evaluate(() => !!document.getElementById('betasplash')), false);

/* ---- the beta gate must not stand between an engine and a card (issue #211) ----
   Every card tool shows a one-time 'not for clinical use' splash. Arriving from inside the
   manual is supposed to skip it, because the reader already accepted it wherever they came in.
   Ten tools spelled that rule nine different ways — from=home, from=tool, from=(home|tool), an
   exact params.get — so a link out of a live engine (?from=tca) put a CONSENT SCREEN in front
   of a clinician mid-code, over the card they had just tapped for.

   Asserted both directions: any ?from= skips it, and a cold arrival still shows it. Without
   the second half the rule could be satisfied by deleting the gate. */
console.log('\n--- the beta gate');
const GATED = ['/', '/procedures/', '/codes/', '/ob-neonatal/', '/trauma/',
               '/conversations/', '/vems/', '/simulations/', '/posters/', '/peds/'];
const splashVisible = async () => pg.evaluate(() => {
  const el = document.getElementById('betasplash');
  return !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
});
for (const t of GATED) {
  /* ?from=tca is a real link out of a real engine, and it is the one that used to be blocked. */
  await pg.goto(BASE + t + '?from=tca', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(220);
  ck('gate: ' + t + ' lets an engine link straight through', await splashVisible(), false);
}
for (const t of GATED) {
  await pg.goto(BASE + t, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(220);
  ck('gate: ' + t + ' still shows it on a cold arrival', await splashVisible(), true);
}

/* ---- search has to match what a clinician types (issue #174) ----
   Read from the page's own alias table rather than a second list here, but the INVARIANT is
   written out: a multi-word query must not depend on word order, and an abbreviation must
   reach the thing it abbreviates. */
console.log('\n--- search');
await pg.goto(BASE + '/?from=tool', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(250);
const results = async (t) => pg.evaluate((term) => {
  const el = document.getElementById('q');
  el.value = term; el.dispatchEvent(new Event('input', { bubbles: true }));
  const links = [...document.querySelectorAll('a')].filter(a => a.closest('#results,#searchresults,.results,[role=listbox]'));
  return { n: links.length, top: (links[0] || {}).textContent || '' };
}, t);
ck('search: two words in either order find the same card',
   (await results('chest tube')).n > 0 && (await results('tube chest')).n > 0, true);
ck('search: an abbreviation reaches what it abbreviates (peds dka)',
   /Pediatric Diabetic Ketoacidosis/i.test((await results('peds dka')).top), true);
ck('search: and ranks the abbreviated word into the title (peds)',
   /Pediatric/i.test((await results('peds')).top), true);
ck('search: tq finds the tourniquet card', /Tourniquet/i.test((await results('tq')).top), true);
ck('search: cric finds front of neck access', /Front of Neck/i.test((await results('cric')).top), true);
/* A short alias must not match inside a longer word, or the list stops being worth reading. */
ck('search: a nonsense query still finds nothing', (await results('zzqq')).n, 0);
ck('zero console/page errors while navigating', errs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
