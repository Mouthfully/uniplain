import { brand, formatAddress } from "@repo/brand";

import { SECURITY_MEASURES } from "./article-30";
import { PROCESSING_ACTIVITIES } from "./activities";
import { SUB_PROCESSORS } from "./sub-processors";

/**
 * THE ANNEXES TO THE COMMISSION'S STANDARD CONTRACTUAL CLAUSES, GENERATED FROM THE RECORD.
 *
 * Art. 30(1)(e) reports `absent` because no Art. 46 safeguard is in place, and that stays true: the
 * standard route for a controller in the Union sending data to a processor outside it is the
 * Commission's SCCs, Module Two, and nobody has entered them. **This module does not change that**
 * and must not be read as doing so.
 *
 * WHAT IT DOES IS THE HALF THAT IS ACTUALLY OURS. The SCCs are two things bolted together: the
 * operative clauses, which are the Commission's own text and are adopted unchanged, and the
 * ANNEXES, which the parties fill in. The clauses are a signature. The annexes are a description of
 * this specific service -- who the parties are, what data moves, how often, for what, how long it
 * is kept, what security measures apply, and which sub-processors are involved -- and they are what
 * a customer's counsel actually sends back marked.
 *
 * THE OPERATIVE CLAUSES ARE DELIBERATELY NOT REPRODUCED HERE. They are Commission Implementing
 * Decision (EU) 2021/914 and they have to be the Commission's exact text; a version typed from
 * memory would be a legal instrument with errors in it, which is worse than not having one. This
 * module carries the annexes and says plainly that the clauses must come from the Decision.
 *
 * WHY GENERATE THEM. In every company that has ever done this, the annexes are a Word document
 * filled in once and never opened again -- and they are a description of a system that keeps
 * changing. Annex I.B lists categories of data and retention periods; Annex II lists security
 * measures; Annex III lists sub-processors. All three exist in this repository already, generated
 * and guarded, and the failure mode of a hand-written annex is precisely the one `activities.ts`
 * and `sub-processors.ts` were built to remove. An annex that disagrees with the record of
 * processing is a signed statement that disagrees with the record of processing.
 *
 * THE EXPORTER SIDE IS LEFT BLANK ON PURPOSE. Annex I.A wants both parties, and the exporter is the
 * customer. Filling in a placeholder would produce an annex that looks complete and names nobody.
 */

export interface AnnexSection {
  /** The heading as the Decision numbers it, so a reviewer can read down their own copy. */
  readonly id: string;
  readonly heading: string;
  /** Filled from this repository, or marked for the customer or for counsel. */
  readonly state: "generated" | "for-the-customer" | "absent";
  readonly content: string;
}

const processorActivities = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor");

/**
 * Annex I.A, the importer half.
 *
 * Only the half this repository can know. `brand.dataProtectionOfficer` is null and no Art. 27
 * representative is designated, so the contact is the published one rather than a role nobody
 * holds -- the same refusal `/privacy` makes.
 */
const IMPORTER = [
  `Name: ${brand.legalEntity}.`,
  `Address: ${formatAddress(", ")}.`,
  `Company registration: ${brand.companyRegistration}.`,
  "Contact person: the address published in the privacy notice. No data protection officer is appointed and none is named here, because a contact nobody staffs is worse than none.",
  "Activities relevant to the data transferred: hosting the service; reading the platform accounts the exporter has connected, on the exporter's own credentials; normalising what is read into one row shape; storing it per tenant; and presenting it back to the people the exporter has invited.",
  "Role: processor.",
].join(" ");

export const SCC_ANNEXES: readonly AnnexSection[] = [
  {
    id: "I.A",
    heading: "List of parties",
    // FOR THE CUSTOMER, not `generated`. The exporter is the customer and this repository does not
    // know who they are. A placeholder would produce an annex that looks complete and names nobody,
    // which is the specific failure a generated annex exists to prevent.
    state: "for-the-customer",
    content: `Data importer — ${IMPORTER} Data exporter — to be completed by the customer: name, address, contact person's name, position and contact details, the activities relevant to the data transferred, and its role (controller, or processor where it is acting for another controller).`,
  },
  {
    id: "I.B.subjects",
    heading: "Categories of data subjects whose personal data is transferred",
    state: "generated",
    content: processorActivities.map((a) => a.subjects).join(" "),
  },
  {
    id: "I.B.data",
    heading: "Categories of personal data transferred",
    state: "generated",
    content: processorActivities.map((a) => a.categories).join(" "),
  },
  {
    id: "I.B.sensitive",
    heading: "Sensitive data transferred, and the restrictions or safeguards applied",
    // NOT "none" ON SOMEBODY'S RECOLLECTION. `dpo-requirement.ts` scans every activity against
    // thirteen markers drawn from Art. 9, Art. 10 and PDPA s.26, and its test fails the build if one
    // ever appears. This sentence is downstream of that scan rather than an assurance beside it.
    state: "generated",
    content:
      "None. The service reads a business's own platform metrics -- spend, revenue, impressions, clicks and the identifiers of the accounts they belong to -- and holds account records for the people the customer invites. No special category of data under GDPR Art. 9, no Art. 10 data, and no PDPA s.26 data is transferred. The record of processing is scanned against markers for each of those categories and the build fails if one appears in it.",
  },
  {
    id: "I.B.frequency",
    heading: "The frequency of the transfer",
    state: "generated",
    content:
      "Continuous. Data is read from the connected accounts on a nightly schedule and on demand when the customer asks for a backfill, and it is held for the duration of the service.",
  },
  {
    id: "I.B.nature",
    heading: "Nature of the processing",
    state: "generated",
    content: processorActivities.map((a) => a.purpose).join(" "),
  },
  {
    id: "I.B.purpose",
    heading: "Purpose of the transfer and further processing",
    state: "generated",
    content:
      "To provide the service the customer has asked for and for nothing else. The data is not pooled with another customer's, not benchmarked against it, not sold, not licensed, and not used to train any model -- which the agreement states as a term and the model request builder enforces by denying provider data collection on every call.",
  },
  {
    id: "I.B.retention",
    heading: "The period for which the personal data will be retained",
    // THE ONE THAT WOULD BE FILLED IN WITH A NUMBER. An annex is exactly where "24 months" gets
    // typed because the box wants something, and it would be a period nobody set, signed.
    //
    // AND THE FIRST VERSION OF THIS DERIVED THE STATE WRONGLY, in a way worth keeping: it read
    // `state: retention !== null ? "generated" : "absent"`, and `platform-data`'s retention field
    // is NOT null -- it holds the sentence "None operates. A 30-day period is declared in code for
    // restatement events and does not run". A field that is filled in with a statement that nothing
    // operates is not a retention period, and inferring "stated" from "non-null" is the `?? 0`
    // mistake one level up: presence of a value read as presence of a fact. The annex would have
    // reported this section complete, in a signed document.
    state: "absent",
    content: `For the duration of the service, and on termination as the agreement provides: at the customer's choice the data is returned or deleted, and the copies held to run the service are deleted afterwards unless a law requires otherwise. NO RETENTION SCHEDULE IS SET for data nobody has asked about, and none is stated here rather than writing a period nobody has decided into a signed annex. The record of processing describes what does and does not operate for each of the ${processorActivities.length} processor activities, and none of them states a period that runs.`,
  },
  {
    id: "I.C",
    heading: "Competent supervisory authority",
    // DEPENDS ON THE EXPORTER, and naming Thailand's PDPC here would be wrong in a way that reads
    // right: this company's own supervisory authority is not the competent one for these Clauses.
    state: "for-the-customer",
    content: `Determined by Clause 13: where the data exporter is established in a Member State, the supervisory authority of that Member State. This is a function of where the customer is established, so it is completed by the customer and is not this company's own authority -- ${brand.supervisoryAuthority} supervises this company under ${brand.governingPrivacyLaw} and is not the competent authority for these Clauses.`,
  },
  {
    id: "II",
    heading: "Technical and organisational measures to ensure the security of the data",
    state: "generated",
    content: SECURITY_MEASURES.map((m) => m.measure).join(" "),
  },
  {
    id: "III",
    heading: "List of sub-processors",
    state: "generated",
    content: `${SUB_PROCESSORS.map((p) => `${p.name} — ${p.role} Location: ${p.location ?? "not established, and recorded as not established rather than guessed"}.`).join(" ")} The list is published and versioned, and a change is published thirty days before it takes effect.`,
  },
];

/**
 * The operative Clauses are not here, and this says so where a reader will meet it.
 *
 * Kept as an exported constant rather than a comment so that a test can assert it survives: the
 * cheapest way to make these annexes look like a complete instrument would be to delete this
 * sentence.
 */
export const SCC_CLAUSES_NOTE =
  "These are the annexes only. The operative Clauses are Commission Implementing Decision (EU) 2021/914 and must be taken from the Decision itself, unchanged -- they are not reproduced here, because a version typed from memory would be a legal instrument with errors in it. No Standard Contractual Clauses have been entered with any customer, and nothing in these annexes is a transfer safeguard on its own.";

/** Sections a customer or counsel must complete. Handed over rather than left to be discovered. */
export function sectionsNeedingSomeoneElse(): readonly AnnexSection[] {
  return SCC_ANNEXES.filter((s) => s.state !== "generated");
}
