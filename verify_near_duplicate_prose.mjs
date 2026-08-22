/* LRH Emergency Manual — prose that has already DRIFTED (issue #209, golden rule 12).
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_near_duplicate_prose.mjs
 *
 * verify_no_duplicate_prose.mjs finds a sentence written down twice, byte for byte. Its own
 * header admits what it cannot see, and that gap is this file:
 *
 *     "two pages that say nearly the same thing DIFFERENTLY. Exact duplicates are harmless
 *      today and dangerous later; a pair that has already drifted is dangerous NOW and
 *      invisible here."
 *
 * An exact duplicate is a trap waiting to spring — edit one copy and the other silently keeps
 * saying the old thing. A near-duplicate is that trap already sprung: two screens giving a
 * clinician two versions of the same instruction, and nothing anywhere saying which is current.
 * CLOSE THE HEART was caught as an exact pair because it was found the same day. Had anyone
 * edited either copy first, no run in this repo would have said a word.
 *
 * HOW IT LOOKS: content-word Jaccard between every pair of sentences from DIFFERENT tools,
 * candidate pairs generated from a rare-token index so this stays a few seconds rather than
 * five million string comparisons. A pair scoring at or above SIMILAR but below 1.0 is a
 * finding; 1.0 is an exact duplicate and belongs to the sibling suite, not here.
 *
 * A RATCHET, like its sibling. Every pair below exists today, is named, and is NOT endorsed.
 * A new pair fails. Lower a budget whenever a sweep removes drift; never raise one without
 * writing here what drifted and why it had to.
 *
 * WHAT IT STILL CANNOT SEE: two sentences that mean the same thing in different words ("hold
 * pressure for ten minutes" / "pinch for a third of an hour"). Overlap is a proxy for sameness,
 * not a measure of it. A green run here means no pair LOOKS like a fork of another — not that
 * the manual agrees with itself. Nor is it a substitute for the byte-for-byte sibling: the two
 * run together, and neither one's silence means anything on its own.
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
import { collect, key, contentTokens } from './prose-corpus.mjs';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const MIN_WORDS = +(process.env.MIN_WORDS || 8);
/* Measured against this corpus, not guessed. At 0.72 the run drops five families that are real
   forks — the radiant-warmer line, the ACOG citation, the Blakemore leak-test line, the cart
   drawer-move note, the "Cognitive aid — verify against your own …" family. At 0.55 it adds
   sentences that merely share a clinical vocabulary. 0.62 is where the last real fork appears
   and the noise has not started. Raising it hides drift; lowering it produces a list nobody
   reads, which hides drift too. */
const SIMILAR = +(process.env.SIMILAR || 0.62);
const tokens = contentTokens;
const jaccard = (a, b) => {
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter++;
  return inter / (a.size + b.size - inter);
};
/* Character trigrams, alongside the word sets. Clinical rows are TERSE — "Crystalloid 20 mL/kg
   = enter weight above (max 1 L)" carries four content words — so one word changed swings word
   Jaccard by a third and a real fork scores 0.50. Trigrams do not care that "max" became
   "maximum" or that a clause moved, and they are what catches an edit rather than a rewrite.
   The two measures fail in opposite directions, so the score is the better of them: word sets
   see past reordering, trigrams see past inflection. */
const tri = s => {
  const t = ' ' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const out = new Set();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
};

let pass = 0, fail = 0;
const ck = (name, got, want) => { const okk = String(got) === String(want); (okk ? pass++ : fail++);
  console.log((okk ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (okk ? '' : '  want=' + want)); };

const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const { seen, redirects, pages } = await collect(pg, BASE, { minWords: MIN_WORDS });
await b.close();

/* ---- index ---------------------------------------------------------------
   One record per distinct sentence. Sentences with too few content words are dropped: a short
   line is all stopwords and coincidence, and it dominates any similarity list it is allowed
   into. */
const MIN_CONTENT = +(process.env.MIN_CONTENT || 4);
/* Inventory-rendered rows are already dropped by the corpus (prose-corpus.mjs), so both
   suites agree on what counts as prose rather than each deciding for itself. */
const recs = [];
for (const [s, m] of seen) {
  const tk = tokens(s);
  if (tk.size < MIN_CONTENT) continue;
  recs.push({ s, tk, tg: tri(s), tools: [...m.keys()], urls: [...m.values()].flatMap(x => [...x]), k: key(s) });
}

/* Candidate generation. Comparing all 3300+ sentences against each other is ~5.5M pairs; most
   share nothing. Index by token, skip tokens common enough to be useless as a signal, and only
   compare pairs that share at least two rare ones. */
/* ONE shared rare token is enough to make a pair worth scoring. Requiring two missed a fork of
   a four-content-word dose row, which is exactly the row this suite most needs to see. */
const DF_MAX = 40, MIN_SHARED = 1;
const byToken = new Map();
recs.forEach((r, i) => { for (const t of r.tk) { if (!byToken.has(t)) byToken.set(t, []); byToken.get(t).push(i); } });
const shared = new Map();     /* "i:j" -> count of rare tokens in common */
for (const [, idxs] of byToken) {
  if (idxs.length > DF_MAX) continue;
  for (let a = 0; a < idxs.length; a++)
    for (let c = a + 1; c < idxs.length; c++) {
      const kk = idxs[a] + ':' + idxs[c];
      shared.set(kk, (shared.get(kk) || 0) + 1);
    }
}

const hits = [];
for (const [kk, n] of shared) {
  if (n < MIN_SHARED) continue;
  const [i, j] = kk.split(':').map(Number);
  const A = recs[i], B = recs[j];
  if (A.k === B.k) continue;                                  /* exact — the sibling suite's job */
  /* NOTE the exactness test is A.k === B.k above, NOT a score of 1.0. Dropping pairs that
     score 1.0 also dropped every REORDERING — "Three times a day, nebulized TXA 500 mg"
     against "Nebulized TXA 500 mg three times a day" has an identical word set and is exactly
     the kind of second copy this suite exists to find. */
  const sim = Math.max(jaccard(A.tk, B.tk), jaccard(A.tg, B.tg));
  if (sim < SIMILAR) continue;
  hits.push({ sim, i, j });
}

/* ---- cluster, do not list pairs -------------------------------------------
   A template instantiated four times in one tool and four times in another produces sixteen
   PAIRS but is one problem: one sentence with two homes and eight spellings. Listing pairs
   makes the number meaningless and the output unreadable, which is how a finder stops being
   read. So near-duplicates are joined transitively and each FAMILY is one finding. */
const parent = recs.map((_, i) => i);
const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (x, y) => { const a = find(x), c = find(y); if (a !== c) parent[a] = c; };
for (const h of hits) union(h.i, h.j);
const bestSim = new Map();
for (const h of hits) { const r = find(h.i); bestSim.set(r, Math.max(bestSim.get(r) || 0, h.sim)); }

const clusters = new Map();
for (const h of hits) {
  const r = find(h.i);
  if (!clusters.has(r)) clusters.set(r, new Set());
  clusters.get(r).add(h.i); clusters.get(r).add(h.j);
}

/* Shared chrome — the version stamp, the disclaimer, the back link — is on every page BY
   DESIGN and injected rather than retyped; its wording varies only where the tool's own name
   or version sits. A family touching this many tools is that, not a fork. The cost of the rule
   is real and worth stating: a genuinely drifted clinical sentence that had spread to five
   tools would be excused by it. Nothing in the corpus today is in that position, and if one
   ever is, the fix is to name it here rather than to raise the number. */
const CHROME_AT = +(process.env.CHROME_AT || 5);
const families = [], chrome = [];
for (const [root, idxs] of clusters) {
  const members = [...idxs].map(i => recs[i]);
  const tools = [...new Set(members.flatMap(m => m.tools))].sort();
  /* CROSS-TOOL only, the same scope as the sibling suite. Two rows inside one file saying
     nearly the same thing is usually deliberate (a run sheet's beats, an adult and a pediatric
     variant of one rule) and is in any case visible to whoever opens that file. The danger this
     suite exists for is the pair nobody can see at once, because it lives in two places. */
  if (tools.length < 2) continue;
  const fam = { tools, members, sim: bestSim.get(root) || 0 };
  (tools.length >= CHROME_AT ? chrome : families).push(fam);
}
families.sort((a, c) => c.sim - a.sim);

console.log(`scanned ${pages.length} pages · ${recs.length} sentences of ${MIN_WORDS}+ words and ${MIN_CONTENT}+ content words`);
console.log(`${redirects.length} redirect stub(s) skipped: ${redirects.join(', ') || 'none'}`);
console.log(`similarity threshold ${SIMILAR} · ${chrome.length} shared-chrome famil${chrome.length === 1 ? 'y' : 'ies'} (${CHROME_AT}+ tools), not counted\n`);

/* ---- the ratchet ---------------------------------------------------------
   Per PAIR of tools. Every number here is drift that exists today. It is named because a
   number with nothing written beside it is indistinguishable from a number somebody raised to
   get a green run. */
const BUDGET = {
  /* THE BIG ONE, and the reason issue #209 was opened. A wall poster is a hand-written
     COMPRESSION of a procedure card — "read at ten feet" — so it is not supposed to be a copy.
     But forty-one of its sentences are the card's sentence with a word moved: "irrigate with
     saline" against "irrigate the area with saline"; "Too shallow doesn't release; too deep
     hits fasciotomy-level structures" against "Too shallow (doesn't release) or too deep
     (fasciotomy-level structures)". Nobody decided those differences. They are what happens
     when one sentence is typed twice, months apart. Whether posters should transclude and take
     the length, or keep compressing and accept the drift, is a real design question and not one
     to settle inside a test file. */
  "posters+procedures": 41,
  /* Cart labels against the procedure cards: the label carries the card's sentence with a
     "Watch:" prefix, or a kit line run into it. Kit CONTENTS are excluded (inventory.js owns
     those and verify_kit_consistency.mjs holds them byte-identical) — this is the prose around
     them, which nothing owns. */
  "labels+procedures": 32,
  /* Both pages RENDER the readiness rows from inventory.js, so the row text is identical by
     construction and the residue is the renderer's own chrome ("MAPPED PAR 1" against
     "MAPPED"). The inventory-vocabulary filter above removes most of it. This is the mechanism
     working, and it is named here so nobody "fixes" it. */
  "equipment-readiness+simulations": 23,
  /* The anaphylaxis and status-epilepticus cards. The NAME line has drifted ("the seizure
     clock" / "the clock") and the ADJUNCTS heading has a clause inserted on the pediatric side.
     Next door to the NAME / CLAIM / AIM block that WAS given one home with
     {{SHARE:codes|anaphylaxis-crm}} — which is what these want, if the adult and pediatric
     wordings are not meant to differ. That is a clinical call, not a tidying one. */
  "codes+peds": 4,
  /* The coverage-gap DRAFT banner, forked into "published guidelines" on codes/ and "published
     guidance" on trauma/, plus the pediatric-airway pointer. A banner template wants one home. */
  "codes+trauma": 2,
  /* The hysterotomy poster against ob-neonatal card 10 — including a pair that differs ONLY by
     a trailing full stop, and a figure caption that differs only by its number ("FIG 2" against
     "FIG 1"). Exactly the pairs the byte-for-byte sibling cannot see. */
  "ob-neonatal+posters": 2,
  /* Citations typed twice: the Surviving Sepsis pediatric guideline and the AABB / CDC
     transfusion-reaction sources, once inside the card and once in the registry page.
     guidelines.js already IS the registry — the card could cite it rather than restate it. */
  "codes+sources": 2,
  /* Same shape: the ACOG Practice Bulletin 222 citation, on the card and in the registry. */
  "ob-neonatal+sources": 1,
  /* The Blakemore dwell-time line, on the card and on the poster, differing by a full stop. */
  "codes+posters": 1,
  /* "Written from the ACEP policies / ACOG guidance cited below; confirm doses against local
     protocol and pharmacy." One provenance sentence, two nouns. */
  "codes+ob-neonatal": 1,
  /* TELE-ED and TELE-NICU: the same control, deliberately two names, because they call two
     different services. The sentence around them is identical. Not drift. */
  "airway+arrest+dystocia+neonatal": 1,
  /* "Cognitive aid — verify against your own devices / equipment / formulary / device labels
     and local policy." Four engines, four nouns, one sentence. */
  "airway+arrest+neonatal+pph": 1,
  /* "Reset — the clock, the ladder, the timers and the log are clean for a new case", in three
     wordings across three engines, and again as a fourth and fifth wording below. Each names
     its own tool's state, which is why it was typed five times; the shape is shared and could
     be built from a list. */
  "airway+dystocia+neonatal": 1,
  "arrest+pph": 1,
  /* "Personal decision-support aid(s) — not part of any hospital IT system / EHR." Singular on
     the section page, plural on the landing page. */
  "clinical-pathways+landing": 1,
  /* The radiant warmer: "Turn the radiant warmer on — warm-up takes real time" against
     "Radiant warmer: turn it on for real — warm-up time is part of the drill." The drill is
     teaching the same fact the engine states, in its own words. */
  "neonatal+simulations": 1,
  /* The Blakemore leak-test line, on the cart label and on the poster. */
  "labels+posters": 1,
  /* The cart drawer-move note ("Supplies took its place in the deep drawer" / "Supplies moved
     DOWN into the deep drawer"), on the card and on the label. */
  "codes+labels": 1,
};

const byPair = new Map();
for (const f of families) {
  const k = f.tools.join('+');
  if (!byPair.has(k)) byPair.set(k, []);
  byPair.get(k).push(f);
}
const show = list => list.slice(0, process.env.NEARALL ? 99 : 2).forEach(f => {
  console.log(`       ${f.sim.toFixed(2)} across ${f.tools.join(' + ')}`);
  f.members.slice(0, process.env.NEARALL ? 99 : 3).forEach(m =>
    console.log(`             [${m.tools.join('/')}] ${m.s.slice(0, 130)}`));
});
for (const [k, list] of [...byPair.entries()].sort((a, c) => c[1].length - a[1].length)) {
  const budget = BUDGET[k];
  if (budget === undefined) {
    ck(`NEW near-duplication between ${k}`, list.length + ' famil' + (list.length === 1 ? 'y' : 'ies'),
       '0 — give it one home, or add it to BUDGET with a reason');
    show(list);
    continue;
  }
  ck(`${k} within budget (${list.length}/${budget})`, list.length <= budget, true);
  if (process.env.NEARALL || list.length > budget) show(list);
  if (list.length < budget) console.log(`       budget is loose by ${budget - list.length} — lower it`);
}
for (const k of Object.keys(BUDGET)) {
  if (!byPair.has(k)) ck(`BUDGET names ${k}, which no longer drifts — remove the entry`, 'stale', 'removed');
}
if (!byPair.size) ck('no tool pair says nearly the same thing differently', 'none', 'none');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
