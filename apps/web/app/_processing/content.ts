/**
 * The words on the record-of-processing page.
 *
 * Held in a constant because `check-copy.mjs` refuses a sentence in a page, and because these are
 * sentences a data-protection reviewer reads closely. They describe what the record IS and what it
 * is not; every fact in the table itself comes from `activities.ts`.
 */
export const PROCESSING_COPY = {
  eyebrow: "Transparency",
  heading: "What we do with personal data.",
  lead: "A record of every processing activity this service performs, what it holds, who receives it, and how long it is kept. Published because a customer's own data-protection obligations depend on being able to check ours.",

  generatedNote:
    "This page is generated from the database schema rather than written about it. A test reads every table in the migrations and fails the build if one is not accounted for here, so the record cannot quietly fall behind the system it describes.",

  roleHeading: "Controller or processor",
  roleNote:
    "For account records this company decides the purpose and is the controller. For the figures read out of a customer's connected platforms it acts on that customer's instructions and is the processor, which means a request from one of their data subjects goes to them and not to us.",

  retentionHeading: "Retention",
  retentionNote:
    "Most rows here have no retention period, and that is stated rather than filled in. One period genuinely operates: a pending authorisation is deleted after an hour. One is declared in code and does not run, and says so.",

  tableHeadings: {
    purpose: "Purpose",
    role: "Role",
    subjects: "Whose data",
    categories: "What is held",
    basis: "Why",
    recipients: "Who receives it",
    retention: "How long",
    tables: "Where",
  },

  noRetention: "No period is set.",
  noRecipients: "Stays in the primary database.",

  cleanHeading: "Tables that hold no personal data",
  cleanNote:
    "Listed with the reason, because a judgement nobody wrote down is one that stops being true without anyone noticing.",

  transferHeading: "Sending data out of Thailand",
  transferNote:
    "The controller is registered in Thailand, so every provider that receives personal data receives it across a border. Sections 28 and 29 of the PDPA say what may carry such a transfer. This is what each route says and what this service holds against it, generated from the provider list rather than written alongside it.",
  transferAdequacyUnverified:
    'Whether the Committee has published a list of destinations it treats as adequate could not be established from any source checked. That is recorded as unknown rather than assumed either way, because "no list exists" and "we did not find one" are different findings and only one of them closes a route.',
  transferLimbHeading: "The routes, and what is held against each",
  transferStateLabels: {
    "not-engaged": "Not engaged",
    engaged: "Engaged",
    undetermined: "Open — needs counsel",
  },
  openHeading: "What is not in place",
  openNote:
    "Named here rather than left for a reviewer to discover. No transfer instrument such as standard contractual clauses is in place; no data processing agreement is offered yet; no retention schedule has been set; and no data protection officer has been appointed. Each of those is a decision that needs a person, and none of them is claimed on this page or anywhere else on this site.",
} as const;
