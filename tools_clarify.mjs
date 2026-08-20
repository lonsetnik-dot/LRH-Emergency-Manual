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

const strip = s => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();
/* A value someone has to ACT on: a number with a unit, a range, or a rate. Deliberately
   loose — a false positive costs a moment's thought, a false negative hides a dose. */
const DOSE = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|mL|ml|L|units?|u\b|mmHg|°C|kg|Fr|J\b|%|\/min|\/hr|mEq|mmol|breaths|beats|h\b|hours?|min\b|minutes?|sec)/gi;

let applied = 0, refused = 0;
for (const r of rewrites) {
  const re = new RegExp(
    '(<input type="checkbox"[^>]*data-k="' + r.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>\\s*<span>)([\\s\\S]*?)(</span>)');
  const m = html.match(re);
  if (!m) { console.error(`  MISSING  ${r.k}`); refused++; continue; }

  const whyDoses = new Set((strip(r.why || '').match(DOSE) || []).map(s => s.toLowerCase().replace(/\s+/g, '')));
  const actDoses = new Set((strip(r.action).match(DOSE) || []).map(s => s.toLowerCase().replace(/\s+/g, '')));
  const hidden = [...whyDoses].filter(d => !actDoses.has(d));
  if (hidden.length && !r.refOnly) {
    console.error(`  REFUSED  ${r.k}: the why hides a value the action does not carry: ${hidden.join(', ')}`);
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
