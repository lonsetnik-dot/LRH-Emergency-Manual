/* LRH Emergency Manual — regression checks for the 2026-08-08 bug-fix round.
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
let r = await heart(20,25,'');   ck('t0=20 t1=25 no-3hr -> reflex', /REFLEX TO 3 HOURS/.test(r), true);
// In the reflex band a 3-hr value is legitimately consulted — that is not staleness.
r = await heart(20,25,20);       ck('reflex band DOES use a 3-hr value', /AMI RULED OUT/.test(r), true);
ck('  ...and does NOT warn (value is in play)', /not used/i.test(r), false);
// Outside the reflex band a leftover 3-hr must be ignored AND called out.
r = await heart(5,6,30);         ck('gray zone ignores stale t3',      /AMI RULED OUT/.test(r), true);
ck('  ...and warns it is unused',  /not used/i.test(r), true);
r = await heart(60,61,5);        ck('rule-in ignores stale t3',        /RULE-IN ZONE/.test(r), true);
ck('  ...and warns it is unused',  /not used/i.test(r), true);
r = await heart(3,3,30);         ck('D/C home ignores stale t3',       /D\/C HOME/.test(r), true);
await pg.click('input[name="pain"][value="yes"]');
r = await heart(3,17,'');        ck('pain>3h + rising 3->17 reflexes', /REFLEX TO 3 HOURS/.test(r), true);
r = await heart(3,3,'');         ck('pain>3h + flat low still D/C',   /D\/C HOME/.test(r), true);
// real reflex path still works
r = await heart(20,25,22);       ck('true reflex, 3hr flat -> ruled out', /AMI RULED OUT/.test(r), true);
r = await heart(20,25,45);       ck('true reflex, 3hr rise -> rule in',   /RULE-IN ZONE/.test(r), true);
// boundaries preserved
await pg.click('input[name="pain"][value="no"]');
r = await heart(50,50,'');       ck('t0=50 rules in (>=)', /RULE-IN ZONE/.test(r), true);
r = await heart(10,25,'');       ck('delta exactly 15 rules in', /RULE-IN ZONE/.test(r), true);
r = await heart(4,7,'');         ck('t0=4 <5 delta 3 -> D/C home', /D\/C HOME/.test(r), true);
r = await heart(6,8,'');         ck('gray zone 5-49 delta<4 -> ruled out', /AMI RULED OUT/.test(r), true);
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
