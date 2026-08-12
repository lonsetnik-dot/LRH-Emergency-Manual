/* LRH Emergency Manual — the two OB live-protocol engines, /pph/ and /dystocia/ (issue #135).
 *
 * One suite for both because they ship together and are the same kind of thing: a card that was
 * doing an engine's job, rebuilt around the clock it could not hold. Each is asserted on the thing
 * it exists to add —
 *
 *   PPH        the running blood loss as first-class state, escalation on the TREND rather than a
 *              threshold, and a uterotonic being ruled out for you rather than recalled at 1.5 L.
 *   DYSTOCIA   the head-to-body interval, which must stay continuous across a second run of the
 *              ladder — restarting it would erase the only number that ends up in the record.
 *
 * Config-driven per #117. What stays written out is what a fork must not be able to localize away:
 * that fundal pressure is never offered, that a contraindicated drug cannot be marked given, and
 * that both screens say plainly their doses are inherited rather than re-derived.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_ob_engines.mjs
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
const lit = s => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');

const errs = [], reqs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
pg.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) reqs.push(u); });
await pg.addInitScript(() => {
  window.__skew = 0; const real = Date.now.bind(Date); Date.now = () => real() + window.__skew;
});
const skew = async ms => { await pg.evaluate(v => { window.__skew = v; }, ms); await pg.waitForTimeout(700); };
const txt = async sel => (await pg.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const tap = async (sel, ms = 250) => { await pg.click(sel); await pg.waitForTimeout(ms); };
const openAcc = async id => { await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(250);
  const t = (await pg.locator('.accb').innerText()).replace(/\s+/g, ' ').trim();
  await pg.click('[data-acc="' + id + '"]'); await pg.waitForTimeout(120); return t; };
const load = async path => {
  await pg.goto(BASE + path + '?from=home', { waitUntil: 'networkidle' });
  await pg.evaluate(() => { window.__skew = 0; });
  await pg.waitForTimeout(300);
  return pg.evaluate(() => (typeof window.SITE === 'object' ? window.SITE : null));
};

/* ========================= PPH ========================= */
console.log('--- /pph/ ---');
const P = await load('/pph/');
if (!P) { console.error('FATAL: /pph/ does not expose window.SITE'); process.exit(1); }

ck('P1. loads with no page errors', errs.length, 0);
ck('P1. no off-origin requests', reqs.join(',') || 'none', 'none');
ck('P1. starts idle', await pg.locator('#idle').isVisible(), true);
ck('P1. version stamped from config',
   lit(`v${P.version} · last reviewed ${P.lastReviewed}`).test(await txt('#verstamp')), true);
ck('P1. standard disclaimer present',
   /not part of the hospital IT system\/EHR, not a substitute for clinical judgment/.test(await pg.innerText('body')), true);

/* Provenance — the doses are inherited and the screen has to keep saying so. */
ck('P2. the provenance banner shows', await pg.locator('#revbanner').isVisible(), true);
ck('P2. it says the doses were inherited, not re-derived',
   /INHERITED, NOT RE-DERIVED/i.test(await txt('#revbanner')), true);
const psrc = await openAcc('src');
ck('P2. source cites ACOG Practice Bulletin 183', /Practice Bulletin 183/.test(psrc), true);
ck('P2. source names the AIM haemorrhage bundle', /AIM/.test(psrc) && /bundle/i.test(psrc), true);
ck('P2. TXA timing is attributed to WOMAN', /WOMAN trial/i.test(psrc), true);
ck('P2. it admits the old card carried no citation', /no citation of its own/i.test(psrc), true);
ck('P2. it states the engine adds no clinical values', /adds no clinical values/i.test(psrc), true);

/* Routing — the mother and the newborn need different people. */
const pscope = await txt('#scopebar');
ck('P3. scope bar says escalate on the trend', /trend/i.test(pscope), true);
ck('P3. it routes the newborn elsewhere and asks who stays with her',
   /neonatal resuscitation/i.test(pscope) && /who is staying with her/i.test(pscope), true);

/* THE REASON THIS IS AN ENGINE — running blood loss. */
await tap('#startbtn', 320);
ck('P4. the clock starts at recognition', /recognized/i.test(await openAcc('log')), true);
ck('P4. EBL starts at zero', /^0 mL/.test(await txt('#eblbox')), true);
ck(`P4. one add button per configured step (${P.eblSteps.map(s => s.ml).join('/')})`,
   await pg.locator('[data-ebl]').count(), P.eblSteps.length);
const firstMark = P.eblMarks[0];
let acc = 0;
while (acc < firstMark.ml) { await tap(`[data-ebl="${P.eblSteps[P.eblSteps.length - 1].ml}"]`, 120); acc += P.eblSteps[P.eblSteps.length - 1].ml; }
ck(`P4. the running total reaches ${acc} mL`, lit(acc + ' mL EBL').test(await txt('#eblbox')), true);
ck('P4. the total is in the header, where it cannot scroll away', lit(acc + ' mL').test(await txt('#statusword')), true);
ck(`P4. crossing ${firstMark.ml} mL fires a trend prompt (SITE.eblMarks)`,
   lit('EBL ' + firstMark.ml + ' mL').test(await openAcc('log')), true);

/* Contraindication guard — the thing a printed card cannot do. */
const blockedMed = P.meds.filter(m => m.block)[0];
await pg.click('[data-acc="flags"]'); await pg.waitForTimeout(250);
ck(`P5. a toggle per configured flag`, await pg.locator('[data-flag]').count(), P.flags.length);
await tap(`[data-flag="${blockedMed.block}"]`);
await pg.click('[data-acc="flags"]'); await pg.waitForTimeout(150);
await skew(6 * 60 * 1000);
const pmeds = await txt('#phasebox');
ck(`P5. ${blockedMed.n} is offered once its band is reached`, lit(blockedMed.n).test(pmeds), true);
ck(`P5. flagging ${blockedMed.block} blocks it and says why`,
   lit(blockedMed.blockWhy).test(pmeds), true);
/* Non-vacuous on purpose: the first half fails if nothing is blocked at all,
   the second fails if a blocked drug still offers a GIVEN button. An earlier
   version asserted only the second and passed happily with the guard disabled. */
ck('P5. the blocked drug is visibly blocked', await pg.locator('.med.blocked').count() > 0, true);
ck('P5. and it offers no GIVEN button at all',
   await pg.locator(`button[data-med="${blockedMed.id}"]`).count(), 0);
/* Universal, not localizable: a drug with a contraindication must declare it. */
P.meds.filter(m => m.block).forEach(m =>
  ck(`P5. ${m.n} declares its contraindication in config`, !!m.blockWhy, true));

const okMed = P.meds.filter(m => !m.block)[0];
await tap(`[data-med="${okMed.id}"]`);
ck(`P5. ${okMed.n} records the time it was given`, /✓ GIVEN \d+:\d\d/.test(await txt('#phasebox')), true);
ck('P5. and it is logged with its dose', lit(okMed.n + ' given').test(await openAcc('log')), true);

/* The bands advance with the clock, in order. */
await skew(16 * 60 * 1000);
ck('P6. past 15 minutes the persistent band is showing',
   lit(P.phases[P.phases.length - 1].label).test(await txt('#phasebox')), true);
ck(`P6. it calls for ${P.blood.oNegUnits} units of O-negative`,
   lit(P.blood.oNegUnits + ' units uncrossmatched O-negative').test(await txt('#phasebox')), true);
ck('P6. and names massive transfusion as say-it-do-not-dial',
   /say it, do not dial/i.test(await txt('#phasebox')), true);
ck(`P6. the recorder's ${P.callEveryMin}-minute call arrives`,
   /-minute call/.test(await txt('#phasebox')), true);

/* PHI + state hygiene. */
await tap('#logtoggle');
await pg.fill('#customin', 'MRN 4457821'); await tap('#customlog');
ck('P7. a record number is refused', await pg.locator('#customwarn').isVisible(), true);
await pg.fill('#customin', 'bimanual compression started'); await tap('#customlog');
ck('P7. a clinical note is accepted', await pg.locator('#customrow').isVisible(), false);
ck('P7. localStorage holds only the theme preference',
   (await pg.evaluate(() => Object.keys(localStorage))).filter(k => k !== 'lrh-pref-theme').join(',') || 'none', 'none');

/* ===================== SHOULDER DYSTOCIA ===================== */
console.log('\n--- /dystocia/ ---');
const D = await load('/dystocia/');
if (!D) { console.error('FATAL: /dystocia/ does not expose window.SITE'); process.exit(1); }

ck('D1. starts idle', await pg.locator('#idle').isVisible(), true);
ck('D1. version stamped from config',
   lit(`v${D.version} · last reviewed ${D.lastReviewed}`).test(await txt('#verstamp')), true);
ck('D2. the provenance banner shows', await pg.locator('#revbanner').isVisible(), true);
ck('D2. it says the sequence was inherited', /INHERITED, NOT RE-DERIVED/i.test(await txt('#revbanner')), true);
const dsrc = await openAcc('src');
ck('D2. source names HELPERR and ALSO', /HELPERR/.test(dsrc) && /Advanced Life Support in Obstetrics/i.test(dsrc), true);
ck('D2. source cites ACOG Practice Bulletin 178', /Practice Bulletin 178/.test(dsrc), true);
/* The timings must be presented as a convention, not a countdown — a maneuver
   that is working is not abandoned because 30 seconds elapsed. */
ck('D2. the per-maneuver timings are called a teaching convention',
   /teaching convention/i.test(dsrc), true);

const dscope = await txt('#scopebar');
ck('D3. scope bar names the head-to-body interval', /head-to-body interval/i.test(dscope), true);
ck('D3. it says to work the maneuvers in order', /in order/i.test(dscope), true);
ck('D3. it hands off to neonatal resuscitation', /neonatal resuscitation/i.test(dscope), true);

/* THE PROHIBITION — pinned, and not localizable away. */
await tap('#startbtn', 320);
ck('D4. the never-banner is on screen', await pg.locator('#neverbox').isVisible(), true);
ck('D4. it forbids fundal pressure', /NO FUNDAL PRESSURE/i.test(await txt('#neverbox')), true);
ck('D4. it forbids pulling', /NO PULLING/i.test(await txt('#neverbox')), true);
ck('D4. the reason is given in the reference', /ruptures uteri/i.test(await openAcc('never')), true);
ck('D4. fundal pressure is never offered as a step anywhere on the screen',
   /fundal pressure(?!.{0,40}(not|never|no ))/i.test((await pg.innerText('body')).replace(/NO FUNDAL PRESSURE/gi, '')), false);

/* The ladder, walked in order. */
ck(`D5. the ladder has ${D.ladder.length} rungs (SITE.ladder)`, await pg.locator('.lrow').count(), D.ladder.length);
ck('D5. it opens on the first rung', lit('RUNG 1 OF ' + D.ladder.length).test(await txt('#phasebox')), true);
for (let i = 0; i < D.ladder.length - 1; i++) {
  await tap('#nextrung', 160);
  ck(`D5. rung ${i + 2} is ${D.ladder[i + 1].k} — ${D.ladder[i + 1].n.replace(/&amp;/g, '&')}`,
     lit('RUNG ' + (i + 2) + ' OF ' + D.ladder.length).test(await txt('#phasebox')), true);
}
ck('D5. every completed rung is marked done', await pg.locator('.lrow.done').count(), D.ladder.length - 1);

/* THE THING THAT MUST NOT HAPPEN: the clock restarting on round two. The
   head-to-body interval is continuous, and it is the number that ends up in
   the record. */
await skew(90 * 1000);
const beforeRound2 = await txt('#clock');
await tap('#nextrung', 300);
ck('D6. running the sequence again returns to the first rung',
   lit('RUNG 1 OF ' + D.ladder.length).test(await txt('#phasebox')), true);
ck('D6. and says which round it is', /ROUND 2/.test(await txt('#plabel')), true);
const afterRound2 = await txt('#clock');
const toSec = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
ck('D6. THE CLOCK DOES NOT RESTART — head-to-body is continuous',
   toSec(afterRound2) >= toSec(beforeRound2), true);
ck('D6. the restart is logged', /round 2/i.test(await openAcc('log')), true);

/* Last resort only appears once late. */
await skew((D.lastResortMin + 1) * 60 * 1000);
const late = await txt('#phasebox');
D.lastResort.forEach((x, i) =>
  ck(`D7. last-resort option ${i + 1} appears past ${D.lastResortMin} min`, lit(x.slice(0, 24)).test(late), true));

/* Handoff. */
await tap('#outbtn', 300);
ck('D8. delivering shows the head-to-body interval', /\d+:\d\d/.test(await txt('#outat')), true);
ck('D8. it sends the baby to neonatal resuscitation',
   await pg.getAttribute('#tonrp', 'href'), '../neonatal/?from=home');
ck('D8. and warns about postpartum hemorrhage next', /PPH engine/.test(await txt('#outbody')), true);
ck('D8. the maneuver record is in the log', /Announce/i.test(await openAcc('log')), true);

/* ===================== both, wired in ===================== */
console.log('\n--- discoverable ---');
const home = await b.newPage();
await home.goto(BASE + '/?from=tool', { waitUntil: 'networkidle' });
await home.waitForTimeout(250);
for (const [term, want] of [['postpartum hemorrhage', 'pph/'], ['shoulder dystocia', 'dystocia/'],
                            ['helperr', 'dystocia/'], ['ebl', 'pph/']]) {
  await home.fill('#q', term);
  await home.waitForTimeout(200);
  const hrefs = await home.evaluate(() => [...document.querySelectorAll('#results a')].map(a => a.getAttribute('href')));
  ck(`9. searching "${term}" surfaces ${want}`, hrefs.some(h => h && h.includes(want)), true);
}
ck('9. the landing page has a PPH tile', await home.locator('a[href*="pph/"]').count() > 0, true);
ck('9. and a dystocia tile', await home.locator('a[href*="dystocia/"]').count() > 0, true);
await home.close();

/* The cards they replace must still resolve and must point across. */
const card = await b.newPage();
await card.goto(BASE + '/ob-neonatal/?from=home#c06', { waitUntil: 'networkidle' });
await card.waitForTimeout(300);
const cardHrefs = await card.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
ck('9. card 06 links across to the PPH engine', cardHrefs.some(h => /pph\//.test(h)), true);
ck('9. card 07 links across to the dystocia engine', cardHrefs.some(h => /dystocia\//.test(h)), true);
await card.close();

ck('10. no page or console errors across the whole run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));
ck('10. still no off-origin requests', reqs.join(',') || 'none', 'none');

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
