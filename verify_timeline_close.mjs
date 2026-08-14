/* LRH Emergency Manual — the case timeline can be got rid of (bug, 2026-08-13).
 *
 * Lon: "the copy to clipboard button does not clear the timeline - nor does tapping - there needs to
 * be a close function for closing the timeline and the copy to clipboard needs to close it as well."
 *
 * Three separate defects sat behind that one sentence:
 *
 *   1. Only the CLOSE button dismissed it. No backdrop tap, no Escape — even though the RESET modal
 *      in the same three files has always had the backdrop tap. The idiom existed; the timeline just
 *      never got it.
 *   2. COPY TO CLIPBOARD in codes/ and peds/ gave NO feedback whatsoever. Tap it and nothing visibly
 *      happens, which is why the button reads as broken rather than merely un-closing.
 *   3. Copying left the timeline open on top of the card being worked from. Copying the timeline is
 *      the last thing anyone does with it.
 *
 * ob-neonatal/ had a fourth: its copy handler called done() inside a try that ignored the result, so
 * a FAILED execCommand still displayed COPIED. This suite asserts the honest behavior instead — a
 * failed copy says so and leaves the panel open, because closing would tell a clinician the timeline
 * is safely on the clipboard when it is not.
 *
 * The three tools each keep their own copy of this modal by design ("share the contract, not the
 * code"), which is exactly why the behavior needs holding together from outside.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_timeline_close.mjs
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

/* Every tool carrying the timeline modal. A fourth tool adopting it adds one line here. */
const TOOLS = ['codes', 'peds', 'ob-neonatal'];

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));

const shown = () => pg.evaluate(() => {
  const m = document.getElementById('summarymodal');
  return !!m && getComputedStyle(m).display !== 'none';
});

/* Put something in the shared timeline so the panel has content — an empty
   timeline still opens, but a copy of nothing is a weaker test of the copy path. */
const seedLog = () => pg.evaluate(() => {
  const now = Date.now();
  localStorage.setItem('lrh-case-log', JSON.stringify([
    { tMs: now - 120000, tool: 'codes', label: 'Code started' },
    { tMs: now - 60000,  tool: 'codes', label: 'First epinephrine' },
  ]));
});

const open = async (tool) => {
  await pg.goto(`${BASE}/${tool}/?from=home`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(280);
  await seedLog();
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(320);
  await pg.click('#summarybtn');
  await pg.waitForTimeout(260);
};

for (const t of TOOLS) {
  console.log(`\n--- ${t} ---`);

  /* 1. It opens, and CLOSE is genuinely REACHABLE.

     The reachability check is the root cause of the reported bug and the reason
     this is a hit test rather than an isVisible() check. The timeline modal was
     z-index:20 while the sticky header is z-index:30, so the header painted over
     the panel's top bar and swallowed every tap on CLOSE. The button was present,
     visible, correctly wired — and impossible to press. isVisible() would have
     called that a pass. The RESET modal in these same three files has always
     used z-index:40; the timeline simply never got it. */
  await open(t);
  ck(`[${t}] the timeline opens`, await shown(), true);
  ck(`[${t}] it has a CLOSE control`, await pg.locator('#summaryclose').isVisible(), true);
  const reach = await pg.evaluate(() => {
    const c = document.getElementById('summaryclose'), r = c.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!hit && (hit === c || c.contains(hit)), blocker: hit ? (hit.id || hit.className || hit.tagName) : 'nothing' };
  });
  ck(`[${t}] nothing is painted on top of CLOSE`, reach.ok ? 'reachable' : 'blocked by ' + reach.blocker, 'reachable');
  /* Tolerant click: if CLOSE is blocked the assertion above already said so,
     and the remaining clauses still need to be checked rather than lost to a
     30-second timeout. */
  await pg.click('#summaryclose', { timeout: 4000 }).catch(() => {});
  await pg.waitForTimeout(220);
  ck(`[${t}] CLOSE closes it`, await shown(), false);
  await pg.evaluate(() => { const m = document.getElementById('summarymodal'); if (m) m.style.display = 'none'; });

  /* 2. Tapping the dimmed backdrop closes it — the RESET modal's existing idiom. */
  await open(t);
  await pg.evaluate(() => {
    /* Click the overlay itself, at a point outside the panel. Using the element
       directly rather than a coordinate so the test does not depend on layout. */
    document.getElementById('summarymodal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pg.waitForTimeout(220);
  ck(`[${t}] tapping the backdrop closes it`, await shown(), false);

  /* 3. ...but tapping INSIDE the panel does not. A timeline that vanishes when
     you touch the text you are reading is worse than one that will not close. */
  await open(t);
  await pg.click('#summarybody', { timeout: 4000 }).catch(() => {});
  await pg.waitForTimeout(200);
  ck(`[${t}] tapping the timeline text does NOT close it`, await shown(), true);

  /* 4. Escape. */
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(220);
  ck(`[${t}] Escape closes it`, await shown(), false);

  /* 5. The reported bug: COPY confirms, then closes. */
  await open(t);
  await pg.click('#summarycopy', { timeout: 4000 }).catch(() => {});
  await pg.waitForTimeout(150);
  ck(`[${t}] COPY confirms on screen`, /COPIED/i.test(await pg.locator('#summarycopy').innerText()), true);
  await pg.waitForTimeout(900);
  ck(`[${t}] COPY then closes the timeline`, await shown(), false);

  /* And it actually copied — a button that closes without copying is a worse
     bug than the one being fixed. */
  const clip = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ck(`[${t}] the clipboard really holds the timeline`, /First epinephrine/.test(clip), true);

  /* 6. The button label is restored, so the next open does not say COPIED. */
  await open(t);
  ck(`[${t}] the button label resets for the next case`,
     /COPY TO CLIPBOARD/i.test(await pg.locator('#summarycopy').innerText()), true);
  await pg.click('#summaryclose', { timeout: 4000 }).catch(() => {});
}

/* 7. A FAILED copy must not close, and must not claim success. Simulated by
   removing both copy paths out from under the handler. */
console.log('\n--- a failed copy is honest about it ---');
for (const t of TOOLS) {
  await open(t);
  await pg.evaluate(() => {
    try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) {}
    document.execCommand = () => false;
  });
  await pg.click('#summarycopy', { timeout: 4000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const label = await pg.locator('#summarycopy').innerText();
  ck(`[${t}] a failed copy does not say COPIED`, /COPIED/i.test(label), false);
  ck(`[${t}] a failed copy says it failed`, /FAILED/i.test(label), true);
  ck(`[${t}] and leaves the timeline OPEN`, await shown(), true);
}

ck('no page errors across the run', errs.length, 0);
if (errs.length) errs.slice(0, 6).forEach(e => console.log('    ' + e));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
await b.close();
process.exit(fail ? 1 : 0);
