/* tools_clarify.mjs — apply two-tier rewrites to checklist rows.
 *
 * A dev-only helper (never shipped; build.mjs skips .mjs at the root). Rewrites the
 * <span> body of a checklist row identified by its data-k, into:
 *
 *     <b>ACTION</b><i class="t-why">the reasoning</i>
 *
 * The rule it enforces, and the reason this is a script rather than hand-editing: an
 * ACTION must be able to stand alone. If the step cannot be performed without a number,
 * that number belongs in the action, never in the .t-why. It refuses to write a row whose
 * why contains a dose-shaped value the action does not, unless the entry sets refOnly —
 * which stamps data-ref on the row so verify_checklist_clarity.mjs can see the same
 * decision. Hiding a number is allowed exactly once per row, and only on purpose.
 *
 *   node tools_clarify.mjs <file> <json-of-rewrites>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , file, jsonPath] = process.argv;
const rewrites = JSON.parse(readFileSync(jsonPath, 'utf8'));
let html = readFileSync(file, 'utf8');

/* Decode the entities the source actually uses before comparing. Blanking them instead —
   the first version did — silently made every `find` that spans an em-dash miss, which is
   most of them, because these rows are written "Name — what it is". A missed find is a row
   left unconverted; it is loud rather than dangerous, but it wasted a pass. */
const ENT = { '&mdash;': '\u2014', '&ndash;': '\u2013', '&rsquo;': '\u2019', '&lsquo;': '\u2018',
  '&ldquo;': '\u201c', '&rdquo;': '\u201d', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
  '&deg;': '\u00b0', '&plusmn;': '\u00b1', '&ge;': '\u2265', '&le;': '\u2264', '&times;': '\u00d7',
  '&middot;': '\u00b7', '&rarr;': '\u2192', '&hellip;': '\u2026',
  '&asymp;': '\u2248', '&sup2;': '\u00b2', '&sup3;': '\u00b3', '&frac12;': '\u00bd', '&mu;': '\u00b5' };
const strip = s => s.replace(/<[^>]+>/g, '')
  .replace(/&[a-z]+;|&#\d+;/gi, e => ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : ' ')
  .replace(/\s+/g, ' ').trim();
/* A value someone has to ACT on: a number with a unit, a range, or a rate. Deliberately
   loose — a false positive costs a moment's thought, a false negative hides a dose. */
const DOSE = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|mL|ml|L|units?|u\b|mmHg|°C|kg|Fr|J\b|%|\/min|\/hr|mEq|mmol|breaths|beats|h\b|hours?|min\b|minutes?|sec)/gi;

/* KIT CONTENTS ARE NOT PROSE. inventory.js is the single source for every physical item,
   and CLAUDE.md requires a kit's content strings to be byte-identical across the procedure
   card, the poster, the cart label and the inventory — verify_kit_consistency.mjs asserts
   it across all four. Rewriting one of those rows for readability silently breaks that
   contract: it reads better and the laminated label in the cabinet no longer matches the
   screen. Three Blakemore rows were rewritten before this guard existed, and the kit suite
   is what caught it. A kit row may only be reworded by changing inventory.js and every
   artifact together, which is a different task from this one. */
const KIT_STRINGS = new Set();
try {
  const inv = readFileSync('inventory.js', 'utf8');
  for (const m of inv.matchAll(/contents\s*:\s*\[([\s\S]*?)\]/g)) {
    for (const s of m[1].matchAll(/"([^"]+)"/g)) KIT_STRINGS.add(s[1].trim());
  }
} catch (e) { /* a consumer without an inventory is fine */ }

let applied = 0, refused = 0;
for (const r of rewrites) {
  /* Most rows carry a data-k, but many do not — the mimic lists, the device-emergency
     rows, most of procedures/. Those are addressed by `find`: a unique fragment of the row
     as it stands today. Uniqueness is checked, not assumed, because silently rewriting the
     wrong clinical row is the worst thing this script could do. */
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Find the row's <span> and its MATCHING close, by depth. A non-greedy match to the first
     </span> looks equivalent and is not: several rows nest a <span class="wdose"> that
     computes a dose from the case weight, and stopping at its close replaced only the front
     of the row, leaving the tail dangling as a direct child of the <label>. The grid then
     laid that orphan out as its own 230px row — which is how it surfaced, as an
     accessibility target-size failure rather than as the structural corruption it was. */
  const rowSpans = [];
  const OPEN = /<input type="checkbox"[^>]*>\s*<span>/g;
  let om;
  while ((om = OPEN.exec(html))) {
    let i = om.index + om[0].length, depth = 1;
    const TAG = /<(\/?)span\b[^>]*>/g; TAG.lastIndex = i;
    let tm;
    while (depth > 0 && (tm = TAG.exec(html))) { depth += tm[1] ? -1 : 1; if (depth === 0) break; }
    if (!tm) continue;
    /* Which card the row belongs to, so an identical row on two cards can be addressed.
       c19 and c20 (LVAD responsive / unresponsive) share their defibrillation row verbatim. */
    const artAt = html.lastIndexOf('<article id="', om.index);
    const art = artAt >= 0 ? (html.slice(artAt, artAt + 40).match(/id="([^"]+)"/) || [])[1] : '';
    rowSpans.push({ head: om[0], body: html.slice(i, tm.index), tail: tm[0], at: om.index, card: art });
  }

  let target;
  if (r.k) {
    target = rowSpans.find(s => s.head.includes('data-k="' + r.k + '"'));
    if (!target) { console.error(`  MISSING  ${r.k}`); refused++; continue; }
  } else {
    const hits = rowSpans.filter(s => strip(s.body).includes(r.find) && (!r.card || s.card === r.card));
    if (hits.length !== 1) {
      console.error(`  ${hits.length ? 'AMBIGUOUS' : 'MISSING'}  find="${r.find}" matched ${hits.length} rows`);
      refused++; continue;
    }
    target = hits[0];
  }
  const re = new RegExp('(' + esc(target.head) + ')(' + esc(target.body) + ')(' + esc(target.tail) + ')');
  const m = [null, target.head, target.body, target.tail];

  const whyDoses = new Set((strip(r.why || '').match(DOSE) || []).map(s => s.toLowerCase().replace(/\s+/g, '')));
  const actDoses = new Set((strip(r.action).match(DOSE) || []).map(s => s.toLowerCase().replace(/\s+/g, '')));
  const hidden = [...whyDoses].filter(d => !actDoses.has(d));
  if (hidden.length && !r.refOnly) {
    console.error(`  REFUSED  ${r.k || r.find}: the why hides a value the action does not carry: ${hidden.join(', ')}`);
    refused++; continue;
  }

  /* LIVE MARKUP MUST SURVIVE. Some rows are not prose: they carry a .wdose span that
     computes the dose from the shared case weight, a tap-to-log button, an id another
     script writes into, a cross-card link. The first version of this script replaced the
     whole span body with text, and it silently turned the STEMI heparin row's live
     weight-computed dose into the literal words it happened to be displaying — a dose that
     used to follow the patient became a static placeholder. Nothing about the row looked
     wrong afterwards, which is what made it dangerous.

     So: whatever live markup the original carried, the replacement must carry too. This
     refuses rather than warns, because the failure mode is invisible. */
  const LIVE = /class="[^"]*\b(?:wdose|dosev|logstamp)\b[^"]*"|<button|<a\s|data-perkg|data-logevent|\sid="/g;
  const origLive = (m[2].match(LIVE) || []);
  const newLive = ((r.action + (r.why || '')).match(LIVE) || []);
  const lost = origLive.filter(x => !newLive.includes(x));
  if (lost.length) {
    console.error(`  REFUSED  ${r.k || r.find}: replacement drops live markup: ${[...new Set(lost)].join(' ')}`);
    console.error(`           original: ${m[2].replace(/\s+/g, ' ').slice(0, 200)}`);
    refused++; continue;
  }

  /* Does this row carry a kit-contents string? Compare on the ORIGINAL, not the
     replacement — the point is to catch the row before it is reworded. */
  const origText = strip(m[2]);
  const kitHit = [...KIT_STRINGS].filter(s => s.length > 12 && origText.includes(s));
  const keptAll = kitHit.every(s => strip(r.action + ' ' + (r.why || '')).includes(s));
  if (kitHit.length && !keptAll) {
    console.error(`  REFUSED  ${r.k || r.find}: rewrites a KIT CONTENTS row; these strings must stay`);
    console.error(`           byte-identical across card, poster, label and inventory: ${kitHit.map(s => JSON.stringify(s)).join(', ')}`);
    refused++; continue;
  }

  const body = '<b>' + r.action + '</b>' +
    (r.why ? '<i class="t-why"' + (r.refOnly ? ' data-ref' : '') + '>' + r.why + '</i>' : '');
  html = html.replace(re, (_, a, __, c) => a + body + c);
  applied++;
}
writeFileSync(file, html);
console.log(`${file}: ${applied} rewritten, ${refused} refused`);
process.exit(refused ? 1 : 0);
