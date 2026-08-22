/* LRH Emergency Manual — prose written down twice (golden rule 12).
 *
 * Rule 12 says content has exactly one home. Kit strings have verify_kit_consistency.mjs,
 * drawings have verify_procedure_icons.mjs, borrowed card sections have verify_transclusion.mjs.
 * FREE PROSE had nothing — which is how CLOSE THE HEART came to be written into procedures/
 * card 02 and hand-typed into tca/ the same day, found by a person reading the screen rather
 * than by any run. This is the missing check.
 *
 * It renders every published page and counts sentences that appear in more than one TOOL, then
 * holds that count against a per-pair budget. A ratchet, like verify_checklist_clarity.mjs: the
 * duplication that exists today is frozen and named, a NEW pair fails, and a pair that grows
 * fails. Going down is always allowed and the budget should be lowered when it does.
 *
 * Two kinds of duplicate are NOT counted, because both are deliberate:
 *   - kit contents, which MUST be byte-identical across card, poster, label and inventory;
 *   - anything build.mjs transcluded, read from .transclusion-manifest.json — otherwise the
 *     finder for rule 12 would be loudest about the one mechanism that satisfies it.
 *
 * What it CANNOT see: two pages that say nearly the same thing DIFFERENTLY. Exact duplicates
 * are harmless today and dangerous later; a pair that has already drifted is dangerous now and
 * invisible here. Do not read a green run as "the manual agrees with itself."
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_no_duplicate_prose.mjs [minWords]
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const MIN_WORDS = +(process.argv[2] || 8);

/* Every published page, as the URL a clinician would open. */
const pages = [];
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (name === 'index.html') pages.push('/' + relative('dist', dir).split(sep).join('/') + (dir === 'dist' ? '' : '/'));
  }
})('dist');

/* Compared with the spaces taken out. A rendered page runs adjacent elements together
   ("NAME\"This is anaphylaxis…"), while the manifest records the same block with a gap where
   each tag was. Same sentence, two spacings — and matching on the spacing left three lines
   looking duplicated after they had been given one home. */
const key = s => norm(s).replace(/\s+/g, "");

function norm(s) {
  return String(s).replace(/\s+/g, ' ').replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
}
/* Sentences already sanctioned as living in two places:
   - kit contents (verify_kit_consistency.mjs owns them, and they MUST match byte for byte)
   - anything transcluded at build (build.mjs resolved it FROM the other page on purpose) */
const sanctioned = new Set();
try {
  const inv = readFileSync('inventory.js', 'utf8');
  for (const m of inv.matchAll(/contents\s*:\s*\[([\s\S]*?)\]/g))
    for (const s of m[1].matchAll(/"([^"]+)"/g)) sanctioned.add(key(s[1]));
} catch { /* no inventory */ }
let manifest = [];
try { manifest = JSON.parse(readFileSync('.transclusion-manifest.json', 'utf8')); } catch { /* not built yet */ }
/* Split manifest entries the SAME way page text is split. A {{SHARE:…}} block is recorded as
   one string but renders as several sentences, so matching whole-entry against per-sentence
   sanctioned nothing at all — the three anaphylaxis lines stayed "duplicated" after they had
   been given a single home. Sanction the pieces, not the record. */
const SENT = /(?<=[.!?])\s+|\n+/;
for (const row of manifest)
  for (const part of [row.do, row.why])
    for (const s2 of String(part || "").split(SENT)) { const n = key(s2.replace(/<[^>]+>/g, " ")); if (n) sanctioned.add(n); }

/* A "tool" is the folder, because that is the unit content belongs to. Two cards in the same
   file repeating a line is a different (and much more visible) problem than two tools doing it. */
const toolOf = url => (url.split('/')[1] || 'landing');

const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const seen = new Map();   /* sentence -> Map(tool -> Set(url)) */

const redirects = [];
for (const url of pages) {
  await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(120);
  /* A redirect stub renders the page it points AT. Scanning it attributes every sentence of
     the real page to the stub folder, which reported the whole of conversations/ as duplicated
     into debrief/ — 24 findings, none of them real. Skip anything that moved. */
  if (new URL(pg.url()).pathname !== url) { redirects.push(url + ' -> ' + new URL(pg.url()).pathname); continue; }
  /* textContent, not innerText: collapsed <details> and hidden .t-why rows are exactly where a
     retyped sentence hides, and innerText would drop every one of them. */
  const text = await pg.evaluate(() => {
    const kill = ['script', 'style', 'noscript', 'svg', 'head'];
    const doc = document.body.cloneNode(true);
    doc.querySelectorAll(kill.join(',')).forEach(n => n.remove());
    return doc.textContent || '';
  });
  for (let s of text.split(/(?<=[.!?])\s+|\n+/)) {
    s = norm(s);
    if (s.split(/\s+/).length < MIN_WORDS) continue;
    if (sanctioned.has(key(s))) continue;
    if (!seen.has(s)) seen.set(s, new Map());
    const m = seen.get(s);
    const t = toolOf(url);
    if (!m.has(t)) m.set(t, new Set());
    m.get(t).add(url);
  }
}
await b.close();

/* ---- the ratchet ----------------------------------------------------------
   Per PAIR of tools, at MIN_WORDS=8. Every entry is a real duplication that exists today and
   is described in the notes below; none of them is endorsed. Lower a number whenever a sweep
   removes duplication — that is the point of a ratchet — and never raise one to make a run go
   green without saying, here, what was duplicated and why it had to be. */
const BUDGET = {
  /* Wall posters are hand-written COMPRESSIONS of the procedure cards ("read at ten feet"),
     not copies, so most of each poster is its own text — but these sentences were retyped
     verbatim and will drift. Whether posters may compress at all, or should transclude and
     take the length, is an open design question (see PROJECT notes / issue). */
  "posters+procedures": 13,
  /* 12 → 13 on 2026-08-22, and the extra one is NOT newly written. "Consult the burns service
     before cutting whenever time permits." has been on the escharotomy poster and on
     procedures/ card 12 the whole time. It was invisible to this scanner because the card's
     row carried a .t-why immediately after it, and .t-why is an inline <i> — textContent ran
     the two together as "…time permits.The Alfred STAR reference is explicit…", which is not
     a sentence the poster contains. Issue #216 removed that tier, the sentence split cleanly,
     and a duplication that was always there showed up.
     Worth keeping in mind generally: this scanner reads RENDERED text, so any markup that
     concatenates without whitespace can mask a retyped sentence. A green run has never meant
     more than "nothing matched", and it means slightly less than it looks. */
  /* codes+peds was 3 — the anaphylaxis NAME / CLAIM / AIM block, byte-identical on the adult
     card and the pediatric one. It now lives once, in codes/, and peds/ pulls it in with
     {{SHARE:codes|anaphylaxis-crm}}. The doses were never shared and still differ correctly. */
  /* Cart-label context lines — kit PROSE around the kit CONTENTS. inventory.js owns the
     contents strings and a suite holds them; these sentences sit just outside that. */
  "labels+procedures": 4,
  /* codes+ob-neonatal was 4 — the drawer-legend explainer, the greyscale caption and the
     case-log PHI note, on the two tools that carry a cart legend. All three now live once in
     codes/ and are pulled in with {{SHARE:codes|…}}. Each page keeps its own wrapper: the PHI
     note is styled with fixed colors on one and theme variables on the other, and that
     difference is real. */
  /* Landing-page and section-page disclaimer wording. */
  "clinical-pathways+landing": 2,
  /* The NRP-vs-PALS epinephrine dose-difference note, in three places. */
  "arrest+codes+peds": 1,
  /* The tele-activation button and its hint, shared by the two engines that can call it. */
  "airway+arrest": 1,
  "dystocia+neonatal": 1,
  /* Two engines that happen to carry the same version stamp and disclaimer line. */
  "dystocia+pph": 1,
};

const hits = [...seen.entries()].filter(([, m]) => m.size > 1).map(([s, m]) => ({ s, tools: [...m.keys()], urls: [...m.values()].flatMap(x => [...x]) }));
/* Shared chrome — the disclaimer, the back link, the search prompt — is on every page by design
   and is injected, not retyped. Split it out rather than burying the real findings under it. */
const CHROME_AT = +(process.env.CHROME_AT || 5);
const chrome = hits.filter(h => h.tools.length >= CHROME_AT);
const real = hits.filter(h => h.tools.length < CHROME_AT).sort((a, b) => b.tools.length - a.tools.length || b.s.length - a.s.length);

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? "PASS " : "FAIL ") + name + "  got=" + got + (ok ? "" : "  want=" + want)); };

console.log(`scanned ${pages.length} pages · ${seen.size} distinct sentences of ${MIN_WORDS}+ words`);
console.log(`${redirects.length} redirect stub(s) skipped: ${redirects.join(", ") || "none"}`);
console.log(`${chrome.length} shared-chrome sentence(s) (${CHROME_AT}+ tools), not counted\n`);

/* Count by pair, then hold each pair against its budget.

   DUPALL=1 prints EVERY sentence in every pair, with the pages it was found on, instead of
   the first four of an over-budget pair. A count that rises by one tells you a sentence was
   retyped but not which; the way to find it is to run DUPALL against this build and against
   the last green one (git worktree + BUILD_OUT + a second port) and diff the two lists. That
   is how the escharotomy line below was identified, and it took three attempts without it. */
const ALL = !!process.env.DUPALL;
const byPair = new Map();
for (const h of real) {
  const k = h.tools.slice().sort().join("+");
  if (!byPair.has(k)) byPair.set(k, []);
  byPair.get(k).push(h.s + (ALL ? "   @@ " + h.urls.join(" ") : ""));
}
const list4 = list => list.slice(0, ALL ? 99 : 4).forEach(s2 => console.log(`       ${s2.slice(0, ALL ? 400 : 120)}`));
for (const [k, list] of [...byPair.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const budget = BUDGET[k];
  if (budget === undefined) {
    /* A pair nobody has written down is the whole point: something was just retyped. */
    ck(`NEW duplication between ${k}`, list.length + " sentence(s)", "0 — transclude it, or add it to BUDGET with a reason");
    list4(list);
    continue;
  }
  ck(`${k} within budget (${list.length}/${budget})`, list.length <= budget, true);
  if (ALL || list.length > budget) list4(list);
  if (list.length < budget) console.log(`       budget is loose by ${budget - list.length} — lower it`);
}
/* A budget entry with nothing behind it means the duplication is gone and the number should
   go with it, or the pair was mis-typed and is silently excusing something else. */
for (const k of Object.keys(BUDGET)) {
  if (!byPair.has(k)) ck(`BUDGET names ${k}, which no longer duplicates — remove the entry`, "stale", "removed");
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
