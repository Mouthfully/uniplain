import { brand } from "@repo/brand";

/**
 * THE DATA PROCESSING AGREEMENT, AS A PDPA s.40 INSTRUMENT AND NOT A GDPR ARTICLE 28 ONE.
 *
 * WHAT THIS IS AND IS NOT, because the difference decides which customers it serves.
 *
 * PDPA s.40 requires that "the Data Controller shall prepare an agreement between the parties to
 * control the activities carried out by the Data Processor". In a business sale the controller is
 * the CUSTOMER, so the duty is theirs and what this company owes is the ability to enter one and
 * the facts it rests on. A vendor who cannot produce this is one their reviewer cannot clear.
 *
 * This is that agreement, for the Thai law that actually binds `brand.legalEntity` today. It is
 * NOT an Article 28 GDPR agreement: `brand.euRepresentative` is null, GDPR applicability under
 * Art. 3(2) has never been decided, and `claims.ts` withholds the `dpa` claim on BOTH
 * `dpaAvailable` and `euRepresentative` for that reason. Shipping this flips the first fact and
 * leaves the claim withheld, which is the correct outcome rather than an awkward one: the company
 * now has a PDPA agreement and still may not advertise Article 28 terms.
 *
 * WHY IT IS SAFE FOR THIS FILE TO EXIST, given the repository's rule against inventing facts. The
 * clauses below are of two kinds. The OBLIGATIONS are commitments this company chooses to make --
 * a company may always promise to do something, and a promise is not a claim about the world. The
 * DESCRIPTIONS -- what is processed, by whom, where it goes, how long it is kept -- are all derived
 * from `activities.ts` and `sub-processors.ts` and asserted against them by `dpa.test.tsx`, so the
 * agreement cannot drift from what the software does. That is the part a template cannot give you
 * and the part a reviewer actually tests.
 *
 * IT STILL NEEDS COUNSEL BEFORE FIRST COMMERCIAL USE. Whether these terms meet s.40 in the PDPC's
 * view, and how they interact with the cross-border transfer position, are legal judgements no file
 * here can make. That sentence is printed on the page rather than kept in a comment.
 */
export const DPA_VERSION = "2026-09-13";

export const DPA_COPY = {
  eyebrow: "For business customers",
  heading: "Data processing agreement.",
  lead: "The terms on which this company processes personal data on a customer's behalf, under section 40 of Thailand's Personal Data Protection Act.",

  versionLabel: "Version",
  versionNote:
    "This version applies to accounts from the date shown. If the terms change, the version changes with them and the previous text stays available on request.",

  reviewHeading: "Before you rely on this",
  reviewNote:
    "These terms were drafted to describe accurately what the software does, and every factual statement in them is checked against the system by an automated test. Whether they satisfy section 40 in the Personal Data Protection Committee's view is a legal question, and a customer whose own obligations depend on the answer should have their adviser read them. Nothing on this page claims a regulator has approved it.",

  rolesHeading: "1. Who is who",
  rolesBody: [
    `For the data read out of a customer's own connected platform accounts, the customer is the data controller and ${brand.legalEntity} is the data processor. The customer decides what their platform accounts contain and why the service reads them.`,
    `For the customer's own account records with this service — who belongs to an organisation, who signed in, what was billed — ${brand.legalEntity} is the controller. Those are described in the privacy notice and are not the subject of this agreement.`,
  ],

  instructionsHeading: "2. Processing only on instruction",
  instructionsBody: [
    "Personal data processed on the customer's behalf is processed only to provide the service the customer has asked for: reading the accounts they have connected, normalising what is read into one shape, and reporting on it to them.",
    "It is not used for any other purpose. It is not pooled with another customer's data, not used to benchmark one customer against another, not sold, not licensed, and not used to train any model. If an instruction from the customer appears to require something unlawful, this company will say so rather than carry it out.",
  ],

  scopeHeading: "3. What is processed",
  scopeIntro:
    "The categories below are the ones the system actually holds, listed in the record of processing and kept in step with it by an automated test.",

  securityHeading: "4. Security",
  securityBody: [
    "Credentials for a connected platform are encrypted before storage and are never held by this application in a form it can read. Each customer's data is separated at the database level rather than by application code, and that separation is tested against a hostile session on every build.",
    "Security-relevant actions are recorded in an append-only trail that no customer and no member of their organisation can edit or delete.",
    "No claim is made on this page that any of this has been audited or certified by anyone. It has not been.",
  ],

  breachHeading: "5. Telling the customer about a breach",
  breachBody: [
    "If personal data processed on a customer's behalf is breached, this company will notify that customer without undue delay after becoming aware of it, with what is known at the time and what is still being established.",
    "The obligation to notify the Personal Data Protection Committee, and any obligation to notify the people affected, sits with the customer as controller. This company will provide what the customer reasonably needs in order to do it.",
  ],

  subProcessorHeading: "6. Sub-processors",
  subProcessorBody: [
    "The service is run with the help of the providers listed on the sub-processors page, which names each one and what it does. That page is generated from the same record the rest of this agreement is generated from.",
    "If a provider is added or replaced, that page changes. No notice period is promised here, because no mechanism exists to give one and a stated period would be a commitment nothing keeps.",
  ],

  rightsHeading: "7. Helping with requests from data subjects",
  rightsBody: [
    "A request from one of the customer's own data subjects — a request to see, correct, take or delete data held in the customer's platform accounts — is the customer's to answer, because the customer is the controller of it. This company will pass on any such request it receives and will help the customer answer it.",
    "A person whose data is held in this service's own account records may ask about it directly, from the account page or at the contact address in the privacy notice.",
  ],

  deletionHeading: "8. Deletion and return",
  deletionBody: [
    "A customer may export everything their account holds as a single file at any time, and an owner may close the account, which deletes the organisation and the data that belongs to it.",
    "No retention schedule is published for data that nobody has asked about. That is stated plainly rather than filled in with a period nobody has set, and it is the clearest thing outstanding on this page.",
  ],

  transferHeading: "9. Where data goes",
  transferBody: [
    "The company is registered in Thailand and the database is held in Singapore, so data crosses a border to reach the service. The providers involved are named on the sub-processors page.",
    "There is no separate transfer instrument in place — no standard contractual clauses or equivalent — and none is claimed here. A customer whose own obligations depend on holding one should raise it before sending data those obligations cover.",
  ],

  auditHeading: "10. Checking",
  auditBody: [
    "A customer may ask for the information they reasonably need to satisfy themselves that these terms are being met, and this company will provide it. The record of processing and the sub-processor list are published for that purpose and are generated from the system rather than written about it.",
    "There is no third-party audit report to provide, because none exists.",
  ],

  contactHeading: "11. Contact",
  contactLink: "The privacy notice names the address for questions about this agreement.",
} as const;
