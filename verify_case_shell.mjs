/* CairnReady / LRH Emergency Manual — the case shell's reveal behavior (case-shell.js).
 *
 * THE BUG THIS GUARDS: the next step was off the top of the screen. A clinician scrolls
 * down to read the ladder, taps the action it just told them to take, and the operating
 * card — now showing the NEXT step — is a thousand pixels above the viewport. Measured on
 * every engine before the fix: dystocia -883, neonatal -585, pph -902, arrest -1132,
 * airway -441. During a shoulder dystocia the head-to-body interval is the clock.
 *
 * The hard half is not scrolling; it is NOT scrolling. An unrequested jump mid-code takes
 * the text away from whoever is reading it. Three of the four checks here are about
 * staying still, and each of them caught a real defect during development:
 *
 *   - The engines re-render the whole card every second, so "the card mutated" fired on
 *     ANY tap — including opening a reference accordion at the bottom of the page.
 *   - Advancing a step shortens the document, which emits a `scroll` event with nobody
 *     having touched anything; treating that as "the user scrolled" cancelled the reveals
 *     this module exists to perform.
 *   - Concluding "already visible, nothing to do" without disarming let a later clock tick
 *     act on a stale gesture and scroll the page seconds after the tap.
 *
 * Engine-agnostic on purpose: the operating card is found by [data-opcard], so a new engine
 * is covered by adding that attribute and nothing else.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_case_shell.mjs
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

/* Every live-protocol engine. Derived here rather than hardcoded per test so a new engine
   that forgets data-opcard shows up as a failure rather than as silence. */
const ENGINES = ['/arrest/', '/airway/', '/tca/', '/neonatal/', '/pph/', '/dystocia/'];

const START_RE = /START|BEGIN|ANNOUNCE|NO PULSE|DECLARE|BABY OUT/i;
/* Default 844 is a tall phone; several checks below pass a SHORTER viewport deliberately,
   because the defect this suite exists to catch only appears when the operating region does
   not fit — which is every real phone with browser chrome. */
const open = async (path, viewport) => {
  const pg = await b.newPage({ viewport: viewport || { width: 390, height: 844 } });
  pg.on('pageerror', e => { console.log('   pageerror on ' + path + ': ' + e); fail++; });
  await pg.goto(BASE + path + '?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
  return pg;
};
const startCase = async (pg) => {
  await pg.evaluate(re => {
    const btn = [...document.querySelectorAll('button')]
      .find(x => x.offsetParent && new RegExp(re, 'i').test(x.textContent));
    if (btn) btn.click();
  }, START_RE.source);
  await pg.waitForTimeout(800);
};
/* The top of the operating REGION as the module itself resolves it — the topmost piece
   currently on screen, which is what a reveal anchors on. Asking the DOM for the first
   [data-opcard] instead would measure a bar that is display:none during this phase. */
const cardTop = (pg) => pg.evaluate(() => {
  const el = (typeof CASE_SHELL === 'object' && CASE_SHELL.card()) || document.querySelector('[data-opcard]');
  return el ? Math.round(el.getBoundingClientRect().top) : null;
});
const scrollY = (pg) => pg.evaluate(() => Math.round(window.scrollY));
const toBottom = async (pg) => { await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(300); };

console.log('--- 1. every engine marks its operating card ---');
for (const path of ENGINES) {
  const pg = await open(path);
  /* At least one, not exactly one. The operating card is a REGION: arrest/ marks the
     rhythm-unknown bar and the rhythm bar alongside its cycle card, because whichever of
     them is on screen carries the thing to do now, and anchoring on the cycle card alone
     scrolled arrest's "PADS ON — CHECK THE RHYTHM" button off the top of the screen at the
     start of every case. What must hold is that no engine has zero. */
  const n = await pg.evaluate(() => document.querySelectorAll('[data-opcard]').length);
  ck(`1. ${path} marks its operating card`, n >= 1, true);
  /* Asked as "how many did the module latch onto at boot", NOT "is one visible now" —
     before a case starts none of them are rendered, so the visible-now form of this
     question passes and fails for reasons that have nothing to do with wiring. */
  const wired = await pg.evaluate(() =>
    typeof CASE_SHELL === 'object' && typeof CASE_SHELL.bound === 'function' ? CASE_SHELL.bound() : 0);
  ck(`1. ${path} has the shared module bound to every one of them`, wired, n);
  await pg.close();
}

console.log('\n--- 2. acting on the protocol brings the next step into view ---');
/* The invariant is a pair, and BOTH halves matter:
     the step changed  -> the card is on screen, below the bar, in the readable half
     the step did not  -> nothing moved at all
   Written this way rather than as a per-engine script because "the first button in the
   card" does different things per tool — it advances in arrest and dystocia, and opens a
   picker in airway, neonatal and tca. Driving the picker too (one more tap) exercises the
   real path a clinician takes, and whichever outcome the engine produces, one of the two
   halves is asserted. An engine where neither holds is the regression this guards. */
for (const path of ENGINES) {
  const pg = await open(path);
  await startCase(pg);
  await toBottom(pg);
  const before = await cardTop(pg);
  const yBefore = await scrollY(pg);
  const sigBefore = await pg.evaluate(() => CASE_SHELL.signature());

  const tapped = await pg.evaluate(() => {
    /* Any control in the operating region, not only in its last box: arrest's action while
       the rhythm is unknown lives in the bar ABOVE the cycle card, and pph's blood-loss
       adder lives above its phase box. */
    const btn = CASE_SHELL.cards()
      .reduce((acc, c) => acc.concat([...c.querySelectorAll('button')]), [])
      .find(x => x.offsetParent);
    if (!btn) return false;
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    btn.click();
    return true;
  });
  if (!tapped) { console.log(`     ${path} has no in-card control — skipped`); await pg.close(); continue; }
  await pg.waitForTimeout(500);

  /* If that opened a picker, resolving it is the gesture that advances the protocol. */
  await pg.evaluate(() => {
    const region = CASE_SHELL.cards();
    const inSheet = [...document.querySelectorAll('button')].filter(el => {
      if (!el.offsetParent || region.some(c => c.contains(el))) return false;
      let n = el;
      while (n && n !== document.body) {
        let cs; try { cs = getComputedStyle(n); } catch (e) { return false; }
        if (cs.position === 'fixed' && (parseInt(cs.zIndex, 10) || 0) >= 50) return true;
        n = n.parentElement;
      }
      return false;
    });
    const opt = inSheet.find(el => !/CANCEL|CLOSE|BACK/i.test(el.textContent));
    if (opt) { opt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); opt.click(); }
  });
  await pg.waitForTimeout(1400);

  const sigAfter = await pg.evaluate(() => CASE_SHELL.signature());
  const after = await cardTop(pg);
  const bar = await pg.evaluate(() => CASE_SHELL.chromeHeight());
  ck(`2. ${path} started off-screen above`, before < 0, true);
  if (sigBefore !== sigAfter) {
    ck(`2. ${path} advanced — the next step is on screen`,
       after >= bar - 4 && after <= 844 * 0.5, true);
  } else {
    /* "Nothing moved" cannot be a raw scrollY comparison: advancing shortens or lengthens
       the page and the browser clamps scrollY on its own, with nobody having scrolled.
       The honest assertion is that the reader is still pinned to the bottom. */
    const end = await pg.evaluate(() => ({ y: Math.round(window.scrollY),
      max: Math.round(document.documentElement.scrollHeight - window.innerHeight) }));
    ck(`2. ${path} did not advance — the page was not scrolled`,
       end.y >= Math.min(yBefore, end.max) - 8, true);
  }
  await pg.close();
}

/* TWO SEPARATE PROPERTIES LIVE BELOW, and only one of them is a safety property.
     · reveal() refusing to scroll a visible control off the top is the SAFETY property.
       Delete it and this block goes red (verified by mutation on airway/ and tca/).
     · marking each phase bar with data-opcard is a QUALITY property: it puts the anchor and
       the step signature on the right element, so a bar appearing or disappearing reads as
       a step change. Un-marking arrest's PADS ON bar does NOT turn this block red, because
       the safety property already prevents the harm. That is the correct relationship and
       it is stated here rather than papered over with a check written to fail. */
console.log('\n--- 2b. STARTING A CASE NEVER HIDES THE FIRST ACTION ---');
/* The regression that made this check exist, reported from the bedside: on arrest/, tapping
   START scrolled the amber "PADS ON — CHECK THE RHYTHM" button clean off the top of the
   screen. The module had done exactly what it was told — reveal the cycle card — and the
   cycle card is not the whole operating card at that moment. The bar above it is.

   Invisible at a desktop height, which is why it shipped: at 390x844 the region fits and
   nothing scrolls. It only appears on a phone. So this runs SHORT, and it asserts the thing
   the clinician cares about rather than a scroll offset — after starting a case from the top
   of the page, the first control you are asked to touch is on screen and reachable. */
for (const path of ENGINES) {
  const pg = await open(path, { width: 390, height: 640 });
  await startCase(pg);
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(() => {
    const bar = CASE_SHELL.chromeHeight();
    /* Deliberately asked of the WHOLE PAGE, not of CASE_SHELL.cards(). Scoping this to the
       operating region made the check unfalsifiable: removing the PADS ON bar from the
       region also removed it from the check, so the original defect passed. Whether an
       element is wired as part of the region is the thing under test — it cannot also be
       the filter. The page starts at scrollY 0, so nothing can sit above the bar unless
       starting the case scrolled it there. */
    const inChrome = el => { for (var n = el; n && n !== document.body; n = n.parentElement) {
      var cs; try { cs = getComputedStyle(n); } catch (e) { return false; }
      if (cs.position === 'fixed' || cs.position === 'sticky') return true;
    } return false; };
    const above = [...document.querySelectorAll('button')]
      .filter(x => x.offsetParent && x.getBoundingClientRect().height > 0 && !inChrome(x))
      .filter(x => x.getBoundingClientRect().bottom <= bar)
      .map(x => (x.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34));
    const btn = CASE_SHELL.cards()
      .reduce((acc, c) => acc.concat([...c.querySelectorAll('button')]), [])
      .filter(x => x.offsetParent)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!btn) return { none: true, above: above };
    const b = btn.getBoundingClientRect();
    const live = CASE_SHELL.cards().map(c => c.getBoundingClientRect());
    const rTop = Math.min.apply(null, live.map(x => x.top));
    const rBottom = Math.max.apply(null, live.map(x => x.bottom));
    return { above: above, bar: Math.round(bar), top: Math.round(b.top), bottom: Math.round(b.bottom),
             vh: window.innerHeight, label: (btn.textContent || '').trim().slice(0, 34),
             regionTop: Math.round(rTop), regionH: Math.round(rBottom - rTop),
             fits: (rBottom - rTop) <= window.innerHeight - bar };
  });
  ck(`2b. ${path} starting a case scrolled no control off the top`,
     (r.above || []).join(' | ') || 'none', 'none');
  if (r.none) { console.log(`     ${path} has no control in the region at start — skipped`); await pg.close(); continue; }
  /* ABOVE the bar is the defect: content scrolled off the top cannot be reached by scrolling
     down, and nothing on screen suggests it is up there. */
  ck(`2b. ${path} first action is not hidden above/behind the bar ("${r.label}")`,
     r.top >= r.bar, true);
  /* Deliberately NOT "the action is on screen", and NOT "the region begins on screen".
     Both were tried and both are the assumption that produced the bug in the first place —
     that scrolling down to the operating card is always worth what it pushes off the top.
     Neither generalizes: neonatal opens with an 854px region on a 640px screen (warm, dry,
     stimulate, position, THEN confirm), and tca's workstreams start at y=845 because you
     pick the reversible causes above them first. Both are correct, and a suite that called
     them failures would teach this repo that a red run here is normal.

     What IS universal is direction: nothing the clinician needs may end up above the bar,
     where scrolling the way the page invites you to will never find it. */
  ck(`2b. ${path} the operating region does not start above the bar`, r.regionTop >= r.bar, true);
  console.log(`     ${path} region ${r.regionH}px, starts at y=${r.regionTop} on a ${r.vh}px screen`);
  await pg.close();
}

console.log('\n--- 3. NOTHING ELSE MOVES THE PAGE ---');
{
  const pg = await open('/dystocia/');
  await startCase(pg);

  /* 3a. The clock alone must never scroll. The card re-renders every second. */
  await pg.evaluate(() => window.scrollTo(0, 600));
  await pg.waitForTimeout(200);
  const a1 = await scrollY(pg);
  await pg.waitForTimeout(3500);
  ck('3a. a ticking clock never scrolls the page', await scrollY(pg), a1);

  /* 3b. A tap that is not a protocol action must not move anything, even though it lands
         inside the gesture window and the card re-renders under it. */
  await toBottom(pg);
  const b1 = await scrollY(pg);
  await pg.evaluate(() => {
    const d = [...document.querySelectorAll('summary,.acch,button')]
      .filter(x => x.offsetParent && /SCOPE|LADDER|NEVER|SOURCE/i.test(x.textContent))[0];
    if (d) { d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); d.click(); }
  });
  await pg.waitForTimeout(1000);
  ck('3b. opening a reference section does not jump to the top',
     Math.abs((await scrollY(pg)) - b1) < 40, true);

  /* 3c. If the next step is already readable, nothing moves at all. */
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    const btn = document.querySelector('[data-opcard] button');
    if (btn) { btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); btn.click(); }
  });
  await pg.waitForTimeout(1000);
  ck('3c. no scroll when the step is already on screen', Math.abs(await scrollY(pg)) < 10, true);
  await pg.close();
}

console.log('\n--- 4. a deliberate scroll wins ---');
{
  const pg = await open('/dystocia/');
  await startCase(pg);
  await toBottom(pg);
  await pg.evaluate(() => {
    const btn = document.querySelector('[data-opcard] button');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    btn.click();
    /* the clinician keeps reading — a real thumb, before the reveal lands */
    window.dispatchEvent(new Event('touchmove'));
  });
  const y0 = await scrollY(pg);
  await pg.waitForTimeout(1300);
  ck('4. a thumb-scroll after acting cancels the reveal',
     Math.abs((await scrollY(pg)) - y0) < 40, true);
  await pg.close();
}

console.log('\n--- 5. reduced motion is honored (ACCESSIBILITY.md) ---');
{
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await pg.goto(BASE + '/dystocia/?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
  await startCase(pg);
  await toBottom(pg);
  await pg.evaluate(() => {
    const btn = document.querySelector('[data-opcard] button');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    btn.click();
  });
  /* Deliberately shorter than a smooth animation: with reduced motion the card must
     already be in place, not sliding. */
  await pg.waitForTimeout(330);
  const t = await cardTop(pg);
  ck('5. with reduced motion the step arrives instantly, not animated', t > 40 && t < 300, true);
  await pg.close();
}

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
