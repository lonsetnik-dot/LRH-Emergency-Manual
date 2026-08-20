/* CairnReady / LRH Emergency Manual — checklist rows must be readable in a crisis.
 *
 * "People cannot read in a crisis." A checklist row is glanced at, mid-task, by someone
 * whose hands are busy — so the row has to say what to DO in one line, and keep the reason
 * WHY out of the way until it is asked for.
 *
 * Before this pass the rows carried both in one paragraph: 1308 rows, median 133 characters,
 * 596 of them over 200. The thing to do was buried in the thing to know.
 *
 * THE INVARIANT, and it is a pair — simple, but not too simple:
 *
 *   1. The ACTION (what stays on screen) is short enough to take in at a glance.
 *   2. The ACTION STANDS ALONE. If a step cannot be performed without a number, that
 *      number is in the action, never only behind the WHY. Hiding a dose is not
 *      simplification, it is a trap — this suite counts a row that hides a dose-shaped
 *      value from its own action as a failure, whatever its length.
 *
 * Nothing is deleted by the pass: .t-why holds everything demoted, one toggle reveals all
 * of it, and print always includes it because a printed card is read at a desk.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_checklist_clarity.mjs
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

/* What a clinician can take in without reading. Chosen from the converted cards: their
   actions run 21–79 characters, and a line beyond this wraps to three on a phone. */
const ACTION_MAX = 110;

/* A RATCHET, not a target. Converting 1330 rows is a long editorial pass, and a suite that
   fails for the whole of it would teach everyone that a red run here is normal — which is
   how a safety harness stops working (CLAUDE.md, "a red run means something"). So the
   budget is the count of over-long rows on the day it was measured: the suite fails if any
   tool gets WORSE, and the number is lowered as cards are converted. It reaches 0 when the
   pass is finished, and from then on it is an ordinary assertion.
   Lower these. Never raise one.

   /codes/ is finished, and its floor is 5 rather than 0 — worth saying why, because the next
   editor will otherwise spend a pass trying to reach 0 and reword something they should not:
     · three rows are KIT CONTENTS (c23), which CLAUDE.md requires to stay byte-identical
       across the card, the poster, the cart label and inventory.js. They are a packing list,
       not prose, and verify_kit_consistency.mjs fails if anyone shortens them.
     · two rows (c06) are RSI dose tables — three live weight-computed doses on one line.
       Splitting them into one drug per row is a different, clinical decision about the card.
   Those five are structural. Everything else in /codes/ now reads in one glance. */
const BUDGET = {
  '/codes/': 5, '/procedures/': 196, '/trauma/': 1, '/peds/': 0, '/ob-neonatal/': 2,
};

const TOOLS = Object.keys(BUDGET);

const harvest = (pg) => pg.evaluate(() => {
  /* A value someone has to act on. Kept in step with tools_clarify.mjs deliberately —
     the script that writes these rows and the suite that judges them must agree on what
     counts as a dose. */
  const DOSE = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|mL|ml|L|units?|mmHg|°C|kg|Fr|J|%|\/min|\/hr|mEq|mmol|breaths|beats|hours?|hrs?|h|min|minutes?|sec)/gi;
  /* "72 h" and "72 hours" are the same value; so are mL and ml. Without this the guard
     reports traps that are not traps, and a suite that cries wolf gets switched off. */
  const UNIT = [[/hours?|hrs?|h$/, 'h'], [/minutes?|min/, 'min'], [/ml/, 'ml'], [/units?/, 'u'], [/seconds?|sec/, 's']];
  const norm = s => (s.match(DOSE) || []).map(x => {
    let v = x.toLowerCase().replace(/\s+/g, '').replace(',', '.');
    for (const [re, to] of UNIT) { const m = v.match(/^([\d.]+)(.*)$/); if (m && re.test(m[2])) { v = m[1] + to; break; } }
    return v;
  });
  return [...document.querySelectorAll('input[type=checkbox]')].map((i, idx) => {
    const label = i.closest('label');
    const span = label && label.querySelector('span');
    if (!span) return null;
    const why = span.querySelector('.t-why');
    /* data-ref marks a why whose numbers are REFERENCE — a superseded trial range, an
       alternative target, a source that disagrees — not a value the step needs. Set
       deliberately, per row, by whoever wrote the row; it is the one way to hide a number
       and it has to be a decision someone made, not a default. */
    const refOnly = why ? why.hasAttribute('data-ref') : false;
    const whyText = (why && !refOnly) ? why.textContent.trim() : '';
    const clone = span.cloneNode(true);
    [...clone.querySelectorAll('.t-why')].forEach(n => n.remove());
    /* A button's label is a control, not a line of the step. Several rows carry tap-to-log
       buttons ("BLOOD STARTED — LOG IT"), and counting their captions as prose made a
       three-word action measure 40 characters longer than what anyone reads — which would
       have pushed an editor to shorten the clinical text to pay for a button. What is being
       measured here is the sentence the clinician reads, so the controls come out. */
    [...clone.querySelectorAll('button')].forEach(n => n.remove());
    const action = clone.textContent.replace(/\s+/g, ' ').trim();
    const inAction = new Set(norm(action));
    return {
      k: i.getAttribute('data-k') || ('row' + idx),
      card: (i.closest('article') || {}).id || '',
      action, len: action.length, hasWhy: !!why,
      hidden: norm(whyText).filter(d => !inAction.has(d)),
    };
  }).filter(Boolean);
});

let allRows = [];
for (const tool of TOOLS) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(BASE + tool + '?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  const rows = await harvest(pg);
  ck(`0. ${tool} loads clean`, errs.length, 0);
  ck(`0. ${tool} has checklist rows`, rows.length > 0, true);

  /* 1. Readable at a glance — against the ratchet, so progress is enforced and regression
        is impossible, without a permanently red run in between. */
  const longRows = rows.filter(r => r.len > ACTION_MAX).sort((a, c) => c.len - a.len);
  const budget = BUDGET[tool];
  ck(`1. ${tool} over-long actions within budget (${longRows.length}/${budget})`,
     longRows.length <= budget, true);
  if (longRows.length) {
    console.log(`     ${longRows.length} of ${rows.length} still over ${ACTION_MAX} chars` +
                (longRows.length < budget ? ` — budget is ${budget}, LOWER IT` : '') +
                `; worst ${longRows[0].len} (${longRows[0].card || '?'} ${longRows[0].k})`);
  }

  /* 2. Nothing needed to act is hidden. This is the one that must never be traded away
        for brevity — a short row that hides its dose is worse than the long row was. */
  const trap = rows.filter(r => r.hidden.length);
  ck(`2. ${tool} no action hides a value it needs`,
     trap.length ? trap.slice(0, 4).map(r => `${r.k}:${r.hidden.join('/')}`).join(' ') : 'none', 'none');

  /* 2b. STRUCTURAL INTEGRITY. A rewrite that replaces the row's text has to replace all of
        it: several rows nest a <span class="wdose"> computing a dose from the case weight,
        and a matcher that stopped at the first </span> replaced only the front, leaving the
        tail as an orphaned direct child of the <label>. It rendered as a stray 230px grid
        row and reached the accessibility suite as a target-size failure — a structural
        corruption reported as a styling nit. A row is an input and a span; nothing else. */
  /* Counting the label's children is too blunt — procedures/ rows legitimately carry a
     <span class="role"> badge (MD / RN / BOTH) beside the text. The corruption signature is
     narrower and exact: a LIVE element that has escaped the text span and become a direct
     child of the label. That is what a truncated replacement leaves behind, and nothing
     legitimate produces it. */
  const orphans = await pg.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')]
    .map(i => { const l = i.closest('label'); if (!l) return null;
      const loose = [...l.children].some(c =>
        c.classList.contains('wdose') || c.tagName === 'A' || c.tagName === 'BUTTON' ||
        c.classList.contains('t-why'));
      return loose ? (i.getAttribute('data-k') || '?') : null; })
    .filter(Boolean));
  ck(`2b. ${tool} no live markup escaped its row span`, orphans.slice(0, 4).join(',') || 'none', 'none');

  /* 2c. And the live, weight-computed doses still compute. Losing one is invisible: the row
        keeps showing the placeholder it happened to be displaying, forever. */
  const deadDoses = await pg.evaluate(() => [...document.querySelectorAll('.wdose')]
    .filter(e => !e.getAttribute('data-perkg')).length);
  ck(`2c. ${tool} every live dose still carries its per-kg rule`, deadDoses, 0);

  /* 3. The reasoning is out of the way until asked for. */
  const whyVisible = await pg.evaluate(() =>
    [...document.querySelectorAll('.t-why')].filter(el => getComputedStyle(el).display !== 'none').length);
  ck(`3. ${tool} reasoning is hidden by default`, whyVisible, 0);

  const hasBtn = await pg.locator('#whybtn').count();
  ck(`3. ${tool} offers the WHY control`, hasBtn, 1);
  if (hasBtn && rows.some(r => r.hasWhy)) {
    await pg.click('#whybtn');
    await pg.waitForTimeout(250);
    const shown = await pg.evaluate(() =>
      [...document.querySelectorAll('.t-why')].filter(el => getComputedStyle(el).display !== 'none').length);
    ck(`3. ${tool} WHY reveals every reason at once`, shown > 0 && shown === await pg.evaluate(() => document.querySelectorAll('.t-why').length), true);
    /* It is a preference, not case state: it must survive a reload. */
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForTimeout(300);
    ck(`3. ${tool} the choice is remembered`,
       await pg.evaluate(() => document.body.classList.contains('showwhy')), true);
    await pg.click('#whybtn');
    await pg.waitForTimeout(200);
  }
  allRows = allRows.concat(rows.map(r => ({ ...r, tool })));
  await pg.close();
}

/* 4. Print carries everything — a printed card is a reference read at a desk, not a screen
      read during a code, so nothing should be missing from it. */
{
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
  await pg.emulateMedia({ media: 'print' });
  await pg.waitForTimeout(200);
  const hiddenInPrint = await pg.evaluate(() =>
    [...document.querySelectorAll('.t-why')].filter(el => getComputedStyle(el).display === 'none').length);
  ck('4. print shows the reasoning even with WHY off', hiddenInPrint, 0);
  await pg.close();
}

const converted = allRows.filter(r => r.hasWhy).length;
const median = (() => { const s = allRows.map(r => r.len).sort((a, c) => a - c); return s[Math.floor(s.length / 2)]; })();
console.log(`\n${allRows.length} rows across ${TOOLS.length} tools · ${converted} carry a WHY tier · median action ${median} chars`);

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
