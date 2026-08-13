/* gen_onboarding.mjs — writes ONBOARDING.md from localization.manifest.mjs.
 *
 *     node gen_onboarding.mjs
 *
 * The questions are generated so the document can never drift from the config
 * it describes. Add a field to the manifest, re-run this, and the onboarding
 * guide grows a question with the right section, the right "who knows this",
 * and the right blocking status — instead of quietly not mentioning it.
 *
 * The prose around the questions is hand-written and lives here, in PROLOGUE
 * and EPILOGUE below. It is the part that carries the argument; the tables are
 * the part that carries the data. Editing ONBOARDING.md directly is a mistake —
 * the next run overwrites it.
 */
import { writeFileSync } from 'node:fs';
import { SECTIONS, FIELDS } from './localization.manifest.mjs';

const REQ_LABEL = {
  'go-live': '**Before go-live**',
  'sim': 'Before your first drill',
  'optional': 'Optional',
};

const PROLOGUE = `# Onboarding: making this manual yours

You have forked an emergency manual that works. Every calculator runs, every
checklist is written, every poster prints. None of it is about your department
yet, and until it is, the most dangerous thing about it is how finished it
looks.

This document is the process for fixing that. It is a list of questions. Answer
them into \`site.config.json\`, rebuild, and the manual becomes yours — screen by
screen, with the parts you have not answered saying so out loud rather than
guessing.

> **Read this first.** The manual is a cognitive aid. It is not part of any
> EHR, it is not FDA-cleared, and it is not a substitute for clinical judgment.
> Every clinical value in it must be validated against **your** assays, **your**
> formulary, **your** equipment and **your** medical direction before it is used
> on a patient. Answering these questions is not validation — it is what makes
> validation possible, by putting every value in one place where a clinician can
> actually review it.

---

## The shape of the work

Five steps. Steps 1–3 are a couple of focused hours; step 4 is where the real
findings come from, and it never entirely finishes.

**1 · Fork and deploy it blank.** Fork the repository, connect it to Netlify (or
any static host — it is plain static files with one build step), and let it
publish. It will deploy with a red **NOT LOCALIZED** bar on every page. That is
correct. Do not skip ahead to answering questions before you have seen it
deployed; a manual nobody can open is not a manual, and you want the hosting
solved while the stakes are zero.

**2 · Branch, then answer.** Work on a branch, never on \`main\`:

\`\`\`
git checkout -b localize-<your-hospital>
node gen_site_config.mjs        # writes site.config.json, all nulls
\`\`\`

Then work the sections below in order. **A → B → C first** — identity, who you
call, and what your department can do. Those three unlock the most screens per
question and include the values that are most dangerous to inherit. Rebuild as
you go:

\`\`\`
node build.mjs
\`\`\`

Every build tells you where you are:

\`\`\`
localization (site.config.json): 31/69 answered (45%), 16 required missing, 9 placeholder(s) rendered on screen
\`\`\`

**3 · Push the branch and look at it on a real phone.** Netlify builds every
branch to its own live URL, separate from production. Open it on the phone you
would actually use at the bedside, in the room you would actually use it in. The
red bar's **WHAT IS MISSING** button lists what is left, grouped by the section
of this document that answers it.

**4 · Run the simulations.** This is the step that finds what a form cannot ask
about. \`/simulations/\` has drills built around the workflows this manual
covers, and each one ends with a **LOCALIZATION GAPS THIS DRILL SURFACES**
block: the specific things that went wrong or went slowly *because of a local
fact nobody had written down*. Run them with your own team, on your own
equipment, in your own department. Answer what they surface, push, and run the
next one.

Start with **Sepsis (Sim 11)**, **Stroke (Sim 12)** and **STEMI (Sim 13)**. They
are the three highest-volume time-critical pathways in most EDs, and between
them they exercise almost every value in sections B, C and F.

**5 · Have a clinician sign it, then merge.** Fill in \`review.reviewer\` and
\`review.date\`, merge the branch, and let production build. Until those two
fields exist, every screen's version stamp reads **NOT LOCALLY REVIEWED** —
deliberately, because an unsigned manual should say so rather than look
finished.

---

## Three rules that do not change, whatever you answer

**No patient data, ever.** The tools stay device-local and PHI-free. They may
keep a running timer, checklist progress and an on-device case timeline of
times and events — never a name, an MRN or a date of birth, and nothing ever
leaves the browser. A RESET control clears it. This is a hard rule, not a
default, and the test suite enforces it.

**You validate every clinical number.** See the note at the top. The worked
example in \`site.config.lrh.json\` exists so you can see the *shape* of a
complete answer. Copying it would give your department a manual that is
confidently wrong about itself, which is worse than an obviously blank one,
because nobody re-checks a screen that looks finished.

**An unanswered value is better than a borrowed one.** Nothing here falls back
to a default. If you do not answer \`trop.ruleInValue\`, the chest-pain pathway
does not quietly use somebody else's cutoff — it refuses to classify and tells
you which key is missing. Leave things blank until you know. That is the system
working.

---

## How to read the questions

Each question gives you:

- **What it drives** — what breaks, and where, if the answer is wrong.
- **Who knows** — the person at your hospital who actually has the answer.
  This field is doing more work than it looks like it is: most of these
  questions are five-minute conversations with somebody who is not you, and
  the reason localization stalls is usually not difficulty but not knowing
  whose question it is.
- **Example** — how the originating site answered it. An illustration of the
  shape of an answer. **Never a default.**
- **When** — whether it blocks go-live, will surface in a drill, or is cosmetic.

Answers go into \`site.config.json\` at the dot path given as the key. \`false\`
and \`0\` are real answers; \`null\` means unanswered.

---
`;

const EPILOGUE = `
---

## After the questions: what a form cannot ask

Sections A–J are the things that can be written down in advance. There is a
second category, and it is the one that hurts: local facts nobody knows are
facts. Which cupboard the second suction unit is in. That the transfer center's
line rings out after 9pm and you have to use a different number. That your
"two-minute" blood arrival is twenty when the runner is at lunch. That the
warmer takes eight minutes to come up to temperature.

None of those can be asked for on a form, because nobody would think to write
them down. They surface exactly one way: by running the workflow and watching
where it stalls.

That is what \`/simulations/\` is for. Every drill ends with a **LOCALIZATION
GAPS THIS DRILL SURFACES** block naming the config keys that drill tends to
expose — but the block is a starting point, not a checklist. The instruction to
the facilitator is the same in all of them: *write down every moment somebody
had to ask a question the manual should have answered.* Those moments are the
real backlog.

Run them in this order if you have no reason to prefer another:

| Sim | Why here | Sections it exercises |
|---|---|---|
| **11 · Sepsis → septic shock** | Highest volume, most hand-offs, most timing | B, C, F |
| **12 · Stroke → lytic → thrombectomy transfer** | Most time-critical, most external dependency | B, C, F, H |
| **13 · STEMI → reperfusion decision** | The one card whose entire structure depends on one boolean | B, C, F, H |
| **14 · Anaphylaxis → refractory** | Fastest to run; finds where the epinephrine actually is | F, G |
| **15 · DKA → cerebral edema** | Finds your insulin protocol and your peds thresholds | F, H |
| **16 · Massive hematemesis → balloon tamponade** | Finds equipment nobody has touched | B, C, G |
| **17 · Undifferentiated overdose** | Finds poison control, antidote stock, and the tox cupboard | B, F, G |

---

## Keeping it localized

Localization is not a one-time event, and treating it as one is how a manual
goes quietly stale.

- **Re-run the questions annually**, and whenever a transfer agreement, an
  assay, a formulary item or a defibrillator changes. The build's percentage is
  a completeness measure, not a freshness one — a fully answered config full of
  last year's numbers still reports 100%.
- **Re-stamp when you review.** \`review.date\` is what tells a clinician at the
  bedside how old the thing in their hand is.
- **When upstream moves**, pull it and rebuild. The build fails on any token
  nobody has declared, so a new site-specific value added upstream cannot reach
  your screens as a literal \`{{placeholder}}\` — it stops the build instead.
- **When you find a value that was hard to find, or a sentence that turned out
  to be about somebody else's hospital, open an issue upstream.** That is a bug
  in the localization surface, and it is the single most useful thing a second
  adopting site can contribute. The strip rules live in
  \`strip_localization.mjs\`, one explicit pair per claim, precisely so they can
  be added to.

---

## If something is not localizable

You will hit a value that matters to you and is not in this list — a card that
states something about a department that is not true of yours, with no config
key behind it.

Do not edit around it silently. Two better options:

1. **Add it to the manifest.** \`localization.manifest.mjs\` is one entry per
   value; add yours, use \`{{its.key}}\` or \`LOCAL('its.key')\` in the tool, and
   run \`node gen_onboarding.mjs && node gen_site_config.mjs && node build.mjs\`.
   The docs, the answer sheet and the readiness report all follow automatically.
2. **Open an issue upstream** so the next hospital does not have to find it
   again.

The test for whether something belongs in the manifest is not "is it a number".
It is: **would a different emergency department have a different answer, and
would inheriting ours be wrong?** If yes, it is site-specific, and it does not
belong hard-coded in a checklist.
`;

/* --------------------------------------------------------------------------- */

function esc(s) {
  return String(s).replace(/\|/g, '\\|');
}

/* GitHub's heading slug rules: lowercase, drop anything that is not a letter,
   digit, space or hyphen, then spaces to hyphens. Computed rather than guessed
   so the contents table's links actually land. */
function slug(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function renderField(f) {
  const lines = [];
  lines.push('');
  lines.push(`#### \`${f.key}\``);
  lines.push('');
  lines.push(`**${f.q}**`);
  lines.push('');
  lines.push(`- **What it drives** — ${f.why}`);
  lines.push(`- **Who knows** — ${f.ask}`);
  if (f.choices) lines.push(`- **One of** — ${f.choices.map(c => `\`${c}\``).join(' · ')}`);
  if (f.itemShape) {
    lines.push(`- **Each entry needs** — ${Object.entries(f.itemShape)
      .map(([k, v]) => `\`${k}\` (${v})`).join(' · ')}`);
  }
  const ex = f.example === null || f.example === undefined
    ? '_(the originating site left this unset)_'
    : `\`${String(f.example)}\``;
  lines.push(`- **Example** — ${ex}`);
  if (f.invariant) lines.push(`- **Still enforced** — ${f.invariant}`);
  lines.push(`- **When** — ${REQ_LABEL[f.required]}`);
  if (f.surfaces && f.surfaces.length) {
    lines.push(`- **Where you will see it** — ${f.surfaces.map(s => esc(s)).join(' · ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

let out = PROLOGUE;

/* A summary table first, so somebody can scan the whole job before starting it
   — and so the "who do I need to talk to" list can be pulled out in one pass
   rather than discovered one question at a time. */
out += '\n## The sections at a glance\n\n';
out += '| § | Section | Questions | Blocking go-live |\n|---|---|---|---|\n';
const heading = s => `${s.id}. ${s.title}`;
for (const s of SECTIONS) {
  const fs = FIELDS.filter(f => f.section === s.id);
  const req = fs.filter(f => f.required === 'go-live').length;
  out += `| ${s.id} | [${s.title}](#${slug(heading(s))}) | ${fs.length} | ${req} |\n`;
}
out += `| | **Total** | **${FIELDS.length}** | **${FIELDS.filter(f => f.required === 'go-live').length}** |\n`;

for (const s of SECTIONS) {
  const fs = FIELDS.filter(f => f.section === s.id);
  if (!fs.length) continue;
  out += `\n---\n\n## ${heading(s)}\n\n${s.blurb}\n\n`;

  /* Who you need to talk to, collected once per section. Most of these
     questions are a five-minute conversation with somebody who is not you, and
     localization stalls on not knowing whose question it is — so the list of
     people comes before the list of questions, not scattered through it. */
  const people = [...new Set(fs.map(f => f.ask).filter(a => !/^Nobody|^You know|^As above|^Look at it|^Package insert|^Listen to how/i.test(a)))];
  if (people.length) {
    out += `**Who you will need to ask:** ${people.length} ${people.length === 1 ? 'conversation' : 'conversations'} —\n`;
    for (const p of people) out += `- ${p}\n`;
    out += '\n';
  }

  for (const f of fs) out += renderField(f);
}

out += EPILOGUE;

/* A generated file that does not say so invites somebody to edit it. */
const header = '<!-- GENERATED by gen_onboarding.mjs from localization.manifest.mjs.\n' +
  '     Do not edit this file directly — edit the manifest (for questions) or\n' +
  '     the PROLOGUE/EPILOGUE strings in gen_onboarding.mjs (for prose), then\n' +
  '     re-run:  node gen_onboarding.mjs  -->\n\n';

writeFileSync('ONBOARDING.md', header + out);
console.log(`ONBOARDING.md written — ${SECTIONS.length} sections, ${FIELDS.length} questions, ` +
  `${FIELDS.filter(f => f.required === 'go-live').length} blocking go-live.`);
