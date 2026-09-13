/**
 * THE INVITATION TOKEN, AND THE THREE PLACES IT IS NOT ALLOWED TO EXIST.
 *
 * An invitation link is a bearer credential: whoever holds it becomes a member of somebody else's
 * business account, reading their trading figures. It is treated as one.
 *
 *   NOT IN THE DATABASE.  `invitations.token_hash` is a SHA-256, exactly as `api_keys` is, and
 *                         `accept_invitation` takes the HASH rather than the token -- so the
 *                         credential never reaches the database, its query log, or a backup.
 *   NOT IN A LOG.         Nothing in this module or its callers writes to `console`.
 *   NOT TWICE ON SCREEN.  The action returns it once, in the response to the request that created
 *                         it. It is never stored in module state, never re-rendered on a later
 *                         load, and cannot be recovered by anybody -- including us.
 *
 * WHY SHA-256 WITH NO SALT IS CORRECT HERE AND WRONG FOR AN EMAIL ADDRESS. CLAUDE.md bans an
 * unsalted hash as a substitute for deleting an identifier, because an email address is drawn from
 * a small, enumerable space -- anybody holding a list of addresses can reverse it. A 256-bit random
 * token is drawn from a space nobody can enumerate, so the digest reveals nothing about it. The two
 * cases look alike and are not: what matters is the entropy of the input, not the hash.
 *
 * `crypto.getRandomValues` AND NOT `Math.random()`. The second is a PRNG seeded from the process,
 * predictable from a handful of outputs, and reaching for it here would produce invitation links an
 * attacker could guess from one they were legitimately sent.
 */

const TOKEN_BYTES = 32;

/** Seven days, in milliseconds. Long enough to be forwarded and read; short enough to expire. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** base64url: the token travels in a URL, where `+`, `/` and `=` all mean something else. */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newInvitationToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/**
 * SHA-256 of the token, as a Postgres bytea literal.
 *
 * The `\x` prefix is Postgres's hex input format. `accept_invitation` checks the length is 32
 * bytes and refuses anything else, which turns a malformed value into a refusal rather than a
 * table probe.
 */
export async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `\\x${hex}`;
}

/**
 * The link an admin passes on.
 *
 * The token is a query parameter because `/join` has to be reachable by somebody who is not signed
 * in yet -- they land, sign in, and come back. A path segment would do the same job; what matters
 * is that this URL is never written into a log or a `Referer` by this application, and `/join`
 * removes it from the address bar as soon as it has been read.
 */
export function invitationLink(site: string, token: string): string {
  return `${site.replace(/\/$/, "")}/join?token=${encodeURIComponent(token)}`;
}
