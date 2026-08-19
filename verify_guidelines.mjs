/* LRH Emergency Manual — the guideline source registry, the watcher, and /sources/.
 *
 * What this suite is protecting is a specific kind of quiet failure. The registry's whole job is to
 * make "when did anyone last check that NRP still says this?" answerable. That only works if three
 * things stay true, and each of them can rot silently:
 *
 *   1. A DEPENDENT THAT DOES NOT EXIST. "AHA 2025 touches arrest/, codes/, vems/" is the sentence a
 *      guideline change gets scoped from. If a tool is renamed and the registry is not, the scope is
 *      quietly wrong — and it is wrong in the direction of missing a card, not of doing extra work.
 *   2. A TOOL NOBODY WATCHES. A new clinical tool with no source row inherits no review calendar at
 *      all. It is not "current"; it is invisible. Section 3 fails on that, with an explicit exemption
 *      list so declaring a tool source-free is a decision someone writes down.
 *   3. A DATE THAT BUYS SILENCE. lastVerified in the future, or a malformed date parsing to NaN,
 *      suppresses a source's review for as long as the mistake stands.
 *
 * CONFIG-DRIVEN (the #117 convention): every expectation about WHICH sources exist, WHICH editions
 * they name and WHEN they were verified comes from the page's own injected registry. A fork that
 * drops ERC, adds its own state trauma protocol, or re-dates every row to its own reviews stays
 * green. Section 4 is what a fork must NOT be able to localize away: the meaning of the freshness
 * math, the never/overdue distinction, the PHI posture and the scope disclaimer.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_guidelines.mjs
 */
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };

const errs = [], reqs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

await pg.goto(BASE + '/sources/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));

/* ---- read the page's own config + registry; every expectation below derives from it ---- */
const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /sources/ does not expose window.SITE'); process.exit(1); }
const REG = await pg.evaluate(() => ({
  sources: GDL_SOURCES,
  paths:   GDL_DEPENDENT_PATHS
}));

/* ---- 1. loads clean, offline-safe, stamped ---- */
ck('page has no JS errors', errs.length, 0);
ck('page makes no external requests', reqs.length, 0);
ck('version stamp rendered',
  await pg.evaluate(() => (document.querySelector('.verstamp')?.textContent || '').trim().length > 0), true);
ck('stamp carries the config version',
  await pg.evaluate(() => document.querySelector('.verstamp').textContent.includes('v' + window.SITE.version)), true);
ck('stamp carries the config review date',
  await pg.evaluate(() => document.querySelector('.verstamp').textContent.includes(window.SITE.lastReviewed)), true);

/* ---- 2. registry integrity — the fields the whole process rests on ---- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = await pg.evaluate(() => {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
});

const ids = REG.sources.map(s => s.id);
ck('source ids are unique', new Set(ids).size, ids.length);

const REQUIRED = ['id','body','title','edition','citation','url','cadence','reviewEvery','citedSince','impact','dependents','watch'];
ck('every source carries every required field',
  REG.sources.filter(s => REQUIRED.some(f => s[f] === undefined || s[f] === null || s[f] === '')).map(s => s.id).join(',') || 'none', 'none');
ck('every source declares lastVerified (a date or an explicit null)',
  REG.sources.filter(s => !('lastVerified' in s)).map(s => s.id).join(',') || 'none', 'none');
ck('reviewEvery is a positive number of days',
  REG.sources.filter(s => !(typeof s.reviewEvery === 'number' && s.reviewEvery > 0)).map(s => s.id).join(',') || 'none', 'none');
ck('impact is one of high/medium/low',
  REG.sources.filter(s => !['high','medium','low'].includes(s.impact)).map(s => s.id).join(',') || 'none', 'none');
ck('citedSince is a well-formed date',
  REG.sources.filter(s => !DATE_RE.test(s.citedSince)).map(s => s.id).join(',') || 'none', 'none');
ck('lastVerified, where set, is a well-formed date',
  REG.sources.filter(s => s.lastVerified && !DATE_RE.test(s.lastVerified)).map(s => s.id).join(',') || 'none', 'none');

/* A future lastVerified is the one data error that actively buys silence: it defers the review past
   the interval for as long as it stands, and it looks like diligence on screen. */
ck('no source is verified in the future',
  REG.sources.filter(s => s.lastVerified && s.lastVerified > todayISO).map(s => s.id).join(',') || 'none', 'none');
ck('every source url is https',
  REG.sources.filter(s => !/^https:\/\//.test(s.url)).map(s => s.id).join(',') || 'none', 'none');

const badProbe = [];
for (const s of REG.sources) {
  for (const w of s.watch) {
    if (!['pubmed','page'].includes(w.kind)) badProbe.push(s.id + ':kind');
    if (!w.label) badProbe.push(s.id + ':label');
    if (w.kind === 'page' && !/^https:\/\//.test(w.url || '')) badProbe.push(s.id + ':url');
    if (w.kind === 'pubmed' && !w.term) badProbe.push(s.id + ':term');
  }
  const keys = s.watch.map(w => w.kind + ':' + w.label);
  if (new Set(keys).size !== keys.length) badProbe.push(s.id + ':duplicate-probe-label');
}
/* Probe state is keyed by kind:label, so two probes sharing a label on one source would overwrite
   each other's fingerprints and make one of them permanently report "baseline recorded". */
ck('every watch probe is well-formed and uniquely labeled', badProbe.join(',') || 'none', 'none');

/* ---- 3. dependents are real, and every clinical tool has an owner ---- */
const missing = REG.paths.filter(p => !existsSync(p.replace(/\/$/, '') + '/index.html'));
ck('every dependent path exists on disk', missing.join(',') || 'none', 'none');

const anchored = REG.sources.flatMap(s => s.dependents.filter(d => d.includes('#')));
const badAnchor = anchored.filter(d => {
  const [p, frag] = d.split('#');
  const html = readFileSync(p.replace(/\/$/, '') + '/index.html', 'utf8');
  return !html.includes('id="' + frag + '"');
});
ck('every card-anchored dependent points at a real card', badAnchor.join(',') || 'none', 'none');

/* Tools that legitimately carry no upstream guideline. Each one is a decision, written down here so
   that adding a clinical tool and forgetting the registry FAILS rather than passing quietly. */
const NO_UPSTREAM_SOURCE = {
  'posters/':      'renders content owned by procedures/ — the source rows live there',
  'debrief/':      'redirect stub only; the card lives in conversations/',
  'conversations/':'communication frameworks, not guideline-derived clinical values',
  'simulations/':  'training scripts that chain the tools; the tools carry the sources',
  'vems/':         'printable deck rendered from equipment icons + the tools it drills',
  'sources/':      'this page — it reports on the registry, it is not clinical content',
  'clinical-pathways/': 'container directory; the pathway itself (heart/) carries the source',
  'cairn/':        'explainer/landing page about the project — names no threshold, dose or protocol; the only clinical words on it are in prose telling an adopting ED to validate its own'
};
/* dist/ is the build output — the same tools a second time — and node_modules/ is dev tooling. */
const NOT_A_TOOL = new Set(['dist/', 'node_modules/']);
const toolDirs = execFileSync('sh', ['-c',
  "for d in */; do [ -f \"$d/index.html\" ] && echo \"$d\"; done"], { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter(d => !NOT_A_TOOL.has(d));
const covered = new Set(REG.paths.map(p => p.replace(/\/$/, '') + '/'));
const unwatched = toolDirs.filter(d => !covered.has(d) && !NO_UPSTREAM_SOURCE[d]);
ck('every clinical tool has at least one source row (or a written exemption)',
  unwatched.join(',') || 'none', 'none');

/* ---- 4. clinical invariants — what a fork must NOT be able to localize away ----
   Everything above reads the registry. These assert MEANING, with values a fork cannot move. */

/* 4a. The never/overdue distinction. A source nobody has ever checked must never present as current,
   whatever its interval — that is the same claim inventory.js refuses to make when it separates NOT
   REVIEWED from GAP. Tested against the page's own function with synthetic rows. */
const math = await pg.evaluate(() => {
  const mk = (lastVerified, reviewEvery) => ({ lastVerified, reviewEvery });
  return {
    never:      gdlStatus(mk(null, 180), '2026-08-13'),
    fresh:      gdlStatus(mk('2026-08-01', 180), '2026-08-13'),
    justInside: gdlStatus(mk('2026-02-14', 180), '2026-08-13'),   /* 180 days exactly */
    justPast:   gdlStatus(mk('2026-02-13', 180), '2026-08-13'),   /* 181 days */
    dueSoon:    gdlStatus(mk('2026-03-01', 180), '2026-08-13'),   /* 165 days */
    longFork:   gdlStatus(mk('2026-02-13', 3650), '2026-08-13')   /* a fork's own interval */
  };
});
ck('never verified is never "current"', math.never, 'never');
ck('recently verified reads current', math.fresh, 'current');
ck('exactly at the interval is still inside it', math.justInside, 'due');
ck('one day past the interval is overdue', math.justPast, 'overdue');
ck('inside the last 30 days of the window reads due', math.dueSoon, 'due');
ck('the interval is the fork\'s to set — a long one is honored', math.longFork, 'current');

/* 4b. Sort order. An overdue high-impact source must never sort below a current low-impact one; the
   report and the page both lean on this to put the headline first. */
const sortOK = await pg.evaluate(() => {
  const rows = [
    { id:'low-current',  impact:'low',  lastVerified:'2026-08-12', reviewEvery:365 },
    { id:'high-overdue', impact:'high', lastVerified:'2020-01-01', reviewEvery:180 },
    { id:'med-never',    impact:'medium', lastVerified:null,       reviewEvery:365 }
  ];
  return gdlSort(rows, '2026-08-13').map(r => r.id).join(',');
});
ck('worst-first sort puts never before overdue before current', sortOK, 'med-never,high-overdue,low-current');

/* 4c. Known-unreconciled content is stated, not implied. neonatal/ carries content not yet matched
   to the NRP 9th edition; a fork may resolve that, but it must not be possible to have an
   unreconciled row that renders as an ordinary one. */
const unrecRows = REG.sources.filter(s => s.reconciled === false);
ck('every unreconciled source carries an explanatory note',
  unrecRows.filter(s => !s.reconcileNote).map(s => s.id).join(',') || 'none', 'none');
ck('unreconciled sources render a KNOWN GAP block',
  await pg.evaluate(n => document.querySelectorAll('#src-body .warn').length === n, unrecRows.length), true);
ck('unreconciled sources render a NOT RECONCILED chip',
  await pg.evaluate(n => document.querySelectorAll('#src-body .st-unrec').length === n, unrecRows.length), true);

/* 4d. The page must not claim more than the process can deliver. "No change detected" is the honest
   statement; "nothing changed" is not, because a body can revise a PDF in place. */
const prose = await pg.evaluate(() => document.body.innerText.toLowerCase());
ck('page states the review interval is the guarantee', /review interval/.test(prose), true);
ck('page says detection is incomplete', /(no change detected|cannot catch|neither check is complete)/.test(prose), true);
ck('page carries the standard scope disclaimer',
  /not a substitute for clinical judgment/.test(prose) && /not part of the hospital it system/.test(prose), true);
ck('page states NEVER VERIFIED means unchecked', /nobody has checked yet/.test(prose), true);

/* 4e. PHI posture. This page reads; it must not write anything but the shared theme preference. */
const stored = await pg.evaluate(() => Object.keys(localStorage));
ck('page writes nothing to localStorage beyond the theme key',
  stored.filter(k => k !== 'lrh-pref-theme').join(',') || 'none', 'none');

/* ---- 5. the page renders the whole registry, not a subset ---- */
ck('every source in the registry is rendered',
  await pg.evaluate(() => document.querySelectorAll('#src-body .src').length), REG.sources.length);
const shownTitles = await pg.evaluate(() => [...document.querySelectorAll('#src-body .src h3')].map(h => h.textContent));
ck('no source title is missing from the page',
  REG.sources.filter(s => !shownTitles.includes(s.title)).map(s => s.id).join(',') || 'none', 'none');
ck('the by-tool view lists every dependent path',
  await pg.evaluate(() => document.querySelectorAll('#tool-body .tool').length), REG.paths.length);

/* The tally is what a reader trusts at a glance, so it is asserted against the registry rather than
   against itself. */
const tally = await pg.evaluate(() => [...document.querySelectorAll('#tally-body .tcard')]
  .map(c => [c.querySelector('.l').textContent, +c.querySelector('.n').textContent]));
const wantTally = await pg.evaluate(() => {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  const n = { never:0, overdue:0, due:0, current:0 };
  GDL_SOURCES.forEach(s => n[gdlStatus(s, today)]++);
  return n;
});
ck('tally counts match the registry',
  JSON.stringify(Object.fromEntries(tally.map(([l, n]) => [l.toLowerCase().replace(' ','-'), n]))),
  JSON.stringify({ 'never-verified': wantTally.never, overdue: wantTally.overdue,
                   'due-soon': wantTally.due, current: wantTally.current }));

/* Filter: a clinician looking for what a tool answers to types the tool's name. */
await pg.fill('#q', 'airway');
await pg.waitForTimeout(120);
const filtered = await pg.evaluate(() => [...document.querySelectorAll('#src-body .src')].filter(e => !e.hidden).length);
const wantFiltered = REG.sources.filter(s =>
  (s.body + ' ' + s.title + ' ' + s.edition + ' ' + s.dependents.join(' ') + ' ' + s.citation).toLowerCase().includes('airway')).length;
ck('filter matches the registry', filtered, wantFiltered);
await pg.fill('#q', '');

/* ---- 6. the watcher classifies the registry the same way the page does ---- */
const tmp = mkdtempSync(join(tmpdir(), 'gdlwatch-'));
const jsonPath = join(tmp, 'r.json');
const statePath = join(tmp, 'state.json');
execFileSync('node', ['check_guidelines.mjs', '--offline', '--json', jsonPath,
  '--report', join(tmp, 'r.md'), '--state', statePath, '--today', todayISO], { encoding: 'utf8' });
const watch = JSON.parse(readFileSync(jsonPath, 'utf8'));
ck('watcher checks every source in the registry', watch.checked, REG.sources.length);
ck('watcher and page agree on never-verified', watch.never.length, wantTally.never);
ck('watcher and page agree on overdue', watch.overdue.length, wantTally.overdue);
ck('watcher counts unreconciled content as actionable',
  unrecRows.every(s => watch.actionableIds.includes(s.id)), true);
/* Asserted against this run's own --state path, not the repo-root default: a maintainer who has run
   the watcher online locally leaves that file behind (it is gitignored), and keying the check on it
   would fail for a reason that has nothing to do with the code. */
ck('an --offline run writes no fingerprint state', existsSync(statePath), false);

/* A report that says "nothing changed" would be a lie the moment a body revises a PDF in place. */
const md = readFileSync(join(tmp, 'r.md'), 'utf8');
ck('report states a quiet source is only undetected, not unchanged', /no change was detected/.test(md), true);
ck('report tells the reader how to close an item out', /Closing an item out/.test(md), true);
ck('report warns against back-dating a check that did not happen',
  /did not actually do/.test(md), true);

/* ---- 7. the watcher FAILS when the logic is wrong, config left alone ----
   Section 4 proves the math is right for LRH and for a fork. This proves the suite has teeth: mutate
   the registry into states that must be reported, and confirm they are. Without this, every check
   above would still pass against a watcher that classified everything as "current". */
const regSrc = readFileSync('guidelines.js', 'utf8');
function watchWith(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'gdlmut-'));
  writeFileSync(join(dir, 'guidelines.js'), mutate(regSrc));
  const out = join(dir, 'r.json');
  execFileSync('node', [join(process.cwd(), 'check_guidelines.mjs'), '--offline',
    '--json', out, '--report', join(dir, 'r.md'), '--today', todayISO], { cwd: dir, encoding: 'utf8' });
  return JSON.parse(readFileSync(out, 'utf8'));
}
/* Matches lastVerified whether it holds null or a real date. Anchoring this on `null` alone worked
   against LRH's day-one registry and silently no-opped against any fork that had actually started
   dating its reviews — the mutation ran, changed nothing, and the assertions below "passed" against
   an unmutated registry. A teeth-test that quietly loses its teeth is worse than no test. */
const LV_RE = /lastVerified: *(?:null|"[\d-]+")/g;

/* Every row verified today: nothing is never-verified or overdue, so nothing is actionable except
   the content already known to be unreconciled. */
const allFresh = watchWith(src => src.replace(LV_RE, `lastVerified: "${todayISO}"`));
ck('mutation: all-fresh registry reports no overdue', allFresh.overdue.length, 0);
ck('mutation: all-fresh registry reports no never-verified', allFresh.never.length, 0);
ck('mutation: all-fresh registry still flags unreconciled content', allFresh.unreconciled.length, unrecRows.length);
/* Verified long ago: every row must come back overdue. If this passes at zero, the calendar — the
   only thing that catches what the probes miss — is not running at all. */
const allStale = watchWith(src => src.replace(LV_RE, 'lastVerified: "2015-01-01"'));
ck('mutation: long-stale registry reports every source overdue', allStale.overdue.length, REG.sources.length);

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
await b.close();
process.exit(fail ? 1 : 0);
