import { brand } from "@repo/brand";

import { SUB_PROCESSORS } from "./sub-processors";

/**
 * THE CROSS-BORDER TRANSFER POSITION UNDER THE LAW THAT ACTUALLY BINDS.
 *
 * ================================================================================================
 * WHY THIS IS PDPA-SHAPED AND NOT GDPR-SHAPED
 * ================================================================================================
 *
 * `scc-annexes.ts` generates Annexes I.B, II and III of the Commission's Standard Contractual
 * Clauses. That is the GDPR instrument, it is good work, and **the GDPR's application to this
 * entity is still undecided** -- it turns on Art. 3(2), which turns on counsel. Meanwhile PDPA s.5
 * binds a controller *located in the Kingdom*, `brand.legalEntity` is a Thai juristic person, and
 * that settles it with no test to fail and no decision to take.
 *
 * So the transfer work had been done for the law that might apply and not for the one that does.
 * CLAUDE.md names that inversion directly -- "every data-protection field in `brand.ts` was
 * GDPR-shaped while the law that actually binds is the PDPA" -- and `AGENTS.md` ranks this second on
 * its own list: **"s.28 -- every byte crosses a border with no mechanism."**
 *
 * ================================================================================================
 * WHAT THIS MODULE DOES AND, MORE IMPORTANTLY, WHAT IT REFUSES TO DO
 * ================================================================================================
 *
 * It reports a POSITION, not a conclusion. Every recipient in `SUB_PROCESSORS` is a cross-border
 * transfer because the controller is in Thailand and none of them is; for each, this says which
 * route under s.28 or s.29 could carry it and what is missing. It does not decide that any route
 * carries, because that is a legal determination and `representative-requirement.ts` set the
 * precedent for how those are handled here: score the limbs the record can answer, and **refuse the
 * ones it cannot** rather than filling them in.
 *
 * THE SHARPEST FINDING IS ONE NOBODY WOULD HAVE WRITTEN BY HAND. Four of the five recipients carry
 * `location: null` -- the field's own rule is that a location is stated "only where the repository
 * actually knows". **The adequacy route cannot be attempted for a destination that has not been
 * identified**, because s.28's whole question is whether *that country* has adequate standards. So
 * for four of five the answer is not "no adequacy finding", it is "the question cannot be reached",
 * and that is generated from the same field the disclosure renders rather than asserted here.
 *
 * ================================================================================================
 * SOURCES, AND THE ONE THING THAT COULD NOT BE VERIFIED
 * ================================================================================================
 *
 * Two PDPC notifications -- on adequate destinations (s.28) and on appropriate safeguards (s.29) --
 * were published on 25 December 2023 and **took effect on 24 March 2024**. That date is checked
 * against published legal commentary rather than remembered, because this repository has already
 * been bitten by an invented statutory deadline.
 *
 * **WHETHER THE PDPC HAS PUBLISHED AN ADEQUACY LIST COULD NOT BE ESTABLISHED.** One secondary
 * source says no list has been published; another says only that the Committee "may" establish one.
 * Neither is the Committee. So `ADEQUACY_LIST_STATE` is `"unverified"` and the page says so --
 * "I could not find documentation" is a finding, and it is a materially different finding from
 * "there is no list": the first leaves a route possibly open and unexamined, the second closes it.
 */

/** A route a transfer could rest on, and what this repository can say about it. */
export type LimbState =
  /** Readable from the record and not satisfied. */
  | "not-engaged"
  /** Readable and satisfied. Nothing is in this state today. */
  | "engaged"
  /** A legal determination this repository will not make. Not the same as "no". */
  | "undetermined";

export interface TransferLimb {
  readonly id: string;
  /** The statutory test, with its section. */
  readonly test: string;
  readonly state: LimbState;
  /** What the record says, and for `undetermined`, what would have to be decided and by whom. */
  readonly finding: string;
}

/**
 * Whether the Committee has published a list of adequate destinations.
 *
 * NOT A BOOLEAN, DELIBERATELY. A boolean here would force a guess: `false` asserts that no list
 * exists, which no source checked actually says, and `true` asserts one this repository has never
 * seen. The third state is the honest one and it is the reason the type exists.
 */
export const ADEQUACY_LIST_STATE = "unverified" as const;

/** The date both notifications took effect. Checked against published commentary, not recalled. */
export const NOTIFICATIONS_IN_FORCE = "2024-03-24";

/**
 * Why every recipient is a cross-border transfer at all.
 *
 * It is the controller's location that engages s.28, not the data subject's and not the server's.
 * `brand.legalEntity` is a Thai juristic person; every recipient is somewhere else. Hosting in
 * Singapore does not move the obligation -- CLAUDE.md's own note is that it *adds* a transfer
 * obligation rather than removing one.
 */
export function transferReason(): string {
  return `The controller is ${brand.legalEntity}, a juristic person registered in ${brand.postalAddress.country}. Every provider below receives personal data outside the Kingdom, so each is a cross-border transfer under s.28 whatever the data subject's own location.`;
}

export interface TransferRecord {
  readonly processor: string;
  /** As disclosed. `null` is the finding, not a gap in this module. */
  readonly destination: string | null;
  /** Whether s.28's adequacy question can even be asked about this recipient. */
  readonly adequacyReachable: boolean;
  readonly note: string;
}

/** One row per disclosed sub-processor, generated so it cannot fall behind the disclosure. */
export function transferRecords(): readonly TransferRecord[] {
  return SUB_PROCESSORS.map((processor) => {
    const reachable = processor.location !== null;
    return {
      processor: processor.name,
      destination: processor.location,
      adequacyReachable: reachable,
      note: reachable
        ? `Destination stated as ${processor.location}. Whether that destination meets the standard the Committee's notification sets is not determined here, and no finding is claimed.`
        : "DESTINATION NOT ESTABLISHED, so s.28's question cannot be reached: adequacy is a property of a named country, and this one has not been named. The sub-processor list states a location only where it is known, and it is not known for this provider.",
    };
  });
}

/**
 * The six s.28 exceptions, each answered from the record.
 *
 * Wording follows published summaries of the section rather than being paraphrased from memory.
 * Where a limb turns on something this repository cannot decide, it is `undetermined` and says who
 * decides -- which is not a softer way of saying "no". A limb recorded as not engaged is a claim
 * about the system; a limb recorded as undetermined is a claim about what is known.
 */
export const SECTION_28_LIMBS: readonly TransferLimb[] = [
  {
    id: "law",
    test: "The transfer is for compliance with the law (s.28).",
    state: "not-engaged",
    finding:
      "No transfer here is compelled by any law. Each is a design choice about where this service runs.",
  },
  {
    id: "consent",
    test: "The data subject consented after being informed that the destination's standards are not adequate (s.28).",
    state: "not-engaged",
    finding:
      "DELIBERATELY NOT CLAIMED, and it is the limb a company under pressure reaches for. Nothing in this system obtains that consent: no screen states that a destination's standards are inadequate, and for the processor activities the data subjects are the customer's rather than ours, so their consent is not ours to collect. A consent nobody was asked for is not a basis.",
  },
  {
    id: "contract-subject",
    test: "The transfer is necessary to perform a contract to which the data subject is party, or to take pre-contractual steps at their request (s.28).",
    state: "undetermined",
    finding:
      "THE ONE THAT PLAUSIBLY CARRIES, AND IT IS NOT THIS REPOSITORY'S TO DECIDE. A customer asks for a service that reads their platforms nightly and writes them a brief; the providers below are how it runs, and there is no configuration of this product in which the transfers do not happen. Whether that makes each transfer *necessary* for a contract with the data subject -- who, for the processor activities, is the customer's data subject and not a party to anything -- is a question for counsel. Recorded as open rather than relied on.",
  },
  {
    id: "contract-interest",
    test: "The transfer is necessary to perform a contract between the controller and another person, in the data subject's interest (s.28).",
    state: "undetermined",
    finding:
      "Same question one step removed, and open for the same reason. The contracts with these providers exist and the service runs on them; whether that is 'in the data subject's interest' in the section's sense is not a thing a source file can answer.",
  },
  {
    id: "vital",
    test: "The transfer is necessary to prevent danger to the life, body or health of a person (s.28).",
    state: "not-engaged",
    finding:
      "Not engaged. This service reports on a business's own trading figures; no activity in the record touches anyone's life, body or health.",
  },
  {
    id: "public-interest",
    test: "The transfer is necessary to carry out activities of substantial public interest (s.28).",
    state: "not-engaged",
    finding:
      "Not engaged. A commercial reporting product for small businesses performs no public-interest function, and claiming one would be the least defensible sentence on this page.",
  },
];

/** The s.29 routes, answered the same way. */
export const SECTION_29_LIMBS: readonly TransferLimb[] = [
  {
    id: "bcr",
    test: "Binding corporate rules for transfers within a group of affiliated businesses, approved by the Committee before use (s.29).",
    state: "not-engaged",
    finding:
      "Twice not engaged. There is no group: this is a single juristic person with no affiliated business anywhere, so there is nothing for a group policy to bind. And the route needs the Committee's approval before use, which has not been sought.",
  },
  {
    id: "safeguards",
    test: "Appropriate safeguards giving the data subject enforceable rights and effective remedies, per the Committee's notification (s.29).",
    state: "not-engaged",
    finding:
      "No instrument is entered with any provider. The Commission's Standard Contractual Clauses have their annexes prepared in this repository, and preparing an annex is not entering the Clauses -- a test asserts that distinction elsewhere and it holds here too. Whether the EU Clauses would satisfy the Committee's notification is a further question nobody has answered, and it does not arise until they are signed.",
  },
];

/** The position, stated as a sentence rather than left for a reader to assemble. */
export function transferPosition(): string {
  const engaged = [...SECTION_28_LIMBS, ...SECTION_29_LIMBS].filter((l) => l.state === "engaged");
  if (engaged.length > 0) {
    return `A basis is recorded: ${engaged.map((l) => l.id).join(", ")}.`;
  }
  const open = [...SECTION_28_LIMBS, ...SECTION_29_LIMBS].filter(
    (l) => l.state === "undetermined",
  ).length;
  return `No s.28 or s.29 basis is established for any of these transfers. ${open} of the routes turn on a determination this repository will not make and are recorded as open rather than closed. The transfers happen; what is absent is the instrument or finding that would carry them, and nothing on this site claims otherwise.`;
}
