/* gen_site_config.mjs — write a blank site.config.json from the manifest.
 *
 *     node gen_site_config.mjs            # refuses to clobber an existing file
 *     node gen_site_config.mjs --force    # overwrite (you will lose answers)
 *
 * Every key in localization.manifest.mjs gets an entry set to null, which the
 * build reads as "unanswered" and renders as a loud placeholder. Running this
 * after adding a manifest field top-ups the config without touching answers
 * that already exist — that is the normal use.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { FIELDS, SECTIONS, isAnswered } from './localization.manifest.mjs';

const OUT = 'site.config.json';
const force = process.argv.includes('--force');

function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

let existing = {};
if (existsSync(OUT) && !force) {
  existing = JSON.parse(readFileSync(OUT, 'utf8'));
}

const out = {
  _readme: [
    'This is the answer sheet for your fork. Every key here is a question in',
    'ONBOARDING.md — the question text, why it matters, and who at your hospital',
    'knows the answer all live there, keyed by the same dot path.',
    'null means UNANSWERED: the build renders a loud placeholder on screen and',
    'verify_localization.mjs reports it. false and 0 are real answers.',
    'Never copy another hospital\'s answers into this file without validating them.',
  ],
  _generatedFrom: 'localization.manifest.mjs',
};

let kept = 0;
for (const f of FIELDS) {
  const prior = getPath(existing, f.key);
  const keep = prior !== undefined;
  if (keep && isAnswered(prior)) kept++;
  setPath(out, f.key, keep ? prior : null);
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

const total = FIELDS.length;
console.log(`${OUT}: ${total} keys written, ${kept} existing answers preserved.`);
if (!kept) {
  console.log('All keys are unanswered. Start with ONBOARDING.md section A.');
  console.log('Sections:', SECTIONS.map(s => s.id).join(' '));
}
