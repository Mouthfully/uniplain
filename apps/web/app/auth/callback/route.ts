import { type NextRequest, NextResponse } from "next/server";

import { callbackDecision } from "../callback-policy";
import { supabaseServer } from "../../_auth/server";

/**
 * WHERE A PROVIDER REDIRECT BECOMES A SESSION -- and where the work-email rule is applied to it.
 *
 * The email lane is judged before the link is sent, in `_auth/actions.ts`. The Google lane cannot
 * be: the address does not exist until the provider hands it back. So the rule is applied HERE,
 * after the code exchange and before the person is let in, using the same `checkWorkEmail` --
 * reached through `callback-policy.ts`, which exists so that rule is asserted by a test rather than
 * only by a reading of this file.
 *
 * THE ORDER MATTERS AND IS THE WHOLE OF THIS FILE. The exchange has to happen first, because the
 * address is inside the session it produces. That means a personal account briefly HAS a session
 * when it is refused -- so the refusal path signs it out again rather than merely redirecting, or
 * the rejected user stays authenticated and can simply navigate to /dashboard.
 *
 * `next` IS NEVER TRUSTED. It arrives in a query string on a route whose whole job is to end in a
 * redirect, which is the exact shape of an open redirect; `safeNext` inside the policy decides what
 * may be resolved against this origin.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/signin?error=missing_code", url.origin));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/signin?error=exchange", url.origin));
  }

  const decision = callbackDecision(data.user.email, url.searchParams.get("next"));

  if (decision.kind === "refuse") {
    // Sign out, do not merely redirect. The exchange above already created a session; leaving it
    // in place would mean a refused account is signed in and one URL away from the dashboard.
    //
    // GLOBAL, AND WRITTEN DOWN RATHER THAN INHERITED. It was already global, because that is what
    // `signOut()` with no argument means -- but it was global by accident, and `_auth/actions.ts`
    // has just had the opposite default corrected on the ordinary sign-out button. The two now
    // state their scopes, so neither can be changed by a library default moving underneath them.
    //
    // Global is right HERE for a reason that does not apply there: this identity is refused, so no
    // session it holds anywhere should survive. `local` would end only the one the exchange just
    // made and leave an older one, on another device, belonging to an address the door now turns
    // away.
    await supabase.auth.signOut({ scope: "global" });
    return NextResponse.redirect(new URL(`/signin?error=${decision.error}`, url.origin));
  }

  return NextResponse.redirect(new URL(decision.next, url.origin));
}
