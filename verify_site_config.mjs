/* verify_site_config.mjs — the answer sheet, as the suites see it.
 *
 * Every verify_*.mjs that asserts a site-specific string imports from here
 * instead of re-typing this hospital's values a second time. That is the rule
 * in CLAUDE.md ("config-driven verification"), extended one step: it is not
 * enough for a suite to read the tool's SITE block, because on a template
 * branch the SITE block is empty by design. A suite has to know the difference
 * between "localized differently" and "not localized yet", and assert something
 * true in both cases.
 *
 *   cfg(key)        the answer, or null
 *   has(...keys)    true when every key is answered
 *   ph(key)         what the build renders when the key is unanswered
 *   expect(key)     the string that should appear on screen either way —
 *                   the answer if there is one, the placeholder if not
 *
 * The last one is the useful one. `expect('site.hospitalShort')` is "{{site.hospitalShort}}" on
 * the localized branch and "«ABBR»" on the template branch, so one assertion
 * covers both and neither branch teaches its champion to ignore a red run.
 */
import { readFileSync, existsSync } from 'node:fs';
import { FIELDS, readPath, isAnswered } from './localization.manifest.mjs';

const FILE = process.env.SITE_CONFIG || 'site.config.json';
const ANSWERS = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};

export const CONFIG_FILE = FILE;

export function cfg(key) {
  const v = readPath(ANSWERS, key);
  return isAnswered(v) ? v : null;
}

export function has(...keys) {
  return keys.every(k => cfg(k) !== null);
}

export function ph(key) {
  const f = FIELDS.find(x => x.key === key);
  if (!f) throw new Error(`verify_site_config: no manifest field "${key}"`);
  return f.placeholder === null ? '' : String(f.placeholder);
}

export function expect(key) {
  const v = cfg(key);
  if (v === null) return ph(key);
  if (Array.isArray(v)) {
    return v.map(x => (typeof x === 'object' && x !== null
      ? [x.label, x.phoneDisplay].filter(Boolean).join(' · ')
      : String(x))).join('; ');
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/** True when this build is a blank template rather than a localized site. */
export function isTemplate() {
  return FIELDS.filter(f => f.required === 'go-live').some(f => cfg(f.key) === null);
}

/** Resolve {{tokens}} in a BUILD INPUT (inventory.js, equipment-icons.js) the
 *  same way build.mjs does for pages. Those files are injected rather than
 *  published, so there is no built copy on disk to read — a suite that opens
 *  them raw would be comparing placeholders against rendered text and would
 *  fail for a reason that has nothing to do with what it is checking. */
export function resolveTokens(text) {
  return String(text).replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (whole, key) => {
    const f = FIELDS.find(x => x.key === key);
    if (!f) return whole;
    return expect(key);
  });
}

/** Escape a config value for use inside a RegExp. */
export function rx(key) {
  return expect(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
