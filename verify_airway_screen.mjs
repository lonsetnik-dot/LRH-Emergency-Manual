/* LRH Emergency Manual — the DAS 2025 airway ladder (/airway/).
 *
 * This screen has one job that a human tester cannot reliably check by clicking: that the ladder
 * cannot be walked in the wrong order, and that the attempt ceilings are the ones DAS 2025 actually
 * publishes (3 + 1 senior, 3 SAD, 3 mask) rather than the older 2015 numbers. Those transitions are
 * asserted first and hardest. Everything after that guards against the two things most likely to be
 * broken by a later edit: an SpO2 threshold creeping in (DAS 2025 gives none), and the scope
 * disclaimer being softened.
 *
 *     python3 -m http.server 8123
 *     node verify_airway_screen.mjs
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

const errs = [];
const reqs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });

const txt = async sel => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const fresh = async () => { await pg.goto(BASE + '/airway/', { waitUntil: 'networkidle' }); await pg.waitForTimeout(300); };
const tap = async (sel, ms = 200) => { await pg.click(sel); await pg.waitForTimeout(ms); };
const openAcc = async id => { await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(250);
  return (await pg.locator('.accb').innerText()).replace(/\s+/g, ' ').trim(); };
const start = async () => { await fresh(); await tap('#startbtn', 300); };

/* ---- 1. offline-safe and the opening state ---- */
await fresh();
ck('1. loads with no page errors', errs.length, 0);
ck('1. no off-origin requests (offline-safe)', reqs.join(',') || 'none', 'none');
ck('1. starts in the idle phase', await pg.locator('#idle').isVisible(), true);
ck('1. the ladder is hidden until declared', await pg.locator('#ladder').isVisible(), false);
ck('1. dark theme is the default', await pg.evaluate(() => document.body.dataset.theme), 'dark');
ck('1. status word reads READY', await txt('#statusword'), 'READY');
ck('1. clock starts at zero', await txt('#clock'), '0:00');

/* ---- 2. the scope bar — the single most important sentence on the screen ---- */
const scope = await txt('#scopebar');
ck('2. scope bar names the no-pulse case', /no pulse/i.test(scope), true);
ck('2. scope bar routes to the arrest screen', await pg.getAttribute('#scopebar a', 'href'), '../arrest/');
ck('2. scope bar says DAS gives no arrest algorithm', /no arrest algorithm/i.test(scope), true);
ck('2. scope bar says the wake options do not exist here', /wake-the-patient options do not exist/i.test(scope), true);
ck('2. scope bar also routes pulse-but-not-breathing to rescue breathing', /a pulse but no breathing.{0,80}rescue breathing, not this ladder/i.test(scope), true);

/* ---- 3. the pre-induction card carries the DAS 2025 numbers, not 2015 ---- */
const idle = await txt('#idle');
ck('3. ETO2 target 0.9', /ETO₂ ≥0\.9/.test(idle), true);
ck('3. head up 30 degrees', /head up ≥30°/.test(idle), true);
ck('3. HFNO 30 L/min', /HFNO >30 L\/min/.test(idle), true);
ck('3. peroxygenation named', /peroxygenation/i.test(idle), true);
ck('3. videolaryngoscopy is first-line, not rescue', /Videolaryngoscopy is first-line/i.test(idle), true);
ck('3. rocuronium 1.2 mg/kg', /rocuronium 1\.2 mg\/kg/i.test(idle), true);
ck('3. suxamethonium 1.5 mg/kg', /suxamethonium 1\.5 mg\/kg/i.test(idle), true);

/* ---- 4. PLAN A — the 3+1 rule, and only 3+1 ---- */
await start();
ck('4. declaring moves into the ladder', await pg.locator('#ladder').isVisible(), true);
ck('4. opens on Plan A', await txt('#statusword'), 'PLAN A');
ck('4. header label tracks the plan', /PLAN A/.test(await txt('#plabel')), true);
let box = await txt('#planbox');
ck('4. Plan A is videolaryngoscopy', /Videolaryngoscopy, first-line/.test(box), true);
ck('4. counter shows 0 of 3 plus 1 senior', /0 of 3 \+ 1 senior/.test(box), true);
ck('4. defines what an attempt is', /any instrumentation with a device/i.test(box), true);
ck('4. says change something between attempts', /change something/i.test(box), true);
await tap('#attempt'); await tap('#attempt');
ck('4. two attempts counted', /2 of 3 \+ 1 senior/.test(await txt('#planbox')), true);
ck('4. no senior warning at two', /Three attempts used/.test(await txt('#planbox')), false);
await tap('#attempt');
box = await txt('#planbox');
ck('4. third attempt arms the senior warning', /Three attempts used/.test(box), true);
ck('4. fourth is only for a more experienced colleague', /only.{0,4} for a more experienced colleague/i.test(box), true);
ck('4. the button becomes the senior attempt', /SENIOR ATTEMPT/.test(box), true);
ck('4. 3 + 1 is called a ceiling, not a quota', /ceiling, not a quota/i.test(box), true);
await tap('#attempt');
ck('4. the senior attempt hands off to Plan B', await txt('#statusword'), 'PLAN B');

/* ---- 5. failure can be declared early, at any rung ---- */
await start();
await tap('#failA');
ck('5. Plan A failure can be declared on attempt zero', await txt('#statusword'), 'PLAN B');
box = await txt('#planbox');
ck('5. Plan B is a second-generation SAD', /Second-generation SAD/.test(box), true);
ck('5. Plan B counter starts at 0 of 3', /0 of 3 insertions/.test(box), true);
await tap('#failB');
ck('5. Plan B failure can be declared early', await txt('#statusword'), 'PLAN C');
box = await txt('#planbox');
ck('5. Plan C is two people four hands', /Two people, four hands/.test(box), true);
ck('5. Plan C insists on full neuromuscular block', /Ensure full neuromuscular block/i.test(box), true);
await tap('#cico');
ck('5. CICO can be declared from Plan C', await txt('#statusword'), 'PLAN D');

/* ---- 6. the ceilings on B and C ---- */
await start();
await tap('#failA');
await tap('#attempt'); await tap('#attempt');
ck('6. two SAD attempts stay on Plan B', await txt('#statusword'), 'PLAN B');
await tap('#attempt');
ck('6. the third SAD attempt hands off to Plan C', await txt('#statusword'), 'PLAN C');
await tap('#attempt'); await tap('#attempt');
ck('6. two mask attempts stay on Plan C', await txt('#statusword'), 'PLAN C');
await tap('#attempt');
ck('6. the third mask attempt declares CICO', await txt('#statusword'), 'PLAN D');

/* ---- 7. STOP AND THINK — four options, wake is the default ---- */
await start();
await tap('#failA');
await tap('#worksB');
box = await txt('#planbox');
ck('7. ventilating SAD triggers stop and think', /STOP AND THINK/.test(box), true);
ck('7. option 1 is wake, marked the default', /1 · Wake the patient — the default/.test(box), true);
ck('7. option 2 proceed is marked high risk', /2 · Proceed using the SAD — high risk/.test(box), true);
ck('7. option 3 through-SAD is capped at ONE attempt', /ONE attempt, bronchoscope/.test(box), true);
ck('7. option 4 is front-of-neck', /4 · Front-of-neck airway/.test(box), true);
ck('7. all four options are offered', await pg.locator('[data-st]').count(), 4);
await tap('[data-st="viaSAD"]');
ck('7. choosing through-SAD returns to the Plan B rung', await txt('#statusword'), 'PLAN B');
await tap('#worksB');
await tap('[data-st="fona"]');
ck('7. choosing front-of-neck jumps to Plan D', await txt('#statusword'), 'PLAN D');

/* ---- 8. PLAN D — the eFONA sequence, walked one step at a time ---- */
await start();
await tap('#failA'); await tap('#failB'); await tap('#cico', 300);
box = await txt('#planbox');
ck('8. Plan D is scalpel bougie tube', /Scalpel · bougie · tube/.test(box), true);
ck('8. the words to say out loud are given', /Cannot intubate, cannot oxygenate/i.test(box), true);
ck('8. no eFONA without full neuromuscular block', /Do not attempt an eFONA without full neuromuscular block/i.test(box), true);
ck('8. kit lists a size 10 scalpel', /size 10 scalpel/.test(box), true);
ck('8. kit lists a coude bougie', /coud[ée]-tip bougie/.test(box), true);
ck('8. kit lists a 6.0 cuffed tube', /6\.0 mm cuffed/.test(box), true);
ck('8. seventeen steps in the sequence', /STEP 1 OF 17/.test(box), true);
ck('8. step one positions the operator', /Stand on the patient/.test(box), true);
ck('8. there is no BACK on step one', await pg.locator('#fonaback').count(), 0);
await tap('#fonanext');
box = await txt('#planbox');
ck('8. next advances to step two', /STEP 2 OF 17/.test(box), true);
ck('8. BACK appears from step two', await pg.locator('#fonaback').count(), 1);
await tap('#fonaback');
ck('8. BACK returns to step one', /STEP 1 OF 17/.test(await txt('#planbox')), true);
for (let i = 0; i < 16; i++) await tap('#fonanext', 60);
box = await txt('#planbox');
ck('8. the last step is step 17', /STEP 17 OF 17/.test(box), true);
ck('8. the last step is securing the tube', /Secure the tube/.test(box), true);
ck('8. the finish button is capnography-confirmed', await pg.locator('#fonadone').count(), 1);
ck('8. there is no NEXT past the last step', await pg.locator('#fonanext').count(), 0);
await tap('#fonadone', 300);
ck('8. finishing moves to the secured phase', await pg.locator('#secured').isVisible(), true);

/* ---- 9. priming happens in parallel, and stops nagging once done ---- */
await start();
ck('9. the prime prompt is up on Plan A', await pg.locator('#primebox').isVisible(), true);
ck('9. it says do not wait for CICO', /DO NOT WAIT FOR CICO/.test(await txt('#primebox')), true);
await tap('#primebtn');
ck('9. logging the prime dismisses the prompt', await pg.locator('#primebox').isVisible(), false);
await start();
await tap('#failA'); await tap('#failB'); await tap('#cico', 300);
ck('9. the prime prompt is gone by Plan D regardless', await pg.locator('#primebox').isVisible(), false);

/* ---- 10. the secured phase ---- */
await start();
await tap('#securedbtn', 300);
ck('10. securing hides the ladder', await pg.locator('#ladder').isVisible(), false);
ck('10. status word reads SECURED', await txt('#statusword'), 'SECURED');
const sec = await txt('#secured');
ck('10. confirm with waveform capnography', /waveform capnography/i.test(sec), true);
ck('10. every failed intubation goes to M&M', /goes to M&M review/i.test(sec), true);
await tap('#resumebtn', 300);
ck('10. losing it again returns to the ladder', await pg.locator('#ladder').isVisible(), true);

/* ---- 11. the reference accordions ---- */
await fresh();
const preox = await openAcc('preox');
ck('11. cricoid 10 N awake', /10 N awake/.test(preox), true);
ck('11. cricoid 30 N once unconscious', /30 N once unconscious/.test(preox), true);
ck('11. audible SpO2 tone before induction', /audible SpO₂ tone/i.test(preox), true);

const trig = await openAcc('triggers');
ck('11. triggers are attempts, time and physiology', /attempt count, time taken and physiological response/i.test(trig), true);
ck('11. states plainly that no SpO2 cut-off is given', /No SpO₂ number and no time limit is given/i.test(trig), true);
ck('11. no invented saturation threshold anywhere on the page',
  /SpO.{0,3}\s*(<|below|under|&lt;)\s*\d{2}/i.test(await pg.evaluate(() => document.body.innerText)), false);

const say = await openAcc('say');
ck('11. the three declarations are scripted', (say.match(/Failed intubation|Failed SAD ventilation|Cannot intubate, cannot oxygenate/g) || []).length, 3);

const fona = await openAcc('fona');
ck('11. the full sequence lists all 17 steps', await pg.locator('.accb ol li').count(), 17);
ck('11. vertical is named the 2025 default', /Vertical is the 2025 default/i.test(fona), true);
ck('11. incision up to 8 cm', /up to 8 cm/.test(fona), true);
ck('11. bougie to 10-15 cm', /10–15 cm/.test(fona), true);

const why = await openAcc('why');
ck('11. says DAS publishes no causes mnemonic', /does not publish a causes mnemonic/i.test(why), true);
ck('11. DOPES — displacement', /D — Displacement/.test(why), true);
ck('11. DOPES — obstruction', /O — Obstruction/.test(why), true);
ck('11. DOPES — pneumothorax', /P — Pneumothorax/.test(why), true);
ck('11. DOPES — equipment', /E — Equipment/.test(why), true);
ck('11. DOPES — stacked breaths', /S — Stacked breaths/.test(why), true);
ck('11. attributes DOPES to Codes card 14, not to DAS', /Codes card 14, not from DAS/i.test(why), true);
ck('11. points a soiled airway at the SALAD card', /SALAD card/.test(why), true);

const scopeAcc = await openAcc('scope');
ck('11. names the guideline as anaesthesia-only', /written for anaesthesia/i.test(scopeAcc), true);
ck('11. lists the un-updated sibling guidelines', /obstetric \(OAA\/DAS 2015\)/.test(scopeAcc), true);
ck('11. tracheostomy is flagged as not DAS at all', /National Tracheostomy Safety Project/.test(scopeAcc), true);

const src = await openAcc('src');
ck('11. cites the BJA reference', /Br J Anaesth 2026;136\(1\):283–307/.test(src), true);
ck('11. cites the DOI', /10\.1016\/j\.bja\.2025\.10\.006/.test(src), true);
ck('11. cites the PMID', /PMID 41203471/.test(src), true);
ck('11. states plainly that it supersedes DAS 2015', /supersedes DAS 2015/i.test(src), true);
ck('11. names the dissenting frameworks (ASA, Vortex)', /ASA 2022/.test(src) && /Vortex/.test(src), true);

/* ---- 12. the event log, and the PHI guard on it ---- */
await start();
ck('12. declaring is itself logged', /Difficult airway declared/.test(await openAcc('log')), true);
await pg.click('[data-acc="log"]'); await pg.waitForTimeout(150);
await tap('#logtoggle');
await pg.fill('#customin', 'MRN 4457821');
await tap('#customlog');
ck('12. a record number is refused', await pg.locator('#customwarn').isVisible(), true);
ck('12. the refusal says why', /mentions a record or account number/.test(await txt('#customwarn')), true);
await pg.fill('#customin', '04/12/1968');
await tap('#customlog');
ck('12. a date of birth is refused', /date of birth style date/.test(await txt('#customwarn')), true);
await pg.fill('#customin', 'ELM applied, size 4 iGel in');
await tap('#customlog');
ck('12. a clinical note is accepted', await pg.locator('#customrow').isVisible(), false);
ck('12. and appears in the log', /ELM applied, size 4 iGel in/.test(await openAcc('log')), true);
ck('12. nothing is written to localStorage', await pg.evaluate(() => localStorage.length), 0);
ck('12. nothing is written to sessionStorage', await pg.evaluate(() => sessionStorage.length), 0);

/* ---- 13. reset is two taps, and it clears everything ---- */
await start();
await tap('#attempt');
await tap('#resetbtn');
ck('13. the first tap only arms it', await txt('#resetbtn'), 'SURE?');
ck('13. the ladder is still up', await pg.locator('#ladder').isVisible(), true);
await tap('#resetbtn', 300);
ck('13. the second tap clears to idle', await pg.locator('#idle').isVisible(), true);
ck('13. the plan is back to A', /AIRWAY · DAS 2025 LADDER/.test(await txt('#plabel')), true);
ck('13. the log is empty again', /Nothing logged yet/.test(await openAcc('log')), true);

/* ---- 14. theme, hit targets and the stamp ---- */
await fresh();
await tap('#themebtn', 250);
ck('14. theme toggles to light', await pg.evaluate(() => document.body.dataset.theme), 'light');
ck('14. light accent is Dartmouth green', await pg.evaluate(() =>
  getComputedStyle(document.body).getPropertyValue('--accent').trim()), '#00693E');
await tap('#startbtn', 300);
const small = await pg.evaluate(() => [...document.querySelectorAll('button')]
  .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 38)
  .map(el => (el.textContent || '').trim().slice(0, 24)));
ck('14. every visible button is at least 38px tall', small.join(' | ') || 'none', 'none');
ck('14. version and last-reviewed date are stamped', /v\d+\.\d+ · last reviewed \d{4}-\d{2}-\d{2}/.test(await txt('#verstamp')), true);
ck('14. the standard disclaimer is present',
  /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await txt('body')), true);

ck('15. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('15. still no off-origin requests after the whole run', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
