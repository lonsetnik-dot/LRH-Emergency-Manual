/* localization.manifest.mjs — the single registry of every site-specific value.
 *
 * This file is the spine of the localization system. Everything else is derived
 * from it:
 *
 *   site.config.json        the answers (this file holds the QUESTIONS)
 *   build.mjs               substitutes {{key}} tokens into dist/ at build
 *   gen_onboarding.mjs      writes ONBOARDING.md from these questions
 *   verify_localization.mjs fails the suite on an unanswered REQUIRED value
 *
 * WHY A MANIFEST AND NOT JUST A CONFIG FILE. A bare config file tells you what
 * a value IS. It cannot tell you what the value MEANS, who at your hospital
 * knows the answer, or what goes wrong at the bedside if you inherit somebody
 * else's. Those three things are the difference between "editable" and
 * "localizable", so they live here as first-class fields, next to the key.
 *
 * FIELD REFERENCE
 *   key         dot path into site.config.json, and the {{token}} used in source
 *   section     onboarding section (A…J) — groups the questions for a human
 *   q           the question, phrased so a physician can answer it out loud
 *   why         what this value drives — why a wrong answer matters clinically
 *   ask         who at your hospital actually knows the answer
 *   required    'go-live'  must be answered before any clinical use
 *               'sim'      may be deferred; a simulation will surface it
 *               'optional' cosmetic or has a safe universal default
 *   placeholder what renders on screen while the answer is missing
 *   example     LRH's own answer, shown as a worked example — NEVER a default
 *   type        'text' | 'number' | 'bool' | 'list' | 'choice'
 *   choices     for type 'choice'
 *   surfaces    where a reader will see the effect (for the test checklist)
 *
 * ADDING A VALUE: add the entry here, use {{its.key}} in the tool, and run
 *   node gen_onboarding.mjs && node build.mjs && node verify_localization.mjs
 * Nothing else needs editing — the docs and the readiness score follow.
 */

export const SECTIONS = [
  { id: 'A', title: 'Identity & branding',
    blurb: 'What the manual calls your hospital, and where it lives on the web. Nothing clinical, but it is what makes staff trust that the manual is theirs.' },
  { id: 'B', title: 'Who you call',
    blurb: 'Transfer centers, poison control, blood bank. A wrong number here is the single highest-consequence field in the whole manual — it fails at the exact moment nobody has time to look one up.' },
  { id: 'C', title: 'What your department can and cannot do',
    blurb: 'Cath lab, neurosurgery, trauma level, platelets on the shelf. The manual states these as facts in the middle of checklists. Inheriting another hospital\'s capabilities is the most dangerous thing a fork can do, because the statement reads as true and nobody re-checks it under pressure.' },
  { id: 'D', title: 'Your equipment',
    blurb: 'The defibrillator you actually own and the energies printed on it. Escalation is universal; the joules are not.' },
  { id: 'E', title: 'Your laboratory',
    blurb: 'The troponin assay and its cutoffs. Every number in the chest-pain pathway is assay-specific and none of them transfer between assays.' },
  { id: 'F', title: 'Your formulary',
    blurb: 'Which agent you stock where more than one is reasonable — the lytic, the reversal agents, the induction drugs.' },
  { id: 'G', title: 'Your physical department',
    blurb: 'Cart drawers, stocked sizes, the rooms things live in. This is the layer that a walk around the department answers faster than any document.' },
  { id: 'H', title: 'Your local protocols',
    blurb: 'The manual cites its sources. Where a card was built from an LRH policy document, your fork must cite YOUR policy document — or say plainly that it has none yet.' },
  { id: 'I', title: 'Dialect & wording',
    blurb: 'US or Commonwealth spelling and drug names. See TERMINOLOGY.md.' },
  { id: 'J', title: 'Review & sign-off',
    blurb: 'Who reviewed this, and when. The manual prints it on every screen.' },
];

export const FIELDS = [

  /* ===================== A — IDENTITY & BRANDING ========================= */
  { key: 'site.hospitalName', section: 'A', type: 'text', required: 'go-live',
    q: 'What is your hospital\'s full legal name, as staff would expect to see it printed?',
    why: 'Printed on the landing page, the chest-pain pathway header, and every poster footer.',
    ask: 'Nobody — you know this one.',
    placeholder: '«YOUR HOSPITAL NAME»',
    example: 'Littleton Regional Hospital',
    surfaces: ['/ (landing eyebrow)', '/clinical-pathways/heart/ (subtitle)', 'poster footers'] },

  { key: 'site.hospitalShort', section: 'A', type: 'text', required: 'go-live',
    q: 'What short code do your staff actually say out loud for the hospital?',
    why: 'Used in every page title, every header bar, and every version stamp. If it is wrong it is wrong several hundred times.',
    ask: 'Nobody — you know this one.',
    placeholder: '«ABBR»',
    example: 'LRH',
    surfaces: ['every tool header', 'every browser tab title', 'every version stamp'] },

  { key: 'site.healthSystemName', section: 'A', type: 'text', required: 'optional',
    q: 'If your hospital belongs to a larger system that owns the policies, what is that system called?',
    why: 'Policy documents are usually owned at the system level, so citations name the system rather than the hospital.',
    ask: 'Whoever hands you policy documents.',
    placeholder: '«YOUR HEALTH SYSTEM»',
    example: 'Littleton Regional Healthcare',
    surfaces: ['policy citations in /codes/'] },

  { key: 'site.deptName', section: 'A', type: 'text', required: 'optional',
    q: 'How should the department itself be labelled in headers?',
    why: 'Cosmetic. Some sites say "Emergency Department", some "Emergency Care Center".',
    ask: 'Nobody — you know this one.',
    placeholder: 'EMERGENCY DEPARTMENT',
    example: 'EMERGENCY DEPARTMENT',
    surfaces: ['header eyebrow on every tool'] },

  { key: 'site.domain', section: 'A', type: 'text', required: 'go-live',
    q: 'What web address will your copy be published at (no https://, no trailing slash)?',
    why: 'Every printed QR code on every poster and cart label encodes an absolute URL. A QR pointing at somebody else\'s hospital is worse than no QR — it is a laminated, trusted, wrong link that will still be on the wall in three years.',
    ask: 'Whoever set up your Netlify site. Until you know, leave it unanswered and do not print posters.',
    placeholder: '«your-manual-domain»',
    example: 'lrhemergencymanual.net',
    surfaces: ['every poster QR', 'every cart-label QR', 'canonical + og: meta tags'] },

  { key: 'site.repoUrl', section: 'A', type: 'text', required: 'optional',
    q: 'Where does YOUR fork of this repository live?',
    why: 'Coverage-gap notes link to issues. On a fork those links should point at your issue tracker, not upstream\'s.',
    ask: 'Whoever forked it.',
    placeholder: 'https://github.com/«you»/«your-fork»',
    example: 'https://github.com/lonsetnik-dot/LRH-Emergency-Manual',
    surfaces: ['coverage-gap notes in /codes/'] },

  { key: 'site.accentLight', section: 'A', type: 'text', required: 'optional',
    q: 'Your primary accent color in light mode (hex)?',
    why: 'Branding only. Note the rule in DESIGN-SYSTEM.md §2: color encodes WHERE ON A CART, never severity — do not repurpose the drawer colors.',
    ask: 'Marketing, or your own eye.',
    placeholder: '#00693E',
    example: '#00693E',
    surfaces: ['--accent token, every tool'] },

  { key: 'site.accentDark', section: 'A', type: 'text', required: 'optional',
    q: 'Your primary accent color in dark mode (hex)?',
    why: 'Same as above. Dark mode is the default at the bedside, so this is the one most people will see.',
    ask: 'Marketing, or your own eye.',
    placeholder: '#2FA372',
    example: '#2FA372',
    surfaces: ['--accent token, every tool'] },

  /* ========================= B — WHO YOU CALL =========================== */
  { key: 'contacts.transfer', section: 'B', type: 'list', required: 'go-live',
    q: 'List every transfer/tertiary center you send patients to, with the transfer-center phone number for each. Include what each one is FOR (PCI, thrombectomy, neurosurgery, trauma, burns, peds).',
    why: 'Drives the tap-to-call links in the stroke, STEMI, ICH, BIG, trauma and OB cards. This is the field the whole manual exists to make fast.',
    ask: 'Your ED charge nurse keeps the real list on a card by the phone. Get that card. Then confirm each number by dialing it during business hours — transfer lines change and nobody announces it.',
    placeholder: '«NO TRANSFER CENTER SET — see ONBOARDING §B»',
    example: 'Dartmouth-Hitchcock (DHMC) Transfer Center · 877-999-9870 (urgent/emergent); Concord Hospital Transfer Center · 800-992-9399',
    itemShape: { label: 'Name as staff say it', phoneDisplay: 'Number as printed', tel: 'E.164 dial string, e.g. +18779999870', use: 'What it is for' },
    surfaces: ['/codes/ stroke, STEMI, ICH', '/trauma/ BIG card', '/tca/'] },

  { key: 'contacts.transferPrimary.label', section: 'B', type: 'text', required: 'go-live',
    q: 'Which single transfer center is your default — the one a card should name when it does not know which specialty is needed?',
    why: 'The trauma BIG card and several checklists render one named tap-to-call line rather than a picker.',
    ask: 'Your ED medical director.',
    placeholder: '«PRIMARY TRANSFER CENTER»',
    example: 'DHMC Transfer Center',
    surfaces: ['/trauma/ (data-tc links)'] },

  { key: 'contacts.transferPrimary.phone', section: 'B', type: 'text', required: 'go-live',
    q: 'That center\'s number, formatted the way you want it printed.',
    why: 'Shown as the visible label of the tap-to-call link.',
    ask: 'As above.',
    placeholder: '«(000) 000-0000»',
    example: '(877) 999-9870',
    surfaces: ['/trauma/'] },

  { key: 'contacts.transferPrimary.tel', section: 'B', type: 'text', required: 'go-live',
    q: 'That same number as a dial string (E.164: +1 then ten digits, no spaces).',
    why: 'This is what the phone actually dials when somebody taps it with gloves on. Test it once from a real phone.',
    ask: 'As above.',
    placeholder: '+10000000000',
    example: '+18779999870',
    surfaces: ['/trauma/ tel: hrefs'] },

  { key: 'contacts.poisonControl.display', section: 'B', type: 'text', required: 'go-live',
    q: 'Your regional poison control number as you want it printed.',
    why: 'Toxicology cards. In the US this is a single national number; elsewhere it is regional.',
    ask: 'It is on a sticker on your ED phone.',
    placeholder: '«POISON CONTROL»',
    example: '1-800-222-1222',
    surfaces: ['/codes/ tox cards'] },

  { key: 'contacts.poisonControl.tel', section: 'B', type: 'text', required: 'go-live',
    q: 'Poison control as a dial string.',
    why: 'The tap-to-call target.',
    ask: 'As above.',
    placeholder: '+10000000000',
    example: '+18002221222',
    surfaces: ['/codes/ tox cards'] },

  { key: 'contacts.bloodBank.how', section: 'B', type: 'text', required: 'go-live',
    q: 'How is massive transfusion actually activated at your site — who is called, on what number, and what words do they need to hear?',
    why: 'The MTP card is a checklist of actions. The first action is this one, and it is entirely local.',
    ask: 'Your blood bank supervisor. Ask them to walk you through what happens on their side when you call — you will learn things the policy does not say.',
    placeholder: '«HOW IS MTP ACTIVATED HERE? — see ONBOARDING §B»',
    example: 'Call the lab at extension 1234 and say "activate massive transfusion protocol"; any attending physician may activate.',
    surfaces: ['/codes/ card 12 (MTP)', '/trauma/', '/pph/'] },

  { key: 'contacts.security.who', section: 'B', type: 'text', required: 'sim',
    q: 'For a penetrating-trauma scene-security concern, who do you tell?',
    why: 'The prompt to secure the department is universal. Who can actually do it is not — some EDs lock the bay from the charge desk, some must find an officer on the far side of the building.',
    ask: 'Your charge nurse and your security lead, together.',
    placeholder: '«WHO SECURES THE DEPARTMENT?»',
    example: 'charge nurse + house supervisor',
    surfaces: ['/trauma/ penetrating trauma card'] },

  { key: 'contacts.security.how', section: 'B', type: 'text', required: 'sim',
    q: 'And what do you ask them to do?',
    why: 'As above.',
    ask: 'As above.',
    placeholder: '«WHAT DO YOU ASK THEM TO DO?»',
    example: 'ask Security to restrict the ED to one controlled entrance',
    surfaces: ['/trauma/'] },

  { key: 'contacts.security.overhead', section: 'B', type: 'text', required: 'optional',
    q: 'What is the exact overhead page phrase your operator expects? Leave unanswered if you have none.',
    why: 'An almost-right page phrase gets ignored. Set it exactly or leave it out.',
    ask: 'Your switchboard operator.',
    placeholder: null,
    example: null,
    surfaces: ['/trauma/'] },

  { key: 'contacts.security.note', section: 'B', type: 'text', required: 'optional',
    q: 'Is there a caveat about security availability your team needs to know (overnight gaps, response time)?',
    why: 'LRH prints a warning that there is no in-house ED security officer overnight. Yours will differ, and inheriting LRH\'s would be a false statement about your department.',
    ask: 'Your night charge nurses — not the daytime policy.',
    placeholder: null,
    example: 'LRH has no dedicated in-house ED security officer overnight — confirm who is actually available on your shift before you need them.',
    surfaces: ['/trauma/'] },

  /* ============ C — WHAT YOUR DEPARTMENT CAN AND CANNOT DO ============== */
  { key: 'caps.traumaCenterLevel', section: 'C', type: 'text', required: 'go-live',
    q: 'What is your verified trauma center level, if any?',
    why: 'The trauma cards state this in the middle of a checklist to explain WHY a patient is being transferred rather than taken to the OR. Note this is the hospital\'s verified resource level, which is a different thing from your per-patient activation tier — the trauma card explains the distinction.',
    ask: 'Your trauma program manager. The answer is a verification certificate, not an opinion.',
    placeholder: '«TRAUMA LEVEL — NOT SET»',
    example: 'Level III',
    surfaces: ['/trauma/ activation, penetrating, BCVI cards'] },

  { key: 'caps.neurosurgeryInHouse', section: 'C', type: 'bool', required: 'go-live',
    q: 'Do you have in-house neurosurgery?',
    why: 'Decides whether a head-bleed card routes to a phone call or to an operating room. LRH\'s cards say "no in-house neurosurgery" as a plain statement of fact; a fork that inherits that sentence while having a neurosurgeon upstairs has printed a lie into a resuscitation.',
    ask: 'You know this one, but confirm the after-hours answer separately from the daytime one.',
    placeholder: '«IN-HOUSE NEUROSURGERY? — NOT ANSWERED»',
    example: false,
    surfaces: ['/trauma/ cards 01, 05, 09', '/procedures/ burr hole'] },

  { key: 'caps.cathLab', section: 'C', type: 'bool', required: 'go-live',
    q: 'Do you have an on-site cardiac catheterization lab available for primary PCI?',
    why: 'This single boolean decides whether your STEMI card is a "activate the cath lab" card or a "give the lytic and start the transfer clock" card. They are completely different pathways.',
    ask: 'Cardiology. Ask specifically about nights and weekends — many labs are day-only, which makes the answer time-of-day dependent and worth stating plainly.',
    placeholder: '«ON-SITE CATH LAB? — NOT ANSWERED»',
    example: false,
    surfaces: ['/codes/ card 21 (STEMI)', 'Sim 5, Sim 13'] },

  { key: 'caps.plateletsOnSite', section: 'C', type: 'choice', required: 'go-live',
    choices: ['always', 'sometimes', 'never'],
    q: 'Do you hold platelets on site?',
    why: 'The MTP card tells the team not to wait on platelets when they are not held locally. If you DO hold them, that instruction is wrong for you and slows a correct action down.',
    ask: 'Blood bank.',
    placeholder: '«PLATELETS ON SITE? — NOT ANSWERED»',
    example: 'sometimes',
    surfaces: ['/codes/ card 12 (MTP)', '/trauma/', '/pph/'] },

  { key: 'caps.cEEGInHouse', section: 'C', type: 'bool', required: 'sim',
    q: 'Can you get continuous EEG in-house, and in what timeframe?',
    why: 'The status epilepticus card tells the team not to wait for cEEG if it is not available. Wrong either way costs seizure time.',
    ask: 'Neurology, or whoever runs your EEG service.',
    placeholder: '«cEEG AVAILABLE? — NOT ANSWERED»',
    example: false,
    surfaces: ['/codes/ status epilepticus card'] },

  { key: 'caps.replantCenter', section: 'C', type: 'bool', required: 'sim',
    q: 'Are you a replantation/hand center?',
    why: 'Decides whether an amputation card is about preservation-and-transfer or about definitive care.',
    ask: 'Orthopedics or hand surgery.',
    placeholder: '«REPLANT CENTER? — NOT ANSWERED»',
    example: false,
    surfaces: ['/trauma/ amputation card'] },

  { key: 'caps.edSecurityOvernight', section: 'C', type: 'bool', required: 'sim',
    q: 'Is there a dedicated ED security officer in the building overnight?',
    why: 'Pairs with contacts.security above. Stated in the penetrating-trauma card.',
    ask: 'Your night charge nurses.',
    placeholder: '«OVERNIGHT ED SECURITY? — NOT ANSWERED»',
    example: false,
    surfaces: ['/trauma/'] },

  { key: 'caps.criticalAccess', section: 'C', type: 'bool', required: 'go-live',
    q: 'Are you a rural / critical-access hospital with a limited resuscitation team?',
    why: 'Drives the traumatic-arrest team model below, and the framing of several transfer decisions.',
    ask: 'You know this one.',
    placeholder: '«CRITICAL ACCESS? — NOT ANSWERED»',
    example: true,
    surfaces: ['/tca/'] },

  { key: 'caps.tcaTeamModel', section: 'C', type: 'choice', required: 'go-live',
    choices: ['sequential', 'simultaneous'],
    q: 'In a traumatic cardiac arrest, does your team work the reversible causes in priority ORDER (sequential — a small team) or in PARALLEL (simultaneous — a full trauma team)?',
    why: 'This is picked once per site at localization and is not a bedside control. It changes the entire structure of the traumatic-arrest screen, because a four-person team cannot do in parallel what a twenty-person team can.',
    ask: 'Count the people who actually arrive for a trauma activation at 3am. That number is the answer, not the daytime one.',
    placeholder: '«SEQUENTIAL OR SIMULTANEOUS? — NOT ANSWERED»',
    example: 'sequential',
    surfaces: ['/tca/ (whole screen structure)'] },

  { key: 'caps.obOnSite', section: 'C', type: 'bool', required: 'go-live',
    q: 'Is there obstetric coverage in the building, and how fast can they be at the bedside?',
    why: 'Every OB card branches on whether help is coming or whether the ED is on its own.',
    ask: 'OB. Ask for the realistic 3am number, not the policy number.',
    placeholder: '«OB IN HOUSE? — NOT ANSWERED»',
    example: true,
    surfaces: ['/ob-neonatal/', '/pph/', '/dystocia/', '/neonatal/'] },

  /* ========================= D — YOUR EQUIPMENT ========================= */
  { key: 'defib.mfr', section: 'D', type: 'text', required: 'go-live',
    q: 'What monitor/defibrillator do you run, in full?',
    why: 'Printed next to the joule settings so the person holding the paddles can confirm the card is describing the box in front of them.',
    ask: 'Look at it. Then check whether every code cart in the department has the same one — mixed fleets are common and are exactly the situation this field exists for.',
    placeholder: '«YOUR DEFIBRILLATOR»',
    example: 'ZOLL Rectilinear Biphasic',
    surfaces: ['/codes/ card 01', '/arrest/'] },

  { key: 'defib.mfrShort', section: 'D', type: 'text', required: 'go-live',
    q: 'Short name for it.',
    why: 'Used in tight UI where the full name will not fit.',
    ask: 'As above.',
    placeholder: '«DEFIB»',
    example: 'ZOLL',
    surfaces: ['/arrest/'] },

  { key: 'defib.adultJoules', section: 'D', type: 'list', required: 'go-live',
    q: 'What escalating adult shock energies does YOUR device specify — first, second, third and beyond?',
    why: 'Device-specific and not interchangeable. A biphasic truncated-exponential device and a rectilinear biphasic device have different manufacturer-specified sequences, and the manual must print yours.',
    ask: 'The device label, then biomed to confirm the configured protocol matches the label.',
    placeholder: '«J1»/«J2»/«J3»',
    example: '120, 150, 200',
    surfaces: ['/codes/ card 01', '/arrest/ shock button'],
    invariant: 'Whatever you set, the suite still asserts that energies ESCALATE and then PLATEAU — that part is not localizable.' },

  /* ======================== E — YOUR LABORATORY ========================= */
  { key: 'trop.assayName', section: 'E', type: 'text', required: 'go-live',
    q: 'Exactly which high-sensitivity troponin assay does your lab run (manufacturer and platform)?',
    why: 'Every other number in this section is meaningless without it, and the disclaimer on every tool says "thresholds are assay-specific — verify locally". This is the field that sentence is about.',
    ask: 'Your lab director. Ask for the assay AND the package insert; the cutoffs come from the insert, not from a paper about a different assay.',
    placeholder: '«YOUR hs-TROPONIN ASSAY»',
    example: 'Not stated in the repo — LRH\'s numbers are in ng/L',
    surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.units', section: 'E', type: 'text', required: 'go-live',
    q: 'What units does your assay report in?',
    why: 'ng/L and ng/mL differ by a factor of a thousand. This is the single most consequential unit field in the manual.',
    ask: 'Lab.',
    placeholder: '«UNITS»',
    example: 'ng/L',
    surfaces: ['/clinical-pathways/heart/ — every displayed number'] },

  { key: 'trop.ruleInValue', section: 'E', type: 'number', required: 'go-live',
    q: 'At or above what single value does your pathway rule ACS in?',
    why: 'Rules a patient in to admission and anticoagulation.',
    ask: 'Cardiology + lab, from your assay\'s validated pathway.',
    placeholder: '«RULE-IN»', example: 50, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.ruleInDelta', section: 'E', type: 'number', required: 'go-live',
    q: 'What 0/1-hour (or 0/3-hour) change rules in?',
    why: 'Catches the rising troponin that is still below the absolute cutoff.',
    ask: 'As above.',
    placeholder: '«DELTA-IN»', example: 15, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.ruleOutValue', section: 'E', type: 'number', required: 'go-live',
    q: 'Below what value, with a small delta, do you rule out?',
    why: 'Sends a patient home. The consequence of a wrong number here is a missed infarct.',
    ask: 'As above.',
    placeholder: '«RULE-OUT»', example: 5, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.ruleOutDelta', section: 'E', type: 'number', required: 'go-live',
    q: 'What delta counts as "small" for that rule-out?',
    why: 'As above.',
    ask: 'As above.',
    placeholder: '«DELTA-OUT»', example: 4, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.ruleOutPainValue', section: 'E', type: 'number', required: 'go-live',
    q: 'Below what single value, in a patient with chest pain for longer than the duration threshold, do you rule out on one troponin?',
    why: 'The single-draw discharge. Fastest path in the pathway and the least forgiving.',
    ask: 'As above.',
    placeholder: '«PAIN RULE-OUT»', example: 4, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.singleLoD', section: 'E', type: 'number', required: 'go-live',
    q: 'What is your assay\'s limit of detection?',
    why: 'A result at or below detection can complete the pathway on a single draw.',
    ask: 'Package insert.',
    placeholder: '«LoD»', example: 3, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.painHours', section: 'E', type: 'number', required: 'go-live',
    q: 'How many hours of chest pain does your pathway require for the single-troponin rule-out?',
    why: 'Guards against sampling before the troponin has had time to rise.',
    ask: 'As above.',
    placeholder: '«H»', example: 3, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.grayLow', section: 'E', type: 'number', required: 'go-live',
    q: 'Lower bound of the indeterminate ("gray zone") band you want displayed?',
    why: 'Display only, but it is what the clinician reads to know they are in the observe-and-repeat band.',
    ask: 'As above.',
    placeholder: '«GRAY LOW»', example: 5, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.grayHigh', section: 'E', type: 'number', required: 'go-live',
    q: 'Upper bound of that band?',
    why: 'As above.',
    ask: 'As above.',
    placeholder: '«GRAY HIGH»', example: 49, surfaces: ['/clinical-pathways/heart/'] },

  { key: 'trop.normalLimitMale', section: 'E', type: 'number', required: 'go-live',
    q: 'Your assay\'s sex-specific 99th-percentile upper reference limit for males?',
    why: 'Drives the HEART score\'s troponin points, which are scored as multiples of the normal limit.',
    ask: 'Package insert.',
    placeholder: '«M ULN»', example: 19.8, surfaces: ['/clinical-pathways/heart/ HEART score'] },

  { key: 'trop.normalLimitFemale', section: 'E', type: 'number', required: 'go-live',
    q: 'And for females?',
    why: 'As above. Sex-specific limits differ materially; using one for both under-calls in one direction and over-calls in the other.',
    ask: 'Package insert.',
    placeholder: '«F ULN»', example: 14.9, surfaces: ['/clinical-pathways/heart/ HEART score'] },

  /* ========================= F — YOUR FORMULARY ======================== */
  { key: 'formulary.strokeLytic', section: 'F', type: 'text', required: 'go-live',
    q: 'Which thrombolytic does your stroke protocol use, and at what dose?',
    why: 'Tenecteplase and alteplase are dosed completely differently — a single weight-based bolus versus a bolus plus a one-hour infusion. Inheriting the wrong one is a dosing error inside a time-critical pathway.',
    ask: 'Your stroke coordinator or neurology lead. Confirm against the current order set, not last year\'s.',
    placeholder: '«YOUR STROKE LYTIC + DOSE»',
    example: 'tenecteplase (TNK) 0.25 mg/kg IV bolus, max 25 mg',
    surfaces: ['/codes/ card 04 (stroke)', 'Sim 12'] },

  { key: 'formulary.thrombectomyTrigger', section: 'F', type: 'text', required: 'go-live',
    q: 'What triggers a thrombectomy call and CTA at your site?',
    why: 'Decides who gets moved, and how fast.',
    ask: 'Stroke coordinator, and the receiving thrombectomy center — they have an opinion about what they want called.',
    placeholder: '«THROMBECTOMY TRIGGER»',
    example: 'NIHSS ≥6 or FAST-ED ≥4 → CTA and thrombectomy call',
    surfaces: ['/codes/ card 04', 'Sim 12'] },

  { key: 'formulary.reversalAgents', section: 'F', type: 'text', required: 'go-live',
    q: 'Which anticoagulant reversal agents are actually on your formulary and in your pharmacy right now (4F-PCC, andexanet alfa, idarucizumab, vitamin K)?',
    why: 'The reversal card is only useful if it names agents you can obtain. An agent you do not stock is a delay dressed up as a plan.',
    ask: 'Pharmacy. Ask what is physically in the building versus what is on the formulary — they are not the same list.',
    placeholder: '«YOUR REVERSAL AGENTS»',
    example: '4F-PCC and vitamin K stocked; andexanet and idarucizumab not stocked',
    surfaces: ['/codes/ card 10'] },

  { key: 'formulary.rsiInduction', section: 'F', type: 'text', required: 'go-live',
    q: 'Which induction agents do you stock, and which is your default?',
    why: 'The airway ladder deliberately leaves agent choice to the site. Naming your default removes one decision from a bad moment.',
    ask: 'Pharmacy + your airway lead.',
    placeholder: '«YOUR INDUCTION AGENTS»',
    example: 'ketamine (preferred, bronchodilator effect), etomidate',
    surfaces: ['/codes/ card 06', '/airway/'] },

  { key: 'formulary.mtpRatio', section: 'F', type: 'text', required: 'go-live',
    q: 'What product ratio does your massive transfusion protocol issue, and what comes in the first cooler?',
    why: 'Drives the MTP card. Ratios vary and the first cooler\'s contents vary more.',
    ask: 'Blood bank, with the written protocol in hand.',
    placeholder: '«YOUR MTP RATIO / FIRST COOLER»',
    example: '1:1:1 where platelets are available',
    surfaces: ['/codes/ card 12', '/trauma/', '/tca/', '/pph/'] },

  { key: 'formulary.apneicOxLpm', section: 'F', type: 'number', required: 'optional',
    q: 'What apneic-oxygenation nasal-cannula flow does your department use during intubation?',
    why: 'Sources differ (15 vs 20 L/min). The manual flags the divergence rather than silently picking one; set yours so the card stops asking.',
    ask: 'Your airway lead / RT.',
    placeholder: '«L/min»', example: 15, surfaces: ['/codes/ card 06'] },

  /* ==================== G — YOUR PHYSICAL DEPARTMENT ==================== */
  { key: 'physical.cartDrawers', section: 'G', type: 'list', required: 'go-live',
    q: 'How many drawers does your code cart have, and what is in each one, in order from the top?',
    why: 'Every cart label, every "point at the drawer" line in a simulation, and the equipment-readiness map are rendered from this. It is also the fastest thing on this whole list to answer — it takes one walk to the cart.',
    ask: 'Walk to the cart and open it. Do not use the policy document; use the cart.',
    placeholder: '«YOUR CART LAYOUT — see ONBOARDING §G»',
    example: '5 drawers (bottom one deep): 1 Intubation · 2 Surgical + Supraglottic · 3 Meds · 4 Suction + Fluids · 5 IV Supplies + Misc',
    surfaces: ['/labels/', '/equipment-readiness/', '/system/', 'every simulation\'s EQUIPMENT TO STAGE block'] },

  { key: 'physical.supraglotticSizes', section: 'G', type: 'text', required: 'go-live',
    q: 'Which supraglottic airways do you stock, and in exactly which sizes?',
    why: 'The neonatal card will offer a size-1 laryngeal mask because NRP names one. If your smallest is a different device in a different size, the card must say so — this exact mismatch is a real finding at LRH and is why the field exists.',
    ask: 'Open the drawer and read the packets. Sizes are audited one at a time; "supraglottics 1–5: present" hides the only question worth asking.',
    placeholder: '«YOUR SUPRAGLOTTIC SIZES»',
    example: 'i-gel 1–5; LMA 0 and 0.5 (no size 1)',
    surfaces: ['/labels/', '/inventory', '/neonatal/', '/ob-neonatal/'] },

  { key: 'physical.lungIsolation', section: 'G', type: 'text', required: 'sim',
    q: 'For massive hemoptysis, do you stock a bronchial blocker or a double-lumen tube — or is a large single-lumen tube your isolation technique?',
    why: 'The hemoptysis card describes a technique. Which technique depends entirely on what is in your building.',
    ask: 'Anesthesia and your OR — this equipment usually lives there, not in the ED.',
    placeholder: '«LUNG ISOLATION — WHAT DO YOU HAVE?»',
    example: 'Neither blocker nor DLT — the large single-lumen ETT is the isolation technique',
    surfaces: ['/codes/ hemoptysis card', '/labels/'] },

  { key: 'physical.balloonTamponadeTube', section: 'G', type: 'text', required: 'sim',
    q: 'Which balloon tamponade tube do you stock for variceal bleeding, and where is it?',
    why: 'Sengstaken-Blakemore and Minnesota tubes are placed differently. The poster shows one of them.',
    ask: 'Find it physically. This is the classic item everyone believes exists until the night it is needed.',
    placeholder: '«BALLOON TAMPONADE TUBE + LOCATION»',
    example: 'Sengstaken-Blakemore (3-lumen, dual balloon); Minnesota tube not stocked',
    surfaces: ['/posters/blakemore/', '/codes/ card 23', 'Sim 16'] },

  { key: 'physical.resusRoom', section: 'G', type: 'text', required: 'go-live',
    q: 'What do staff call your main resuscitation room or bay?',
    why: 'Named in equipment locations and in every simulation setup.',
    ask: 'Listen to how people say it, not what the door sign says.',
    placeholder: '«YOUR RESUS ROOM»',
    example: 'Room 7 (Resus Bay)',
    surfaces: ['/equipment-readiness/', '/labels/', 'every simulation'] },

  { key: 'physical.simRoom', section: 'G', type: 'text', required: 'optional',
    q: 'Where will you run tabletop simulations?',
    why: 'The VEMS card deck names a room in its setup.',
    ask: 'Your education lead.',
    placeholder: '«WHERE DO YOU RUN SIMS?»',
    example: 'Resus bay or the education room — a table the whole team can stand around',
    surfaces: ['/vems/'] },

  /* ====================== H — YOUR LOCAL PROTOCOLS ===================== */
  { key: 'policy.stroke', section: 'H', type: 'text', required: 'go-live',
    q: 'What is your own stroke protocol document called, and what is its effective date?',
    why: 'The stroke card cites LRH\'s Stroke Alert Role-Based Checklist as its source. Your fork cannot inherit that citation — the document does not govern your department. Either cite yours or state plainly that the card is built on published guidance alone.',
    ask: 'Your stroke coordinator. If the honest answer is "we do not have one", write that — an explicit gap is safe; a borrowed citation is not.',
    placeholder: '«NO LOCAL STROKE PROTOCOL CITED — see ONBOARDING §H»',
    example: 'Littleton Regional Hospital Stroke Alert Role-Based Checklist (MD/PA/APRN)',
    surfaces: ['/codes/ card 04 Sources line'] },

  { key: 'policy.ich', section: 'H', type: 'text', required: 'go-live',
    q: 'Your intracranial hemorrhage protocol document?',
    why: 'Same as above — the ICH card\'s blood-pressure goals and agent choices come from a named local document.',
    ask: 'Neurology / your stroke coordinator.',
    placeholder: '«NO LOCAL ICH PROTOCOL CITED»',
    example: 'Littleton Regional Hospital Intracranial Hemorrhage (ICH) Checklist',
    surfaces: ['/codes/ ICH card Sources line'] },

  { key: 'policy.mtp', section: 'H', type: 'text', required: 'go-live',
    q: 'Your massive transfusion protocol policy — name, owner, effective date?',
    why: 'The MTP card follows a specific approved policy rather than a generic guideline, which is the right way round; it just has to be YOUR policy.',
    ask: 'Blood bank or your CMO\'s office.',
    placeholder: '«NO LOCAL MTP POLICY CITED»',
    example: 'Littleton Regional Healthcare, Massive Transfusion Protocol (effective 07/01/2026; owner: Chief Medical Officer)',
    surfaces: ['/codes/ card 12 Sources line'] },

  { key: 'policy.statusEpilepticus', section: 'H', type: 'text', required: 'sim',
    q: 'Your status epilepticus protocol document?',
    why: 'First- and second-line agents and doses on that card come from a local checklist.',
    ask: 'Neurology / pharmacy.',
    placeholder: '«NO LOCAL STATUS EPILEPTICUS PROTOCOL CITED»',
    example: 'Littleton Regional Hospital Status Epilepticus Checklist',
    surfaces: ['/codes/ status epilepticus Sources line'] },

  { key: 'policy.asthma', section: 'H', type: 'text', required: 'sim',
    q: 'Your status asthmaticus protocol document — including your ventilator model and its BiPAP settings?',
    why: 'The asthma card names a specific ventilator and its settings. Ventilator settings are not portable between models.',
    ask: 'Respiratory therapy.',
    placeholder: '«NO LOCAL ASTHMA PROTOCOL CITED»',
    example: 'Littleton Regional Hospital Status Asthmaticus Management Checklist (Vision 2000 BiPAP settings)',
    surfaces: ['/codes/ asthma card Sources line'] },

  { key: 'policy.angioedema', section: 'H', type: 'text', required: 'sim',
    q: 'Your angioedema protocol document?',
    why: 'The histaminergic/bradykinin branch point and the airway approach on that card come from a local checklist.',
    ask: 'Your airway lead / allergy.',
    placeholder: '«NO LOCAL ANGIOEDEMA PROTOCOL CITED»',
    example: 'Littleton Regional Hospital Angioedema Management Checklist',
    surfaces: ['/codes/ angioedema card Sources line', 'Sim 9'] },

  { key: 'policy.tracheostomy', section: 'H', type: 'text', required: 'sim',
    q: 'Your tracheostomy emergency protocol or training rubric?',
    why: 'That card was converted from a local scoring rubric into a bedside checklist.',
    ask: 'Your education lead or ENT.',
    placeholder: '«NO LOCAL TRACHEOSTOMY PROTOCOL CITED»',
    example: 'Littleton Regional Hospital "Granular Rubric for Evaluating a Tracheostomy Emergency"',
    surfaces: ['/codes/ tracheostomy card Sources line'] },

  { key: 'policy.pedsOrderSet', section: 'H', type: 'text', required: 'sim',
    q: 'Your pediatric order set / power plan, and in which EHR?',
    why: 'Several pediatric doses on the peds tool are taken from a named local order set rather than from a guideline.',
    ask: 'Pharmacy or your EHR team.',
    placeholder: '«NO LOCAL PEDS ORDER SET CITED»',
    example: 'LRH Pediatric General PowerPlan (Cerner order set)',
    surfaces: ['/peds/ croup and other Sources lines'] },

  { key: 'policy.stemiActivation', section: 'H', type: 'text', required: 'go-live',
    q: 'What is your STEMI activation process — who gets paged, by whom, and on what number?',
    why: 'The STEMI card asks you to confirm this locally and cannot proceed usefully without it.',
    ask: 'Cardiology + your ED charge nurse. Then run Sim 13 and time it.',
    placeholder: '«YOUR STEMI ACTIVATION PROCESS — see ONBOARDING §H»',
    example: 'No on-site cath lab — transfer center call, see contacts.transfer',
    surfaces: ['/codes/ card 21', 'Sim 13'] },

  /* ====================== I — DIALECT & WORDING ======================== */
  { key: 'dialect.variant', section: 'I', type: 'choice', required: 'optional',
    choices: ['US', 'Commonwealth'],
    q: 'US or Commonwealth medical English?',
    why: 'Drug names and spelling in generated strings. Search terms have to match what is on screen or the manual stops being findable under pressure.',
    ask: 'Look at your own order sets.',
    placeholder: 'US', example: 'US',
    surfaces: ['generated dose strings in /arrest/ and others; see TERMINOLOGY.md'] },

  /* ====================== J — REVIEW & SIGN-OFF ======================== */
  { key: 'review.reviewer', section: 'J', type: 'text', required: 'go-live',
    q: 'Who at your site is clinically signing off on this manual?',
    why: 'Printed in the version stamp on every screen. An unsigned manual should say so out loud rather than look finished.',
    ask: 'Your ED medical director. This is a real accountability question, not a form field.',
    placeholder: '«NOT LOCALLY REVIEWED»',
    example: 'Lon Setnik',
    surfaces: ['version stamp, every tool'] },

  { key: 'review.date', section: 'J', type: 'text', required: 'go-live',
    q: 'On what date did that review happen (YYYY-MM-DD)?',
    why: 'Printed in the version stamp. A stale date is information; a missing one is a warning.',
    ask: 'As above.',
    placeholder: '«NOT REVIEWED»',
    example: '2026-08-12',
    surfaces: ['version stamp, every tool'] },
];

/* --- derived helpers, used by build.mjs / gen_onboarding / verify ---------- */

export function fieldByKey(key) {
  return FIELDS.find(f => f.key === key) || null;
}

/** Read a dot path out of the answers object. Returns undefined if absent. */
export function readPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** True when an answer counts as given. null / '' / [] are all "unanswered". */
export function isAnswered(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;   // false and 0 are real answers
}
