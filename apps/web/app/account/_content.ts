/**
 * Every sentence this surface renders. `scripts/check-copy.mjs` refuses a JSX text node of five or
 * more words ending in terminal punctuation.
 *
 * THE HARDEST COPY IN THE PRODUCT IS HERE, and it is the three sentences about what erasure does
 * NOT reach. A customer pressing this button believes they are gone. Two things survive it -- the
 * sign-in record, because the cascade runs away from `auth.users`, and anything the payment
 * provider holds -- and a page that let them believe otherwise would be lying at the exact moment
 * trust is being cashed in. So it is said before the button, not in a footnote after it.
 */

export const ACCOUNT_COPY = {
  eyebrow: "Your account",
  heading: "Take your data, or close the account.",
  lead: "Both of these are yours to do without asking anybody, and neither of them goes through us.",

  exportHeading: "Download everything",
  exportBody:
    "One file, in the shape of the tables it came from rather than a report somebody chose for you. It holds your workspaces, your connections, every row read on your behalf, and the invitations you have sent.",
  exportButton: "Download my data",
  exportNotIncluded: "What the file does not contain, and why",

  eraseHeading: "Close the account",
  eraseBody:
    "This removes the organisation and everything that belongs to it: workspaces, members, invitations, connected platforms and every row ever read for you. It happens at once and there is no undo.",
  eraseSurvives: "Two things outlive it, and you should know before you press it",
  eraseSurvivesLogin:
    "Your sign-in record. It belongs to the service that signs you in rather than to this account, and the same address may sign in elsewhere. Write to us and we will remove it by hand.",
  eraseSurvivesBilling:
    "Anything the payment provider holds. Nothing here reaches them, which is why an account with a live subscription is refused rather than quietly closed.",
  eraseConfirmLabel: "Type the account name to confirm",
  eraseConfirmHint: "Exactly as it is written above, including capitals.",
  eraseButton: "Close this account permanently",
  erasing: "Closing",
  eraseDone: "The account is closed. There is nothing left here to show you.",

  ownerOnly:
    "Only an owner can close the account. You can download your data from here whichever role you hold.",

  // --- Refusals. Each maps to exactly one thing that went wrong. ---------------------------------
  confirmMismatch: "That is not the account name, so nothing was changed.",
  notOwner: "Only an owner can close the account.",
  liveSubscription:
    "A subscription is still running. End it with the payment provider first, so you are not left paying for an account that is gone.",
  unavailable:
    "Nothing was changed, and we could not tell you why. Try again, and tell us if it keeps happening.",
  noOrganisation: "There is no account here yet, so there is nothing to take out or close.",
} as const;
