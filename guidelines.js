/* ===========================================================================
   guidelines.js — the manual's UPSTREAM SOURCE REGISTRY (single source).

   Injected by build.mjs wherever a tool's <script> carries the marker
   (slash-star) @guidelines (star-slash) — same mechanism as inventory.js and
   design-system.css, so the deployed page stays self-contained and offline
   (CLAUDE.md rule 1). Consumer today: sources/.
   Read by check_guidelines.mjs (the watcher) and verify_guidelines.mjs.
   Process: GUIDELINE-WATCH.md.

   WHY THIS FILE EXISTS
   The manual cites roughly twenty external bodies. Until now those citations
   lived only as prose inside the tool that used them, which means there was no
   way to answer the two questions that actually matter:

     1. "AHA just published. WHAT IN THIS MANUAL MOVES?"
     2. "When did a human last look at whether NRP still says this?"

   Prose citations cannot answer either. A row here can, because a row names
   the edition the manual is CURRENTLY WRITTEN AGAINST, the tools and cards
   that depend on it, and the date a human last checked it.

   THE HONEST DEFAULT: lastVerified:null
   A null lastVerified means NOBODY HAS CHECKED THIS SOURCE THROUGH THIS
   PROCESS YET. It is not the same as "checked and fine", and the watcher
   reports it as NEVER VERIFIED rather than quietly counting it as current —
   the same distinction inventory.js draws between NOT REVIEWED and GAP. Every
   row ships null on day one because the registry is new; they turn into real
   dates as Lon works the first watch report. Do not backfill a date you did
   not actually verify — a fake date silently buys 180 days of false calm.

   `citedSince` is the separate, weaker fact: the last-reviewed stamp of the
   tool whose content came from this source. It says when the CONTENT was last
   looked at, not when the SOURCE was.

   FIELDS
     id          stable key; never reuse or renumber.
     body        publishing organization, as a clinician says it.
     title       what the document is called.
     edition     THE EDITION THIS MANUAL IS WRITTEN AGAINST. The single most
                 important field: a watch hit is only interesting relative to
                 this. Update it when the manual is actually reconciled to a
                 newer edition — not when the newer edition is merely noticed.
     citation    short human citation for the footer / issue text.
     url         the body's canonical guideline landing page.
     cadence     how often this body republishes, in plain English. Drives
                 reviewEvery and tells a human whether a quiet year is normal.
     reviewEvery days after which a human must look regardless of what the
                 crawlers did or did not find. The backstop — see the note on
                 detection limits below.
     lastVerified  YYYY-MM-DD a human last checked this source, or null.
     citedSince  YYYY-MM-DD the dependent content was last reviewed.
     impact      'high' | 'medium' | 'low' — how much of the manual moves if
                 this changes. Sorts the report and the page; a high-impact
                 source overdue is the headline, not a footnote.
     dependents  tools and cards that carry numbers from this source. Card
                 anchors where the citation names the card; tool-level
                 otherwise. verify_guidelines.mjs asserts each path exists.
     reconciled  false when the manual carries content from an EARLIER edition
                 than `edition` and everyone knows it (neonatal/ vs NRP 9th).
                 Never let that fact live only in a banner.
     watch       probes for check_guidelines.mjs; [] means calendar-only.

   WHAT THE WATCHER CAN AND CANNOT DO — read before trusting a quiet report.
   Automated detection of "a guideline was republished" is genuinely partial.
   A PubMed probe finds things that get indexed as guidelines in journals; a
   page probe finds visible edits to a landing page. Neither finds a body that
   posts a revised PDF at the same URL with no page change, and both go quiet
   if a site is restructured. THAT IS WHY EVERY ROW ALSO CARRIES reviewEvery.
   The crawler shortens the time to notice; the calendar guarantees the look
   happens. Do not delete a reviewEvery because a probe looks reliable.

   FORKS: CATALOG TRAVELS, DATES ARE LOCAL. Another ED inherits the sources,
   editions, dependents and probes unchanged — that is universal clinical
   provenance. It rewrites lastVerified (its own reviews), and it may drop a
   row whose tool it deleted or add one its own protocols depend on.
   =========================================================================== */

var GDL_SOURCES = [

  /* ---------------- RESUSCITATION ---------------------------------------- */

  { id: "aha-ecc-adult",
    body: "AHA / ILCOR",
    title: "Guidelines for CPR and Emergency Cardiovascular Care — adult BLS and ALS",
    edition: "2025",
    citation: "American Heart Association. 2025 Guidelines for CPR and ECC, Part 7 (Adult BLS) and the adult ALS algorithm set. Circulation.",
    url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines",
    cadence: "Full guidelines roughly every 5 years; focused updates and new algorithm sets in the autumn, driven by the annual ILCOR CoSTR.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-10",
    impact: "high",
    dependents: ["arrest/", "codes/", "vems/", "simulations/", "peds/"],
    watch: [
      { kind: "pubmed", label: "Circulation — resuscitation guidelines",
        term: '"Circulation"[jour] AND (guideline[pt] OR "practice guideline"[pt]) AND (resuscitation[MeSH Terms] OR "cardiac arrest"[tiab] OR "emergency cardiovascular care"[tiab])' },
      { kind: "page", label: "AHA CPR & ECC guidelines landing page",
        url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines" }
    ] },

  { id: "aha-ecc-peds",
    body: "AHA / AAP",
    title: "Guidelines for CPR and ECC, Part 6 — pediatric basic life support (PALS)",
    edition: "2025",
    citation: "American Heart Association / American Academy of Pediatrics. 2025 Guidelines for CPR and ECC, Part 6: Pediatric Basic Life Support. Circulation.",
    url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines",
    cadence: "Published alongside the adult ECC set; same autumn cycle.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-10",
    impact: "high",
    dependents: ["peds/", "arrest/", "codes/", "vems/"],
    watch: [
      { kind: "pubmed", label: "Pediatric resuscitation guidelines",
        term: '("Circulation"[jour] OR "Pediatrics"[jour]) AND (guideline[pt] OR "practice guideline"[pt]) AND ("pediatric advanced life support"[tiab] OR "pediatric basic life support"[tiab] OR ("child"[MeSH Terms] AND resuscitation[MeSH Terms]))' }
    ] },

  { id: "ilcor-costr",
    body: "ILCOR",
    title: "Consensus on Science with Treatment Recommendations (CoSTR)",
    edition: "current",
    citation: "International Liaison Committee on Resuscitation. Consensus on Science with Treatment Recommendations.",
    url: "https://www.ilcor.org/publications/costr",
    cadence: "Continuous evidence evaluation with an annual consolidated CoSTR; it is the upstream input to both AHA and ERC, so it moves FIRST — a CoSTR change is the earliest warning that an AHA or NRP change is coming.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["arrest/", "neonatal/", "codes/"],
    watch: [
      { kind: "page", label: "ILCOR CoSTR publications",
        url: "https://www.ilcor.org/publications/costr" },
      { kind: "pubmed", label: "CoSTR publications",
        term: '"consensus on science with treatment recommendations"[tiab]' }
    ] },

  { id: "erc",
    body: "ERC",
    title: "European Resuscitation Council Guidelines",
    edition: "2021",
    citation: "European Resuscitation Council Guidelines 2021 — special circumstances; traumatic cardiac arrest.",
    url: "https://www.erc.edu/guidelines",
    cadence: "Roughly every 5 years, on the ILCOR cycle. A 2021 edition means a successor is plausible at any time.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-11",
    impact: "medium",
    dependents: ["tca/", "codes/"],
    watch: [
      { kind: "page", label: "ERC guidelines landing page",
        url: "https://www.erc.edu/guidelines" },
      { kind: "pubmed", label: "Resuscitation — ERC guidelines",
        term: '"Resuscitation"[jour] AND (guideline[pt] OR "European Resuscitation Council"[tiab])' }
    ] },

  /* ---------------- NEONATAL --------------------------------------------- */

  { id: "nrp",
    body: "AAP / AHA",
    title: "Neonatal Resuscitation Program (NRP) textbook and algorithm",
    edition: "9th edition",
    citation: "American Academy of Pediatrics / American Heart Association. Textbook of Neonatal Resuscitation, 9th edition; AHA/AAP 2025 Guidelines for CPR and ECC, Part 5: Neonatal Resuscitation.",
    url: "https://www.aap.org/en/learning/neonatal-resuscitation-program/",
    cadence: "New textbook edition roughly every 5–6 years, with a change summary at release and an instructor transition deadline; the guideline half moves on the AHA autumn cycle.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    reconciled: false,
    reconcileNote: "neonatal/ carries content brought over unchanged from ob-neonatal/ card 03 and NOT yet reconciled line-by-line with the NRP 9th edition. The tool shows a review banner and verify_neonatal_screen.mjs fails if the banner is switched off quietly. Flip reconciled to true only when a clinician has signed the reconciliation off — not when the banner is removed.",
    dependents: ["neonatal/", "peds/", "arrest/"],
    watch: [
      { kind: "page", label: "AAP NRP program page",
        url: "https://www.aap.org/en/learning/neonatal-resuscitation-program/" },
      { kind: "pubmed", label: "Neonatal resuscitation guidelines",
        term: '(guideline[pt] OR "practice guideline"[pt]) AND ("neonatal resuscitation"[tiab] OR "newborn resuscitation"[tiab])' }
    ] },

  /* ---------------- AIRWAY ------------------------------------------------ */

  { id: "das-adult",
    body: "DAS",
    title: "Guidelines for management of unanticipated difficult tracheal intubation in adults",
    edition: "2025",
    citation: "Difficult Airway Society. 2025 guidelines for management of unanticipated difficult tracheal intubation in adults. (Supersedes DAS 2015 — the two must not be blended.)",
    url: "https://das.uk.com/guidelines",
    cadence: "Major revisions roughly a decade apart (2015 → 2025); separate sub-guidelines for obstetrics, critical illness and awake intubation appear between them.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-10",
    impact: "high",
    dependents: ["airway/", "codes/#c18", "arrest/", "procedures/"],
    watch: [
      { kind: "page", label: "DAS guidelines index",
        url: "https://das.uk.com/guidelines" },
      { kind: "pubmed", label: "Difficult Airway Society guidelines",
        term: '("Difficult Airway Society"[tiab] OR "difficult tracheal intubation"[ti]) AND (guideline[pt] OR guidelines[ti])' }
    ] },

  { id: "das-subsets",
    body: "DAS / OAA",
    title: "DAS sub-guidelines — obstetric (2015), critically ill adults (2017), awake tracheal intubation (2019)",
    edition: "2015 / 2017 / 2019",
    citation: "Difficult Airway Society and Obstetric Anaesthetists' Association. Obstetric difficult airway guidelines (2015); intubation of the critically ill adult (2017); awake tracheal intubation (2019).",
    url: "https://das.uk.com/guidelines",
    cadence: "Independent of the main adult guideline; each is a candidate for revision now that the 2025 adult guideline has landed.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-10",
    impact: "medium",
    dependents: ["airway/", "ob-neonatal/"],
    watch: [
      { kind: "page", label: "DAS guidelines index",
        url: "https://das.uk.com/guidelines" }
    ] },

  /* ---------------- TRAUMA ------------------------------------------------ */

  { id: "atls",
    body: "ACS Committee on Trauma",
    title: "Advanced Trauma Life Support (ATLS)",
    edition: "11th edition (2025)",
    citation: "American College of Surgeons Committee on Trauma. ATLS Student Course Manual, 11th edition (2025) — 'xABCDE' primary survey.",
    url: "https://www.facs.org/quality-programs/trauma/atls/",
    cadence: "New edition roughly every 4–6 years; the 11th edition is recent, so the near-term risk is an erratum or course-material update rather than a new edition.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    dependents: ["trauma/", "tca/", "codes/", "simulations/"],
    watch: [
      { kind: "page", label: "ACS ATLS program page",
        url: "https://www.facs.org/quality-programs/trauma/atls/" }
    ] },

  { id: "acs-tqip",
    body: "ACS Committee on Trauma",
    title: "TQIP Best Practices Guidelines (massive transfusion, TBI)",
    edition: "TBI 2024 rev.; Massive Transfusion 2014",
    citation: "ACS TQIP Best Practices Guidelines: Management of Traumatic Brain Injury (2024 revision); Massive Transfusion in Trauma (2014).",
    url: "https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/",
    cadence: "Individual best-practice guidelines are revised on their own schedules and announced on one index page — which is exactly the pattern a page probe catches and a journal probe misses.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    dependents: ["trauma/", "codes/", "tca/"],
    watch: [
      { kind: "page", label: "ACS best-practices guidelines index",
        url: "https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/" }
    ] },

  { id: "acs-field-triage",
    body: "ACS-COT / CDC",
    title: "National Guideline for the Field Triage of Injured Patients",
    edition: "current",
    citation: "ACS-COT National Expert Panel on Field Triage. National Guideline for the Field Triage of Injured Patients.",
    url: "https://www.facs.org/quality-programs/trauma/systems/",
    cadence: "Revised infrequently; changes ripple straight into activation criteria, which is why it is high impact despite being quiet.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    dependents: ["trauma/"],
    watch: [
      { kind: "page", label: "ACS trauma systems page",
        url: "https://www.facs.org/quality-programs/trauma/systems/" }
    ] },

  { id: "tccc",
    body: "CoTCCC",
    title: "Tactical Combat Casualty Care Guidelines",
    edition: "current edition",
    citation: "Committee on Tactical Combat Casualty Care. TCCC Guidelines, current edition — MARCH framework, tourniquet hierarchy and hold time, iTClamp.",
    url: "https://deployedmedicine.com/",
    cadence: "Rolling: individual proposed changes are adopted between full releases, so 'current edition' is a moving target and the manual cites it as such.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["trauma/", "procedures/"],
    watch: [
      { kind: "page", label: "Deployed Medicine (TCCC materials)",
        url: "https://deployedmedicine.com/" },
      { kind: "page", label: "Joint Trauma System CPGs",
        url: "https://jts.health.mil/index.cfm/PI_CPGs/cpgs" }
    ] },

  { id: "east-pmg",
    body: "EAST",
    title: "Practice Management Guidelines",
    edition: "per-topic",
    citation: "Eastern Association for the Surgery of Trauma. Practice Management Guidelines — blunt cerebrovascular injury, blunt aortic injury, blunt cardiac injury screening, penetrating neck injury, open-fracture prophylaxis.",
    url: "https://www.east.org/education-career-development/practice-management-guidelines",
    cadence: "Topic by topic, continuously; a given PMG can sit unchanged for a decade and then be replaced without warning.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["trauma/", "procedures/"],
    watch: [
      { kind: "page", label: "EAST practice management guidelines index",
        url: "https://www.east.org/education-career-development/practice-management-guidelines" },
      { kind: "pubmed", label: "EAST PMGs in J Trauma Acute Care Surg",
        term: '"J Trauma Acute Care Surg"[jour] AND ("practice management guideline"[tiab] OR guideline[pt])' }
    ] },

  { id: "btf-tbi",
    body: "Brain Trauma Foundation",
    title: "Guidelines for the Management of Severe Traumatic Brain Injury",
    edition: "current",
    citation: "Brain Trauma Foundation. Guidelines for the Management of Severe Traumatic Brain Injury.",
    url: "https://www.braintrauma.org/guidelines/",
    cadence: "Long intervals between editions, with topic updates in between.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["trauma/", "procedures/"],
    watch: [
      { kind: "page", label: "Brain Trauma Foundation guidelines",
        url: "https://www.braintrauma.org/guidelines/" }
    ] },

  /* ---------------- OBSTETRICS ------------------------------------------- */

  { id: "acog-pph",
    body: "ACOG",
    title: "Practice Bulletin 183 — Postpartum Hemorrhage",
    edition: "PB 183",
    citation: "American College of Obstetricians and Gynecologists. Practice Bulletin 183: Postpartum Hemorrhage. Cited alongside the AIM Obstetric Hemorrhage safety bundle.",
    url: "https://www.acog.org/clinical/clinical-guidance",
    cadence: "ACOG reaffirms, replaces or withdraws Practice Bulletins on a rolling basis and renumbers on replacement — a replaced bulletin is the single most likely change here.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    dependents: ["pph/"],
    watch: [
      { kind: "page", label: "ACOG clinical guidance index",
        url: "https://www.acog.org/clinical/clinical-guidance" },
      { kind: "pubmed", label: "Obstetric hemorrhage guidance",
        term: '"Obstet Gynecol"[jour] AND ("practice bulletin"[tiab] OR guideline[pt]) AND ("postpartum hemorrhage"[tiab] OR "obstetric hemorrhage"[tiab])' }
    ] },

  { id: "acog-dystocia",
    body: "ACOG",
    title: "Practice Bulletin 178 — Shoulder Dystocia",
    edition: "PB 178",
    citation: "American College of Obstetricians and Gynecologists. Practice Bulletin 178: Shoulder Dystocia.",
    url: "https://www.acog.org/clinical/clinical-guidance",
    cadence: "As above — rolling reaffirmation or replacement.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "high",
    dependents: ["dystocia/"],
    watch: [
      { kind: "page", label: "ACOG clinical guidance index",
        url: "https://www.acog.org/clinical/clinical-guidance" },
      { kind: "pubmed", label: "Shoulder dystocia guidance",
        term: '"Obstet Gynecol"[jour] AND ("practice bulletin"[tiab] OR guideline[pt]) AND "shoulder dystocia"[tiab]' }
    ] },

  { id: "acog-htn",
    body: "ACOG",
    title: "Practice Bulletin 222 (gestational hypertension and preeclampsia) and Committee Opinion 767 (acute-onset severe hypertension)",
    edition: "PB 222 (2020) / CO 767 (2019)",
    citation: "ACOG Practice Bulletin 222: Gestational Hypertension and Preeclampsia (Obstet Gynecol 2020;135); ACOG Committee Opinion 767: Emergent Therapy for Acute-Onset, Severe Hypertension During Pregnancy and the Postpartum Period (2019).",
    url: "https://www.acog.org/clinical/clinical-guidance",
    cadence: "As above. The antihypertensive doses in these two documents are the ones the manual prints.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-07",
    impact: "high",
    dependents: ["ob-neonatal/"],
    watch: [
      { kind: "page", label: "ACOG clinical guidance index",
        url: "https://www.acog.org/clinical/clinical-guidance" },
      { kind: "pubmed", label: "Severe hypertension in pregnancy guidance",
        term: '"Obstet Gynecol"[jour] AND ("practice bulletin"[tiab] OR "committee opinion"[tiab] OR guideline[pt]) AND (preeclampsia[tiab] OR "severe hypertension"[tiab])' }
    ] },

  /* ---------------- EMERGENCY MEDICINE / SPECIALTY ------------------------ */

  { id: "acep-policies",
    body: "ACEP",
    title: "Clinical Policies",
    edition: "per-topic (mild TBI 2023; hyperactive delirium task force 2021; procedural sedation)",
    citation: "American College of Emergency Physicians. Clinical Policy: mild traumatic brain injury (Feb 2023); ACEP Task Force report on hyperactive delirium (2021); clinical policy on procedural sedation and fasting.",
    url: "https://www.acep.org/patient-care/clinical-policies",
    cadence: "Topic by topic; each policy is revised on its own multi-year cycle and announced on one index page.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["trauma/", "codes/", "peds/"],
    watch: [
      { kind: "page", label: "ACEP clinical policies index",
        url: "https://www.acep.org/patient-care/clinical-policies" },
      { kind: "pubmed", label: "Ann Emerg Med clinical policies",
        term: '"Ann Emerg Med"[jour] AND ("clinical policy"[ti] OR guideline[pt])' }
    ] },

  { id: "aap-cpg",
    body: "AAP",
    title: "Clinical Practice Guidelines and Clinical Reports (febrile infant, sedation monitoring, child abuse)",
    edition: "febrile infant 2021; sedation (AAP/AAPD)",
    citation: "American Academy of Pediatrics. Clinical Practice Guideline: Evaluation and Management of Well-Appearing Febrile Infants 8–60 Days Old (2021); AAP/AAPD Guidelines for Monitoring and Management of Pediatric Patients Before, During and After Sedation; AAP clinical reports on abusive head trauma and evaluating fractures for abuse.",
    url: "https://publications.aap.org/pediatrics",
    cadence: "Individual CPGs and clinical reports appear continuously in Pediatrics; the febrile-infant CPG in particular is the sort that gets a formal update.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-07",
    impact: "high",
    dependents: ["peds/"],
    watch: [
      { kind: "pubmed", label: "AAP clinical practice guidelines",
        term: '"Pediatrics"[jour] AND (guideline[pt] OR "clinical practice guideline"[ti] OR "clinical report"[ti])' }
    ] },

  { id: "aha-asa-stroke",
    body: "AHA / ASA",
    title: "Stroke and intracerebral hemorrhage guidelines",
    edition: "acute ischemic stroke 2019; spontaneous ICH (current)",
    citation: "AHA/ASA. 2019 Guidelines for the Early Management of Patients With Acute Ischemic Stroke; AHA/ASA Guideline for the Management of Patients With Spontaneous Intracerebral Hemorrhage.",
    url: "https://professional.heart.org/en/guidelines-and-statements",
    cadence: "Roughly every 4–6 years per topic, with focused updates between. A 2019 stroke guideline is overdue for a successor on that cycle.",
    reviewEvery: 180,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "high",
    dependents: ["codes/"],
    watch: [
      { kind: "pubmed", label: "Stroke / ICH guidelines",
        term: '("Stroke"[jour] OR "Circulation"[jour]) AND (guideline[pt] OR "practice guideline"[pt]) AND ("ischemic stroke"[tiab] OR "intracerebral hemorrhage"[tiab])' },
      { kind: "page", label: "AHA professional guidelines and statements",
        url: "https://professional.heart.org/en/guidelines-and-statements" }
    ] },

  { id: "acc-aha-acs",
    body: "ACC / AHA",
    title: "Acute coronary syndromes guideline and the aortic disease guideline",
    edition: "ACS 2025 (ACC/AHA/ACEP/NAEMSP/SCAI); aortic disease 2022",
    citation: "2025 ACC/AHA/ACEP/NAEMSP/SCAI guideline for the management of patients with acute coronary syndromes; 2022 ACC/AHA guideline for the diagnosis and management of aortic disease (Circulation 2022;146:e334).",
    url: "https://professional.heart.org/en/guidelines-and-statements",
    cadence: "Per topic, every 5–10 years, with the joint societies publishing simultaneously in Circulation and JACC.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "medium",
    dependents: ["codes/", "clinical-pathways/heart/"],
    watch: [
      { kind: "pubmed", label: "ACS / aortic disease guidelines",
        term: '("Circulation"[jour] OR "J Am Coll Cardiol"[jour]) AND (guideline[pt] OR "practice guideline"[pt]) AND ("acute coronary syndrome"[tiab] OR "aortic disease"[tiab] OR "myocardial infarction"[tiab])' }
    ] },

  { id: "esc-pe",
    body: "ESC",
    title: "Guidelines on the diagnosis and management of acute pulmonary embolism",
    edition: "2019",
    citation: "European Society of Cardiology. 2019 Guidelines for the diagnosis and management of acute pulmonary embolism (Eur Heart J 2019;41:543).",
    url: "https://www.escardio.org/Guidelines",
    cadence: "ESC revises on a roughly 5-year cycle and announces the year's guidelines at its annual congress; a 2019 document is a live candidate for replacement.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "medium",
    dependents: ["codes/"],
    watch: [
      { kind: "page", label: "ESC clinical practice guidelines",
        url: "https://www.escardio.org/Guidelines" },
      { kind: "pubmed", label: "ESC pulmonary embolism guidelines",
        term: '"Eur Heart J"[jour] AND (guideline[pt] OR guidelines[ti]) AND "pulmonary embolism"[tiab]' }
    ] },

  { id: "heart-score",
    body: "Primary literature",
    title: "HEART score derivation/validation and the 0/1-hour high-sensitivity troponin ADP",
    edition: "derivation + validation cohort",
    citation: "Six AJ, Backus BE, et al. (HEART score derivation and validation); Mahler SA, et al. (HEART Pathway trials); the 0/1-hour hs-troponin accelerated diagnostic protocol as posted locally.",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=HEART+score+chest+pain",
    cadence: "A score, not a guideline — the math does not change. What changes is the ASSAY-SPECIFIC cutoffs, which are LOCAL (SITE CONFIG) and must be re-checked against the lab's posted protocol, not against a journal.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-07",
    impact: "medium",
    dependents: ["clinical-pathways/heart/"],
    watch: [] },

  /* ---------------- KIT, TRANSFUSION AND STANDARDS ------------------------ */

  { id: "aabb-transfusion",
    body: "AABB / CDC",
    title: "Transfusion reaction definitions and management",
    edition: "AABB Technical Manual; CDC NHSN hemovigilance definitions",
    citation: "AABB Technical Manual (transfusion reactions chapter); CDC NHSN Hemovigilance Module surveillance definitions.",
    url: "https://www.aabb.org/",
    cadence: "Technical Manual editions every few years; NHSN definitions updated on the CDC's protocol cycle.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "low",
    dependents: ["codes/"],
    watch: [] },

  { id: "equipment-standards",
    body: "Multiple (see inventory.js)",
    title: "The seven equipment standards scored by equipment-readiness/",
    edition: "per standard — see INV_STANDARDS",
    citation: "NPRP, ACS-COT, ASA difficult airway, NRP, AIM, MHAUS and ASRA equipment expectations, each cited in inventory.js INV_STANDARDS.",
    url: "https://www.facs.org/quality-programs/trauma/quality/",
    cadence: "Each standard moves independently. INV_STANDARDS holds the real citation for each; this row exists so the readiness scorecard is not the only place a standard's age is visible.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-12",
    impact: "medium",
    dependents: ["equipment-readiness/", "labels/", "system/"],
    watch: [] },

  /* ---------------- INSTITUTIONAL AND TERTIARY REFERENCES ------------------
     Not guidelines and not on a publication cycle. They are here because the
     manual prints numbers from them, and a number with no owner in this
     registry is a number nobody is watching. Calendar-only by nature.       */

  { id: "alfred-star",
    body: "Alfred Health",
    title: "The Procedures Course / Alfred STAR Program references",
    edition: "as published",
    citation: "Alfred STAR Program (Alfred Health, Melbourne) — procedure references for thoracotomy, burr hole, escharotomy, canthotomy, hysterotomy, CVC, chest tube, transvenous pacing.",
    url: "https://www.alfredhealth.org.au/",
    cadence: "An institutional teaching program, not a versioned guideline: it can revise a card silently. Note that procedures/ already carries one instance of an Alfred card superseding an older internal reference.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "medium",
    dependents: ["procedures/", "posters/"],
    watch: [] },

  { id: "rmh-tca",
    body: "Royal Melbourne Hospital",
    title: "Trauma Service — Traumatic Cardiac Arrest Guideline (TRM08)",
    edition: "TRM08",
    citation: "Royal Melbourne Hospital Trauma Service. Traumatic Cardiac Arrest Guideline (TRM08).",
    url: "https://www.thermh.org.au/",
    cadence: "A single institution's protocol, revised on its own internal cycle with no public announcement.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-11",
    impact: "medium",
    dependents: ["tca/"],
    watch: [] },

  { id: "tertiary-refs",
    body: "WikEM / LITFL / EMCrit IBCC / StatPearls",
    title: "Continuously-edited tertiary references",
    edition: "living",
    citation: "WikEM, Life in the Fast Lane, EMCrit Internet Book of Critical Care, StatPearls — used where no society guideline covers the question (hyperkalemia dosing, balloon tamponade, epiglottitis, croup, needle cricothyrotomy in children).",
    url: "https://wikem.org/",
    cadence: "Edited continuously with no editions and no announcements. Change detection is meaningless here; the only real control is a periodic human re-read of the specific pages the manual leans on.",
    reviewEvery: 365,
    lastVerified: null,
    citedSince: "2026-08-09",
    impact: "medium",
    dependents: ["codes/", "peds/", "procedures/"],
    watch: [] }

];

/* ===== DERIVED — do not hand-maintain anything below ======================= */

/* Sources that depend on a given tool path, e.g. gdlForTool('neonatal/').
   Matches on the tool prefix so a card-anchored dependent still counts. */
function gdlForTool(path){
  return GDL_SOURCES.filter(function(s){
    return s.dependents.some(function(d){ return d === path || d.indexOf(path) === 0; });
  });
}

/* Whole-number days between two YYYY-MM-DD dates, b - a. */
function gdlDaysBetween(a, b){
  var ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.floor(ms / 86400000);
}

/* Freshness of one source as of `today` (YYYY-MM-DD).

   never    — lastVerified is null: nobody has checked it through this process.
   overdue  — past reviewEvery.
   due      — inside the last 30 days of the window; time to schedule it.
   current  — checked, and inside the window.

   'never' is deliberately NOT folded into 'overdue': a source nobody has ever
   looked at and a source checked 200 days ago are different problems, and the
   first one is the one a new fork has twenty of. */
function gdlStatus(src, today){
  if (!src.lastVerified) return 'never';
  var age = gdlDaysBetween(src.lastVerified, today);
  if (age > src.reviewEvery) return 'overdue';
  if (age > src.reviewEvery - 30) return 'due';
  return 'current';
}

/* Sort order for report and page: worst first, then by impact, then by body.
   An overdue high-impact source must never sort below a current low-impact one. */
var GDL_STATUS_RANK = { never:0, overdue:1, due:2, current:3 };
var GDL_IMPACT_RANK = { high:0, medium:1, low:2 };
function gdlSort(list, today){
  return list.slice().sort(function(a, b){
    var d = GDL_STATUS_RANK[gdlStatus(a, today)] - GDL_STATUS_RANK[gdlStatus(b, today)];
    if (d) return d;
    d = GDL_IMPACT_RANK[a.impact] - GDL_IMPACT_RANK[b.impact];
    if (d) return d;
    return a.body < b.body ? -1 : a.body > b.body ? 1 : 0;
  });
}

/* Every distinct tool path named as a dependent — used by verify_guidelines.mjs
   to assert that the registry never points at a tool that does not exist. */
var GDL_DEPENDENT_PATHS = (function(){
  var seen = {};
  GDL_SOURCES.forEach(function(s){
    s.dependents.forEach(function(d){ seen[d.split('#')[0]] = true; });
  });
  return Object.keys(seen).sort();
})();

/* Node (check_guidelines.mjs, verify_guidelines.mjs) reads this file by
   evaluating it; the browser gets the same globals via build injection. */
try { if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GDL_SOURCES: GDL_SOURCES, gdlForTool: gdlForTool,
    gdlDaysBetween: gdlDaysBetween, gdlStatus: gdlStatus, gdlSort: gdlSort,
    GDL_DEPENDENT_PATHS: GDL_DEPENDENT_PATHS };
} } catch(e){}
