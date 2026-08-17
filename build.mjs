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
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const CSS = readFileSync('design-system.css', 'utf8').trim();
const MARKER = '/* @design-system */';
const CSS_LIVE = readFileSync('design-system-live.css', 'utf8').trim();
const MARKER_LIVE = '/* @design-system-live */';
const INV = readFileSync('inventory.js', 'utf8').trim();
const MARKER_INV = '/* @inventory */';
/* The equipment icon set, shared by labels/ (cart drawer labels) and vems/ (the
   simulation card deck) so a VEMS card and the drawer it comes from carry the
   same glyph — see issue #131 and the header of equipment-icons.js. */
const ICONS = readFileSync('equipment-icons.js', 'utf8').trim();
const MARKER_ICONS = '/* @icons */';
/* The upstream guideline registry, shared by sources/ (the freshness page) and
   read outside the browser by check_guidelines.mjs — see GUIDELINE-WATCH.md. */
const GDL = readFileSync('guidelines.js', 'utf8').trim();
const MARKER_GDL = '/* @guidelines */';
const SW_TEMPLATE = readFileSync('sw-template.js', 'utf8');
const SW_REGISTER = readFileSync('sw-register.js', 'utf8').trim();
const OUT = 'dist';

/* Site identity (site.config.json) — every {{SITE.key}} token in HTML (and the
   webmanifest) is replaced here at build time, AFTER the shared-file markers are
   injected, so tokens inside injected content substitute too. The generic
   (CairnReady) values are checked in; a hospital version edits that one file.
   A token with no matching key fails the build loudly — identity must never
   half-apply. See SITES.md. */
const SITE = JSON.parse(readFileSync('site.config.json', 'utf8'));
const TOKEN_RE = /\{\{SITE\.([A-Za-z0-9_]+)\}\}/g;
function applySite(text, file) {
  return text.replace(TOKEN_RE, (m, key) => {
    if (typeof SITE[key] !== 'string') {
      console.error(`build FAILED: ${file} uses ${m} but site.config.json has no string "${key}"`);
      process.exit(1);
    }
    return SITE[key];
  });
}

// Not part of the deployed site (dev tooling, docs, build inputs, VCS).
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.github']);
const SKIP_ROOT_FILES = new Set([
  'design-system.css', 'design-system-live.css', 'inventory.js', 'equipment-icons.js', 'guidelines.js', 'build.mjs', 'run-tests.sh', 'netlify.toml',
  'package.json', 'package-lock.json', 'shot.mjs', '.gitignore',
  'sw-template.js', 'sw-register.js',   // build inputs — emitted as dist/sw.js / inlined
  'site.config.json',                   // build input — substituted into every page
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
      writeFileSync(d, applySite(injectSW(html.split(MARKER).join(CSS).split(MARKER_LIVE).join(CSS_LIVE).split(MARKER_INV).join(INV).split(MARKER_ICONS).join(ICONS).split(MARKER_GDL).join(GDL)), s));
    } else if (name.endsWith('.webmanifest')) {
      writeFileSync(d, applySite(readFileSync(s, 'utf8'), s));
    } else copyFileSync(s, d);
  }
}

/* ---- Offline shell (issue #120) -------------------------------------------
   Every published page gets the registration snippet inlined before </body>,
   so no tool hand-maintains a copy and none can drift out of sync — the same
   reasoning as design-system.css and inventory.js above. The published HTML
   stays fully self-contained (CLAUDE.md rule 1); the only separate file is
   dist/sw.js, which a service worker must be by specification.

   ob-neonatal/ shipped its own worker before this existed. Its registration is
   rewritten to point at the root worker, and its sw.js is replaced with a stub
   that unregisters itself — see writeServiceWorker(). Simply deleting the old
   file would have been worse: a 404 makes the update check fail, leaving the
   retired worker installed and in charge of that scope forever. */
function injectSW(html) {
  // ob-neonatal registered 'sw.js' (its own, scoped worker) — retire that call.
  // Replace the WHOLE <script> element, not the if-block inside it: a
  // non-greedy match on the closing brace stops at the first `}` it meets,
  // which is the one in `.catch(function(){})`, leaving `); });\n}` dangling
  // and every page it touched throwing a SyntaxError. (Caught by
  // verify_offline.mjs check 7 — keep that check.)
  html = html.replace(
    /<script>\s*if \('serviceWorker' in navigator[\s\S]*?<\/script>/i,
    '<!-- per-tool service worker retired (issue #120): superseded by the root worker -->'
  );

  // Make the manual installable from any page. Skipped where a page already
  // declares its own manifest — ob-neonatal ships one deliberately so it can be
  // installed as its own home-screen app, and two manifest links would just
  // make the browser pick one arbitrarily.
  if (!/rel="manifest"/i.test(html) && /<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i,
      '<link rel="manifest" href="/manifest.webmanifest">\n' +
      '<link rel="apple-touch-icon" href="/icon.svg">\n</head>');
  }

  const tag = '<script>\n' + SW_REGISTER + '\n</script>\n';
  return html.includes('</body>')
    ? html.replace(/<\/body>/i, tag + '</body>')
    : html + tag;
}

function writeServiceWorker() {
  // Everything worth having in a dead zone: every page, plus the icons and
  // manifests that make the installed app render.
  const assets = [];
  (function scan(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { scan(p); continue; }
      if (/\.(html|svg|webmanifest|ico)$/.test(name)) {
        assets.push('/' + relative(OUT, p).split(sep).join('/'));
      }
    }
  })(OUT);
  // Directory URLs are what people actually navigate to (/codes/, not
  // /codes/index.html); cache both so either spelling works offline.
  const dirs = assets.filter(a => a.endsWith('/index.html')).map(a => a.replace(/index\.html$/, ''));
  const list = [...new Set([...dirs, ...assets])].sort();

  // Content-addressed cache name: any change to any cached byte changes this,
  // so a stale shell can never be shipped by forgetting to bump a version.
  const h = createHash('sha256');
  for (const url of list) {
    h.update(url);
    const f = url.endsWith('/') ? join(OUT, url, 'index.html') : join(OUT, url);
    try { h.update(readFileSync(f)); } catch { /* directory alias — hashed via its index.html */ }
  }
  const cache = 'lrh-manual-' + h.digest('hex').slice(0, 12);

  // Anchored to the assignments, not bare tokens: the header comment mentions
  // both placeholder names, and a plain string .replace() would substitute the
  // prose instead of the code (it replaces only the first match) — shipping a
  // worker with a literal __CACHE__ and no assets at all.
  let out = SW_TEMPLATE
    .replace(/^var CACHE = '__CACHE__';$/m, `var CACHE = '${cache}';`)
    .replace(/^var ASSETS = __ASSETS__;$/m, `var ASSETS = ${JSON.stringify(list, null, 2)};`);
  if (out.includes("'__CACHE__'") || out.includes('= __ASSETS__')) {
    console.error('build FAILED: sw-template.js placeholders did not substitute — did the assignment lines change?');
    process.exit(1);
  }
  writeFileSync(join(OUT, 'sw.js'), out);

  // Retire the old per-tool worker in place (see injectSW above).
  const obSW = join(OUT, 'ob-neonatal', 'sw.js');
  try {
    statSync(obSW);
    writeFileSync(obSW,
      '/* Retired (issue #120): the OB tool is now covered by the root worker at\n' +
      '   /sw.js, which precaches the whole manual. This stub exists so browsers\n' +
      '   that already registered the old worker hand over cleanly — deleting the\n' +
      '   file instead would 404 the update check and leave it installed forever. */\n' +
      "self.addEventListener('install', function(){ self.skipWaiting(); });\n" +
      "self.addEventListener('activate', function(e){\n" +
      '  e.waitUntil(caches.keys()\n' +
      "    .then(function(k){ return Promise.all(k.filter(function(n){ return n.indexOf('lrh-ob-') === 0; }).map(function(n){ return caches.delete(n); })); })\n" +
      '    .then(function(){ return self.registration.unregister(); })\n' +
      '    .then(function(){ return self.clients.claim(); }));\n' +
      '});\n');
  } catch { /* ob-neonatal/sw.js already gone — nothing to retire */ }

  return { cache, count: list.length };
}

rmSync(OUT, { recursive: true, force: true });
walk('.', OUT, true);
const sw = writeServiceWorker();

// Sanity: fail loudly if any published .html still contains an un-injected marker.
let leftover = 0;
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (name.endsWith('.html') && (readFileSync(p, 'utf8').includes(MARKER) || readFileSync(p, 'utf8').includes(MARKER_LIVE) || readFileSync(p, 'utf8').includes(MARKER_INV) || readFileSync(p, 'utf8').includes(MARKER_ICONS))) {
      console.error('!! un-injected marker left in', p); leftover++;
    }
    else if (/\.(html|webmanifest)$/.test(name) && /\{\{SITE\./.test(readFileSync(p, 'utf8'))) {
      console.error('!! un-substituted {{SITE.*}} token left in', p); leftover++;
    }
  }
})(OUT);
if (leftover) { console.error(`build FAILED: ${leftover} file(s) with un-injected marker`); process.exit(1); }

// Sanity: every published page must carry the offline registration. A page that
// misses it is a page that silently has no offline shell.
let unregistered = [];
(function scanSW(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scanSW(p);
    else if (name.endsWith('.html') && !readFileSync(p, 'utf8').includes("navigator.serviceWorker.register('/sw.js')")) {
      unregistered.push(p);
    }
  }
})(OUT);
if (unregistered.length) {
  console.error('build FAILED: page(s) without the offline registration:', unregistered.join(', '));
  process.exit(1);
}

console.log(`built ${OUT}/  (design-system.css inlined where marked)`);
console.log(`offline shell: ${sw.count} assets precached as ${sw.cache}`);
