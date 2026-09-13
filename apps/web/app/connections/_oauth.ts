import { OAUTH_ONLY_PROVIDERS } from "./_providers";

/**
 * THE RETURN LEG'S JUDGEMENT, PULLED OUT OF THE ROUTE SO A TEST CAN HOLD IT TO IT.
 *
 * `callback/route.ts` reads a session and a cookie store and talks to the Worker, so it cannot be
 * unit tested without standing all three up -- the same reason `auth/callback-policy.ts` exists
 * beside `auth/callback/route.ts`. The route keeps the I/O; this keeps the decisions; and the
 * decisions are the part that can be wrong in a way nobody sees.
 *
 * ------------------------------------------------------------------------------------------------
 * WHAT CROSSES THE DETOUR, AND WHY IT IS A COOKIE RATHER THAN A SECOND ROW.
 *
 * The pending authorisation itself lives in Postgres, written and redeemed by the Worker: that is
 * where `state`, the `code_verifier`, the workspace and the provider live, and it is what makes
 * redemption single-shot and tenancy a database decision. Nothing here duplicates any of it.
 *
 * One value does NOT live there, because it does not exist yet when the flow starts and the Worker
 * has nowhere to keep it: the id of the account at the provider. `POST /v1/connections/oauth/callback`
 * REQUIRES `external_account_id` and refuses without it -- deliberately, because one Google grant
 * covers many Ads customer ids and many GA4 properties, and picking one of them for the customer is
 * how a connection gets filed under the wrong account and reports numbers for somebody else's shop.
 *
 * So it is asked for BEFORE the customer leaves and carried across in a cookie, for two reasons:
 *
 *   THE ALTERNATIVE IS ASKING AFTERWARDS, ON A CLOCK. The pending row expires on `PENDING_TTL_MS`
 *   and the provider's authorisation code expires on its own schedule. A form asking for a merchant
 *   id after the consent screen puts a customer looking up an identifier inside a window that was
 *   never sized for it, and the failure is a granted authorisation that produces no connection.
 *
 *   THE COOKIE ALSO CARRIES THE PROVIDER, which is the only way this page can label the field with
 *   the platform's own word for its account. A provider redirect brings back `code`, `state` and
 *   `error` and nothing else; a generic "account id" field is an invitation to type the wrong kind
 *   of identifier, which is the same wrong number arriving by a slower route.
 *
 * WHAT IS IN IT IS NOT A CREDENTIAL, and that is the line this module must not cross. The state (a
 * CSRF token the browser is already carrying in the address bar), the provider (a word already on
 * the screen), and the account id (the customer's own typing, and the same value
 * `connections.external_account_id` stores in the clear, which `packages/connections` documents as
 * not a secret). NOT the access token, NOT the authorisation code, and above all NOT the
 * `code_verifier` -- which never leaves the Worker's isolate and the database at all.
 *
 * ------------------------------------------------------------------------------------------------
 * THE STATE COMPARISON HERE IS NOT THE SECURITY CHECK, AND MUST NOT BE MISTAKEN FOR ONE.
 *
 * `verifyCallback` in `@repo/oauth` verifies the state against the redeemed row, in constant time,
 * in the Worker, after Postgres has already decided tenancy and destroyed the row. That is the
 * check. What the comparison below decides is narrower and still worth refusing over: whether the
 * account id in this browser's cookie belongs to the authorisation that just came back. If it does
 * not, completing would attach a grant to an account the customer named for a different flow -- a
 * connection that looks right and reads the wrong shop -- so it refuses instead of posting.
 */

/** The cookie the start leg writes and the return leg reads. Scoped to this screen's path. */
export const CONTEXT_COOKIE = "connect_oauth_context";

/** How the outcome of the return leg reaches the screen. Codes, never sentences, never a credential. */
export const OUTCOME_PARAM = "connect_error";
export const CONNECTED_PARAM = "connected";
export const REFERENCE_PARAM = "ref";

/**
 * The endpoint's request id, bounded before it is put in a URL that a page will render.
 *
 * It is not a secret -- the Worker returns it to the caller and logs it -- but it arrives as a
 * string from a response body and leaves in a query parameter, so it is checked against a shape
 * rather than forwarded. Anything else is dropped, not repaired: a mangled reference is worse than
 * none, because support will search for it.
 */
const REFERENCE = /^[A-Za-z0-9_-]{1,64}$/;

export function safeReference(raw: unknown): string | null {
  return typeof raw === "string" && REFERENCE.test(raw) ? raw : null;
}

/**
 * The longest account id this screen will carry. The endpoint enforces its own bound and is the
 * authority; this one stops a whole pasted page before it travels, and before it is put in a cookie.
 */
export const MAX_ACCOUNT = 200;

/** What the start leg puts in the cookie. Three strings, none of them a secret. */
export interface PendingContext {
  /** Read off the authorize URL the Worker built. Used only to match this cookie to this callback. */
  readonly state: string;
  /** One of `OAUTH_ONLY_PROVIDERS`. Decides which words label the account field. */
  readonly provider: string;
  /** The account at the provider, as the customer typed it before leaving. */
  readonly account: string;
}

export function encodeContext(context: PendingContext): string {
  return JSON.stringify(context);
}

/**
 * Read the cookie back, or say it is unusable.
 *
 * EVERY FIELD IS CHECKED RATHER THAN CAST, including the provider against the list this screen
 * offers. A cookie is client-side storage and the only thing that makes it trustworthy is that
 * nothing downstream trusts it: the provider decides nothing here, and the account id is bounded
 * again before it is sent. A cookie that does not narrow is treated as absent, which refuses.
 */
export function decodeContext(raw: string | undefined | null): PendingContext | null {
  if (typeof raw !== "string" || raw === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { state, provider, account } = parsed as Record<string, unknown>;
  if (typeof state !== "string" || state === "") return null;
  if (typeof provider !== "string" || !OAUTH_ONLY_PROVIDERS.includes(provider)) return null;
  if (typeof account !== "string" || account === "" || account.length > MAX_ACCOUNT) return null;

  return { state, provider, account };
}

/**
 * The `state` the Worker put in the authorize URL, or null.
 *
 * READ, NEVER MINTED. The state is generated in the Worker by `createState` and is already in the
 * URL this browser is about to be sent to; taking it from there is reading a value, not inventing a
 * second authority for it. A URL with no state is refused rather than carried on with, because a
 * cookie with no key matches nothing on the way back and the customer would authorise for nothing.
 */
export function stateFromAuthorizeUrl(url: URL): string | null {
  const state = url.searchParams.get("state");
  return state !== null && state !== "" ? state : null;
}

/**
 * The refusals this half decides for itself, before the endpoint is asked anything.
 *
 * Each is a `CONNECTIONS.oauthErrors` key, and `_oauth-refusals.ts` is what turns it into a
 * sentence. None of them overlaps an endpoint code: a customer reading a refusal should not have to
 * know which side of the network decided it, but the two sets must not collide in one table.
 */
export type LocalRefusal =
  | "sessionLapsed"
  | "lostContext"
  | "contextMismatch"
  | "noState"
  | "noCode";

/** What `POST /v1/connections/oauth/callback` is sent. No workspace: see the note on the route. */
export interface CallbackBody {
  readonly state: string;
  readonly code?: string;
  readonly external_account_id?: string;
  readonly provider_error?: string;
}

export type CallbackDecision =
  | { readonly kind: "refuse"; readonly error: LocalRefusal }
  | { readonly kind: "complete"; readonly body: CallbackBody; readonly provider: string };

export interface CallbackInput {
  /** `state` off this browser's own query string. */
  readonly returnedState: string | null;
  readonly code: string | null;
  /** The provider's `error` parameter, forwarded verbatim and never interpreted here. */
  readonly providerError: string | null;
  readonly context: PendingContext | null;
  /** Whether a verified Supabase session exists. The route decides this; this module reads it. */
  readonly signedIn: boolean;
}

/**
 * THE ORDER OF THE CHECKS IS THE ARGUMENT, so it is written out rather than left to be read off the
 * control flow:
 *
 *   session   -- without one there is nothing this half can do with anything else it finds, and a
 *                customer who has just granted access must be told that rather than shown a
 *                sign-in page with no explanation. This is the accepted risk the design note names.
 *   state     -- a return with no state answers no authorisation at all.
 *   cookie    -- present, and narrowing.
 *   match     -- the cookie's authorisation is THIS authorisation. See the module note.
 *   declined  -- the provider's own error, forwarded onward so the pending row is spent rather
 *                than left for the sweep, and so the customer is told they declined by the one
 *                component that decides the order of those checks.
 *   code      -- neither a permission nor a reason is a return this screen cannot use.
 *
 * A REFUSAL AFTER `match` DOES NOT POST ANYTHING, which means the pending row survives to be swept
 * rather than redeemed. That is deliberate: the only body that could be posted without a usable
 * cookie is one with an account id from a different flow, and a row that expires unread costs
 * nothing while a connection filed under the wrong account costs everything.
 */
export function callbackDecision(input: CallbackInput): CallbackDecision {
  if (!input.signedIn) return { kind: "refuse", error: "sessionLapsed" };

  const state = input.returnedState;
  if (state === null || state === "") return { kind: "refuse", error: "noState" };

  const context = input.context;
  if (context === null) return { kind: "refuse", error: "lostContext" };
  // Not a constant-time compare, and deliberately not dressed as one: this decides which account
  // label travels, not whether anybody is authorised. The authority on the state is
  // `verifyCallback`, in the Worker, against the row Postgres just destroyed.
  if (context.state !== state) return { kind: "refuse", error: "contextMismatch" };

  if (input.providerError !== null && input.providerError !== "") {
    // The pending row is still redeemed by the endpoint on this path, which is why the error is
    // forwarded rather than answered here: `@repo/oauth` reports a decline ahead of every other
    // check, and re-deriving that order at this call site is how "you declined" turns into "your
    // state was wrong".
    return {
      kind: "complete",
      provider: context.provider,
      body: { state, provider_error: input.providerError },
    };
  }

  if (input.code === null || input.code === "") return { kind: "refuse", error: "noCode" };

  return {
    kind: "complete",
    provider: context.provider,
    body: { state, code: input.code, external_account_id: context.account },
  };
}
