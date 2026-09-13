/**
 * The words on the sub-processor page. In a constant because `check-copy.mjs` refuses a sentence in
 * a page, and because a customer's counsel reads these closely.
 */
export const SUB_PROCESSOR_COPY = {
  eyebrow: "Transparency",
  heading: "Who else touches your data.",
  lead: "Every provider that processes data on our behalf to run this service, what each one does, and which parts of the service send data to it.",

  whyNote:
    "Published because a customer's own obligations depend on it. Under Thailand's Personal Data Protection Act the duty to put an agreement in place sits with the controller — the customer — and an agreement that cannot name the providers behind the service is one no reviewer will sign off.",

  generatedNote:
    "This list is derived from the record of processing rather than kept beside it, and a test fails the build if the two disagree in either direction. A provider that gains a role in the service gains a line here in the same commit.",

  activitiesHeading: "Sends data to this provider",
  locationHeading: "Where",
  locationUnknown:
    "Not established in this repository, so nothing is stated. A location written from memory is a fact a customer's counsel would rely on.",

  changeHeading: "When this list changes",
  changeNote:
    "If a provider is added or replaced, this page changes and the date at the top of the privacy notice moves with it. There is no mailing list for that today, and no notice period is promised, because neither exists and a stated one would be a commitment nothing keeps.",

  openHeading: "What is not in place",
  openNote:
    "A data processing agreement covering this service is published and names the providers on this page. What is still not in place is a transfer instrument such as standard contractual clauses, and no retention schedule has been set for data nobody has asked about. Neither is claimed anywhere on this site.",
} as const;
