/* LRH Emergency Manual — issue #24 (massive hematemesis) + #28 (Blakemore poster QR).
 *
 * The definition of done for a new card in this manual is not "the card renders". It is the whole
 * loop: card -> stated location -> cabinet label -> printed poster -> QR back to the card -> a row
 * in the system map. Each of those lives in a different self-contained file with no shared
 * dependency (CLAUDE.md rule 1), so nothing but a test like this keeps them attached to each other.
 *
 *     python3 -m http.server 8123      # from the repo root, in another terminal
 *     node verify_ws24_hematemesis.mjs
 *
 * Or against a deployed URL:
 *     BASE=https://lrhemergencymanual.net node verify_ws24_hematemesis.mjs
 */
let chromium;
import { readFileSync } from 'node:fs';
const SITE=JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url),'utf8'));
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const launchOpts = process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {};
let b;
try { b = await chromium.launch(launchOpts); }
catch (e) { console.error('Could not launch Chromium: ' + e.message); process.exit(2); }
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 1400 } });
pg.on('pageerror', e => errs.push('codes: ' + e));
pg.on('console', m => { if (m.type() === 'error') errs.push('codes console: ' + m.text()); });

/* ---- 1. the card exists, and the menu reaches it ---- */
await pg.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
ck('1. card 23 present', await pg.locator('#c23').count(), 1);
ck('1. menu tile for c23 present', await pg.locator('a[href="#c23"]').first().count(), 1);
await pg.locator('a[href="#c23"]').first().click();
await pg.waitForTimeout(400);
ck('1. tile navigates to c23', (await pg.evaluate(() => location.hash)), '#c23');
ck('1. c23 is the visible card', await pg.locator('#c23').isVisible(), true);

/* ---- 2. clinical content that must not be silently dropped ---- */
/* textContent, not innerText: the clarity pass moved each row's reasoning into a .t-why tier
   that is display:none until the WHY control is tapped. innerText omits hidden text, so a fact
   that is present in the card and one tap away read as missing. Whether it is visible right now
   is verify_checklist_clarity.mjs's question; this suite's question is whether the fact is in
   the card at all. */
const card = (await pg.locator('#c23').evaluate(el => el.textContent)).replace(/\s+/g, ' ');
const has = (re) => re.test(card);
ck('2. blood-not-crystalloid stated', has(/blood, not crystalloid/i), true);
ck('2. permissive hypotension stated', has(/Permissive hypotension/i), true);
ck('2. Hb thresholds 7 and 8 present', has(/≥7 g\/dL/) && has(/~8 g\/dL/), true);
ck('2. octreotide bolus + infusion', has(/octreotide 50 mcg IV, then 50 mcg\/hr/i), true);
ck('2. ceftriaxone 1 g', has(/Ceftriaxone 1 g IV/i), true);
ck('2. ketamine 0.5 + roc 1.5', has(/Ketamine 0\.5 mg\/kg/i) && has(/rocuronium 1\.5 mg\/kg/i), true);
ck('2. metoclopramide 10 mg', has(/Metoclopramide 10 mg IV/i), true);
ck('2. aortoenteric fistula warning', has(/aortoenteric fistula/i), true);
ck('2. endoscopy timing 12 h / 24 h', has(/within 12 h(?:ours)?\b/i) && has(/within 24 h(?:ours)?\b/i), true);
/* Transfer line comes from site.config.json — generic edition prints its placeholder. */
ck('2. transfer line printed', card.includes(SITE.transferPhone), true);

/* ---- 3. where more than one course is defensible, the card must OFFER BOTH ---- */
// The project's rule: print them as lettered options with the source on each, rather than quietly
// picking a winner. A card that resolves it silently is the failure mode this checks for.
ck('3. PPI given as two lettered options', has(/\bA:\s*no PPI in the ED/i) && has(/First10EM/i)
  && has(/\bB:\s*pantoprazole 80 mg bolus,? then 8 mg\/hr/i) && has(/WikEM/i), true);
ck('3. TXA contraindicated, HALT-IT named', has(/do NOT give TXA for GI bleeding/i) && has(/HALT-IT/), true);

/* ---- 4. digital -> physical: the card says where the kit is ---- */
ck('4. card states the location', has(/ROOM 7 \(RESUS BAY\) CABINET · GI HEMORRHAGE \/ BLAKEMORE KIT/i), true);
ck('4. card links to the door label', await pg.locator('#c23 a[href="../labels/#loc-room7"]').count(), 1);
ck('4. card links to the poster', await pg.locator('#c23 a[href="../posters/blakemore/"]').count() > 0, true);

/* ---- 5. checkboxes are wired like every other card ---- */
const boxes = await pg.locator('#c23 input[type=checkbox]').count();
ck('5. checklist has items', boxes > 20, true);
await pg.locator('#c23 input[type=checkbox]').first().check();
ck('5. first item checks', await pg.locator('#c23 input[type=checkbox]').first().isChecked(), true);

/* ---- 6. search finds it ---- */
// The manual-wide search index lives on the landing page, not inside codes/ — a new card is
// unfindable until it is added there, which is easy to forget because the card itself works fine.
const pq = await b.newPage({ viewport: { width: 390, height: 1400 } });
pq.on('pageerror', e => errs.push('landing: ' + e));
await pq.goto(BASE + '/', { waitUntil: 'networkidle' });
const q = await pq.$('input[type=search], #q, input[type=text]');
if (q) {
  await q.fill('hematemesis'); await pq.waitForTimeout(300);
  ck('6. search "hematemesis" finds card 23', /Massive Hematemesis/i.test((await pq.textContent('body')) || ''), true);
  await q.fill(''); await q.fill('blakemore'); await pq.waitForTimeout(300);
  ck('6. search "blakemore" finds card 23', /Massive Hematemesis/i.test((await pq.textContent('body')) || ''), true);
} else ck('6. search input found', 'no', 'yes');

/* ---- 7. physical -> digital: the poster's QR resolves to the card (#28) ---- */
const pp = await b.newPage({ viewport: { width: 900, height: 1300 } });
pp.on('pageerror', e => errs.push('poster: ' + e));
await pp.goto(BASE + '/posters/blakemore/', { waitUntil: 'networkidle' });
ck('7. poster has a QR block', await pp.locator('.qr').count(), 1);
const qrLabel = await pp.locator('.qr svg').first().getAttribute('aria-label');
ck('7. QR is labelled for card 23', /card 23/i.test(qrLabel || ''), true);
const qrText = (await pp.locator('.qr .qrtext').innerText()).replace(/\s+/g, ' ');
ck('7. QR prints its destination', qrText.includes(SITE.domain + '/codes/?from=home#c23'), true);
ck('7. poster location matches the card', /ROOM 7 \(RESUS BAY\) CABINET · GI HEMORRHAGE \/ BLAKEMORE KIT/i
  .test((await pp.locator('.loc').innerText()).replace(/\s+/g, ' ')), true);

/* ---- 8. the cabinet label exists and carries a QR of its own ---- */
const pl = await b.newPage({ viewport: { width: 1200, height: 1400 } });
pl.on('pageerror', e => errs.push('labels: ' + e));
await pl.goto(BASE + '/labels/', { waitUntil: 'networkidle' });
const door = pl.locator('.door', { hasText: 'GI Hemorrhage' }).first();
ck('8. GI Hemorrhage door label rendered', await door.count(), 1);
const doorTxt = (await door.innerText()).replace(/\s+/g, ' ');
ck('8. door label lists the tube', /Sengstaken-Blakemore tube/.test(doorTxt), true);
ck('8. door label lists the manometer', /Insufflation manometer/.test(doorTxt), true);
ck('8. door label carries a QR', await door.locator('svg[aria-label^="QR code to"]').count(), 1);
ck('8. door QR points at card 23',
  /codes\/\?from=home#c23$/.test(await door.locator('svg[aria-label^="QR code to"]').first().getAttribute('aria-label') || ''), true);
// the icon must be the balloon tube, not a recycled NG tube
ck('8. door label uses the blakemore pictogram',
  await door.locator('svg[aria-label="blakemore"]').count(), 1);

/* ---- 9. the system map picked the card up ---- */
const ps = await b.newPage({ viewport: { width: 1400, height: 1400 } });
ps.on('pageerror', e => errs.push('system: ' + e));
await ps.goto(BASE + '/system/', { waitUntil: 'networkidle' });
const row = ps.locator('tbody tr', { hasText: 'Massive Hematemesis' }).first();
ck('9. system map has a row for card 23', await row.count(), 1);
const rowTxt = (await row.innerText()).replace(/\s+/g, ' ');
ck('9. map row shows the poster', /blakemore/i.test(rowTxt), true);
ck('9. map row shows the QR is connected', /QR → card/.test(rowTxt), true);
ck('9. map row shows where it lives', /Room 7 cabinets/i.test(rowTxt), true);
ck('9. map row shows the kit is defined', /kit defined/i.test(rowTxt), true);
ck('9. Room 7 index lists GI Hemorrhage',
  /GI Hemorrhage/.test((await ps.locator('.places').innerText()).replace(/\s+/g, ' ')), true);

/* ---- 10. nothing broke ---- */
ck('10. no page/console errors anywhere', errs.length, 0);
if (errs.length) errs.forEach(e => console.log('    ' + e));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
