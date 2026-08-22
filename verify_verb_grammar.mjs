#!/usr/bin/env node
/* ===========================================================================
   verify_verb_grammar.mjs

   Consistency is only real when it is enforced. LAYOUT.md mandated two
   breakpoints for months while seven were live, because the rule was prose.
   These are the same rules as VERB-GRAMMAR.md, in a form that can fail a build.

   Checks, per checklist row and per card:
     1  every row opens with a lexicon verb, or with a condition then a verb
     2  no banned opener anywhere in a row
     3  no card number in any displayed text or link
     4  one control per row — never a checkbox and a log control together
     5  every log control carries a word, not just a colour
     6  no nested parentheses (a row must be speakable)
     7  a logged row is written in the past tense

   Usage: node verify_verb_grammar.mjs <file|dir> [...]
          node verify_verb_grammar.mjs            (dist/, gated to migrated pages)
   =========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* --- the lexicon, verbatim from VERB-GRAMMAR.md -------------------------- */
const VERBS = [
  'ASSESS','CHECK','CONFIRM','RECHECK','GIVE','START','STOP','HOLD','ADD',
  'TITRATE','SWITCH','REPEAT','PLACE','ATTACH','APPLY','OPEN','SHOCK',
  'PREPARE','CALL','ASSIGN','SAY','ASK','FIND','SUSPECT','ESCALATE',
  'TRANSFER','LOG','SEND','CORRECT','REPLACE','OVERLAP','CONTROL','ACTIVATE',
];
/* Past-tense forms a logged row may use. Written out rather than derived —
   a naive rule produced "CONTROLED" and let a real violation through. */
const PAST = [
  'ASSESSED','CHECKED','CONFIRMED','RECHECKED','GAVE','STARTED','STOPPED',
  'HELD','ADDED','TITRATED','SWITCHED','REPEATED','PLACED','ATTACHED',
  'APPLIED','OPENED','SHOCKED','PREPARED','CALLED','ASSIGNED','SAID','ASKED',
  'FOUND','SUSPECTED','ESCALATED','TRANSFERRED','LOGGED','SENT','CORRECTED',
  'REPLACED','OVERLAPPED','CONTROLLED','ACTIVATED',
];

const BANNED = [
  'consider','remember','note that','be aware','it is important',
  'ensure that','you should','make sure','may want to','think about',
  'keep in mind','this is where',
];

/* --- helpers -------------------------------------------------------------- */
const ENT = { '&amp;':'&','&lt;':'<','&gt;':'>','&mdash;':'—','&ndash;':'–',
  '&rarr;':'→','&middot;':'·','&nbsp;':' ','&ge;':'≥','&le;':'≤','&#10003;':'✓',
  '&quot;':'"','&rsquo;':"'" };
const dec = s => s.replace(/&#?\w+;/g, m => ENT[m] ?? ' ');
const text = s => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function rows(html) {
  return [...html.matchAll(/<li class="check"[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[1]);
}

/* --- checks --------------------------------------------------------------- */
function checkFile(file, html, fail) {
  const R = rows(html);
  /* A page declares what it is. VERB GRAMMAR applies to protocol pages — the
     ones a clinician is read aloud from. Reference pages (provenance, indexes,
     explainers) carry rows that describe a process rather than instruct, and
     forcing a verb on them produces worse writing, not better.
     Speakability, card numbers and one-control-per-row apply to BOTH. */
  const kind = (html.match(/<body[^>]*data-page="(\w+)"/) || [,'protocol'])[1];
  const isProtocol = kind === 'protocol';

  R.forEach((raw, i) => {
    const t = text(raw);
    const at = `${file} row ${i + 1}`;
    if (!t) return;

    /* 4 — one control per row */
    const hasBox = /type="checkbox"/.test(raw);
    const hasLog = /class="[^"]*\blog\b/.test(raw);
    if (hasBox && hasLog)
      fail(`${at}: has BOTH a checkbox and a log control. One control per row.\n      ${t.slice(0,90)}`);

    /* 2 — banned openers */
    for (const b of BANNED)
      if (t.toLowerCase().includes(b))
        fail(`${at}: banned opener "${b}" — rewrite around a verb or delete.\n      ${t.slice(0,90)}`);

    /* 6 — speakable */
    if (/\([^()]*\([^()]*\)/.test(t))
      fail(`${at}: nested parentheses — cannot be read aloud.\n      ${t.slice(0,90)}`);

    /* 3 — no displayed card numbers */
    const num = t.match(/\b(?:card|see card)\s+\d+|#c\d{2}\b/i);
    if (num)
      fail(`${at}: displays a card number ("${num[0]}"). Link the destination's NAME.\n      ${t.slice(0,90)}`);

    /* 1 / 7 — verb grammar (protocol pages only) */
    const logged = /is-logged/.test(raw);
    if (!isProtocol) return;
    const words = t.replace(/^[✓•\s]+/, '').split(/\s+/);
    const lead = (words[0] || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const pool = logged ? PAST : VERBS;

    if (!pool.includes(lead)) {
      /* branch row: condition first, verb straight after the arrow */
      const arrow = t.indexOf('→');
      if (arrow === -1) {
        fail(`${at}: opens with "${words[0]}" — not a lexicon verb, and no "→" branch.\n      ${t.slice(0,90)}`);
      } else {
        const after = t.slice(arrow + 1).trim().split(/\s+/)[0] || '';
        const v = after.replace(/[^A-Za-z]/g, '').toUpperCase();
        if (!VERBS.includes(v) && v !== 'DO')
          fail(`${at}: branch does not lead with a lexicon verb after "→" (found "${after}").\n      ${t.slice(0,90)}`);
      }
    }

    /* 5 — a log state carries a word */
    if (hasLog) {
      const meta = raw.match(/class="log-meta"[^>]*>([\s\S]*?)<\/span>/);
      if (!meta || !/[A-Za-z0-9]/.test(text(meta[1])))
        fail(`${at}: log control has no label. Colour is never the only carrier.\n      ${t.slice(0,90)}`);
    }
  });

  /* 3 — no leading numbers on headings or chips */
  for (const m of html.matchAll(/<summary class="card-title[^"]*">([\s\S]*?)<\/summary>|<a class="chip"[^>]*>([\s\S]*?)<\/a>/g)) {
    const t = text(m[1] ?? m[2] ?? '');
    if (/^\d+\s*[·.\-–—]/.test(t))
      fail(`${file}: "${t}" leads with a number. Names, not numbers.`);
  }
}

/* --- run ------------------------------------------------------------------ */
function statSyncSafe(p) { try { return statSync(p); } catch { return null; } }

function walk(p, out = []) {
  if (statSync(p).isDirectory()) {
    for (const n of readdirSync(p)) if (n !== '.git' && n !== 'node_modules') walk(join(p, n), out);
  } else if (p.endsWith('.html')) out.push(p);
  return out;
}

/* --- what gets scanned ----------------------------------------------------

   With explicit arguments this scans exactly what it is given, unchanged.

   With none — which is how run-tests.sh invokes every verify_*.mjs — it scans
   the built dist/, GATED TO MIGRATED PAGES. That gate matters in both
   directions and neither is obvious:

   1. Without it, the suite exited 2 asking for arguments and the harness
      reported `!! FAILED` on a healthy repo. (FINDINGS.md [F-05].)
   2. With a naive "scan everything" it would have been WORSE than failing: it
      matches <li class="check">, the v0.2.0 row, and today every row in the
      manual is a .t-ck. Zero rows found, zero problems, "PASSED" — a suite
      that cannot fail, printing green over 1,785 unexamined rows.

   So membership is derived from the rendered markup rather than declared: a
   page is in scope once it carries the new checklist container or a new row.
   A page that has the container and no rows FAILS, because that is a migration
   that dropped its content. And the gate's width is printed on every run, so
   "0 of 39" is visible rather than implied — REDESIGN-BRIEF.md's "land them
   gated to migrated paths, and widen the gate as pages migrate."
   -------------------------------------------------------------------------- */
const explicit = process.argv.slice(2);
const MIGRATED = /class="checklist"|<li class="check"/;
let gated = false, scanned = 0;
let targets;
if (explicit.length) {
  targets = explicit.flatMap(p => walk(p));
  if (!targets.length) { console.error('usage: verify_verb_grammar.mjs <file|dir> [...]'); process.exit(2); }
} else {
  if (!statSyncSafe('dist')) {
    console.error('verb grammar: dist/ is missing. Run node build.mjs first.');
    process.exit(1);
  }
  gated = true;
  const all = walk('dist');
  scanned = all.length;
  targets = all.filter(f => MIGRATED.test(readFileSync(f, 'utf8')));
  console.log(`verb grammar: ${targets.length} of ${scanned} built page(s) carry the v0.2.0 checklist vocabulary.`);
  if (!targets.length) {
    console.log('GATE OPEN, NOTHING INSIDE IT — no page has migrated yet, so this suite');
    console.log('asserts nothing today. It bites the first page that grows a .checklist.');
    process.exit(0);
  }
}

const problems = [];
for (const f of targets) {
  const html = readFileSync(f, 'utf8');
  /* A page that declares the container and renders no rows is a migration that
     lost its content — the one failure mode a row-by-row scan cannot see,
     because it has no rows to look at. */
  if (/class="checklist"/.test(html) && !rows(html).length)
    problems.push(`${f}: has a .checklist container and zero .check rows — the rows were lost in migration.`);
  checkFile(f, html, m => problems.push(m));
}

console.log(`verb grammar: ${targets.length} file(s), ${targets.reduce((n,f)=>n+rows(readFileSync(f,'utf8')).length,0)} row(s)`);
if (problems.length) {
  for (const p of problems) console.log(`  !! ${p}`);
  console.log(`\nFAILED — ${problems.length} grammar violation(s).`);
  process.exit(1);
}
console.log('PASSED — every protocol row opens with a lexicon verb, one control each, no card numbers.');
