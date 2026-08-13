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
    name: 'Chest Tube Kit',
    location: /ROOM 7|TRAUMA CART|OB \/ NEONATAL CART/i,
    items: ['Scalpel No. 10 blade', 'Kelly clamps', 'Heavy suture 0 or 2-0',
            'Chlorhexidine prep', 'Sterile drapes — 1 regular, 1 fenestrated'],
    /* Corrected on the cart walk 2026-08-13: PPE lives in the Trauma Cart PPE
       drawer and the dressing supplies are their own bag, so neither may be
       listed as CONTENTS of this one. Listing them here is what sends someone
       rummaging in a chest-tube bag for a gown while a patient waits, so the
       absence is asserted rather than left to whoever edits next. The strings
       may still appear as "not in this bag" prose — see absentFrom. */
    absent: ['Gown, gloves, mask, eye protection', 'Gauze packs + occlusive dressing + tape'],
    artifacts: [
      { file: 'procedures/index.html', role: 'interactive card' },
      { file: 'labels/index.html',     role: 'kit card + build sheet' },
      { file: 'inventory.js',          role: 'inventory catalog' },
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
    /* Items a kit must NOT claim to contain. Matched only where the artifact
       presents contents, so the "not in this bag — it is in the Trauma Cart"
       pointer is allowed to name the thing it is pointing at. */
    const strayed = (kit.absent || []).filter(i => {
      const at = txt.indexOf(i);
      if (at < 0) return false;
      const before = txt.slice(Math.max(0, at - 160), at);
      return !/not in (this |the )?bag|Also needed|Not in this bag|separate/i.test(before);
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
