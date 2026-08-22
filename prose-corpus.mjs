/* prose-corpus.mjs — the rendered-sentence corpus, built once and shared.
 *
 * verify_no_duplicate_prose.mjs finds sentences written down TWICE, byte for byte.
 * verify_near_duplicate_prose.mjs finds sentences that have already DRIFTED apart.
 * They ask different questions of the same corpus, and the corpus is the fiddly
 * part: which pages count, how a sentence is split and normalized, which
 * duplicates are sanctioned, and which pages are redirect stubs that would
 * otherwise attribute a whole tool's prose to an empty folder.
 *
 * That logic lives here rather than in both files, because a rule-12 finder that
 * was itself a copy-paste of another rule-12 finder would be a poor advertisement
 * for the rule. Change the corpus once and both suites move.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/* Compared with the spaces taken out. A rendered page runs adjacent elements together
   ("NAME\"This is anaphylaxis…"), while the manifest records the same block with a gap where
   each tag was. Same sentence, two spacings — and matching on the spacing left three lines
   looking duplicated after they had been given one home. */
export const norm = s => String(s).replace(/\s+/g, ' ').replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
export const key = s => norm(s).replace(/\s+/g, "");
export const SENT = /(?<=[.!?])\s+|\n+/;

/* A "tool" is the folder, because that is the unit content belongs to. Two cards in the same
   file repeating a line is a different (and much more visible) problem than two tools doing it. */
export const toolOf = url => (url.split('/')[1] || 'landing');

/* Content words — the shared tokenizer, so "what counts as a word" is one decision. Everything
   in STOP appears in hundreds of clinical sentences and carries no evidence that two lines are
   the same line. */
export const STOP = new Set(('the a an and or of to in on for with without at by from as is are was were be been being ' +
  'it its this that these those if then than not no yes do does did done can could should would may might will ' +
  'shall must into onto over under out up down off per each any all both every other another same more most less ' +
  'least first second third next last one two three four five you your they their them there here when while ' +
  'after before until once about above below between through during within across also only just still even ' +
  'give given gives use used using take taken taking').split(/\s+/));
export function contentTokens(s) {
  const out = new Set();
  for (const w of String(s).toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length < 3) continue;
    if (STOP.has(w)) continue;
    out.add(w);
  }
  return out;
}

/* Every published page, as the URL a clinician would open. */
export function scanPages(dist = 'dist') {
  const pages = [];
  (function scan(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { scan(p); continue; }
      if (name === 'index.html') pages.push('/' + relative(dist, dir).split(sep).join('/') + (dir === dist ? '' : '/'));
    }
  })(dist);
  return pages;
}

/* Sentences already sanctioned as living in two places:
   - kit contents (verify_kit_consistency.mjs owns them, and they MUST match byte for byte)
   - anything transcluded at build (build.mjs resolved it FROM the other page on purpose) */
export function sanctionedKeys() {
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
     sanctioned nothing at all. Sanction the pieces, not the record. */
  for (const row of manifest)
    for (const part of [row.do, row.why])
      for (const s2 of String(part || "").split(SENT)) {
        const n = key(s2.replace(/<[^>]+>/g, " "));
        if (n) sanctioned.add(n);
      }
  return sanctioned;
}

/* The manifest records what build.mjs transcluded, as ONE string per row. The page renders that
   row as several sentences — and once block boundaries became sentence boundaries (see collect
   below) it renders as several MORE. Splitting the manifest entry the same way is not enough:
   a {{SHARE:}} block is recorded with a space where each tag was and rendered with a newline,
   so the pieces line up only by luck. Matching by CONTAINMENT lines them up by construction —
   a rendered sentence that is part of something the build pulled in from elsewhere is not a
   sentence somebody typed twice. Whitespace is stripped from both sides first, which is what
   makes the two spacings equivalent. */
export function transcludedBlobs() {
  let manifest = [];
  try { manifest = JSON.parse(readFileSync('.transclusion-manifest.json', 'utf8')); } catch { return []; }
  const out = [];
  for (const row of manifest)
    for (const part of [row.do, row.why]) {
      const n = key(String(part || '').replace(/<[^>]+>/g, ' '));
      if (n.length >= 24) out.push(n);
    }
  return out;
}

/* Walk the built site and return every sentence of minWords+ words, with the tools
   and URLs it appeared on. `pg` is an open Playwright page. */
export async function collect(pg, BASE, { minWords = 8, dist = 'dist', invRatio = 0.8 } = {}) {
  const pages = scanPages(dist);
  const sanctioned = sanctionedKeys();
  const blobs = transcludedBlobs();
  /* Rows RENDERED from inventory.js are the same string on two pages BY CONSTRUCTION — that is
     the single-source mechanism working, not prose typed twice. equipment-readiness/ and
     simulations/ both render the readiness rows, and without this the loudest finding in either
     suite would be the one place rule 12 is already satisfied. A ratio, not a blocklist: a
     sentence that is almost entirely inventory vocabulary is a rendered row; one that merely
     names a piece of equipment is still prose. */
  const INV = invRatio ? inventoryTokens() : new Set();
  const seen = new Map();      /* sentence -> Map(tool -> Set(url)) */
  const redirects = [];
  for (const url of pages) {
    await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(120);
    /* A redirect stub renders the page it points AT. Scanning it attributes every sentence of
       the real page to the stub folder, which reported the whole of conversations/ as duplicated
       into debrief/ — 24 findings, none of them real. Skip anything that moved. */
    if (new URL(pg.url()).pathname !== url) { redirects.push(url + ' -> ' + new URL(pg.url()).pathname); continue; }
    /* textContent, not innerText: collapsed <details> is exactly where a retyped sentence
       hides, and innerText would drop every one of them.
       BUT textContent alone runs adjacent elements together with no separator, so a checklist
       of forty rows arrives as ONE string: "…an air leak.Never clamp a bubbling drain - you
       have built a tension pneumothorax.Re-expansion pulmonary edema…". The splitter needs
       whitespace after the full stop, so every one of those rows was invisible to both
       scanners — including the row CLOSE THE HEART would have been, which is the case the
       whole rule exists for. So BLOCK boundaries get a newline first. Inline tags (b, i, a,
       span) deliberately do NOT, or a sentence carrying a cross-card link would be torn in
       half and match nothing. */
    const text = await pg.evaluate(() => {
      const kill = ['script', 'style', 'noscript', 'svg', 'head'];
      const doc = document.body.cloneNode(true);
      doc.querySelectorAll(kill.join(',')).forEach(n => n.remove());
      const BLOCK = 'p,li,div,td,th,tr,h1,h2,h3,h4,h5,h6,summary,details,section,article,' +
                    'header,footer,figcaption,blockquote,dt,dd,pre,label,ul,ol,table,main,nav';
      doc.querySelectorAll(BLOCK).forEach(el => {
        el.insertBefore(document.createTextNode('\n'), el.firstChild);
        el.appendChild(document.createTextNode('\n'));
      });
      return doc.textContent || '';
    });
    for (let s of text.split(SENT)) {
      s = norm(s);
      if (s.split(/\s+/).length < minWords) continue;
      const k = key(s);
      if (sanctioned.has(k)) continue;
      if (k.length >= 24 && blobs.some(bl => bl.includes(k))) continue;
      if (INV.size) {
        const tk = contentTokens(s);
        if (tk.size >= 3) {
          let fromInv = 0;
          for (const t of tk) if (INV.has(t)) fromInv++;
          if (fromInv / tk.size >= invRatio) continue;
        }
      }
      if (!seen.has(s)) seen.set(s, new Map());
      const m = seen.get(s);
      const t = toolOf(url);
      if (!m.has(t)) m.set(t, new Set());
      m.get(t).add(url);
    }
  }
  return { seen, redirects, pages };
}

/* Words that come from inventory.js. equipment-readiness/ and simulations/ RENDER the shared
   inventory — item names, sizes, drawer locations, standards — so their rows are the same
   strings by construction, which is the mechanism working rather than prose typed twice. A
   near-duplicate finder that could not tell the difference would be loudest about the one thing
   that satisfies the rule it enforces, exactly as the exact-match sibling warns.
   Used as a RATIO, not a blocklist: a sentence whose content words are almost entirely
   inventory vocabulary is a rendered row, and a sentence that merely names one piece of
   equipment is still prose. */
export function inventoryTokens() {
  const out = new Set();
  let src = '';
  try { src = readFileSync('inventory.js', 'utf8'); } catch { return out; }
  for (const m of src.matchAll(/(?:"([^"\n]{2,120})"|'([^'\n]{2,120})')/g)) {
    for (const w of String(m[1] || m[2]).toLowerCase().split(/[^a-z0-9]+/))
      if (w.length >= 3) out.add(w);
  }
  return out;
}
