let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pg = await b.newPage({ viewport:{width:390,height:844} });
await pg.goto('http://localhost:8123' + process.argv[2] + '?from=home', { waitUntil:'networkidle' });
await pg.waitForTimeout(500);
const rows = await pg.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].map((i,idx)=>{
  const l=i.closest('label'); const s=l&&l.querySelector('span'); if(!s) return null;
  const c=s.cloneNode(true); [...c.querySelectorAll('.t-why')].forEach(n=>n.remove());
  const a=c.textContent.replace(/\s+/g,' ').trim();
  return {k:i.getAttribute('data-k')||('row'+idx), card:(i.closest('article')||{}).id||'', len:a.length, text:a, conv:!!s.querySelector('.t-why')};
}).filter(Boolean).filter(r=>r.len>110).sort((x,y)=>y.len-x.len));
console.log(rows.length + ' over-110');
const card = process.argv[3];
for (const r of rows.filter(r=>!card||r.card===card).slice(0, +(process.argv[4]||40))) console.log(JSON.stringify(r));
await b.close();
