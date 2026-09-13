import { BUSINESS_TYPES } from "@repo/insights";

/**
 * Every sentence this surface renders. `scripts/check-copy.mjs` refuses a JSX text node of five or
 * more words ending in terminal punctuation, so copy arrives from here and never from the markup.
 *
 * THE REFUSAL MESSAGES ARE THE PRODUCT, NOT THE ERROR HANDLING. Most of the strings below describe
 * something not working, and they are written with the same care as the heading, because the claim
 * this whole company is built on is that it refuses a number it cannot trace rather than printing
 * one. A customer only ever sees that claim honoured in these sentences.
 */

export const BRIEF_COPY = {
  eyebrow: "Morning brief",
  heading: "Yesterday, in three lines.",
  lead: "Every figure below was computed from your own rows before the writing started, and checked again afterwards. A number that cannot be traced back to them is refused rather than corrected.",

  businessLabel: "What kind of business is this?",
  businessHint:
    "This decides which numbers lead. Nothing here works it out from your data, so you say it.",
  businessPlaceholder: "Choose one",
  submit: "Write today's brief",
  submitting: "Writing",

  periodLabel: "Period",
  servedByLabel: "Written by",
  figuresHeading: "The figures it was given",
  provenanceHeading: "Where each figure came from, and when it was read",
  unusualHeading: "Worth a look",
  actionHeading: "One thing to do today",

  // --- The states where nothing is produced. -----------------------------------------------------
  idle: "Choose the kind of business and ask for a brief.",
  signedOut: "You are not signed in, so there is no workspace to read.",
  noWorkspace:
    "Your account has no workspace yet. One is created with your organisation, and nothing has created it.",
  noBusinessType: "Choose the kind of business before asking for a brief.",
  notConfiguredHeading: "Not configured on this deployment",
  notConfiguredBody:
    "The brief needs settings that are not present here. The engine, the arithmetic and the checks are all implemented and tested; the connection to the model provider is not configured.",
  rowsUnreadableHeading: "Your rows could not be read",
  rowsUnreadableBody:
    "No brief is written, and this is not a statement about the period. A read that failed and a period with nothing in it are different things, and only one of them is about your business.",
  tooManyRowsHeading: "Too many rows for one brief",
  tooManyRowsBody:
    "More rows cover this period than one brief can be built from. Rather than write about some of them and present it as the whole period, nothing is written.",
  figuresRefusedHeading: "The arithmetic stopped before the writing started",
  figuresRefusedBody:
    "No model was called. Something about the rows for this period means there is no sound comparison to make, and the reason is named below.",
  modelFailedHeading: "The provider could not be reached",
  modelFailedBody:
    "This is our side rather than yours: nothing is wrong with your rows, and the same request can be made again.",
  refusedHeading: "The brief was refused",
  refusedBody:
    "Something was written and then thrown away whole, because it carried a figure that could not be traced back to your rows. It is not corrected and not shown in part: a repaired sentence no longer matches the reasoning that produced it.",
  refusedReassurance:
    "This is the product working rather than failing. A brief you never see is the alternative to one you cannot trust.",
} as const;

/** Labels for the one input on this page, in the dictionary's own order. */
export const BUSINESS_LABELS: Readonly<Record<(typeof BUSINESS_TYPES)[number], string>> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bar: "Bar",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  online_seller: "Online seller",
  clinic: "Clinic",
  salon: "Salon",
};
