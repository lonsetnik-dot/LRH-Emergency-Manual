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
/* The case shell (SHELL.md) for CARD tools — the same bar/weight ribbon/menus
   the live engines get from design-system-live.css, mirrored for pages that
   must also carry design-system.css's card vocabulary (the two full sheets
   cannot coexist; see design-system-shell.css's header).
   verify_shell_parity.mjs asserts the two copies stay byte-identical. */
const CSS_SHELL = readFileSync('design-system-shell.css', 'utf8').trim();
const MARKER_SHELL = '/* @design-system-shell */';
const INV = readFileSync('inventory.js', 'utf8').trim();
const MARKER_INV = '/* @inventory */';
/* The equipment icon set, shared by labels/ (cart drawer labels) and vems/ (the
   simulation card deck) so a VEMS card and the drawer it comes from carry the
   same glyph — see issue #131 and the header of equipment-icons.js. */
const ICONS = readFileSync('equipment-icons.js', 'utf8').trim();
const MARKER_ICONS = '/* @icons */';
/* The PROCEDURE icon set — anatomy + one action, a different system from the
   equipment glyphs above (which draw objects). Shared so a card, a poster and
   a label show the same drawing of the same procedure; see design/ICONOGRAPHY.md
   and the header of procedure-icons.js. */
const PROCICONS = readFileSync('procedure-icons.js', 'utf8').trim();
const MARKER_PROCICONS = '/* @proc-icons */';
/* Shared runtime behavior for the case shell (SHELL.md) — today, bringing the
   operating card back into view when an action advances the protocol. Injected
   like the sheets above so all six engines share one implementation. */
const SHELLJS = readFileSync('case-shell.js', 'utf8').trim();
const MARKER_SHELLJS = '/* @shell-js */';
/* The upstream guideline registry, shared by sources/ (the freshness page) and
   read outside the browser by check_guidelines.mjs — see GUIDELINE-WATCH.md. */
const GDL = readFileSync('guidelines.js', 'utf8').trim();
const MARKER_GDL = '/* @guidelines */';
const SW_TEMPLATE = readFileSync('sw-template.js', 'utf8');
const SW_REGISTER = readFileSync('sw-register.js', 'utf8').trim();
/* The output directory, overridable so a suite can build a throwaway copy
   without touching the dist/ the rest of the run is being served from. */
const OUT = process.env.BUILD_OUT || 'dist';

/* ---- Transclusion: {{PROC:<tool>#<cNN>|<SECTION>}} -------------------------
   A tool that walks somebody through a procedure it already has a card for must
   not re-type that card. The manual had two copies of CLOSE THE HEART, CLAMSHELL
   EXTENSION and HILAR TWIST — both written the same day, one in procedures/ card
   02 and one hand-typed into tca/ — which is exactly the drift the shared icon
   sets and inventory.js exist to prevent, in prose instead of pictures.

   So a live engine names the section it needs and gets the card's own rows:

       l: {{PROC:procedures#c02|CLOSE THE HEART — PICK THE FASTEST THING THAT HOLDS}}

   substitutes to a JSON array of {do, why} — the two tiers of the checklist row
   (DESIGN-SYSTEM.md §6b) — so the consuming page renders them in its own visual
   language while the WORDS have exactly one home. Editing the card moves the
   engine on the next build; there is no second place to remember.

   Live markup does NOT travel. A row's tap-to-log button writes into the CARD's
   case timeline, and a cross-card link is relative to the card's folder — both
   are wrong once the row is somewhere else. They are dropped here rather than
   carried, which is why every transclusion is paired with a link to the full
   card on the consuming screen: what this mechanism moves is the text.

   It fails the build the way {{SITE.*}} does — a renamed section is a silent
   content loss otherwise, and the error names the headings that do exist. */
const PROC_RE = /\{\{PROC:([a-z][a-z0-9-]*)#(c\d+)\|([^}|]+)\}\}/g;
const ENT = { mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', amp: '&', lt: '<', gt: '>', nbsp: ' ',
  deg: '°', plusmn: '±', ge: '≥', le: '≤', times: '×',
  middot: '·', rarr: '→', hellip: '…', asymp: '≈',
  sup2: '²', sup3: '³', frac12: '½', mu: 'µ', quot: '"' };
const decode = s => s.replace(/&([a-z]+[0-9]*);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const headKey = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().toUpperCase();

/* Matching close tag by depth, not the first one — several rows nest the tag
   they are being scanned for (a <span> inside a row's <span>), and stopping at
   the first close silently truncates the row. */
function closeAt(html, tag, from) {
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while (depth > 0 && (m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return m.index; }
  return -1;
}

/* Row text, with the ONE bit of markup that carries meaning kept: <b> is the
   ACTION tier, and dropping it would flatten the two tiers back into one. */
function rowText(html) {
  return html
    .replace(/<button\b[\s\S]*?<\/button>/gi, " ")      // logs into the CARD’s own case timeline
    .replace(/<b\b[^>]*>/gi, "\u0001").replace(/<\/b>/gi, "\u0002")
    .replace(/<br\b[^>]*>/gi, "\u0003")
    .replace(/<[^>]+>/g, " ")                           // every other tag becomes a gap
    .replace(/\s+/g, " ")
    /* Turning tags into spaces leaves a space wherever a tag hugged punctuation
       — "…now </span>." and "(<b>x</b>)". Close them back up, or every
       transcluded row reads as if it were typed by somebody in a hurry. */
    .replace(/\s+([.,;:!?%)’”])/g, "$1")
    .replace(/([(“])\s+/g, "$1")
    .replace(/\u0001\s*/g, "<b>").replace(/\s*\u0002/g, "</b>").replace(/\u0003/g, "<br>")
    .replace(/<b>\s*<\/b>/g, "")
    .trim();
}

const transcluded = [];
const procCache = new Map();
function procSections(tool, card, file) {
  const key = tool + '#' + card;
  if (procCache.has(key)) return procCache.get(key);
  let src;
  try { src = readFileSync(join(tool, 'index.html'), 'utf8'); }
  catch { console.error(`build FAILED: ${file} transcludes ${key} but ${tool}/index.html does not exist`); process.exit(1); }
  const at = src.indexOf(`<article id="${card}"`);
  if (at < 0) { console.error(`build FAILED: ${file} transcludes ${key} but ${tool}/index.html has no <article id="${card}">`); process.exit(1); }
  const next = src.indexOf('<article id="', at + 1);
  const art = src.slice(at, next < 0 ? src.length : next);

  const out = new Map();
  const D = /<details\b[^>]*>/gi;
  let d;
  while ((d = D.exec(art))) {
    const end = closeAt(art, 'details', d.index + d[0].length);
    if (end < 0) continue;
    const inner = art.slice(d.index + d[0].length, end);
    const sm = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    if (!sm) continue;
    /* Two spellings of a heading, because two tools spell it differently:
       procedures/ puts the text straight in the <summary>, ob-neonatal/ wraps
       it in a <span> with a second <span> of right-aligned meta beside it.
       Both are registered so a citation reads the same either way. */
    const first = sm[1].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i);
    const names = new Set([headKey(sm[1])]);
    if (first) names.add(headKey(first[1]));

    const rows = [];
    const L = /<li\b[^>]*>/gi;
    let li;
    while ((li = L.exec(inner))) {
      const lend = closeAt(inner, 'li', li.index + li[0].length);
      if (lend < 0) continue;
      let body = inner.slice(li.index + li[0].length, lend);
      L.lastIndex = lend;
      const wm = body.match(/<i class="t-why"[^>]*>([\s\S]*?)<\/i>/i);
      if (wm) body = body.replace(wm[0], '');
      const doText = rowText(body);
      if (!doText) continue;
      rows.push({ do: doText, why: wm ? rowText(wm[1]) : '' });
    }
    for (const n of names) if (!out.has(n)) out.set(n, rows);
  }
  procCache.set(key, out);
  return out;
}

function applyProc(text, file) {
  return text.replace(PROC_RE, (m, tool, card, heading) => {
    const sections = procSections(tool, card, file);
    const want = headKey(heading);
    const rows = sections.get(want);
    if (!rows) {
      console.error(`build FAILED: ${file} transcludes ${tool}#${card} section "${heading.trim()}", which does not exist.`);
      console.error(`  sections in ${tool}/index.html #${card}: ${[...sections.keys()].map(s => JSON.stringify(s)).join(', ')}`);
      process.exit(1);
    }
    if (!rows.length) {
      console.error(`build FAILED: ${file} transcludes ${tool}#${card} section "${heading.trim()}" but it has no rows`);
      process.exit(1);
    }
    /* Recorded so tools_dupscan.mjs can tell BORROWED text from RETYPED text. Without
       it, every transclusion reads as a duplicate and the finder for golden rule 12
       would be loudest about the one mechanism that satisfies it. */
    for (const r of rows) transcluded.push({ from: `${tool}#${card}`, into: file, do: r.do, why: r.why });
    // Emitted into a <script>: escape < so a row can never close the element.
    return JSON.stringify(rows).replace(/</g, '\\u003c');
  });
}

/* ---- Shared blocks: {{SHARE:<tool>|<id>}} ---------------------------------
   The sibling of {{PROC:…}} above, for the other shape the problem takes. PROC
   moves checklist ROWS into a page that renders them itself, which is what a
   live engine needs. This moves a block of MARKUP between two static cards,
   which is what two cards covering the same emergency need — the anaphylaxis
   NAME / CLAIM / AIM framing was byte-identical on the adult card and the
   pediatric one, and the cart legend on two tools that carry a cart.

   The owning page marks the element `data-share="<id>"`; the borrowing page
   writes `{{SHARE:codes|anaphylaxis-crm}}` and gets its inner HTML.

   LIVE MARKUP IS REFUSED, not stripped. A checkbox key, an element id, a
   tap-to-log button or a relative link is *wrong* once it is on another page —
   ids collide, `#c12` points at a card that may not exist there, and a log
   button writes into the wrong tool's timeline. PROC drops them silently
   because it is rebuilding rows from text; here the markup travels verbatim, so
   the only safe answer is to fail and make somebody move the hook out of the
   shared block deliberately. */
const SHARE_RE = /\{\{SHARE:([a-z][a-z0-9-]*)\|([A-Za-z0-9_-]+)\}\}/g;
const LIVE_IN_SHARE = /\sdata-k=|<button|\sid=|\sdata-logevent|href="[.#]/;
const shareCache = new Map();
function shareBlocks(tool, file) {
  if (shareCache.has(tool)) return shareCache.get(tool);
  let src;
  try { src = readFileSync(join(tool, 'index.html'), 'utf8'); }
  catch { console.error(`build FAILED: ${file} shares from ${tool}, which does not exist`); process.exit(1); }
  const out = new Map();
  const RE = /<([a-z]+)\b[^>]*\sdata-share="([A-Za-z0-9_-]+)"[^>]*>/gi;
  let m;
  while ((m = RE.exec(src))) {
    const end = closeAt(src, m[1], m.index + m[0].length);
    if (end < 0) continue;
    out.set(m[2], src.slice(m.index + m[0].length, end));
  }
  shareCache.set(tool, out);
  return out;
}
function applyShare(text, file) {
  return text.replace(SHARE_RE, (m, tool, id) => {
    const blocks = shareBlocks(tool, file);
    const html = blocks.get(id);
    if (html === undefined) {
      console.error(`build FAILED: ${file} wants ${tool}'s shared block "${id}", which does not exist.`);
      console.error(`  data-share ids in ${tool}/index.html: ${[...blocks.keys()].join(', ') || '(none)'}`);
      process.exit(1);
    }
    if (LIVE_IN_SHARE.test(html)) {
      console.error(`build FAILED: ${tool}'s shared block "${id}" carries live markup, which cannot travel.`);
      console.error('  A data-k, an id, a button or a relative link belongs to the page it is on.');
      process.exit(1);
    }
    transcluded.push({ from: `${tool}@${id}`, into: file, do: rowText(html), why: '' });
    return html;
  });
}

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
// cairn/ is the cairnready.org outreach site and dist-demo/ is its build
// output (demo-build.mjs) — both their own Netlify site, never part of the
// manual or its offline precache. design/ holds the design-reference package
// (prototypes + specs) — its .dc.html files are references to build FROM, not
// pages to ship, and the offline shell precaches every page it finds, so
// shipping ~90 kB of prototype would cost every clinician's cache for
// something no clinician opens. Read them from the repo, not the site.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-demo', '.github', 'cairn', 'design']);
const SKIP_ROOT_FILES = new Set([
  'design-system.css', 'design-system-live.css', 'inventory.js', 'equipment-icons.js', 'procedure-icons.js', 'guidelines.js', 'case-shell.js', 'build.mjs', 'run-tests.sh', 'netlify.toml',
  'package.json', 'package-lock.json', 'shot.mjs', '.gitignore',
  'sw-template.js', 'sw-register.js',   // build inputs — emitted as dist/sw.js / inlined
  'site.config.json',                   // build input — substituted into every page
  '.transclusion-manifest.json',     // build OUTPUT for dev tooling — never published
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
      writeFileSync(d, applySite(applyShare(applyProc(injectSW(html.split(MARKER).join(CSS).split(MARKER_LIVE).join(CSS_LIVE).split(MARKER_SHELL).join(CSS_SHELL).split(MARKER_INV).join(INV).split(MARKER_ICONS).join(ICONS).split(MARKER_PROCICONS).join(PROCICONS).split(MARKER_SHELLJS).join(SHELLJS).split(MARKER_GDL).join(GDL)), s), s), s));
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
    else if (name.endsWith('.html') && (readFileSync(p, 'utf8').includes(MARKER) || readFileSync(p, 'utf8').includes(MARKER_LIVE) || readFileSync(p, 'utf8').includes(MARKER_INV) || readFileSync(p, 'utf8').includes(MARKER_ICONS) || readFileSync(p, 'utf8').includes(MARKER_SHELL) || readFileSync(p, 'utf8').includes(MARKER_PROCICONS) || readFileSync(p, 'utf8').includes(MARKER_SHELLJS) || readFileSync(p, 'utf8').includes(MARKER_GDL))) {
      console.error('!! un-injected marker left in', p); leftover++;
    }
    else if (/\.(html|webmanifest)$/.test(name) && /\{\{(SITE\.|PROC:|SHARE:)/.test(readFileSync(p, 'utf8'))) {
      console.error('!! un-substituted {{SITE.*}} / {{PROC:…}} / {{SHARE:…}} token left in', p); leftover++;
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

/* Not written into ${OUT}: the manifest is dev tooling, and anything inside dist/ is
   published AND precached by the offline worker. */
writeFileSync(".transclusion-manifest.json", JSON.stringify(transcluded, null, 1));

console.log(`built ${OUT}/  (design-system.css inlined where marked)`);
console.log(`offline shell: ${sw.count} assets precached as ${sw.cache}`);
