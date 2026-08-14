/* LRH Emergency Manual — one idiom per action (issue #71).
 *
 * Lon's observation: "it's not clear to me that we have a consistent design language for logging an
 * event vs linking to a procedure." Two controls that look alike and do completely different things —
 * one writes a line into the case record, the other takes you off the screen you are standing on.
 *
 * His rule, and what this suite pins:
 *
 *   LOGGING              → a ROUND button that says "LOG IT"
 *   LINK TO A PROCEDURE  → underlined text
 *
 * Both are enforced from the shared stylesheets rather than per tool, so a seventh engine inherits
 * the idiom by existing. This suite measures the RENDERED page, because the failure mode is a tool
 * whose inline style quietly beats the shared rule — which is exactly what the log buttons did
 * before this change: an inline border-radius:10px on the commit button overrode the shared pill.
 *
 * ONE DELIBERATE EXCEPTION, asserted rather than tolerated: a handful of procedure links are written
 * as bordered chips that set text-decoration:none inline. They keep the chip look, because a
 * bordered pill is already unmistakably a navigation control and an underline inside one reads as a
 * rendering fault. Asserting it means nobody later "fixes" it without deciding to.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_design_language.mjs
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

const pg = await b.newPage({ viewport: { width: 390, height: 844 } });

/* Every live engine. Adding a seventh means adding one line — which is the
   point: this list is the joining checklist for the idiom. */
const ENGINES = ['arrest', 'tca', 'neonatal', 'pph', 'dystocia', 'airway'];

console.log('--- 1. logging is a round button that says LOG IT ---');
for (const e of ENGINES) {
  await pg.goto(`${BASE}/${e}/?from=home`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(320);
  /* The engines hide the running screen until the case is started, and the
     composer until the toggle is tapped, so both have to be opened or the
     measurements below are taken on display:none elements and pass vacuously. */
  if (await pg.locator('#startbtn').isVisible().catch(() => false)) {
    await pg.click('#startbtn').catch(() => {}); await pg.waitForTimeout(320);
  }
  ck(`1. [${e}] has a log control at all`, await pg.locator('#logtoggle').isVisible().catch(() => false), true);
  await pg.click('#logtoggle').catch(() => {}); await pg.waitForTimeout(260);

  const rows = await pg.evaluate(() => ['logtoggle', 'customlog', 'customlog2'].map(id => {
    const el = document.getElementById(id); if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { id, label: (el.textContent || '').trim(),
             rad: parseFloat(cs.borderTopLeftRadius) || 0, h: Math.round(r.height) };
  }).filter(Boolean));

  ck(`1. [${e}] every log control says LOG IT`,
     rows.every(r => /^LOG IT$/i.test(r.label)) ? 'all' : rows.map(r => r.id + '="' + r.label + '"').join(','), 'all');
  /* "Round" measured against the control's own height, not a magic number, so a
     site that makes its buttons taller still has to keep them pill-shaped. */
  ck(`1. [${e}] every log control is a pill, not a rounded rectangle`,
     rows.filter(r => r.h > 0).every(r => r.rad >= r.h / 2 - 1) ? 'all' : rows.map(r => r.id + ' r=' + r.rad + '/h=' + r.h).join(','), 'all');
}

console.log('\n--- 2. a link to a procedure is underlined ---');
/* Card tools, where the prose links live. Engines build their bodies from JS
   and carry few or none at rest. */
for (const p of ['/trauma/', '/codes/', '/ob-neonatal/', '/peds/', '/clinical-pathways/']) {
  await pg.goto(BASE + p + '?from=home', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(420);
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pg.waitForTimeout(200);
  const r = await pg.evaluate(() => {
    const as = [...document.querySelectorAll('a[href*="procedures/"]')];
    /* The documented exception: a bordered chip declaring its own
       text-decoration:none. Everything else is prose and must be underlined. */
    const chip = a => /border/.test(a.getAttribute('style') || '');
    return {
      prose: as.filter(a => !chip(a)).length,
      proseBare: as.filter(a => !chip(a) && !/underline/.test(getComputedStyle(a).textDecorationLine)).length,
      chips: as.filter(chip).length,
      chipsUnderlined: as.filter(a => chip(a) && /underline/.test(getComputedStyle(a).textDecorationLine)).length,
    };
  });
  if (r.prose) ck(`2. [${p}] all ${r.prose} prose procedure link(s) underlined`, r.proseBare, 0);
  if (r.chips) ck(`2. [${p}] the ${r.chips} bordered chip(s) keep the chip look`, r.chipsUnderlined, 0);
  if (!r.prose && !r.chips) console.log(`     [${p}] no procedure links here`);
}

/* And the other direction, so the underline stays MEANINGFUL: it must mark
   procedure links specifically, not every link on the page. If everything is
   underlined the idiom carries no information. */
console.log('\n--- 3. the underline still means something ---');
await pg.goto(BASE + '/trauma/?from=home', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(420);
await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
await pg.waitForTimeout(200);
const other = await pg.evaluate(() => {
  const as = [...document.querySelectorAll('a[href]')].filter(a => !/procedures\//.test(a.getAttribute('href') || ''));
  return { total: as.length, underlined: as.filter(a => /underline/.test(getComputedStyle(a).textDecorationLine)).length };
});
ck('3. non-procedure links are not swept into the same treatment',
   other.total > 0 && other.underlined < other.total, true);
console.log(`     (${other.underlined} of ${other.total} non-procedure links underlined)`);

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
