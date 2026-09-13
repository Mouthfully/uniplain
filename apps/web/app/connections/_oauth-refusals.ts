import { CONNECTIONS } from "../_content";

/**
 * A SENTENCE FOR EVERY CODE THE AUTHORISATION DOOR CAN ANSWER WITH, PLUS THE ONES THIS APP DECIDES.
 *
 * The same module shape as `_refusals.ts`, for the same mechanical reason -- a `"use server"` file
 * may export nothing but async functions -- and the same purpose: a customer who cannot tell a
 * declined consent screen from a broken database emails support either way.
 *
 * IT SHARES NO TABLE WITH `_refusals.ts`. `POST /v1/connections/oauth/*` deliberately reuses
 * `ConnectRefusal`'s vocabulary for the questions that are the same, and a `{ ...ENDPOINT_MESSAGES }`
 * spread here would be one line and would put sentences about pasting a credential on a screen
 * where nothing was pasted. See `CONNECTIONS.oauthErrors` for the full argument.
 *
 * `_oauth-refusals.test.ts` reads the code list off `apps/api-edge/src/oauth-connect.ts` itself, so
 * a refusal added there and forgotten here fails a test rather than reaching a customer as "that
 * answer was not one this screen recognises".
 */

/** Codes `POST /v1/connections/oauth/start` and `/callback` can put in a body. */
export const OAUTH_ENDPOINT_MESSAGES: Record<string, string> = {
  unauthorized: CONNECTIONS.oauthErrors.unauthorized,
  forbidden: CONNECTIONS.oauthErrors.forbidden,
  already_connected: CONNECTIONS.oauthErrors.already_connected,
  bad_request: CONNECTIONS.oauthErrors.bad_request,
  unknown_provider: CONNECTIONS.oauthErrors.unknown_provider,
  unsupported_lane: CONNECTIONS.oauthErrors.unsupported_lane,
  invalid_credential: CONNECTIONS.oauthErrors.invalid_credential,
  credential_expired: CONNECTIONS.oauthErrors.credential_expired,
  bad_kek: CONNECTIONS.oauthErrors.bad_kek,
  not_configured: CONNECTIONS.oauthErrors.not_configured,
  state_mismatch: CONNECTIONS.oauthErrors.state_mismatch,
  authorization_expired: CONNECTIONS.oauthErrors.authorization_expired,
  provider_denied: CONNECTIONS.oauthErrors.provider_denied,
  token_exchange_failed: CONNECTIONS.oauthErrors.token_exchange_failed,
  missing_refresh_token: CONNECTIONS.oauthErrors.missing_refresh_token,
  missing_scope: CONNECTIONS.oauthErrors.missing_scope,
  store_unavailable: CONNECTIONS.oauthErrors.store_unavailable,
  // Both mean this app sent something malformed, which is one fault with one fix and not the
  // customer's. Saying "check the account you named" would send them to look at a correct form.
  invalid_request: CONNECTIONS.oauthErrors.clientFault,
  method_not_allowed: CONNECTIONS.oauthErrors.clientFault,
};

/**
 * Codes this app decides for itself, on either leg.
 *
 * DELIBERATELY DISJOINT FROM THE SET ABOVE, asserted by the test. One lookup serves both because a
 * customer should not have to know which side of the network refused them -- but two codes with one
 * spelling and two meanings would make the sentence depend on which table was consulted first.
 */
export const OAUTH_LOCAL_MESSAGES: Record<string, string> = {
  sessionLapsed: CONNECTIONS.oauthErrors.sessionLapsed,
  lostContext: CONNECTIONS.oauthErrors.lostContext,
  contextMismatch: CONNECTIONS.oauthErrors.contextMismatch,
  noState: CONNECTIONS.oauthErrors.noState,
  noCode: CONNECTIONS.oauthErrors.noCode,
  noWorkspace: CONNECTIONS.oauthErrors.noWorkspace,
  unknownProvider: CONNECTIONS.oauthErrors.unknownProvider,
  missingAccount: CONNECTIONS.oauthErrors.missingAccount,
  workspaceUnavailable: CONNECTIONS.oauthErrors.workspaceUnavailable,
  notDeployed: CONNECTIONS.oauthErrors.notDeployed,
  unusableAnswer: CONNECTIONS.oauthErrors.unusableAnswer,
  unreachable: CONNECTIONS.oauthErrors.unreachable,
  unexpected: CONNECTIONS.oauthErrors.unexpected,
};

export const OAUTH_MESSAGES: Record<string, string> = {
  ...OAUTH_ENDPOINT_MESSAGES,
  ...OAUTH_LOCAL_MESSAGES,
};

/** The sentence for a code, or the one that admits this screen does not recognise it. */
export function oauthMessageFor(code: unknown): string {
  if (typeof code !== "string") return CONNECTIONS.oauthErrors.unexpected;
  return OAUTH_MESSAGES[code] ?? CONNECTIONS.oauthErrors.unexpected;
}
