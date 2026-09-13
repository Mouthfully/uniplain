import { PROCESSING_ACTIVITIES, RECIPIENTS } from "./activities";

/**
 * THE PUBLIC SUB-PROCESSOR LIST, AND WHY IT IS ITS OWN ARTEFACT.
 *
 * PDPA s.40 puts the duty to prepare a controller-processor agreement on the CONTROLLER -- "the
 * Data Controller shall prepare an agreement between the parties to control the activities carried
 * out by the Data Processor". In a B2B sale the controller is the customer, so the agreement is
 * theirs to hold and this company's job is to be able to enter one and to supply the facts it
 * depends on. A list of who else touches their data is the first of those facts, and an agreement
 * that cannot name the sub-processors is one nobody's counsel will sign.
 *
 * `check-capabilities` and the claims table already state the condition this is half of: the `dpa`
 * claim requires "a click-through Article 28 DPA plus a public sub-processor list". This is the
 * second half, built now because it is fact rather than legal drafting. THE CLAIM STAYS WITHHELD --
 * `brand.dpaAvailable` is still false and nothing here changes it, because half a condition met is
 * not the condition.
 *
 * DERIVED FROM THE RECORD OF PROCESSING, NOT KEPT BESIDE IT. Each entry's `receives` is computed
 * from `PROCESSING_ACTIVITIES`, so a sub-processor that gains an activity gains a line here on the
 * same commit. `sub-processors.test.ts` asserts the two agree in both directions. A disclosure list
 * maintained by hand next to the thing it describes is the arrangement this repository has already
 * been bitten by twice today.
 */
export interface SubProcessor {
  readonly name: string;
  /** What it does for this service, in a sentence a non-engineer can check. */
  readonly role: string;
  /**
   * Where it sits. Stated only where the repository actually knows -- `null` renders as an
   * admission rather than a guess, because "we believe it is in Singapore" in a disclosure a
   * customer's counsel relies on is worse than saying it was not established.
   */
  readonly location: string | null;
}

export const SUB_PROCESSORS: readonly SubProcessor[] = [
  {
    name: "Supabase",
    role: "Hosts the database and the authentication server. Holds account records, workspace data, connection metadata and the figures read from connected platforms.",
    location: "Singapore",
  },
  {
    name: "Cloudflare",
    role: "Runs the scheduled read of connected platforms and stores archived platform responses.",
    location: null,
  },
  {
    name: "Vercel",
    role: "Hosts this website and the screens an account signs in to. Requests to every page pass through it, including signed-in ones, so it handles session cookies and addresses in transit even though it writes nothing to this company's database.",
    location: null,
  },
  {
    name: "Stripe",
    role: "Processes payments. Holds the card details that never reach this application.",
    location: null,
  },
];

/** The activities that send data to a named sub-processor, read off the record of processing. */
export function activitiesFor(name: string): readonly string[] {
  return PROCESSING_ACTIVITIES.filter((a) => a.recipients.includes(name)).map((a) => a.purpose);
}

/** Every sub-processor the record of processing actually names. The disclosure must match this. */
export function recipientsInRecord(): readonly string[] {
  return [...RECIPIENTS];
}
