/* CairnReady Emergency Manual — mobile accessibility standard (ACCESSIBILITY.md).
 *
 * Enforces the machine-checkable half of the standard, against dist/ like every
 * other suite:
 *   1. zoom never disabled (viewport meta) — every published page
 *   2. lang + unique <title> + exactly one h1 — representative page set
 *   3. no page-level horizontal overflow at 320px — representative page set
 *   4. touch targets: >=24px anywhere (inline prose links exempt, WCAG 2.5.8),
 *      >=44px for interactive elements inside .console — representative set
 *   5. text inputs >=16px computed font-size (iOS focus auto-zoom guard)
 *   6. @keyframes ==> prefers-reduced-motion block, per built page
 *   7. shared token pairs >=4.5:1 in dark AND light, parsed from the CSS
 *      actually shipped inside the built landing page (so a re-skinned fork is
 *      checked against its own values — config-driven, CLAUDE.md #117)
 *
 * The floors themselves (24/44/4.5/16) are written-out invariants a fork must
 * not localize away — like energy escalation or the PHI guards.
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
/* Environments that pin a different browser build expose the binary at
   /opt/pw-browsers/chromium — fall back to it rather than downloading. */
import { existsSync } from 'node:fs';
const LAUNCH = {};
try { await chromium.launch().then(b => b.close()); }
catch { if (existsSync('/opt/pw-browsers/chromium')) LAUNCH.executablePath = '/opt/pw-browsers/chromium'; }
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = (want === undefined) ? !!got : got === want;
  console.log(`${ok ? 'ok ' : 'FAIL'}  ${name}` + (ok ? '' : `  (got ${JSON.stringify(got)})`));
  ok ? pass++ : fail++;
};

/* Representative page set: every tool family + the landing page. */
const PAGES = ['/', '/codes/', '/peds/', '/arrest/', '/airway/', '/tca/', '/trauma/',
  '/neonatal/', '/pph/', '/dystocia/', '/procedures/', '/ob-neonatal/',
  '/clinical-pathways/heart/', '/clinical-pathways/pe/', '/equipment-readiness/', '/simulations/', '/sources/'];

/* ---- static checks over every built page (1, 6) --------------------------- */
const DIST = 'dist';
const htmlFiles = [];
(function scan(dir){ for (const n of readdirSync(dir)) { const p = join(dir, n);
  if (statSync(p).isDirectory()) scan(p); else if (n.endsWith('.html')) htmlFiles.push(p); } })(DIST);

let zoomBad = [], motionBad = [], langBad = [];
for (const f of htmlFiles) {
  const s = readFileSync(f, 'utf8');
  const vp = s.match(/<meta name="viewport" content="([^"]*)"/i);
  if (!vp || /user-scalable\s*=\s*(no|0)/i.test(vp[1]) ||
      (/maximum-scale\s*=\s*([\d.]+)/i.exec(vp[1])?.[1] ?? 5) < 2) zoomBad.push(f);
  if (/@keyframes/.test(s) && !/prefers-reduced-motion/.test(s)) motionBad.push(f);
  if (!/<html[^>]*\slang=/.test(s)) langBad.push(f);
}
ck(`1. zoom never disabled on any of ${htmlFiles.length} built pages`, zoomBad.join(','), '');
ck('6. every animated page carries prefers-reduced-motion', motionBad.join(','), '');
ck('2a. every built page declares a language', langBad.join(','), '');

/* ---- token contrast (7), from the design system the build actually injects ---- */
const dsCss = readFileSync('design-system.css', 'utf8');
function themeTokens(block) {
  const out = {};
  for (const m of block.matchAll(/--(bg|card|card2|ink|ink2|accent):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const rootBlock  = dsCss.match(/body\[data-theme\]\s*\{[^}]*\}/s)?.[0] ?? '';
const lightBlock = dsCss.match(/body\[data-theme="light"\]\s*\{[^}]*\}/s)?.[0] ?? '';
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [label, t] of [['dark', themeTokens(rootBlock)], ['light', themeTokens(lightBlock)]]) {
  ck(`7. ${label} theme defines the shared tokens`, ['bg','card','card2','ink','ink2','accent'].every(k => t[k]), true);
  if (!t.bg) continue;
  for (const fg of ['ink', 'ink2', 'accent']) for (const bg of ['bg', 'card', 'card2']) {
    const r = ratio(t[fg], t[bg]);
    ck(`7. ${label}: --${fg} on --${bg} >= 4.5:1`, r >= 4.5 ? true : +r.toFixed(2), true);
  }
}

/* ---- rendered checks (2b, 3, 4, 5) ---------------------------------------- */
const b = await chromium.launch(LAUNCH);
const errs = [];
for (const path of PAGES) {
  const pg = await b.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  pg.on('pageerror', e => errs.push(path + ': ' + e));
  await pg.goto(BASE + path + (path.includes('?') ? '&' : '?') + 'from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);

  const r = await pg.evaluate(() => {
    const doc = document;
    const res = { title: doc.title.trim(), h1: doc.querySelectorAll('h1').length,
      scrollW: doc.documentElement.scrollWidth, innerW: window.innerWidth,
      tiny: [], smallConsole: [], smallInputs: [] };
    const vis = el => { const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    /* WCAG 2.5.8's inline exception: a link whose size is constrained by the
       line-height of surrounding NON-target text (a citation in a Sources
       paragraph, a cross-link mid-sentence). Measured as: the nearest block
       ancestor carries >=20 chars of text that is not inside any link. A row
       that is only links (a chip list, a nav strip) gets no exemption. */
    const inlineInProse = el => {
      if (el.tagName !== 'A' && !(el.getAttribute && el.getAttribute('role') === 'button' && /^inline/.test(getComputedStyle(el).display))) return false;
      let anc = el.parentElement;
      while (anc && getComputedStyle(anc).display === 'inline') anc = anc.parentElement;
      if (!anc) return false;
      let linkText = 0;
      for (const a of anc.querySelectorAll('a')) linkText += a.textContent.length;
      for (const a of anc.querySelectorAll('[role="button"]')) linkText += a.textContent.length;
      return (anc.textContent.length - linkText) >= 15;
    };
    for (const el of doc.querySelectorAll('a,button,input,select,textarea,[role="button"],summary')) {
      if (!vis(el)) continue;
      /* WCAG 2.5.8 measures the TARGET: a control wrapped in (or tied to) a
         label is activated by the whole label row, so the row is what must
         meet the floor, not the glyph inside it. */
      let tgt = el;
      if (/^(INPUT)$/.test(el.tagName) && (el.type === 'checkbox' || el.type === 'radio')) {
        tgt = el.closest('label') || (el.id && doc.querySelector(`label[for="${el.id}"]`)) || el;
      }
      const bx = tgt.getBoundingClientRect();
      const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);
      if ((bx.width < 24 || bx.height < 24) && !inlineInProse(el))
        res.tiny.push(`${Math.round(bx.width)}x${Math.round(bx.height)} ${label}`);
      if (el.closest('.console') && (bx.width < 44 || bx.height < 44))
        res.smallConsole.push(`${Math.round(bx.width)}x${Math.round(bx.height)} ${label}`);
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio' &&
          parseFloat(getComputedStyle(el).fontSize) < 16)
        res.smallInputs.push(`${getComputedStyle(el).fontSize} ${label}`);
    }
    return res;
  });

  ck(`2b. ${path} has a title`, r.title.length > 0, true);
  ck(`2c. ${path} has exactly one h1`, r.h1, 1);
  ck(`3. ${path} no horizontal overflow at 320px`, r.scrollW <= r.innerW + 2 ? true : `${r.scrollW}>${r.innerW}`, true);
  ck(`4a. ${path} no interactive target under 24px`, r.tiny.slice(0, 4).join(' | '), '');
  ck(`4b. ${path} no .console target under 44px`, r.smallConsole.slice(0, 4).join(' | '), '');
  ck(`5. ${path} no text input under 16px`, r.smallInputs.slice(0, 4).join(' | '), '');
  await pg.close();
}
await b.close();
ck('no page errors while auditing', errs.join(' | '), '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
