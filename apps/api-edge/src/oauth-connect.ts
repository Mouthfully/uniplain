/**
 * `POST /v1/connections/oauth/start` and `POST /v1/connections/oauth/callback` -- the door an OAuth
 * grant walks through, which until now did not exist.
 *
 * ------------------------------------------------------------------------------------------------
 * WHY THIS IS A SECOND DOOR RATHER THAN A THIRD LANE ON `POST /v1/connections`.
 *
 * `connect.ts` refuses a body naming `oauth`, and that refusal is correct: accommodating it would
 * mean fabricating a `TokenResponse` out of a pasted string -- an access token that is not a token,
 * a null refresh token, an invented expiry -- and `connectWithToken` would then measure it against
 * scopes no pasted credential reports. An authorisation does not arrive by being typed into a form.
 * It arrives at a redirect URI as a code to exchange, and the exchange needs two things the form
 * lane has no concept of: a PKCE `code_verifier` generated before the customer left, and a `state`
 * that must be VERIFIED rather than echoed.
 *
 * So nothing in `connect.ts` changes. This module adds the flow that lane was refusing to pretend
 * to be, and `PROVIDER_LANES` stays the single authority on which providers offer which.
 *
 * WHAT IT UNBLOCKS: `ga4`, `google_ads`, `search_console` and `loyverse` are OAuth-only and could
 * not be connected at all. `PROVIDER_LANES.loyverse` is `["oauth"]` as a REFUSAL and not an
 * omission -- Loyverse does issue a pasteable personal access token, and the platform's own sentence
 * about it is that it "gives unlimited access to the targeted account", which on that API includes
 * `RECEIPTS_WRITE` and `INVENTORY_WRITE`. The connector has been built, tested, merged and
 * unreachable for want of this file.
 *
 * ------------------------------------------------------------------------------------------------
 * THE FIVE PROPERTIES THIS FILE EXISTS TO HOLD.
 *
 * 1. THE STATE IS VERIFIED, NOT ECHOED. The callback does not compare the returned state to
 *    anything it was handed; it presents the state to `redeem_oauth_authorization`, which returns
 *    the pending row or NOTHING. A returned state that names no live authorisation is refused
 *    before a single byte is spent at a token endpoint. `verifyCallback` then runs its constant-time
 *    compare on the row that came back -- redundant by construction, kept because it remains the
 *    single authority on the ORDER of the checks: provider error first, then state, then age.
 *    Re-deriving that order here is precisely how a customer who pressed Cancel gets told their
 *    state was wrong.
 *
 * 2. REDEMPTION IS SINGLE-SHOT, AND NOT BECAUSE THIS FILE REMEMBERS TO MAKE IT SO.
 *    `redeem_oauth_authorization` is a `delete ... returning` inside one statement, so the row is
 *    destroyed as it is read. Two callbacks carrying the same code race and exactly one wins. There
 *    is no flag in TypeScript to forget to set.
 *
 * 3. THE WORKSPACE COMES FROM THE CALLER'S SESSION, NEVER FROM THE REDIRECT. The `workspace_id` on
 *    the pending row was written under `app.can_write_workspace()` at start, checked against it
 *    AGAIN at redeem -- a grant can be revoked during the detour -- and the `connections` insert is
 *    then adjudicated a third time by the existing `connections_insert` policy on the customer's own
 *    forwarded token. The callback body carries no workspace at all, so there is nothing for a
 *    crafted redirect to carry.
 *
 * 4. THE TOKEN RESPONSE IS A CREDENTIAL. It reaches `@repo/connections`' `connect()` to be sealed
 *    and reaches nothing else: no response body, no error body, and NO LOG. `exchangeCode` already
 *    refuses to interpolate a provider's error body for the same reason -- providers echo request
 *    parameters in errors, and the client secret is a request parameter.
 *
 * 5. SEALING IS DELEGATED, NEVER REIMPLEMENTED. `connect()` in `@repo/connections` owns the scope
 *    check, the `kind: "oauth"` discriminant written into the blob, and the `{workspaceId,
 *    connectionId}` scope the ciphertext is bound to. Calling `@repo/vault` from here would be a
 *    second implementation that agreed with the first until it did not -- at which point a
 *    credential seals successfully and cannot be opened, hours later, with nothing pointing at the
 *    cause.
 *
 * ------------------------------------------------------------------------------------------------
 * WHY BOTH HALVES ARE IN THE WORKER AND ONLY THE REDIRECT URI IS IN THE WEB APP.
 *
 * `CREDENTIAL_KEK` lives here and not in the web app, for `connect.ts`'s reason. The flow therefore
 * BEGINS here -- the start route runs `startAuthorization`, persists the pending row and returns
 * only the authorize URL, so the `code_verifier` never touches the web app at all -- and ENDS here,
 * where the exchange and the seal happen.
 *
 * The web app owns exactly one thing: the redirect URI. It has to, because that origin is the only
 * one carrying the Supabase session cookie, and property 3 above would be unsatisfiable otherwise --
 * a redirect URI on the Worker origin would arrive with no session, and the workspace would have to
 * come from the redirect. So the web app collects `code` and `state` off its own query string, reads
 * the session, and POSTs them here. That is the collect-and-post posture `apps/web/app/connections`
 * already documents for the typed lanes.
 *
 * ------------------------------------------------------------------------------------------------
 * `external_account_id` COMES FROM THE CALLER, AND THAT IS A GAP STATED RATHER THAN PAPERED OVER.
 *
 * `connect()` needs the id of the account at the provider, and one Google grant covers many Ads
 * customer ids and many GA4 properties. Choosing one requires listing what the grant reaches and
 * asking the customer, which is a step this repository has not built for any provider. Inventing one
 * -- taking the first account, or deriving a label from the token response -- is exactly the failure
 * this codebase refuses: a connection filed under the wrong account produces numbers that look right.
 *
 * So the callback REQUIRES `external_account_id` in its body and refuses without it, and the design
 * note records the account-selection step as not built. The value is validated the same way
 * `POST /v1/connections` validates it -- `externalAccountId` is imported rather than re-derived, so
 * the paste limit and the control-character rule have one implementation.
 */

import {
  ConnectionError,
  type ConnectionProvider,
  type ConnectionRow,
  connect,
  isOAuthSource,
  lanesFor,
  PROVIDER_LANES,
} from "@repo/connections";
import {
  AuthorizationError,
  type CryptoLike as PkceCrypto,
  PENDING_TTL_MS,
  type PendingAuthorization,
  PROVIDERS,
  type ProviderId,
  type SourceId,
  type TokenResponse,
  exchangeCode,
  providerFor,
  startAuthorization,
  verifyCallback,
} from "@repo/oauth";
import { callPostgrest, type PostgrestConfig, StoreError } from "@repo/store";
import { kekFromBase64, type CryptoLike as VaultCrypto } from "@repo/vault";

import {
  type AccessTokenCrypto,
  AccessTokenError,
  bearerToken,
  verifyAccessToken,
} from "./access-token.js";
import {
  ConnectError,
  type ConnectRefusal,
  createInsertingStore,
  externalAccountId,
  KEY_VERSION,
  REFUSAL_STATUS,
} from "./connect.js";

/**
 * Why an authorisation was not started or not completed.
 *
 * IT EXTENDS `ConnectRefusal` RATHER THAN REDECLARING IT. The two routes share a vocabulary for the
 * things that are genuinely the same question -- an unknown provider, a lane the provider does not
 * offer, a deployment whose KEK cannot seal -- and a client branching on `error` should not have to
 * learn two spellings of `unknown_provider` depending on which door it used.
 *
 * THE SPLIT BETWEEN RETRYABLE AND NOT IS THE POINT OF THE REST, and it is the one thing this
 * vocabulary must not collapse. `store_unavailable` means the database could not be reached and the
 * authorisation is still good; `state_mismatch` means it is gone and will never be good again.
 * Merging them sends a customer to retry an authorisation that cannot succeed, or stops one that
 * would.
 */
export type OAuthRefusal =
  | ConnectRefusal
  /**
   * The state named no live authorisation: never started, already redeemed, expired past the
   * database's one-hour sweep, or another tenant's. DELIBERATELY ONE CODE FOR ALL FOUR -- the
   * function returns zero rows for each, and distinguishing them here would mean inventing a
   * distinction the database refused to make, and turning this route into an oracle for which
   * states exist.
   */
  | "state_mismatch"
  /** The pending authorisation was older than `PENDING_TTL_MS`. `verifyCallback` decides this. */
  | "authorization_expired"
  /** The customer declined, or the provider refused. Reported first, ahead of every other check. */
  | "provider_denied"
  /** The token endpoint refused the code, or answered without an access token. */
  | "token_exchange_failed"
  /** The provider issues refresh tokens and did not send one. The connection would die in an hour. */
  | "missing_refresh_token"
  /** The grant came back without a scope the source needs. `connect()` decides this. */
  | "missing_scope"
  /** The database could not be reached. RETRYABLE, and the only member of this union that is. */
  | "store_unavailable";

export const OAUTH_REFUSAL_STATUS: Record<OAuthRefusal, number> = {
  ...REFUSAL_STATUS,
  // 400 for all three: the request is well formed and the AUTHORISATION is not usable. Nothing the
  // caller edits fixes it -- the fix is to start the flow again -- and a 5xx would tell a client to
  // retry a POST that will produce the same answer forever.
  state_mismatch: 400,
  authorization_expired: 400,
  provider_denied: 400,
  // 502: the request was fine and an upstream refused. Retrying THIS code will not work (an
  // authorisation code is single-use at the provider too), which is why the message says to start
  // again rather than to retry.
  token_exchange_failed: 502,
  // 409, not 400 and not 502, for `/v1/ingest/run`'s reason: the request is fine and the GRANT is
  // not usable. The fix is a different authorisation, not a different request.
  missing_refresh_token: 409,
  missing_scope: 409,
  // 502 AND RETRYABLE -- the only member here that is. See the note on the union.
  store_unavailable: 502,
};

export class OAuthConnectError extends Error {
  constructor(
    message: string,
    readonly refusal: OAuthRefusal,
  ) {
    super(message);
    this.name = "OAuthConnectError";
  }
}

/** The providers this build can drive, from `PROVIDER_LANES` rather than written out again. */
const PROVIDERS_IN_BUILD = Object.keys(PROVIDER_LANES) as readonly ConnectionProvider[];

/** Every provider name `@repo/oauth` knows. Read, never copied -- the registry lives there. */
const OAUTH_PROVIDER_IDS = Object.keys(PROVIDERS) as readonly ProviderId[];

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * The longest `state` and `code` this route will look at.
 *
 * A PASTE-ERROR LIMIT, NOT A PROTOCOL ONE, exactly as `MAX_EXTERNAL_ACCOUNT_ID` is. `createState`
 * produces 43 characters and an authorisation code is provider-shaped and undocumented in length,
 * so the ceiling is generous -- what it refuses is a whole redirect URL, a whole page or a whole
 * credential pasted into the field, the last of which must not reach a `state` argument that is
 * about to be logged nowhere but is about to be sent to a database.
 */
export const MAX_CALLBACK_FIELD = 4096;

function field(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OAuthConnectError(`\`${name}\` is required, as a string.`, "bad_request");
  }
  return value;
}

function boundedField(value: unknown, name: string): string {
  const raw = field(value, name).trim();
  if (raw.length > MAX_CALLBACK_FIELD) {
    throw new OAuthConnectError(
      `\`${name}\` is longer than ${MAX_CALLBACK_FIELD} characters, which is a paste of something ` +
        "other than the value the provider sent.",
      "bad_request",
    );
  }
  return raw;
}

/**
 * Narrow a provider name to one this build can drive over OAuth, or say which refusal it is.
 *
 * TWO DIFFERENT REFUSALS FOR TWO DIFFERENT MISTAKES, and `PROVIDER_LANES` is the authority on both.
 * `tiktok_ads` is a provider nothing here can drive; `woocommerce` is a provider this build drives
 * perfectly well and which has no authorisation server at all -- its credential is a key and a
 * secret the merchant issued itself, and there is no consent screen to send anyone to.
 */
function oauthSource(value: unknown): SourceId {
  const provider = field(value, "provider");
  if (!(PROVIDERS_IN_BUILD as readonly string[]).includes(provider)) {
    throw new OAuthConnectError(
      `\`provider\` is ${JSON.stringify(provider)}, which this build cannot connect. It drives ` +
        `${PROVIDERS_IN_BUILD.join(", ")}.`,
      "unknown_provider",
    );
  }
  const known = provider as ConnectionProvider;
  if (!isOAuthSource(known)) {
    throw new OAuthConnectError(
      `${known} does not offer the oauth lane, so there is no authorisation to start. Lanes it ` +
        `offers: ${lanesFor(known).join(", ")}. Use \`POST /v1/connections\` for those.`,
      "unsupported_lane",
    );
  }
  return known;
}

/** What `POST /v1/connections/oauth/start` needs off the body. */
export interface StartRequest {
  readonly workspaceId: string;
  readonly source: SourceId;
}

export function parseStartRequest(body: unknown): StartRequest {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const workspaceId = field(b.workspace_id, "workspace_id");
  if (!UUID.test(workspaceId)) {
    throw new OAuthConnectError(
      "`workspace_id` is not a UUID. It is the workspace the connection will belong to; whether " +
        "you may write to it is decided by the database, but it has to be an id first.",
      "bad_request",
    );
  }

  return { workspaceId, source: oauthSource(b.provider) };
}

/**
 * What `POST /v1/connections/oauth/callback` needs off the body.
 *
 * NO WORKSPACE. See property 3 in the module note: the workspace is on the pending row, which the
 * caller cannot choose and cannot edit. A `workspace_id` here would be a field a crafted redirect
 * could carry, and the first thing anybody would reach for to "fix" a cross-tenant refusal.
 */
export interface CallbackRequest {
  readonly state: string;
  /** Absent exactly when `providerError` is present. */
  readonly code: string | null;
  /** Absent exactly when `providerError` is present -- there is no account to name. */
  readonly externalAccountId: string | null;
  readonly displayName: string | null;
  /** `error` off the provider's redirect, forwarded verbatim by the web app. */
  readonly providerError: string | null;
}

export function parseCallbackRequest(body: unknown): CallbackRequest {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const state = boundedField(b.state, "state");

  // THE PROVIDER'S OWN ERROR IS READ FIRST AND CHANGES WHAT ELSE IS REQUIRED. A customer who
  // pressed Cancel comes back with `error=access_denied` and no code and no account -- demanding
  // them would turn "you declined" into "your request was malformed", which is a sentence about the
  // wrong party. The pending row is still redeemed below, because the flow is over either way.
  const providerError =
    typeof b.provider_error === "string" && b.provider_error.trim() !== ""
      ? boundedField(b.provider_error, "provider_error")
      : null;

  const displayName =
    typeof b.display_name === "string" && b.display_name.trim() !== "" ? b.display_name : null;

  if (providerError !== null) {
    return { state, code: null, externalAccountId: null, displayName, providerError };
  }

  return {
    state,
    code: boundedField(b.code, "code"),
    // Validated HERE, before the pending row is redeemed, so a malformed account id does not spend
    // a single-use authorisation the customer would then have to grant again.
    externalAccountId: callbackAccountId(b.external_account_id),
    displayName,
    providerError: null,
  };
}

/**
 * The account at the provider, validated by `connect.ts`'s rule rather than by a second one.
 *
 * IMPORTED RATHER THAN RE-DERIVED. The paste limit and the control-character test are the same
 * question here as on the typed lane, and a second opinion about what an account id is would agree
 * with the first right up until somebody edited one of them. The provider is passed as an OAuth
 * source, so the WooCommerce store-origin branch inside it is unreachable from here by construction
 * -- `oauthSource` has already refused `woocommerce`.
 */
function callbackAccountId(value: unknown): string {
  try {
    return externalAccountId("ga4", value);
  } catch (error) {
    if (error instanceof ConnectError) {
      throw new OAuthConnectError(error.message, error.refusal);
    }
    throw error;
  }
}

/** The client registration for one provider. Worker secrets; never a request parameter. */
export interface ClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * Resolve one provider's client registration, or name the bindings that are absent.
 *
 * PER PROVIDER AND NOT ALL AT ONCE, which is the one place this route's 503 differs from
 * `/v1/connections`'. A deployment that has registered a Loyverse app and not a Google one can
 * connect Loyverse perfectly well, and demanding all six secrets would make it answer 503 for a
 * flow it is fully configured for. The bindings for the provider that was ASKED FOR are still
 * gathered rather than short-circuited, so an operator learns about both halves of one registration
 * in one response.
 */
export type ClientCredentialSource = (
  provider: ProviderId,
) => ClientCredentials | { readonly missing: readonly string[] };

/**
 * The pending authorisation, as this route needs to store and fetch it.
 *
 * A PORT, so the whole flow is exercised in a test with no network and no Supabase project, exactly
 * as `ConnectionStore` is for the typed lane. The real implementation is two `SECURITY DEFINER`
 * functions and nothing else; see `20260913000400_oauth_pending.sql` for why it is a row in Postgres
 * rather than a signed cookie.
 */
export interface PendingAuthorizationStore {
  /** Persist one pending authorisation. Answers the instant the DATABASE recorded, not ours. */
  start(pending: PendingAuthorization, accessToken: string): Promise<string>;
  /** Read it and destroy it, in one statement. Null for every reason alike. */
  redeem(state: string, accessToken: string): Promise<PendingAuthorization | null>;
}

/**
 * The PostgREST implementation: two RPCs, on the CALLER'S OWN TOKEN.
 *
 * FORWARDED VERBATIM, never minted. `@repo/store` mints an `authenticated` token carrying a
 * `workspace_id` claim and no `sub`, which `app.can_write_workspace()` refuses outright -- correctly,
 * because that token's authority is a claim this Worker wrote for itself. Using it here would mean
 * the Worker deciding who may attach a credential to which workspace, which is the decision the
 * whole design puts in the database. Same choice, same reason, as `createInsertingStore`.
 */
export function createPendingAuthorizationStore(
  config: PostgrestConfig,
): PendingAuthorizationStore {
  return {
    async start(pending, accessToken) {
      const body = await callPostgrest(config, {
        path: "/rest/v1/rpc/start_oauth_authorization",
        token: accessToken,
        method: "POST",
        action: "write",
        body: {
          p_state: pending.state,
          p_code_verifier: pending.codeVerifier,
          p_workspace_id: pending.workspaceId,
          p_provider: pending.provider,
          p_sources: pending.sources,
          p_redirect_uri: pending.redirectUri,
          // NO `p_now`. The function has no clock parameter at any arity, and the migration's
          // longest comment is about why: a caller-supplied `created_at` is a self-extending TTL.
        },
      });

      if (typeof body !== "string" || Number.isNaN(Date.parse(body))) {
        // REFUSED RATHER THAN DEFAULTED. The instant this returns is what the whole expiry story
        // rests on, and substituting our own clock for an answer the database did not give would be
        // a guess wearing the costume of a fact.
        throw new StoreError(
          "the database did not answer `start_oauth_authorization` with a timestamp, so the " +
            "moment this authorisation begins is unknown.",
          "upstream",
          200,
        );
      }
      return body;
    },

    async redeem(state, accessToken) {
      const body = await callPostgrest(config, {
        path: "/rest/v1/rpc/redeem_oauth_authorization",
        token: accessToken,
        // POST because it WRITES -- the redeem is a delete. A GET would also be cached by anything
        // between here and the database, which for a single-use secret is the worse half.
        method: "POST",
        action: "write",
        body: { p_state: state },
      });

      if (!Array.isArray(body)) {
        throw new StoreError(
          "the database answered `redeem_oauth_authorization` with something other than a set of " +
            "rows.",
          "upstream",
          200,
        );
      }
      if (body.length === 0) return null;
      if (body.length > 1) {
        // `state` is the primary key, so this cannot happen without the schema having changed under
        // us. Refused rather than taking the first: picking one of two pending authorisations is
        // choosing which workspace a credential lands in by array order.
        throw new StoreError(
          "the database returned more than one pending authorisation for one state.",
          "upstream",
          200,
        );
      }
      return toPendingAuthorization(body[0]);
    },
  };
}

/**
 * The row, narrowed.
 *
 * EVERY FIELD IS CHECKED RATHER THAN CAST. The `provider` column is `text` with a length bound and
 * deliberately not an enum -- `packages/oauth/src/providers.ts` is the registry and no guard relates
 * it to the schema, so a check constraint there would be an unguarded second copy. The narrowing
 * therefore happens where the registry actually lives, which is here, and an unrecognised name is a
 * refusal rather than a lookup that returns `undefined` and fails inside `exchangeCode` with a
 * message about a missing endpoint.
 */
export function toPendingAuthorization(row: unknown): PendingAuthorization {
  const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;

  const provider = r.provider;
  if (
    typeof provider !== "string" ||
    !(OAUTH_PROVIDER_IDS as readonly string[]).includes(provider)
  ) {
    throw new StoreError(
      `the pending authorisation names provider ${JSON.stringify(provider)}, which this build has ` +
        "no registration, endpoints or scopes for.",
      "upstream",
      200,
    );
  }

  const sources = r.sources;
  if (!Array.isArray(sources) || sources.length !== 1) {
    // EXACTLY ONE, AND NOT "THE FIRST OF SEVERAL". `connect()` writes one connection for one
    // source, so a grant covering two sources would have to become two connections -- which is a
    // flow nobody has designed and which this route must not improvise by dropping the rest.
    throw new StoreError(
      "the pending authorisation does not name exactly one source, and this route creates exactly " +
        "one connection. Refusing rather than picking one.",
      "upstream",
      200,
    );
  }
  const source = sources[0];
  if (
    typeof source !== "string" ||
    !(PROVIDERS_IN_BUILD as readonly string[]).includes(source) ||
    !isOAuthSource(source as ConnectionProvider) ||
    providerFor(source as SourceId) !== provider
  ) {
    throw new StoreError(
      `the pending authorisation names source ${JSON.stringify(source)}, which this build cannot ` +
        `connect through ${provider}.`,
      "upstream",
      200,
    );
  }

  const state = r.state;
  const codeVerifier = r.code_verifier;
  const workspaceId = r.workspace_id;
  const redirectUri = r.redirect_uri;
  const createdAt = r.created_at;
  if (
    typeof state !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof workspaceId !== "string" ||
    typeof redirectUri !== "string" ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    // The message names no value. `code_verifier` is one of the fields being checked, and an error
    // that helpfully printed the row it could not parse would put it in a response body.
    throw new StoreError(
      "the pending authorisation is missing a field this flow cannot proceed without.",
      "upstream",
      200,
    );
  }

  return {
    provider: provider as ProviderId,
    workspaceId,
    sources: [source as SourceId],
    state,
    codeVerifier,
    redirectUri,
    createdAt,
  };
}

/** Everything the two routes need that is not a decision. */
export interface OAuthConnectDeps {
  readonly postgrest: PostgrestConfig;
  /** Base64, 32 bytes. `kekFromBase64` refuses anything else. */
  readonly kek: string;
  readonly crypto: VaultCrypto & AccessTokenCrypto & PkceCrypto;
  readonly requestId: string;
  /**
   * The redirect URI the provider sends the customer back to. A BINDING, NEVER A BODY FIELD.
   *
   * A caller-supplied redirect URI is an open redirect with an authorisation code attached: the
   * provider would send the code wherever the caller asked. It is stored on the pending row because
   * `exchangeCode` must present the SAME value it authorised with, and re-deriving it at callback
   * time would break every flow in flight across a deployment that changed it.
   */
  readonly redirectUri: string;
  readonly clientCredentials: ClientCredentialSource;
  /** The token endpoint's fetch. Separate from `postgrest.fetch`: two different upstreams. */
  readonly fetchImpl: typeof fetch;
  /** Injected so the pending store can be exercised without a Supabase project. */
  readonly pending?: PendingAuthorizationStore;
  /** Injected so expiry is assertable rather than dependent on a clock. */
  readonly now?: () => Date;
  /** Injected so a test can name the id the credential is sealed against. */
  readonly newConnectionId?: () => string;
}

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error, message, ...extra }, { status });
}

/**
 * Turn a PostgREST failure into a response.
 *
 * THE 403 IS THE ONE THESE ROUTES ARE ABOUT: it is `app.can_write_workspace()` refusing inside the
 * definer function, which is the tenancy decision working. Collapsing it into a 502 would tell a
 * customer to retry a write the database will refuse forever.
 *
 * NOTHING FROM THE UPSTREAM BODY TRAVELS, and here that matters more than it does on the typed lane:
 * the failing statement on the start path is an INSERT whose values include the `code_verifier`.
 * `StoreError` already drops PostgREST's `details` and `hint` for exactly this reason.
 */
function storeFailure(error: StoreError, route: string, requestId: string): Response {
  // Counts and reasons only. No workspace, no state, no verifier.
  console.log(
    JSON.stringify({
      route,
      failure: error.failure,
      upstream_status: error.status,
      request_id: requestId,
    }),
  );

  if (error.status === 401) {
    return fail(
      401,
      "unauthorized",
      "The database rejected that session. Sign in again and retry.",
    );
  }
  if (error.status === 403) {
    return fail(
      403,
      "forbidden",
      "The database refused this workspace. An owner or admin of the workspace's organisation may " +
        "connect an account, as may an analyst with an explicit grant on the workspace; a " +
        "workspace that does not exist and one you may not write to are deliberately the same " +
        "answer.",
      { request_id: requestId },
    );
  }
  if (error.status === 409) {
    return fail(
      409,
      "already_connected",
      "That account is already connected in this workspace. Replacing the credential on an " +
        "existing connection is an update, not a create, and this endpoint will not do it " +
        "silently -- a live ingest would break with `ok: true`.",
      { request_id: requestId },
    );
  }
  return fail(
    OAUTH_REFUSAL_STATUS.store_unavailable,
    "store_unavailable",
    "The database could not be reached. The authorisation itself is unharmed; retry, and quote " +
      "the request id if it persists.",
    { request_id: requestId },
  );
}

/** Authenticate, or answer. Same posture and same single 401 as `/v1/connections`. */
async function session(request: Request, deps: OAuthConnectDeps): Promise<string | Response> {
  const presented = bearerToken(request.headers.get("authorization"));
  if (presented === null) {
    return fail(
      401,
      "unauthorized",
      "Send the customer's own Supabase access token as `Authorization: Bearer <token>`. This is " +
        "not an API key: connecting an account is an account action, and the database refuses it " +
        "for a session that names no user.",
    );
  }
  try {
    // The result is deliberately unused, exactly as on `/v1/connections`: nothing here reads a
    // workspace out of the token. What this call buys is the refusal -- an unauthenticated request
    // never reaches the vault, and never spends a pending authorisation.
    await verifyAccessToken(presented, {
      secret: deps.postgrest.jwtSecret,
      now: (deps.now ?? (() => new Date()))(),
      crypto: deps.crypto,
    });
  } catch (error) {
    if (error instanceof AccessTokenError) return fail(401, "unauthorized", error.message);
    throw error;
  }
  return presented;
}

function clientOrResponse(
  deps: OAuthConnectDeps,
  provider: ProviderId,
  route: string,
): ClientCredentials | Response {
  const resolved = deps.clientCredentials(provider);
  if ("missing" in resolved) {
    // The same 503 the other routes answer with, and for the same reason: a deployment that has not
    // registered an app must not be indistinguishable from one that refused the authorisation.
    return fail(
      503,
      "not_configured",
      `\`${route}\` is missing ${resolved.missing.join(", ")} on this deployment. The flow, the ` +
        `store and their contracts are implemented and tested; the ${PROVIDERS[provider].displayName} ` +
        "client registration is not configured here.",
    );
  }
  return resolved;
}

/**
 * `POST /v1/connections/oauth/start`.
 *
 * WHAT COMES BACK IS THE URL AND NOTHING ELSE THAT MATTERS. The `code_verifier` never leaves this
 * isolate -- it goes to the database and nowhere else -- and it is not in the URL either, by
 * construction: `startAuthorization` puts the CHALLENGE in the query string and keeps the verifier
 * on the pending record. `oauth-connect.test.ts` asserts its absence from both.
 *
 * `expires_at` IS DERIVED FROM THE DATABASE'S CLOCK AND THE ONE TTL CONSTANT. It is the honest
 * answer to "how long has the customer got", and it is computed from the instant the database
 * actually recorded plus `PENDING_TTL_MS` -- not from this isolate's clock, which is not the clock
 * the row was written by, and not from a second constant in SQL, which is the thing the migration
 * refuses to introduce.
 */
export async function handleOAuthStart(
  request: Request,
  deps: OAuthConnectDeps,
): Promise<Response> {
  const route = "/v1/connections/oauth/start";
  if (request.method !== "POST") {
    return fail(405, "method_not_allowed", `\`${route}\` is a POST.`);
  }

  const authenticated = await session(request, deps);
  if (authenticated instanceof Response) return authenticated;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "The body is not JSON.");
  }

  let parsed: StartRequest;
  try {
    parsed = parseStartRequest(body);
  } catch (error) {
    if (error instanceof OAuthConnectError) {
      return fail(OAUTH_REFUSAL_STATUS[error.refusal], error.refusal, error.message);
    }
    throw error;
  }

  const provider = providerFor(parsed.source);
  const client = clientOrResponse(deps, provider, route);
  if (client instanceof Response) return client;

  const now = (deps.now ?? (() => new Date()))();

  let started: Awaited<ReturnType<typeof startAuthorization>>;
  try {
    started = await startAuthorization(deps.crypto, {
      provider,
      workspaceId: parsed.workspaceId,
      sources: [parsed.source],
      clientId: client.clientId,
      redirectUri: deps.redirectUri,
      now,
    });
  } catch (error) {
    // `startAuthorization` refuses a provider that serves none of the requested sources. It cannot
    // happen through `oauthSource` above -- `providerFor` is a total map -- and it is caught rather
    // than allowed to become a 500, because a RangeError here would be reported as a bug in the
    // Worker when it is a statement about the registry.
    if (error instanceof RangeError) {
      return fail(
        OAUTH_REFUSAL_STATUS.unsupported_lane,
        "unsupported_lane",
        `${PROVIDERS[provider].displayName} publishes no scope for ${parsed.source}, so there is ` +
          "nothing to ask the customer to grant.",
      );
    }
    throw error;
  }

  const store = deps.pending ?? createPendingAuthorizationStore(deps.postgrest);
  let createdAt: string;
  try {
    createdAt = await store.start(started.pending, authenticated);
  } catch (error) {
    if (error instanceof StoreError) return storeFailure(error, route, deps.requestId);
    throw error;
  }

  // The route, a request id, the provider and the source. NOT the state, which is a CSRF token and
  // would let anyone holding the log complete someone else's authorisation; NOT the workspace; and
  // above all not the verifier.
  console.log(
    JSON.stringify({
      route,
      request_id: deps.requestId,
      provider,
      source: parsed.source,
    }),
  );

  // 200, not 201. Nothing addressable was created for this caller -- the pending row has no URL and
  // no id the caller may ever fetch, which is the whole point of it.
  return Response.json({
    ok: true,
    authorization_url: started.url,
    provider,
    source: parsed.source,
    expires_at: new Date(Date.parse(createdAt) + PENDING_TTL_MS).toISOString(),
    request_id: deps.requestId,
  });
}

/**
 * Turn an `AuthorizationError` into a refusal.
 *
 * MAPPED RATHER THAN PASSED THROUGH, so the wire vocabulary is this route's and does not change
 * because `@repo/oauth` renamed a code. `expired` becomes `authorization_expired` because
 * `credential_expired` already exists on the sibling route and means something different -- a
 * pasted bearer token that was dead on arrival, not an authorisation attempt that took too long.
 */
function refusalFor(code: AuthorizationError["code"]): OAuthRefusal {
  switch (code) {
    case "provider_denied":
      return "provider_denied";
    case "state_mismatch":
      return "state_mismatch";
    case "expired":
      return "authorization_expired";
    case "missing_refresh_token":
      return "missing_refresh_token";
    default:
      return "token_exchange_failed";
  }
}

/**
 * `POST /v1/connections/oauth/callback`.
 *
 * THE ORDER OF THE STEPS IS THE SECURITY ARGUMENT, so it is written out rather than left to be read
 * off the control flow:
 *
 *   authenticate  -- an unauthenticated request never spends a pending authorisation
 *   parse         -- a malformed body never spends one either
 *   redeem        -- the state is looked up and DESTROYED; tenancy is decided by Postgres
 *   verifyCallback-- provider error, then state, then age, in `@repo/oauth`'s order and not ours
 *   exchange      -- the first time this route talks to the provider at all
 *   connect       -- scope check, seal, insert, each owned by the package that owns it
 *
 * NOTHING ABOVE `exchange` COSTS A ROUND TRIP TO A PROVIDER, and nothing above `connect` reaches the
 * vault. A refused callback therefore leaves no half-made connection and no unwrapped credential.
 */
export async function handleOAuthCallback(
  request: Request,
  deps: OAuthConnectDeps,
): Promise<Response> {
  const route = "/v1/connections/oauth/callback";
  if (request.method !== "POST") {
    return fail(405, "method_not_allowed", `\`${route}\` is a POST.`);
  }

  const authenticated = await session(request, deps);
  if (authenticated instanceof Response) return authenticated;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "The body is not JSON.");
  }

  let parsed: CallbackRequest;
  try {
    parsed = parseCallbackRequest(body);
  } catch (error) {
    if (error instanceof OAuthConnectError) {
      return fail(OAUTH_REFUSAL_STATUS[error.refusal], error.refusal, error.message);
    }
    throw error;
  }

  const store = deps.pending ?? createPendingAuthorizationStore(deps.postgrest);
  const now = (deps.now ?? (() => new Date()))();

  try {
    const pending = await store.redeem(parsed.state, authenticated);
    if (pending === null) {
      // ONE ANSWER FOR FOUR SITUATIONS, because the database gives one answer for four situations:
      // no such state, already redeemed, swept, and another tenant's. See `OAuthRefusal`.
      throw new OAuthConnectError(
        "that authorisation cannot be completed. It was never started, has already been " +
          "completed, or belongs to a different workspace. Start the connection again.",
        "state_mismatch",
      );
    }

    // `@repo/oauth`'S ORDER, NOT OURS. Provider error first -- a customer who declined must be told
    // that and not that their state was wrong -- then the constant-time state compare, then the age
    // against `PENDING_TTL_MS`, which is the single authority on expiry in this repository.
    verifyCallback({
      pending,
      returnedState: parsed.state,
      providerError: parsed.providerError,
      now,
    });

    // Unreachable while `verifyCallback` refuses every path that leaves these null, and asserted
    // rather than assumed: `parseCallbackRequest` nulls both exactly when `provider_error` is
    // present, and `provider_denied` is thrown above for that case.
    if (parsed.code === null || parsed.externalAccountId === null) {
      throw new OAuthConnectError(
        "`code` and `external_account_id` are required to complete an authorisation.",
        "bad_request",
      );
    }

    const client = clientOrResponse(deps, pending.provider, route);
    if (client instanceof Response) return client;

    const tokens = await exchangeCode(
      {
        pending,
        code: parsed.code,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        now,
      },
      deps.fetchImpl,
    );

    const row = await seal(
      { externalAccountId: parsed.externalAccountId, displayName: parsed.displayName },
      pending,
      tokens,
      deps,
      authenticated,
    );

    // THE LOG LINE. The provider, the lane, the connection id and a request id -- the same four
    // `/v1/connections` carries, for the same reasons. NOT `external_account_id`, NOT the granted
    // scopes, NOT the state, and nothing whatever off the token response.
    console.log(
      JSON.stringify({
        route,
        request_id: deps.requestId,
        provider: row.provider,
        credential_lane: row.credentialLane,
        connection_id: row.id,
      }),
    );

    return Response.json(
      { ok: true, connection_id: row.id, status: row.status, request_id: deps.requestId },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OAuthConnectError) {
      return fail(OAUTH_REFUSAL_STATUS[error.refusal], error.refusal, error.message);
    }
    if (error instanceof AuthorizationError) {
      // `AuthorizationError`'s sentences are written in `@repo/oauth` and none of them interpolates
      // a token: `exchangeCode` deliberately excludes the provider's response body, because
      // providers echo request parameters in errors and the client secret is a request parameter.
      // `provider_denied` carries the provider's own `error` code, which is the caller's own input
      // on its way back to them.
      const refusal = refusalFor(error.code);
      return fail(OAUTH_REFUSAL_STATUS[refusal], refusal, error.message);
    }
    if (error instanceof ConnectionError) {
      // The grant came back missing a scope the source needs. `connect()` refuses BEFORE anything
      // is sealed, which is why this is a 409 and not a half-written row.
      const refusal: OAuthRefusal =
        error.code === "missing_scope" ? "missing_scope" : "invalid_credential";
      return fail(OAUTH_REFUSAL_STATUS[refusal], refusal, error.message);
    }
    if (error instanceof StoreError) return storeFailure(error, route, deps.requestId);
    // Re-raised rather than flattened into a 502. An unrecognised throw is a bug in this file, and a
    // 502 would tell the caller to retry it forever.
    throw error;
  }
}

/**
 * Seal the grant and write the row.
 *
 * `@repo/connections` OWNS THE SEAL. `connect()` checks the granted scopes against what the source
 * needs, builds the `kind: "oauth"` blob, binds the ciphertext to `{workspaceId, connectionId}` and
 * writes through the store. This function exists only to turn `CREDENTIAL_KEK` into bytes and to
 * hand over -- and the KEK refusal is separate so that a deployment that cannot seal says so instead
 * of producing a row nothing can open.
 */
async function seal(
  account: { readonly externalAccountId: string; readonly displayName: string | null },
  pending: PendingAuthorization,
  tokens: TokenResponse,
  deps: OAuthConnectDeps,
  accessToken: string,
): Promise<ConnectionRow> {
  let kek: Uint8Array;
  try {
    kek = kekFromBase64(deps.kek);
  } catch {
    // The message is not carried through: `kekFromBase64` says what is wrong with the key, and
    // nothing about the key encryption key belongs in a customer's response body.
    throw new OAuthConnectError(
      "`CREDENTIAL_KEK` on this deployment is not 32 bytes of base64, so no credential can be " +
        "sealed. Nothing was stored.",
      "bad_kek",
    );
  }

  const connectionId = (deps.newConnectionId ?? (() => crypto.randomUUID()))();

  // `toPendingAuthorization` refuses a row that does not name EXACTLY ONE source, so this index is
  // total rather than optimistic -- which is why there is no `?? ` here and must never be one: a
  // default source would file a Loyverse grant as a GA4 connection.
  const [source] = pending.sources as readonly [SourceId];

  return connect(deps.crypto, createInsertingStore(deps.postgrest, accessToken, connectionId), {
    // FROM THE PENDING ROW, NOT FROM THE BODY. Property 3 in the module note.
    workspaceId: pending.workspaceId,
    connectionId,
    source,
    externalAccountId: account.externalAccountId,
    ...(account.displayName === null ? {} : { displayName: account.displayName }),
    tokens,
    kek,
    keyVersion: KEY_VERSION,
  });
}
