/**
 * THE WORDS ON THE ONE SCREEN THAT ANSWERS A STATUTORY RIGHT.
 *
 * Held here rather than in the JSX because `check-copy.mjs` refuses a sentence in a page, and
 * because these sentences are the ones most likely to be argued over later -- by a customer, by
 * the PDPC, or by a lawyer reading what the company told somebody it would do.
 *
 * WHAT THEY DELIBERATELY DO NOT SAY. No date, no period, and no promise of a deadline: the
 * statutory clock lives in `app.data_request_deadline()`, which returns NULL until a
 * Thai-qualified lawyer sets it, and `pendingNote` renders the absence in words rather than
 * substituting a number. No sentence here says the data has been or will be deleted, because
 * nothing in this product can delete it -- see the migration header. The promise made is exactly
 * the one that can be kept: the request is recorded, and a person will act on it.
 */
export const DATA_REQUESTS = {
  eyebrow: "Your data",
  heading: "Ask about your data.",
  lead: "Ask to see what is held about you, to correct it, to take a copy, or to have it deleted. A request made here is recorded against your organisation and answered by a person.",

  kindLabel: "What are you asking for",
  kindNames: {
    access: "Show me what you hold about me",
    rectification: "Correct something you hold",
    portability: "Give me a copy I can take elsewhere",
    objection: "Stop using my data in a particular way",
    // NEXT TO OBJECTION, because it is the right people reach for instead when they are about to
    // dispute something. Objection says stop; restriction says hold. Without it the form asks
    // someone mid-dispute to choose between dropping it and deleting the evidence for it.
    restriction: "Keep my data but stop using it while something is disputed",
    erasure: "Delete my data",
  } as const,

  noteLabel: "Anything you want to add",
  noteHint:
    "Optional. If your request is about something specific, say so here — it is read by the person who answers it.",
  submit: "File this request",
  pending: "Filing…",

  listHeading: "Requests from this organisation",
  listNote:
    "Read from your organisation. Row-level security decided which rows these are, so this shows what your account may see and nothing else.",
  listEmpty: "No request has been made from this organisation.",
  listUnavailable: "The list could not be read just now. The requests themselves are unaffected.",

  stateNames: {
    open: "Received",
    acknowledged: "Being worked on",
    fulfilled: "Done",
    refused: "Declined",
    withdrawn: "Withdrawn",
  } as const,

  withdraw: "Withdraw",
  withdrawing: "Withdrawing…",
  withdrawNote: "Only the person who made a request can withdraw it.",

  /**
   * THE SENTENCE THAT REPLACES A DEADLINE.
   *
   * A period shown here would be a commitment the company is measured against, and nobody has
   * established which one applies. Saying that plainly is more useful to a customer than a
   * confident number, and it is the only version of this sentence that stays true.
   */
  pendingNote:
    "No response time is published yet, so none is shown here. The request is recorded from the moment you file it, and that record is what a person works from.",

  /** Where a request that is not about this account's own records has to go instead. */
  processorNote:
    "If you are asking about data we read from a platform on a customer's behalf, the customer that connected it is the one to ask. We hold it for them and pass a request of that kind on rather than acting on it ourselves.",

  errors: {
    notSignedIn: "That session has ended. Sign in again and the form will still be here.",
    noOrganisation:
      "This account is not part of an organisation yet, so there is nothing to file a request against.",
    unknownKind: "That is not one of the things this form can ask for. Choose one from the list.",
    blankNote: "The note was only spaces. Either write something or leave it empty.",
    refused:
      "The database refused that request. If you are signed in to the right account, quote the reference below.",
    unavailable:
      "The request could not be filed just now, and nothing was recorded. Try again; if it keeps happening, quote the reference below.",
    notYours: "That request is not one of yours, or it has already been answered.",
  },
  referenceLabel: "Reference",
} as const;

/**
 * The request kinds, in the order the form offers them. Keys match `app.data_request_kind`.
 *
 * THAT LAST SENTENCE USED TO BE THE ONLY THING ENFORCING IT. This list is five -- now six --
 * strings beside a comment asserting they match a database enum, and nothing compared them.
 * `check-providers.mjs` exists because the same arrangement failed for `app.connection_provider`,
 * and its header says a member TypeScript can name and the database cannot store fails on the
 * INSERT, in production, after the person has finished filling the form in.
 *
 * `_content.test.ts` now reads the enum out of the migrations and compares both directions.
 */
export const REQUEST_KINDS = [
  "access",
  "rectification",
  "portability",
  "objection",
  "restriction",
  "erasure",
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number];
