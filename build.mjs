/* build.mjs — LRH Emergency Manual build step.
 *
 * Copies the site into dist/ and inlines design-system.css into every tool that
 * carries the marker  (slash-star) @design-system (star-slash)  inside its
 * <style>. The published dist/ files are therefore fully self-contained and
 * work offline (CLAUDE.md rule 1) — the shared CSS is edited once, in
 * design-system.css, and injected here at build time.
 *
 * Tools that do NOT yet carry the marker are copied verbatim (still
 * self-contained via their own inline CSS), so migration is incremental and
 * safe. Run:  node build.mjs   →  outputs dist/
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync('design-system.css', 'utf8').trim();
const MARKER = '/* @design-system */';
const INV = readFileSync('inventory.js', 'utf8').trim();
const MARKER_INV = '/* @inventory */';
const OUT = 'dist';

// Not part of the deployed site (dev tooling, docs, build inputs, VCS).
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.github']);
const SKIP_ROOT_FILES = new Set([
  'design-system.css', 'inventory.js', 'build.mjs', 'run-tests.sh', 'netlify.toml',
  'package.json', 'package-lock.json', 'shot.mjs', '.gitignore',
]);
const SKIP_ROOT_EXT = ['.mjs', '.py', '.md'];  // verify scripts, generators, docs

function skipRoot(name) {
  return SKIP_ROOT_FILES.has(name) || SKIP_ROOT_EXT.some(e => name.endsWith(e));
}

function walk(src, dst, atRoot) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_DIRS.has(name)) continue;
    if (atRoot && skipRoot(name)) continue;
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) walk(s, d, false);
    else if (name.endsWith('.html')) {
      const html = readFileSync(s, 'utf8');
      writeFileSync(d, html.split(MARKER).join(CSS).split(MARKER_INV).join(INV));
    } else copyFileSync(s, d);
  }
}

rmSync(OUT, { recursive: true, force: true });
walk('.', OUT, true);

// Sanity: fail loudly if any published .html still contains an un-injected marker.
let leftover = 0;
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (name.endsWith('.html') && (readFileSync(p, 'utf8').includes(MARKER) || readFileSync(p, 'utf8').includes(MARKER_INV))) {
      console.error('!! un-injected marker left in', p); leftover++;
    }
  }
})(OUT);
if (leftover) { console.error(`build FAILED: ${leftover} file(s) with un-injected marker`); process.exit(1); }
console.log(`built ${OUT}/  (design-system.css inlined where marked)`);
