/* ED Emergency Manual — regression checks for the 2026-08-08 bug-fix round.
 *
 * Run against a local server:
 *     python3 -m http.server 8123        # from the repo root, in another terminal
 *     node verify_bugfix_20260808.mjs
 *
 * Or against a deployed URL:
 *     BASE=https://system-audit-fixes--loquacious-dolphin-833eb2.netlify.app node verify_bugfix_20260808.mjs
 *
 * Needs Playwright once:  npm i -D playwright && npx playwright install chromium
 * Unlike the older verify_*.mjs files in this repo, this one resolves Playwright and the
 * browser binary at runtime instead of hardcoding a path, so it runs anywhere.
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

import { cfg, isTemplate } from './verify_site_config.mjs';

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const launchOpts = process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {};
let b;
try { b = await chromium.launch(launchOpts); }
catch (e) {
  console.error('Could not launch Chromium: ' + e.message);
  console.error('Try:  npx playwright install chromium   (or set PW_CHROME=/path/to/chrome)');
  process.exit(2);
}
console.log('testing against ' + BASE + '\n');
let pass=0, fail=0;
const ck=(name,got,want)=>{ const ok=String(got)===String(want); (ok?pass++:fail++);
  console.log((ok?'PASS ':'FAIL ')+name+'  got='+got+(ok?'':'  want='+want)); };

/* ---- 1. HEART: stale 3-hr no longer fabricates results ---- */
const pg = await b.newPage({viewport:{width:390,height:1400}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(BASE + '/clinical-pathways/heart/', {waitUntil:'networkidle'});
async function heart(t0,t1,t3){
  await pg.fill('#t0',''); await pg.fill('#t1',''); await pg.fill('#t3','');
  await pg.fill('#t0',String(t0)); await pg.fill('#t1',String(t1));
  if(t3!=='') await pg.fill('#t3',String(t3));
  await pg.waitForTimeout(110);
  return (await pg.textContent('#tropResult')).replace(/\s+/g,' ').trim();
}
/* ---- CONFIG-DRIVEN TROPONIN CASES (issue #117) ------------------------------
   Every input below is DERIVED from this site's own thresholds rather than
   typed as a number, so a fork with a different assay exercises the same
   clinical situations — "just inside the gray zone", "delta exactly at the
   rule-in boundary" — instead of failing because 50 is not its cutoff.

   What stays fixed is the STRUCTURE the cases prove, and that is the part a
   fork must not be able to localize away: that a value at the rule-in cutoff
   rules in on >= and not >, that a leftover 3-hour value outside the reflex
   band is ignored AND announced, and that the reflex band is the only branch
   in which a 3-hour value is consulted at all. */
const T = {
  ruleIn:   cfg('trop.ruleInValue'),
  deltaIn:  cfg('trop.ruleInDelta'),
  ruleOut:  cfg('trop.ruleOutValue'),
  deltaOut: cfg('trop.ruleOutDelta'),
  pain:     cfg('trop.ruleOutPainValue'),
  lod:      cfg('trop.singleLoD'),
  grayLo:   cfg('trop.grayLow'),
  grayHi:   cfg('trop.grayHigh'),
};
const tropLocalized = Object.values(T).every(v => v !== null);

if (!tropLocalized) {
  /* A template build has no assay. The only correct behavior is to refuse, and
     the only thing worth asserting is that it does — loudly, by name, without
     printing a classification that came from nowhere. */
  const r0 = await heart(10, 12, '');
  ck('TEMPLATE: unlocalized pathway refuses to classify', /NOT LOCALIZED/.test(r0), true);
  ck('TEMPLATE: and classifies nothing', /RULE-IN ZONE|D\/C HOME|AMI RULED OUT|REFLEX TO 3 HOURS/.test(r0), false);
  ck('TEMPLATE: and names where the answers go', /ONBOARDING/.test(r0), true);
} else {
  /* Inputs placed relative to this site's own boundaries. */
  const gRefl0 = T.grayLo + Math.floor((T.grayHi - T.grayLo) / 3);  // inside the gray zone
  const gRefl1 = gRefl0 + T.deltaOut + 1;                           // delta in the reflex band
  const gOut0  = T.grayLo + 1;                                      // gray zone, tiny delta
  const gOut1  = gOut0 + Math.max(0, T.deltaOut - 1);
  const hi0    = T.ruleIn + 10, hi1 = hi0 + 1;                      // clearly ruled in
  const dc0    = Math.max(0, T.ruleOut - 1);                        // below rule-out
  const dc1    = dc0 + Math.max(0, T.deltaOut - 1);
  const dIn0   = T.ruleOut * 2, dIn1 = dIn0 + T.deltaIn;            // delta exactly at cutoff
  const strayHi = T.grayHi;                                          // a leftover 3-hr value

  let r = await heart(gRefl0, gRefl1, '');
  ck(`t0=${gRefl0} t1=${gRefl1} (delta in the reflex band) -> reflex`, /REFLEX TO 3 HOURS/.test(r), true);
  // In the reflex band a 3-hr value is legitimately consulted — that is not staleness.
  r = await heart(gRefl0, gRefl1, gRefl0);
  ck('reflex band DOES use a 3-hr value', /AMI RULED OUT/.test(r), true);
  ck('  ...and does NOT warn (value is in play)', /not used/i.test(r), false);
  // Outside the reflex band a leftover 3-hr must be ignored AND called out.
  r = await heart(gOut0, gOut1, strayHi);
  ck('gray zone ignores stale t3', /AMI RULED OUT/.test(r), true);
  ck('  ...and warns it is unused', /not used/i.test(r), true);
  r = await heart(hi0, hi1, T.ruleOut);
  ck('rule-in ignores stale t3', /RULE-IN ZONE/.test(r), true);
  ck('  ...and warns it is unused', /not used/i.test(r), true);
  r = await heart(T.lod, T.lod, strayHi);
  ck('D/C home ignores stale t3', /D\/C HOME/.test(r), true);

  await pg.click('input[name="pain"][value="yes"]');
  r = await heart(T.lod, T.lod + T.deltaIn - 1, '');
  ck('pain + rising into the reflex band reflexes', /REFLEX TO 3 HOURS/.test(r), true);
  r = await heart(T.lod, T.lod, '');
  ck('pain + flat below detection still D/C', /D\/C HOME/.test(r), true);

  // real reflex path still works
  r = await heart(gRefl0, gRefl1, gRefl0 + 2);
  ck('true reflex, 3hr flat -> ruled out', /AMI RULED OUT/.test(r), true);
  r = await heart(gRefl0, gRefl1, T.ruleIn - 5);
  ck('true reflex, 3hr rise -> rule in', /RULE-IN ZONE/.test(r), true);

  // boundaries preserved — inclusive at the cutoff, not exclusive
  await pg.click('input[name="pain"][value="no"]');
  r = await heart(T.ruleIn, T.ruleIn, '');
  ck(`t0 exactly at the rule-in cutoff (${T.ruleIn}) rules in (>=)`, /RULE-IN ZONE/.test(r), true);
  r = await heart(dIn0, dIn1, '');
  ck(`delta exactly ${T.deltaIn} rules in`, /RULE-IN ZONE/.test(r), true);
  r = await heart(dc0, dc1, '');
  ck('below rule-out with a small delta -> D/C home', /D\/C HOME/.test(r), true);
  r = await heart(gOut0, gOut0 + 2, '');
  ck('gray zone with delta under the cutoff -> ruled out', /AMI RULED OUT/.test(r), true);
}
ck('heart page errors', errs.length, 0);

/* ---- 2. codes card 12 ---- */
const p2 = await b.newPage({viewport:{width:390,height:1400}});
const e2=[]; p2.on('pageerror',e=>e2.push(String(e)));
await p2.goto(BASE + '/codes/?from=home', {waitUntil:'networkidle'});
const cue=()=>p2.evaluate(()=>({n:+document.getElementById('mtpprbc').textContent,
  d:getComputedStyle(document.getElementById('mtpcalcue')).display,
  s:(document.getElementById('mtpcalstatus')||{}).textContent||''}));
for(let i=0;i<4;i++){ await p2.click('#mtpprbc-add'); await p2.waitForTimeout(30); }
let c=await cue(); ck('cue shows at 4 units', c.d, 'block'); ck('cue says DUE NOW', /DUE NOW/.test(c.s), true);
await p2.reload({waitUntil:'networkidle'}); await p2.waitForTimeout(300);
c=await cue(); ck('cue SURVIVES reload at 4', c.d+'/'+c.n, 'block/4');
await p2.click('#mtpprbc-add'); await p2.waitForTimeout(50);
c=await cue(); ck('at 5 cue stays visible', c.d, 'block'); ck('at 5 shows NEXT AT 8', /NEXT AT 8/.test(c.s), true);
for(let i=0;i<3;i++){ await p2.click('#mtpprbc-add'); await p2.waitForTimeout(30); }
c=await cue(); ck('re-signals DUE NOW at 8', /DUE NOW/.test(c.s)&&/8 UNITS/.test(c.s), true);
await p2.click('#mtpprbc-sub'); await p2.waitForTimeout(60);
c=await cue(); ck('decrement works (8->7)', c.n, 7);
await p2.evaluate(()=>{for(let i=0;i<20;i++)document.getElementById('mtpprbc-sub').click();});
await p2.waitForTimeout(120); c=await cue();
ck('decrement floors at 0', c.n, 0); ck('cue hidden again at 0', c.d, 'none');
const link = await p2.getAttribute('a[href*="procedures/?from=home#c14"]','href');
ck('MTP resus-line link retargeted', link, '../procedures/?from=home#c14');
ck('codes page errors', e2.length, 0);

/* ---- 3. OB service worker ---- */
const p3 = await b.newPage();
await p3.goto(BASE + '/ob-neonatal/', {waitUntil:'networkidle'});
const sw = await p3.evaluate(async () => {
  const t = async a => { try { const c=await caches.open('t'+Math.random()); await c.addAll(a); return 'RESOLVED'; } catch(e){ return 'REJECTED'; } };
  return { icon:(await fetch('icon.svg')).status, addAll: await t(['./','index.html','manifest.webmanifest','icon.svg']) };
});
ck('icon.svg now served', sw.icon, 200);
ck('sw asset list caches cleanly', sw.addAll, 'RESOLVED');

/* ---- 4. search ---- */
const p4 = await b.newPage({viewport:{width:390,height:1400}});
await p4.goto(BASE + '/', {waitUntil:'networkidle'});
const q = await p4.$('input[type=search], #q, input[type=text]');
if(q){ await q.fill('rosc'); await p4.waitForTimeout(250);
  const txt=(await p4.textContent('body'))||'';
  ck('search "rosc" finds Post-ROSC', /Post-ROSC/i.test(txt), true); }
else ck('search input found', 'no', 'yes');

console.log('\n=== '+pass+' passed, '+fail+' failed ===');
await b.close();
process.exit(fail?1:0);
