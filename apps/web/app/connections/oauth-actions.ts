"use server";

import { apiUrl } from "@repo/brand";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServer } from "../_auth/server";
import { currentWorkspace } from "../_auth/workspace";
import { CONNECTIONS } from "../_content";
import { CONTEXT_COOKIE, encodeContext, MAX_ACCOUNT, stateFromAuthorizeUrl } from "./_oauth";
import { oauthMessageFor } from "./_oauth-refusals";
import { OAUTH_ONLY_PROVIDERS } from "./_providers";

/**
 * THE OUTWARD LEG: THE ONE THING THIS APP SENDS, AND EVERY PLACE THE CUSTOMER IS NOT SENT.
 *
 * `actions.ts` is the sensitive path because a credential passes through it. This one is sensitive
 * for the opposite reason: NO CREDENTIAL PASSES THROUGH IT AT ALL, and the job of this file is to
 * keep it that way while still getting the customer to the provider and back.
 *
 *   THE `code_verifier` IS NEVER HERE.   `startAuthorization` runs in the Worker. What comes back is
 *                                        a URL carrying the CHALLENGE; the verifier goes from that
 *                                        isolate to Postgres and is read exactly once, by the
 *                                        callback. This app could not leak it if it tried.
 *   `CREDENTIAL_KEK` IS NEVER HERE.      The seal happens where the key is, which is the Worker.
 *                                        This app has no vault, no key and no blob.
 *   THE WORKSPACE IS NEVER FROM THE FORM. It is read from the session's own readable rows, exactly
 *                                        as the typed lane reads it -- and what makes that safe is
 *                                        not this file but `app.can_write_workspace()` inside the
 *                                        definer function, which refuses a workspace this session
 *                                        may not write to at the moment of the insert.
 *   NOTHING IS LOGGED.                   No `console` call on any path, happy or not, for
 *                                        `actions.ts`'s reason: an error object logged here is one
 *                                        `cause` away from carrying the request or its headers, and
 *                                        the header on this request is the customer's session token.
 *
 * WHY THE CUSTOMER IS ASKED FOR THE ACCOUNT BEFORE THEY GO, and not after they come back: see the
 * module note in `_oauth.ts`. In short, `POST /v1/connections/oauth/callback` requires
 * `external_account_id` and refuses to invent one, and the window to answer it after the consent
 * screen is a clock nobody sized for somebody looking up a merchant id.
 *
 * WHY A SERVER ACTION AND NOT A LINK. The authorize URL does not exist until the Worker has minted
 * a state, derived a challenge and written a row -- so there is nothing to put in an `href` on a
 * page render, and a page render that wrote a pending row would write one every time anybody looked
 * at this screen. The customer presses, the row is written, and only then is the browser sent.
 */

export interface OAuthStartState {
  /** One sentence from `CONNECTIONS.oauthErrors`. Never an upstream message; see `oauthMessageFor`. */
  readonly error?: string;
  /** The endpoint's request id, shown so support can find the same event. Not a secret. */
  readonly reference?: string;
  /** Echoed so the form keeps the customer's choice. Neither of these is a credential. */
  readonly provider?: string;
  readonly account?: string;
}

/** Where a signed-out submission goes. A path, never a value from the request. */
const SIGN_IN = "/signin?next=%2Fconnections";

export async function beginAuthorization(
  _previous: OAuthStartState,
  formData: FormData,
): Promise<OAuthStartState> {
  // THE SESSION IS SETTLED FIRST, before anything is read off the body, and with `getUser()` before
  // `getSession()` -- verify the token against the auth server, then take the raw string to forward.
  // The Worker verifies it again and the database decides tenancy from it; what this buys is a
  // refusal shaped like a sign-in page rather than a 401 round trip.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) redirect(SIGN_IN);

  const workspace = await currentWorkspace();
  if (workspace.kind === "needsOrganisation") {
    return { error: CONNECTIONS.oauthErrors.noWorkspace };
  }
  if (workspace.kind !== "ready") {
    return { error: CONNECTIONS.oauthErrors.workspaceUnavailable };
  }

  // NARROWED AGAINST THE LIST THIS SCREEN OFFERS, which mirrors `PROVIDER_LANES` and is asserted
  // against it by `_providers.test.ts`. The endpoint narrows it again against the package itself --
  // this refusal only means a customer never leaves the site for a provider we cannot finish with.
  const provider = String(formData.get("provider") ?? "");
  if (!OAUTH_ONLY_PROVIDERS.includes(provider)) {
    return { error: CONNECTIONS.oauthErrors.unknownProvider };
  }

  const account = String(formData.get("external_account_id") ?? "").trim();
  if (account === "" || account.length > MAX_ACCOUNT) {
    return { error: CONNECTIONS.oauthErrors.missingAccount, provider };
  }

  const shape = { provider, account };

  let endpoint: string;
  try {
    // Throws when neither `PUBLIC_API_URL` nor `brand.apiBaseUrl` is set, and deliberately refuses
    // to derive an origin from the site's own: a guessed URL would start an authorisation against
    // the marketing site rather than fail.
    endpoint = `${apiUrl(process.env)}/v1/connections/oauth/start`;
  } catch {
    return { error: CONNECTIONS.oauthErrors.notDeployed, ...shape };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      // NO `redirect_uri` AND NO `state`. Both are the Worker's: a caller-supplied redirect URI is
      // an open redirect with an authorisation code attached, and a caller-supplied state is a CSRF
      // token chosen by the party it is meant to bind.
      body: JSON.stringify({ workspace_id: workspace.workspace.id, provider }),
      cache: "no-store",
    });
  } catch {
    // The thrown error is not read, not logged and not shown. Nothing was authorised, because
    // nothing reached the provider.
    return { error: CONNECTIONS.oauthErrors.unreachable, ...shape };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { error: CONNECTIONS.oauthErrors.unexpected, ...shape };
  }

  const answer =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const reference = typeof answer.request_id === "string" ? answer.request_id : undefined;

  if (!response.ok || answer.ok !== true) {
    return {
      error: oauthMessageFor(answer.error),
      ...(reference === undefined ? {} : { reference }),
      ...shape,
    };
  }

  // WHAT COMES BACK IS CHECKED BEFORE A BROWSER IS SENT ANYWHERE, and a missing half is refused
  // rather than defaulted. Three things have to hold, and none of them can be supplied from here:
  //
  //   the URL parses and is https  -- this line is an instruction to a browser to leave the site.
  //                                   An `http:` or `javascript:` destination is not a consent
  //                                   screen, and validating it costs nothing.
  //   it carries a state           -- the key this browser's cookie is filed under. Without it the
  //                                   return leg matches nothing and the customer authorises for
  //                                   nothing.
  //   `expires_at` parses          -- it is the DATABASE's recorded instant plus the one TTL
  //                                   constant, computed in the Worker. It is what the cookie
  //                                   expires on, so this app keeps no second TTL of its own and
  //                                   cannot disagree with `PENDING_TTL_MS`.
  const raw = answer.authorization_url;
  const expiresAt = answer.expires_at;
  if (typeof raw !== "string" || typeof expiresAt !== "string") {
    return { error: CONNECTIONS.oauthErrors.unusableAnswer, ...shape };
  }

  let authorize: URL;
  try {
    authorize = new URL(raw);
  } catch {
    return { error: CONNECTIONS.oauthErrors.unusableAnswer, ...shape };
  }
  if (authorize.protocol !== "https:") {
    return { error: CONNECTIONS.oauthErrors.unusableAnswer, ...shape };
  }

  const state = stateFromAuthorizeUrl(authorize);
  const expires = Date.parse(expiresAt);
  if (state === null || Number.isNaN(expires)) {
    return { error: CONNECTIONS.oauthErrors.unusableAnswer, ...shape };
  }

  const store = await cookies();
  store.set(CONTEXT_COOKIE, encodeContext({ state, provider, account }), {
    // Not readable by script. Nothing on this site reads it from the client, and a cookie that
    // JavaScript can read is a cookie any injected script can read.
    httpOnly: true,
    // `lax`, not `strict`: the provider sends the customer back with a top-level GET, and `strict`
    // withholds the cookie on exactly that navigation -- the one navigation this cookie exists for.
    sameSite: "lax",
    // Unconditionally, rather than sniffing the protocol off a proxy header that can lie. Browsers
    // accept a Secure cookie from `http://localhost`, so local development is unaffected.
    secure: true,
    // Both legs live under this path and nothing else needs it, so nothing else is sent it.
    path: "/connections",
    // THE ONE CLOCK. Not a duration written here -- that would be a second TTL beside
    // `PENDING_TTL_MS`, and two constants that can disagree is the failure the store's migration
    // refuses by design. This is the endpoint's own answer for when the authorisation dies.
    expires: new Date(expires),
  });

  // LAST, AND OUTSIDE EVERY `try`. `redirect` signals by throwing, so a `catch` around it would
  // swallow the navigation and return a refusal for a flow that was actually started -- with a
  // pending row already written and a cookie already set.
  // The cast is `typedRoutes` refusing a destination it cannot enumerate, which is exactly what an
  // external authorize URL is: it is not a route of this app, and it is built by the Worker from
  // the provider registry rather than written anywhere here. The check the type would have done is
  // done above instead, and more usefully -- it parses, and it is https.
  redirect(authorize.toString() as Route);
}
