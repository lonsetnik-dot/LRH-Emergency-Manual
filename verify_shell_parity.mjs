/* verify_shell_parity.mjs — the case shell exists in two files; keep them one.
 *
 *   design-system-live.css   → the six live engines (arrest, tca, airway,
 *                              neonatal, pph, dystocia)
 *   design-system-shell.css  → card tools that also need design-system.css's
 *                              card vocabulary (peds/ today)
 *
 * The split exists because the two full sheets set conflicting `body` rules and
 * cannot be injected into the same page (design-system-live.css says so in its
 * own header). The cost of the split is drift: someone fixes the bar in one
 * file, the other tool keeps the old bar, and the clinician is back to two
 * chromes — the exact problem SHELL.md exists to prevent.
 *
 * So this suite asserts the shell block is BYTE-IDENTICAL in both files. It
 * needs no browser and no server; run it anywhere:
 *
 *     node verify_shell_parity.mjs
 *
 * Same contract as labels/ vs peds/ for the Broselow band table ("copied
 * verbatim — if one changes, change both"), except machine-checked.
 */

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ck = (name, got, want) => {
  const ok = String(got) === String(want);
  (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + (ok ? '' : '  want=' + want));
};
const ok = (name, cond, detail) => ck(name, cond ? true : (detail || false), true);

const START = '/* ===== case shell (SHELL.md) =====';
/* The block ends where the live sheet's non-shell tail begins. Both files carry
   the shell's own @media print rule as the last shell thing in them. */
const END_MARK = '.shelltl,.shelltoast,.sheetwrap{display:none !important}\n}';

function shellBlock(file) {
  const css = readFileSync(file, 'utf8');
  const i = css.indexOf(START);
  if (i < 0) return { err: 'no case-shell block found in ' + file };
  const j = css.indexOf(END_MARK, i);
  if (j < 0) return { err: 'no shell print rule found in ' + file };
  return { text: css.slice(i, j + END_MARK.length) };
}

const live = shellBlock('design-system-live.css');
const shell = shellBlock('design-system-shell.css');
ok('design-system-live.css carries a case-shell block', !live.err, live.err);
ok('design-system-shell.css carries a case-shell block', !shell.err, shell.err);
if (live.err || shell.err) { console.log('\n=== ' + pass + ' passed, ' + (fail || 1) + ' failed ==='); process.exit(1); }

/* The whole point. */
if (live.text === shell.text) {
  ck('shell block is byte-identical in both sheets', 'identical', 'identical');
} else {
  const a = live.text.split('\n'), b = shell.text.split('\n');
  fail++;
  console.log('FAIL shell block is byte-identical in both sheets  got=DIFFERENT  want=identical');
  console.log('     live=' + a.length + ' lines, shell=' + b.length + ' lines');
  const n = Math.max(a.length, b.length);
  let shown = 0;
  for (let i = 0; i < n && shown < 8; i++) {
    if (a[i] !== b[i]) {
      console.log('     line ' + (i + 1) + ':');
      console.log('       live : ' + (a[i] === undefined ? '(missing)' : a[i].slice(0, 120)));
      console.log('       shell: ' + (b[i] === undefined ? '(missing)' : b[i].slice(0, 120)));
      shown++;
    }
  }
  console.log('     → the shell is ONE design. Copy the changed block from the file you edited into the other.');
}

/* Guard the split's other half: the shell's font shorthands name --sans/--mono,
   which design-system.css does NOT define. A card tool injecting only
   @design-system + @design-system-shell must still get them, or every shell
   `font:` shorthand is invalid and silently drops. */
const shellCss = readFileSync('design-system-shell.css', 'utf8');
ok('shell sheet defines --sans (card tools have no other source)', /--sans:/.test(shellCss));
ok('shell sheet defines --mono (card tools have no other source)', /--mono:/.test(shellCss));
/* The primitives the shell markup leans on: live defines them outside its shell
   block, design-system.css only ever scopes .ghost as `.hdr .ghost`. */
for (const cls of ['.card{', '.btn{', '.ghost{', '.inp{']) {
  ok('shell sheet defines the ' + cls.replace('{', '') + ' primitive', shellCss.includes(cls));
}

/* Consumers must not hand-copy shell CSS — that is what this file prevents. */
const consumers = ['peds/index.html'];
for (const f of consumers) {
  const html = readFileSync(f, 'utf8');
  ok(f + ' injects the shell by marker, not by hand-copy', html.includes('/* @design-system-shell */'));
  const style = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
  ok(f + ' does not hand-copy .shellbar geometry', !/\.shellbar\s*\{[^}]*height:\s*56px/.test(style));
}

/* build.mjs must actually substitute the marker, and must fail the build if one
   is left behind (the same protection the other markers have). */
const build = readFileSync('build.mjs', 'utf8');
ok('build.mjs injects design-system-shell.css', /design-system-shell\.css/.test(build) && /MARKER_SHELL/.test(build));
ok('build.mjs fails on a leftover shell marker', /includes\(MARKER_SHELL\)/.test(build));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
