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
  heading: "Take your data, move the account, or close it.",
  // NO COUNT IN THE SENTENCE. It said "both of these" when there were two things on the page and
  // was wrong the moment a third arrived, which is the kind of copy defect that ships because
  // nobody re-reads the lead when adding a section.
  lead: "Each of these is yours to do without asking anybody, and none of them goes through us.",

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

  // --- The sign-in address. ---------------------------------------------------------------------
  emailHeading: "Change the address you sign in with",
  emailBody:
    "The account is reached at one address, and it is the one that receives your sign-in links. If the person who set this up has left, this is how it moves to somebody who is still here.",
  // BOTH INBOXES, SAID PLAINLY. It is the platform's default and it is the whole protection: a
  // session somebody else has taken over cannot move the account without the original mailbox
  // agreeing. A person who does not expect the second email assumes it failed.
  emailBothConfirm:
    "Two emails go out, and both have to be opened. The new address confirms it wants the account, and the address you use now confirms it is letting go. Nothing changes until both are done.",
  emailLabel: "The new address",
  emailHint:
    "A company address, as at sign-up. A personal mailbox is refused here rather than after the emails have been sent.",
  emailSubmit: "Send the two confirmations",
  emailSending: "Sending",
  emailCurrent: "You sign in as",
  emailPendingHeading: "A change is waiting on the two confirmations",
  emailPendingBody:
    "Until both are done you keep signing in with the address you have now. Asking again sends a fresh pair and replaces this one.",

  // SAYS "SENT", NOT "CHANGED". The account is still reached at the old address at this point, and
  // a person told their address had changed would stop watching the old inbox -- which is the one
  // holding the confirmation the change is waiting on.
  emailRequested:
    "Both emails are on their way. Open the one at the new address and the one at the address you sign in with now, and the change happens when the second is done.",

  emailSignedOut: "You are not signed in, so there is no address to change.",
  emailUnchanged: "That is the address you already sign in with.",
  emailFailed:
    "The confirmations could not be sent, and nothing was changed. Try again in a few minutes, and tell us if it keeps happening.",

  // --- Refusals. Each maps to exactly one thing that went wrong. ---------------------------------
  confirmMismatch: "That is not the account name, so nothing was changed.",
  notOwner: "Only an owner can close the account.",
  liveSubscription:
    "A subscription is still running. End it with the payment provider first, so you are not left paying for an account that is gone.",
  unavailable:
    "Nothing was changed, and we could not tell you why. Try again, and tell us if it keeps happening.",
  noOrganisation: "There is no account here yet, so there is nothing to take out or close.",
} as const;
