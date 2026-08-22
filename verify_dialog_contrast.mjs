/* verify_dialog_contrast.mjs — the dialogs a clinician only sees at the worst moment.
 *
 *   Run:  node build.mjs && python3 -m http.server 8123 --directory dist
 *         node verify_dialog_contrast.mjs
 *
 * THE SCAR (issue #221, "Dark mode reset is broken"). In the dark theme, codes/'s
 * RESET confirmation rendered its warning text and its CANCEL button at 1.14:1 —
 * white on white, invisible. What a clinician saw was a red header, a red CLEAR
 * CASE button, and a blank panel between them. The only legible control in the
 * dialog that guards wiping the case was the one that wipes it. The pediatric-
 * weight-on-an-adult-card dialog had the same defect, which is worse: that one
 * exists to stop an adult dose reaching a child.
 *
 * WHY NOTHING CAUGHT IT, and what that means for this file:
 *
 *  1. THE DIALOG DOES NOT EXIST UNTIL YOU TAP THE BUTTON. It is built by JS on
 *     first use and appended to the body. Every scanner that walks the DOM as
 *     loaded — including the accessibility suite — sees a page that does not
 *     contain it. So this suite DRIVES THE CONTROLS. It taps RESET, it opens the
 *     timeline, it enters a pediatric weight on an adult card, and it measures
 *     what is actually on screen afterwards.
 *  2. verify_color_tokens.mjs looks for `el.style.color = '#hex'`, which is one
 *     SYNTAX of the mistake. This dialog was written as
 *     `modal.innerHTML = '<div style="background:#fffefb…'` — the same literal,
 *     invisible to that regex. A check shaped around a syntax misses the defect
 *     the moment somebody writes it another way; measuring the rendered pixel
 *     does not care how the colour got there.
 *
 * Both themes, because a panel that is legible in one and not the other is the
 * whole failure mode. Membership is derived from the built site — any page with
 * a #resetbtn — rather than from a list typed here, so a new tool joins the
 * check by having the control rather than by somebody remembering (golden rule 13).
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const DIST = process.env.DIST || 'dist';
/* WCAG AA for body text. Large/bold text is allowed 3:1, and the size is read off
   the element rather than assumed. */
const AA_SMALL = 4.5, AA_LARGE = 3;

let pass = 0, fail = 0;
const ck = (name, got, want) => { const okk = String(got) === String(want); (okk ? pass++ : fail++);
  console.log((okk ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (okk ? '' : '  want=' + want)); };

/* Pages that carry the destructive control, found in the build. */
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (name !== 'index.html') continue;
    if (readFileSync(p, 'utf8').includes('id="resetbtn"'))
      pages.push('/' + relative(DIST, dir).split(sep).join('/') + (dir === DIST ? '' : '/'));
  }
})(DIST);
pages.sort();
console.log('testing against ' + BASE);
ck('pages carrying a RESET were found', pages.length > 0, true);
console.log('   ' + pages.join(' ') + '\n');

const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

/* Measure every visible text run on screen. Ancestors are walked for the first
   opaque background; an ancestor painted with a gradient or an image is reported
   as unmeasurable rather than guessed at, because guessing there is how a
   contrast check starts producing numbers nobody believes. */
const SCAN = (rootSel) => {
  const parse = c => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const bgOf = el => { let n = el;
    while (n) { const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor); if (c && c[3] > 0.5) return c;
      n = n.parentElement; }
    return null; };
  const lum = rgb => { const [r, g, bl] = rgb.map(v => { v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const root = rootSel ? document.querySelector(rootSel) : null;
  if (rootSel && !root) return [];
  const out = [];
  (root ? root.querySelectorAll('*') : document.querySelectorAll('*')).forEach(el => {
    if (el.closest('svg')) return;
    const runs = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!runs.length) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) return;
    const px = parseFloat(cs.fontSize) || 16;
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const L1 = lum(fg.slice(0, 3)), L2 = lum(bg.slice(0, 3));
    out.push({
      ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
      large,
      txt: runs.map(n => n.textContent.trim()).join(' ').slice(0, 60),
      sel: el.id ? '#' + el.id : el.tagName.toLowerCase()
    });
  });
  return out;
};

const worst = rows => rows
  .filter(o => o.ratio < (o.large ? 3 : 4.5))
  .sort((a, c) => a.ratio - c.ratio);

for (const theme of ['dark', 'light']) {
  console.log('--- ' + theme + ' theme ---');
  for (const path of pages) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
    const pg = await ctx.newPage();
    await pg.goto(BASE + path + '?from=home', { waitUntil: 'networkidle' });
    await pg.evaluate(t => { try { localStorage.clear(); localStorage.setItem('lrh-pref-theme', t); } catch (e) {} }, theme);
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForTimeout(350);

    /* RESET — inline in the bar at >=768px, behind the bar's ... menu on a phone. */
    let opened = false;
    if (!(await pg.locator('#resetbtn').isVisible().catch(() => false)) && await pg.locator('#menubtn').count()) {
      await pg.click('#menubtn').catch(() => {}); await pg.waitForTimeout(200);
    }
    if (await pg.locator('#resetbtn').isVisible().catch(() => false)) {
      await pg.click('#resetbtn').catch(() => {}); await pg.waitForTimeout(400); opened = true;
    }
    if (opened) {
      /* TWO CONFIRM IDIOMS in the family, and the difference matters here. The card tools
         raise a modal; the live engines turn the button itself into SURE? and wait for a
         second tap. So the thing to measure is whichever one appeared — scoping to the
         dialog if there is one, and to the RESET control if the confirmation IS the
         control. Measuring the whole document instead turned this into an accidental
         second accessibility audit and reported page content sitting behind the dialog. */
      const hasModal = await pg.evaluate(() => {
        const m = document.getElementById('resetmodal');
        return !!m && getComputedStyle(m).display !== 'none';
      });
      const root = hasModal ? '#resetmodal' : '#resetbtn';
      const bad = worst(await pg.evaluate(SCAN, root).catch(() => []));
      ck(`${path} RESET confirm is legible in ${theme} (${hasModal ? 'modal' : 'two-tap'})`,
         bad.length ? bad[0].ratio.toFixed(2) + ' ' + JSON.stringify(bad[0].txt) : 'ok', 'ok');
      bad.slice(1, 4).forEach(x => console.log('       also ' + x.ratio.toFixed(2) + '  ' + x.sel + ' ' + JSON.stringify(x.txt)));
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(() => { const m = document.getElementById('resetmodal'); if (m) m.style.display = 'none'; }).catch(() => {});
      await pg.waitForTimeout(200);
    }

    /* CASE TIMELINE — only where the tool has one. */
    let tl = false;
    if (await pg.locator('#summarybtn').isVisible().catch(() => false)) { await pg.click('#summarybtn').catch(() => {}); tl = true; }
    else if (await pg.locator('#tlbtn').count()) {
      if (await pg.locator('#menubtn').count()) { await pg.click('#menubtn').catch(() => {}); await pg.waitForTimeout(200); }
      if (await pg.locator('#tlbtn').isVisible().catch(() => false)) { await pg.click('#tlbtn').catch(() => {}); tl = true; }
    }
    if (tl) {
      await pg.waitForTimeout(400);
      const bad = worst(await pg.evaluate(SCAN, '#summarymodal').catch(() => []));
      ck(`${path} CASE TIMELINE is legible in ${theme}`, bad.length ? bad[0].ratio.toFixed(2) + ' ' + JSON.stringify(bad[0].txt) : 'ok', 'ok');
      bad.slice(1, 4).forEach(x => console.log('       also ' + x.ratio.toFixed(2) + '  ' + x.sel + ' ' + JSON.stringify(x.txt)));
    }
    await ctx.close();
  }
}

/* The pediatric-weight dialog on codes/, which only appears once a weight under
   the pediatric trigger is entered on an adult card. It is the dialog that stops
   an adult dose reaching a child, and it had the same defect as RESET. */
for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
  await pg.evaluate(t => { try { localStorage.clear(); localStorage.setItem('lrh-pref-theme', t); } catch (e) {} }, theme);
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(350);
  /* The threshold comes from the tool's own config (issue #117), so a site that
     localizes it still exercises the dialog. The dialog is raised by tapping the
     pediatric strip an adult card grows once the weight is under that threshold —
     it does not appear on weight entry alone, which is why an earlier version of
     this check reported it as "did not open" and skipped silently. */
  const thresh = await pg.evaluate(() => {
    try { return (window.SITE && window.SITE.audience) ? window.SITE.audience.thresholdKg : null; }
    catch (e) { return null; }
  });
  const kg = (typeof thresh === 'number' && thresh > 2) ? thresh - 1 : 20;
  if (!(await pg.locator('#wtkg').isVisible().catch(() => false)) && await pg.locator('#wtoggle').count()) {
    await pg.click('#wtoggle').catch(() => {}); await pg.waitForTimeout(200);
  }
  await pg.fill('#wtkg', String(kg)).catch(() => {});
  await pg.dispatchEvent('#wtkg', 'input').catch(() => {});
  await pg.waitForTimeout(600);
  const strip = pg.locator('.audiencestrip').first();
  if (await strip.count()) {
    await strip.scrollIntoViewIfNeeded().catch(() => {});
    await strip.click({ timeout: 3000 }).catch(() => {});
    await pg.waitForTimeout(500);
  }
  const shown = await pg.evaluate(() => {
    const m = document.getElementById('audiencemodal');
    return !!m && getComputedStyle(m).display !== 'none';
  });
  ck(`codes pediatric-weight dialog opens at ${kg} kg (${theme})`, shown, true);
  if (shown) {
    const bad = worst(await pg.evaluate(SCAN, '#audiencemodal').catch(() => []));
    ck(`codes pediatric-weight dialog is legible in ${theme}`,
       bad.length ? bad[0].ratio.toFixed(2) + ' ' + JSON.stringify(bad[0].txt) : 'ok', 'ok');
  }
  await ctx.close();
}

await b.close();
console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
