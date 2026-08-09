/* LRH Emergency Manual — cross-artifact consistency check.
 *
 * The system only works if the SAME kit is described identically wherever it appears:
 * the interactive card, the wall poster, and the cart label. These live in separate
 * self-contained HTML files by design (CLAUDE.md rule 1: no shared dependencies), so
 * nothing stops them drifting apart — which is exactly what happened to the poster
 * page counts and the drawer USED-BY mappings before anyone noticed.
 *
 * This asserts, per kit, that every item name appears in every artifact that claims to
 * describe it, and that the storage location agrees.
 *
 *     node verify_kit_consistency.mjs
 *
 * Add a KIT entry whenever a physical kit gets a label.
 */
import fs from 'fs';

const KITS = [
  {
    name: 'Canthotomy kit',
    location: /DRAWER 6/i,
    items: ['3 mL syringe','Needle to draw','Needle to inject',
            'Mosquito clamp','Toothed forceps','Blunt-tipped iris scissors'],
    artifacts: [
      { file: 'procedures/index.html',        role: 'interactive card' },
      { file: 'posters/canthotomy/index.html', role: 'wall poster'      },
      { file: 'labels/index.html',             role: 'cart label'       },
    ],
  },
];

// Compare on visible text: strip tags/entities so <b>3 mL syringe</b> matches "3 mL syringe".
const textOf = f => fs.readFileSync(f, 'utf8')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&middot;/g, '·')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

let fail = 0;
for (const kit of KITS) {
  console.log('\n' + kit.name);
  for (const a of kit.artifacts) {
    let txt;
    try { txt = textOf(a.file); }
    catch { console.log(`  FAIL  ${a.file} — unreadable`); fail++; continue; }

    const missing = kit.items.filter(i => !txt.includes(i));
    const hasLoc  = kit.location.test(txt);
    const ok = missing.length === 0 && hasLoc;
    if (!ok) fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${a.file.padEnd(34)} ${a.role}`);
    if (missing.length) console.log(`        missing items: ${missing.join(', ')}`);
    if (!hasLoc)        console.log(`        storage location does not match ${kit.location}`);
  }
}
console.log(`\n=== ${fail ? fail + ' artifact(s) out of sync' : 'all kits consistent across all artifacts'} ===`);
process.exit(fail ? 1 : 0);
