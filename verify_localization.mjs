/* verify_localization.mjs — proves the template is actually a template.
 *
 *     node build.mjs && node verify_localization.mjs
 *     (run-tests.sh runs it in sequence with everything else)
 *
 * The other suites check that the manual is clinically correct. This one checks
 * something the others structurally cannot: that the manual is correct ABOUT
 * WHOSE MANUAL IT IS.
 *
 * It builds the same source tree three times — blank, this site's answers, and
 * a plausible different hospital's — and asserts, for each, that the screens
 * follow the answer sheet. Then it does the thing that makes the first two
 * meaningful: it MUTATES a page's logic with the config left alone, and
 * requires the harness to notice. A suite that only ever passes is not
 * evidence.
 *
 * NOTE ON dist/: this rebuilds dist/ several times and restores the original
 * build before exiting, so it can run in the middle of run-tests.sh without
 * leaving the next suite looking at somebody else's build.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { FIELDS } from './localization.manifest.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const ORIGINAL_CONFIG = process.env.SITE_CONFIG || 'site.config.json';
const TMP = '_verify_localization.tmp.json';

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};

const build = cfg => execFileSync('node', ['build.mjs', '--config', cfg], { encoding: 'utf8' });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
/* Service workers OFF. The offline shell serves cache-first by design (issue
   #120), which is exactly right at the bedside and exactly wrong here: this
   suite rebuilds the site three times in one run and would otherwise assert
   against whichever build the worker cached first. */
const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

const go = async u => { await page.goto(BASE + u, { waitUntil: 'networkidle' }); await page.waitForTimeout(150); };
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const cfgOf = () => page.evaluate(() => window.SITE_CONFIG);

/* A plausible different hospital. Deliberately not a tweak of this site's
   answers: a different assay in different units, a different defibrillator
   sequence, a full trauma team rather than a rural one, and a cath lab. If any
   screen still shows this site's numbers under these answers, the value was
   never localizable in the first place. */
const FORK = {
  site: { hospitalName: 'Riverbend General Hospital', hospitalShort: 'RGH',
          healthSystemName: 'Riverbend Health', deptName: 'EMERGENCY CARE CENTER',
          domain: 'manual.riverbend.example', repoUrl: 'https://github.com/riverbend/manual',
          accentLight: '#1F5FA0', accentDark: '#5FA8E8' },
  contacts: {
    transfer: [{ key: 'metro', label: 'Metro University Transfer Center',
                 phoneDisplay: '555-0100 (24h)', tel: '+15555550100', use: 'PCI, thrombectomy' }],
    transferPrimary: { label: 'Metro University Transfer Center', phone: '(555) 555-0100', tel: '+15555550100' },
    poisonControl: { display: '1-800-555-0199', tel: '+18005550199' },
    bloodBank: { how: 'Call the blood bank on 4400 and say "activate MTP"' },
    security: { who: 'house supervisor', how: 'lock the ambulance bay from the charge desk',
                overhead: 'CODE SILVER ED', note: null },
  },
  caps: { traumaCenterLevel: 'Level II', neurosurgeryInHouse: true, cathLab: true,
          plateletsOnSite: 'always', cEEGInHouse: true, replantCenter: false,
          edSecurityOvernight: true, criticalAccess: false,
          tcaTeamModel: 'simultaneous', obOnSite: true },
  defib: { mfr: 'Philips Truncated Exponential', mfrShort: 'Philips', adultJoules: [150, 200, 200] },
  trop: { assayName: 'Roche Elecsys hs-cTnT', units: 'ng/L',
          ruleInValue: 52, ruleInDelta: 10, ruleOutValue: 6, ruleOutDelta: 3,
          ruleOutPainValue: 5, singleLoD: 4, painHours: 2,
          grayLow: 6, grayHigh: 51, normalLimitMale: 22, normalLimitFemale: 16 },
  formulary: { strokeLytic: 'alteplase 0.9 mg/kg (10% bolus, remainder over 1 h), max 90 mg',
               thrombectomyTrigger: 'NIHSS ≥6 → CTA', reversalAgents: '4F-PCC, idarucizumab',
               rsiInduction: 'etomidate (default), ketamine', mtpRatio: '1:1:1, six-unit coolers',
               apneicOxLpm: 20 },
  physical: { cartDrawers: ['1 · Airway', '2 · Drugs', '3 · Circulation', '4 · Procedures'],
              supraglotticSizes: 'LMA Supreme 3–5 only', lungIsolation: 'Bronchial blocker stocked in the OR',
              balloonTamponadeTube: 'Minnesota tube (4-lumen)', resusRoom: 'Bay 1 (Trauma)',
              simRoom: 'Simulation suite, level 2' },
  policy: { stroke: 'RGH Acute Stroke Pathway v4', ich: 'RGH ICH Bundle',
            mtp: 'Riverbend Health MTP policy (2026)', statusEpilepticus: 'RGH Seizure Pathway',
            asthma: 'RGH Asthma Pathway', angioedema: 'RGH Angioedema Pathway',
            tracheostomy: 'RGH Tracheostomy Emergency SOP', pedsOrderSet: 'RGH Paediatric Order Set',
            stemiActivation: 'Cath lab activated directly by the ED physician on 4111' },
  dialect: { variant: 'US' },
  review: { reviewer: 'A. Reviewer', date: '2026-09-01' },
};

/* ============================ 1. BLANK ==================================== */
console.log('\n--- 1. blank answer sheet: the manual must say it is not yours ---');
writeFileSync(TMP, JSON.stringify({}, null, 2));
build(TMP);

await go('/clinical-pathways/heart/');
{
  const S = await cfgOf();
  ck('1. build reports every required answer missing',
     S.counts.missingGoLive, FIELDS.filter(f => f.required === 'go-live').length);
  ck('1. the NOT LOCALIZED bar is on the page', await page.locator('#edm-localize-bar').count(), 1);

  await page.fill('#t0', '10'); await page.fill('#t1', '12'); await page.waitForTimeout(200);
  const r = (await page.textContent('#tropResult')).replace(/\s+/g, ' ');
  ck('1. the chest-pain pathway refuses to classify', /NOT LOCALIZED/.test(r), true);
  ck('1. and reaches no verdict at all',
     /RULE-IN ZONE|D\/C HOME|AMI RULED OUT|REFLEX TO 3 HOURS/.test(r), false);
}

await go('/arrest/');
{
  await page.fill('#wIn', '80'); await page.waitForTimeout(200);
  await page.click('#startbtn'); await page.waitForTimeout(250);
  ck('1. the shock control prints no joule value',
     /\d+\s*J\b/.test(await page.locator('#shocklabel').innerText()), false);
}

await go('/trauma/?from=home');
{
  const t = await body();
  ck('1. no transfer number is offered', /NO TRANSFER CENTER SET/.test(t), true);
  const href = await page.evaluate(() => {
    const a = document.querySelector('a.telcall[data-tc]'); return a ? a.getAttribute('href') : 'none';
  });
  ck('1. and the tap-to-call link does not dial anything', href, 'null');
}

/* The most important assertion in this file. A stripped manual that still
   states another hospital's capabilities has not been stripped — it has been
   renamed, which is worse, because the sentence now reads as this department's
   own and nobody will re-check it. */
console.log('\n--- 2. no other hospital\'s identity or capabilities survive ---');
{
  const LEAKS = [
    [/\bLRH\b/, 'the source hospital\'s abbreviation'],
    [/Littleton/, 'the source hospital\'s name'],
    [/lrhemergencymanual/, 'the source hospital\'s domain'],
    [/DHMC|Dartmouth-Hitchcock/, 'the source hospital\'s transfer center'],
    [/877.?999.?9870/, 'the source hospital\'s transfer number'],
    [/no on-site cath lab/i, 'an inherited capability claim (cath lab)'],
    [/no in-house neurosurgery/i, 'an inherited capability claim (neurosurgery)'],
  ];
  const PAGES = ['/', '/codes/?from=home', '/trauma/?from=home', '/clinical-pathways/heart/',
                 '/arrest/', '/tca/?from=home', '/peds/?from=home', '/labels/',
                 '/procedures/?from=home', '/posters/blakemore/', '/equipment-readiness/?from=home'];
  const found = [];
  for (const u of PAGES) {
    await go(u);
    const t = await body();
    for (const [re, what] of LEAKS) if (re.test(t)) found.push(`${u}: ${what}`);
  }
  ck('2. nothing on any screen names another hospital', found.join(' | ') || 'none', 'none');
}

/* ======================= 3. A DIFFERENT HOSPITAL ========================== */
console.log('\n--- 3. a plausible fork: every screen follows ITS answers ---');
writeFileSync(TMP, JSON.stringify(FORK, null, 2));
build(TMP);

await go('/clinical-pathways/heart/');
{
  ck('3. a fully answered fork sees no NOT LOCALIZED bar',
     await page.locator('#edm-localize-bar').count(), 0);
  /* 52 is the fork's rule-in cutoff; this site's is different. A value at the
     fork's cutoff must rule in, and — the half that catches an inherited
     number — a value below it must NOT. */
  await page.fill('#t0', '52'); await page.fill('#t1', '52'); await page.waitForTimeout(200);
  ck('3. rules in at the FORK\'s cutoff (52)',
     /RULE-IN ZONE/.test(await page.textContent('#tropResult')), true);
  await page.fill('#t0', '51'); await page.fill('#t1', '51'); await page.waitForTimeout(200);
  ck('3. does NOT rule in one below it',
     /RULE-IN ZONE/.test(await page.textContent('#tropResult')), false);
  const t = await body();
  ck('3. the printed reference table shows the fork\'s numbers, not ours',
     t.includes('52') && !/\b50 ng\/L\b/.test(t), true);
  ck('3. the header names the fork\'s hospital', /Riverbend General Hospital/.test(t), true);
}

await go('/arrest/');
{
  await page.fill('#wIn', '80'); await page.waitForTimeout(200);
  await page.click('#startbtn'); await page.waitForTimeout(250);
  ck('3. the first shock is the fork\'s 150 J',
     (await page.locator('#shocklabel').innerText()).includes('150 J'), true);
  /* CLINICAL INVARIANT — not localizable. Whatever the sequence, energies must
     escalate and then plateau. The fork's is 150/200/200. */
  await page.click('#shockbtn'); await page.waitForTimeout(200);
  const second = await page.locator('#shocklabel').innerText();
  await page.click('#shockbtn'); await page.waitForTimeout(200);
  const third = await page.locator('#shocklabel').innerText();
  ck('3. INVARIANT: energies escalate then plateau',
     second.includes('200 J') && third.includes('200 J'), true);
}

await go('/tca/?from=home');
ck('3. the traumatic-arrest screen runs the fork\'s team model',
   await page.evaluate(() => window.SITE.mode), 'simultaneous');

await go('/trauma/?from=home');
{
  const link = await page.evaluate(() => {
    const a = document.querySelector('a.telcall[data-tc]');
    return a ? a.textContent + '|' + a.getAttribute('href') : 'none';
  });
  ck('3. the transfer link dials the fork\'s center',
     link.includes('Metro University') && link.includes('tel:+15555550100'), true);
  ck('3. and the trauma level is the fork\'s',
     /Level II/.test(await body()), true);
}

/* ===================== 4. THE HARNESS CAN STILL FAIL ====================== */
/* Three green runs prove nothing unless a broken build goes red. Two mutations:
   one to the DATA (an answer removed) and one to the LOGIC (the pathway's
   rule-in comparison flipped) — because a harness that only reads config would
   pass the second, and a harness that only reads the page would pass the first. */
console.log('\n--- 4. mutation: the harness must notice when something breaks ---');
{
  const short = JSON.parse(JSON.stringify(FORK));
  delete short.defib.adultJoules;
  writeFileSync(TMP, JSON.stringify(short, null, 2));
  build(TMP);
  await go('/arrest/');
  await page.fill('#wIn', '80'); await page.waitForTimeout(200);
  await page.click('#startbtn'); await page.waitForTimeout(250);
  ck('4. removing the energies stops any joule value being printed',
     /\d+\s*J\b/.test(await page.locator('#shocklabel').innerText()), false);
}
{
  const src = 'clinical-pathways/heart/index.html';
  const original = readFileSync(src, 'utf8');
  /* Flip the rule-in comparison from >= to >. A single character, clinically
     the difference between ruling in a patient sitting exactly on the cutoff
     and sending them home. */
  const mutated = original.replace('if(t0>=T.ruleInValue) return {code:\'in\'',
                                   'if(t0>T.ruleInValue) return {code:\'in\'');
  ck('4. mutation point found in the pathway', mutated !== original, true);
  try {
    writeFileSync(src, mutated);
    writeFileSync(TMP, JSON.stringify(FORK, null, 2));
    build(TMP);
    await go('/clinical-pathways/heart/');
    await page.fill('#t0', '52'); await page.waitForTimeout(200);
    ck('4. the mutated pathway no longer rules in at the cutoff (harness would go red)',
       /RULE-IN ZONE/.test(await page.textContent('#tropResult')), false);
  } finally {
    writeFileSync(src, original);
  }
}

/* Restore the build the rest of the suite expects. */
build(ORIGINAL_CONFIG);
if (existsSync(TMP)) rmSync(TMP);

ck('5. no page errors across the whole run', errs.length, 0);

await browser.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
