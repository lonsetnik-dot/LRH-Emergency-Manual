/* LRH Emergency Manual — no square boxes inside the rounded ones (issue #107).
 *
 * The manual's visual language is rounded rectangles: the card shells, the .t-box-* panels and every
 * control carry a radius. But a large number of interior blocks across codes/, peds/ and ob-neonatal/
 * were written with an inline `border:2px solid var(--…)` and no radius, so they rendered as
 * hard-cornered boxes sitting inside rounded ones — roughly seventy of them. That is what Lon was
 * seeing when he wrote "some cards are still rectangular, not round recs".
 *
 * The fix is a pattern-matching rule in design-system.css rather than seventy hand edits, because the
 * next person writing a callout will reach for the same inline border. This suite is the other half
 * of that: it MEASURES the rendered page, so a block the rule does not reach shows up here rather
 * than in someone's eye during a code.
 *
 * WHAT COUNTS AS A CARD, precisely — the definition matters, because a loose one flags every list
 * divider and summary bar in the manual (an earlier pass of this audit reported 1027 "square" blocks
 * in codes/ alone, essentially all of them false):
 *
 *   · a visible border on ALL FOUR sides, at least 1px, none of them `none`/`hidden`
 *   · at least 250 x 44 CSS px — smaller than that is a chip or a control, not a card
 *   · NOT clipped by a rounded ancestor with overflow:hidden, which already rounds it on screen
 *
 * PRINT ARTIFACTS ARE EXEMPT AND MUST STAY SQUARE. A cart drawer label and a VEMS equipment card are
 * guillotined and laminated; a rounded corner on those is wrong on paper, not right. They are listed
 * explicitly below rather than skipped by a wildcard, so adding a new print tool is a decision
 * somebody makes here instead of a silent exemption.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_rounded_cards.mjs
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

/* Every page that renders on a phone screen. */
const SCREENS = ['/', '/codes/', '/peds/', '/trauma/', '/ob-neonatal/', '/procedures/',
  '/clinical-pathways/', '/arrest/', '/tca/', '/airway/', '/neonatal/', '/pph/', '/dystocia/',
  '/equipment-readiness/', '/simulations/', '/conversations/', '/debrief/'];

/* Paper. These are cut square on purpose — see the header. */
const PRINT = ['/labels/', '/vems/'];

const pg = await b.newPage({ viewport: { width: 390, height: 844 } });

const squares = async (path) => {
  const r = await pg.goto(BASE + path + '?from=home', { waitUntil: 'domcontentloaded' }).catch(() => null);
  if (!r || !r.ok()) return null;
  await pg.waitForTimeout(420);
  /* Open every <details>: a collapsed panel still has to be round when opened,
     and half of these blocks live inside one. */
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pg.waitForTimeout(240);
  return pg.evaluate(() => {
    const out = [], seen = new Set();
    document.querySelectorAll('div,article,section,details,aside').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const w = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs['border' + s + 'Width']) || 0);
      if (w.some(v => v < 1)) return;
      const st = ['Top', 'Right', 'Bottom', 'Left'].map(s => cs['border' + s + 'Style']);
      if (st.some(v => v === 'none' || v === 'hidden')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 250 || rect.height < 44) return;
      const rad = Math.max(...['borderTopLeftRadius', 'borderTopRightRadius',
        'borderBottomLeftRadius', 'borderBottomRightRadius'].map(k => parseFloat(cs[k]) || 0));
      if (rad >= 8) return;
      let a = el.parentElement, clipped = false;
      while (a && a !== document.body) {
        const as = getComputedStyle(a);
        if ((parseFloat(as.borderTopLeftRadius) || 0) >= 8 &&
            /hidden/.test(as.overflow + as.overflowX + as.overflowY)) { clipped = true; break; }
        a = a.parentElement;
      }
      if (clipped) return;
      const sig = el.tagName + ':' + (el.id || '') + ':' + (el.className || '').toString();
      if (seen.has(sig)) return; seen.add(sig);
      out.push({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className || '').toString().slice(0, 40),
                 size: Math.round(rect.width) + 'x' + Math.round(rect.height),
                 txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46) });
    });
    return out;
  });
};

console.log('--- 1. every screen is rounded ---');
for (const p of SCREENS) {
  const bad = await squares(p);
  if (bad === null) { ck(`1. [${p}] loads`, 'unreachable', 'ok'); continue; }
  ck(`1. [${p}] no square card-like blocks`, bad.length, 0);
  bad.slice(0, 12).forEach(x =>
    console.log(`       ${x.tag}${x.id ? '#' + x.id : ''} ${x.cls || '(no class)'} ${x.size} | ${x.txt}`));
}

/* The other direction, and it matters as much: the rule must not creep onto
   paper. If someone widens the selector, a laminated label starts printing with
   rounded corners and the first anyone knows is at the guillotine. */
console.log('\n--- 2. paper is still square ---');
for (const p of PRINT) {
  const bad = await squares(p);
  if (bad === null) { ck(`2. [${p}] loads`, 'unreachable', 'ok'); continue; }
  ck(`2. [${p}] print sheets are still cut square`, bad.length > 0, true);
}

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
