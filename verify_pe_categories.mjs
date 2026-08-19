/* LRH Emergency Manual — the PE Clinical Categories pathway (/clinical-pathways/pe/).
 *
 * The tool assigns an AHA/ACC Acute PE Clinical Category (A–E, subcategories, and the
 * respiratory modifier R) from what the clinician can see at the bedside, and prints
 * the guideline's management and advanced-therapy row for that category.
 *
 * CONFIG-DRIVEN (issue #117): every printed number is read from the page's own
 * window.SITE and asserted against THAT — so an ED whose lab reports a different
 * lactate threshold, or that genuinely does have catheter-directed lysis on site,
 * stays green after localizing. Section 5 proves this rather than asserting it: it
 * rewrites the built page's SITE block with a plausible fork's values, reloads, and
 * re-runs the config-derived checks against the fork.
 *
 * WHAT STAYS HARDCODED, deliberately — the clinical structure a fork must not be
 * able to localize away:
 *   - the ramp runs A → B → C → D → E, and hemodynamics OUTRANK the severity score
 *   - Category C splits on RV *and* biomarker: C1 neither, C2 either, C3 both
 *   - the R modifier's bar RISES with the tier, and A and B never carry one
 *   - Table 7: systemic lysis is 3-Harm through C2 and never becomes a recommendation
 *     below C3; E1 is 2a across all four modalities
 *   - Category E is stabilized before transfer, never during it
 *   - the scope disclaimer, the citation, and the PHI guard
 *
 * Section 6 is the other half of the bargain: it mutates the page's LOGIC with the
 * config left alone and asserts this suite goes RED. A suite that cannot fail is not
 * protecting anybody.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_pe_categories.mjs
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
  catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
}

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const TOOL = '/clinical-pathways/pe/';
const SRC  = 'dist/clinical-pathways/pe/index.html';
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };
const has = (name, hay, needle) => ck(name, String(hay).includes(needle) ? 'present' : 'MISSING:' + needle, 'present');

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const txt  = async sel => norm(await pg.locator(sel).innerText());

/* Tap one option in a radio/checkbox group by its value. */
async function pick(group, value) {
  await pg.locator(`.opts[data-group="${group}"] input[value="${value}"]`).check();
  await pg.waitForTimeout(60);
}
async function reset() {
  await pg.locator('button.btn', { hasText: 'Reset' }).first().click();
  await pg.waitForTimeout(80);
}
const code    = () => txt('#finalBox .catcode').catch(() => '(none)');
const final   = () => txt('#finalBox');
const advRow  = async () => ({
  lysis: await txt('#advLysis'), cdl: await txt('#advCdl'),
  mt: await txt('#advMt'), surg: await txt('#advSurg')
});

/* Drive the form to a given category. `sev` is set by tapping the severity row
   directly rather than by ticking sPESI boxes, so a case stays on the intended side
   of a localized sPESI threshold. */
async function scenario({ hemo, dx = 'symptomatic', loc, sev, rv, bio, resp, confirmed }) {
  await reset();
  await pick('hemo', hemo);
  await pick('dx', dx);
  if (loc) await pick('loc', loc);
  if (sev) await pick('sev', sev);
  if (rv) await pick('rv', rv);
  if (bio) await pick('bio', bio);
  if (resp !== undefined) await pick('resp', String(resp));
  if (confirmed) await pick('confirmed', confirmed);
  await pg.waitForTimeout(60);
}

async function load(url) {
  await pg.goto(url, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(250);
  return pg.evaluate(() => window.SITE);
}

let SITE = await load(BASE + TOOL + '?from=home');
ck('0. the tool exposes its config for the champion and for this suite', !!SITE && !!SITE.shock, true);

/* ==========================================================================
   1. CONFIG-DRIVEN — every number on screen comes from the page's own SITE
   ========================================================================== */
console.log('\n--- 1. the screen prints the config, not re-typed numbers ---');
{
  const S = SITE.shock, P = SITE.spesi, C = SITE.score, R = SITE.resp;
  const body = norm(await pg.locator('.wrap').innerText());

  has('1. transient hypotension shows the configured SBP floor', body, `${S.sbpUnder} mm Hg`);
  has('1. transient hypotension shows the configured SBP drop', body, `${S.sbpDropOver} mm Hg`);
  has('1. transient hypotension shows the configured duration', body, `${S.transientUnderMin} min`);
  has('1. normotensive shock shows the configured lactate', body, `${S.lactateOver} mmol/L`);
  has('1. normotensive shock shows the configured urine output', body, `${S.uopUnderMlKgHr} mL/kg/h`);
  has('1. normotensive shock shows the configured cardiac index', body, `${S.cardiacIndexUnder} L/min/m`);
  has('1. refractory shows the configured no-ROSC interval', body, `${S.arrestNoRoscMin} min`);

  has('1. sPESI age component reads from config', body, `Age > ${P.ageOver} y`);
  has('1. sPESI SBP component reads from config', body, `Systolic BP < ${P.sbpUnder} mm Hg`);
  has('1. sPESI HR component reads from config', body, `Heart rate ≥ ${P.hrAtLeast} bpm`);
  has('1. sPESI SpO2 component reads from config', body, `saturation < ${P.spo2Under}%`);

  has('1. low severity band reads from config', body, `PESI ≤ ${C.pesiLow}`);
  has('1. elevated severity band reads from config', body, `PESI > ${C.pesiLow}`);
  has('1. Bova band reads from config', body, `Bova ≤ ${C.bovaLow}`);

  has('1. respiratory level 1 reads from config', body, `SpO₂ < ${R.spo2Under}%`);
  has('1. respiratory level 1 reads the configured RR', body, `RR ≥ ${R.rrAtLeast}`);
  has('1. respiratory level 2 reads the configured flow', body, `> ${R.ncOverLpm} L nasal cannula`);

  const stamp = await txt('#verStamp');
  has('1. version stamp reads from config', stamp, 'v' + SITE.version);
  has('1. last-reviewed stamp reads from config', stamp, SITE.lastReviewed);
  has('1. the stamp names the guideline edition the content is written against', stamp, SITE.guidelineEdition);
}

/* ==========================================================================
   2. CLINICAL INVARIANTS — the structure a fork must not be able to move
   ========================================================================== */
console.log('\n--- 2a. the ramp exists and runs A → E ---');
{
  await scenario({ hemo: 'none', dx: 'incidental' });
  ck('2a. incidental + asymptomatic + stable = A', await code(), 'A');

  await scenario({ hemo: 'none', sev: 'low', loc: 'subseg' });
  ck('2a. symptomatic, low score, subsegmental = B1', await code(), 'B1');

  await scenario({ hemo: 'none', sev: 'low', loc: 'nonsubseg' });
  ck('2a. symptomatic, low score, non-subsegmental = B2', await code(), 'B2');

  await scenario({ hemo: 'transient' });
  ck('2a. transient hypotension = D1', await code(), 'D1');

  await scenario({ hemo: 'normoshock' });
  ck('2a. normotensive shock = D2', await code(), 'D2');

  await scenario({ hemo: 'shock' });
  ck('2a. persistent hypotension with cardiogenic shock = E1', await code(), 'E1');

  await scenario({ hemo: 'refractory' });
  ck('2a. refractory shock or arrest = E2', await code(), 'E2');
}

console.log('\n--- 2b. hemodynamics OUTRANK the severity score ---');
{
  /* The whole point of the scheme: a reassuring score cannot hold a shocked patient
     in Category B. Set the most benign non-hemodynamic answers possible, then break
     the blood pressure. */
  await scenario({ hemo: 'none', sev: 'low', loc: 'subseg' });
  ck('2b. baseline is the most benign symptomatic case', await code(), 'B1');
  await pick('hemo', 'shock');
  ck('2b. adding shock to a low-score subsegmental PE lands on E1, not B1', await code(), 'E1');
  await pick('hemo', 'normoshock');
  ck('2b. normotensive shock still outranks the low score', await code(), 'D2');
  await pick('hemo', 'none');
  ck('2b. and clearing it returns to B1', await code(), 'B1');
}

console.log('\n--- 2c. Category C splits on RV *and* biomarker ---');
{
  const cases = [
    ['normal',   'normal',   'C1'],
    ['abnormal', 'normal',   'C2'],
    ['normal',   'abnormal', 'C2'],
    ['abnormal', 'abnormal', 'C3'],
  ];
  for (const [rv, bio, want] of cases) {
    await scenario({ hemo: 'none', sev: 'high', rv, bio });
    ck(`2c. RV ${rv} + biomarkers ${bio} = ${want}`, await code(), want);
  }
  /* One abnormal, the other outstanding: C2 is the floor, and the page must say so
     rather than silently picking a side. C1 and C3 sit at opposite ends of Table 7. */
  await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'unknown' });
  ck('2c. abnormal RV with biomarkers outstanding is provisional, not decided', await code(), 'C2?');
  has('2c. and it names what is outstanding', await final(), 'cardiac biomarkers');
  has('2c. and it names the upgrade if that comes back abnormal', await final(), 'C3');
  has('2c. the advanced-therapy row is flagged as the provisional one', await txt('#advNote'), 'Provisional');

  await scenario({ hemo: 'none', sev: 'high', rv: 'unknown', bio: 'unknown' });
  ck('2c. neither assessed = no subcategory at all', await code(), 'C');
  has('2c. and the workup that would resolve it is still given', await final(), 'cardiac biomarker');
}

console.log('\n--- 2d. the respiratory modifier bar RISES with the tier ---');
{
  /* Level 1 respiratory support earns an R in Category C and nowhere above it;
     level 3 earns one everywhere. This is the invariant — the numeric thresholds
     behind each level are config (section 1), the ordering is not. */
  const want = {
    //           resp 0    1     2     3
    C3: [false, true,  true,  true],
    D2: [false, false, true,  true],
    E1: [false, false, false, true],
  };
  for (const [target, expect] of Object.entries(want)) {
    for (let r = 0; r <= 3; r++) {
      if (target === 'C3') await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal', resp: r });
      if (target === 'D2') await scenario({ hemo: 'normoshock', resp: r });
      if (target === 'E1') await scenario({ hemo: 'shock', resp: r });
      ck(`2d. ${target} + respiratory level ${r}`, await code(), target + (expect[r] ? 'R' : ''));
    }
  }
  for (const [hemo, dx, extra, target] of [
    ['none', 'incidental', {}, 'A'],
    ['none', 'symptomatic', { sev: 'low', loc: 'nonsubseg' }, 'B2'],
  ]) {
    await scenario({ hemo, dx, ...extra, resp: 3 });
    ck(`2d. ${target} never carries an R, even in respiratory failure`, await code(), target);
  }
}

console.log('\n--- 2e. Table 7 — advanced therapy by category ---');
{
  const T7 = {
    A:  { lysis: '3: Harm', cdl: '3: No Benefit', mt: '3: No Benefit', surg: '3: No Benefit' },
    B2: { lysis: '3: Harm', cdl: '3: No Benefit', mt: '3: No Benefit', surg: '3: No Benefit' },
    C1: { lysis: '3: Harm', cdl: '3: No Benefit', mt: '3: No Benefit', surg: '3: No Benefit' },
    C2: { lysis: '3: Harm', cdl: '2b (unclear)', mt: '2b (unclear)', surg: '3: No Benefit' },
    C3: { lysis: '2b (unclear)', cdl: '2b (unclear)', mt: '2b (unclear)', surg: '3: No Benefit' },
    D1: { lysis: '2b (may be considered)', cdl: '2b (may be considered)', mt: '2b (may be considered)', surg: '2b (unclear)' },
    D2: { lysis: '2b (may be considered)', cdl: '2b (may be considered)', mt: '2b (may be considered)', surg: '2b (unclear)' },
    E1: { lysis: '2a', cdl: '2a', mt: '2a', surg: '2a' },
    E2: { lysis: '2a', cdl: 'N/A', mt: 'N/A', surg: '3: No Benefit' },
  };
  const drive = {
    A:  { hemo: 'none', dx: 'incidental' },
    B2: { hemo: 'none', sev: 'low', loc: 'nonsubseg' },
    C1: { hemo: 'none', sev: 'high', rv: 'normal', bio: 'normal' },
    C2: { hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'normal' },
    C3: { hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal' },
    D1: { hemo: 'transient' }, D2: { hemo: 'normoshock' },
    E1: { hemo: 'shock' },     E2: { hemo: 'refractory' },
  };
  for (const [cat, row] of Object.entries(T7)) {
    await scenario(drive[cat]);
    const got = await advRow();
    ck(`2e. ${cat} advanced-therapy row`,
      [got.lysis, got.cdl, got.mt, got.surg].join(' | '),
      [row.lysis, row.cdl, row.mt, row.surg].join(' | '));
  }
  /* The direction that matters most: systemic lysis must never read as anything
     other than harm anywhere at or below C2. This is the recommendation the card in
     codes/ can talk a tired clinician into, and the one the guideline reversed. */
  for (const cat of ['A', 'B2', 'C1', 'C2']) {
    await scenario(drive[cat]);
    ck(`2e. systemic lysis at ${cat} is harm, not an option`, (await advRow()).lysis, '3: Harm');
  }
}

console.log('\n--- 2f. disposition and the transfer rule ---');
{
  await scenario({ hemo: 'none', dx: 'incidental' });
  has('2f. A is discharged from the ED', await final(), 'discharged home from the ED');

  await scenario({ hemo: 'none', sev: 'low', loc: 'nonsubseg' });
  has('2f. B gets the outpatient decision tool', await final(), 'suitability for outpatient treatment');
  has('2f. B outpatient is conditioned on access to the drug', await final(), 'immediate access to the anticoagulant');
  has('2f. B outpatient is conditioned on real follow-up', await final(), 'rapid, reliable, expert follow-up');

  await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal' });
  has('2f. C3 may be transferred for advanced therapy', await final(), 'may be considered');
  has('2f. C3 hospitalizes', await final(), 'Hospitalize');

  await scenario({ hemo: 'transient' });
  has('2f. D may be transferred for advanced therapy', await final(), 'Transfer to a center');

  for (const hemo of ['shock', 'refractory']) {
    await scenario({ hemo });
    has(`2f. Category E (${hemo}) is stabilized BEFORE transfer`, await final(), 'Do not transfer before stabilizing');
  }
}

console.log('\n--- 2g. anticoagulation, sedation and the pre-imaging rule ---');
{
  await scenario({ hemo: 'none', dx: 'incidental' });
  has('2g. A and B get an oral anticoagulant', await final(), SITE.anticoag.oral);

  for (const [name, s] of Object.entries({
    C1: { hemo: 'none', sev: 'high', rv: 'normal', bio: 'normal' },
    D2: { hemo: 'normoshock' },
    E1: { hemo: 'shock' },
  })) {
    await scenario(s);
    has(`2g. ${name} gets LMWH over UFH`, await final(), 'recommended over UFH');
  }
  await scenario({ hemo: 'refractory' });
  has('2g. E2 is the one category that may take UFH', await final(), SITE.anticoag.parenteralRefractory);

  await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal' });
  has('2g. C–E carry the sedation warning', await final(), 'Avoid deep sedation');
  has('2g. C–E send lysed patients to a monitored bed', await final(), 'ICU or intermediate-care bed');

  await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal', confirmed: 'no' });
  has('2g. suspected PE at C2+ is anticoagulated before the scan', await final(), 'before the scan');
  await pick('confirmed', 'yes');
  ck('2g. and that line is gone once the PE is confirmed',
    (await final()).includes('before the scan') ? 'still shown' : 'gone', 'gone');
}

console.log('\n--- 2h. scope, citation and the PHI guard ---');
{
  await pg.goto(BASE + TOOL + '?from=home', { waitUntil: 'networkidle' });
  const body = norm(await pg.locator('.wrap').innerText());
  has('2h. scope is stated: adults, diagnosed or suspected PE', body, 'adult');
  has('2h. it says outright that it is not a diagnostic rule-out', body, 'not a diagnostic rule-out');
  has('2h. it says the category is a snapshot that changes', body, 'snapshot');
  has('2h. the standard disclaimer is present', body, 'not part of any hospital IT system');
  has('2h. the 2026 guideline is cited by DOI', body, '10.1161/CIR.0000000000001415');
  has('2h. the arrest dose is stamped as NOT from this guideline', body, 'not from this guideline');

  /* The review banner comes down when a clinician signs the content off, in the
     commit that names them — not quietly, and not because the page looks finished.
     Same guard neonatal/ carries. */
  ck('2h. the not-yet-reviewed banner is still up', await pg.locator('#reviewBanner').isVisible(), true);
  has('2h. and it says what it is', await txt('#reviewBanner'), 'NOT CLINICALLY REVIEWED');

  /* PHI guard: this pathway holds no state at all — nothing to leak, nothing to
     clear. Assert that rather than trusting it. */
  await scenario({ hemo: 'refractory', resp: 3 });
  const stored = await pg.evaluate(() => ({
    ls: Object.keys(localStorage).length, ss: Object.keys(sessionStorage).length,
    cookie: document.cookie.length,
  }));
  ck('2h. nothing is written to localStorage', stored.ls, 0);
  ck('2h. nothing is written to sessionStorage', stored.ss, 0);
  ck('2h. no cookies are set', stored.cookie, 0);
  ck('2h. the page has no text inputs to type a name into',
    await pg.locator('input[type=text],input[type=email],textarea').count(), 0);
}

console.log('\n--- 2i. receiving hospitals ---');
{
  await pg.goto(BASE + TOOL + '?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);

  /* Config-driven: the rows are the configured destinations, in the configured order. */
  const want = SITE.transferDestinations || [];
  ck('2i. the tool configures its receiving hospitals', want.length > 0, true);
  const rowLabels = await pg.locator('#xferBox > div:not(:first-child) > div:first-child').allInnerTexts();
  ck('2i. every configured destination is on screen, in config order',
    rowLabels.map(norm).join(' | '), want.map(d => d.label).join(' | '));

  /* Alphabetical by hospital, and the screen says the order is not a ranking.
     Both halves matter: a list read top-down under pressure is taken as a
     preference order unless it says otherwise. */
  const sorted = [...rowLabels.map(norm)].sort((a, b) => a.localeCompare(b, 'en'));
  ck('2i. the destinations are in alphabetical order',
    rowLabels.map(norm).join(' | '), sorted.join(' | '));
  has('2i. and the page says that order is not a preference ranking',
    norm(await pg.locator('#xferBox').locator('xpath=following-sibling::p[1]').innerText()),
    'not in order of preference');

  /* The invariant that matters most on a phone affordance: a number nobody has
     filled in must NOT render as a tappable link. A 44px call target that dials
     nothing is worse than no target at all. */
  for (const d of want) {
    const dialable = String(d.tel || '').replace(/[^0-9]/g, '').length >= 7;
    const link = pg.locator(`#xferBox a[href="tel:${String(d.tel).replace(/[^0-9+]/g, '')}"]`);
    ck(`2i. ${d.key}: ${dialable ? 'dialable, so it is a tel: link' : 'undialable, so it is NOT a link'}`,
      (await link.count()) > 0, dialable);
    if (!dialable) {
      has(`2i. ${d.key}: and it is marked unconfigured rather than looking ready`,
        norm(await pg.locator('#xferBox').innerText()), 'not configured');
    }
  }
  const anyDead = await pg.locator('#xferBox a[href="tel:"], #xferBox a[href="tel:+"]').count();
  ck('2i. no dead tel: link anywhere in the block', anyDead, 0);

  /* Cross-tool: PE and STEMI route to the same hospitals in the same order. The
     strings come from one place (site.config.json), so this is really asserting
     that neither tool has quietly grown a hand-typed copy — the same reason
     verify_vems.mjs compares rendered glyphs rather than trusting a shared file. */
  const peSet = rowLabels.map(norm);
  const pg2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg2.goto(BASE + '/codes/?from=home#c21', { waitUntil: 'networkidle' });
  await pg2.waitForTimeout(500);
  const stemiSet = (await pg2.locator('#stemiXferBox > div:not(:first-child) > div:first-child > div:first-child')
    .allInnerTexts()).map(norm);
  await pg2.close();
  ck('2i. STEMI offers the same hospitals, in the same order, as PE',
    stemiSet.join(' | '), peSet.join(' | '));
}

/* ==========================================================================
   3. THE FORM ITSELF — the sPESI hand-off, and reset
   ========================================================================== */
console.log('\n--- 3. sPESI auto-fill, manual override, and reset ---');
{
  await reset();
  await pick('hemo', 'none'); await pick('dx', 'symptomatic');
  ck('3. severity is unset until something says otherwise',
    await pg.locator('.opts[data-group="sev"] input:checked').count(), 0);

  await pg.locator('.opts[data-group="spesi"] input[value="cancer"]').check();
  await pg.waitForTimeout(60);
  ck('3. one sPESI point sets the severity row to elevated',
    await pg.locator('.opts[data-group="sev"] input:checked').getAttribute('value'), 'high');
  ck('3. and the sPESI count is shown', await txt('#spesiScore'), '1');

  await pg.locator('.opts[data-group="spesi"] input[value="cancer"]').uncheck();
  await pg.waitForTimeout(60);
  ck('3. clearing every sPESI point sets the severity row to low',
    await pg.locator('.opts[data-group="sev"] input:checked').getAttribute('value'), 'low');
  ck('3. sPESI 0 is a real answer, not a blank', await txt('#spesiScore'), '0');

  /* A clinician who scored a PESI or a Hestia instead must be able to say so, and
     the sPESI count must stay visible rather than vanishing under the override. */
  await pg.locator('.opts[data-group="spesi"] input[value="cancer"]').check();
  await pg.waitForTimeout(60);
  await pg.locator('.opts[data-group="sev"] input[value="low"]').check();
  await pg.waitForTimeout(60);
  ck('3. a deliberate tap overrides the sPESI auto-fill',
    await pg.locator('.opts[data-group="sev"] input:checked').getAttribute('value'), 'low');
  ck('3. and the sPESI count stays on screen under the override', await txt('#spesiScore'), '1');
  has('3. and the page says the override is in force', await txt('#sevHint'), 'set by hand');

  await pg.locator('.opts[data-group="spesi"] input[value="hr"]').check();
  await pg.waitForTimeout(60);
  ck('3. touching sPESI again hands control back to it',
    await pg.locator('.opts[data-group="sev"] input:checked').getAttribute('value'), 'high');

  await reset();
  ck('3. reset clears every answer',
    await pg.locator('.opts[data-group] input:checked').count(), 0);
  has('3. reset returns the verdict to the prompt', await final(), 'Complete the sections above');
}

/* ==========================================================================
   4. NO PAGE ERRORS
   ========================================================================== */
console.log('\n--- 4. the page runs clean ---');
ck('4. no page errors or console errors', errs.join(' | ') || 'none', 'none');

/* ==========================================================================
   5. FORK PROOF — the same suite against a plausible fork's config
   ==========================================================================
   An adopting ED whose lab calls a lactate abnormal at 2.5, that scores with a
   PESI cutoff it has localized, that puts its respiratory bar at 4 L, and that
   genuinely HAS catheter-directed lysis on site is doing exactly the right thing.
   A suite that goes red for them teaches that site that red is normal.
   ========================================================================== */
console.log('\n--- 5. the config-driven checks still pass against a fork ---');
const FORK = 'dist/clinical-pathways/pe/__fork.html';
{
  const orig = readFileSync(SRC, 'utf8');
  const forked = orig
    .replace('pesiLow: 85', 'pesiLow: 90')
    .replace('bovaLow: 4', 'bovaLow: 3')
    .replace('ageOver: 80', 'ageOver: 75')
    .replace('hrAtLeast: 110', 'hrAtLeast: 105')
    .replace('spo2Under: 93', 'spo2Under: 92')
    .replace('rrAtLeast: 30', 'rrAtLeast: 28')
    .replace('ncOverLpm: 6', 'ncOverLpm: 4')
    .replace('lactateOver: 2', 'lactateOver: 2.5')
    .replace('arrestNoRoscMin: 30', 'arrestNoRoscMin: 20')
    .replace('catheterDirected: false', 'catheterDirected: true')
    .replace('pertOnSite: false', 'pertOnSite: true')
    .replace('version: "1.0"', 'version: "1.0-fork"')
    /* ...and a site that has NOT yet filled one of its destinations in. Both
       directions of the phone affordance have to be proven: this edition has all
       three numbers, so the fork is where the unconfigured path gets tested. It
       is the path an adopting ED actually lands on first. */
    .replace("tel:'+18554228200',       phone:'855-422-8200'",
             "tel:'',       phone:'[add your third transfer line]'");
  ck('5. the fork rewrite actually changed the config', forked === orig ? 'unchanged' : 'changed', 'changed');
  writeFileSync(FORK, forked);

  const F = await load(BASE + '/clinical-pathways/pe/__fork.html');
  const body = norm(await pg.locator('.wrap').innerText());
  ck('5. the fork is serving different numbers', F.score.pesiLow === SITE.score.pesiLow ? 'same' : 'different', 'different');
  has("5. the fork's PESI band is on screen", body, `PESI ≤ ${F.score.pesiLow}`);
  has("5. the fork's Bova band is on screen", body, `Bova ≤ ${F.score.bovaLow}`);
  has("5. the fork's sPESI age is on screen", body, `Age > ${F.spesi.ageOver} y`);
  has("5. the fork's lactate is on screen", body, `${F.shock.lactateOver} mmol/L`);
  has("5. the fork's oxygen bar is on screen", body, `> ${F.resp.ncOverLpm} L nasal cannula`);
  has("5. the fork's version stamp is on screen", await txt('#verStamp'), 'v' + F.version);
  ck('5. none of the original values leaked through',
    body.includes(`PESI ≤ ${SITE.score.pesiLow}`) ? 'leaked' : 'clean', 'clean');

  /* The capability flags rewrite the sentence, not the recommendation. */
  await scenario({ hemo: 'shock' });
  has('5. a site WITH a PERT is told to activate it', await final(), 'Activate the PE response team');
  has('5. a site WITH catheter lysis is told what it has', await txt('#advNote'), 'Available on site: catheter-directed lysis');

  /* A destination this edition HAS filled in renders as unconfigured plain text on
     a fork that has not — same code, opposite rendering, driven only by config.
     The live edition proves the dialable direction in 2i; this proves the other. */
  await pg.goto(BASE + '/clinical-pathways/pe/__fork.html?from=home', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);
  has('5. an unfilled destination is marked unconfigured on the fork',
    norm(await pg.locator('#xferBox').innerText()), 'not configured');
  ck('5. and it is NOT a tappable link on the fork',
    await pg.locator('#xferBox a[href^="tel:"]').count(), (SITE.transferDestinations || []).length - 1);
  ck('5. no dead tel: link is produced by the empty value',
    await pg.locator('#xferBox a[href="tel:"], #xferBox a[href="tel:+"]').count(), 0);

  /* And the invariants are still invariant on the fork. */
  await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'abnormal' });
  ck('5. the C split is unchanged by localization', await code(), 'C3');
  ck('5. lysis at C2 is still harm on the fork',
    (await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'normal' }), (await advRow()).lysis), '3: Harm');
  await scenario({ hemo: 'none', sev: 'low', loc: 'subseg' });
  await pick('hemo', 'refractory');
  ck('5. hemodynamics still outrank the score on the fork', await code(), 'E2');
}

/* ==========================================================================
   6. MUTATION PROOF — break the LOGIC, config untouched, and this suite must fail
   ========================================================================== */
console.log('\n--- 6. the suite fails when the logic is broken ---');
const MUTANTS = [];
{
  const orig = readFileSync(SRC, 'utf8');
  /* Two independent mutations, each aimed at a different invariant:
       a) C splits on OR instead of AND — the C2/C3 line moves
       b) the respiratory bar stops rising with the tier                     */
  const mutants = {
    'C splits on OR instead of AND':
      orig.replace('if(rvAb && bioAb) out.sub=\'C3\';', 'if(rvAb || bioAb) out.sub=\'C3\';'),
    'the respiratory bar stops rising with the tier':
      orig.replace('{ A:null, B:null, C:1, D:2, E:3 }', '{ A:null, B:null, C:1, D:1, E:1 }'),
  };
  let n = 0;
  for (const [label, src] of Object.entries(mutants)) {
    ck(`6. mutation "${label}" actually changed the page`, src === orig ? 'unchanged' : 'changed', 'changed');
    /* Each mutant gets its own URL. Reusing one filename let the browser serve the
       first mutant's cached copy for the second, and the second assertion "passed"
       against code it was never shown — the exact silent-green failure this whole
       section exists to rule out. */
    const path = `/clinical-pathways/pe/__mutant${++n}.html`;
    MUTANTS.push('dist' + path);
    writeFileSync('dist' + path, src);
    await load(BASE + path);
    let caught = false;
    if (/C splits/.test(label)) {
      await scenario({ hemo: 'none', sev: 'high', rv: 'abnormal', bio: 'normal' });
      caught = (await code()) !== 'C2';
    } else {
      await scenario({ hemo: 'shock', resp: 1 });
      caught = (await code()) !== 'E1';
    }
    ck(`6. and the assertion that guards it goes red`, caught ? 'caught' : 'MISSED', 'caught');
  }
}
for (const f of [FORK, ...MUTANTS]) if (existsSync(f)) rmSync(f);

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
