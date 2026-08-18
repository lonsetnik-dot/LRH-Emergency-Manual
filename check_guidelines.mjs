#!/usr/bin/env node
/* ===========================================================================
   check_guidelines.mjs — the guideline watcher.

   Reads guidelines.js (the registry) and answers, once a month, the only
   question that matters between clinical reviews:

       "Has anything upstream moved, and if it has, WHAT IN THIS MANUAL MOVES?"

   It does that three ways, deliberately overlapping:

     1. PUBMED PROBES — an E-utilities search per source, restricted to
        publications since the last run. Finds society guidelines that get
        indexed in journals (AHA in Circulation, ACOG in Obstet Gynecol, AAP in
        Pediatrics, EAST in J Trauma Acute Care Surg).

     2. PAGE PROBES — a fingerprint of the SIGNAL LINES on a body's guideline
        index page (lines carrying a year, an edition, a version or the word
        guideline), not of the whole page. A whole-page hash changes when a
        cookie banner rotates; a signal-line hash mostly changes when the list
        of guidelines does. Finds the bodies that never touch a journal — DAS,
        ACS TQIP, TCCC, ILCOR.

     3. THE CALENDAR — every source carries reviewEvery, and a source past it
        is reported whether or not either probe fired.

   THE CALENDAR IS NOT A BACKUP, IT IS THE FLOOR. Probes 1 and 2 fail silently
   in ways nobody can enumerate: a body replaces a PDF at the same URL, a site
   restructures, a journal indexes a guideline as a review. So a quiet month is
   never reported as "nothing has changed" — it is reported as "no change
   DETECTED", and the calendar still forces a human look on schedule. Any
   wording in the output that would let a reader conclude otherwise is a bug.

   A PROBE THAT ERRORS IS A FINDING, NOT A SKIP. A 404 from a body's guideline
   index is exactly what a reorganized site looks like, which is exactly when a
   new edition tends to appear. Failures are reported in their own section and
   counted as actionable; two consecutive failures escalate the wording.

   USAGE
     node check_guidelines.mjs                    # probe everything, print report
     node check_guidelines.mjs --offline          # calendar only, no network
     node check_guidelines.mjs --source nrp       # one source
     node check_guidelines.mjs --report out.md --json out.json
     node check_guidelines.mjs --today 2026-12-01 # pretend it is that date

   Options: --state <path> (default guideline-watch-state.json), --bootstrap-days
   <n> (first-run PubMed lookback, default 180), --fail-on-actionable (exit 1
   when something needs a human — for a strict CI gate, not for the cron).

   Env: NCBI_API_KEY and NCBI_EMAIL are optional and only raise the E-utilities
   rate limit; the watcher works without them.

   NO PHI, NO PATIENT DATA, NO SITE DATA leaves this process. It sends public
   search terms to PubMed and issues GETs to public guideline pages. It runs in
   CI, never in a browser and never on the deployed site.
   =========================================================================== */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

/* ---- args ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt  = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const OFFLINE   = flag('--offline');
const STRICT    = flag('--fail-on-actionable');
const ONLY      = opt('--source', null);
const STATEFILE = opt('--state', 'guideline-watch-state.json');
const REPORTOUT = opt('--report', null);
const JSONOUT   = opt('--json', null);
const BOOTSTRAP = parseInt(opt('--bootstrap-days', '180'), 10);
const TODAY     = opt('--today', new Date().toISOString().slice(0, 10));

/* ---- registry ------------------------------------------------------------
   guidelines.js is a plain browser script (var declarations, ES5). Evaluating
   it in a Function scope gives Node the same globals the injected page gets,
   with no build step and no second copy of the data. Its module.exports tail
   is guarded by typeof checks, so it is inert here. */
function loadRegistry(path = 'guidelines.js') {
  const src = readFileSync(path, 'utf8');
  const f = new Function(src + '\n;return { GDL_SOURCES, gdlStatus, gdlSort, gdlDaysBetween };');
  return f();
}
const REG = loadRegistry();
const SOURCES = REG.GDL_SOURCES.filter(s => !ONLY || s.id === ONLY);
if (ONLY && !SOURCES.length) { console.error(`no such source: ${ONLY}`); process.exit(2); }

/* ---- state --------------------------------------------------------------- */
const state = existsSync(STATEFILE)
  ? JSON.parse(readFileSync(STATEFILE, 'utf8'))
  : { version: 1, lastRun: null, sources: {} };
state.sources = state.sources || {};

const probeKey = p => `${p.kind}:${p.label}`;
function probeState(sourceId, p) {
  const s = (state.sources[sourceId] = state.sources[sourceId] || { probes: {} });
  s.probes = s.probes || {};
  return (s.probes[probeKey(p)] = s.probes[probeKey(p)] || {});
}

/* ---- fetch helper -------------------------------------------------------- */
const UA = 'CairnReady-Emergency-Manual guideline watcher (+https://cairnready.org)';
async function get(url, timeoutMs = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- page fingerprint ----------------------------------------------------
   Reduce a page to the lines that would plausibly change when the body's list
   of guidelines changes, and hash those. Everything else on a modern page —
   nav, cookie notices, session tokens, "as of <today>" stamps — is noise that
   would make a whole-page hash cry wolf every single month, and a watcher that
   cries wolf every month is a watcher nobody reads. */
const SIGNAL_RE = /(20\d\d|edition|version|updated?|revis|guideline|bulletin|consensus)/i;
function signalLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8217;|&rsquo;/g, "'").replace(/&quot;/g, '"');

  const seen = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 8 || line.length > 200) continue;
    if (!SIGNAL_RE.test(line)) continue;
    /* Drop lines that are themselves volatile: a visible current date, a
       copyright year, a cache-buster. These match SIGNAL_RE by containing a
       year and would otherwise flip the hash on 1 January for every source. */
    if (/^(©|copyright)/i.test(line)) continue;
    if (/\b(cookie|privacy|sign in|log in|newsletter|subscribe)\b/i.test(line)) continue;
    seen.add(line.slice(0, 120));
  }
  /* Rank the most guideline-like lines first, then keep a bounded slice: the
     state file is committed to git, so it must not grow without limit. */
  const scored = [...seen].sort((a, b) => {
    const sc = l => (/(edition|version|guideline|bulletin|consensus)/i.test(l) ? 0 : 1);
    return sc(a) - sc(b) || (a < b ? -1 : a > b ? 1 : 0);
  }).slice(0, 60);
  return scored;
}
const hashOf = lines => createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);

async function runPageProbe(src, p) {
  const st = probeState(src.id, p);
  const html = await get(p.url);
  const lines = signalLines(html);
  if (!lines.length) throw new Error('page fetched but no signal lines found (layout may have changed)');
  const hash = hashOf(lines);
  const prev = st.hash, prevLines = st.lines || [];
  st.hash = hash; st.lines = lines; st.checked = TODAY; st.fails = 0;

  if (!prev) return { status: 'baseline', detail: `baseline recorded (${lines.length} signal lines)` };
  if (prev === hash) return { status: 'quiet', detail: 'no change in signal lines' };

  const before = new Set(prevLines), after = new Set(lines);
  const added   = lines.filter(l => !before.has(l)).slice(0, 8);
  const removed = prevLines.filter(l => !after.has(l)).slice(0, 8);
  return { status: 'changed', detail: 'signal lines changed', added, removed };
}

/* ---- PubMed probe --------------------------------------------------------
   esearch for the source's term restricted to publication dates since the last
   check, then esummary for anything not already reported. PMIDs already seen
   are never reported twice — a monthly report that repeats last month's hits
   trains the reader to skim it. */
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
function eutilsSuffix() {
  const parts = ['tool=lrh-emergency-manual'];
  if (process.env.NCBI_EMAIL) parts.push('email=' + encodeURIComponent(process.env.NCBI_EMAIL));
  if (process.env.NCBI_API_KEY) parts.push('api_key=' + encodeURIComponent(process.env.NCBI_API_KEY));
  return '&' + parts.join('&');
}
function daysAgo(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const pmDate = d => d.replace(/-/g, '/');

async function runPubmedProbe(src, p) {
  const st = probeState(src.id, p);
  const since = st.checked || daysAgo(TODAY, BOOTSTRAP);
  const url = `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=25&sort=date`
    + `&datetype=pdat&mindate=${pmDate(since)}&maxdate=${pmDate(TODAY)}`
    + `&term=${encodeURIComponent(p.term)}${eutilsSuffix()}`;

  const raw = await get(url);
  let ids = [];
  try { ids = JSON.parse(raw).esearchresult?.idlist || []; }
  catch { throw new Error('PubMed returned a response that was not JSON'); }

  const seen = new Set(st.seen || []);
  const fresh = ids.filter(id => !seen.has(id));
  st.seen = [...seen, ...fresh].slice(-300);   /* bounded: state lives in git */
  st.checked = TODAY; st.fails = 0;

  if (!fresh.length) return { status: 'quiet', detail: `no new indexed guidelines since ${since}` };

  await sleep(400);
  let titles = [];
  try {
    const sum = JSON.parse(await get(
      `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${fresh.slice(0, 10).join(',')}${eutilsSuffix()}`));
    titles = fresh.slice(0, 10).map(id => {
      const r = sum.result?.[id];
      return r ? `${r.title || '(no title)'} — ${r.source || ''} ${r.pubdate || ''} (PMID ${id})`
               : `PMID ${id}`;
    });
  } catch { titles = fresh.slice(0, 10).map(id => `PMID ${id}`); }

  return { status: 'changed', detail: `${fresh.length} new indexed publication(s) since ${since}`,
           added: titles };
}

/* ---- run ----------------------------------------------------------------- */
const results = [];
for (const src of SOURCES) {
  const findings = [];
  for (const p of (src.watch || [])) {
    if (OFFLINE) { findings.push({ probe: p.label, kind: p.kind, status: 'skipped',
                                   detail: 'network probes skipped (--offline)' }); continue; }
    try {
      const r = p.kind === 'pubmed' ? await runPubmedProbe(src, p) : await runPageProbe(src, p);
      findings.push({ probe: p.label, kind: p.kind, ...r });
    } catch (e) {
      const st = probeState(src.id, p);
      st.fails = (st.fails || 0) + 1;
      findings.push({ probe: p.label, kind: p.kind, status: 'error', fails: st.fails,
                      detail: String(e && e.message || e),
                      url: p.kind === 'page' ? p.url : undefined });
    }
    await sleep(p.kind === 'pubmed' ? 400 : 150);
  }

  results.push({
    id: src.id, body: src.body, title: src.title, edition: src.edition, url: src.url,
    impact: src.impact, dependents: src.dependents, reviewEvery: src.reviewEvery,
    lastVerified: src.lastVerified, citedSince: src.citedSince, cadence: src.cadence,
    reconciled: src.reconciled !== false, reconcileNote: src.reconcileNote || null,
    calendar: REG.gdlStatus(src, TODAY),
    ageDays: src.lastVerified ? REG.gdlDaysBetween(src.lastVerified, TODAY) : null,
    findings
  });
}

state.lastRun = TODAY;

/* ---- classify ------------------------------------------------------------ */
const changed  = results.filter(r => r.findings.some(f => f.status === 'changed'));
const failed   = results.filter(r => r.findings.some(f => f.status === 'error'));
const calNever = results.filter(r => r.calendar === 'never');
const calOver  = results.filter(r => r.calendar === 'overdue');
const calDue   = results.filter(r => r.calendar === 'due');
const unrecon  = results.filter(r => !r.reconciled);
const actionable = new Set([...changed, ...failed, ...calNever, ...calOver, ...unrecon].map(r => r.id));

/* ---- report -------------------------------------------------------------- */
const L = [];
const w = s => L.push(s);
let sectionNo = 0;
const sec = title => `## ${++sectionNo}. ${title}`;
const impactTag = r => r.impact === 'high' ? '**HIGH IMPACT**' : r.impact === 'medium' ? 'medium impact' : 'low impact';
const dep = r => r.dependents.map(d => `\`${d}\``).join(', ');

w(`# Guideline watch — ${TODAY}`);
w('');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
w(`${plural(SOURCES.length, 'upstream source', 'upstream sources')} checked. `
  + `**${plural(actionable.size, 'needs', 'need')} a human.**`
  + (OFFLINE ? ' _(calendar only — network probes were skipped)_' : ''));
w('');
w('> A quiet source means **no change was detected**, not that nothing changed.'
  + ' Probes miss a body that replaces a PDF at the same URL or restructures its site,'
  + ' which is why every source also carries a review interval.');
w('');

if (changed.length) {
  w(sec('Changes detected upstream'));
  w('');
  for (const r of REG.gdlSort(changed, TODAY)) {
    w(`### ${r.body} — ${r.title}`);
    w(`Manual is written against: **${r.edition}** · ${impactTag(r)} · touches ${dep(r)}`);
    w('');
    for (const f of r.findings.filter(f => f.status === 'changed')) {
      w(`- **${f.probe}** (${f.kind}): ${f.detail}`);
      for (const a of (f.added || []))   w(`  - \`+\` ${a}`);
      for (const x of (f.removed || [])) w(`  - \`−\` ${x}`);
    }
    w('');
    w(`Source page: ${r.url}`);
    w('');
  }
}

if (unrecon.length) {
  w(sec('Known-unreconciled content'));
  w('');
  w('The manual carries content from an older edition than the one named, and that is already known:');
  w('');
  for (const r of unrecon) {
    w(`- **${r.body} — ${r.title}** (against **${r.edition}**), touches ${dep(r)}`);
    if (r.reconcileNote) w(`  - ${r.reconcileNote}`);
  }
  w('');
}

if (calNever.length || calOver.length) {
  w(sec('Review due (calendar)'));
  w('');
  if (calNever.length) {
    w('**Never verified through this process** — no human has yet confirmed the manual matches the current edition:');
    w('');
    for (const r of REG.gdlSort(calNever, TODAY)) {
      w(`- ${r.body} — ${r.title} · against **${r.edition}** · ${impactTag(r)} · content last reviewed ${r.citedSince} · touches ${dep(r)}`);
    }
    w('');
  }
  if (calOver.length) {
    w('**Overdue** — past the review interval:');
    w('');
    for (const r of REG.gdlSort(calOver, TODAY)) {
      w(`- ${r.body} — ${r.title} · last verified ${r.lastVerified} (${r.ageDays} days ago, interval ${r.reviewEvery}) · ${impactTag(r)} · touches ${dep(r)}`);
    }
    w('');
  }
}

if (failed.length) {
  w(sec('Probe failures'));
  w('');
  w('A failed probe is a finding. A guideline index that stops answering is what a'
    + ' reorganized site looks like, and a reorganized site is often a republished guideline.');
  w('');
  for (const r of failed) {
    for (const f of r.findings.filter(f => f.status === 'error')) {
      const esc = f.fails >= 2 ? ` — **failed ${f.fails} runs in a row; the URL has probably moved, fix it in guidelines.js**` : '';
      w(`- **${r.body}** · ${f.probe}: ${f.detail}${esc}`);
      if (f.url) w(`  - ${f.url}`);
    }
  }
  w('');
}

if (calDue.length) {
  w(sec('Coming due within 30 days'));
  w('');
  for (const r of calDue) w(`- ${r.body} — ${r.title} · last verified ${r.lastVerified} (${r.ageDays}/${r.reviewEvery} days)`);
  w('');
}

w('## Everything checked');
w('');
w('| Source | Manual written against | Calendar | Probes |');
w('|---|---|---|---|');
for (const r of REG.gdlSort(results, TODAY)) {
  const probes = r.findings.length
    ? r.findings.map(f => `${f.status}`).join(', ')
    : 'calendar only';
  w(`| ${r.body} — ${r.title.slice(0, 60)} | ${r.edition} | ${r.calendar} | ${probes} |`);
}
w('');
w('## Closing an item out');
w('');
w('1. Open the source page and compare the current edition with the `edition` field in `guidelines.js`.');
w('2. If nothing moved: set that source\'s `lastVerified` to today. That is the whole close-out.');
w('3. If something moved: open an issue per affected tool (the `touches` list above is the scope),');
w('   change the content, then update both `edition` and `lastVerified` in the same commit.');
w('4. Never update `lastVerified` for a check you did not actually do — it buys silence, not safety.');
w('');
w('Process: `GUIDELINE-WATCH.md`. Registry: `guidelines.js`. Watcher: `check_guidelines.mjs`.');

const report = L.join('\n');

/* ---- outputs ------------------------------------------------------------- */
if (REPORTOUT) writeFileSync(REPORTOUT, report + '\n');
else console.log(report);

if (JSONOUT) writeFileSync(JSONOUT, JSON.stringify({
  today: TODAY, offline: OFFLINE, checked: SOURCES.length,
  actionable: actionable.size, actionableIds: [...actionable],
  changed: changed.map(r => r.id), failed: failed.map(r => r.id),
  never: calNever.map(r => r.id), overdue: calOver.map(r => r.id),
  due: calDue.map(r => r.id), unreconciled: unrecon.map(r => r.id),
  results
}, null, 2) + '\n');

/* State is only written by a full, online run. An --offline run recorded no
   fingerprints at all and would blank the ones already stored, making the next
   run report every baseline as a change. A --source run touched one source's
   fingerprints while leaving the rest untouched, which is harmless to write but
   pointless to persist from a hand-run spot check — and persisting it would let
   an interactive "let me just look at NRP" quietly consume the change that the
   next scheduled run was supposed to report. */
if (!OFFLINE && !ONLY) writeFileSync(STATEFILE, JSON.stringify(state, null, 2) + '\n');

if (STRICT && actionable.size) process.exit(1);
