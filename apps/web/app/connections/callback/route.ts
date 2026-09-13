import { apiUrl } from "@repo/brand";
import { type NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "../../_auth/server";
import {
  callbackDecision,
  CONNECTED_PARAM,
  CONTEXT_COOKIE,
  decodeContext,
  OUTCOME_PARAM,
  REFERENCE_PARAM,
  safeReference,
} from "../_oauth";
import { OAUTH_MESSAGES } from "../_oauth-refusals";

/**
 * WHERE THE PROVIDER SENDS THE CUSTOMER BACK, AND WHY IT IS THIS ORIGIN RATHER THAN THE WORKER'S.
 *
 * `OAUTH_REDIRECT_URI` on the Worker points here. It has to point at this app, because this origin
 * is the only one carrying the Supabase session cookie -- and "the workspace comes from the caller
 * session, never from a query parameter a redirect carries" is unsatisfiable at an origin with no
 * session. So the return leg lands here, reads the session, and POSTs `code` and `state` onward to
 * `POST /v1/connections/oauth/callback`, which redeems the pending row, verifies the state,
 * exchanges the code and seals the result under a key this app does not have.
 *
 * THIS ROUTE DECIDES NOTHING ABOUT TENANCY. It does not read a workspace, it does not send one, and
 * the body it posts has no field for one. The workspace is on the pending row in Postgres, which
 * only `app.can_write_workspace()` will hand back, and the insert is adjudicated a second time by
 * `connections_insert` on the customer's own token.
 *
 * A GET THAT COMPLETES THE FLOW, rather than a page that renders a "finish" button. Three reasons,
 * and the first is the one that matters: the authorisation code is live in this URL from the moment
 * the provider issues the redirect, and the fastest way to stop it being live is to spend it.
 * Rendering a page instead would put the code in an address bar, in `Referer` headers of everything
 * that page loads, and in the browser's history, for as long as the customer takes to press a
 * button. Second, the pending row and the code both expire, and a page that waits is a page that
 * spends that budget on nothing. Third, after the redirect below the customer's address bar holds
 * `/connections` and nothing else -- no code, no state, no account id.
 *
 * NOTHING FROM THE ENDPOINT'S BODY TRAVELS INTO THE REDIRECT except a bounded request id. The
 * outcome moves as a CODE which `_oauth-refusals.ts` turns into our own sentence: upstream messages
 * name `credential_lane`, `app.can_write_workspace` and `CREDENTIAL_KEK`, and a customer is not the
 * right reader for any of them.
 */

const SEE_OTHER = 303;

/** The screen the customer lands on either way, carrying a code rather than a sentence. */
function back(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/connections", request.nextUrl.origin);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const response = NextResponse.redirect(url, SEE_OTHER);
  // DELETED ON EVERY PATH, refusals included. The flow is over: either the pending row has been
  // redeemed and destroyed, or it will be swept unread. Keeping the cookie would leave an account
  // id in the browser looking for an authorisation that no longer exists, and the next flow writes
  // its own. There is deliberately no resume.
  response.cookies.delete({ name: CONTEXT_COOKIE, path: "/connections" });
  return response;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;

  // The session is read as `currentUser()` does: `getUser()` verifies the token against the auth
  // server, and only then is the raw string taken to forward. A cookie that merely parses is not a
  // session, and this route is about to attach a credential to a workspace.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const decision = callbackDecision({
    returnedState: query.get("state"),
    code: query.get("code"),
    // Forwarded verbatim, never interpreted here: `@repo/oauth` decides the order in which a
    // decline is reported against every other check, and re-deciding it here is how
    // `provider_denied` becomes a message about a state.
    providerError: query.get("error"),
    context: decodeContext(request.cookies.get(CONTEXT_COOKIE)?.value),
    signedIn: user !== null && accessToken !== undefined,
  });

  if (decision.kind === "refuse") {
    return back(request, { [OUTCOME_PARAM]: decision.error });
  }

  let endpoint: string;
  try {
    endpoint = `${apiUrl(process.env)}/v1/connections/oauth/callback`;
  } catch {
    return back(request, { [OUTCOME_PARAM]: "notDeployed" });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        // Not a minted token and not a service key: the database decides tenancy from the
        // customer's own session, and there is no service-role key anywhere on this deploy target.
        authorization: `Bearer ${accessToken as string}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(decision.body),
      cache: "no-store",
    });
  } catch {
    // Not read, not logged, not shown. The grant may or may not have been exchanged, so the message
    // says to look rather than claiming nothing happened.
    return back(request, { [OUTCOME_PARAM]: "unreachable" });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return back(request, { [OUTCOME_PARAM]: "unexpected" });
  }

  const answer =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const reference = safeReference(answer.request_id);

  if (response.ok && answer.ok === true) {
    // The connection id is NOT carried. It is addressable state about a row the list below reads
    // through RLS anyway, and a redirect is a URL: nothing goes in one that the page cannot read
    // from the database for itself.
    return back(request, { [CONNECTED_PARAM]: "1" });
  }

  // NARROWED THROUGH THE TABLE RATHER THAN COPIED INTO THE URL. `answer.error` is a string from
  // another service's body, and the only thing this app does with it is look up a sentence -- so it
  // is looked up HERE, and the URL carries a code this app already has words for or nothing at all.
  // An unrecognised code would render the same sentence either way; what this prevents is a
  // redirect whose query string is whatever an upstream body happened to contain.
  const code = typeof answer.error === "string" ? answer.error : "";
  return back(request, {
    [OUTCOME_PARAM]: code in OAUTH_MESSAGES ? code : "unexpected",
    ...(reference === null ? {} : { [REFERENCE_PARAM]: reference }),
  });
}
