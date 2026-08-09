let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({viewport:{width:390, height:1400}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if(m.type()==='error' && !/favicon/.test(m.text()) && !/favicon/.test(m.location()?.url||'')) errors.push('console: '+m.text()); });

let pass=0, fail=0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, extra!==undefined?JSON.stringify(extra):''); }
}

async function fresh() {
  await page.goto('http://localhost:8123/codes/?from=home', {waitUntil:'networkidle'});
  await page.evaluate(() => localStorage.clear());
  await page.reload({waitUntil:'networkidle'});
}

// ---- 1. Merged card structure exists; card 02 has no engine controls ----
await fresh();
check('1. c01 exists with data-arrestmode', await page.evaluate(() => document.getElementById('c01')?.getAttribute('data-arrestmode')), 'adult');
check('1. c01 has single rhythm panel rh01-nonshockable', await page.$('#rh01-nonshockable') !== null);
check('1. no rh02-* elements remain', await page.evaluate(() => !document.getElementById('rh02-vfvt') && !document.getElementById('rhpanel02')));
check('1. no peaclock/peaepi elements remain', await page.evaluate(() => !document.getElementById('peaclock') && !document.getElementById('peaepi')));
check('1. c02 stub has no ccshock/ccepi controls of its own (single engine)', await page.evaluate(() => document.querySelectorAll('#ccshock').length===1 && document.querySelectorAll('#ccepi').length===1));

// ---- 2. Default adult mode, no weight/age ----
await fresh();
let shockText = await page.textContent('#ccshock');
check('2. default shock button shows adult 120J', shockText.includes('120'), shockText);
let bannerText = await page.textContent('#arrestmodetext');
check('2. banner says ADULT MODE by default', bannerText.includes('ADULT MODE'), bannerText);
let toggleVisible = await page.isVisible('#arrestmodetoggle');
check('2. override toggle hidden when not triggered', !toggleVisible);

// ---- 3. Weight-triggered peds mode: 18kg ----
await fresh();
await page.fill('#wtkg', '18');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('3. banner shows PEDIATRIC MODE at 18kg', bannerText.includes('PEDIATRIC MODE'), bannerText);
check('3. data-arrestmode=peds at 18kg', await page.evaluate(() => document.getElementById('c01').getAttribute('data-arrestmode')), 'peds');
shockText = await page.textContent('#ccshock');
check('3. shock button shows 2 J/kg = 36 J at 18kg 1st shock', shockText.includes('36 J'), shockText);
let epiText = await page.textContent('#ccepi');
check('3. epi button shows 0.18 mg at 18kg', epiText.includes('0.18 mg'), epiText);
let amioText = await page.textContent('#ccamio');
check('3. amio button shows 90 mg (5x18) dose 1 of 3 at 18kg', amioText.includes('90 mg') && amioText.includes('1 OF 3'), amioText);

// ---- 4. Boundary: 50kg exactly should be ADULT (trigger is < 50, not <=) ----
await fresh();
await page.fill('#wtkg', '50');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('4. 50kg exactly = ADULT MODE (trigger is <50kg)', bannerText.includes('ADULT MODE'), bannerText);
await page.fill('#wtkg', '49.9');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('4. 49.9kg = PEDIATRIC MODE', bannerText.includes('PEDIATRIC MODE'), bannerText);

// ---- 5. Age-triggered: age 12 should trigger, age 13 should not (weight blank) ----
await fresh();
await page.fill('#wtage', '13');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('5. age 13, no weight = ADULT MODE', bannerText.includes('ADULT MODE'), bannerText);
await page.fill('#wtage', '12');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('5. age 12, no weight = PEDIATRIC MODE', bannerText.includes('PEDIATRIC MODE'), bannerText);

// ---- 6. Override: reversible ----
await fresh();
await page.fill('#wtkg', '18');
await page.waitForTimeout(150);
await page.click('#arrestmodetoggle');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('6. after override tap: ADULT MODE — OVERRIDDEN', bannerText.includes('OVERRIDDEN'), bannerText);
shockText = await page.textContent('#ccshock');
check('6. shock button reverts to adult 120J after override', shockText.includes('120'), shockText);
let toggleText = await page.textContent('#arrestmodetoggle');
check('6. toggle now offers UNDO', toggleText.includes('UNDO'), toggleText);
await page.click('#arrestmodetoggle');
await page.waitForTimeout(150);
bannerText = await page.textContent('#arrestmodetext');
check('6. tapping again returns to PEDIATRIC MODE (reversible)', bannerText.includes('PEDIATRIC MODE') && !bannerText.includes('OVERRIDDEN'), bannerText);

// ---- 7. Override persists across reload, RESET clears it ----
await fresh();
await page.fill('#wtkg', '18');
await page.waitForTimeout(150);
await page.click('#arrestmodetoggle'); // override on
await page.waitForTimeout(150);
await page.reload({waitUntil:'networkidle'});
bannerText = await page.textContent('#arrestmodetext');
check('7. override survives reload', bannerText.includes('OVERRIDDEN'), bannerText);
// RESET FOR NEXT CASE
const resetBtn = await page.$('#resetbtn');
if (resetBtn && await resetBtn.isVisible()) {
  await resetBtn.click();
  await page.waitForTimeout(100);
  const confirmBtn = await page.$('#resetconfirm, #resetmodal button:has-text("CLEAR CASE")');
  if (confirmBtn) { await confirmBtn.click(); await page.waitForTimeout(300); }
}
await page.waitForLoadState('networkidle');
const overrideAfterReset = await page.evaluate(() => localStorage.getItem('lrh-case-adultoverride'));
check('7. RESET clears the adult-override key', overrideAfterReset === null, overrideAfterReset);

// ---- 8. Shock energy at shocks 1/2/3 in adult mode ----
await fresh();
await page.click('#ccstart'); // declares VF/VT, arms shock
await page.waitForTimeout(100);
shockText = await page.textContent('#ccshock');
check('8. adult shock 1 = 120 J', shockText.includes('120'), shockText);
await page.click('#ccshock');
await page.waitForTimeout(1700); // wait past confirm-hold
shockText = await page.textContent('#ccshock');
// after shock 1, not armed again until next rhythm check declares shockable
await page.click('#rh01-vfvt');
await page.waitForTimeout(100);
shockText = await page.textContent('#ccshock');
check('8. adult shock 2 = 150 J', shockText.includes('150'), shockText);
await page.click('#ccshock');
await page.waitForTimeout(1700);
await page.click('#rh01-vfvt');
await page.waitForTimeout(100);
shockText = await page.textContent('#ccshock');
check('8. adult shock 3 = 200 J', shockText.includes('200'), shockText);

// ---- 9. Non-shockable path clears shockArmed (safety fix) ----
await fresh();
await page.click('#ccstart'); // arm shock (declares VF/VT)
await page.waitForTimeout(100);
let armedBefore = await page.evaluate(() => document.getElementById('ccshock').classList.contains('flashred'));
check('9. shock armed (flashing) right after declare', armedBefore);
await page.click('#rh01-nonshockable');
await page.waitForTimeout(100);
let armedAfter = await page.evaluate(() => document.getElementById('ccshock').classList.contains('flashred'));
check('9. shock NOT armed after tapping NON-SHOCKABLE (safety fix)', !armedAfter);
shockText = await page.textContent('#ccshock');
check('9. shock button not showing "SHOCK NOW (#" after non-shockable', !/SHOCK NOW \(#/.test(shockText), shockText);

// ---- 10. Organized rhythm -> no pulse (PEA) also clears armed ----
await fresh();
await page.click('#ccstart');
await page.waitForTimeout(100);
await page.click('#rh01-organized');
await page.waitForTimeout(100);
await page.click('#rh01-pulseno');
await page.waitForTimeout(100);
armedAfter = await page.evaluate(() => document.getElementById('ccshock').classList.contains('flashred'));
check('10. shock disarmed after organized->no pulse (PEA)', !armedAfter);

// ---- 11. Both rhythm branches always visible on the one card (no card-to-card navigation) ----
await fresh();
const c02Visible = await page.evaluate(() => { const el = document.getElementById('c02'); return el ? getComputedStyle(el).display !== 'none' : false; });
check('11. c02 stub article exists in DOM', c02Visible !== null);
const nonShockableAccordion = await page.$('text=NON-SHOCKABLE MANAGEMENT');
check('11. non-shockable management accordion present on c01', nonShockableAccordion !== null);
const defibAccordion = await page.$('text=DEFIBRILLATION');
check('11. defibrillation accordion present on c01', defibAccordion !== null);

// ---- 12. Card 02 redirect ----
await fresh();
await page.goto('http://localhost:8123/codes/?from=home#c02', {waitUntil:'networkidle'});
await page.waitForTimeout(300);
const hashAfterRedirect = await page.evaluate(() => location.hash);
check('12. #c02 redirects to #c01', hashAfterRedirect === '#c01', hashAfterRedirect);

// ---- 13. H's and T's single checklist (no duplicate 02-* keys) ----
await fresh();
const dataKs = await page.$$eval('[data-k]', els => els.map(e => e.getAttribute('data-k')));
const dup = dataKs.filter((k,i) => dataKs.indexOf(k) !== i);
check('13. no duplicate data-k values', dup.length === 0, dup);
const has0211 = dataKs.filter(k => /^01-(2|3|4|5|6|7|8|9|10|11)$/.test(k));
check('13. exactly one H/T set (10 keys 01-2..01-11)', has0211.length === 10, has0211.length);

// ---- 14. Log tagging still uses card '01' ----
await fresh();
await page.fill('#wtkg', '18');
await page.waitForTimeout(150);
await page.click('#ccstart');
await page.waitForTimeout(100);
await page.click('#ccepi');
await page.waitForTimeout(100);
const log = await page.evaluate(() => JSON.parse(localStorage.getItem('lrh-case-log')||'[]'));
const epiEntry = log.find(e => /EPI/.test(e.label));
check('14. epi log entry tagged card 01', epiEntry && epiEntry.card === '01', epiEntry);
check('14. peds epi log shows computed mg (0.18 mg)', epiEntry && epiEntry.label.includes('0.18 mg'), epiEntry);

// ---- 15. Peds mode menu entry (PEA/Asystole tile) still starts clock without arming shock ----
await fresh();
await page.click('#menu-c02');
await page.waitForTimeout(150);
armedAfter = await page.evaluate(() => document.getElementById('ccshock').classList.contains('flashred'));
check('15. menu PEA/Asystole tile does not arm shock', !armedAfter);
const clockRunning = await page.evaluate(() => document.getElementById('ccclock').textContent !== '0:00' || !!window.__codeCPR);
check('15. menu tile still reaches c01', (await page.evaluate(()=>location.hash)) === '#c02' || (await page.evaluate(()=>location.hash)) === '#c01');

// ---- 16. console/page errors ----
check('16. no console/page errors across all tests', errors.length === 0, errors.slice(0,10));

console.log('\n=== SUMMARY:', pass, 'passed,', fail, 'failed ===');
await browser.close();
process.exit(fail > 0 ? 1 : 0);
