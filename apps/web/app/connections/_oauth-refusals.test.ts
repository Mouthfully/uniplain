import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The typed lane's refusal union, imported from its source: `OAUTH_REFUSAL_STATUS` spreads it, so
// half the codes this door can answer with are declared over there. See `_providers.test.ts` for
// why a relative path into another workspace package is what a test may do and shipped code may not.
import { REFUSAL_STATUS } from "../../../api-edge/src/connect.ts";
import { CONNECTIONS } from "../_content";
import { OAUTH_ENDPOINT_MESSAGES, OAUTH_LOCAL_MESSAGES, oauthMessageFor } from "./_oauth-refusals";

const OAUTH_SOURCE = new URL("../../../api-edge/src/oauth-connect.ts", import.meta.url);
const INDEX_SOURCE = new URL("../../../api-edge/src/index.ts", import.meta.url);

/**
 * EVERY `error` CODE THE AUTHORISATION DOOR CAN PUT IN A BODY, READ OFF THE DOOR ITSELF.
 *
 * The source is SCANNED rather than imported. `oauth-connect.ts` imports `@repo/connections`,
 * `@repo/oauth`, `@repo/store` and `@repo/vault` and spells its own siblings `./connect.js` -- none
 * of which resolves from this app -- so a text scan is the only way this app can be held to that
 * file at all. It is the same trade `_refusals.test.ts` already makes for half its list.
 *
 * THREE PLACES, BECAUSE THE CODES COME FROM THREE PLACES: the `fail(status, "code", ...)` literals,
 * the keys of `OAUTH_REFUSAL_STATUS` (which reach `fail` through a variable the regex cannot see),
 * and `REFUSAL_STATUS` itself, which that object spreads.
 */
function codesTheDoorCanReturn(): readonly string[] {
  const source = readFileSync(OAUTH_SOURCE, "utf8");
  const found = new Set<string>();

  for (const match of source.matchAll(
    /\bfail\(\s*(?:\d+|OAUTH_REFUSAL_STATUS\.\w+),\s*"([a-z_]+)"/g,
  )) {
    if (match[1] !== undefined) found.add(match[1]);
  }

  const table = /export const OAUTH_REFUSAL_STATUS[^{]*\{([\s\S]*?)\n\};/.exec(source);
  expect(table?.[1], "OAUTH_REFUSAL_STATUS could not be read off the source").toBeTypeOf("string");
  for (const entry of (table?.[1] ?? "").matchAll(/^\s{2}([a-z_]+):\s*\d+,/gm)) {
    if (entry[1] !== undefined) found.add(entry[1]);
  }

  for (const refusal of Object.keys(REFUSAL_STATUS)) found.add(refusal);
  return [...found];
}

describe("the authorisation screen answers every refusal its endpoint can return", () => {
  it("has a message for each code, and none of them is the generic one", () => {
    const codes = codesTheDoorCanReturn();
    // A guard that found nothing is not a passing guard. The union alone has seven members beyond
    // the typed lane's six.
    expect(codes.length).toBeGreaterThan(12);

    for (const code of codes) {
      expect(OAUTH_ENDPOINT_MESSAGES[code], code).toBeTypeOf("string");
      expect(oauthMessageFor(code), code).not.toBe(CONNECTIONS.oauthErrors.unexpected);
    }
  });

  it("covers the 503 the Worker answers before either route is reached", () => {
    // `oauthNotConfigured` refuses a deployment missing OAUTH_REDIRECT_URI or a Supabase binding
    // with this code, and neither handler is called.
    expect(readFileSync(INDEX_SOURCE, "utf8")).toContain('error: "not_configured"');
    expect(oauthMessageFor("not_configured")).toBe(CONNECTIONS.oauthErrors.not_configured);
  });

  /**
   * THE SPLIT BETWEEN RETRYABLE AND NOT IS THE ONE THE ENDPOINT'S OWN UNION REFUSES TO COLLAPSE,
   * and a screen that gives both the same sentence collapses it again where the customer reads it.
   * `store_unavailable` is a database that could not be reached; `state_mismatch` is an
   * authorisation that is gone for good.
   */
  it("says something different for each code", () => {
    const messages = Object.values(OAUTH_ENDPOINT_MESSAGES);
    // `invalid_request` and `method_not_allowed` deliberately share one sentence: both mean this
    // app sent something malformed, which is one fault with one fix and not the customer's.
    expect(new Set(messages).size).toBe(messages.length - 1);
  });

  /**
   * THE TWO TABLES MUST NOT COLLIDE. One lookup serves codes decided here and codes decided by the
   * endpoint, so a name in both would mean the sentence depends on which spread won -- and the two
   * meanings of such a name would differ by which side of the network the customer never sees.
   */
  it("keeps the codes this app decides disjoint from the endpoint's", () => {
    for (const local of Object.keys(OAUTH_LOCAL_MESSAGES)) {
      expect(OAUTH_ENDPOINT_MESSAGES[local], local).toBeUndefined();
    }
  });

  it("gives every local refusal a sentence of its own", () => {
    const messages = Object.values(OAUTH_LOCAL_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
  });

  /**
   * NO SENTENCE ON THIS DOOR MAY DESCRIBE TYPING A CREDENTIAL. Nothing is pasted here, and the
   * obvious edit -- spreading `ENDPOINT_MESSAGES` from the typed lane -- would import a dozen
   * sentences that send a customer looking for a field that is not on their screen.
   */
  it("never tells a customer to check what they pasted", () => {
    for (const [code, message] of Object.entries({
      ...OAUTH_ENDPOINT_MESSAGES,
      ...OAUTH_LOCAL_MESSAGES,
    })) {
      expect(message.toLowerCase(), code).not.toContain("paste");
      expect(message.toLowerCase(), code).not.toContain("typing a credential");
    }
  });

  it("admits it does not recognise anything else", () => {
    expect(oauthMessageFor("something_new")).toBe(CONNECTIONS.oauthErrors.unexpected);
    expect(oauthMessageFor(undefined)).toBe(CONNECTIONS.oauthErrors.unexpected);
    expect(oauthMessageFor(7)).toBe(CONNECTIONS.oauthErrors.unexpected);
  });
});
