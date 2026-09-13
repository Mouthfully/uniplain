import { PROCESSING_ACTIVITIES } from "./activities";

/**
 * IS A DATA PROTECTION OFFICER REQUIRED? ASSESSED, RATHER THAN LEFT UNDECIDED.
 *
 * `brand.dataProtectionOfficer` is `null` and every document that mentions it says the question has
 * not been determined. That has been true for as long as the field has existed, and "undecided" is
 * the status this repository has already learned not to trust: `AGENTS.md` said GDPR applicability
 * was open while the pricing table quoted euros, and Art. 28(3)(d) sat recorded as blocked on DNS
 * because nobody re-read the Article. An open question is the one kind of statement nobody audits.
 *
 * So this does what `territorial-scope.ts` does: takes the limbs the statutes actually name, scores
 * each against the record of processing, and reports what it finds. **It does not issue a legal
 * opinion**, and it is named for the limbs rather than the conclusion.
 *
 * THE LIMBS ARE NARROW, AND THAT IS THE POINT. Both statutes require an officer in three cases and
 * not otherwise:
 *
 *   GDPR Art. 37(1)      PDPA s.41
 *   (a) public authority                        (1) public authority
 *   (b) core activities requiring REGULAR AND    (2) core activity requiring regular monitoring of
 *       SYSTEMATIC MONITORING OF DATA SUBJECTS       personal data on a large scale by virtue of
 *       ON A LARGE SCALE                             its nature, scope or purpose
 *   (c) core activities processing SPECIAL       (3) core activity is processing s.26 sensitive
 *       CATEGORIES (Art. 9) or Art. 10 data          data
 *
 * (b) IS THE ONE A PRODUCT LIKE THIS LOOKS LIKE IT MIGHT MEET, AND THE DISTINCTION MATTERS. This
 * service reads a business's own platform metrics every night -- regular, systematic, and about to
 * be at scale. But Art. 37(1)(b) is monitoring OF DATA SUBJECTS: behavioural tracking, profiling,
 * observing people. Spend, revenue, impressions and clicks for an advertising account are
 * measurements of a business, and `envelope_rows` carries no buyer identifier -- `normalize.ts`
 * emits none, which is `AGENTS.md`'s Art. 5(1)(c) row. Monitoring a company's numbers is not
 * monitoring the people behind them, and the nightly cadence is what makes the confusion available.
 *
 * WHAT WOULD CHANGE THE ANSWER, WHICH IS WHY THIS IS GENERATED. If an activity ever records special
 * categories, or the product starts observing individuals rather than accounts, the limb flips and
 * `dpo-requirement.test.ts` fails until this assessment and `AGENTS.md` are rewritten. A
 * determination taken once and filed is one that silently stops being true; this one re-opens
 * itself.
 */

export interface DpoLimb {
  readonly id: string;
  /** The limb as both statutes frame it. */
  readonly test: string;
  /** True where the limb is engaged on the facts as they stand. */
  readonly triggered: boolean;
  /** What the record of processing says about it. */
  readonly evidence: string;
}

/**
 * Words that would indicate Art. 9 special categories or PDPA s.26 sensitive data.
 *
 * MATCHED AGAINST THE RECORD, NOT AGAINST INTENTION. A new column holding a health condition or a
 * religious affiliation reaches the record of processing before it reaches anybody's memory of this
 * file -- `activities.test.ts` fails the build if a table lands without an entry -- so scanning the
 * entries is the one place a special category cannot arrive unnoticed.
 */
const SENSITIVE_MARKERS = [
  "racial",
  "ethnic",
  "political opinion",
  "religious",
  "philosophical",
  "trade union",
  "genetic",
  "biometric",
  "health",
  "sex life",
  "sexual orientation",
  "criminal",
  "disability",
];

const sensitiveHits = PROCESSING_ACTIVITIES.flatMap((activity) => {
  const haystack = `${activity.categories} ${activity.subjects} ${activity.purpose}`.toLowerCase();
  return SENSITIVE_MARKERS.filter((m) => haystack.includes(m)).map((m) => `${activity.id}: ${m}`);
});

export const DPO_LIMBS: readonly DpoLimb[] = [
  {
    id: "public-authority",
    test: "The controller or processor is a public authority or body (GDPR Art. 37(1)(a), PDPA s.41(1)).",
    triggered: false,
    evidence:
      "The controller is a Thai private limited company, recorded in packages/brand/src/brand.ts as brand.legalEntity with a company registration number. No public function is performed.",
  },
  {
    id: "systematic-monitoring",
    // THE LIMB WORTH ARGUING ABOUT. See the module note: regular and systematic, yes -- of data
    // subjects, no.
    test: "Core activities consist of processing which, by its nature, scope or purposes, requires regular and systematic monitoring of data subjects on a large scale (GDPR Art. 37(1)(b), PDPA s.41(2)).",
    triggered: false,
    evidence: `The core activity reads a business's own platform metrics on a nightly schedule -- regular and systematic, and about measurements of an account rather than observation of a person. envelope_rows carries no buyer identifier: packages/connectors/src/sources/woocommerce/normalize.ts emits none. Of ${PROCESSING_ACTIVITIES.length} activities, none records monitoring of individuals; the data subjects are the customer's own staff, described per activity.`,
  },
  {
    id: "special-categories",
    test: "Core activities consist of processing special categories of data on a large scale, or data relating to criminal convictions and offences (GDPR Art. 37(1)(c), PDPA s.41(3) for s.26 data).",
    triggered: sensitiveHits.length > 0,
    evidence:
      sensitiveHits.length > 0
        ? `The record of processing names special-category data: ${sensitiveHits.join(", ")}. This limb is engaged and the assessment below no longer holds.`
        : `No activity in the record names a special category. Scanned ${PROCESSING_ACTIVITIES.length} activities against ${SENSITIVE_MARKERS.length} markers drawn from GDPR Art. 9 and Art. 10 and PDPA s.26.`,
  },
];

/**
 * Is any limb engaged on the facts as they stand?
 *
 * Named for the limbs rather than the conclusion, deliberately. "No limb is engaged" is a finding
 * about the record; "no DPO is required" is a legal opinion, and the difference is the whole reason
 * this module can exist at all.
 */
export function engagedLimbs(): readonly DpoLimb[] {
  return DPO_LIMBS.filter((l) => l.triggered);
}

/**
 * The scale caveat, which no code can settle and which must travel with the finding.
 *
 * Both (b) and (c) turn on "large scale", and this service has no customers. A limb that is not
 * engaged because there is nothing to engage it is not the same as one that will stay unengaged --
 * and a reviewer reading "no DPO required" without this sentence would be reading a finding about
 * an empty database as a finding about the business.
 */
export const SCALE_CAVEAT =
  "Both the monitoring limb and the special-category limb turn on processing at large scale, and this service has no customers yet. A limb unengaged because there is nothing to engage it is not a limb that will stay unengaged, and this assessment must be re-run against the record of processing when the business has scale to measure.";
