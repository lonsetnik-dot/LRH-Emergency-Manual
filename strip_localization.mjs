/* strip_localization.mjs — turn a localized manual back into a template.
 *
 *     node strip_localization.mjs --dry     # report only
 *     node strip_localization.mjs           # rewrite files in place
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF COMMIT. The template branch has to be
 * regenerated whenever the localized branch gains content, and a hand-made
 * strip decays the moment somebody adds a card that says "we have no cath lab".
 * Keeping the rules here means the strip is reproducible, reviewable, and — the
 * part that actually matters — AUDITABLE: the residue report at the end names
 * every site-specific string the rules did not catch, so a missed one is a test
 * failure rather than a discovery three hospitals later.
 *
 * WHAT IT DOES NOT DO. It does not touch clinical values that are universal
 * (compression rate, ACLS epinephrine 1 mg, DAS attempt ceilings). Blanking
 * those would not make a fork safer; it would make the manual useless while
 * teaching its champion that blank fields are normal. See ONBOARDING.md
 * "What was left in, and why".
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

/* Files that must KEEP their LRH strings:
   - this script (the rules themselves name what they are looking for)
   - the manifest (its `example` fields are LRH's answers, shown as a worked
     example next to each question — that is their whole job)
   - the LRH answer sheet, for the same reason
   - the onboarding docs, which quote LRH as the example throughout */
const KEEP = new Set([
  'strip_localization.mjs',
  'localization.manifest.mjs',
  'site.config.lrh.json',
  'ONBOARDING.md',
]);

/* ---------------------------------------------------------------------------
   1. IDENTITY — mechanical, unambiguous, longest match first.
   --------------------------------------------------------------------------- */
const IDENTITY = [
  ['https://github.com/lonsetnik-dot/LRH-Emergency-Manual', '{{site.repoUrl}}'],
  ['github.com/lonsetnik-dot/LRH-Emergency-Manual', '{{site.repoUrl}}'],
  ['Littleton Regional Healthcare', '{{site.healthSystemName}}'],
  ['Littleton Regional Hospital', '{{site.hospitalName}}'],
  ['lrhemergencymanual.net', '{{site.domain}}'],
  ['LRH &middot; EMERGENCY DEPARTMENT', '{{site.hospitalShort}} &middot; {{site.deptName}}'],
  ['LRH · EMERGENCY DEPARTMENT', '{{site.hospitalShort}} · {{site.deptName}}'],
  ['LRH Emergency Manual', '{{site.hospitalShort}} Emergency Manual'],
];

/* ---------------------------------------------------------------------------
   2. NAMESPACE — lrh- is invisible to a user but it is still somebody else's
   name on your data. edm- = Emergency Department Manual. CASE-STATE.md and the
   security workflow's namespace gate are renamed in the same pass so the
   contract and its enforcement move together.
   --------------------------------------------------------------------------- */
const RENAMES = [
  ['lrh-', 'edm-'],
  ['lrhThemeBtn', 'edmThemeBtn'],
  ['lrhStaleCleared', 'edmStaleCleared'],
  ['LRH-Emergency-Manual', 'ED-Emergency-Manual'],
];

/* ---------------------------------------------------------------------------
   2b. CAPABILITY CLAIMS — the dangerous class, and the reason this file exists.

   These are not brand strings. They are sentences that ASSERT SOMETHING TRUE
   ABOUT A DEPARTMENT, in the middle of a checklist, in the same voice as the
   clinical content around them: "no on-site cath lab", "no in-house
   neurosurgery", "platelets are usually unavailable", "the Minnesota tube is
   not stocked". A fork that renames LRH to its own abbreviation and stops there
   has not stripped these — it has RE-ATTRIBUTED them. The manual now states,
   under the new hospital's name, facts about a hospital none of its readers
   have ever visited, at the exact moment nobody has time to doubt a screen.

   So each one is rewritten to read its answer from site.config.json. Unanswered,
   they render a loud placeholder and the page says NOT LOCALIZED. Answered, they
   state the local truth. What they can never again do is state somebody else's.
   --------------------------------------------------------------------------- */
const CLAIMS = [
  /* ---- trauma: center level, neurosurgery, replant, receiving center ---- */
  ['LRH is a <b>Level III trauma center without in-house neurosurgery</b>, so this is the evidence base for its activation tier, not an ACS Level I standard, and anything needing neurosurgical care transfers.',
   'this department is a <b>{{caps.traumaCenterLevel}}</b> trauma center and its in-house neurosurgery answer is <b>{{caps.neurosurgeryInHouse}}</b> — confirm that this is the right evidence base for YOUR activation tier, and that anything needing neurosurgical care transfers.'],

  ['LRH is a <b>Level III trauma center</b> with general surgery but <b>no in-house neurosurgery</b>.',
   'this department is a <b>{{caps.traumaCenterLevel}}</b> trauma center; in-house neurosurgery here: <b>{{caps.neurosurgeryInHouse}}</b>.'],

  ['LRH is a <b>Level III trauma center</b> — general surgery is available, but there is <b>no in-house neurosurgery</b>.',
   'this department is a <b>{{caps.traumaCenterLevel}}</b> trauma center; in-house neurosurgery here: <b>{{caps.neurosurgeryInHouse}}</b>.'],

  ['LRH is a <b>Level III trauma center without in-house neurosurgery</b> —',
   'this department is a <b>{{caps.traumaCenterLevel}}</b> trauma center; in-house neurosurgery here: <b>{{caps.neurosurgeryInHouse}}</b> —'],

  ['LRH is not a replant center —',
   'Replantation/hand center here: <b>{{caps.replantCenter}}</b> —'],

  ['⚠ <b>LOCALIZED FOR LRH:</b> mBIG-1 routes to the <b>trauma attending, not neurosurgery</b>; mBIG-2 and mBIG-3 are <b>transferred to DHMC</b>, not admitted locally — both per the workflow agreed with DHMC\'s trauma medical director (see the "LRH" notes below).',
   '⚠ <b>NOT LOCALIZED — mBIG ROUTING IS UNSET:</b> which mBIG tier you admit, which you transfer, and to whom, is a workflow each ED agrees with its own receiving trauma center — it is not inheritable. Decide it, write it into this card, and name the receiving center from ONBOARDING §B before anyone uses this.'],

  /* ---- codes: cath lab, platelets, MTP activation, cEEG, lytic ---- */
  ['LRH has no on-site cath lab (<a href="#c21">card 21</a>)',
   'On-site cath lab here: <b>{{caps.cathLab}}</b> (<a href="#c21">card 21</a>)'],

  ['since LRH transfers STEMI out (card 21)',
   'if your site transfers STEMI out (card 21)'],

  ['The first three criteria are LRH policy. Any attending physician may activate MTP in an emergent situation.',
   'Activation at this site: <b>{{contacts.bloodBank.how}}</b>'],

  ['LRH typically has <b>no platelets on site</b> — don\'t wait on them to start.',
   'Platelets held on site here: <b>{{caps.plateletsOnSite}}</b>. Where they are not held, don\'t wait on them to start.'],

  ['PLATELETS — <b>often unavailable at LRH.</b>',
   'PLATELETS — held on site here: <b>{{caps.plateletsOnSite}}</b>.'],

  ['LRH usually has no platelets on hand, so don\'t wait on them to',
   'where platelets are not held on site ({{caps.plateletsOnSite}}), don\'t wait on them to'],

  ['don\'t wait for cEEG availability to start the call if LRH can\'t provide it in-house.',
   'don\'t wait for cEEG availability to start the call — in-house cEEG here: <b>{{caps.cEEGInHouse}}</b>.'],

  ['<b>LRH\'s stroke protocol uses tenecteplase (TNK) as the lytic agent: 0.25 mg/kg IV, single bolus, max 25 mg',
   '<b>Your stroke lytic (ONBOARDING §F): {{formulary.strokeLytic}}. The per-kg figure below is UNVERIFIED FOR THIS SITE — 0.25 mg/kg IV, single bolus, max 25 mg'],

  ['LRH\'s Adult Airway Guide leaves the specific induction agent, paralytic, and push-dose-pressor recipe to the intubating clinician\'s judgment/pharmacy stock — it doesn\'t name one combination.',
   'Your local airway guide may leave the specific induction agent, paralytic and push-dose-pressor recipe to the intubating clinician\'s judgment and pharmacy stock. Agents stocked here: <b>{{formulary.rsiInduction}}</b>.'],

  ['— LRH\'s preferred first-line if IV access is present.',
   '— confirm your own preferred first-line if IV access is present.'],

  ['— LRH\'s listed second-line option, favorable side-effect profile.',
   '— a common second-line option with a favorable side-effect profile; confirm your own listed choice.'],

  ['its bronchodilator effect makes it LRH\'s preferred induction agent here',
   'its bronchodilator effect is why many departments prefer it here — confirm yours ({{formulary.rsiInduction}})'],

  ['confirm LRH\'s actual STEMI activation process (who gets paged, current Omnicell box contents, current transfer agreements/preferred receiving center)',
   'your STEMI activation process is <b>{{policy.stemiActivation}}</b> — confirm who gets paged, your pharmacy box contents, and your current transfer agreements and preferred receiving center'],

  ['adapted to LRH\'s documented TNK-based pharmaco-invasive protocol',
   'adapted from a TNK-based pharmaco-invasive protocol'],

  ['not an LRH-specific order set', 'not a local order set'],
  ['pending an LRH-specific order set', 'pending a local order set'],
  ['LRH\'s actual stocked concentration', 'your own actual stocked concentration'],
  ['confirm against LRH\'s own RT protocols', 'confirm against your own RT protocols'],
  ['confirm LRH\'s own protocol before hardcoding', 'confirm your own protocol before hardcoding'],
  ['confirm the exact dose/route against LRH\'s stocked formulary', 'confirm the exact dose/route against your own stocked formulary'],
  ['Follow the LRH blood bank policy', 'Follow your own blood bank policy'],
  ['reflect current LRH blood bank practice', 'reflect the source site\'s blood bank practice'],
  ['redundant items already covered by the LRH checklist', 'redundant items already covered by the local checklist'],
  ['Supplementary, not from the LRH policy:', 'Supplementary, not from the local policy:'],
  ['(LRH: 15 L/min · EMCrit: 20)', '({{site.hospitalShort}}: {{formulary.apneicOxLpm}} L/min · EMCrit: 20)'],
  ['apneic-oxygenation flow (LRH 15 L/min vs. EMCrit\'s 20 L/min)', 'apneic-oxygenation flow ({{formulary.apneicOxLpm}} L/min here vs. EMCrit\'s 20 L/min)'],
  ['target (LRH ≥95% vs. EMCrit\'s 100%/CPAP) — LRH\'s figures are used as the primary checklist values.',
   'target (≥95% here vs. EMCrit\'s 100%/CPAP) — the local figures are used as the primary checklist values.'],

  /* ---- physical stock claims ---- */
  ['LRH stocks neither a bronchial blocker nor a double-lumen tube',
   'Lung isolation here: <b>{{physical.lungIsolation}}</b> — this site stocks'],
  ["note:'No blocker and no DLT at LRH - the big ETT IS the isolation technique.",
   "note:'{{physical.lungIsolation}}."],
  ['(LRH stocks i-gel 1–5;', '({{physical.supraglotticSizes}};'],
  ['/* LRH stocks infant LMA 0 and 0.5 (drawer 1) — no size 1 */',
   '/* Stocked supraglottic sizes: {{physical.supraglotticSizes}} */'],
  ['<i>the Minnesota tube is not stocked at LRH</i>',
   '<i>{{physical.balloonTamponadeTube}}</i>'],
  ['NRP names a size 1 laryngeal mask; LRH stocks LMA 0 and 0.5 instead and the i-gels start at size 1.',
   'NRP names a size 1 laryngeal mask; this site stocks {{physical.supraglotticSizes}}.'],
  ['At LRH it is spread across code cart drawers 1 and 2',
   'At this site it is spread across the code cart drawers'],
  ['Items asserted ABSENT at LRH, each filed as a GitHub issue.',
   'Items asserted ABSENT at this site, each filed as an issue.'],
  ['Room 7 (Resus Bay)', '{{physical.resusRoom}}'],
  ['Job\\ Littleton/Emergency\\ Manual', 'Job\\ <site>/Emergency\\ Manual'],
  ['Littleton sits in the White Mountains', 'A rural mountain catchment makes this common'],
  ['ROOM 7 (RESUS BAY)', '{{physical.resusRoom}}'],
  /* Also appears bare inside inventory.js location strings ("Room 7 ·
     Monitoring"). Same floor plan, same problem — and it has to run AFTER the
     two fuller spellings above or it would eat their prefix and leave a
     dangling "(Resus Bay)". */
  ['Room 7', '{{physical.resusRoom}}'],
  ['ROOM 7', '{{physical.resusRoom}}'],

  /* ---- named transfer destinations -------------------------------------
     Every one of these is a phone number a clinician will dial at 3am without
     re-reading the label. There is no safe way to leave a real one in a
     template: it is either wrong for the fork (a hospital with no agreement,
     no record of the patient, and no reason to accept) or right by coincidence.
     They all become the configured primary destination. */
  ['<b><a class="telcall" data-tc href="tel:+18779999870">DHMC Transfer Center: (877) 999-9870</a>.</b>',
   '<b><a class="telcall" data-tc href="tel:{{contacts.transferPrimary.tel}}">{{contacts.transferPrimary.label}}: {{contacts.transferPrimary.phone}}</a>.</b>'],
  ['&mdash; DHMC Transfer Center <b>(877) 999-9870</b>',
   '&mdash; {{contacts.transferPrimary.label}} <b>{{contacts.transferPrimary.phone}}</b>'],
  [': DHMC Transfer Center <b>(877) 999-9870</b>',
   ': {{contacts.transferPrimary.label}} <b>{{contacts.transferPrimary.phone}}</b>'],
  ['DHMC Transfer Center number verified against the transfer-call log on',
   'Transfer center number is site-configured (ONBOARDING §B) — verify it against your own transfer-call log and'],
  ['<b>DHMC Transfer Center: (877) 999-9870</b> — for cardiology consultation or transfer.',
   '<b>{{contacts.transferPrimary.label}}: {{contacts.transferPrimary.phone}}</b> — for cardiology consultation or transfer.'],
  ['transferCenter: { label: "DHMC Transfer Center", phone: "(877) 999-9870", tel: "+18779999870" },',
   'transferCenter: { label: LOCAL(\'contacts.transferPrimary.label\'),\n                    phone: LOCAL(\'contacts.transferPrimary.phone\'),\n                    tel:   LOCAL(\'contacts.transferPrimary.tel\') },'],
  ['BIG card renders every "DHMC Transfer Center" line from here as a tap-to-',
   'BIG card renders every transfer-center line from here as a tap-to-'],
  ["    { key:'dhmc',    label:'Dartmouth-Hitchcock (DHMC) Transfer Center', tel:'+18779999870', phoneDisplay:'877-999-9870 (urgent/emergent)' },\n    { key:'concord', label:'Concord Hospital Transfer Center',           tel:'+18009929399', phoneDisplay:'800-992-9399' }\n  ] },",
   "    /* Rendered from site.config.json (ONBOARDING §B). An empty list makes the\n       picker say so rather than offering a destination nobody has an agreement\n       with — see LOCAL_MISSING_HTML in local-config.js. */\n  ].concat(LOCAL('contacts.transfer') || []) },"],

  /* ---- mBIG routing: a bilateral agreement, never inheritable ---- */
  ['<b>LRH:</b> notify the trauma attending — <b>not</b> neurosurgery — per the workflow agreed with DHMC\'s trauma medical director.',
   '<b>LOCAL ROUTING — UNSET:</b> decide who you notify for this tier, and record the agreement you have with your receiving center.'],
  ['<b>LRH:</b> transferred to DHMC, not admitted locally — per agreement with DHMC\'s trauma medical director.',
   '<b>LOCAL ROUTING — UNSET:</b> decide whether this tier is admitted locally or transferred, and to whom.'],
  ['<b>LRH:</b> transferred to DHMC, same as mBIG-2 — per agreement with DHMC\'s trauma medical director.',
   '<b>LOCAL ROUTING — UNSET:</b> decide whether this tier is admitted locally or transferred, and to whom.'],
  ['The "LRH" call-routing and transfer notes above are local practice, agreed directly with DHMC\'s trauma medical director — not part of the published mBIG literature.',
   'The call-routing and transfer notes above are LOCAL PRACTICE, agreed directly between a site and its receiving trauma center — they are not part of the published mBIG literature and cannot be inherited from another department.'],
  ['DHMC\'s transfer center doesn\'t always route this correctly; ask for the trauma attending by',
   'A transfer center may not route this correctly; ask for the trauma attending by'],
  ['<b>Transfer:</b> the DHMC transfer number visible on the whiteboa',
   '<b>Transfer:</b> the configured transfer number visible on the whiteboa'],

  /* ---- site posture ---- */
  ['LRH is a rural critical-access hospital → sequential.',
   'Set caps.tcaTeamModel in ONBOARDING §C. A rural critical-access hospital is\n     typically sequential; a full trauma team is typically simultaneous.'],
  ['set to null here because LRH has not', 'set to null here because this site has not'],
  ['LRH has no dedicated in-house ED security officer overnight — confirm who is actually available on your shift before you need them.',
   '{{contacts.security.note}}'],
  ['LRH has no on-site cath lab, so a STEMI patient is',
   'where there is no on-site cath lab, a STEMI patient is'],
];

/* ---------------------------------------------------------------------------
   2c. BLANKET — whatever LRH is left is branding or provenance prose, and reads
   correctly as a placeholder ("verify against «ABBR»'s own protocols"). Runs
   LAST, so the claims above have already been rewritten into something that
   does not merely swap one hospital's name for another's.
   --------------------------------------------------------------------------- */
const BLANKET = [
  [/\bLRH\b/g, '{{site.hospitalShort}}'],
];

/* ---------------------------------------------------------------------------
   3. RESIDUE — anything still naming this site after the rules above have run.
   The strip is only trustworthy if this comes back empty.
   --------------------------------------------------------------------------- */
const RESIDUE = /\bLRH\b|Littleton|lrhemergency|lonsetnik|DHMC|Dartmouth-Hitchcock|Concord Hospital|877.?999.?9870|800.?992.?9399/;

const changed = [];
const residue = [];
const claimHits = new Map();

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(html|js|mjs|md|yml|css|toml|webmanifest)$/.test(name)) continue;
    if (KEEP.has(p)) continue;
    rewrite(p);
  }
}

function rewrite(p) {
  const before = readFileSync(p, 'utf8');
  let text = before;
  for (const [from, to] of IDENTITY) text = text.split(from).join(to);
  for (const [from, to] of RENAMES) text = text.split(from).join(to);
  for (const [from, to] of CLAIMS) {
    if (!text.includes(from)) continue;
    claimHits.set(from, (claimHits.get(from) || 0) + 1);
    text = text.split(from).join(to);
  }
  for (const [re, to] of BLANKET) text = text.replace(re, to);
  if (text !== before) {
    changed.push(p);
    if (!DRY) writeFileSync(p, text);
  }
  for (const [i, line] of text.split('\n').entries()) {
    if (RESIDUE.test(line)) residue.push(`${p}:${i + 1}: ${line.trim().slice(0, 140)}`);
  }
}

walk('.');

console.log(`${DRY ? '[dry run] ' : ''}${changed.length} file(s) rewritten`);

/* A claim rule that matches nothing is the failure mode that matters: the
   sentence it was written for is still on a screen, unchanged, and the report
   below looks clean because the rule "ran". Name them. */
const deadRules = CLAIMS.filter(([from]) => !claimHits.has(from));
console.log(`claim rules: ${CLAIMS.length - deadRules.length}/${CLAIMS.length} matched`);
if (deadRules.length) {
  console.log('\nRules that matched NOTHING — the source moved, or they were never right:');
  for (const [from] of deadRules) console.log('  · ' + from.slice(0, 110).replace(/\n/g, ' '));
}

console.log(`\nresidue: ${residue.length} line(s) still naming this site`);
if (residue.length) {
  console.log('\nThese need a human decision — a capability claim, a policy citation,');
  console.log('or a clinical value that belongs in site.config.json:\n');
  for (const r of residue.slice(0, 200)) console.log('  ' + r);
  if (residue.length > 200) console.log(`  … and ${residue.length - 200} more`);
}
process.exitCode = 0;
