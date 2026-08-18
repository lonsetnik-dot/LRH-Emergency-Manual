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
      { file: 'inventory.js',                  role: 'inventory catalog' },
    ],
  },
  {
    name: 'Blakemore / balloon-tamponade kit',
    location: /ROOM 7/i,
    // Minnesota tube and bronchial blocker deliberately absent: LRH stocks neither, and a kit list
    // that names equipment the department does not own sends someone hunting mid-resuscitation.
    items: ['Sengstaken-Blakemore tube','Two 60 mL syringes',
            'Insufflation manometer','Roller gauze','Scissors taped within reach'],
    artifacts: [
      { file: 'codes/index.html',            role: 'interactive card' },
      { file: 'posters/blakemore/index.html', role: 'wall poster'      },
      { file: 'labels/index.html',            role: 'cabinet label'    },
    ],
  },
  {
    name: 'Epistaxis kit',
    location: /ROOM 7/i,
    items: ['Rapid Rhino', 'Merocel', 'Silver nitrate', 'Foley', 'Oxymetazoline 0.05%'],
    artifacts: [
      { file: 'codes/index.html',  role: 'interactive card' },
      { file: 'labels/index.html', role: 'cabinet label'    },
      { file: 'inventory.js',      role: 'inventory catalog' },
    ],
  },
  {
    name: 'Lung isolation kit',
    location: /ROOM 7/i,
    items: ['TXA'],
    artifacts: [
      { file: 'codes/index.html',  role: 'interactive card' },
      { file: 'labels/index.html', role: 'cabinet label'    },
      { file: 'inventory.js',      role: 'inventory catalog' },
    ],
  },
  {
    name: 'SALAD suction kit',
    // 'Spare ETT 8.0' is deliberately NOT asserted: the card names the tube in prose rather than as
    // a kit line, and forcing the two to match word-for-word would make the card read worse.
    location: /ROOM 7/i,
    items: ['DuCanto rigid catheter x2', 'HI-D Big Stick', 'Meconium aspirator'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'cabinet label'    },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Pigtail thoracostomy kit',
    location: /ROOM 7/i,
    items: ['Pigtail catheter with stiffener', 'Introducer needle', 'Marked guidewire',
            'Sequential dilators', 'Lidocaine 1%'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'cabinet label'    },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    /* The nursing half of the same procedure, and its own physical bag. Asserted
       separately because a provider who reaches into the insertion kit for a
       dressing will not find one — the two bags share a shelf, not contents. */
    name: 'Chest Tube Dressing Kit (nursing)',
    location: /ROOM 7|Room 7/i,
    items: ['Large Op-Site 6x8', '4x4 drain sponge', '2x2 gauze',
            'Xeroform (or petroleum) dressing 5x9', 'Safety pin', '3 inch tape',
            'Chest tube clamp', 'Chest tube troubleshooting resource'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    // Rebuilt 2026-08-13 from the kit assembled for providers. The poster is asserted here too:
    // it now carries a second sheet that IS the check card taped beside the bag, so a contents
    // change that missed it would put a wrong list on the wall next to a right list in the app.
    name: 'Chest Tube Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['ChloraPrep 10.5 mL swab', 'Povidone-iodine swab', 'Silk 0 sutures',
            'Scalpel No. 10', 'Blunt needle', '10 mL syringe', '25 gauge 1½ needle',
            'Long curved blunt scissors', 'Large needle driver', 'Large Kelly clamp',
            'Medium Kelly clamp', 'Fenestrated drape', 'Half drape'],
    /* Superseded 2026-08-14 by the department's own typed kit sheet, which ends
       an argument two Claude sessions had been having about this bag. BOTH preps
       are in it — the earlier lists carried one or the other. Four items that
       were on the previous list are asserted ABSENT so they cannot creep back in
       one file at a time: the Foley, the toothed forceps, the Mayo scissors and
       the Tegaderm. PPE and the dressing supplies stay absent for the original
       reason — they are a different drawer and a different bag, and a provider
       who reaches into this one for a dressing loses the same minute as one
       missing a clamp. The strings may still appear as "not in this bag" prose;
       see the per-artifact allowance in the runner below. */
    absent: ['Gown, gloves, mask, eye protection',
             'Foley catheter 16 Fr', 'Toothed tissue forceps', 'Curved Mayo scissors', 'Large Tegaderm'],
    artifacts: [
      { file: 'procedures/index.html',          role: 'interactive card' },
      { file: 'labels/index.html',              role: 'kit card + build sheet' },
      { file: 'inventory.js',                   role: 'inventory catalog' },
      { file: 'posters/chest-tube/index.html',  role: 'wall poster + kit check card' },
    ],
  },
  {
    name: 'Thoracotomy Tray',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Finochietto rib spreader', 'Gigli saw with handles', 'Vascular (aortic) cross-clamp'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Burr Hole Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Codman disposable perforator', 'Sharp dural hook', 'Bone nibbler'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Central Line Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Triple-lumen catheter 7 Fr, 15–20 cm', 'Scalpel No. 11 blade'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Transvenous Pacing Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Balloon-tipped bipolar pacing catheter 5 Fr', 'Balloon syringe capped at 1.5 mL'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Escharotomy Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Marking pen', 'Topical hemostatic gauze'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Neck Tamponade Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Foley catheter 16 Fr', 'Umbilical tape or clamp'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Junctional Hemorrhage Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Hemostatic gauze', 'Pressure dressing'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'JADA Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['JADA System single-use kit', 'Straight catheter or Foley kit'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
    ],
  },
  {
    name: 'Resuscitation Line Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Introducer sheath 8–9 Fr', 'J-tip guidewire', 'Dilator'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
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

    /* Items a kit must NOT claim to contain.
       Scoped to THIS kit's own span of the file, not the whole file. These
       artifacts describe several kits each, and a string that is wrong for one
       kit is often correct for another sitting a few hundred characters away —
       a Foley 16 Fr does not belong in the chest tube bag and is the entire
       point of the neck tamponade kit. Checking the whole file made asserting
       that impossible: the assertion that mattered most was the one the check
       could not express.
       The span runs from the first of this kit's items to the last, which is
       where any artifact lists contents contiguously. */
    const positions = kit.items.map(i => txt.indexOf(i)).filter(at => at >= 0);
    const from = positions.length ? Math.min(...positions) : 0;
    const to   = positions.length ? Math.max(...positions) + 80 : txt.length;
    const span = txt.slice(from, to);

    const strayed = (kit.absent || []).filter(i => {
      const at = span.indexOf(i);
      if (at < 0) return false;
      /* Still allow a declaration of absence to name the thing it is declaring
         absent: the "not in this bag" pointer in prose, and inventory.js's own
         `absent:[...]` field, which states the same fact as data. Without the
         second one, writing the assertion down in the catalog would trip the
         assertion. */
      const before = span.slice(Math.max(0, at - 160), at);
      return !/not in (this |the )?bag|Also needed|Not in this bag|separate|absent:\s*\[/i.test(before);
    });
    const ok = missing.length === 0 && hasLoc && strayed.length === 0;
    if (!ok) fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${a.file.padEnd(34)} ${a.role}`);
    if (missing.length) console.log(`        missing items: ${missing.join(', ')}`);
    if (strayed.length) console.log(`        listed as kit CONTENTS but is not in this kit: ${strayed.join(', ')}`);
    if (!hasLoc)        console.log(`        storage location does not match ${kit.location}`);
  }
}
console.log(`\n=== ${fail ? fail + ' artifact(s) out of sync' : 'all kits consistent across all artifacts'} ===`);
process.exit(fail ? 1 : 0);
