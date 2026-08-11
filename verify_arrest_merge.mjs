/* LRH Emergency Manual — Codes → /arrest/ hand-off (WS-arrest-handoff).
 *
 * The old merged card-01 engine was removed from codes/ and replaced by a
 * redirect to the standalone /arrest/ tool (covered in full by
 * verify_arrest_screen.mjs). This suite proves the hand-off itself: the card
 * slots redirect, the menu tiles navigate across, the dead engine is gone, and
 * codes/ still loads its other cards without errors.
 *
 *     python3 -m http.server 8123 --directory dist
 *     node verify_arrest_merge.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 1400 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()); });

let pass = 0, fail = 0;
const check = (label, cond, extra) => { if (cond) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, extra !== undefined ? JSON.stringify(extra) : ''); } };
const path = () => new URL(page.url()).pathname;

// ---- 1. plain /codes/ load: no redirect, menu + other cards present, dead engine gone ----
await page.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('1. plain /codes/ does not redirect', path() === '/codes/', page.url());
check('1. the card menu is present', await page.$('#menu-c01') !== null && await page.$('#menu-c02') !== null);
check('1. the card-01 engine markup is gone', await page.$('#c01') === null && await page.$('#ccshock') === null);
check('1. the card-02 stub is gone', await page.$('#c02') === null);
check('1. the #headsup strip is gone', await page.$('#headsup') === null);
check('1. other cards remain (22, 03)', await page.$('#c22') !== null && await page.$('#c03') !== null);

// ---- 2. #c01 / #c02 deep-links redirect to /arrest/ ----
await page.goto(BASE + '/codes/?from=home#c01', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
check('2. a #c01 deep-link redirects to /arrest/', path() === '/arrest/', page.url());
await page.goto(BASE + '/codes/#c02', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
check('2. a #c02 deep-link redirects to /arrest/', path() === '/arrest/', page.url());

// ---- 3. menu tiles navigate to /arrest/ with from=codes (back link returns to Codes) ----
await page.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
check('3. tile 01 href points at /arrest/', /\.\.\/arrest\/\?from=codes/.test(await page.getAttribute('#menu-c01', 'href')));
await page.click('#menu-c01');
await page.waitForLoadState('networkidle');
check('3. tapping tile 01 lands on /arrest/', path() === '/arrest/', page.url());
check('3. and the arrest back link returns to Codes', await page.getAttribute('#backlink', 'href') === '../codes/?from=tool');

// ---- 4. no errors anywhere across the hand-off ----
check('4. no console/page errors across the hand-off', errors.length === 0, errors.slice(0, 8));

console.log('\n=== SUMMARY: ' + pass + ' passed, ' + fail + ' failed ===');
await browser.close();
process.exit(fail ? 1 : 0);
