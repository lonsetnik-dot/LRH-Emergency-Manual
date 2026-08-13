// Verification for tca/index.html — traumatic cardiac arrest cognitive aid.
// Mirrors the pattern of the other verify_*.mjs scripts: load in headless
// Chromium, drive the UI, assert behavior and dose-math boundaries.
//
// The clinical numbers are read from the page's own SITE block rather than
// written out again here, so a fork that correctly localizes its values stays
// green (issue #117). See the CONFIG-DRIVEN EXPECTATIONS note below.
let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
  catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
}

/* Test the BUILT page, not the source. The shared CSS, the equipment icons and
   the LOCAL() config reader are all injected at build (build.mjs), so a source
   file opened over file:// is missing exactly the machinery this suite is here
   to check — it would fail for the wrong reason, or pass without ever seeing
   the code that ships. Every other verify_*.mjs already works this way. */
const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const url = BASE + '/tca/?from=home';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(300);

const txt = id => page.$eval('#' + id, e => e.textContent.trim());
const vis = sel => page.$eval(sel, e => e.offsetParent !== null).catch(() => false);

/* ---- CONFIG-DRIVEN EXPECTATIONS (issue #117) -------------------------------
   Read the tool's own SITE block and assert the rendered doses against THAT.
   An ED that gives 10 mL/kg boluses, or caps pediatric TXA differently, edits
   the config and is doing the right thing; a suite full of this site's numbers would
   turn red for it and teach that site to ignore a red run.

   What stays hardcoded, deliberately: that adult TXA is a FIXED dose while
   pediatric TXA is per-kg and capped, that calcium is fixed in adults and
   weight-based in children, that the obstetric workstream appears only when
   pregnancy is flagged, and the PHI guard. Those are the clinical structure and
   the golden rules, not local preferences. */
const CFG = await page.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
if (!CFG) { console.error('FATAL: /tca/ does not expose window.SITE — cannot verify against config'); process.exit(1); }
/* A pediatric weight and an adult weight, both derived from the configured
   threshold so they stay on the right side of it whatever it is set to. */
const PEDS_KG = 20;
const NEAR_PEDS_KG = CFG.trigger.maxKg - 1;
const ADULT_KG = CFG.trigger.maxKg + 30;
const perKg = (n, kg, cap) => Math.round(cap ? Math.min(n * kg, cap) : n * kg);

// --- initial state -----------------------------------------------------------
ok((await txt('clock')) === '0:00', 'clock starts at 0:00');
ok((await txt('statusword')) === 'READY', 'status READY at idle');
ok(await vis('#idle'), 'idle screen visible');
ok(!(await vis('#active')), 'active screen hidden at idle');
ok((await txt('plabel')).includes('TRAUMATIC CARDIAC ARREST'), 'protocol label set');

// team model is a localization setting, not a bedside toggle — the toggle must be gone
ok((await page.$('#modeSeq')) === null && (await page.$('#modeSim')) === null, 'no bedside mode toggle present');

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
// The weight-based fluid/med numbers are inline in the CIRCULATION workstream.
async function circText() {
  return page.evaluate(() => {
    const c = [...document.querySelectorAll('#worksteps .wcard')].find(e => /CIRCULATION/.test(e.textContent));
    return c ? c.textContent : '';
  });
}

// Start as adult, no weight
await page.click('#startbtn');
await page.waitForTimeout(200);
ok(await vis('#active'), 'active screen visible after declare');
ok((await txt('statusword')) === 'RESUS RUNNING', 'status RESUS RUNNING when active');
ok(errors.length === 0, 'no JS errors after start: ' + errors.join(' | '));

let circ = await circText();
ok(circ.includes(CFG.fluid.crystalloidMlPerKg + ' mL/kg'),
  `no-weight crystalloid shows ${CFG.fluid.crystalloidMlPerKg} mL/kg inline (SITE.fluid): ` + circ.slice(0,120));
ok(circ.includes(CFG.txa.adult), 'adult TXA is the configured fixed dose (SITE.txa.adult)');
ok(circ.includes(CFG.cal.adultChlorideG + ' g calcium chloride'),
  `adult calcium is the configured fixed ${CFG.cal.adultChlorideG} g CaCl2 (SITE.cal.adultChlorideG)`);

// workstreams present, obstetric hidden (not pregnant)
let names = await page.$$eval('#worksteps .wcard', els => els.map(e => e.textContent));
ok(names.length === 5, 'five workstreams when not pregnant (obstetric hidden), got ' + names.length);
ok(names[0].includes('HEMORRHAGE CONTROL'), 'first workstream is HEMORRHAGE CONTROL (lean, control-only)');
ok(names[1].includes('AIRWAY'), 'second workstream is AIRWAY');
ok(names[2].includes('BREATHING'), 'third workstream is BREATHING');
ok(names[3].includes('CIRCULATION'), 'fourth workstream is CIRCULATION (access & replace)');
ok(!names.join('').includes('OBSTETRIC'), 'OBSTETRIC hidden when not pregnant');

// hemorrhage control is lean — no MTP/TXA/calcium in the control card
ok(!names[0].toLowerCase().includes('massive transfusion') && !names[0].toLowerCase().includes('tranexamic'),
  'hemorrhage control card holds only mechanical control (no MTP/TXA)');
// circulation carries the weight-based fluid/med numbers inline
ok(/CIRCULATION[\s\S]*Crystalloid[\s\S]*Tranexamic[\s\S]*Calcium/i.test(names[3]),
  'circulation card carries crystalloid + TXA + calcium inline');
// airway uses i-gel, not LMA
ok(names[1].includes('i-gel') && !names[1].includes('LMA'), 'airway names i-gel, not LMA');
// breathing forbids chest tube/drain/ICC
ok(/no chest tube now/i.test(names[2]) && !/drain or ICC/i.test(names[2]), 'breathing says no chest tube (not drain/ICC)');

// links present and correct
const links = await page.$$eval('#worksteps a.wlink', as => as.map(a => ({t:a.textContent.trim(), h:a.getAttribute('href')})));
const hasLink = (t, h) => links.some(l => l.t.includes(t) && l.h.includes(h));
ok(hasLink('AVA 3Xi', 'procedures/?from=home#c14'), 'AVA 3Xi access link present');
ok(hasLink('Massive transfusion', 'codes/?from=home#c12'), 'MTP link present');
ok(hasLink('Resuscitative thoracotomy', 'procedures/?from=home#c02'), 'thoracotomy link present');
ok(hasLink('Tourniquet', 'procedures/?from=home#c10'), 'tourniquet link present');

// numbering visible in sequential mode
let hasNum = await page.$eval('#worksteps', e => /1|2|3/.test(e.textContent));
ok(hasNum, 'sequential mode shows priority numbers');

// --- pediatric weight 20 kg: crystalloid 400 mL, TXA 300 mg, calcium 400/1000 -
await page.fill('#wIn', String(PEDS_KG));
await page.waitForTimeout(200);
circ = await circText();
{
  const ml   = perKg(CFG.fluid.crystalloidMlPerKg, PEDS_KG);
  const txaM = perKg(CFG.txa.pedsMgPerKg, PEDS_KG, CFG.txa.pedsMaxMg);
  const cacl = perKg(CFG.cal.pedsChlorideMgPerKg, PEDS_KG, CFG.cal.pedsChlorideMaxMg);
  const glu  = perKg(CFG.cal.pedsGluconateMgPerKg, PEDS_KG, CFG.cal.pedsGluconateMaxMg);
  ok(circ.includes(ml + ' mL'), `peds ${PEDS_KG}kg crystalloid = ${ml} mL inline: ` + circ.slice(0,140));
  ok(circ.includes(txaM + ' mg'), `peds ${PEDS_KG}kg TXA = ${txaM} mg (${CFG.txa.pedsMgPerKg} mg/kg) inline`);
  ok(circ.includes('CaCl₂ ' + cacl + ' mg') && circ.includes('Ca gluconate ' + glu + ' mg'),
    `peds ${PEDS_KG}kg calcium computes: CaCl2 ${cacl} mg + gluconate ${glu} mg`);
}
ok((await txt('wnote')).includes('pediatric'), `wnote flags pediatric at ${PEDS_KG}kg`);

// peds TXA cap: 49 kg peds -> 15*49 = 735 mg
await page.fill('#wIn', String(NEAR_PEDS_KG));
await page.waitForTimeout(150);
circ = await circText();
{
  const txaM = perKg(CFG.txa.pedsMgPerKg, NEAR_PEDS_KG, CFG.txa.pedsMaxMg);
  ok(circ.includes(txaM + ' mg'),
    `just under the ${CFG.trigger.maxKg} kg threshold still doses as peds: TXA = ${txaM} mg`);
}
await page.fill('#wIn', '');
await page.waitForTimeout(100);

// --- adult weight 80 kg: crystalloid 1600 mL, TXA fixed, calcium fixed --------
await page.fill('#wIn', String(ADULT_KG));
await page.waitForTimeout(150);
circ = await circText();
{
  const ml = perKg(CFG.fluid.crystalloidMlPerKg, ADULT_KG);
  ok(circ.includes(ml + ' mL'), `adult ${ADULT_KG}kg crystalloid = ${ml} mL inline`);
}
/* Structural, not local: above the threshold TXA and calcium stop scaling with
   weight. Asserting the SAME strings the no-weight case produced is the point. */
ok(circ.includes(CFG.txa.adult), `adult ${ADULT_KG}kg TXA is the fixed dose, not weight-scaled`);
ok(circ.includes(CFG.cal.adultChlorideG + ' g calcium chloride'),
  `adult ${ADULT_KG}kg calcium is the fixed dose, not weight-scaled`);

// --- checklist logs to timeline ----------------------------------------------
await page.click('#worksteps .wrow');   // first hemorrhage task
await page.waitForTimeout(150);
// open event log accordion
await page.click('[data-acc="log"]');
await page.waitForTimeout(150);
let logtext = await page.$eval('.accb', e => e.textContent).catch(()=>'');
ok(logtext.includes('Compress external bleeding'), 'checking a task logs it to the timeline');
await page.click('[data-acc="log"]'); // close

// checkbox toggles back off
let firstBox = await page.$eval('#worksteps .wrow .wbox', e => e.textContent);
ok(firstBox === '✓', 'checked box shows tick');

/* --- framing follows the CONFIGURED model, whichever it is -------------------
   Asserted against CFG.mode rather than against one hospital's answer. An
   unlocalized template has no model, and the screen must say so rather than
   pick one. */
if (CFG.mode === 'sequential') {
  ok((await txt('worktitle')).includes('ORDER'), 'sequential worktitle mentions priority order');
  ok((await txt('plabel')).includes('SEQUENTIAL'), 'plabel reflects the configured sequential mode');
} else if (CFG.mode === 'simultaneous') {
  ok((await txt('worktitle')).includes('PARALLEL'), 'simultaneous worktitle mentions parallel');
  ok((await txt('plabel')).includes('SIMULTANEOUS'), 'plabel reflects the configured simultaneous mode');
} else {
  ok(CFG.mode === null, 'no team model configured (template build)');
  ok(!/SEQUENTIAL|SIMULTANEOUS/.test(await txt('plabel')), 'unlocalized: screen does not claim a team model');
}
ok((await txt('cprnote')).toLowerCase().includes('pause'), 'CPR-in-progress pause note present');

/* --- the OTHER team model, driven the way a fork actually sets it ------------
   A site localizes by answering caps.tcaTeamModel, so that is what this drives:
   the built page is loaded with the answer overridden before any script runs.
   (The previous version rewrote the source file on disk and opened it over
   file://, which tested a copy of the tool that no longer resembled the one
   that ships — no injected CSS, no LOCAL() reader.) */
async function withModel(model) {
  const p2 = await browser.newPage();
  await p2.addInitScript(m => {
    /* SITE_CONFIG is written at the top of <head>; patch it as soon as it
       exists and before the tool's own SITE block reads it. */
    Object.defineProperty(window, 'SITE_CONFIG', {
      configurable: true,
      set(v) { if (v && v.config && v.config.caps) v.config.caps.tcaTeamModel = m;
               Object.defineProperty(window, 'SITE_CONFIG', { value: v, writable: true, configurable: true }); },
      get() { return undefined; },
    });
  }, model);
  await p2.goto(url);
  await p2.waitForTimeout(250);
  return p2;
}
{
  const p2 = await withModel('simultaneous');
  await p2.click('#startbtn');
  await p2.waitForTimeout(200);
  const wt = await p2.$eval('#worktitle', e => e.textContent);
  const pl = await p2.$eval('#plabel', e => e.textContent);
  const cn = await p2.$eval('#cprnote', e => e.textContent.toLowerCase());
  ok(wt.includes('PARALLEL'), 'simultaneous config: worktitle mentions parallel');
  ok(pl.includes('SIMULTANEOUS'), 'simultaneous config: plabel reflects simultaneous');
  ok(cn.includes('concurrent'), 'simultaneous config: CPR note says concurrent');
  await p2.close();
}
{
  const p2 = await withModel('sequential');
  await p2.click('#startbtn');
  await p2.waitForTimeout(200);
  const wt = await p2.$eval('#worktitle', e => e.textContent);
  const pl = await p2.$eval('#plabel', e => e.textContent);
  ok(wt.includes('ORDER'), 'sequential config: worktitle mentions priority order');
  ok(pl.includes('SEQUENTIAL'), 'sequential config: plabel reflects sequential');
  await p2.close();
}

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
ok(names.length === 6, 'six workstreams when pregnant, got ' + names.length);
ok(names.join('').includes('OBSTETRIC'), 'OBSTETRIC shown when pregnant');
const plinks = await page.$$eval('#worksteps a.wlink', as => as.map(a => a.getAttribute('href')));
ok(plinks.some(h => h.includes('ob-neonatal/?from=home#c10')), 'resuscitative hysterotomy link present when pregnant');

// --- reversible addressed -> conventional window -----------------------------
await page.click('#addressedbtn');
await page.waitForTimeout(150);
ok(await vis('#convstrip'), 'conventional window appears after MARK ADDRESSED');
{
  const want = CFG.conventionalResusMin;
  const shown = await txt('convclock');
  /* Started a moment ago, so it reads the configured minutes or one second less. */
  ok(shown === want + ':00' || shown.startsWith((want - 1) + ':'),
    `conventional countdown starts at the configured ${want} min (SITE.conventionalResusMin), got ` + shown);
}

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
