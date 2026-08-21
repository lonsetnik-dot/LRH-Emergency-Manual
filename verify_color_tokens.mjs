/* verify_color_tokens.mjs — the check that would have caught the invisible clocks.
 *
 * verify_accessibility.mjs check 7 parses the shared token pairs out of the CSS
 * that ships in the built landing page. It cannot see a colour an engine writes
 * at RUNTIME: `el.style.color = '#16324f'` is invisible to any static reader of
 * the stylesheet, and stays invisible until somebody opens the tool in the theme
 * it was not written for.
 *
 * The scar: seven resuscitation clocks — stroke, TXA, massive transfusion, two
 * status epilepticus, maternal arrest and front-of-neck airway — rendered navy
 * on navy at 1.11:1 in the default dark theme. The markup was correct
 * (color:var(--ink)); the engine overwrote it on first paint. Migrating codes/
 * onto the shared design system is what exposed five of them: its JS still wrote
 * light-theme hex after its card interiors went dark.
 *
 * So: no published page may assign a literal colour to .style.color at runtime.
 * A literal BACKGROUND is allowed only when the same statement also sets a
 * literal colour — that is the constant-pair pattern (the always-dark #wtbar,
 * the light tint panels), which reads correctly in both themes by construction.
 *
 *     node verify_color_tokens.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
const ok = (name, got, want) => {
  const good = got === want;
  good ? pass++ : fail++;
  console.log(`${good ? 'PASS' : 'FAIL'} ${name}${good ? '' : `  got=${got}  want=${want}`}`);
};

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'dist-demo', '.github', 'cairn', 'design'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html') || (name.endsWith('.js') && !name.startsWith('verify_'))) files.push(p);
  }
})('.');

const COLOR_WRITE = /(\w[\w.\[\]]*)\.style\.color\s*=\s*['"](#[0-9a-fA-F]{3,8})['"]/g;
const offenders = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const line of src.split('\n')) {
    COLOR_WRITE.lastIndex = 0;
    let m;
    while ((m = COLOR_WRITE.exec(line))) {
      const el = m[1];
      // Constant pair: this element also gets a literal background in the same
      // statement, so the two were authored together and read as one unit.
      const paired = new RegExp(String.raw`\b${el.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\.style\.background(?:Color)?\s*=\s*['"]#`).test(line);
      if (!paired) offenders.push(`${f.replace('./', '')}: ${el}.style.color='${m[2]}'`);
    }
  }
}

console.log(`scanned ${files.length} published source files\n`);
ok('no runtime colour write escapes the token system',
   offenders.slice(0, 6).join(' | '), '');
if (offenders.length > 6) console.log(`   ...and ${offenders.length - 6} more`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
