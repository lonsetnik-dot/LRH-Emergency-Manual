// Verification for tca/index.html — traumatic cardiac arrest cognitive aid.
// Mirrors the pattern of the other verify_*.mjs scripts: load in headless
// Chromium, drive the UI, assert behaviour and dose-math boundaries.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
  catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'file://' + join(__dirname, 'tca', 'index.html');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(300);

const txt = id => page.$eval('#' + id, e => e.textContent.trim());
const vis = sel => page.$eval(sel, e => e.offsetParent !== null).catch(() => false);

// --- initial state -----------------------------------------------------------
ok((await txt('clock')) === '0:00', 'clock starts at 0:00');
ok((await txt('statusword')) === 'READY', 'status READY at idle');
ok(await vis('#idle'), 'idle screen visible');
ok(!(await vis('#active')), 'active screen hidden at idle');
ok((await txt('plabel')).includes('TRAUMATIC CARDIAC ARREST'), 'protocol label set');

// default mode = sequential
ok((await txt('modenote')).toLowerCase().includes('limited team'), 'default mode note = sequential/limited team');

// --- weight-based dose math (checked before entering, via internal fns) -------
// Recreate the dose expectations and read them off the rendered dose box after start.
async function doseRowText(label) {
  return page.evaluate(l => {
    const rows = [...document.querySelectorAll('#dosebox > div')];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].textContent.includes(l)) return rows[i].textContent + ' || ' + (rows[i+1] ? rows[i+1].textContent : '');
    }
    return '';
  }, label);
}

// Start as adult, no weight
await page.click('#startbtn');
await page.waitForTimeout(200);
ok(await vis('#active'), 'active screen visible after declare');
ok((await txt('statusword')) === 'RESUS RUNNING', 'status RESUS RUNNING when active');
ok(errors.length === 0, 'no JS errors after start: ' + errors.join(' | '));

let cry = await doseRowText('Crystalloid');
ok(cry.includes('20 mL/kg'), 'no-weight crystalloid shows per-kg: ' + cry);
let txa = await doseRowText('TXA');
ok(txa.includes('1 g IV over 10 min'), 'adult TXA fixed: ' + txa);

// workstreams present, obstetric hidden (not pregnant)
let names = await page.$$eval('#worksteps .wcard', els => els.map(e => e.textContent));
ok(names.length === 4, 'four workstreams when not pregnant (obstetric hidden), got ' + names.length);
ok(names[0].includes('HEMORRHAGE'), 'first workstream is HEMORRHAGE (sequential priority)');
ok(!names.join('').includes('OBSTETRIC'), 'OBSTETRIC hidden when not pregnant');

// numbering visible in sequential mode
let hasNum = await page.$eval('#worksteps', e => /1|2|3/.test(e.textContent));
ok(hasNum, 'sequential mode shows priority numbers');

// --- pediatric weight: 20 kg -> crystalloid 400 mL, TXA 15 mg/kg=300 mg -------
await page.fill('#wIn', '20');
await page.waitForTimeout(200);
cry = await doseRowText('Crystalloid');
ok(cry.includes('400 mL'), 'peds 20kg crystalloid = 400 mL: ' + cry);
txa = await doseRowText('TXA');
ok(txa.includes('300 mg'), 'peds 20kg TXA = 300 mg (15 mg/kg): ' + txa);
ok((await txt('wnote')).includes('pediatric'), 'wnote flags pediatric at 20kg');

// TXA peds cap: 80 kg is adult; 49 kg peds -> 15*49=735; 70kg would be adult.
await page.fill('#wIn', '49');
await page.waitForTimeout(150);
txa = await doseRowText('TXA');
ok(txa.includes('735 mg'), 'peds 49kg TXA = 735 mg: ' + txa);
// cap check at high peds weight just under threshold won't exceed 1000 here; test explicit cap via age route:
await page.fill('#wIn', '');
await page.waitForTimeout(100);

// --- adult weight 80 kg: crystalloid 1600 mL, TXA fixed ----------------------
await page.fill('#wIn', '80');
await page.waitForTimeout(150);
cry = await doseRowText('Crystalloid');
ok(cry.includes('1600 mL'), 'adult 80kg crystalloid = 1600 mL: ' + cry);
txa = await doseRowText('TXA');
ok(txa.includes('1 g IV'), 'adult 80kg TXA fixed 1 g: ' + txa);

// --- checklist logs to timeline ----------------------------------------------
await page.click('#worksteps .wrow');   // first hemorrhage task
await page.waitForTimeout(150);
// open event log accordion
await page.click('[data-acc="log"]');
await page.waitForTimeout(150);
let logtext = await page.$eval('.accb', e => e.textContent).catch(()=>'');
ok(logtext.includes('Direct pressure'), 'checking a task logs it to the timeline');
await page.click('[data-acc="log"]'); // close

// checkbox toggles back off
let firstBox = await page.$eval('#worksteps .wrow .wbox', e => e.textContent);
ok(firstBox === '✓', 'checked box shows tick');

// --- simultaneous mode toggle ------------------------------------------------
await page.click('#modeSim');
await page.waitForTimeout(150);
ok((await txt('modenote')).toLowerCase().includes('full trauma team'), 'simultaneous mode note updates');
ok((await txt('worktitle')).includes('PARALLEL'), 'simultaneous worktitle mentions parallel');
ok((await txt('plabel')).includes('SIMULTANEOUS'), 'plabel reflects simultaneous mode');

// --- pregnancy flag reveals obstetric workstream -----------------------------
// go back to idle via reset to toggle pregnancy cleanly, then re-declare
await page.click('#resetbtn'); await page.click('#resetbtn');
await page.waitForTimeout(150);
ok(await vis('#idle'), 'reset returns to idle');
await page.click('#pregidle');
await page.waitForTimeout(100);
await page.click('#startbtn');
await page.waitForTimeout(200);
names = await page.$$eval('#worksteps .wcard', els => els.map(e => e.textContent));
ok(names.length === 5, 'five workstreams when pregnant, got ' + names.length);
ok(names.join('').includes('OBSTETRIC'), 'OBSTETRIC shown when pregnant');

// --- reversible addressed -> conventional window -----------------------------
await page.click('#addressedbtn');
await page.waitForTimeout(150);
ok(await vis('#convstrip'), 'conventional window appears after MARK ADDRESSED');
ok((await txt('convclock')).startsWith('9:') || (await txt('convclock')) === '10:00', 'conventional countdown near 10:00');

// --- ROSC path ---------------------------------------------------------------
await page.click('#roscbtn');
await page.waitForTimeout(150);
ok(await vis('#rosc'), 'ROSC screen visible');
ok((await txt('statusword')) === 'ROSC', 'status ROSC');

// re-arrest returns to active
await page.click('#rearrestbtn');
await page.waitForTimeout(150);
ok(await vis('#active'), 're-arrest returns to active');

// --- cease path --------------------------------------------------------------
await page.click('#ceasebtn');
await page.waitForTimeout(120);
ok(await vis('#ceasecard'), 'cessation criteria card shows');
await page.click('#ceaseconfirm');
await page.waitForTimeout(150);
ok(await vis('#ceased'), 'ceased screen visible');
ok((await txt('statusword')) === 'CEASED', 'status CEASED');

// --- PHI guard ---------------------------------------------------------------
await page.click('#resetbtn'); await page.click('#resetbtn');
await page.click('#startbtn');
await page.waitForTimeout(150);
await page.click('#logtoggle');
await page.waitForTimeout(120);
await page.fill('#customin', 'MRN 12345678 john doe');
await page.click('#customlog');
await page.waitForTimeout(120);
ok(await vis('#customwarn'), 'PHI-like text is refused with a warning');
await page.fill('#customin', 'IO placed right humeral head');
await page.click('#customlog');
await page.waitForTimeout(120);
ok(!(await vis('#customwarn')) || (await txt('customwarn')) === '', 'clean text accepted');

ok(errors.length === 0, 'no JS errors overall: ' + errors.join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
