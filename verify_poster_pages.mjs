/* LRH Emergency Manual — poster page-count guard.
 *
 * Every poster in posters/ is print-first letter-portrait for the resus-bay wall and the trauma
 * cart, and its page count is a hard requirement: a poster that silently spills onto an extra page
 * prints as a useless orphan strip (usually the QR block) that nobody tapes up.
 *
 * A poster is one page unless it DECLARES otherwise with <meta name="poster-sheets" content="N">.
 * That declaration is deliberate — chest-tube carries a second sheet (the kit check card that gets
 * taped beside the bag), and a guard that could not tell "two sheets on purpose" from "one sheet
 * that overflowed" would either block the check card or stop catching real overflow. Each .sheet is
 * measured against the page box separately, so an overflowing sheet still fails on a 2-sheet poster.
 *
 * This drifted once already — a QR block added after the posters were first verified pushed five
 * of them onto a second page without anyone noticing, because nothing re-checked pagination.
 * Run this after ANY edit to a poster, or to the shared .qr / footer.strip / .key CSS.
 *
 *     python3 -m http.server 8123     # from the repo root, in another terminal
 *     node verify_poster_pages.mjs
 *
 * Or against a deployed URL:
 *     BASE=https://lrhemergencymanual.net node verify_poster_pages.mjs
 *
 * Needs Playwright once:  npm i -D playwright && npx playwright install chromium
 *
 * NOTE on measurement: the viewport MUST be the print content width, not a screen width.
 * Letter portrait with the posters' @page margin of 0.45in gives a 7.6in x 10.1in content box
 * = 729.6 x 969.6 CSS px at 96dpi. Measuring at a wider viewport wraps text into fewer lines and
 * under-reports height, which is exactly how the earlier drift went unnoticed.
 */
import fs from 'fs';
import path from 'path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const PRINT_W = 730;          // 7.6in content width
const PRINT_H = 969.6;        // 10.1in content height

// Discover posters from disk so a newly added one is covered automatically.
let names;
try {
  names = fs.readdirSync('posters', { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join('posters', d.name, 'index.html')))
    .map(d => d.name).sort();
} catch {
  console.error('Run this from the repo root (no posters/ directory found).');
  process.exit(2);
}
if (!names.length) { console.error('No posters found.'); process.exit(2); }

let browser;
try { browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}); }
catch (e) {
  console.error('Could not launch Chromium: ' + e.message);
  console.error('Try:  npx playwright install chromium   (or set PW_CHROME=/path/to/chrome)');
  process.exit(2);
}

console.log('checking ' + names.length + ' posters against ' + BASE + '\n');
let fail = 0;

for (const name of names) {
  const pg = await browser.newPage({ viewport: { width: PRINT_W, height: 1000 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  let line = name.padEnd(14);
  try {
    await pg.goto(BASE + '/posters/' + name + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await pg.emulateMedia({ media: 'print' });
    await pg.waitForTimeout(250);

    // Declared sheet count (default 1), and the measured height of EACH sheet.
    const want = await pg.evaluate(() => {
      const m = document.querySelector('meta[name="poster-sheets"]');
      const n = m ? parseInt(m.getAttribute('content'), 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    const heights = await pg.evaluate(() =>
      [...document.querySelectorAll('.sheet')].map(s => {
        const top = s.getBoundingClientRect().top;
        let bottom = 0;
        s.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.height) bottom = Math.max(bottom, r.bottom);
        });
        return Math.round(bottom - top);
      }));
    const h = heights.length ? Math.max(...heights) : null;

    // Authoritative check: what the print engine actually produces.
    const pdf = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

    const overBy = h === null ? null : Math.round(h - PRINT_H);
    // Both must hold: the right number of printed pages, AND no individual sheet
    // taller than the page box (which is what pushes an orphan strip onto page N+1).
    const ok = pages === want && heights.length === want && !(overBy > 0);
    if (!ok) fail++;
    line += (ok ? 'PASS  ' : 'FAIL  ') + pages + ' page(s)' + (want === 1 ? '' : ' of ' + want + ' declared');
    if (h !== null) line += '   tallest sheet ' + h + 'px ' + (overBy > 0 ? '(OVER by ' + overBy + 'px)' : '(' + -overBy + 'px spare)');
    if (errs.length) line += '   [page errors: ' + errs.length + ']';
  } catch (e) {
    fail++; line += 'ERROR  ' + e.message.slice(0, 60);
  }
  console.log(line);
  await pg.close();
}

await browser.close();
console.log('\n=== ' + (names.length - fail) + '/' + names.length + ' posters print to their declared page count ===');
process.exit(fail ? 1 : 0);
