/* build.mjs — {{site.hospitalShort}} Emergency Manual build step.
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
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { FIELDS, isAnswered, readPath } from './localization.manifest.mjs';

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
/* LOCAL()/LOCAL_HAS() — how a tool reads its own site's answers at runtime, and
   how it refuses to compute without them. See local-config.js. */
const LOCALCFG = readFileSync('local-config.js', 'utf8').trim();
const MARKER_LOCALCFG = '/* @localconfig */';
const SW_TEMPLATE = readFileSync('sw-template.js', 'utf8');
const SW_REGISTER = readFileSync('sw-register.js', 'utf8').trim();
const LOCALIZE_BANNER = readFileSync('localize-banner.js', 'utf8').trim();
const OUT = 'dist';

/* ---- Localization tokens --------------------------------------------------
   Site-specific values are written as {{dot.path}} in the source and resolved
   here from site.config.json, whose keys are declared in
   localization.manifest.mjs. An UNANSWERED value (null) does not fall back to
   anything - it renders the manifest's placeholder, which is deliberately loud
   (<<LIKE THIS>>), and is counted into the readiness report below.

   Why no default: a default is a value somebody else chose for your hospital,
   rendered in a font that looks exactly like a value you chose. That is the
   failure this whole system exists to prevent. Blank and shouting is safe;
   plausible and wrong is not.

   --config <file> builds against a different answer sheet - used by
   verify_localization.mjs to prove the same source tree renders both a fully
   localized site and a fully blank one. */
const CONFIG_FILE = (() => {
  const i = process.argv.indexOf('--config');
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : 'site.config.json';
})();
const ANSWERS = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {};

const TOKEN_RE = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
const tokenState = new Map();     // key -> {answered, text, uses}
const unknownTokens = new Set();

/* A list answer renders as a readable inline string; anything richer than that
   is read out of window.SITE_CONFIG by the tool's own JS rather than through a
   token, because a checklist of transfer centers is markup, not a word. */
function renderValue(v) {
  if (Array.isArray(v)) {
    return v.map(x => (typeof x === 'object' && x !== null
      ? [x.label, x.phoneDisplay].filter(Boolean).join(' \u00b7 ')
      : String(x))).join('; ');
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

for (const f of FIELDS) {
  const v = readPath(ANSWERS, f.key);
  const answered = isAnswered(v);
  tokenState.set(f.key, {
    answered,
    field: f,
    text: answered ? renderValue(v) : (f.placeholder === null ? '' : String(f.placeholder)),
    uses: 0,
  });
}

function substituteTokens(text) {
  return text.replace(TOKEN_RE, (whole, key) => {
    const st = tokenState.get(key);
    if (!st) { unknownTokens.add(key); return whole; }
    st.uses++;
    return st.text;
  });
}

/* The answers are also exposed to page JS, so a tool can branch on a structured
   answer (the transfer-center picker, the capability booleans) instead of only
   interpolating a string. Read-only by convention; nothing writes it back. */
function localizationPayload() {
  const missing = FIELDS.filter(f => !tokenState.get(f.key).answered);
  return {
    config: ANSWERS,
    missing: missing.map(f => ({ key: f.key, section: f.section, q: f.q, required: f.required })),
    counts: {
      total: FIELDS.length,
      answered: FIELDS.length - missing.length,
      missingGoLive: missing.filter(f => f.required === 'go-live').length,
      missingSim: missing.filter(f => f.required === 'sim').length,
    },
  };
}

// Not part of the deployed site (dev tooling, docs, build inputs, VCS).
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.github']);
const SKIP_ROOT_FILES = new Set([
  'design-system.css', 'design-system-live.css', 'inventory.js', 'equipment-icons.js', 'build.mjs', 'run-tests.sh', 'netlify.toml',
  'package.json', 'package-lock.json', 'shot.mjs', '.gitignore',
  'sw-template.js', 'sw-register.js',   // build inputs — emitted as dist/sw.js / inlined
  'localize-banner.js', 'local-config.js',   // build inputs — inlined into pages
  'site.config.json', 'site.config.lrh.json',  // answers, not content
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
      writeFileSync(d, substituteTokens(injectSW(
        html.split(MARKER).join(CSS).split(MARKER_LIVE).join(CSS_LIVE).split(MARKER_INV).join(INV).split(MARKER_ICONS).join(ICONS).split(MARKER_LOCALCFG).join(LOCALCFG))));
    }
    // Manifests and stray scripts carry the hospital name too — substitute, don't copy.
    else if (name.endsWith('.webmanifest') || name.endsWith('.js')) {
      writeFileSync(d, substituteTokens(readFileSync(s, 'utf8')));
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

  /* The localization payload and its banner ride in the same slot as the
     offline registration, for the same reason: one copy, built in, impossible
     for an individual tool to forget or to drift away from. On a fully
     answered site the banner script finds nothing missing and renders nothing,
     so this costs a fully localized fork a few hundred bytes and no pixels. */
  /* The answers must exist BEFORE any tool script runs — a SITE block that
     calls LOCAL() at parse time would otherwise read an undefined payload and
     silently behave as if nothing were localized, on a fully localized site.
     So the payload goes at the top of <head>; only the banner, which needs a
     <body> to attach to, rides at the end. */
  const payload = '<script>window.SITE_CONFIG=' + JSON.stringify(localizationPayload()) + ';</script>\n';
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => m + '\n' + payload)
    : payload + html;

  const tag = '<script>\n' + SW_REGISTER + '\n</script>\n'
    + '<script>\n' + LOCALIZE_BANNER + '\n</script>\n';
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
  const cache = 'edm-manual-' + h.digest('hex').slice(0, 12);

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
      "    .then(function(k){ return Promise.all(k.filter(function(n){ return n.indexOf('edm-ob-') === 0; }).map(function(n){ return caches.delete(n); })); })\n" +
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
    else if (name.endsWith('.html') && (readFileSync(p, 'utf8').includes(MARKER) || readFileSync(p, 'utf8').includes(MARKER_LIVE) || readFileSync(p, 'utf8').includes(MARKER_INV) || readFileSync(p, 'utf8').includes(MARKER_ICONS) || readFileSync(p, 'utf8').includes(MARKER_LOCALCFG))) {
      console.error('!! un-injected marker left in', p); leftover++;
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

/* ---- Localization report ---------------------------------------------------
   A build that quietly succeeds on a blank config would let a fork deploy a
   manual full of placeholders without anyone in the loop noticing. So the build
   says, every time, exactly how localized this site is - and it FAILS on a
   token nobody declared, because that is a typo that would otherwise ship
   literal braces to a bedside screen. */
if (unknownTokens.size) {
  console.error('build FAILED: undeclared localization token(s):', [...unknownTokens].join(', '));
  console.error('  Declare each in localization.manifest.mjs, then run: node gen_site_config.mjs');
  process.exit(1);
}

const used = [...tokenState.values()].filter(t => t.uses > 0);
const missingUsed = used.filter(t => !t.answered);
const pay = localizationPayload();
writeFileSync(join(OUT, '_localization-report.json'), JSON.stringify({
  config: CONFIG_FILE,
  counts: pay.counts,
  tokensUsedInSource: used.length,
  unansweredTokensRendered: missingUsed.length,
  missing: pay.missing,
}, null, 2) + '\n');

const pct = Math.round((pay.counts.answered / pay.counts.total) * 100);
console.log(`built ${OUT}/  (design-system.css inlined where marked)`);
console.log(`offline shell: ${sw.count} assets precached as ${sw.cache}`);
console.log(`localization (${CONFIG_FILE}): ${pay.counts.answered}/${pay.counts.total} answered (${pct}%)`
  + `, ${pay.counts.missingGoLive} required missing, ${missingUsed.length} placeholder(s) rendered on screen`);
if (pay.counts.missingGoLive) {
  console.log('  -> this build is NOT ready for clinical use. See ONBOARDING.md; every page carries the NOT LOCALIZED bar.');
}
