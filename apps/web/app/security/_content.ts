import { type Brand, brand } from "@repo/brand";

import { claim } from "../_content";

/**
 * Every sentence /security renders, and the two computations the page cannot be allowed to skip.
 *
 * `scripts/check-copy.mjs` refuses a JSX text node of five or more words ending in terminal
 * punctuation, so copy arrives from here and never from the markup. `security.test.ts` asserts the
 * same property against this route's own `page.tsx`, because a guard that lives only in a script
 * is one a `--warn` flag switches off.
 *
 * ------------------------------------------------------------------------------------------------
 * THE FINDING THIS MODULE IS SHAPED BY: THE TWO STANDARDS CANNOT BE NAMED IN SOURCE AT ALL.
 *
 * `CLAUDE.md` says the acronyms stay legal and that what is banned is the assertion. That is true
 * of the data-protection statutes and it is NOT true of the two certification patterns, which was
 * established by running them rather than by reading them:
 *
 *   /\bsoc\W{0,3}2\b|\bservice organi[sz]ation control\b/i          matches the bare acronym
 *   /\biso\W{0,6}(?:iec\W{0,3})?27001\b|\b27001\b/i                 matches the bare number
 *
 * Both fire on the name alone, with no assertion attached, and `forbidden-claims.test.ts` scans
 * every non-test source under `app/` with comments stripped and `\uXXXX` escapes DECODED. So there
 * is no spelling of either name that reaches this page and no escape that hides one.
 *
 * THE OBVIOUS WAY ROUND WAS AVAILABLE AND IS NOT TAKEN. `packages/brand` is outside that scan, so a
 * constant holding either name could be imported and printed, and the source scan would stay green
 * while the banned string rendered. That is the same manoeuvre as writing `"SOC 2"`, which the
 * scan decodes escapes specifically to stop; routing the string in from another package defeats the
 * guard by a different door and leaves the ban enforcing nothing. The brand package does not
 * accidentally lack a name field for these -- it carries two BOOLEANS and no name string, and the
 * booleans are the only part a page is meant to read.
 *
 * WHAT THE PAGE DOES INSTEAD, and it is a better answer for the reader anyway. It describes each
 * document by what it IS and who issues it, and states with no hedging that neither is held. A
 * buyer asking "do you have the report?" is answered by an absolute -- no assurance document of any
 * kind is held -- which is stronger than a denial naming two, because it cannot be read as silence
 * about a third. Naming them would take an edit to `FORBIDDEN_CLAIMS`, which is a decision for the
 * change that narrows the pattern, not for a route that wants a nicer sentence.
 *
 * ------------------------------------------------------------------------------------------------
 * WHAT IS COMPUTED, AND WHY EACH ONE WOULD OTHERWISE ROT
 *
 *   the hosting region        `brand.dataRegion`
 *   the governing law         `brand.governingPrivacyLaw`, `brand.supervisoryAuthority`,
 *                             `brand.postalAddress.country`
 *   whether anything is held  `brand.soc2TypeIIReport`, `brand.iso27001Certificate`
 *
 * `privacy/page.tsx` states the rule these follow: a field that is expected to change must not have
 * its answer typed into prose, or the page asserts the old answer after the fact moves. The
 * certification booleans are the sharpest case on this site -- a page that says "nothing is held"
 * in a string constant says it just as confidently the day a report lands, and a page that says it
 * because it read the fact stops saying it.
 *
 * AND IT REFUSES RATHER THAN INVENTING THE OTHER BRANCH. `assurance()` returns a two-branch union
 * with no prose in the branch where something IS held, for the reason `dashboard/_figures.ts`
 * returns three branches with no number in two of them. Describing a report this repository has
 * never seen would mean naming a firm, a window and a date that exist nowhere here, and a
 * plausible sentence about a document nobody has read is the exact failure this site is organised
 * against. The page prints a short notice that the document is not described here, and whoever
 * flips the fact writes the description in the same change -- the same change that has to delete
 * the matching ban, because `brand.test.ts` goes red until it does.
 */

const PRODUCT = brand.productName;

export const SECURITY_COPY = {
  // Head metadata lives here rather than in `page.tsx` for a reason `check-copy.mjs` records about
  // itself: it does not scan outside the JSX, so a sentence in `export const metadata` is prose
  // with no guard over it. It is customer-visible in a search result, so it is copy.
  metaTitle: "Security",
  metaDescription:
    "What this service enforces in code -- tenant isolation at the row, sealed platform credentials, the narrowest access each platform offers, and figures that are not training data -- and which assurance documents are not held.",

  eyebrow: "Trust",
  heading: "Security, without a badge.",
  lead: `This page describes what ${PRODUCT} enforces, and states which assurance documents this company does not hold. Both halves are here because a buyer needs both, and because the second half is the one a page like this usually leaves out.`,

  notice:
    "Nothing here is a certification, an attestation or an audit result, and none of those is held. Every control below is behaviour a file in this repository enforces, and the things that are not built yet are listed further down in the same voice.",

  factsHeading: "The facts this page is computed from",
  factsRegion: "Where data is held",
  factsLaw: "Governing law",
  factsAuthority: "Supervisory authority",
  factsAssurance: "Assurance documents held",

  controlsHeading: "What is enforced",
  controlsLead:
    "Each of these is a property of the running system rather than an intention. The second line of each says how it is kept true, because a control nothing tests is a control the next change deletes.",
  controlsCheckLabel: "How it stays true",

  notHeldHeading: "What is not held",
  notHeldLead:
    "These are documents rather than controls, and they are different in kind from everything above. Each is issued by somebody else about this company, on their own timetable, and no amount of engineering produces either one.",
  notHeldStatus: "Not held",
  notHeldRequiredLabel: "What would have to be true",

  // The two branches of `assurance()`. Neither is written as a fact; each belongs to a computed
  // branch and renders only in it.
  assuranceNoneHeld:
    "No certification, attestation or audit report of any kind is held. That is stated as an absolute rather than as a denial about particular documents, because a denial naming two reads as silence about a third.",
  assuranceUndescribed:
    "A document listed below is now recorded as held, and this page has not been rewritten to describe it. Nothing is stated about it here until somebody who has read it writes what it covers and over what period.",

  lawHeading: "The law is not a badge",
  lawLead:
    "One of the four frameworks a buyer usually asks about is not an optional standard at all, and it is the one that is already binding. It is listed separately because the difference decides what a promise about it could even mean.",

  gapsHeading: "What is not built yet",
  gapsLead:
    "These are controls rather than documents, which makes them ours. They are listed because a reader who takes the section above seriously will ask, and because a page that prints only what is finished is an advertisement.",

  closingHeading: "Where the rest of this is written down",
  closingBody:
    "The privacy notice names the controller, the law it operates under and the authority a complaint goes to, sets out what personal data is held and why, and marks every arrangement that is not yet in place. It is written to the same rule as this page.",
  closingLink: "Read the privacy notice",
} as const;

/* ---------------------------------------------------------------------------------------------
 * The facts panel. Values, not sentences -- the same decision `privacy/page.tsx` makes for its
 * controller rows. A sentence about the governing law is a CLAIM (`governing-law` in claims.ts) and
 * it is withheld, because `brand.dataProtectionOfficer` is null and a notice that names an
 * authority with no contact leaves the reader half a route. Printing the facts in labelled cells
 * states what is true without restating the withheld sentence; `security.test.ts` checks that
 * distinction holds by five-word run rather than by good intentions.
 * ------------------------------------------------------------------------------------------- */

const REGION_VALUE =
  brand.dataRegion === null
    ? "Not recorded in the repository, so nothing is stated about it here."
    : brand.dataRegion;

export const FACT_ROWS: readonly { readonly key: string; readonly value: string }[] = [
  { key: SECURITY_COPY.factsRegion, value: REGION_VALUE },
  { key: SECURITY_COPY.factsLaw, value: brand.governingPrivacyLaw },
  { key: SECURITY_COPY.factsAuthority, value: brand.supervisoryAuthority },
];

/* ---------------------------------------------------------------------------------------------
 * The controls. Every one of these was read in the file that implements it before it was written
 * down, and anything `AGENTS.md` marks absent is in the gaps list instead.
 * ------------------------------------------------------------------------------------------- */

export interface Control {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  /** How the property is kept true. A control with no answer here does not belong on this page. */
  readonly check: string;
}

export const CONTROLS: readonly Control[] = [
  {
    id: "isolation",
    title: "One account's rows are unreachable from another's",
    body: [
      "Isolation is decided by the database on the row, not by application code deciding which filter to apply. Row-level security is on in its forced form on every table, which matters because the unforced form exempts the table's own owner -- and migrations, and every function that runs with elevated rights, are the owner.",
      "There is exactly one query in the product that crosses accounts, and it exists so that work can be scheduled. It returns six columns: three identifiers, two times, and the name of the platform a connection is to. No figure, no credential, no address, nothing a person could be recognised from. Its exact column set is asserted in a test rather than described here, so widening it is a decision somebody has to make on purpose.",
    ],
    check:
      "The setting is asserted for every table by reading the database catalogue rather than a list of table names, so a table added without it fails on the day it lands. Three tables once shipped with the weaker setting and the list-shaped test that should have caught them did not.",
  },
  {
    id: "identities",
    title: "Two identities, and neither of them is a master key",
    body: [
      "Work that spans accounts runs under an identity holding no table permission at all: it may execute a short list of named functions and nothing else. Reads for one account run as the person signed in, under the policies above.",
      "The service that talks to the connected platforms holds no key that steps around those policies, and none is to be added to it.",
    ],
    check:
      "One place does hold such a key, and naming it is the point: the billing webhook, because a payment processor is not a member of any account and cannot write through a session. It is not exported beyond that one handler, and the tables it writes are billing records.",
  },
  {
    id: "credentials",
    title: "Platform credentials are sealed with a key this website does not have",
    body: [
      "A connection's credential is encrypted under a key made for that one connection, and that key is itself encrypted under a key held outside the database. A copy of the database on its own opens nothing.",
      "Both seals are tied to the account and connection they belong to, so a sealed credential moved into a different row does not decrypt there. Row-level security stops somebody reaching another account's row; this stops a credential being relocated into a row they can already reach.",
    ],
    check:
      "Sealing happens in the service that calls the platforms, and the key lives only there. This website collects the credential and hands it over; it never holds the key that would open one.",
  },
  {
    id: "read-access",
    title: "Read access, worded as what we enforce",
    body: [
      claim("read-only-oauth"),
      "Where a platform issues a token that can only read, the limit is the platform's and it holds whatever our code does. Where a platform will not, the limit is our code, and which of the two you are relying on is worth knowing rather than smoothing over.",
      "That distinction is not decoration, and it applies to one of the advertising platforms above: it publishes no separate read-only permission for its reporting, so the scope asked for there is the one it offers and the read-only limit is ours rather than its. Every request this product makes asks for figures; none of them calls anything that changes an account.",
      "One platform offers a shortcut: a single pasted string its own documentation describes as giving unlimited access to the account, including every write permission it publishes. It is refused outright, and the refusal is structural rather than a promise not to use it.",
    ],
    check:
      "The scopes asked for are declared per source, and nothing wider is requested. A source whose figures have nowhere to live in the data model does not get a scope requested for it.",
  },
  {
    id: "models",
    title: "Your figures are not training data, and nothing you typed is in the prompt",
    body: [
      claim("no-training"),
      claim("no-pooling"),
      "Every call to the model provider carries an explicit refusal of data collection and a request for zero retention. That is enforced by there being no code path that can build a request without them, and checked a second time against the body actually being sent -- because the provider's own default is to ALLOW collection, and a forgotten field would not fail, warn or look different in any log.",
      "The prompt itself is built from a fixed instruction and computed figures. No account name, no customer name and no identifier you chose appears in it, and the identifier that does travel with the call is a salted hash of an internal id, which gives a provider nothing to join against.",
    ],
    check:
      "The honest limit, stated because the provider states it: a refusal of collection is a policy setting, and some providers retain a request for a period regardless. What is enforceable is what is enforced here, and this is the whole of it.",
  },
  {
    id: "archive",
    title: "Nothing archives a platform response today, and the filter is written for when it does",
    body: [
      "No raw response from any connected platform is stored. The code that would store one exists and nothing calls it, so there is no archive to read, to leak or to hand over.",
      "The filter it would pass through is written for three of the sources this product reads: the ones that return orders, where a buyer sits beside the money. Each keeps a named list of fields and drops everything else, so a platform adding a field results in a missing field rather than a leak. The others return rows about campaigns and pages rather than about people, and would be kept whole.",
      "Where identifiers are dropped they are dropped, not hashed. An unsalted hash of an email address is reversible by anyone holding a list of email addresses, so storing one would build a pile of pseudonyms that is still personal data and has no reader.",
    ],
    check:
      "Two sharp limits rather than one. The filter removes fields by name and never inspects a value, so a person's own words inside a field that has to be kept are not protected by it. And the whole control is a description of code that nothing runs -- which is why this panel says so first, rather than describing an archive as though one existed.",
  },
  {
    id: "sessions",
    title: "A session is verified rather than believed",
    body: [
      "Every request checks the session against the authentication server instead of trusting what the cookie says. Signing in is a link sent to your own address, and no password is created, held or hashed here -- so there is none to be stolen, guessed or reused from somewhere else.",
    ],
    check:
      "It runs in one place every page request passes through, and the pages that cost money check the session again for themselves. That is not redundant: a change to a routing rule can unprotect a route without anything looking different.",
  },
  {
    id: "keys",
    title: "An API key is stored as a fingerprint",
    body: [
      "What the database holds for a key is a hash of it and a short prefix that is not secret. The key itself is shown once, at the moment it is made.",
      "Nobody here can read one back, recover one from a backup, or read one out to you over a support conversation. A lost key is replaced rather than retrieved.",
    ],
    check:
      "There is no column for a key and no function that returns one, so there is nothing to accidentally log.",
  },
];

/* ---------------------------------------------------------------------------------------------
 * THE TWO DOCUMENTS, DESCRIBED AND NOT NAMED. See the module header for why the names cannot be
 * written in this file, and for why importing them from a package outside the scan is refused
 * rather than merely unavailable.
 *
 * `fact` is the brand boolean each one hangs on. It is the field NAME, which survives the ban
 * because the pattern needs a word boundary after the digit and `soc2TypeIIReport` has none -- a
 * detail worth recording, because it is the reason this page can compute what it must not say.
 * ------------------------------------------------------------------------------------------- */

type CertificationFact = "soc2TypeIIReport" | "iso27001Certificate";

export interface AssuranceDocument {
  readonly id: string;
  readonly title: string;
  /** What the document is, and what it is not. */
  readonly what: readonly string[];
  /** Who issues it. Never us, which is the whole point of the section. */
  readonly issuedBy: string;
  /** What obtaining it would actually require. */
  readonly required: readonly string[];
  readonly fact: CertificationFact;
}

export const ASSURANCE_DOCUMENTS: readonly AssuranceDocument[] = [
  {
    id: "operating-effectiveness-report",
    title: "A report on how these controls operated over a period",
    what: [
      "An opinion from a licensed accounting firm, covering a stated window of months rather than a moment in time. The firm tests whether the controls actually operated across that window and reports what it did; the company writes its own description of the system and asserts it, and both halves are in the same document.",
      "It is an attestation, not a certification. There is no accredited body behind it, no certificate, no registry and no logo that comes with it.",
    ],
    issuedBy: "A licensed accounting firm.",
    required: [
      "A window of several months has to elapse with the controls running and evidence accumulating. No engineering work shortens it, because the thing being tested is the passage of time.",
      "There has to be a population to sample. No customer data has accumulated here, so an examiner sampling the period would find nothing to examine.",
      "A written and approved policy set, a named security owner with independent oversight, recorded security training, and confidentiality agreements.",
      "Signed agreements with every vendor that holds data, and insurance cover, which this kind of report explicitly contemplates for a company that custodies other people's platform credentials.",
      "Stated service commitments for the opinion to be rendered against. There is no published availability target, recovery point or recovery time objective to measure anything against today.",
      "An assessment of the running system by an outside party inside that same window.",
    ],
    fact: "soc2TypeIIReport",
  },
  {
    id: "management-system-certificate",
    title: "A certificate against an information-security management system",
    what: [
      "An accredited certification body issues it, after an assessment run in two stages. What gets certified is the management system: how risk is assessed, who owns it, how it is audited internally and reviewed by management.",
      "The technical control set everybody quotes from it is a reference list, applied through a written statement saying which controls apply here and why each excluded one does not. Implementing every technical control on that list produces a well-run system and not a certificate.",
    ],
    issuedBy: "An accredited certification body.",
    required: [
      "A management system that exists as a written, operated thing rather than as a set of good habits: scope, leadership, a risk method, internal audit and management review.",
      "A written statement recording which reference controls apply, and a justification for every one left out.",
      "Evidence that the system has run long enough to be audited internally and reviewed at least once.",
      "An accredited body engaged to assess it, on their schedule and at their judgement.",
    ],
    fact: "iso27001Certificate",
  },
];

/** The documents this company does not hold, read from the brand facts rather than listed. */
export function documentsNotHeld(b: Brand = brand): readonly AssuranceDocument[] {
  return ASSURANCE_DOCUMENTS.filter((document) => b[document.fact] !== true);
}

/**
 * Whether anything is held, as a union with NO PROSE in the branch where something is.
 *
 * `dashboard/_figures.ts` returns three branches with no number in two of them so that a `??`
 * cannot collapse an absent measurement into a zero. This is the same shape for the same reason:
 * the tempting version of this function returns a string either way, and the string for the second
 * branch would have to describe a document nobody in this repository has read. A page that
 * confidently describes an unread report is the copy equivalent of a confident wrong number.
 */
export type Assurance =
  | { readonly kind: "none-held" }
  | { readonly kind: "undescribed"; readonly documents: readonly string[] };

export function assurance(b: Brand = brand): Assurance {
  const held = ASSURANCE_DOCUMENTS.filter((document) => b[document.fact] === true);
  if (held.length === 0) return { kind: "none-held" };
  return { kind: "undescribed", documents: held.map((document) => document.title) };
}

/**
 * Which of the two notices renders.
 *
 * It is here rather than as a ternary in the JSX because CHOOSING BETWEEN TWO SENTENCES IS A COPY
 * DECISION, and this route's own test caught it sitting in the markup -- the ternary's `?` reads as
 * terminal punctuation, so a chain of copy identifiers long enough to look like a sentence trips
 * the same rule a typed sentence does. That is the guard being right for a slightly different
 * reason than it was written for: a page picking which promise to make is a page holding copy.
 */
export function assuranceNotice(status: Assurance): string {
  return status.kind === "none-held"
    ? SECURITY_COPY.assuranceNoneHeld
    : SECURITY_COPY.assuranceUndescribed;
}

/* ---------------------------------------------------------------------------------------------
 * The law. Computed from the entity's own country and the region the data sits in, because both
 * are facts that move and neither reads as a claim when it is printed as one.
 * ------------------------------------------------------------------------------------------- */

export const LAW_POINTS: readonly string[] = [
  `${brand.governingPrivacyLaw} applies to a company registered in ${brand.postalAddress.country}, and this one is. There is nothing to obtain, no examiner, no observation window and no date on which it starts being true.`,
  brand.dataRegion === null
    ? "Where the data is hosted is not recorded in the repository, so nothing is stated here about what hosting adds."
    : `Hosting the data in the ${brand.dataRegion} region does not move the company out of reach of that law. It adds an obligation about sending data across a border on top of it, which is the opposite of the way hosting is usually sold.`,
  `A complaint goes to ${brand.supervisoryAuthority}. That route exists whether or not this page mentions it, which is why it is printed as a fact above rather than offered as a reassurance.`,
];

/* ---------------------------------------------------------------------------------------------
 * The gaps. Every entry is something `AGENTS.md` marks partial or absent, rewritten for a buyer.
 * Nothing here is softened into a roadmap promise: a date nobody has set is a claim.
 * ------------------------------------------------------------------------------------------- */

export const GAPS: readonly { readonly term: string; readonly note: string }[] = [
  {
    term: "Deletion on a schedule",
    note: "No retention period is set for any category of data, and nothing deletes on a timer. What does exist is the other half: an owner can close the account from the account page, which removes it and everything belonging to it at once, and any member can download the lot as one file first. Neither needs to be asked for.",
  },
  {
    term: "A record of who read what",
    note: "There is no access log, so a question about who saw a particular record cannot be answered from the system.",
  },
  {
    term: "Monitoring and alerting",
    note: "The service emits structured logs with counts and reasons. Nothing alerts on them and nothing reviews them, which is emission rather than monitoring.",
  },
  {
    term: "Dependency and code scanning",
    note: "No automated dependency, secret or static-analysis scanning runs in the build, and no inventory of components is published.",
  },
  {
    term: "Required review before merge",
    note: "A change can reach the main branch without a second person approving it, and commits are not signed.",
  },
  {
    term: "An agreement covering platform data",
    note: "None is available to sign. The privacy notice says the same thing in the same words rather than implying otherwise.",
  },
  {
    term: "A transfer instrument",
    note: "Data crosses a border to reach every provider in use, and no separate instrument covering those transfers is published.",
  },
  {
    term: "A vendor register",
    note: "No register of the providers that hold data is maintained, and none of their own reports has been reviewed.",
  },
];
