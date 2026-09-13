/**
 * Every sentence this surface renders. `scripts/check-copy.mjs` refuses a JSX text node of five or
 * more words ending in terminal punctuation, so copy arrives from here.
 *
 * THE REFUSALS ARE ONE SENTENCE AND THEY DO NOT GUESS. An invitation can fail for five reasons and
 * this page can only distinguish two of them, because `accept_invitation` deliberately returns the
 * same refusal for "no such token", "already used", "withdrawn" and "expired" -- distinguishing
 * them would let somebody holding a guessed token learn whether it had ever been real.
 */

export const JOIN_COPY = {
  eyebrow: "Invitation",
  heading: "You have been asked to join an account.",
  lead: "Somebody with an account added your address and sent you this link. Accepting it lets you read that business's figures; it changes nothing about your own account and you can leave at any time.",

  whatYouGet:
    "What you will be able to see depends on the role you were given, and the person who invited you chose it. Nothing here lets you change prices, send anything, or write back to any tool the business uses.",

  accept: "Accept the invitation",
  accepting: "Accepting",

  signedOutHeading: "Sign in first",
  signedOutBody:
    "An invitation attaches to an account, so you sign in or create one before accepting. Come back to this link afterwards and it will still work.",

  noToken: "This address carries no invitation, so there is nothing to accept.",
  refused:
    "This invitation cannot be used. It may have been withdrawn, already accepted, or left too long. Ask whoever sent it for a new one.",
  unavailable: "Something went wrong and nothing was changed. Try the link again.",
  accepted: "You are in. The account's figures are on the dashboard.",
  goToDashboard: "Open the dashboard",
} as const;
