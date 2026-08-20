import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8123/codes/?from=home#c22',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
const read = async () => p.evaluate(() => [...document.querySelectorAll('article#c22 input[data-k]')].map(i=>{
  const s=i.closest('label').querySelector('span');
  const why=s.querySelector('.t-why');
  const vis = why ? getComputedStyle(why).display : 'none';
  const action = s.querySelector('b') ? s.querySelector('b').textContent.trim() : s.textContent.trim();
  return {k:i.getAttribute('data-k'), action, whyShown:vis!=='none'};
}));
const before = await read();
console.log('WHY OFF — what a clinician sees:');
before.forEach(r=>console.log(`  [${String(r.action.length).padStart(3)}] ${r.action}`));
console.log('\nany why visible with toggle off?', before.some(r=>r.whyShown));
await p.click('#whybtn'); await p.waitForTimeout(300);
const after = await read();
console.log('after tapping WHY, reasoning visible?', after.every(r=>r.whyShown));
console.log('button now reads:', await p.textContent('#whybtn'));
const chars = await p.evaluate(() => {
  const t=[...document.querySelectorAll('article#c22 input[data-k]')].map(i=>i.closest('label').querySelector('span'));
  const vis=t.reduce((n,s)=>n+(s.querySelector('b')?s.querySelector('b').textContent.trim().length:s.textContent.trim().length),0);
  const all=t.reduce((n,s)=>n+s.textContent.trim().length,0);
  return {vis, all};
});
console.log(`\nvisible text: ${chars.vis} chars (was ${chars.all} with everything) — ${100-Math.round(100*chars.vis/chars.all)}% less on screen`);
console.log('errors:', errs.length?errs:'none');
await b.close();
