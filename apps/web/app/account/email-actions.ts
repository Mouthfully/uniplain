"use server";

import { supabaseServer } from "../_auth/server";
import { checkWorkEmail } from "../_work-email";
import { ACCOUNT_COPY } from "./_content";

/**
 * CHANGING THE ADDRESS AN ACCOUNT SIGNS IN WITH.
 *
 * ================================================================================================
 * BOTH ADDRESSES HAVE TO CONFIRM, AND THAT IS THE PLATFORM'S DEFAULT RATHER THAN OUR CLEVERNESS
 * ================================================================================================
 *
 * `@supabase/auth-js` documents `updateUser({ email })` as sending a confirmation to the NEW
 * address, and adds: "If Secure Email Change is enabled (default), confirmation is also required
 * from the old email before the change is applied."
 *
 * That default is the whole security story here, and it is worth saying why it matters. Without it,
 * a session somebody else has taken over could move the account to an address they control, and the
 * real owner would find out by being unable to sign in. With it, the person holding the ORIGINAL
 * mailbox has to agree. The setting lives in the Supabase dashboard and this code cannot read it,
 * so the copy describes the default and the deployment must not turn it off -- which is recorded in
 * the design note as a founder action rather than assumed here.
 *
 * ================================================================================================
 * THE WORK-EMAIL RULE IS APPLIED BEFORE THE LINK IS SENT, AND THAT IS NOT MERELY TIDY
 * ================================================================================================
 *
 * `auth/callback/route.ts` applies `checkWorkEmail` to whatever address a session comes back
 * carrying, and SIGNS THE PERSON OUT if it fails -- correctly, because that is the only place the
 * Google lane can be judged. Every sign-in link this app sends lands there: `_auth/actions.ts`
 * passes `emailRedirectTo: /auth/callback`.
 *
 * So a change to a personal mailbox would be accepted by the platform, confirmed by both parties,
 * and then refused at the door the NEXT time the person signed in -- leaving an account whose
 * sign-in address is one the product will not let in, and no screen anywhere to change it back,
 * because changing it needs a session. Checking here means that change is refused while the person
 * is still signed in and on a screen that can explain it, rather than after two confirmation emails
 * and a lockout with no way out but support.
 */

export interface EmailChangeState {
  readonly error?: string;
  readonly requested?: boolean;
  /** Echoed so the form keeps its shape after a refusal. Never a credential. */
  readonly email?: string;
}

export async function changeSignInEmail(
  _previous: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // NO REDIRECT. A redirect here would lose the sentence explaining what went wrong, which is the
  // finding a review made against the first plan for this: a refusal that cannot reach the person
  // it is for has not refused anything useful.
  if (!user) return { error: ACCOUNT_COPY.emailSignedOut };

  const email = String(formData.get("email") ?? "").trim();

  const verdict = checkWorkEmail(email);
  if (!verdict.ok) return { error: verdict.message, email };

  // SAME ADDRESS IS NOT AN ERROR TO PASS UPSTREAM. Supabase would send a confirmation for a change
  // to the address already in use, and the person would work through two emails to arrive exactly
  // where they started.
  if (email.toLowerCase() === (user.email ?? "").toLowerCase()) {
    return { error: ACCOUNT_COPY.emailUnchanged, email };
  }

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    // The upstream message names the auth server and its rate limits, and a person changing their
    // own address is not the right reader for either. One sentence, and the code is not surfaced.
    return { error: ACCOUNT_COPY.emailFailed, email };
  }

  return { requested: true, email };
}
