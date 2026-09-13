import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The endpoint's own bound on the same value, imported from its source. `_oauth-refusals.test.ts`
// already reaches across the workspace this way, and for the same reason: the number is only
// meaningful next to the one it is supposed to agree with.
import { MAX_EXTERNAL_ACCOUNT_ID } from "../../../api-edge/src/connect.ts";
import { CONNECTIONS } from "../_content";
import { MAX_ACCOUNT } from "./_oauth";
import { OAUTH_ONLY_PROVIDERS } from "./_providers";

/**
 * THE PROMISE THIS FORM MAKES, ASSERTED AS AN ABSENCE.
 *
 * `CONNECTIONS.oauthNote` tells a customer, in the product's own words, "No key of yours is typed
 * on this page and none is asked for." Everything about this door depends on that being literally
 * true: the Worker refuses `credential_lane: "oauth"` on the typed endpoint precisely so that no
 * pasted string is ever fabricated into a token response, and `PROVIDER_LANES.loyverse` is
 * OAuth-only even though Loyverse does issue a pasteable token, because that token can write.
 *
 * AND NOTHING TESTED IT. A `<input type="password" name="secret" />` added to this component left
 * every test in this app passing and the whole gate green. The promise was prose; the code was
 * unattended. That is the shape of failure this repository exists to refuse -- a sentence on a
 * screen that nothing underneath is holding to.
 *
 * SO THE ASSERTION IS ON THE WHOLE FIELD SET, NOT ON `type="password"`. Banning the attribute alone
 * would be a guard with the obvious way round it: `<input name="secret">` with no type is a text
 * box that takes a secret just as well, and reads back in the DOM as `type="text"`. What this
 * asserts instead is that the form's controls are EXACTLY the two it is allowed to have -- one
 * select naming the provider, one text input naming the account -- so any third field of any kind,
 * secret-shaped or not, fails here and has to be argued for rather than merely added.
 *
 * The action is mocked because it is a `"use server"` module that reaches the Supabase client, the
 * cookie store and the network. It is tested in full in `oauth-actions.test.ts`; what is under test
 * here is the markup.
 */

vi.mock("./oauth-actions", () => ({
  beginAuthorization: async () => ({}),
}));

const { OAuthStartForm } = await import("./oauth-form");

const markup = renderToStaticMarkup(<OAuthStartForm />);

/** Every tag of the given name in the rendered markup, as its raw opening tag. */
function tags(name: string): string[] {
  return [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);
}

/** The value of one attribute on one opening tag, or null when the attribute is absent. */
function attr(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

describe("the authorisation form asks for no secret", () => {
  it("renders no password field of any kind", () => {
    expect(markup).not.toContain('type="password"');
  });

  it("has exactly one input, and it is the account id", () => {
    const inputs = tags("input");
    expect(inputs, `the form rendered ${inputs.length} inputs: ${inputs.join(" ")}`).toHaveLength(
      1,
    );

    const account = inputs[0] ?? "";
    expect(attr(account, "name")).toBe("external_account_id");
    // Absent, not `type="text"`: the point is that nothing here declares a credential-shaped input.
    // A field that arrives with any explicit type is a new decision and should fail this.
    expect(attr(account, "type")).toBeNull();
    expect(account).toContain("required");
    expect(attr(account, "maxLength") ?? attr(account, "maxlength")).toBe(String(MAX_ACCOUNT));
  });

  it("has exactly one select, naming the provider, and no textarea at all", () => {
    const selects = tags("select");
    expect(selects).toHaveLength(1);
    expect(attr(selects[0] ?? "", "name")).toBe("provider");
    // A textarea is what a pasted private key goes in. There is no reason for one on this form and
    // no reason to discover that after it has shipped.
    expect(tags("textarea")).toHaveLength(0);
  });

  it("offers every OAuth-only source and nothing else", () => {
    const options = [...markup.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    expect(options).toEqual([...OAUTH_ONLY_PROVIDERS]);
  });

  it("says where the customer is about to go, in the product's own words", () => {
    expect(markup).toContain(CONNECTIONS.oauthSubmit);
    expect(markup).toContain(CONNECTIONS.oauthAccountNote);
    expect(markup).toContain(CONNECTIONS.oauthLeaveNote);
  });

  it("does not carry the typed lane's credential fields under any name", () => {
    // The names the OTHER form on the same screen uses. They are the most likely thing for somebody
    // to copy across when a provider turns out to want one, and the copy would be silent.
    for (const name of ["key_id", "key_secret", "api_key", "token", "secret", "password"]) {
      expect(markup, `the authorisation form rendered a field named ${name}`).not.toContain(
        `name="${name}"`,
      );
    }
  });
});

describe("the account bound this screen enforces", () => {
  it("is no wider than the one the endpoint will accept", () => {
    // Two constants, two files, one value, and nothing held them together: this screen could grow
    // its limit to 4096 and every test would pass while the endpoint refused every long account id
    // AFTER the customer had already been sent to a consent screen. The endpoint is the authority,
    // so the assertion is one-directional -- this screen may be stricter, never looser.
    expect(MAX_ACCOUNT).toBeLessThanOrEqual(MAX_EXTERNAL_ACCOUNT_ID);
  });
});
