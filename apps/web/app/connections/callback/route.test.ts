import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE RETURN LEG, EXERCISED END TO END WITH NO SUPABASE PROJECT AND NO WORKER.
 *
 * `_oauth.test.ts` holds the judgement; this holds the I/O around it, which is where the properties
 * that matter to a customer live: what is POSTed onward, what is left in the address bar afterwards,
 * and what happens to the cookie on every path including the refusals.
 *
 * The assertions are about ABSENCE again -- no workspace in the body, no authorisation code in the
 * redirect, no upstream message anywhere, no console line -- because a leak here is invisible on
 * screen and would not fail a build.
 */

const F = vi.hoisted(() => ({
  access: "eyJhbGciOiJIUzI1NiJ9.session.signature",
  api: "https://api.example.test",
  state: "Yc1v3-worker-minted-state",
  code: "4/authorisation-code-from-google",
  user: { id: "user-1" } as { id: string } | null,
  session: { access_token: "eyJhbGciOiJIUzI1NiJ9.session.signature" } as {
    access_token: string;
  } | null,
}));

vi.mock("../../_auth/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: F.user } }),
      getSession: async () => ({ data: { session: F.session } }),
    },
  }),
}));

import { NextRequest } from "next/server";

import { CONNECTIONS } from "../../_content";
import { CONTEXT_COOKIE, encodeContext } from "../_oauth";
import { oauthMessageFor } from "../_oauth-refusals";
import { GET } from "./route";

const ORIGIN = "https://app.example.test";

const CONTEXT = { state: F.state, provider: "ga4", account: "properties/123456" };

function callback(
  query: Record<string, string>,
  cookie: string | null = encodeContext(CONTEXT),
): NextRequest {
  const url = new URL(`${ORIGIN}/connections/callback`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

  const request = new NextRequest(url);
  if (cookie !== null) request.cookies.set(CONTEXT_COOKIE, cookie);
  return request;
}

const CREATED = { ok: true, connection_id: "c-1", status: "active", request_id: "req-1" };

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
  F.user = { id: "user-1" };
  F.session = { access_token: F.access };
  consoleCalls.length = 0;

  for (const name of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, name).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args.map((arg) => JSON.stringify(arg) ?? String(arg)));
    });
  }

  fetchSpy = endpoint(201, CREATED);
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Where the customer was sent, as a URL, plus what happened to the cookie. */
function landing(response: Response): URL {
  return new URL(response.headers.get("location") as string);
}

describe("completing an authorisation", () => {
  it("posts the state, the code and the account from the cookie -- and no workspace", async () => {
    await GET(callback({ state: F.state, code: F.code }));

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${F.api}/v1/connections/oauth/callback`);
    expect(JSON.parse(String(init.body))).toEqual({
      state: F.state,
      code: F.code,
      external_account_id: "properties/123456",
    });
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${F.access}`);
  });

  /**
   * WHAT IS LEFT IN THE ADDRESS BAR. The authorisation code is live from the moment the provider
   * issues the redirect; after this it is spent AND gone from the URL, which is the second half of
   * why this route completes the flow rather than rendering a page that waits for a button.
   */
  it("lands on the connections screen carrying no code, no state and no account", async () => {
    const response = await GET(callback({ state: F.state, code: F.code }));
    const to = landing(response);

    expect(response.status).toBe(303);
    expect(to.pathname).toBe("/connections");
    expect(to.searchParams.get("connected")).toBe("1");
    expect(to.search).not.toContain(F.code);
    expect(to.search).not.toContain(F.state);
    expect(to.search).not.toContain("properties/123456");
  });

  /**
   * THE COOKIE IS DELETED ON EVERY PATH. The pending row is destroyed by the redeem or swept
   * unread; an account id left in the browser afterwards belongs to an authorisation that no longer
   * exists, and the next flow writes its own.
   */
  it("deletes the cookie after a completed authorisation", async () => {
    const response = await GET(callback({ state: F.state, code: F.code }));
    expect(response.cookies.get(CONTEXT_COOKIE)?.value).toBe("");
  });

  it("forwards a decline verbatim, with no code and no account, and still spends the row", async () => {
    fetchSpy = endpoint(400, {
      ok: false,
      error: "provider_denied",
      message: "the provider reported access_denied",
      request_id: "req-2",
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(callback({ state: F.state, error: "access_denied" }));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      state: F.state,
      provider_error: "access_denied",
    });
    expect(landing(response).searchParams.get("connect_error")).toBe("provider_denied");
  });
});

describe("what the customer is told, and in whose words", () => {
  it("carries a code the screen has a sentence for, never the endpoint's message", async () => {
    fetchSpy = endpoint(400, {
      ok: false,
      error: "state_mismatch",
      message:
        "that authorisation cannot be completed. app.can_write_workspace() returned no rows.",
      request_id: "req-3",
    });
    vi.stubGlobal("fetch", fetchSpy);

    const to = landing(await GET(callback({ state: F.state, code: F.code })));
    expect(to.searchParams.get("connect_error")).toBe("state_mismatch");
    expect(to.searchParams.get("ref")).toBe("req-3");
    expect(to.search).not.toContain("can_write_workspace");
    expect(oauthMessageFor(to.searchParams.get("connect_error"))).toBe(
      CONNECTIONS.oauthErrors.state_mismatch,
    );
  });

  /**
   * A CODE THIS SCREEN HAS NO SENTENCE FOR DOES NOT TRAVEL. It would render the same "not one this
   * screen recognises" either way; what this keeps out of the URL is an arbitrary string from
   * another service's response body.
   */
  it("replaces an unrecognised code rather than putting it in the URL", async () => {
    fetchSpy = endpoint(418, { ok: false, error: "a brand new thing", request_id: "req-4" });
    vi.stubGlobal("fetch", fetchSpy);

    const to = landing(await GET(callback({ state: F.state, code: F.code })));
    expect(to.searchParams.get("connect_error")).toBe("unexpected");
  });

  it("drops a request id that is not shaped like one", async () => {
    fetchSpy = endpoint(400, {
      ok: false,
      error: "bad_request",
      request_id: "<script>alert(1)</script>",
    });
    vi.stubGlobal("fetch", fetchSpy);

    const to = landing(await GET(callback({ state: F.state, code: F.code })));
    expect(to.searchParams.get("ref")).toBeNull();
  });

  it("says the service could not be reached when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const to = landing(await GET(callback({ state: F.state, code: F.code })));
    expect(to.searchParams.get("connect_error")).toBe("unreachable");
  });

  it("refuses when this deployment does not know where the endpoint is", async () => {
    process.env.PUBLIC_API_URL = "";
    const to = landing(await GET(callback({ state: F.state, code: F.code })));
    expect(to.searchParams.get("connect_error")).toBe("notDeployed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the returns that are refused here, before anything is spent", () => {
  /**
   * THE ACCEPTED RISK, MADE INTO A NAMED REFUSAL. A customer whose session lapsed during the detour
   * has GRANTED ACCESS and gets no connection; being dropped on a sign-in page with no explanation
   * is the failure this sentence exists to prevent.
   */
  it("names a lapsed session rather than redirecting to sign in", async () => {
    F.user = null;
    F.session = null;

    const response = await GET(callback({ state: F.state, code: F.code }));
    const to = landing(response);
    expect(to.pathname).toBe("/connections");
    expect(to.searchParams.get("connect_error")).toBe("sessionLapsed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a return this browser did not start, and posts nothing", async () => {
    const to = landing(await GET(callback({ state: F.state, code: F.code }, null)));
    expect(to.searchParams.get("connect_error")).toBe("lostContext");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /**
   * THE ONE THAT WOULD PRODUCE A WRONG NUMBER. A cookie naming a different authorisation carries an
   * account id chosen for a different grant; posting it would file a credential under an account
   * the customer never named for it. The pending row is left to be swept instead.
   */
  it("refuses when the cookie names another authorisation, and posts nothing", async () => {
    const to = landing(await GET(callback({ state: "some-other-state", code: F.code })));
    expect(to.searchParams.get("connect_error")).toBe("contextMismatch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deletes the cookie even when it refuses", async () => {
    const response = await GET(callback({ state: "some-other-state", code: F.code }));
    expect(response.cookies.get(CONTEXT_COOKIE)?.value).toBe("");
  });

  it("refuses a return with no state and one with neither code nor reason", async () => {
    expect(landing(await GET(callback({ code: F.code }))).searchParams.get("connect_error")).toBe(
      "noState",
    );
    expect(landing(await GET(callback({ state: F.state }))).searchParams.get("connect_error")).toBe(
      "noCode",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("nothing is logged", () => {
  it("writes nothing to the console on any path", async () => {
    await GET(callback({ state: F.state, code: F.code }));

    fetchSpy = endpoint(409, { ok: false, error: "already_connected", request_id: "req-5" });
    vi.stubGlobal("fetch", fetchSpy);
    await GET(callback({ state: F.state, code: F.code }));

    await GET(callback({ state: "other", code: F.code }));

    expect(consoleCalls).toEqual([]);
  });
});
