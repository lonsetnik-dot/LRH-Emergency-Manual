/* LRH Emergency Manual — transcluded card sections.
 *
 * The manual has one place where each procedure is written down: its card. A live engine that
 * walks somebody through that procedure shows the card's rows, transcluded at build time
 * ({{PROC:tool#cNN|SECTION}}, see build.mjs), rather than a second copy typed into the engine.
 *
 * This exists because the second copy already happened. CLOSE THE HEART, CLAMSHELL EXTENSION and
 * HILAR TWIST were written into procedures/ card 02 and then hand-typed again into tca/ the same
 * day. Nothing was wrong on screen; editing either one afterwards would have left the other
 * saying the old thing, with no test able to tell.
 *
 * So the assertion is the same one verify_procedure_icons.mjs makes about drawings, made about
 * words: compare the RENDERED text on the consuming page against the RENDERED text on the card,
 * rather than trusting that both went through the same build step.
 *
 * Three things are checked, and the third is the one that keeps the other two honest:
 *   1. every transcluded row's action appears, verbatim, on the card it names;
 *   2. the glyph beside the row that opens a sheet is the card's own glyph, byte for byte;
 *   3. the build FAILS on a section name that does not resolve — because a renamed section is a
 *      silent content loss otherwise, and silence is exactly what this mechanism exists to end.
 *
 *     node build.mjs && python3 -m http.server 8123 --directory dist
 *     node verify_transclusion.mjs
 */
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }

const BASE = (process.env.BASE || 'http://localhost:8123').replace(/\/$/, '');
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
console.log('testing against ' + BASE + '\n');

let pass = 0, fail = 0;
const ck = (name, got, want) => { const ok = String(got) === String(want); (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want)); };

/* Compare on the words, not the markup. A card writes "5&ndash;10 mL" and the browser renders an
   en dash; entity spelling is a source detail and must not be what makes this suite red. */
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[‐-―]/g, '-')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
/* Containment is compared with the spaces taken out. A row's role chip is a styled <span> the
   browser renders hard against the next word ("TECH/RNManual left uterine displacement"), while
   the transclusion turns every tag into a gap and reads "TECH/RN Manual …". Both are the same
   sentence; only one of them is readable, and the readable one must not be what fails. Every
   other difference — a changed word, a dropped clause, a reordered phrase — still shows. */
const same = (hay, needle) => hay.replace(/\s+/g, '').includes(needle.replace(/\s+/g, ''));

const errs = [];
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

/* ---- 1. the consuming page ---- */
console.log('--- 1. tca/ exposes what it borrows');
await pg.goto(BASE + '/tca/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(300);
ck('1. loads with no page errors', errs.length, 0);

/* Decoded in the page, by the DOM that will render it. A row keeps its source's entity spelling
   ("5&ndash;10 mL"), and comparing that string to the card's rendered text is comparing two
   spellings of the same dash — a red run for nothing. */
const sheets = await pg.evaluate(() => {
  const box = document.createElement('div');
  const text = html => { box.innerHTML = String(html).replace(/<br[^>]*>/gi, ' '); return box.textContent; };
  const out = {};
  for (const k of Object.keys(window.SHEETS || {})) {
    const s = window.SHEETS[k];
    out[k] = { t: s.t, from: s.from || '', href: s.href || '', icon: s.icon || '',
               rows: s.l.map(r => ({ do: r.do, why: r.why || '',
                                     doText: text(r.do), whyText: r.why ? text(r.why) : '' })) };
  }
  return out;
});
ck('1. the sheet table is readable from the page', Object.keys(sheets).length > 8, true);
/* A row is two tiers or it is not a checklist row (DESIGN-SYSTEM.md §6b). The shape is asserted
   here because everything below reads r.do — a sheet that reverted to plain strings would make
   every parity check compare undefined to undefined and pass. */
const shaped = Object.values(sheets).every(s => s.rows.length && s.rows.every(r => typeof r.do === 'string' && r.do.length));
ck('1. every sheet is rows of {do, why}, not prose strings', shaped, true);

/* ---- 2. every borrowed row is the card's own ---- */
console.log('\n--- 2. the words have one home');
const borrowed = Object.entries(sheets).filter(([, s]) => s.href);
ck('2. sheets that name a card', borrowed.length > 5, true);

const cardText = new Map();
async function textOf(href) {
  /* '../procedures/?from=tca#c02' -> the card's own article on that page. */
  const m = href.match(/\.\.\/([a-z0-9-]+)\/[^#]*#(c\d+)$/);
  if (!m) return null;
  const key = m[1] + '#' + m[2];
  if (cardText.has(key)) return cardText.get(key);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + '/' + m[1] + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  /* textContent, not innerText: a card's sections may be collapsed, and innerText omits
     everything display:none — which would make a transcluded row look absent from its source. */
  const t = await p.evaluate(id => {
    const a = document.getElementById(id);
    return a ? a.textContent : null;
  }, m[2]);
  await p.close();
  cardText.set(key, t === null ? null : norm(t));
  return cardText.get(key);
}

for (const [id, s] of borrowed) {
  const t = await textOf(s.href);
  ck(`2. ${id} -> ${s.href} resolves to a real card`, t !== null && t.length > 200, true);
  if (!t) continue;
  /* finger/ has no card of its own — it is one row inside the chest-tube technique list — so its
     sheet is hand-written on purpose and only the LINK is asserted. Everything else must match. */
  if (!s.from.startsWith('No card')) {
    const missing = s.rows.map(r => norm(r.doText)).filter(a => a.length > 25 && !same(t, a));
    ck(`2. ${id}: all ${s.rows.length} rows are the card's own words`, missing.length, 0);
    if (missing.length) console.log('       first miss: ' + JSON.stringify(missing[0].slice(0, 90)));
    /* The WHY tier has to travel too — dropping it would quietly turn a two-tier row into a
       one-tier one and the check above would still be green. */
    const whys = s.rows.filter(r => r.whyText).map(r => norm(r.whyText));
    const lostWhy = whys.filter(w => w.length > 25 && !same(t, w));
    ck(`2. ${id}: and its reasoning came with them`, lostWhy.length, 0);
  }
}

/* The three sections this whole mechanism was built for. Named explicitly, because "some rows
   matched" is not the claim — the claim is that these three stopped being duplicated. */
console.log('\n--- 2b. the three that were duplicated');
for (const [id, want] of [['cardiac', 'Finger first'], ['clam', 'Mirror the incision on the right'],
                          ['hilar', 'inferior pulmonary ligament']]) {
  const s = sheets[id];
  ck(`2b. ${id} still carries "${want}"`, !!s && s.rows.some(r => r.do.includes(want)), true);
  ck(`2b. ${id} takes it from a card rather than a local copy`, !!s && /#c\d+$/.test(s.href), true);
}

/* ---- 3. the glyph is the card's ---- */
console.log('\n--- 3. same procedure, same drawing');
/* The engine shows one step at a time, so the rows that open a sheet only exist while their step
   is on screen. Walk the sequence and collect them as they appear — reading the glyphs off the
   DECIDE screen finds none at all, and "nothing differed" would have looked like a pass. */
const tcaGlyphs = {};
const harvest = async () => Object.assign(tcaGlyphs, await pg.evaluate(() => {
  const out = {};
  document.querySelectorAll('[data-sheet]').forEach(btn => {
    const svg = btn.querySelector('svg');
    out[btn.getAttribute('data-sheet')] = svg ? svg.innerHTML.replace(/\s+/g, ' ').trim() : '';
  });
  return out;
}));
await pg.click('[data-go="proceed"]'); await pg.waitForTimeout(180);
for (const d of ['organize', 'bleeding', 'airway', 'fnt', 'thor', 'heart', 'injured']) {
  await pg.click(`[data-step="${d}"]`); await pg.waitForTimeout(170);
  await harvest();
}
const procPg = await b.newPage({ viewport: { width: 390, height: 844 } });
await procPg.goto(BASE + '/procedures/?from=tca', { waitUntil: 'networkidle' });
await procPg.waitForTimeout(350);
const procGlyphs = await procPg.evaluate(() => {
  const out = {};
  document.querySelectorAll('.pglyph[data-proc]').forEach(el => {
    const svg = el.querySelector('svg');
    out[el.getAttribute('data-proc')] = svg ? svg.innerHTML.replace(/\s+/g, ' ').trim() : '';
  });
  return { map: out, cards: typeof PROC_ICONS === 'object' ? PROC_ICONS.cards() : {} };
});
await procPg.close();

/* WHICH SHEETS MUST CARRY A GLYPH IS DERIVED FROM THE LINK, not from a field the sheet sets.
   An earlier version looped over sheets that declared a card id, so deleting that field took the
   sheet out of the check as well as out of the drawing — a wrong glyph and no glyph both read as
   a pass. The href is content, not wiring: a sheet that opens a procedures card is in this loop
   whatever else it does or does not declare. */
const CARD_HREF = /\/procedures\/[^#]*#(c\d+)$/;
const onCards = Object.entries(sheets).filter(([, s]) => CARD_HREF.test(s.href));
ck('3. sheets that open a procedures card', onCards.length > 4, true);
let compared = 0;
for (const [id, s] of onCards) {
  const card = s.href.match(CARD_HREF)[1];
  const key = procGlyphs.cards[card];
  ck(`3. ${id} opens card ${card}, which the shared set maps to a glyph`, !!key, true);
  if (tcaGlyphs[id] !== undefined) {
    compared++;
    /* A glyph that fails to bind renders an empty box — which looks like a styling nit and is
       actually a missing landmark. */
    ck(`3. ${id}: the row draws something`, !!tcaGlyphs[id], true);
    ck(`3. ${id}: and it is the card's own drawing, byte for byte`,
       tcaGlyphs[id] === procGlyphs.map[key], true);
  }
}
ck('3. glyphs compared on screen, not just in config', compared > 3, true);

/* ---- 3b. shared BLOCKS between two static cards ({{SHARE:tool|id}}) ---- */
console.log("\n--- 3b. blocks shared between two cards");
/* The sibling mechanism: PROC moves rows into a page that renders them, SHARE moves markup
   between two static cards. Asserted the same way and for the same reason — compare the
   RENDERED text on both pages, rather than trusting that both went through the build. */
const SHARED = [
  { id: "anaphylaxis-crm", owner: "/codes/", borrower: "/peds/",
    must: ["This is anaphylaxis", "everything else is an adjunct"] },
  { id: "cart-legend-intro", owner: "/codes/", borrower: "/ob-neonatal/",
    must: ["Every drawer has a color and a shape"] },
  { id: "cart-legend-shape", owner: "/codes/", borrower: "/ob-neonatal/",
    must: ["SHAPE = DRAWER"] },
  { id: "case-log-phi-note", owner: "/codes/", borrower: "/ob-neonatal/",
    must: ["Times and events only", "no patient identifiers"] },
];
const pageText = new Map();
async function textPage(path) {
  if (pageText.has(path)) return pageText.get(path);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(250);
  const t = norm(await p.evaluate(() => document.body.textContent || ""));
  await p.close();
  pageText.set(path, t);
  return t;
}
for (const sh of SHARED) {
  const own = await textPage(sh.owner), bor = await textPage(sh.borrower);
  for (const phrase of sh.must) {
    ck(`3b. ${sh.id}: "${phrase.slice(0, 34)}" is on ${sh.owner}`, same(own, phrase), true);
    /* The borrower must SHOW it. A token that failed to resolve is a build failure, but a
       token pointing at the wrong block resolves fine and puts the wrong words on a clinical
       card — that happened once already: the first attempt marked the post-arrest block and
       would have put post-arrest framing on the pediatric anaphylaxis card. */
    ck(`3b. ${sh.id}: and reached ${sh.borrower}`, same(bor, phrase), true);
  }
}
/* PHI note aside, these are clinical words on two cards. If the borrower ALSO still carries a
   hand-typed copy, the mechanism has been added without the duplication being removed. */
{
  const src = await (await fetch(BASE + "/peds/")).text();
  ck("3b. peds/ has no second hand-typed copy of the anaphylaxis framing",
     (src.match(/This is anaphylaxis/g) || []).length, 1);
}

/* ---- 4. a section name that does not resolve must FAIL the build ---- */
console.log('\n--- 4. it fails loudly, or it is not a guard');
const probe = '_transclusion_probe';
const out = mkdtempSync(join(tmpdir(), 'lrh-probe-'));
function build(body) {
  mkdirSync(probe, { recursive: true });
  writeFileSync(join(probe, 'index.html'),
    '<!DOCTYPE html><html lang="en"><head><title>probe</title></head><body><script>var X=' + body + ';<\/script></body></html>');
  const r = spawnSync(process.execPath, ['build.mjs'], { encoding: 'utf8', env: { ...process.env, BUILD_OUT: out } });
  rmSync(probe, { recursive: true, force: true });
  return { code: r.status, err: (r.stderr || '') + (r.stdout || '') };
}
try {
  const good = build('{{PROC:procedures#c02|CLOSE THE HEART — PICK THE FASTEST THING THAT HOLDS}}');
  ck('4. a section that exists builds', good.code, 0);

  const badSection = build('{{PROC:procedures#c02|A SECTION NOBODY WROTE}}');
  ck('4. a renamed section fails the build', badSection.code !== 0, true);
  ck('4. and the error names the sections that do exist',
     /CLOSE THE HEART/.test(badSection.err), true);

  const badCard = build('{{PROC:procedures#c99|SEQUENCE — STEP BY STEP}}');
  ck('4. a card that does not exist fails the build', badCard.code !== 0, true);

  const badTool = build('{{PROC:nosuchtool#c02|SEQUENCE — STEP BY STEP}}');
  ck('4. a tool that does not exist fails the build', badTool.code !== 0, true);
} finally {
  rmSync(probe, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
}

ck('5. no page or console errors across the whole run', errs.length, 0);

await pg.close();
await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
