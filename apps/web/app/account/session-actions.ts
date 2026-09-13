"use server";

import { supabaseServer } from "../_auth/server";
import { ACCOUNT_COPY } from "./_content";

/**
 * ENDING EVERY OTHER SESSION, AND THE TWO THINGS THIS CANNOT DO.
 *
 * ================================================================================================
 * IT CANNOT LIST THEM, AND SAYING SO IS THE FEATURE
 * ================================================================================================
 *
 * "See and revoke sessions" was the ask. The seeing half is not possible on any credential this
 * repository is allowed to hold. GoTrue exposes a person's sessions only through its ADMIN API,
 * which needs the service-role key -- and CLAUDE.md's rule is not a preference: "Two identities,
 * never one... There is no service-role key in the Worker. Do not add one." A key that can read
 * every account's sessions is a key that can read every account.
 *
 * So the honest product is the revoking half without the listing half, and a screen that SAYS it
 * cannot show the list rather than rendering an empty table that reads as "no other devices". An
 * empty table is the wrong-number failure in a different currency: a person checks it, is told
 * nothing is signed in, and stops looking.
 *
 * ================================================================================================
 * IT IS NOT INSTANT, AND THE COPY MUST NOT PRETEND IT IS
 * ================================================================================================
 *
 * `@supabase/auth-js` is explicit: "Since Supabase Auth uses JWTs for authentication, the access
 * token JWT will be valid until it's expired. When the user signs out, Supabase revokes the refresh
 * token... This does not revoke the JWT and it will still be valid until it expires."
 *
 * So the other device is locked out when its access token runs out, not when this button is
 * pressed. How long that is depends on the project's JWT expiry, which this code CANNOT READ -- so
 * the copy names the limit without naming a number. A number invented here would be exactly the
 * defect this repository is built against: a figure that looks like a fact.
 *
 * `scope: "others"` and not `"global"`. Verified against the library's own implementation, which
 * skips `removeCurrentSession()` when the scope is `others`: the person pressing this stays signed
 * in on the device they pressed it from. Global would sign them out too, land them on the sign-in
 * screen, and leave them unable to tell whether it worked or whether something had gone wrong.
 */

export interface SessionRevokeState {
  readonly error?: string;
  readonly done?: boolean;
}

export async function signOutOtherSessions(
  _previous: SessionRevokeState,
  _formData: FormData,
): Promise<SessionRevokeState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // NO REDIRECT ON THE REFUSAL. A person who is already signed out has nothing to revoke, and
  // bouncing them to the sign-in screen would read as "it worked" -- the one thing this must never
  // say when it has done nothing.
  if (!user) return { error: ACCOUNT_COPY.sessionsSignedOut };

  const { error } = await supabase.auth.signOut({ scope: "others" });

  if (error) {
    // The upstream message names the auth server. One sentence, and it says nothing was changed,
    // because nothing was: a failed revoke leaves every other session exactly where it was.
    return { error: ACCOUNT_COPY.sessionsFailed };
  }

  return { done: true };
}
