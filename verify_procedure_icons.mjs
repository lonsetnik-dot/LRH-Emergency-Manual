/* LRH Emergency Manual — the procedure icon set (design/ICONOGRAPHY.md).
 *
 * These glyphs are a clinical claim, not decoration: each one says "this is the anatomy, and THIS
 * red mark is what you are about to do to it." Two failure modes matter.
 *
 * 1. DRIFT. The same procedure has to look the same on the card, the poster and the label. The
 *    equipment icons learned this the hard way (issue #131) — so this suite compares the RENDERED
 *    markup across pages rather than trusting that both files include procedure-icons.js.
 * 2. A SILENT MISS. A card whose glyph fails to bind renders an empty box, which looks like a
 *    styling nit and is actually a missing landmark. Every configured card is asserted filled.
 *
 * The grammar itself is asserted too, because it is what makes the set readable at 16px:
 * anatomy in ink, exactly one red idea, nothing filled but action tips.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_procedure_icons.mjs
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

/* Harvest every bound glyph from a page: key -> rendered inner SVG markup. */
const glyphsOf = async (path) => {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(BASE + path, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(350);
  const out = await pg.evaluate(() => {
    const map = {};
    document.querySelectorAll('.pglyph[data-proc]').forEach(el => {
      const svg = el.querySelector('svg');
      map[el.getAttribute('data-proc')] = svg ? svg.innerHTML.replace(/\s+/g, ' ').trim() : '';
    });
    /* Which glyphs sit inside which card — the placement, not just the presence. */
    const inCard = {};
    document.querySelectorAll('article[id]').forEach(a => {
      inCard[a.id] = [...a.querySelectorAll('.pglyph[data-proc]')].map(el => el.getAttribute('data-proc'));
    });
    return { map, inCard, api: typeof PROC_ICONS === 'object' ? PROC_ICONS.keys().length : 0,
             cards: typeof PROC_ICONS === 'object' ? PROC_ICONS.cards() : {} };
  });
  await pg.close();
  return { ...out, errs };
};

/* ---- 1. procedures/ — every card in the config carries its glyph ---- */
const proc = await glyphsOf('/procedures/?from=home');
ck('1. procedures/ loads with no page errors', proc.errs.length, 0);
ck('1. the shared module is injected', proc.api > 15, true);
const cardMap = proc.cards;
const wantKeys = Object.values(cardMap);
ck('1. every configured card renders a glyph',
  wantKeys.filter(k => !proc.map[k]).join(',') || 'none', 'none');
ck('1. and no card renders an empty glyph box',
  Object.keys(proc.map).filter(k => !proc.map[k]).join(',') || 'none', 'none');
ck('1. the card->figure map covers the procedure cards', Object.keys(cardMap).length >= 14, true);

/* PLACEMENT, not just presence. Harvesting by data-proc says the glyph rendered somewhere on the
   page; it does not say it rendered on the right card. Anchoring the insert on a CSS class four
   cards did not carry put escharotomy's glyph on the canthotomy heading and thoracotomy's on
   transvenous pacing — a wrong picture over a right title, which is worse than no picture. */
/* A card may carry a SECOND procedure's glyph only when it covers that procedure — card 01 is
   "Chest Tube / Finger Thoracostomy" and its arrest jump row is drawn with the finger glyph,
   because illustrating a no-tube procedure with a tube is exactly the mis-teaching this suite
   exists to stop. Enumerated rather than allowed generally: an unlisted extra glyph is still
   the escharotomy-on-the-canthotomy-heading defect. */
const ALSO = { c01: ['finger'] };
ck('1. each card carries its OWN glyph, plus only the ones it covers',
  Object.entries(cardMap)
    .filter(([card, key]) => {
      const got = proc.inCard[card] || [];
      const allowed = new Set([key, ...(ALSO[card] || [])]);
      return !got.includes(key) || got.some(k => !allowed.has(k));
    })
    .map(([card, key]) => card + '=' + ((proc.inCard[card] || []).join(',') || 'none') + '(want ' + key + (ALSO[card] ? ' +' + ALSO[card].join(',') : '') + ')')
    .join(' ') || 'none', 'none');
ck('1. no glyph landed on an unmapped card',
  Object.entries(proc.inCard)
    .filter(([card, keys]) => keys.length && !cardMap[card])
    .map(([card, keys]) => card + '=' + keys.join(','))
    .join(' ') || 'none', 'none');

/* Penetrating neck trauma was left un-iconed at first review, then wired up on request — the
   guard is now that it binds the 'neck' figure specifically, not a leftover/mismatched key. */
ck('1. penetrating neck trauma (c11) carries the neck glyph', cardMap.c11, 'neck');

/* ---- 2. NO DRIFT — cross-linked pages draw the identical figure ---- */
const codes = await glyphsOf('/codes/?from=home');
const ob = await glyphsOf('/ob-neonatal/?from=home');
ck('2. codes/ loads clean', codes.errs.length, 0);
ck('2. ob-neonatal/ loads clean', ob.errs.length, 0);
ck('2. codes/ carries the cross-linked airway glyphs',
  ['rsi', 'fona'].filter(k => !codes.map[k]).join(',') || 'none', 'none');
ck('2. ob-neonatal/ carries the cross-linked OB glyphs',
  ['uvc', 'hyst'].filter(k => !ob.map[k]).join(',') || 'none', 'none');

/* SALAD lives on a procedures card and RSI on a codes card, and design/ICONOGRAPHY.md §2 says they share
   a base drawing. If someone pastes one inline, the shared prefix breaks. */
const salad = proc.map.salad || '', rsi = codes.map.rsi || '';
const sharedPrefix = (a, c) => { let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++; return i; };
ck('2. RSI and SALAD still share the face base', sharedPrefix(salad, rsi) > 200, true);

/* ---- 3. THE GRAMMAR (design/ICONOGRAPHY.md §1 and §4) ---- */
const all = { ...proc.map, ...codes.map, ...ob.map };
const keys = Object.keys(all);
ck('3. glyphs are on the 48-grid', (await (async () => {
  const pg = await b.newPage();
  await pg.goto(BASE + '/procedures/?from=home', { waitUntil: 'networkidle' });
  const boxes = await pg.evaluate(() => [...document.querySelectorAll('.pglyph svg')].map(s => s.getAttribute('viewBox')));
  await pg.close();
  return [...new Set(boxes)].join('|');
})()), '0 0 48 48');
ck('3. every glyph carries an action in red',
  keys.filter(k => !/--red/.test(all[k])).join(',') || 'none', 'none');
ck('3. every glyph carries anatomy in ink',
  keys.filter(k => !/currentColor/.test(all[k])).join(',') || 'none', 'none');
/* "nothing filled except action tips": the only fills allowed are the red dots and the ink2
   secretion dots, all declared via style="fill:...". A fill= attribute means someone drew a solid. */
ck('3. nothing is drawn as a filled shape',
  keys.filter(k => /\sfill="(?!none)/.test(all[k])).join(',') || 'none', 'none');

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
