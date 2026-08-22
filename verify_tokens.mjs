#!/usr/bin/env node
/* ===========================================================================
   verify_tokens.mjs — the token layer holds.

   DESIGN.md §1 and §3: colour, radius and spacing come from named tokens, and
   no authored page-local CSS carries a raw literal. That is the Phase 0
   ratchet, and the page-local half of it lands with the rest of the migration
   suites — gated, because 2,540 lines of page-local CSS full of literals is
   the thing being removed, not a regression to report 2,540 times.

   WHAT IS ASSERTED TODAY:

     1. The theme bridge agrees with the media query.

        design-system.css declares the light palette twice: once in
        @media (prefers-color-scheme: light), which is the device's answer, and
        once in body[data-theme="light"] (§8a), which is the stored preference
        theme-boot.js applies before paint. CSS has no way to write a
        declaration list once and adopt it under two triggers, so the second is
        a copy — and golden rule 12 says a copy that must exist gets a
        mechanism rather than a promise. This is the mechanism.

        A drift here is not cosmetic: the two blocks are what a clinician sees
        depending on whether they touched the LIGHT/DARK control, so a token
        that moved in one and not the other means the same page renders two
        different ways for two people standing in the same bay.

        Both blocks are deleted together in Phase 5b, when theme selection
        becomes the device's alone. This check goes with them.

     2. Every token the light blocks override also exists in :root.

        DESIGN.md §1: "No token is defined ONLY in the light block — every
        token has a :root definition, so a token can never resolve to nothing."
        A light-only token renders as an empty string in dark, which is the
        default palette, which is most of the time.

     Run:  node verify_tokens.mjs        (no server needed)
   =========================================================================== */

import { readFileSync } from 'node:fs';

const css = readFileSync('design-system.css', 'utf8');
let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  got=${got}  want=${want}`));
};

/* Read a declaration list by its opening selector, brace-counted rather than
   regexed to the first '}', because these blocks contain none but a nested
   block would silently truncate the read and every missing token would then
   report as agreement. */
function block(css, openerRe) {
  const m = openerRe.exec(css);
  if (!m) return null;
  let i = css.indexOf('{', m.index), d = 0, start = i;
  for (; i < css.length; i++) {
    if (css[i] === '{') d++;
    else if (css[i] === '}' && --d === 0) return css.slice(start + 1, i);
  }
  return null;
}
const tokens = (b) => {
  const out = {};
  if (b == null) return out;
  for (const m of b.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
};

const media  = block(css, /@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*/g);
const bridge = block(css, /\nbody\[data-theme="light"\]\s*/g);
const root   = block(css, /(^|\n):root \{/g);
const dark   = block(css, /\nbody\[data-theme="dark"\]\s*/g);

console.log('--- 1. the theme bridge agrees with the media query ---');
ck('the prefers-color-scheme: light block exists', media !== null, true);
ck('the body[data-theme="light"] bridge exists', bridge !== null, true);

const M = tokens(media), B = tokens(bridge), R = tokens(root), D = tokens(dark);
ck('the media query declares tokens', Object.keys(M).length > 20, true);

const onlyMedia  = Object.keys(M).filter(k => !(k in B));
const onlyBridge = Object.keys(B).filter(k => !(k in M));
const differing  = Object.keys(M).filter(k => k in B && M[k] !== B[k]).map(k => `${k}: ${M[k]} vs ${B[k]}`);
ck('every token in the media query is in the bridge', onlyMedia.join(' ') || 'none', 'none');
ck('the bridge adds no token the media query lacks', onlyBridge.join(' ') || 'none', 'none');
ck('and every shared token has the same value', differing.join(' | ') || 'none', 'none');

console.log('\n--- 2. no token is defined only in a light block ---');
const lightOnly = [...new Set([...Object.keys(M), ...Object.keys(B)])].filter(k => !(k in R));
ck('every light token has a :root definition', lightOnly.join(' ') || 'none', 'none');

console.log('\n--- 3. the dark bridge restores what the light one overrides ---');
/* body[data-theme="dark"] exists so a stored DARK choice beats a light device.
   It only needs the tokens the light blocks touch — but it needs ALL of them,
   or that one configuration silently keeps a light value on a dark page. */
ck('the body[data-theme="dark"] bridge exists', dark !== null, true);
const missingDark = Object.keys(M).filter(k => !(k in D));
ck('it restores every token the light blocks override', missingDark.join(' ') || 'none', 'none');
const wrongDark = Object.keys(D).filter(k => k in R && D[k] !== R[k]).map(k => `${k}: ${D[k]} vs ${R[k]}`);
ck('and each one matches :root exactly', wrongDark.join(' | ') || 'none', 'none');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
