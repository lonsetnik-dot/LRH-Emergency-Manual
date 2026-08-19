/* LRH Emergency Manual — the audience strip on codes' adult cards (issue #173).
 *
 * The strip is the safety net for a pediatric weight landing on an adult dosing card. Two
 * things it got wrong, both found on the toxicology card and both true of most of the tool:
 *
 *   1. It offered "TAP FOR PEDIATRIC" on 26 cards that have no pediatric version, over a tap
 *      that landed on the Pediatrics home page. A routing promise the manual cannot keep, at
 *      the top of a card someone opened because a patient was crashing.
 *   2. Its "STAY — ADULT PATIENT" answer DELETED the weight. On a dosing card that is
 *      destructive in the one direction that matters: the tox card computes high-dose insulin
 *      and lipid emulsion from that weight.
 *
 * Config-driven per issue #117: thresholds and the adult age come from SITE.audience, so a
 * fork that sets a different threshold still passes. What is written out is the INVARIANT —
 * that a sub-threshold weight always warns, that the weight survives every interaction, and
 * that no card promises a route it does not have.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_audience_strip.mjs
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

const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(BASE + '/codes/?from=home', { waitUntil: 'networkidle' });
await pg.waitForTimeout(400);

/* ---- read the site's OWN config, never re-type this site's numbers ---- */
const cfg = await pg.evaluate(() => ({
  thresholdKg: SITE.audience.thresholdKg,
  adultAgeYrs: SITE.audience.adultAgeYrs,
}));
ck('0. SITE.audience exposes a weight threshold', typeof cfg.thresholdKg === 'number', true);
ck('0. SITE.audience exposes an adult age (#173)', typeof cfg.adultAgeYrs === 'number', true);

const strip = (id) => pg.evaluate(i => {
  const s = document.querySelector('article#' + i + ' .audiencestrip');
  return s ? { txt: s.textContent.trim(), cls: s.className, click: !!s.onclick } : null;
}, id);
const enter = async (kg, ageYrs) => {
  await pg.evaluate(([k, a]) => {
    const el = document.getElementById('wtkg'); el.value = k;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const ag = document.getElementById('wtage');
    if (ag) { ag.value = a; ag.dispatchEvent(new Event('input', { bubbles: true })); }
  }, [String(kg), String(ageYrs)]);
  await pg.waitForTimeout(250);
};
const weightState = () => pg.evaluate(() => ({
  field: document.getElementById('wtkg').value,
  stored: localStorage.getItem('lrh-case-wtkg'),
  override: localStorage.getItem('lrh-case-adultoverride'),
}));

/* Derive the test cards from the page, not from a hand-typed list: which adult cards have a
   pediatric destination and which do not is exactly what this suite is about. */
const cards = await pg.evaluate(() => {
  const out = { withAlt: [], noAlt: [] };
  document.querySelectorAll('article[data-audience="adult"]').forEach(a => {
    (a.getAttribute('data-peds-alt') ? out.withAlt : out.noAlt).push(a.id);
  });
  return out;
});
ck('1. there are adult cards with a pediatric destination', cards.withAlt.length > 0, true);
ck('1. and adult cards without one', cards.noAlt.length > 0, true);

const noAlt = cards.noAlt.includes('c36') ? 'c36' : cards.noAlt[0];   // the tox card if it is still there
const hasAlt = cards.withAlt[0];

/* ---- 2. A CARD WITH NO PEDIATRIC VERSION NEVER OFFERS ONE (#173) ---- */
const quietNoAlt = await strip(noAlt);
ck('2. no-alt card does not advertise a pediatric tap', /TAP FOR PEDIATRIC/.test(quietNoAlt.txt), false);
ck('2. no-alt card says what it is', /ADULT DOSING/.test(quietNoAlt.txt), true);
ck('2. no-alt card is not clickable when it has nowhere to go', quietNoAlt.click, false);
ck('2. and does not look clickable either', /inert/.test(quietNoAlt.cls), true);

/* Every no-alt card, not just the sampled one — this was a 26-card defect. */
const anyPromising = await pg.evaluate(ids => ids.filter(i => {
  const s = document.querySelector('article#' + i + ' .audiencestrip');
  return s && /TAP FOR/.test(s.textContent);
}), cards.noAlt);
ck('2. NO no-alt card promises a route', anyPromising.join(',') || 'none', 'none');

/* A card that HAS a destination still offers it — the weight-routing-audit decision. */
const quietAlt = await strip(hasAlt);
ck('2. a card with a real destination still offers it', /TAP FOR/.test(quietAlt.txt), true);
ck('2. and is clickable', quietAlt.click, true);

/* ---- 3. THE SAFETY NET: a sub-threshold weight always warns ---- */
await enter(cfg.thresholdKg - 1, 4);
ck('3. below threshold, a no-alt card warns',
  /warn/.test((await strip(noAlt)).cls), true);
ck('3. below threshold, a card with an alt warns',
  /warn/.test((await strip(hasAlt)).cls), true);
ck('3. the warning names the weight', /PATIENT/.test((await strip(noAlt)).txt), true);

/* AGE MUST NOT SILENCE A SUB-THRESHOLD WEIGHT. Asked for as "age > 12 OR weight > 40 and it
   goes away"; implemented as the conservative half, because the doses these cards hand out
   are weight-based and a 35 kg adolescent is still 35 kg. This is the clinical invariant of
   the whole change — a fork may move the numbers, never this. */
await enter(cfg.thresholdKg - 5, cfg.adultAgeYrs + 2);
ck('3. an adult AGE does not silence a pediatric WEIGHT',
  /warn/.test((await strip(noAlt)).cls), true);

/* ---- 4. AT OR ABOVE THRESHOLD IT SETTLES (the "it just goes away" half of #173) ---- */
await enter(cfg.thresholdKg, cfg.adultAgeYrs + 20);
ck('4. at exactly the threshold the strip is quiet',
  /quiet/.test((await strip(noAlt)).cls), true);
ck('4. and names the weight it settled on',
  /ADULT DOSING/.test((await strip(noAlt)).txt), true);

/* Age alone settles it when there is no weight to disagree with. */
await pg.evaluate(() => { const el = document.getElementById('wtkg'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForTimeout(250);
ck('4. an adult age with no weight settles it',
  /y · ADULT DOSING/.test((await strip(noAlt)).txt), true);

/* ---- 5. "STAY — ADULT PATIENT" KEEPS THE WEIGHT (#173) ---- */
await enter(cfg.thresholdKg - 10, 30);
const before = await weightState();
await pg.click('article#' + noAlt + ' .audiencestrip');
await pg.waitForTimeout(200);
ck('5. the warning opens the interstitial',
  await pg.evaluate(() => getComputedStyle(document.getElementById('audiencemodal')).display), 'flex');
await pg.click('#audiencemodalstay');
await pg.waitForTimeout(300);
const afterStay = await weightState();
ck('5. the weight FIELD survives the answer', afterStay.field, before.field);
ck('5. the STORED weight survives the answer', afterStay.stored, before.stored);
ck('5. the answer is recorded as the adult override', afterStay.override, '1');
ck('5. and the strip says the patient was marked adult',
  /MARKED ADULT/.test((await strip(noAlt)).txt), true);

/* WS10.4 clears the override on a weight/age change, and it fires on a debounce — an answer
   given inside that window used to be revoked half a second later with nothing on screen. */
await pg.waitForTimeout(1200);
ck('5. the answer survives the WS10.4 debounce',
  (await weightState()).override, '1');

/* Reversible: an override nobody can undo is a setting, not an answer. */
await pg.click('article#' + noAlt + ' .audiencestrip');
await pg.waitForTimeout(300);
ck('5. tapping again undoes it', (await weightState()).override, null);
ck('5. and the warning comes back', /warn/.test((await strip(noAlt)).cls), true);

/* But a genuinely new weight still clears it — WS10.4's actual purpose. */
await pg.click('article#' + noAlt + ' .audiencestrip');
await pg.waitForTimeout(150);
await pg.click('#audiencemodalstay');
await pg.waitForTimeout(300);
await enter(cfg.thresholdKg + 30, 40);
await pg.waitForTimeout(1200);
ck('5. a NEW weight still clears the override (WS10.4)',
  (await weightState()).override, null);

/* ---- 6. the tox card carries its sign-off, not a DRAFT banner ---- */
const tox = await pg.evaluate(() => {
  const a = document.querySelector('article#c36');
  if (!a) return null;
  const r = a.querySelector('.reviewedbar');
  return { reviewed: r ? r.textContent.trim() : '', draft: /NOT CLINICALLY REVIEWED/.test(a.textContent) };
});
ck('6. the toxicology card no longer says NOT CLINICALLY REVIEWED', tox.draft, false);
ck('6. it names the review date instead', /CLINICALLY REVIEWED 2026-08-18/.test(tox.reviewed), true);
ck('6. and who did it', /Lon Setnik/.test(tox.reviewed), true);

ck('7. no page errors throughout', errs.length, 0);

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
