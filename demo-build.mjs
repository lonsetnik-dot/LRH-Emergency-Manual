/* demo-build.mjs — builds dist-demo/, the try-it copy of the manual served at
 * demo.cairnready.org.
 *
 * cairn/index.html (the explainer) says "tap a section to see the kind of
 * cognitive aid inside" but has nowhere to send that click that isn't
 * lrhemergencymanual.net — LRH's live bedside instrument, not a showroom.
 * This script builds the same tool content as build.mjs's dist/ (the real
 * reference implementation — nothing generic or fake) into a separate
 * output, so marketing traffic never lands on the production site:
 *
 *   - every page gets a fixed DEMO ribbon (this file, injectRibbon())
 *   - every page is marked noindex — it must never compete with, or be
 *     mistaken in search results for, the production manual
 *   - no offline shell / service worker — a sales demo doesn't need to
 *     survive a dead zone, and skipping it keeps this script independent of
 *     build.mjs's verified precache-list logic
 *
 * Netlify config for the demo.cairnready.org site (its own project, not
 * cairn/'s): Build command  node demo-build.mjs   ·   Publish directory
 * dist-demo   ·   Base directory blank (runs from repo root).
 *
 * Run:  node demo-build.mjs   →  outputs dist-demo/
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync('design-system.css', 'utf8').trim();
const MARKER = '/* @design-system */';
const CSS_LIVE = readFileSync('design-system-live.css', 'utf8').trim();
const MARKER_LIVE = '/* @design-system-live */';
const INV = readFileSync('inventory.js', 'utf8').trim();
const MARKER_INV = '/* @inventory */';
const ICONS = readFileSync('equipment-icons.js', 'utf8').trim();
const MARKER_ICONS = '/* @icons */';
const GDL = readFileSync('guidelines.js', 'utf8').trim();
const MARKER_GDL = '/* @guidelines */';
const OUT = 'dist-demo';

// Same exclusions as build.mjs, plus build.mjs's own output dirs — this
// script also runs from repo root and must not walk into either build's
// product.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-demo', '.github', 'cairn']);
const SKIP_ROOT_FILES = new Set([
  'design-system.css', 'design-system-live.css', 'inventory.js', 'equipment-icons.js', 'guidelines.js',
  'build.mjs', 'demo-build.mjs', 'run-tests.sh', 'netlify.toml',
  'package.json', 'package-lock.json', 'shot.mjs', '.gitignore',
  'sw-template.js', 'sw-register.js',
]);
const SKIP_ROOT_EXT = ['.mjs', '.py', '.md'];

function skipRoot(name) {
  return SKIP_ROOT_FILES.has(name) || SKIP_ROOT_EXT.some(e => name.endsWith(e));
}

// Deliberately NOT position:fixed: each tool owns its own sticky in-page
// header (.hdr, position:sticky;top:0, markup varies by tool), and a fixed
// ribbon would need a matching top-offset hack per tool to avoid overlapping
// it. Living in normal flow as the first child of body sidesteps that
// entirely — it reflows above everything, then scrolls away once the reader
// passes it, at which point the tool's own sticky header takes over top:0
// exactly as it does today.
const RIBBON_CSS = `#__cairn_demo_ribbon{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;` +
  `padding:8px 14px;font:600 12.5px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;` +
  `letter-spacing:.01em;text-align:center;background:#3a2c0f;color:#f5dfa3;` +
  `border-bottom:1px solid #6b5117}` +
  `#__cairn_demo_ribbon b{color:#fff;letter-spacing:.06em}` +
  `#__cairn_demo_ribbon a{color:#f5dfa3;text-decoration:underline}` +
  `#__cairn_demo_ribbon a:hover,#__cairn_demo_ribbon a:focus-visible{color:#fff}` +
  `@media print{#__cairn_demo_ribbon{display:none}}`;

const RIBBON_HTML = `<div id="__cairn_demo_ribbon" role="note">` +
  `<b>DEMO</b> — a live copy of the reference implementation, for evaluation only · not connected to any hospital · ` +
  `<a href="https://cairnready.org/">cairnready.org</a>` +
  `</div>`;

function injectDemoChrome(html) {
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `<meta name="robots" content="noindex, nofollow">\n<style>${RIBBON_CSS}</style>\n</head>`)
    : `<meta name="robots" content="noindex, nofollow">\n<style>${RIBBON_CSS}</style>\n` + html;
  html = /<body[^>]*>/i.test(html)
    ? html.replace(/(<body[^>]*>)/i, `$1\n${RIBBON_HTML}`)
    : RIBBON_HTML + html;
  return html;
}

function walk(src, dst, atRoot) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_DIRS.has(name)) continue;
    if (atRoot && skipRoot(name)) continue;
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) walk(s, d, false);
    else if (name.endsWith('.html')) {
      const html = readFileSync(s, 'utf8')
        .split(MARKER).join(CSS)
        .split(MARKER_LIVE).join(CSS_LIVE)
        .split(MARKER_INV).join(INV)
        .split(MARKER_ICONS).join(ICONS)
        .split(MARKER_GDL).join(GDL);
      writeFileSync(d, injectDemoChrome(html));
    } else copyFileSync(s, d);
  }
}

rmSync(OUT, { recursive: true, force: true });
walk('.', OUT, true);

// Sanity: fail loudly if any published .html still contains an un-injected marker.
let leftover = 0;
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (name.endsWith('.html')) {
      const html = readFileSync(p, 'utf8');
      if (html.includes(MARKER) || html.includes(MARKER_LIVE) || html.includes(MARKER_INV) || html.includes(MARKER_ICONS) || html.includes(MARKER_GDL)) {
        console.error('!! un-injected marker left in', p); leftover++;
      }
    }
  }
})(OUT);
if (leftover) { console.error(`build FAILED: ${leftover} file(s) with un-injected marker`); process.exit(1); }

console.log(`built ${OUT}/  (demo ribbon + noindex injected, no offline shell)`);
