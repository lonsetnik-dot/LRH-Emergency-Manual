/* local-config.js — how a tool reads its own site's answers at runtime.
 *
 * Injected wherever a tool's <script> carries the marker  (slash-star)
 * @localconfig (star-slash), exactly like design-system.css and inventory.js.
 * Defines two functions and nothing else.
 *
 *   LOCAL(key)            the answer at that dot path, or null if unanswered
 *   LOCAL_OR(key, alt)    the answer, or `alt` — for values with a genuinely
 *                         universal default (see the warning below)
 *
 * THE ONE RULE: a site-specific clinical value MUST use LOCAL(), never
 * LOCAL_OR(). The difference is the whole safety argument of this template.
 *
 *   LOCAL('trop.ruleInValue')            → null on an unlocalized fork, and the
 *                                          pathway refuses to compute and says
 *                                          so on screen.
 *   LOCAL_OR('trop.ruleInValue', 50)     → 50. Which is somebody else's assay,
 *                                          rendered in the same font as a real
 *                                          answer, in a tool that discharges
 *                                          chest-pain patients.
 *
 * LOCAL_OR is for things like a metronome tone or a default cycle length,
 * where every site's answer is the same and a blank screen helps nobody.
 * If you are reaching for it and the value is a dose, an energy, a threshold,
 * a phone number, or a statement about what your department has — you want
 * LOCAL().
 *
 * Tools that call these must handle null. `verify_localization.mjs` proves they
 * do, by building the whole site against a blank answer sheet and asserting
 * that the live-protocol screens say NOT LOCALIZED rather than rendering NaN,
 * "undefined", or — worst of all — a number that came from nowhere.
 */
function LOCAL(key) {
  try {
    var c = window.SITE_CONFIG && window.SITE_CONFIG.config;
    if (!c) return null;
    var v = String(key).split('.').reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, c);
    if (v === undefined || v === null) return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    if (Array.isArray(v) && !v.length) return null;
    return v;
  } catch (e) { return null; }
}

function LOCAL_OR(key, alt) {
  var v = LOCAL(key);
  return v === null ? alt : v;
}

/* True when every one of the named keys has an answer. The guard a tool puts
   in front of any calculation that would otherwise invent a number. */
function LOCAL_HAS() {
  for (var i = 0; i < arguments.length; i++) {
    if (LOCAL(arguments[i]) === null) return false;
  }
  return true;
}

/* Standard "this screen cannot run yet" markup, so every tool that has to
   refuse says it the same way and points at the same next step. */
function LOCAL_MISSING_HTML(what, section, keys) {
  var list = (keys || []).map(function (k) {
    return '<code style="font-size:11.5px">' + k + '</code>';
  }).join(' &middot; ');
  return '<div style="border:3px solid #7a1420;background:#fdecec;color:#4d0c14;' +
    'padding:12px 14px;font-size:14px;line-height:1.4;border-radius:10px">' +
    '<b style="letter-spacing:.06em">&#9888; NOT LOCALIZED &mdash; THIS SCREEN CANNOT RUN</b><br>' +
    what + ' depends on values only your department can supply, and this copy of the ' +
    'manual has not been given them. Nothing is shown rather than something borrowed.<br>' +
    '<b>Next step:</b> answer <b>ONBOARDING &sect;' + section + '</b> in <code>site.config.json</code>, ' +
    'then rebuild.' + (list ? '<br><span style="opacity:.85">Missing: ' + list + '</span>' : '') +
    '</div>';
}
