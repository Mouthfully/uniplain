import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHAT THIS FILE IS ACTUALLY TESTING: that the outward leg of an authorisation carries the
 * workspace from the SESSION, carries no secret of any kind, and refuses to send a customer
 * anywhere on an answer it could not fully read.
 *
 * The assertions are mostly about ABSENCE -- of a `redirect_uri` or a `state` in the request, of a
 * token in the cookie, of a console call on any path, of a redirect when the answer was short a
 * field -- because those are the failures that do not show up on screen and do not fail a build.
 *
 * The Supabase client, the workspace read, the cookie store and the endpoint are faked; nothing
 * here talks to a network. What is real is the action, including its order of checks.
 */

const F = vi.hoisted(() => ({
  access: "eyJhbGciOiJIUzI1NiJ9.session.signature",
  workspace: "11111111-2222-3333-4444-555555555555",
  api: "https://api.example.test",
  state: "Yc1v3-worker-minted-state",
  authorize: "https://accounts.example.test/o/oauth2/v2/auth",
  workspaceState: {
    kind: "ready" as string,
    workspace: { id: "11111111-2222-3333-4444-555555555555", name: "Workspace" },
  },
  session: { access_token: "eyJhbGciOiJIUzI1NiJ9.session.signature" } as {
    access_token: string;
  } | null,
  cookieCalls: [] as Array<[string, string, Record<string, unknown>]>,
}));

vi.mock("../_auth/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      getSession: async () => ({ data: { session: F.session } }),
    },
  }),
}));

vi.mock("../_auth/workspace", () => ({
  currentWorkspace: async () => F.workspaceState,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => {
      F.cookieCalls.push([name, value, options]);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import { CONNECTIONS } from "../_content";
import { CONTEXT_COOKIE, decodeContext } from "./_oauth";
import { beginAuthorization, type OAuthStartState } from "./oauth-actions";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("provider", "ga4");
  data.set("external_account_id", "properties/123456");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

const STARTED = {
  ok: true,
  authorization_url: `${F.authorize}?client_id=x&state=${F.state}&code_challenge=abc`,
  provider: "google",
  source: "ga4",
  expires_at: "2026-09-13T06:10:00.000Z",
  request_id: "req-1",
};

function endpoint(status: number, body: unknown) {
  return vi.fn(
    async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

let fetchSpy: ReturnType<typeof endpoint>;
const consoleCalls: unknown[][] = [];

beforeEach(() => {
  process.env.PUBLIC_API_URL = F.api;
  F.workspaceState = { kind: "ready", workspace: { id: F.workspace, name: "Workspace" } };
  F.session = { access_token: F.access };
  F.cookieCalls.length = 0;
  consoleCalls.length = 0;

  for (const name of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, name).mockImplementation((...args: unknown[]) => {
      // Stringified, so a credential reached through an Error's `cause` or a nested object is
      // greppable rather than hiding behind an object's toString.
      consoleCalls.push(args.map((arg) => JSON.stringify(arg) ?? String(arg)));
    });
  }

  fetchSpy = endpoint(200, STARTED);
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Run the action and report where it sent the browser, or what it refused with. */
async function start(data: FormData): Promise<{ to?: string; state?: OAuthStartState }> {
  try {
    return { state: await beginAuthorization({}, data) };
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("redirect:")) return { to: message.slice("redirect:".length) };
    throw error;
  }
}

describe("starting an authorisation", () => {
  it("sends the customer to the URL the Worker built, and nowhere else", async () => {
    const { to } = await start(form());
    expect(to).toBe(STARTED.authorization_url);
  });

  it("asks the endpoint for the workspace from the session and the provider from the form", async () => {
    await start(form());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${F.api}/v1/connections/oauth/start`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      workspace_id: F.workspace,
      provider: "ga4",
    });
  });

  /**
   * THE WORKSPACE IS NOT THE FORM'S TO NAME. A hidden field would be the obvious way to support a
   * person who belongs to several, and it would be a field a crafted page could set. What makes the
   * session's own answer safe is `app.can_write_workspace()` inside the definer function; what this
   * assertion keeps is that the form never gets a say at all.
   */
  it("ignores a workspace id posted with the form", async () => {
    await start(form({ workspace_id: "99999999-9999-9999-9999-999999999999" }));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).workspace_id).toBe(F.workspace);
  });

  /**
   * NEITHER THE REDIRECT URI NOR THE STATE IS SENT. A caller-supplied redirect URI is an open
   * redirect with an authorisation code attached; a caller-supplied state is a CSRF token chosen by
   * the party it binds. Both belong to the Worker, and the endpoint has no field for either.
   */
  it("sends no redirect uri and no state", async () => {
    await start(form());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["provider", "workspace_id"]);
  });

  it("forwards the customer's own session token and nothing else", async () => {
    await start(form());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${F.access}`);
  });
});

describe("the cookie that crosses the detour", () => {
  it("carries the state, the provider and the account, and expires when the endpoint says", async () => {
    await start(form());
    expect(F.cookieCalls).toHaveLength(1);

    const [name, value, options] = F.cookieCalls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(CONTEXT_COOKIE);
    expect(decodeContext(value)).toEqual({
      state: F.state,
      provider: "ga4",
      account: "properties/123456",
    });

    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/connections");
    // THE ONE CLOCK: the database's recorded instant plus `PENDING_TTL_MS`, computed in the Worker.
    // A duration written on this side would be a second TTL that can disagree with the first.
    expect((options.expires as Date).toISOString()).toBe(STARTED.expires_at);
  });

  /**
   * WHAT IS NOT IN IT. The session token is the one value on this path that would be a credential,
   * and a cookie is exactly where somebody would put it "so the callback can post as them".
   */
  it("carries no session token and no secret", async () => {
    await start(form());
    const [, value] = F.cookieCalls[0] as [string, string, Record<string, unknown>];
    expect(value).not.toContain(F.access);
    expect(value).not.toContain("eyJ");
    expect(value).not.toContain("code_challenge");
  });

  it("writes nothing and sends nobody when the answer carries no state", async () => {
    fetchSpy = endpoint(200, {
      ...STARTED,
      authorization_url: `${F.authorize}?client_id=x&code_challenge=abc`,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { to, state } = await start(form());
    expect(to).toBeUndefined();
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.unusableAnswer);
    expect(F.cookieCalls).toHaveLength(0);
  });

  /**
   * AN ABSENT `expires_at` IS REFUSED RATHER THAN DEFAULTED. Substituting a duration here would be
   * this app's clock deciding when a row written by the database dies -- a guess wearing the
   * costume of a fact, and one that would let a cookie outlive the authorisation it names.
   */
  it("refuses an answer with no expiry, rather than choosing one", async () => {
    fetchSpy = endpoint(200, { ...STARTED, expires_at: undefined });
    vi.stubGlobal("fetch", fetchSpy);

    const { to, state } = await start(form());
    expect(to).toBeUndefined();
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.unusableAnswer);
    expect(F.cookieCalls).toHaveLength(0);
  });

  it("refuses an expiry it cannot read as an instant", async () => {
    fetchSpy = endpoint(200, { ...STARTED, expires_at: "soon" });
    vi.stubGlobal("fetch", fetchSpy);

    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.unusableAnswer);
    expect(F.cookieCalls).toHaveLength(0);
  });

  /**
   * A DESTINATION THAT IS NOT AN https URL IS NOT A CONSENT SCREEN. This line is an instruction to a
   * browser to leave the site, and the check costs nothing.
   */
  it("refuses a destination that is not https", async () => {
    for (const authorization_url of [
      "javascript:alert(1)",
      `http://accounts.example.test/auth?state=${F.state}`,
      "not a url",
    ]) {
      F.cookieCalls.length = 0;
      fetchSpy = endpoint(200, { ...STARTED, authorization_url });
      vi.stubGlobal("fetch", fetchSpy);

      const { to, state } = await start(form());
      expect(to, authorization_url).toBeUndefined();
      expect(state?.error, authorization_url).toBe(CONNECTIONS.oauthErrors.unusableAnswer);
      expect(F.cookieCalls, authorization_url).toHaveLength(0);
    }
  });
});

describe("what is refused before the customer goes anywhere", () => {
  it("refuses a source that is not offered on this door, without asking the endpoint", async () => {
    const { state } = await start(form({ provider: "woocommerce" }));
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.unknownProvider);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /**
   * THE ACCOUNT IS ASKED FOR BEFORE THE DETOUR, NOT AFTER IT. The callback requires
   * `external_account_id` and refuses to invent one, and a customer looking up a merchant id after
   * the consent screen is spending a clock nobody sized for it.
   */
  it("refuses an unnamed account, without asking the endpoint", async () => {
    const { state } = await start(form({ external_account_id: "   " }));
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.missingAccount);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a workspace that is not there yet, and one that could not be read", async () => {
    F.workspaceState = { kind: "needsOrganisation" } as never;
    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.noWorkspace);

    F.workspaceState = { kind: "unavailable", reason: "PGRST301" } as never;
    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.workspaceUnavailable);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a signed-out submission to sign in, having asked nothing", async () => {
    F.session = null;
    expect((await start(form())).to).toBe("/signin?next=%2Fconnections");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(F.cookieCalls).toHaveLength(0);
  });

  it("refuses when this deployment does not know where the endpoint is", async () => {
    process.env.PUBLIC_API_URL = "";
    const { state } = await start(form());
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.notDeployed);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("what a refusal from the endpoint becomes", () => {
  /**
   * THE UPSTREAM SENTENCE IS DISCARDED. Those messages name `app.can_write_workspace`,
   * `CREDENTIAL_KEK` and `PROVIDER_LANES`; a customer is not the right reader for any of them.
   */
  it("shows our sentence and the reference, never the endpoint's message", async () => {
    fetchSpy = endpoint(403, {
      ok: false,
      error: "forbidden",
      message: "The database refused this workspace. app.can_write_workspace() said no.",
      request_id: "req-9",
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { to, state } = await start(form());
    expect(to).toBeUndefined();
    expect(state?.error).toBe(CONNECTIONS.oauthErrors.forbidden);
    expect(state?.reference).toBe("req-9");
    expect(JSON.stringify(state)).not.toContain("can_write_workspace");
    expect(F.cookieCalls).toHaveLength(0);
  });

  it("keeps the customer's choice so the form does not empty itself", async () => {
    fetchSpy = endpoint(503, { ok: false, error: "not_configured", message: "no client" });
    vi.stubGlobal("fetch", fetchSpy);

    const { state } = await start(form());
    expect(state?.provider).toBe("ga4");
    expect(state?.account).toBe("properties/123456");
  });

  it("admits an answer it does not recognise rather than claiming a start", async () => {
    fetchSpy = endpoint(418, { ok: false, error: "something_new" });
    vi.stubGlobal("fetch", fetchSpy);
    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.unexpected);

    // A 200 that is not JSON at all: the start may or may not have written a pending row, so the
    // sentence says to look rather than claiming nothing happened.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );
    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.unexpected);
  });

  it("says the service could not be reached when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED api.example.test");
      }),
    );
    expect((await start(form())).state?.error).toBe(CONNECTIONS.oauthErrors.unreachable);
  });
});

/**
 * NOT ONE LINE, ON ANY PATH. There is no credential on this leg, but there IS a session token in a
 * header and an account id in a body, and an error object logged from the fetch is one `cause` away
 * from carrying both. The rule is the same as `actions.ts`': this file does not log.
 */
describe("nothing is logged", () => {
  it("writes nothing to the console on the happy path or any refusal", async () => {
    await start(form());

    fetchSpy = endpoint(403, { ok: false, error: "forbidden", request_id: "req-9" });
    vi.stubGlobal("fetch", fetchSpy);
    await start(form());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    await start(form());

    expect(consoleCalls).toEqual([]);
  });
});
