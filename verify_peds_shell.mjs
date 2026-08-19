/* verify_peds_shell.mjs — peds/ wears the SAME case shell as the live engines.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_peds_shell.mjs
 *
 * Why this suite exists: before this port there were two chromes in the manual —
 * the engines' 56px app bar + collapsing weight ribbon (arrest/, tca/, airway/,
 * neonatal/, pph/, dystocia/) and peds' three-row blue header with an
 * always-open weight form. A clinician moving from the arrest engine to a peds
 * card had to re-learn where the weight goes and how to navigate, mid-code.
 * SHELL.md calls that out as the thing to prevent ("minimum paradigm count").
 *
 * So the assertions below are mostly COMPARATIVE: peds is checked against
 * arrest's live DOM rather than against numbers typed into this file. If the
 * shell changes in the engines and not in peds (or vice versa), this goes red.
 *
 * Card tools take SHELL.md layers 1 (bar), 4 (weight), 8 (timeline) and 9
 * (reset) and omit 2/3/6/7 entirely — "a layer a tool doesn't need is absent
 * entirely, never left empty" — so the absence of the strip/dock is asserted
 * too, not just the presence of the bar.
 */

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = process.env.BASE || 'http://localhost:8123';
const SHOTDIR = process.env.SHOTDIR || null;
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};
const ok = (name, cond, detail) => ck(name, cond ? true : (detail || false), true);
async function shot(pg, name, clip) {
  if (!SHOTDIR) return;
  try { await pg.screenshot({ path: SHOTDIR + '/' + name + '.png', clip }); console.log('     shot: ' + name + '.png'); }
  catch (e) { console.log('     shot FAILED: ' + name + ' ' + e.message.split('\n')[0]); }
}

const errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

/* Read the shell's shape out of a page: geometry + which parts exist. */
const readShell = () => pg.evaluate(() => {
  const el = id => document.getElementById(id);
  const bar = document.querySelector('.shellbar');
  const cs = bar ? getComputedStyle(bar) : null;
  const box = bar ? bar.getBoundingClientRect() : null;
  const wt = document.querySelector('.shellweight');
  return {
    bar: !!bar,
    barHeight: box ? Math.round(box.height) : 0,
    barDisplay: cs ? cs.display : '',
    barWraps: cs ? cs.flexWrap : '',
    back: !!document.querySelector('.shellback'),
    toolBtn: !!document.querySelector('.shelltool'),
    toolBtnText: (document.querySelector('.shelltool') || {}).textContent || '',
    caret: !!document.querySelector('.shellcaret'),
    sq: !!document.querySelector('.shellsq'),
    more: !!document.querySelector('.shellmore'),
    toolmenu: !!el('toolmenu'),
    moremenu: !!el('moremenu'),
    weightRow: !!wt,
    weightRowH: wt ? Math.round(wt.getBoundingClientRect().height) : 0,
    weightForm: !!document.querySelector('.shellweightform'),
    /* layers a card tool must NOT have */
    strip: !!document.querySelector('.shellstrip'),
    dock: !!document.querySelector('.shelldock'),
    sheet: !!document.querySelector('.sheetwrap')
  };
});

/* ---------------- the reference: arrest/ ---------------- */
await pg.goto(BASE + '/arrest/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
const REF = await readShell();
ok('reference arrest/ exposes a case shell to compare against', REF.bar && REF.weightRow);
if (!REF.bar) { console.error('FATAL: arrest/ has no .shellbar'); process.exit(1); }

/* ---------------- the port: peds/ ---------------- */
await pg.goto(BASE + '/peds/?from=home', { waitUntil: 'networkidle' });
await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
const P = await readShell();

/* --- layer 1: the app bar, same shape as the engines --- */
ok('peds has the shell app bar', P.bar);
ck('peds bar height matches arrest', P.barHeight, REF.barHeight);
ck('peds bar is a flex row like arrest', P.barDisplay, REF.barDisplay);
ok('peds bar never wraps (SHELL.md layer 1)', P.barWraps === 'nowrap' || P.barWraps === '');
ok('peds has the back control', P.back);
ok('peds has the tool-name dropdown', P.toolBtn && P.caret && P.sq);
ok('peds tool button names the tool', /PEDS/.test(P.toolBtnText));
ok('peds has the ⋯ overflow button', P.more);
ok('peds has a tool switcher menu', P.toolmenu);
ok('peds has an overflow menu', P.moremenu);

/* --- layers a CARD tool must omit entirely, not render empty --- */
ok('peds omits the cadence strip (engine-only)', !P.strip);
ok('peds omits the action dock (engine-only)', !P.dock);
ok('peds omits the picker sheet (engine-only)', !P.sheet);

/* --- the old chrome is actually gone, not just hidden behind the new one --- */
const oldChrome = await pg.evaluate(() => ({
  /* the retired three-row header: MANUAL/BACK/PEDS/TIMELINE/RESET/FEEDBACK as
     stacked .ghost buttons on a band-colored bar */
  bandColoredHeader: (() => {
    const h = document.querySelector('.hdr');
    if (!h) return false;
    const bg = getComputedStyle(h).backgroundColor;
    /* the old header painted itself the Broselow band color; the shell bar is
       the flat page ground in every tool */
    const body = getComputedStyle(document.body).backgroundColor;
    return bg !== body && bg !== 'rgba(0, 0, 0, 0)';
  })(),
  strayBackButton: !!document.getElementById('backbtn'),
  alwaysOpenWeightForm: (() => {
    const f = document.getElementById('wtbar');
    return !!f && getComputedStyle(f).display !== 'none';
  })()
}));
ok('peds no longer paints its header the band color (one bar, all tools)', !oldChrome.bandColoredHeader);
ok('peds retired the conditional BACK button (shell back replaces it)', !oldChrome.strayBackButton);
ok('peds weight form is collapsed by default on a phone, like arrest', !oldChrome.alwaysOpenWeightForm);

/* --- layer 4: the weight ribbon behaves like arrest's --- */
ck('peds collapsed weight row height matches arrest', P.weightRowH, REF.weightRowH);
let w = await pg.evaluate(() => ({
  label: document.getElementById('wtdisplay').textContent,
  cls: document.getElementById('wtdisplay').className,
  mark: document.getElementById('wmark').textContent
}));
ok('peds unset weight reads "not set" like arrest', /not set/.test(w.label));
ok('peds unset weight carries the .unset (amber) class', /unset/.test(w.cls));
ck('peds collapsed marker is the expand chevron', w.mark, '▼');

await pg.click('#wtoggle'); await pg.waitForTimeout(200);
ok('peds tapping the ribbon opens the form', await pg.locator('#wtkg').isVisible());
ok('peds focuses the kg field on open (thumb goes straight to typing)',
  await pg.evaluate(() => document.activeElement && document.activeElement.id === 'wtkg'));

await pg.fill('#wtkg', '19'); await pg.dispatchEvent('#wtkg', 'input'); await pg.waitForTimeout(250);
w = await pg.evaluate(() => ({
  label: document.getElementById('wtdisplay').textContent,
  cls: document.getElementById('wtdisplay').className
}));
ok('peds set weight shows the kg', /19 kg/.test(w.label));
ok('peds set weight carries the .set class', /\bset\b/.test(w.cls));
/* The mode-relevant fact lives in the row itself (SHELL.md layer 4: "mode lives
   here, not in a banner"). For peds the dosing-relevant fact is the drawer. */
ok('peds row states the drawer the weight maps to', /BLUE drawer/.test(w.label));
ok('peds row states how the weight was obtained', /measured|estimate/.test(w.label));

await pg.click('#wdone'); await pg.waitForTimeout(200);
ok('DONE ✓ collapses the form', await pg.evaluate(() => document.getElementById('wtbar').style.display === 'none'));
if (SHOTDIR) await shot(pg, 'peds-shell-collapsed-19kg', { x: 0, y: 0, width: 390, height: 200 });

/* the weight still reaches the cards — the port must not break the engine */
ok('weight still drives the dose spans', await pg.evaluate(() => {
  const d = document.querySelector('.wdose');
  return !!d && !d.classList.contains('unset');
}));
ok('weight still drives the airway card', await pg.evaluate(() =>
  /BLUE/.test(document.getElementById('airsizes').innerText)));

/* --- menus behave like the engines' --- */
await pg.click('#toolbtn'); await pg.waitForTimeout(200);
ok('tool switcher opens', await pg.evaluate(() => document.getElementById('toolmenu').style.display !== 'none'));
const menu = await pg.evaluate(() => ({
  rows: Array.from(document.querySelectorAll('#toolmenu .shellmenurow')).map(a => a.textContent.trim()),
  current: (document.querySelector('#toolmenu .shellmenurow.on') || {}).textContent || ''
}));
for (const t of ['Arrest', 'TCA', 'Airway', 'Neonatal', 'PPH', 'Dystocia', 'Manual home']) {
  ok('switcher lists ' + t, menu.rows.some(r => r.includes(t)));
}
ok('switcher marks Peds as the current tool', /Peds/.test(menu.current));
if (SHOTDIR) await shot(pg, 'peds-shell-toolswitcher', { x: 0, y: 0, width: 390, height: 470 });
await pg.click('body', { position: { x: 200, y: 800 } }); await pg.waitForTimeout(200);
ok('tapping elsewhere closes the switcher', await pg.evaluate(() => document.getElementById('toolmenu').style.display === 'none'));

await pg.click('#menubtn'); await pg.waitForTimeout(200);
const more = await pg.evaluate(() => document.getElementById('moremenu').innerText);
ok('⋯ menu offers the case timeline', /timeline/i.test(more));
ok('⋯ menu offers feedback', /feedback/i.test(more));
ok('⋯ menu offers reset, in red', /reset/i.test(more) && await pg.evaluate(() =>
  /rgb\(229, 72, 77\)|rgb\(198, 50, 56\)/.test(getComputedStyle(document.querySelector('#moremenu .danger')).color)));

/* --- layer 8: the timeline opens from BOTH entry points --- */
await pg.click('#tlbtn'); await pg.waitForTimeout(250);
ok('timeline opens from the ⋯ menu', await pg.evaluate(() =>
  getComputedStyle(document.getElementById('summarymodal')).display !== 'none'));
await pg.click('#summaryclose'); await pg.waitForTimeout(200);

/* --- layer 9: ONE reset path — both controls run peds' modal confirm --- */
await pg.click('#menubtn'); await pg.waitForTimeout(150);
await pg.click('#resetbtn'); await pg.waitForTimeout(250);
ok('reset from the ⋯ menu raises the confirm modal (not an unguarded wipe)',
  await pg.evaluate(() => !!document.getElementById('resetmodal')));
await pg.click('#resetmodalcancel').catch(() => {}); await pg.waitForTimeout(200);

/* --- ≥768px: the inline items replace the ⋯, as in the engines --- */
const wide = await ctx.newPage();
const werrs = [];
wide.on('pageerror', e => werrs.push(String(e)));
await wide.setViewportSize({ width: 900, height: 900 });
await wide.goto(BASE + '/peds/?from=home', { waitUntil: 'networkidle' });
/* the context shares localStorage with the phone page above, which committed a
   weight — clear it so "expanded until confirmed" is tested from a clean case */
await wide.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await wide.reload({ waitUntil: 'networkidle' });
await wide.waitForTimeout(300);
const W = await wide.evaluate(() => {
  const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return {
    more: vis('menubtn'), tl: vis('summarybtn'), reset: vis('resetwide'),
    phoneBack: vis('backlink'), wideBack: vis('backlinkwide'),
    formOpen: (() => { const f = document.getElementById('wtbar'); return !!f && getComputedStyle(f).display !== 'none'; })()
  };
});
ok('≥768px hides the ⋯ overflow', !W.more);
ok('≥768px shows TIMELINE inline', W.tl);
ok('≥768px shows RESET inline', W.reset);
ok('≥768px swaps the phone ‹ for the MANUAL › breadcrumb', !W.phoneBack && W.wideBack);
ok('≥768px opens the weight form by default (nothing entered yet)', W.formOpen);
if (SHOTDIR) await shot(wide, 'peds-shell-wide', { x: 0, y: 0, width: 900, height: 220 });

/* --- back link honors ?from=<tool>, so a mid-code hop returns where it came from --- */
await pg.goto(BASE + '/peds/?from=arrest', { waitUntil: 'networkidle' });
await pg.waitForTimeout(250);
const backFrom = await pg.evaluate(() => ({
  href: document.getElementById('backlink').getAttribute('href'),
  wide: document.getElementById('backlinkwide').textContent
}));
ck('back from a mid-code hop returns to arrest', backFrom.href, '../arrest/?from=tool');
ok('wide breadcrumb names the origin tool', /ARREST/.test(backFrom.wide));

/* --- accessibility floors the shell must not break --- */
const a11y = await pg.evaluate(() => {
  const small = [];
  document.querySelectorAll('.shellbar button, .shellbar a, .shellweight, .shellmenurow').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 44) small.push((el.id || el.className) + ':' + Math.round(r.height));
  });
  return { small, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang };
});
ck('every shell control clears the 44px touch floor', a11y.small.join(',') || 'none', 'none');
ck('still exactly one h1', a11y.h1, 1);
ck('lang still set', a11y.lang, 'en');

ck('peds: zero console/page errors', errs.length, 0);
ck('peds wide: zero console/page errors', werrs.length, 0);

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
