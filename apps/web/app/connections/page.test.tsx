import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CONNECTIONS } from "../_content";
import { OAUTH_MESSAGES, oauthMessageFor } from "./_oauth-refusals";

/**
 * THE RETURN LEG AS THE CUSTOMER SEES IT, AND THE ONE THING THIS PAGE MUST NEVER DO WITH IT.
 *
 * The callback route finishes an authorisation and redirects here carrying a CODE -- never a
 * sentence, never an account id, never anything from the provider. `oauthMessageFor` is the only
 * thing that turns that code into words, and that is the whole mechanism by which a query string
 * somebody types by hand can produce a sentence this product wrote or none at all, but never one
 * they chose.
 *
 * NOTHING TESTED IT. Replacing `{oauthMessageFor(outcome)}` with `{outcome}` left all 318 tests in
 * this app passing and every guard green, while the page rendered whatever was in the URL, in the
 * product's own error styling, to a signed-in customer. React escapes it, so it is not a script
 * injection -- it is worse in the way this repository cares about: an attacker-chosen sentence
 * wearing the product's voice, telling an owner what to do about their own data.
 *
 * WHAT THIS FILE RENDERS IS THE PAGE ITSELF, not the helper. `_oauth-refusals.test.ts` already
 * holds the TABLE to the endpoint; a second test of the table would have passed through the
 * mutation above untouched, because the table was never the thing that broke. The gap was between
 * a correct table and the JSX, and only a render crosses it.
 *
 * Everything the page reads -- the auth check, the session, the workspace, the connection list --
 * is faked. Each has its own tests; what is under test here is what reaches the markup.
 */

const F = vi.hoisted(() => ({
  workspace: { kind: "ready", workspace: { id: "w-1", name: "Workspace" } } as {
    kind: string;
    workspace?: { id: string; name: string };
    reason?: string;
  },
  connections: { kind: "ready", rows: [] } as { kind: string; rows?: unknown[]; reason?: string },
  user: { id: "user-1" } as { id: string } | null,
  redirects: [] as string[],
}));

vi.mock("../_auth/env", () => ({ isAuthConfigured: () => true }));
vi.mock("../_auth/server", () => ({ currentUser: async () => F.user }));
vi.mock("../_auth/workspace", () => ({ currentWorkspace: async () => F.workspace }));
vi.mock("./_connections", () => ({ workspaceConnections: async () => F.connections }));
vi.mock("./actions", () => ({ createConnection: async () => ({}) }));
vi.mock("./oauth-actions", () => ({ beginAuthorization: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    F.redirects.push(to);
    throw new Error(`redirected to ${to}`);
  },
}));

const Page = (await import("./page")).default;

async function render(params: Record<string, string | string[] | undefined>): Promise<string> {
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
}

/**
 * The markup with its entities put back, for assertions about SENTENCES rather than about tags.
 *
 * Not cosmetic: every sentence this page can print has an apostrophe in it somewhere, so a
 * `not.toContain(sentence)` against raw markup passes whether the sentence is there or not. That is
 * a test that reports green for the wrong reason, which is the one kind this repository may not
 * ship. Attribute assertions stay on the raw string, where the escaping is the point.
 */
function say(markup: string): string {
  return markup
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("the outcome of a return leg", () => {
  it("renders this product's sentence for every code the door can answer with", async () => {
    for (const [code, sentence] of Object.entries(OAUTH_MESSAGES)) {
      const markup = await render({ connect_error: code });
      expect(say(markup), code).toContain(sentence);
    }
  });

  it("never prints the code from the URL, only the sentence it selects", async () => {
    // The mutation this exists for: `{outcome}` in place of `{oauthMessageFor(outcome)}`. The code
    // is our own vocabulary and means nothing to an owner; seeing it at all means the URL reached
    // the page unmediated, and the next thing in that URL will not be one of our codes.
    const markup = await render({ connect_error: "token_exchange_failed" });
    expect(say(markup)).toContain(CONNECTIONS.oauthErrors.token_exchange_failed);
    expect(markup).not.toContain("token_exchange_failed");
  });

  it("answers a code it does not recognise with the sentence that says so", async () => {
    const invented = "Your account was suspended. Call this number to restore it.";
    const markup = await render({ connect_error: invented });
    expect(say(markup)).toContain(CONNECTIONS.oauthErrors.unexpected);
    // Escaping is not the defence being tested. The defence is that the string never reaches the
    // markup in any form, escaped or otherwise.
    expect(markup).not.toContain("suspended");
    expect(markup).not.toContain("Call this number");
  });

  it("says nothing at all when the URL carries no outcome", async () => {
    const markup = await render({});
    expect(say(markup)).not.toContain(CONNECTIONS.oauthErrors.unexpected);
    expect(markup).not.toContain('role="alert"');
  });

  it("ignores a repeated parameter rather than choosing one of its values", async () => {
    // `?connect_error=a&connect_error=b` arrives as an array. There is no right answer to which one
    // the customer meant, so the page must not pick -- and must not render `[object Array]` either.
    const markup = await render({ connect_error: ["bad_request", "forbidden"] });
    expect(markup).not.toContain('role="alert"');
    expect(say(markup)).not.toContain(CONNECTIONS.oauthErrors.bad_request);
  });
});

describe("the support reference that travels with an outcome", () => {
  it("is shown when it is shaped like one", async () => {
    const markup = await render({ connect_error: "store_unavailable", ref: "req_01ABCdef-9" });
    expect(markup).toContain("req_01ABCdef-9");
    expect(markup).toContain(CONNECTIONS.referenceLabel);
  });

  it("is dropped, not repaired, when it is not", async () => {
    // A mangled reference is worse than none: support searches for it and finds nothing, and the
    // customer is told their own report is wrong.
    const markup = await render({ connect_error: "store_unavailable", ref: "not a reference!" });
    expect(markup).not.toContain("not a reference");
    expect(say(markup)).toContain(CONNECTIONS.oauthErrors.store_unavailable);
  });

  it("is not shown on its own, with no outcome to attach it to", async () => {
    const markup = await render({ ref: "req_01ABCdef-9" });
    expect(markup).not.toContain("req_01ABCdef-9");
  });
});

describe("the success banner", () => {
  it("appears only for the exact value the callback sets", async () => {
    expect(say(await render({ connected: "1" }))).toContain(CONNECTIONS.oauthConnectedHeading);
    for (const value of ["0", "true", "yes", ""]) {
      expect(say(await render({ connected: value })), value).not.toContain(
        CONNECTIONS.oauthConnectedHeading,
      );
    }
  });
});

describe("what the page offers a session that has no workspace yet", () => {
  it("offers neither form, because neither could succeed", async () => {
    F.workspace = { kind: "needsOrganisation" };
    F.connections = { kind: "ready", rows: [] };
    try {
      const markup = await render({});
      expect(say(markup)).toContain(CONNECTIONS.needsWorkspace);
      // Both doors, not just the authorisation one: a form that can only refuse is an invitation to
      // type a credential into a page that will drop it.
      expect(say(markup)).not.toContain(CONNECTIONS.oauthHeading);
      expect(say(markup)).not.toContain(CONNECTIONS.formHeading);
    } finally {
      F.workspace = { kind: "ready", workspace: { id: "w-1", name: "Workspace" } };
    }
  });
});

describe("the promise printed above the authorisation form", () => {
  it("is on the same screen as the form it describes", async () => {
    const markup = await render({});
    expect(say(markup)).toContain(CONNECTIONS.oauthNote);
    expect(say(markup)).toContain(CONNECTIONS.oauthSubmit);
    // `oauth-form.test.tsx` is what holds that form to the sentence. This asserts only that the two
    // are shown together -- a promise rendered on a screen whose form had been removed would be a
    // different kind of wrong, and a silent one.
    expect(markup).toContain('name="external_account_id"');
  });
});

describe("a signed-out request", () => {
  it("is redirected rather than rendered", async () => {
    F.user = null;
    try {
      await expect(render({})).rejects.toThrow(/redirected/);
      expect(F.redirects.at(-1)).toBe("/signin?next=%2Fconnections");
    } finally {
      F.user = { id: "user-1" };
    }
  });
});

describe("the helper the page reads through", () => {
  it("answers a non-string with the sentence that admits it does not know", () => {
    // The page narrows to a string before calling, so this is the second line rather than the
    // first -- and it is here because the narrowing is one edit away from being removed.
    expect(oauthMessageFor(undefined)).toBe(CONNECTIONS.oauthErrors.unexpected);
    expect(oauthMessageFor(["bad_request"])).toBe(CONNECTIONS.oauthErrors.unexpected);
  });
});
