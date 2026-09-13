import { brand, formatAddress } from "@repo/brand";

import { PROCESSING_ACTIVITIES } from "./activities";
import { SUB_PROCESSORS } from "./sub-processors";

/**
 * THE ARTICLE 30(1) RECORD, BUILT ON THE PDPA ONE AND SAYING WHERE IT FALLS SHORT.
 *
 * `activities.ts` is a PDPA s.39 record: purpose, subjects, categories, basis, recipients,
 * retention, per activity, generated from the schema. It is good, and it is **not an Art. 30(1)
 * record**, because Art. 30(1) asks for three things s.39 does not:
 *
 *   (a) the identity of the controller, its REPRESENTATIVE and its DPO -- not a per-activity field
 *       at all, and absent from `activities.ts` because s.39 does not ask for it there;
 *   (e) transfers to a third country, THE COUNTRY IDENTIFIED, and documentation of the Art. 46
 *       safeguards relied on. `ProcessingActivity.recipients` is a list of names. It carries no
 *       country and no instrument;
 *   (g) a general description of the technical and organisational security measures. Nowhere.
 *
 * A record missing (a), (e) and (g) is the record a reviewer asks for and does not get. Building it
 * by hand beside the generated one would produce two records that disagree within a month, which is
 * the failure this directory has already had twice. So this DERIVES every sub-paragraph it can from
 * the existing record and the brand facts, and for the ones that cannot be derived it reports
 * **absent, with the reason** rather than leaving a gap the reader has to notice.
 *
 * THE TRANSFER SUB-PARAGRAPH IS THE UNCOMFORTABLE ONE, and it is the reason this is worth
 * generating. From the Union's standpoint EVERY recipient here is a third country: the database is
 * in Singapore and the controller is in Thailand, neither of which holds a Commission adequacy
 * decision. Art. 30(1)(e) then wants the Art. 46 safeguard documented -- and there is none.
 * `/privacy` and `/dpa` both say so in prose. This says it in a field, so a reviewer reading the
 * record meets the gap in the place the gap belongs instead of inferring it from silence.
 *
 * WHAT THIS IS NOT. It is not a legal opinion that Art. 30 applies; that follows from Art. 3(2),
 * which is assessed in `territorial-scope.ts` and decided by counsel. It is the record that must
 * exist if it does -- and it is cheaper to hold one and not need it than to need one and start.
 */

/** A sub-paragraph of Art. 30(1), and whether this company can answer it today. */
export interface Article30Entry {
  /** The letter as the Article numbers it, so a reviewer can read down their own checklist. */
  readonly subParagraph: "a" | "b" | "c" | "d" | "e" | "f" | "g";
  /** What the Article asks for, in its own terms rather than in ours. */
  readonly requirement: string;
  /**
   * `recorded` -- the record answers it.
   * `partial`  -- the record answers part and names what is missing.
   * `absent`   -- it cannot be answered today, and `content` says why.
   */
  readonly state: "recorded" | "partial" | "absent";
  /** The answer, or the reason there is not one. Never a placeholder. */
  readonly content: string;
  /** Where it was read from. A sub-paragraph with no evidence is an assertion. */
  readonly evidence: string;
}

const controllerActivities = PROCESSING_ACTIVITIES.filter((a) => a.role === "controller");
const processorActivities = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor");
const withRetention = PROCESSING_ACTIVITIES.filter((a) => a.retention !== null);
const recipientNames = SUB_PROCESSORS.map((p) => p.name);
const locatedRecipients = SUB_PROCESSORS.filter((p) => p.location !== null);

/**
 * The security measures, described from controls that exist rather than from a template.
 *
 * Art. 30(1)(g) asks for a GENERAL description "where possible", which is the phrase that invites a
 * paragraph of adjectives. Each clause below names a mechanism this repository can be checked
 * against, and `article-30.test.ts` holds it to that: a measure whose evidence file does not exist
 * fails the build. "Industry-standard encryption" would pass no such test, which is why it is not
 * here.
 */
const SECURITY_MEASURES: readonly { readonly measure: string; readonly evidence: string }[] = [
  {
    measure:
      "Tenant isolation is enforced by the database rather than by application code. Every table in the public schema carries FORCE row level security, so the table owner does not bypass its own policies, and cross-tenant reads run as a role that holds no table grant at all.",
    evidence: "supabase/tests/15_force_rls.sql",
  },
  {
    measure:
      "Platform credentials are sealed before storage and are never held in plaintext in an application table, a log line, an error message or a fixture.",
    evidence: "packages/vault/src/vault.ts",
  },
  {
    measure:
      "Security-relevant events are written to an append-only trail in the same transaction as the act they record, enforced by the grants rather than by intent.",
    evidence: "supabase/migrations/20260913001200_security_events.sql",
  },
  {
    measure:
      "Nothing a tenant writes reaches a model prompt: the system prompt is a module constant and the user prompt is built from computed figures, dictionary labels and source identifiers, carrying no entity or account name.",
    evidence: "packages/insights/src/brief.ts",
  },
  {
    measure:
      "Every model call denies provider data collection and requires zero data retention, checked again by the client against the body it is handed rather than trusted to the builder.",
    evidence: "packages/insights/src/request.ts",
  },
];

export const ARTICLE_30_RECORD: readonly Article30Entry[] = [
  {
    subParagraph: "a",
    requirement:
      "The name and contact details of the controller and, where applicable, the joint controller, the controller's representative and the data protection officer.",
    // PARTIAL, and the missing halves are the two live open items rather than an oversight. The
    // controller is fully identified; the representative is the Art. 27 question in issue #74, and
    // whether a DPO is required is an undecided PDPA s.41 / GDPR Art. 37 determination.
    state:
      brand.euRepresentative !== null && brand.dataProtectionOfficer !== null
        ? "recorded"
        : "partial",
    content: [
      `Controller: ${brand.legalEntity}, ${formatAddress(", ")}, company registration ${brand.companyRegistration}.`,
      "Joint controller: none. No processing here is carried out jointly with another controller.",
      brand.euRepresentative === null
        ? "Representative in the Union: NONE DESIGNATED. Whether Art. 3(2) reaches this entity has not been determined by counsel; the configuration that bears on it is assessed in territorial-scope.ts and the decision is recorded as an open item."
        : `Representative in the Union: ${brand.euRepresentative}.`,
      brand.dataProtectionOfficer === null
        ? "Data protection officer: NONE APPOINTED. Whether one is required has not been determined. No contact is printed here rather than printing one nobody staffs."
        : `Data protection officer: ${brand.dataProtectionOfficer}.`,
    ].join(" "),
    evidence: "packages/brand/src/brand.ts, apps/web/app/_processing/territorial-scope.ts",
  },
  {
    subParagraph: "b",
    requirement: "The purposes of the processing.",
    state: "recorded",
    content: `${PROCESSING_ACTIVITIES.length} activities, each with its purpose stated: ${PROCESSING_ACTIVITIES.map((a) => a.id).join(", ")}. ${controllerActivities.length} are carried out as controller and ${processorActivities.length} as processor.`,
    evidence: "apps/web/app/_processing/activities.ts, published at /processing",
  },
  {
    subParagraph: "c",
    requirement:
      "A description of the categories of data subjects and of the categories of personal data.",
    state: "recorded",
    content:
      "Each activity records its categories of data subjects and of personal data. Tables holding no personal data are listed separately, each with the reason, because an unexplained judgement that something is not personal data is the thing an auditor asks about first.",
    evidence: "apps/web/app/_processing/activities.ts (subjects, categories, NO_PERSONAL_DATA)",
  },
  {
    subParagraph: "d",
    requirement:
      "The categories of recipients to whom the personal data have been or will be disclosed, including recipients in third countries or international organisations.",
    state: "recorded",
    content: `Recipients are the providers that process on this company's behalf: ${recipientNames.join(", ")}. Each activity names which of them receive data from it, and the list is published rather than supplied on request.`,
    evidence: "apps/web/app/_processing/sub-processors.ts, published at /sub-processors",
  },
  {
    subParagraph: "e",
    // THE ONE THAT IS NOT SATISFIED, STATED AS SUCH.
    requirement:
      "Where applicable, transfers of personal data to a third country or an international organisation, including the identification of that country, and the documentation of suitable safeguards.",
    state: "absent",
    content: [
      `Every recipient is in a third country from the standpoint of the Union, and so is the controller: data is held in ${brand.dataRegion ?? "a region that is not recorded"} and the controller is established in ${brand.postalAddress.country}. Neither holds a Commission adequacy decision.`,
      locatedRecipients.length === SUB_PROCESSORS.length
        ? `Recipient locations: ${locatedRecipients.map((p) => `${p.name} (${p.location})`).join(", ")}.`
        : `Recipient locations are established for ${locatedRecipients.length} of ${SUB_PROCESSORS.length}: ${locatedRecipients.map((p) => `${p.name} (${p.location})`).join(", ") || "none"}. The others are recorded as not established rather than guessed.`,
      "NO ART. 46 SAFEGUARD IS IN PLACE. No standard contractual clauses have been entered, no binding corporate rules exist, and no derogation is relied on. This sub-paragraph cannot be completed and is reported as absent rather than filled with an instrument that does not exist.",
    ].join(" "),
    evidence:
      "apps/web/app/_processing/sub-processors.ts, apps/web/app/_processing/dpa-content.ts transfers clause, apps/web/app/privacy/page.tsx",
  },
  {
    subParagraph: "f",
    requirement:
      "Where possible, the envisaged time limits for erasure of the different categories of data.",
    // PARTIAL BY DESIGN. `activities.ts` carries `retention: string | null` and the nulls are the
    // truth: no retention schedule has been set. Art. 30(1)(f) says "where possible", and the
    // honest reading of that is not "invent one", which is what a filled-in template does.
    state: withRetention.length === PROCESSING_ACTIVITIES.length ? "recorded" : "partial",
    content: `${withRetention.length} of ${PROCESSING_ACTIVITIES.length} activities record a time limit. The remainder record none, because no retention schedule has been established -- the record says so rather than stating a period nobody decided. The deadline function returns null for the same reason.`,
    evidence:
      "apps/web/app/_processing/activities.ts (retention), supabase/migrations/20260913001100_data_requests.sql (app.data_request_deadline)",
  },
  {
    subParagraph: "g",
    requirement:
      "Where possible, a general description of the technical and organisational security measures referred to in Article 32(1).",
    state: "recorded",
    content: SECURITY_MEASURES.map((m) => m.measure).join(" "),
    evidence: SECURITY_MEASURES.map((m) => m.evidence).join(", "),
  },
];

export { SECURITY_MEASURES };

/** Sub-paragraphs this company cannot answer today. The list a reviewer should be handed first. */
export function unmetSubParagraphs(): readonly Article30Entry[] {
  return ARTICLE_30_RECORD.filter((e) => e.state !== "recorded");
}
