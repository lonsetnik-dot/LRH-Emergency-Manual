/* verify_tool_switcher.mjs — the bar's tool switcher is ONE list, rendered.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_tool_switcher.mjs
 *
 * The switcher (SHELL.md layer 1) used to be hand-written into every page that
 * carries the app bar. Seven copies, and by the time they were consolidated they
 * had drifted four separate ways — none of it visible from inside any one file:
 *
 *   · tca/ had no switcher at all, so from the traumatic-arrest engine the other
 *     five engines were unreachable;
 *   · peds/ hoisted itself to the top of its own list while the engines kept the
 *     fixed order, so "third row down" meant a different tool depending on where
 *     you were standing;
 *   · peds/ appended ?from=peds to every link and the engines did not, so landing
 *     from an engine lost the back trail;
 *   · Neonatal and Dystocia drew the same colored square — the same defect as two
 *     procedures sharing a silhouette (design/ICONOGRAPHY.md).
 *
 * The list now lives once in tool-switcher.js. So the assertions here are
 * COMPARATIVE and CONTENT-DERIVED: the pages are found by looking for a rendered
 * #toolmenu rather than from a list typed into this file (golden rule 13 — never
 * scope a check by the thing it is checking), and each page's rendered rows are
 * compared against every other page's. A page that goes back to hand-writing its
 * own rows fails here even if the rows look right on that page.
 */

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8123';
const DIST = process.env.DIST || 'dist';
let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};
const ok = (name, cond, detail) => ck(name, cond ? true : (detail || false), true);

/* ---- membership, derived from the built site ---------------------------- */
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
    if (name !== 'index.html') continue;
    if (readFileSync(p, 'utf8').includes('id="toolmenu"')) {
      pages.push('/' + relative(DIST, p).replace(/index\.html$/, '').replace(/\\/g, '/'));
    }
  }
})(DIST);
pages.sort();

/* The canonical order, read out of the source list. This is the one thing NOT
   derived from a page: comparing pages only against each other would let all of
   them reorder together, and would leave whichever page is compared first
   unguarded. */
const ORDER = [...readFileSync('tool-switcher.js', 'utf8')
  .matchAll(/\{\s*id:\s*'([a-z-]+)'/g)].map(m => m[1]);

console.log(`testing against ${BASE}`);
ok('pages carrying a tool switcher were found', pages.length > 0, pages.length);
console.log('   ' + pages.join(' '));

const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));

/* Read the rendered rows. Deliberately reads the DOM, not the source: a page
   that pasted its own copy of the markup renders identically-shaped rows, and
   the only thing that catches it is comparing pages against each other. */
const readRows = () => pg.evaluate(() => {
  const menu = document.getElementById('toolmenu');
  if (!menu) return null;
  return [...menu.querySelectorAll('.shellmenurow')].map(a => ({
    name: (a.querySelector('span[style*="flex"]') || {}).textContent || '',
    tag: (a.querySelector('.shellmenusub') || {}).textContent || '',
    href: a.getAttribute('href') || '',
    color: (a.querySelector('.shellsq') || { style: {} }).style.background || '',
    on: a.classList.contains('on')
  }));
});

const seen = new Map();      /* page -> rows */
for (const path of pages) {
  await pg.goto(BASE + path, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(250);
  const rows = await readRows();
  if (!rows || !rows.length) { ck(`${path} renders switcher rows`, rows ? 0 : 'no #toolmenu', '>0'); continue; }
  seen.set(path, rows);

  const tool = path.replace(/\//g, '');
  const onRows = rows.filter(r => r.on);
  ck(`${path} marks exactly one row as the current tool`, onRows.length, 1);
  if (onRows.length === 1) ck(`${path} marks ITSELF`, onRows[0].href, `../${tool}/?from=${tool}`);

  /* The order is FIXED and the current tool is marked in place — "third row
     down" is the whole value of the menu during a code, and peds/ used to hoist
     its own row to the top. Checked against tool-switcher.js's own order rather
     than against another page, so the first page compared is guarded too. */
  ck(`${path} renders the tools in the source order`,
     rows.slice(0, -1).map(r => r.href.replace(/^\.\.\//, '').replace(/\/\?.*$/, '')).join(','),
     ORDER.join(','));

  ck(`${path} ends with Manual home`, rows[rows.length - 1].name.trim(), 'Manual home');
  ok(`${path} every tool row carries ?from=${tool}`,
     rows.slice(0, -1).every(r => r.href.endsWith('?from=' + tool)),
     rows.slice(0, -1).map(r => r.href).join(' '));
}

/* ---- one list: every page must render the same rows -------------------- */
const shape = rows => rows.map(r => [r.name, r.tag, r.href.replace(/\?from=[a-z-]+$/, ''), r.color].join('|')).join('\n');
const [first, ...rest] = [...seen.entries()];
if (first) {
  for (const [path, rows] of rest) {
    ck(`${path} renders the SAME list as ${first[0]}`,
       shape(rows) === shape(first[1]) ? 'identical' : 'DIFFERENT', 'identical');
  }
}
/* A square that two tools share is a square that identifies neither — Neonatal
   and Dystocia both drew var(--blue) until this list was consolidated. Checked
   on EVERY page, not just the first: a colour collision introduced on one page
   is invisible to a check that only ever reads another one. */
for (const [path, rows] of seen) {
  const colors = rows.map(r => r.color);
  ck(`${path} every row has a colour of its own`, new Set(colors).size, colors.length);
}
/* Every destination is a real page — a renamed folder would otherwise leave a
   dead row in a menu somebody reaches for mid-case. Walked from the SOURCE order
   plus manual home, not from one page's rendered rows: keyed to a single page,
   this check went quiet the moment the mutation moved to a different one. */
for (const target of ORDER.map(id => '/' + id + '/').concat(['/'])) {
  const res = await pg.request.get(BASE + target).catch(() => null);
  ok(`switcher destination ${target} resolves`, res && res.ok(), res ? res.status() : 'no response');
}

ck('zero page errors while opening the switchers', errs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
