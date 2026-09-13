/**
 * Every sentence this surface renders.
 *
 * `scripts/check-copy.mjs` refuses a JSX text node of five or more words ending in terminal
 * punctuation, so copy arrives from here and never from the markup.
 *
 * TWO SENTENCES BELOW ARE A LEGAL NOTICE RATHER THAN COPY, and they are marked so nobody trims
 * them for tone. An admin typing a colleague's address into the invite field is collecting a third
 * party's personal data -- the person being invited has not visited this site, has agreed to
 * nothing, and may not know the account exists. Under the PDPA that person is entitled to be told
 * who holds their data and why (s.23), and the invitation message is where they are told. Until
 * the domain can send mail (`docs/marketplane/70-the-mail-nobody-can-send-yet.md`) the invitation
 * is handed over by the admin, so the notice has to be handed over with it -- which is why it is a
 * constant the page prints rather than a paragraph in a template nothing sends.
 */

export const MEMBERS_COPY = {
  eyebrow: "People",
  heading: "Who can see this account.",
  lead: "Everyone here reads the same figures. What differs is who may connect a source, invite somebody else, or change what another person can do.",

  membersHeading: "Members",
  invitationsHeading: "Open invitations",
  inviteHeading: "Invite somebody",

  emailLabel: "Their email address",
  emailHint:
    "Use the address they will sign in with. Nothing is sent to it yet; see the note below.",
  roleLabel: "What they may do",
  invite: "Create an invitation",
  inviting: "Creating",

  roleColumn: "Role",
  emailColumn: "Address",
  joinedColumn: "Joined",
  invitedColumn: "Invited",
  expiresColumn: "Expires",
  actionsColumn: "",

  remove: "Remove",
  removing: "Removing",
  withdraw: "Withdraw",
  withdrawing: "Withdrawing",
  changeRole: "Change",
  changing: "Changing",

  // --- The link, and why it is on the screen rather than in an inbox. ---------------------------
  linkHeading: "Send them this link yourself",
  linkBody:
    "This is the only time this link is shown. Only a fingerprint of it is stored, so nobody here can look it up again, recover it from a backup or read it out of the database.",
  linkExpiry: "It stops working after seven days, or once it has been used once.",
  noMail:
    "Nothing was emailed. This account cannot send mail yet, so passing the link on is your job rather than the product's.",

  // --- THE NOTICE. Not copy. See the module comment. --------------------------------------------
  noticeHeading: "Tell them this when you send it",
  noticeBody:
    "Say who you are, that you have added their address to a business account they can leave at any time, and that the account holds trading figures read from tools your business already uses. They did not ask to be added, so they are entitled to hear it from you before they click anything.",

  // --- What each role may do. Printed, because a role nobody can define is a role nobody chose. --
  roleOwner: "Owner",
  roleOwnerWhat: "Everything, including billing and removing other owners.",
  roleAdmin: "Admin",
  roleAdminWhat: "Connect sources, invite people and change roles, except an owner's.",
  roleAnalyst: "Analyst",
  roleAnalystWhat: "Read the figures and ask for a brief in the workspaces they are given.",
  roleViewer: "Viewer",
  roleViewerWhat: "Read the figures in the workspaces they are given.",

  // --- The states where nothing is produced. ----------------------------------------------------
  signedOut: "You are not signed in, so there is no account to show.",
  noOrganisation:
    "Your account has no organisation yet, so there is nobody to add. One is created with your first workspace.",
  notAdmin:
    "Only an owner or an admin may change who is in this account. You can see who is here, and nothing else on this page.",
  unavailable:
    "The list could not be read, so nothing is shown rather than a partial one. Try again, and tell us if it keeps happening.",
  noInvitations: "No invitation is waiting to be accepted.",

  // --- Refusals. Each maps to exactly one thing that went wrong. ---------------------------------
  badEmail: "That does not look like an email address, so no invitation was created.",
  ownEmail: "That is your own address, and you are already here.",
  alreadyMember: "Somebody with that address is already in this account.",
  alreadyInvited:
    "An invitation to that address is already open. Withdraw it before creating another.",
  badRole: "Choose what the person may do before creating the invitation.",
  lastOwner:
    "An account must keep at least one owner. Make somebody else an owner first, then change or remove this one.",
  ownerNeedsOwner: "Only an owner may change or remove another owner.",
  refused: "The change was refused and nothing was altered.",
} as const;

/**
 * The roles an invitation may name, in the order they are offered.
 *
 * OWNER IS NOT OFFERED. An invitation is accepted by whoever holds the link, and an invitation that
 * confers ownership is a transfer of the whole account -- billing, every source, the right to
 * remove everyone else -- to an address typed into a form. Promoting an existing member to owner is
 * a separate, deliberate act by somebody already in the account, against a person who is already
 * known. So `owner` is a role you can be given, never a role you can be invited as.
 */
export const INVITABLE_ROLES = ["admin", "analyst", "viewer"] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS = {
  owner: MEMBERS_COPY.roleOwner,
  admin: MEMBERS_COPY.roleAdmin,
  analyst: MEMBERS_COPY.roleAnalyst,
  viewer: MEMBERS_COPY.roleViewer,
} as const;

export const ROLE_DESCRIPTIONS = {
  owner: MEMBERS_COPY.roleOwnerWhat,
  admin: MEMBERS_COPY.roleAdminWhat,
  analyst: MEMBERS_COPY.roleAnalystWhat,
  viewer: MEMBERS_COPY.roleViewerWhat,
} as const;

/** Every role the database knows, which is more than can be invited. */
export const ALL_ROLES = ["owner", "admin", "analyst", "viewer"] as const;

export type MemberRole = (typeof ALL_ROLES)[number];
