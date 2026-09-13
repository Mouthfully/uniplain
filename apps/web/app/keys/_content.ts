/**
 * Every sentence this screen renders. `scripts/check-copy.mjs` refuses a JSX text node of five or
 * more words ending in terminal punctuation.
 *
 * THE HARDEST SENTENCE HERE IS THE ONE ABOUT SEEING THE KEY ONCE, and it is hard because the cost
 * of not reading it is silent: a person closes the panel, comes back tomorrow, and finds a row that
 * names a credential nobody holds. It is said BEFORE the button, not beside the result.
 *
 * THE SECOND HARDEST IS THE ABSENT BASE URL. `apiUrl()` throws when neither `PUBLIC_API_URL` nor
 * `brand.apiBaseUrl` is settled, and it throws deliberately: "Refusing to derive one from the site
 * URL -- the API is a different origin, and a URL on the site's domain would resolve to the
 * marketing site rather than fail." So this screen must be able to hand over a working key while
 * saying it does not know where to point it, rather than printing a plausible address.
 */

export const KEYS_COPY = {
  eyebrow: "API keys",
  heading: "Keys for reading your own figures.",
  lead: "A key lets your own tools read this workspace's rows. It is scoped to one workspace, it can be given a monthly ceiling, and it can be retired without touching anything else.",

  // --- Where the key points. ----------------------------------------------------------------------
  endpointHeading: "Where to send it",
  // NO ADDRESS INVENTED. When the base URL is unsettled this is what the screen says instead of a
  // guess, and it says whose decision it is rather than implying a fault.
  endpointUnsettled:
    "The address for the API has not been settled yet, so there is nothing here to copy. The key below is real and will keep working; ask us for the address and we will send it.",
  endpointLabel: "Send requests to",

  // --- Making one. --------------------------------------------------------------------------------
  createHeading: "Make a key",
  createBody:
    "Give it a name you will recognise in six months, when you are deciding whether the thing that uses it still exists.",
  // SAID BEFORE THE BUTTON. A person who misses this closes the panel and has a row in a table
  // naming a credential nobody holds.
  createOnce:
    "You will see the key once, on the next screen, and we will not be able to show it again. We keep a fingerprint of it so we can check it, and never the key itself.",
  nameLabel: "What is it for",
  nameHint: "A short name, up to a hundred and twenty characters.",
  createButton: "Make the key",
  creating: "Making",

  revealHeading: "Copy it now",
  revealBody:
    "This is the only time it is shown. Put it where it is going before you leave this page, and treat it the way you would a password.",

  // --- The list. ----------------------------------------------------------------------------------
  listHeading: "Keys in this workspace",
  listEmpty: "No keys have been made for this workspace yet.",
  columnName: "Name",
  columnPrefix: "Key",
  columnUsed: "Last used",
  columnBudget: "Monthly ceiling",
  columnStatus: "Status",
  statusLive: "Live",
  statusRevoked: "Retired",
  statusExpired: "Expired",
  // NULL IS NOT ZERO AND NOT "NEVER". Each absence gets its own word.
  neverUsed: "Never used",
  noBudget: "No ceiling set",
  revokeButton: "Retire",
  revoking: "Retiring",

  // --- Refusals. Each maps to exactly one thing that went wrong. -----------------------------------
  notAdmin:
    "Only an owner or an admin can see or make keys here. Ask one of them, and they can make one scoped to what you need.",
  signedOut: "You are not signed in, so there are no keys to show you.",
  noOrganisation: "There is no account here yet, so there is nothing to make a key for.",
  noWorkspace: "There is no workspace here yet, so there is nothing for a key to read.",
  nameRequired:
    "Give the key a name of up to a hundred and twenty characters, and nothing was made.",
  createFailed:
    "The key could not be made, and nothing was saved. Nothing is half-created; try again in a moment.",
  revokeFailed: "That did not go through, and the key is still live.",
  // THE REFUSAL THAT WOULD OTHERWISE READ AS SUCCESS. Row-level security removes a row it will not
  // let you write rather than raising, so a viewer's revoke returns no error having done nothing.
  revokeChangedNothing:
    "Nothing was changed. Either the key was already retired, or this account will not let you retire it.",
  unavailable:
    "Nothing could be read, and we could not tell you why. Try again, and tell us if it keeps happening.",
} as const;
