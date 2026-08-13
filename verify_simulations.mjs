/* verify_simulations.mjs — the drill scripts, and the thing that makes them
 * onboarding rather than training.
 *
 *     node build.mjs && node verify_simulations.mjs
 *
 * Simulations are the step in ONBOARDING.md that finds what a form cannot ask
 * about: the local facts nobody knows are facts until a workflow stalls on
 * them. That only works if every drill actually ends by asking the team to
 * write those down — so this suite asserts the LOCALIZATION GAPS block exists
 * on every sim, names real config keys, and is not just a decorative heading.
 *
 * It also checks the two things that silently break a sim script:
 *   - a menu row with no article, or an article with no menu row (sims are
 *     deliberately absent from the site-wide search, so the tool's own filter
 *     is the ONLY way to find one — an unlisted sim is invisible)
 *   - a jump link to a card anchor that does not exist, which under pressure
 *     looks exactly like a working link until somebody taps it
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

import { FIELDS } from './localization.manifest.mjs';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const KEYS = new Set(FIELDS.map(f => f.key));

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

await page.goto(BASE + '/simulations/?from=home', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);

/* ---- 1. every sim is findable and every menu row leads somewhere ---------- */
const sims = await page.evaluate(() =>
  Array.from(document.querySelectorAll('main article[id^="s"]')).map(a => a.id));
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#simmenu a.edm-row')).map(a => ({
    href: a.getAttribute('href').replace('#', ''),
    kw: a.getAttribute('data-kw') || '',
    title: a.textContent.replace(/\s+/g, ' ').trim(),
  })));

console.log(`\n--- 1. ${sims.length} sims, ${rows.length} menu rows ---`);
ck('1. every sim has a menu row',
   sims.filter(id => !rows.some(r => r.href === id)).join(',') || 'none', 'none');
ck('1. every menu row has a sim',
   rows.filter(r => !sims.includes(r.href)).map(r => r.href).join(',') || 'none', 'none');
ck('1. every menu row carries search keywords',
   rows.filter(r => r.kw.trim().split(/\s+/).length < 5).map(r => r.href).join(',') || 'none', 'none');

/* Two rows whose keywords are near-identical make the local filter surface the
   wrong drill first — the same failure the SEARCH_INDEX overlap rule exists to
   prevent, in the one tool that has its own search instead. */
{
  const dupes = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = new Set(rows[i].kw.split(/\s+/).filter(Boolean));
      const b = new Set(rows[j].kw.split(/\s+/).filter(Boolean));
      const shared = [...a].filter(w => b.has(w)).length;
      const overlap = shared / Math.min(a.size, b.size);
      if (overlap > 0.6) dupes.push(`${rows[i].href}~${rows[j].href}`);
    }
  }
  ck('1. no two sims have near-duplicate keywords', dupes.join(',') || 'none', 'none');
}

/* ---- 2. the local filter actually finds each sim -------------------------- */
console.log('\n--- 2. the local filter is the only way to find a sim ---');
for (const [term, want] of [['sepsis', 's11'], ['thrombectomy', 's12'], ['cath lab', 's13'],
                            ['anaphylaxis', 's14'], ['cerebral edema', 's15'],
                            ['blakemore', 's16'], ['poison control', 's17'],
                            ['dystocia', 's01'], ['thoracotomy', 's08']]) {
  await page.fill('#simq', term);
  await page.waitForTimeout(120);
  const hits = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#simmenu a.edm-row'))
      .filter(a => a.style.display !== 'none')
      .map(a => a.getAttribute('href').replace('#', '')));
  ck(`2. "${term}" surfaces ${want}`, hits.includes(want), true);
}
await page.fill('#simq', '');
await page.waitForTimeout(120);

/* ---- 3. every sim ends by asking what it surfaced ------------------------- */
/* This is the assertion that matters. A drill without this block is training;
   a drill with it is onboarding. */
console.log('\n--- 3. every sim names the localization gaps it surfaces ---');
const gaps = await page.evaluate(() =>
  Array.from(document.querySelectorAll('main article[id^="s"]')).map(a => {
    const blocks = Array.from(a.querySelectorAll('details')).filter(d =>
      /LOCALIZATION GAPS THIS DRILL SURFACES/i.test(d.querySelector('summary')?.textContent || ''));
    const text = blocks.map(b => b.textContent).join(' ').replace(/\s+/g, ' ');
    return {
      id: a.id,
      has: blocks.length > 0,
      /* `contacts.transferPrimary.*` is legitimate shorthand for "all three of
         these" — capture the star so the check below can resolve it as a
         prefix rather than rejecting it as a key that does not exist. */
      keys: (text.match(/[a-z]+(?:\.[a-zA-Z]+)+(?:\.\*)?/g) || []),
      asksForNotes: /every moment somebody had to ask a question the manual should have answered/i.test(text),
      namesUndeclared: /Not yet a config key/i.test(text),
      len: text.length,
    };
  }));

/* The seven sims written as onboarding drills. The ten original scripts predate
   the localization system; they are listed here so that adding the block to
   them is a visible, deliberate piece of work rather than a silent omission. */
const ONBOARDING_SIMS = ['s11', 's12', 's13', 's14', 's15', 's16', 's17'];
const withBlock = gaps.filter(g => g.has).map(g => g.id);

ck('3. every onboarding sim has the block',
   ONBOARDING_SIMS.filter(id => !withBlock.includes(id)).join(',') || 'none', 'none');

for (const g of gaps.filter(x => ONBOARDING_SIMS.includes(x.id))) {
  const resolves = k => KEYS.has(k) ||
    (k.endsWith('.*') && [...KEYS].some(real => real.startsWith(k.slice(0, -1))));
  const declared = g.keys.filter(resolves);
  const bogus = g.keys.filter(k => !resolves(k) &&
    /^(site|contacts|caps|defib|trop|formulary|physical|policy|dialect|review)\./.test(k));
  ck(`3. [${g.id}] cites at least two real config keys`, declared.length >= 2, true);
  /* A key that looks like config but is not in the manifest sends a champion
     to edit a file that has no such setting. */
  ck(`3. [${g.id}] cites no key that does not exist`, bogus.join(',') || 'none', 'none');
  ck(`3. [${g.id}] asks the team to write down what stalled`, g.asksForNotes, true);
  ck(`3. [${g.id}] names at least one gap that is not yet a config key`, g.namesUndeclared, true);
}

/* The originals are allowed to lack the block, but the gap should be visible
   rather than forgotten — so it is reported, not asserted away. */
{
  const without = gaps.filter(g => !g.has).map(g => g.id);
  console.log(`     note: ${without.length} older sim(s) have no gaps block yet: ${without.join(', ') || 'none'}`);
}

/* ---- 4. every jump link lands on something that exists ------------------- */
console.log('\n--- 4. every OPEN link resolves ---');
const links = await page.evaluate(() =>
  [...new Set(Array.from(document.querySelectorAll('main a.golink'))
    .map(a => a.getAttribute('href')))]);
const broken = [];
for (const href of links) {
  const [path, hash] = href.split('#');
  const url = new URL(path, BASE + '/simulations/').toString();
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!res || !res.ok()) { broken.push(`${href} (HTTP ${res ? res.status() : '?'})`); continue; }
  if (hash) {
    const found = await page.evaluate(id => !!document.getElementById(id), hash);
    if (!found) broken.push(`${href} (no #${hash})`);
  }
}
ck(`4. all ${links.length} card links resolve`, broken.join(' | ') || 'none', 'none');

await page.goto(BASE + '/simulations/?from=home', { waitUntil: 'networkidle' });
ck('5. no page or console errors', errs.length, 0);

await browser.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
