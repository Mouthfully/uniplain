import { describe, expect, it } from "vitest";

import {
  callbackDecision,
  type CallbackInput,
  type PendingContext,
  decodeContext,
  encodeContext,
  MAX_ACCOUNT,
  safeReference,
  stateFromAuthorizeUrl,
} from "./_oauth";

/**
 * THE RETURN LEG'S JUDGEMENT, ASSERTED WITHOUT A SESSION, A COOKIE STORE OR A NETWORK.
 *
 * What is being held here is not "does the flow work" -- the Worker's own suite covers the half
 * that spends a credential. It is the narrower property this half is responsible for: that an
 * authorisation is never completed with an account id that belongs to a different request, and that
 * a customer who comes back to a lapsed session is told so rather than shown a sign-in page.
 */

const STATE = "kZ8-state-from-the-worker";

const context: PendingContext = {
  state: STATE,
  provider: "ga4",
  account: "properties/123456",
};

function input(overrides: Partial<CallbackInput> = {}): CallbackInput {
  return {
    returnedState: STATE,
    code: "4/authorisation-code",
    providerError: null,
    context,
    signedIn: true,
    ...overrides,
  };
}

describe("the cookie that crosses the detour", () => {
  it("round-trips the three values it carries", () => {
    expect(decodeContext(encodeContext(context))).toEqual(context);
  });

  /**
   * A COOKIE THAT DOES NOT NARROW IS TREATED AS ABSENT, WHICH REFUSES. Every one of these would
   * otherwise become an `external_account_id` posted at an endpoint that files a credential under
   * it -- and the endpoint cannot tell a bad account id from a good one either.
   */
  it("refuses anything that is not the shape it wrote", () => {
    expect(decodeContext(undefined)).toBeNull();
    expect(decodeContext("")).toBeNull();
    expect(decodeContext("not json")).toBeNull();
    expect(decodeContext("null")).toBeNull();
    expect(decodeContext('"a string"')).toBeNull();
    expect(decodeContext(JSON.stringify({ ...context, state: "" }))).toBeNull();
    expect(decodeContext(JSON.stringify({ ...context, account: "" }))).toBeNull();
    expect(decodeContext(JSON.stringify({ ...context, account: 7 }))).toBeNull();
    expect(decodeContext(JSON.stringify({ state: STATE, provider: "ga4" }))).toBeNull();
  });

  /**
   * THE PROVIDER IS CHECKED AGAINST THE LIST THIS SCREEN OFFERS, not merely against "is a string".
   * It decides which words label the account field, so a value from a cookie that named
   * `woocommerce` -- a source with no consent screen at all -- would render a field asking for a
   * store address and post it as a Google property.
   */
  it("refuses a provider this screen does not offer on this door", () => {
    expect(decodeContext(JSON.stringify({ ...context, provider: "woocommerce" }))).toBeNull();
    // `shopify` STAYS ON THIS SIDE, and now for a sharper reason than before. It used to be here
    // because nothing in the repository could read Shopify at all. It is here now because its
    // connector is real and its OAUTH DOOR IS NOT: `@repo/oauth` holds endpoints as constants and
    // Shopify's are per-shop. A screen that accepted it would start a flow that cannot finish.
    expect(decodeContext(JSON.stringify({ ...context, provider: "shopify" }))).toBeNull();
  });

  it("refuses an account id longer than the bound", () => {
    const account = "p".repeat(MAX_ACCOUNT + 1);
    expect(decodeContext(JSON.stringify({ ...context, account }))).toBeNull();
    expect(decodeContext(JSON.stringify({ ...context, account: account.slice(1) }))).not.toBeNull();
  });
});

describe("the state is read off the authorize URL and never invented", () => {
  it("reads the parameter the Worker put there", () => {
    const url = new URL(`https://accounts.example.test/o/oauth2/auth?state=${STATE}&scope=read`);
    expect(stateFromAuthorizeUrl(url)).toBe(STATE);
  });

  it("says so when there is none, rather than returning an empty key", () => {
    expect(stateFromAuthorizeUrl(new URL("https://accounts.example.test/auth"))).toBeNull();
    expect(stateFromAuthorizeUrl(new URL("https://accounts.example.test/auth?state="))).toBeNull();
  });
});

describe("the callback decision", () => {
  it("completes with the account the cookie carried, and no workspace of any kind", () => {
    const decision = callbackDecision(input());
    expect(decision.kind).toBe("complete");
    if (decision.kind !== "complete") return;

    expect(decision.body).toEqual({
      state: STATE,
      code: "4/authorisation-code",
      external_account_id: "properties/123456",
    });
    // THE FIELD A CRAFTED REDIRECT WOULD WANT. The workspace is on the pending row in Postgres and
    // is not the caller's to choose; a `workspace_id` here is the first thing anybody would add to
    // "fix" a cross-tenant refusal.
    expect(Object.keys(decision.body)).not.toContain("workspace_id");
  });

  /**
   * THE ONE THIS MODULE EXISTS FOR. The cookie names a different authorisation than the one that
   * came back, so the account id in it was chosen for a different grant. Completing anyway files a
   * credential under an account the customer never named for it -- a connection that looks right
   * and reads somebody else's numbers.
   */
  it("refuses when the cookie names a different authorisation, and posts nothing", () => {
    const decision = callbackDecision(input({ returnedState: "a-different-state" }));
    expect(decision).toEqual({ kind: "refuse", error: "contextMismatch" });
  });

  it("refuses a lapsed session ahead of everything else, by name", () => {
    // A customer who has just granted access at the provider must be told what happened, rather
    // than being redirected to a sign-in page that says nothing about the connection.
    expect(callbackDecision(input({ signedIn: false }))).toEqual({
      kind: "refuse",
      error: "sessionLapsed",
    });
    // Even when everything else is also wrong, the session is the answer: it is the one the
    // customer can act on.
    expect(
      callbackDecision(input({ signedIn: false, context: null, returnedState: null })),
    ).toEqual({ kind: "refuse", error: "sessionLapsed" });
  });

  it("refuses a return that names no authorisation", () => {
    expect(callbackDecision(input({ returnedState: null }))).toEqual({
      kind: "refuse",
      error: "noState",
    });
    expect(callbackDecision(input({ returnedState: "" }))).toEqual({
      kind: "refuse",
      error: "noState",
    });
  });

  it("refuses when the browser no longer holds the request that started this", () => {
    expect(callbackDecision(input({ context: null }))).toEqual({
      kind: "refuse",
      error: "lostContext",
    });
  });

  /**
   * A DECLINE IS FORWARDED RATHER THAN ANSWERED HERE, so the pending row is redeemed and destroyed
   * rather than left for the sweep -- and so the ORDER of "you declined" against "your state was
   * wrong" stays in `@repo/oauth`, which is the single authority on it.
   */
  it("forwards the provider's own error with no code and no account", () => {
    const decision = callbackDecision(input({ providerError: "access_denied", code: null }));
    expect(decision.kind).toBe("complete");
    if (decision.kind !== "complete") return;
    expect(decision.body).toEqual({ state: STATE, provider_error: "access_denied" });
  });

  it("still checks the cookie matches before forwarding a decline", () => {
    // Otherwise a crafted redirect carrying `error=` would spend somebody else's pending row.
    expect(
      callbackDecision(
        input({ providerError: "access_denied", code: null, returnedState: "another" }),
      ),
    ).toEqual({ kind: "refuse", error: "contextMismatch" });
  });

  it("refuses a return with neither a permission nor a reason", () => {
    expect(callbackDecision(input({ code: null, providerError: null }))).toEqual({
      kind: "refuse",
      error: "noCode",
    });
  });
});

describe("the request id put in a URL", () => {
  it("passes a reference and drops anything else, rather than repairing it", () => {
    expect(safeReference("req-01HXYZ_9")).toBe("req-01HXYZ_9");
    expect(safeReference("")).toBeNull();
    expect(safeReference("has space")).toBeNull();
    expect(safeReference("a".repeat(65))).toBeNull();
    expect(safeReference(7)).toBeNull();
    expect(safeReference(undefined)).toBeNull();
  });
});
