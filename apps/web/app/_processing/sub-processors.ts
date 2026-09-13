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
  /** The date this provider became a sub-processor, `YYYY-MM-DD`. The start of the notice trail. */
  readonly since: string;
}

/**
 * HOW LONG A CHANGE IS PUBLISHED BEFORE IT TAKES EFFECT.
 *
 * GDPR Art. 28(2) makes a right to object depend on being told: where a controller's authorisation
 * of sub-processors is general, the processor must inform it of intended changes AND GIVE IT THE
 * OPPORTUNITY TO OBJECT. The agreement used to say no notice period was promised, because no
 * mechanism existed to give one -- and that was true, on the assumption the notice had to be an
 * email. The domain answers NODATA for MX, so it could not be.
 *
 * IT DOES NOT HAVE TO BE AN EMAIL. Art. 28(2) says inform, not send. A dated change list on the
 * page the agreement points at, plus a notice on the screen a customer signs in to, informs them --
 * and unlike a mailing list it cannot silently fail to deliver, cannot go to a spam folder, and
 * cannot be sent to an address someone left the company.
 *
 * THIRTY IS A COMMITMENT, NOT A FACT. Nothing in the PDPA or the GDPR sets it, and this repository
 * forbids inventing a statutory period. This is the other thing: a promise the company chooses to
 * make and now has the mechanism to keep, which is exactly the test a commitment has to pass before
 * it goes in a contract. It is the window within which a customer can object -- by terminating,
 * which is the remedy the agreement gives them.
 */
export const SUB_PROCESSOR_NOTICE_DAYS = 30;

/** One entry per change to the list. The record a customer is owed under Art. 28(2). */
export interface SubProcessorChange {
  /** When it was published, `YYYY-MM-DD`. The notice window runs from here. */
  readonly published: string;
  /** What changed, in the terms a customer would want it: added, replaced, removed. */
  readonly summary: string;
}

/**
 * Every change to the sub-processor list, newest first.
 *
 * THE FIRST ENTRY IS THE LIST ITSELF, and dating it honestly matters more than it looks. These four
 * providers were in place before any customer existed, so there is no earlier change to report and
 * no notice anyone was owed. Writing a fictional history of additions would be the same failure as
 * a fictional retention period: a fact a reviewer would rely on.
 */
export const SUB_PROCESSOR_CHANGES: readonly SubProcessorChange[] = [
  {
    published: "2026-09-13",
    summary:
      "The list was first published, naming the four providers the service has used since before it had customers. No provider was added, replaced or removed to produce it, so this entry records a publication rather than a change.",
  },
];

/** When the list last changed. Drives the notice, so it is read rather than typed in two places. */
export function lastChangedAt(): string {
  return (
    SUB_PROCESSOR_CHANGES.map((c) => c.published)
      .sort()
      .at(-1) ??
    SUB_PROCESSORS.map((p) => p.since)
      .sort()
      .at(-1) ??
    ""
  );
}

/**
 * Is a change still inside its notice window on the given date?
 *
 * Takes today as an argument for the reason `brief/_period.ts` gives and the dashboard now follows:
 * a function reading the clock answers differently either side of midnight with no record of which,
 * and no test pins it without freezing time.
 */
export function noticeWindowOpen(today: string): boolean {
  const changed = lastChangedAt();
  if (changed === "") return false;
  const end = new Date(`${changed}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + SUB_PROCESSOR_NOTICE_DAYS);
  return new Date(`${today}T00:00:00Z`) < end;
}

export const SUB_PROCESSORS: readonly SubProcessor[] = [
  {
    name: "Supabase",
    since: "2026-09-13",
    role: "Hosts the database and the authentication server. Holds account records, workspace data, connection metadata and the figures read from connected platforms.",
    location: "Singapore",
  },
  {
    name: "Cloudflare",
    since: "2026-09-13",
    role: "Runs the scheduled read of connected platforms and stores archived platform responses.",
    location: null,
  },
  {
    name: "Vercel",
    since: "2026-09-13",
    role: "Hosts this website and the screens an account signs in to. Requests to every page pass through it, including signed-in ones, so it handles session cookies and addresses in transit even though it writes nothing to this company's database.",
    location: null,
  },
  {
    name: "Stripe",
    since: "2026-09-13",
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
