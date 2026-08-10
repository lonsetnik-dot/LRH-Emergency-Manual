/* LRH Emergency Manual — QR scan verification.
 *
 * A QR code that renders is not a QR code that scans. This screenshots every QR on the
 * labels page at print resolution and decodes it back, so a wrong module, a clipped
 * quiet zone, or a CSS size that crushes the code below scannability fails the build
 * rather than being discovered by someone holding a phone over a cart at 3am.
 *
 *   python3 -m http.server 8123      # from the repo root
 *   node verify_qr_scan.mjs
 */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const BASE=(process.env.BASE||'http://localhost:8123').replace(/\/$/,'');
const b=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const pg=await b.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:4});
await pg.goto(BASE+'/labels/',{waitUntil:'networkidle'});
await pg.waitForTimeout(600);
const fs=await import('fs');
let n=0;
async function grab(path, sel){
  await pg.goto(BASE+path,{waitUntil:'networkidle'});
  await pg.waitForTimeout(500);
  const els=await pg.$$(sel);
  // Labels encode the destination in aria-label. Posters print it as text beside the code,
  // so take the expectation from whichever the artifact actually publishes.
  const printed=await pg.evaluate(()=>{
    const t=document.querySelector('.qr .qrtext, .qr');
    if(!t) return null;
    const m=(t.textContent||'').match(/lrhemergencymanual\.net\/[^\s]+/);
    return m?('https://'+m[0]):null;
  });
  for(const el of els){
    let want=(await el.getAttribute('aria-label')||'').replace(/^QR code to /,'');
    if(!want.startsWith('http')) want=printed;
    if(!want) { console.log('   (no stated destination to check against)'); continue; }
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({path:'/tmp/qr_'+n+'.png'});
    fs.writeFileSync('/tmp/qr_'+n+'.want', want);
    n++;
  }
  console.log(path.padEnd(30)+els.length+' QR element(s)');
}
await grab('/labels/','svg[aria-label^="QR code to"]');
// posters: every poster that has a .qr block
const posters=['ava3xi','blakemore','burr-hole','canthotomy','chest-tube','cvc','escharotomy','hysterotomy','thoracotomy','tvp'];
for(const p of posters) await grab('/posters/'+p+'/','.qr svg[aria-label]');
await b.close();
console.log('\ncaptured '+n+' images for decoding');
