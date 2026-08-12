/* LRH Emergency Manual — the VEMS kit (/vems/), issue #131.
 *
 * This tool's output is PAPER. Almost everything that can go wrong with it is invisible on screen and
 * expensive at the laminator: a card deck that silently spills onto an extra sheet, a poster that
 * breaks across two pages, an equipment card whose glyph does not match the drawer it names. So this
 * suite renders the real print output to PDF and counts pages, rather than only asserting the DOM.
 *
 * The hardest-asserted thing is the one the issue actually asked for: a VEMS equipment card and the
 * cart drawer label for the same item must carry the SAME glyph. That is checked by loading both
 * pages and comparing the rendered SVG markup — not by trusting that both import the same file.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_vems.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };

const errs = [], reqs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

await pg.goto(BASE + '/vems/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(350);

/* ---- CONFIG-DRIVEN EXPECTATIONS (the #117 convention) ----------------------
   Read the tool's own SITE block, and read the deck's own shape off the page,
   so a site that adds a case, swaps a decoy or re-maps a drawer stays green.
   What stays written out here is what a fork must NOT be able to localize away:
   that the run sheet is separate from the participant decks, that the poster is
   one sheet, that the case deteriorates before it recovers, and the PHI guard. */
const CFG = await pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /vems/ does not expose window.SITE'); process.exit(1); }

/* ---- 1. loads clean and offline-safe ---- */
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. the splash is dismissed by ?from=', await pg.locator('#betasplash').count(), 0);
ck('1. version and last-reviewed are stamped',
  new RegExp('v' + CFG.version + ' · last reviewed ' + CFG.lastReviewed).test(await pg.locator('.verstamp').first().innerText()), true);
ck('1. the standard training disclaimer is present',
  /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await pg.innerText('body')), true);
ck('1. in-situ sim safety banner is up', /IN-SITU SIM SAFETY/.test(await pg.innerText('body')), true);

/* ---- 2. THE ISSUE'S ACTUAL ASK — a card's glyph IS the drawer's glyph ----
   Load the cart labels, harvest every icon it renders by name, then assert that
   every glyph the VEMS deck draws under the same name is byte-identical. This
   is checked across the two rendered pages rather than by trusting that both
   include equipment-icons.js, because "both import the shared file" is exactly
   the assumption that quietly stops being true when someone pastes an icon
   inline to fix a one-off. */
const glyphsOf = async (path) => {
  const p2 = await b.newPage();
  await p2.goto(BASE + path, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(300);
  const map = await p2.evaluate(() => {
    const out = {};
    document.querySelectorAll('svg[role="img"]').forEach(s => {
      const n = s.getAttribute('aria-label');
      if (n && s.innerHTML.trim()) out[n] = s.innerHTML.replace(/\s+/g, ' ').trim();
    });
    return out;
  });
  await p2.close();
  return map;
};
const labelGlyphs = await glyphsOf('/labels/?from=home');
const vemsGlyphs  = await glyphsOf('/vems/?from=home');
const shared = Object.keys(vemsGlyphs).filter(k => labelGlyphs[k]);
ck('2. the two pages share icon names at all', shared.length > 5, true);
const mismatched = shared.filter(k => labelGlyphs[k] !== vemsGlyphs[k]);
ck('2. every shared glyph is identical to the cart label\'s', mismatched.join(',') || 'none', 'none');

/* Every equipment card must actually draw something. A missing icon key is a
   blank square on a laminated card — silent, and useless in the room. */
ck('2. no equipment card has an empty glyph',
  await pg.evaluate(() => [...document.querySelectorAll('.vchip svg, .cardgrid.eq .pcard svg')].filter(s => !s.innerHTML.trim()).length), 0);

/* ---- 3. the deck's shape, read from the page ---- */
const deck = await pg.evaluate(() => ({
  chips:   document.querySelectorAll('.vchip').length,
  eq:      document.querySelectorAll('.cardgrid.eq .pcard').length,
  mon:     document.querySelectorAll('.cardgrid.mon .pcard').length,
  decoys:  document.querySelectorAll('.vchip.decoy').length,
  beats:   document.querySelectorAll('.rs .rb').length,
  posters: document.querySelectorAll('.d-poster').length,
  sheets:  document.querySelectorAll('.d-sheet').length,
}));
ck('3. the screen preview shows every equipment card', deck.chips, deck.eq);
ck('3. there is exactly one patient poster', deck.posters, 1);
ck('3. there is exactly one facilitator run sheet', deck.sheets, 1);
ck('3. the deck carries decoy cards (a choice, not a checklist)', deck.decoys > 0, true);
ck('3. the run sheet has a beat block per beat plus setup and debrief', deck.beats >= 5, true);

/* ---- 4. the case has to actually deteriorate, then recover ----
   Universal to this case, not localizable: a failed-airway drill whose sats
   never fall is not the drill. Read the monitor cards in order off the page. */
const sats = await pg.evaluate(() =>
  [...document.querySelectorAll('.cardgrid.mon .pcard')].map(c => parseInt(c.querySelector('.monrow .v').textContent, 10)));
ck('4. every monitor card carries a numeric SpO₂', sats.some(isNaN), false);
ck('4. the sat falls to a CICO-range low', Math.min(...sats) < 75, true);
ck('4. the lowest sat comes before the last card (it recovers after the neck)',
  sats.indexOf(Math.min(...sats)) < sats.length - 1, true);
ck('4. the last card is better than the worst', sats[sats.length - 1] > Math.min(...sats), true);

/* ---- 5. cart locations are sourced, and doubt is carried through ----
   inventory.js flags a location `verify:true` when it is believed but not
   confirmed on a cart walk. A drill that sends someone confidently to the wrong
   drawer teaches the wrong drawer, so the doubt has to reach the card. */
const locs = await pg.evaluate(() => [...document.querySelectorAll('.cardgrid.eq .pcard .lo')].map(e => e.textContent.trim()));
ck('5. every equipment card names a location', locs.filter(t => !t).length, 0);
ck('5. at least one location came from the inventory map', locs.some(t => /drawer|Broselow|Room 7/i.test(t)), true);
ck('5. unconfirmed locations say so on the card', locs.some(t => /CONFIRM ON YOUR CART/.test(t)), true);

/* ---- 6. PHI + state: this tool holds nothing but a theme preference ---- */
const keys = await pg.evaluate(() => Object.keys(localStorage));
ck('6. localStorage holds only the shared theme preference',
  keys.filter(k => k !== 'lrh-pref-theme').join(',') || 'none', 'none');
ck('6. nothing is written to sessionStorage', await pg.evaluate(() => sessionStorage.length), 0);

/* ---- 7. THE PAPER — render each deck exactly as its button does ----
   Page counts are derived from the deck's own size and the sheet geometry the
   renderers use, so adding a case or a card changes the expectation with it. */
const PER_MON = 4, PER_EQ = 9;
const expectedCardSheets = Math.ceil(deck.mon / PER_MON) + Math.ceil(deck.eq / PER_EQ);
const pdfPages = async (only) => {
  await pg.evaluate(d => {
    document.body.classList.remove('only-poster', 'only-cards', 'only-sheet');
    if (d) document.body.classList.add('only-' + d);
  }, only);
  const buf = await pg.pdf({ format: 'Letter', printBackground: true,
    margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' } });
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};
ck('7. the patient poster prints on exactly one sheet', await pdfPages('poster'), 1);
ck(`7. the card deck prints on exactly ${expectedCardSheets} sheets (${deck.mon} monitor + ${deck.eq} equipment)`,
  await pdfPages('cards'), expectedCardSheets);
const sheetPages = await pdfPages('sheet');
ck('7. the facilitator run sheet is at most two sheets', sheetPages <= 2 && sheetPages >= 1, true);

/* The run sheet must NOT come out with the participant-facing decks — it holds
   the curveballs and the answers. This is the one print rule that is a safety
   rule rather than a convenience. */
await pg.evaluate(() => {
  document.body.classList.remove('only-poster', 'only-cards', 'only-sheet');
  document.body.classList.add('only-cards');
});
await pg.emulateMedia({ media: 'print' });
ck('7. printing the deck does not print the run sheet', await pg.locator('.d-sheet').isVisible(), false);
ck('7. printing the deck does not print the poster', await pg.locator('.d-poster').isVisible(), false);
await pg.evaluate(() => {
  document.body.classList.remove('only-cards');
  document.body.classList.add('only-sheet');
});
ck('7. printing the run sheet does not print the cards', await pg.locator('.cardgrid.eq').first().isVisible(), false);
await pg.emulateMedia({ media: 'screen' });
await pg.evaluate(() => document.body.classList.remove('only-poster', 'only-cards', 'only-sheet'));

/* ---- 8. it stays wired into the rest of the manual ---- */
const hrefs = await pg.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
ck('8. links back to the manual', hrefs.some(h => /^\.\.\/\?from=/.test(h)), true);
ck('8. links to the airway ladder', hrefs.some(h => /airway\//.test(h)), true);
ck('8. links to the FONA card', hrefs.some(h => /codes\/.*c18/.test(h)), true);
ck('8. links to its sibling simulation script', hrefs.some(h => /simulations\/.*s09/.test(h)), true);
ck('8. links to the debrief card', hrefs.some(h => /conversations\/.*c04/.test(h)), true);
ck('8. cites the VEMS source by DOI', /10\.54531\/NDXV6633/.test(await pg.innerText('body')), true);
ck('8. states that it adds no clinical values of its own',
  /adds no clinical values of its own/i.test(await pg.innerText('body')), true);

/* ---- 9. discoverable ---- */
const home = await b.newPage();
await home.goto(BASE + '/?from=tool', { waitUntil: 'networkidle' });
await home.waitForTimeout(250);
ck('9. the landing page has a VEMS tile', await home.locator('a[href*="vems/"]').count() > 0, true);
for (const term of ['vems', 'mental simulation', 'card deck']) {
  await home.fill('#q', term);
  await home.waitForTimeout(180);
  const first = await home.evaluate(() => {
    const a = document.querySelector('#results a');
    return a ? a.getAttribute('href') : '';
  });
  ck(`9. searching "${term}" surfaces the kit first`, /vems/.test(first), true);
}
await home.close();

ck('10. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('10. still no off-origin requests after the whole run', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
