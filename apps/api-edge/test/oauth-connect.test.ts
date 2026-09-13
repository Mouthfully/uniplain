/**
 * THE OAUTH DOOR, IN REAL WORKERD, AGAINST NO NETWORK, NO SUPABASE PROJECT AND NO PROVIDER.
 *
 * THE SEAL IS REAL AND THE PKCE IS REAL. The happy-path test drives the whole flow -- start,
 * persist, redirect, callback, redeem, exchange, seal, insert -- and then opens the bytes the
 * endpoint tried to write with `openCredential`, the function `/v1/ingest/run` actually calls. A
 * stubbed vault would prove the route returns 201; this proves the row it wrote holds an OAuth
 * credential that can be opened, bound to the workspace and connection it was sealed against.
 *
 * THE FAKE POSTGREST IS THE PENDING STORE AND IT BEHAVES LIKE THE DATABASE, which is the whole
 * design under test. It implements exactly the three things the migration implements: the redeem is
 * a DELETE (so redemption is single-shot because the STORE destroys the row, not because this file
 * remembers to), the redeem is filtered by membership (so a cross-tenant refusal arrives FROM
 * OUTSIDE the Worker), and the `connections` insert is refused by the same membership table. A test
 * that filtered in TypeScript would be asserting the opposite of the thing that matters.
 *
 * NOTHING HERE IS A SECRET. The signing secret is a fixture string, the KEK is generated per test,
 * and the access token, refresh token and client secret are obviously invented.
 */

import { SELF } from "cloudflare:test";
import { type ConnectionRow, openCredential } from "@repo/connections";
import { PENDING_TTL_MS } from "@repo/oauth";
import { base64url, decodeBytea } from "@repo/store";
import type { CryptoLike as VaultCrypto } from "@repo/vault";
import { describe, expect, it } from "vitest";

import {
  createPendingAuthorizationStore,
  handleOAuthCallback,
  handleOAuthStart,
  MAX_CALLBACK_FIELD,
  type OAuthConnectDeps,
  toPendingAuthorization,
} from "../src/oauth-connect.js";

/** A fixture, not a secret. The real one is `wrangler secret put SUPABASE_JWT_SECRET`. */
const SECRET = "fixture-signing-secret-for-tests-only";
const URL_BASE = "https://project.supabase.test";
const API_KEY = "fixture-publishable-key";
const REDIRECT_URI = "https://app.example.test/connections/callback";

const ALICE = "a0000000-0000-0000-0000-000000000001";
const MALLORY = "a0000000-0000-0000-0000-000000000009";
const WORKSPACE_A = "c0000000-0000-0000-0000-00000000000a";
const WORKSPACE_B = "c0000000-0000-0000-0000-00000000000b";
const CONNECTION = "e0000000-0000-0000-0000-000000000001";

/**
 * Invented, and the four strings every "no credential anywhere" assertion greps for.
 *
 * `ACCESS_TOKEN` and `REFRESH_TOKEN` are what the fake token endpoint hands back; `CLIENT_SECRET`
 * is what the Worker sends it. All three are credentials and none of them may appear in a response
 * body, an error body or a log line.
 */
const ACCESS_TOKEN = "ya29.testonlyaccesstokenaaaaaaaa";
const REFRESH_TOKEN = "1//testonlyrefreshtokenbbbbbbbb";
const CLIENT_ID = "testonly-client-id.apps.example.test";
const CLIENT_SECRET = "GOCSPX-testonlyclientsecretcccc";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const ACCOUNT = "properties/123456789";

const NOW = new Date("2026-09-13T12:00:00Z");
const encoder = new TextEncoder();

/**
 * Who may write where, as `app.can_write_workspace()` would answer it.
 *
 * MALLORY is a real signed-in customer with a real session and no membership of WORKSPACE_A. She is
 * how the suite asks "can another tenant spend somebody else's state", which is the question the
 * storage decision was taken to put inside Postgres.
 */
const MEMBERSHIP: Record<string, readonly string[]> = {
  [ALICE]: [WORKSPACE_A],
  [MALLORY]: [WORKSPACE_B],
};

/** A KEK per test. 32 random bytes, base64, which is the only shape `kekFromBase64` accepts. */
function freshKek(): { base64: string; bytes: Uint8Array } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { base64: btoa(binary), bytes };
}

/** Sign a token the way GoTrue signs a customer's session. By hand; see `connect.test.ts`. */
async function signToken(payload: Record<string, unknown>): Promise<string> {
  const segment = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));
  const input = `${segment({ alg: "HS256", typ: "JWT" })}.${segment(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

function session(sub = ALICE): Promise<string> {
  return signToken({
    sub,
    role: "authenticated",
    iat: Math.floor(NOW.getTime() / 1000),
    exp: Math.floor(NOW.getTime() / 1000) + 3600,
  });
}

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown>;
}

interface PendingRow {
  state: string;
  code_verifier: string;
  workspace_id: string;
  provider: string;
  sources: string[];
  redirect_uri: string;
  created_at: string;
}

function subOf(headers: Record<string, string>): string {
  const payload = (headers.authorization ?? "").split(".")[1] ?? "";
  const json = new TextDecoder().decode(
    Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  );
  return (JSON.parse(json) as { sub?: string }).sub ?? "";
}

function forbidden(): Response {
  // What Postgres answers when `raise ... using errcode = '42501'` reaches PostgREST.
  return new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

/**
 * A PostgREST that implements the two definer functions and the `connections_insert` policy.
 *
 * `redeem` IS A DELETE, not a read followed by a promise to forget. That is not decoration in a
 * fake: the single-use property under test is a property of `delete ... returning`, and a fake that
 * merely returned the row would let a Worker-side "have I seen this state" check pass this suite
 * while the real database happily served the row twice.
 */
function postgrest(options: { seed?: readonly PendingRow[]; existing?: readonly string[] } = {}) {
  const calls: Call[] = [];
  const pending = new Map<string, PendingRow>();
  for (const row of options.seed ?? []) pending.set(row.state, { ...row });
  const stored = new Set<string>(options.existing ?? []);

  const impl = (async (input: unknown, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
      string,
      unknown
    >;
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    const sub = subOf(headers);
    const mine = MEMBERSHIP[sub] ?? [];

    if (url.endsWith("/rpc/start_oauth_authorization")) {
      const workspace = String(body.p_workspace_id);
      if (!mine.includes(workspace)) return forbidden();
      const createdAt = NOW.toISOString();
      pending.set(String(body.p_state), {
        state: String(body.p_state),
        code_verifier: String(body.p_code_verifier),
        workspace_id: workspace,
        provider: String(body.p_provider),
        sources: body.p_sources as string[],
        redirect_uri: String(body.p_redirect_uri),
        created_at: createdAt,
      });
      // `returns timestamptz` comes back as a bare JSON string.
      return Response.json(createdAt);
    }

    if (url.endsWith("/rpc/redeem_oauth_authorization")) {
      const row = pending.get(String(body.p_state));
      // THE TENANCY PREDICATE AND THE DELETE, in that order and in one step, exactly as
      // `redeem_oauth_authorization` does them. A row belonging to a workspace this session cannot
      // write to is not returned AND NOT DELETED -- the real `delete ... where ... and
      // can_write_workspace(...)` does not match it either.
      if (row === undefined || !mine.includes(row.workspace_id)) return Response.json([]);
      pending.delete(row.state);
      return Response.json([row]);
    }

    const workspace = String(body.workspace_id);
    if (!mine.includes(workspace)) return forbidden();
    const key = `${workspace}:${String(body.provider)}:${String(body.external_account_id)}`;
    if (stored.has(key)) {
      return new Response(JSON.stringify({ code: "23505", message: "duplicate key value" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }
    stored.add(key);
    return new Response(JSON.stringify([{ id: body.id, status: body.status }]), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return { calls, impl, pending };
}

/** A token endpoint. Records what it was sent, which is how PKCE is asserted rather than assumed. */
function tokenEndpoint(options: { payload?: Record<string, unknown>; status?: number } = {}): {
  impl: typeof fetch;
  forms: URLSearchParams[];
} {
  const forms: URLSearchParams[] = [];
  const impl = (async (_input: unknown, init?: RequestInit) => {
    forms.push(new URLSearchParams(typeof init?.body === "string" ? init.body : ""));
    if (options.status !== undefined && options.status >= 400) {
      // A provider echoing its request parameters back in an error body, which is why
      // `exchangeCode` refuses to interpolate one.
      return new Response(
        JSON.stringify({ error: "invalid_grant", client_secret: CLIENT_SECRET }),
        { status: options.status, headers: { "content-type": "application/json" } },
      );
    }
    return Response.json(
      options.payload ?? {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        scope: GA4_SCOPE,
        token_type: "Bearer",
      },
    );
  }) as unknown as typeof fetch;
  return { impl, forms };
}

/**
 * A WebCrypto that counts data keys.
 *
 * `seal` generates one fresh DEK per credential and nothing else on this path generates a key, so
 * the count IS the number of seals. It is how the suite asserts a refused callback never reached the
 * vault -- an assertion about the response body alone cannot tell a refusal before the seal from a
 * refusal after one.
 */
function countingCrypto() {
  let seals = 0;
  const base = crypto.subtle as unknown as Record<string, unknown>;
  const subtle = new Proxy(base, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== "function") return value;
      const method = (value as (...args: unknown[]) => unknown).bind(crypto.subtle);
      if (property !== "generateKey") return method;
      return (...args: unknown[]) => {
        seals += 1;
        return method(...args);
      };
    },
  });
  return {
    crypto: {
      getRandomValues: (array: Uint8Array) => crypto.getRandomValues(array),
      subtle,
    } as unknown as OAuthConnectDeps["crypto"],
    seals: () => seals,
  };
}

interface Harness {
  readonly deps: OAuthConnectDeps;
  readonly calls: Call[];
  readonly forms: URLSearchParams[];
  readonly pending: Map<string, PendingRow>;
  readonly seals: () => number;
  readonly kek: Uint8Array;
}

function harness(
  options: {
    seed?: readonly PendingRow[];
    existing?: readonly string[];
    kek?: string;
    now?: Date;
    token?: { payload?: Record<string, unknown>; status?: number };
    credentials?: OAuthConnectDeps["clientCredentials"];
  } = {},
): Harness {
  const kek = freshKek();
  const rest = postgrest({
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.existing === undefined ? {} : { existing: options.existing }),
  });
  const token = tokenEndpoint(options.token ?? {});
  const spy = countingCrypto();
  return {
    deps: {
      postgrest: { url: URL_BASE, apiKey: API_KEY, jwtSecret: SECRET, fetch: rest.impl },
      kek: options.kek ?? kek.base64,
      crypto: spy.crypto,
      requestId: "00000000-0000-0000-0000-0000000000ff",
      redirectUri: REDIRECT_URI,
      clientCredentials:
        options.credentials ?? (() => ({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })),
      fetchImpl: token.impl,
      now: () => options.now ?? NOW,
      newConnectionId: () => CONNECTION,
    },
    calls: rest.calls,
    forms: token.forms,
    pending: rest.pending,
    seals: spy.seals,
    kek: kek.bytes,
  };
}

async function post(
  handler: (request: Request, deps: OAuthConnectDeps) => Promise<Response>,
  path: string,
  deps: OAuthConnectDeps,
  body: unknown,
  authorization?: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authorization !== null && authorization !== undefined) headers.authorization = authorization;
  return handler(
    new Request(`https://api-edge.test${path}`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    deps,
  );
}

const start = (deps: OAuthConnectDeps, body: unknown, auth?: string | null) =>
  post(handleOAuthStart, "/v1/connections/oauth/start", deps, body, auth);

const callback = (deps: OAuthConnectDeps, body: unknown, auth?: string | null) =>
  post(handleOAuthCallback, "/v1/connections/oauth/callback", deps, body, auth);

/** One pending row as the database would hold it. `createdAt` defaults to "just now". */
function pendingRow(overrides: Partial<PendingRow> = {}): PendingRow {
  return {
    state: "state-fixture-aaaaaaaaaaaaaaaaaaaaaaaaa",
    code_verifier: "verifier-fixture-".padEnd(86, "z"),
    workspace_id: WORKSPACE_A,
    provider: "google",
    sources: ["ga4"],
    redirect_uri: REDIRECT_URI,
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

function callbackBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: "state-fixture-aaaaaaaaaaaaaaaaaaaaaaaaa",
    code: "4/testonlyauthorizationcode",
    external_account_id: ACCOUNT,
    display_name: "Example Property",
    ...overrides,
  };
}

/** The row as it was POSTed, rebuilt into the shape `openCredential` takes. */
function writtenRow(call: Call): ConnectionRow {
  const b = call.body;
  return {
    id: String(b.id),
    workspaceId: String(b.workspace_id),
    provider: "ga4",
    credentialLane: "oauth",
    externalAccountId: String(b.external_account_id),
    displayName: null,
    credentialCiphertext: decodeBytea(b.credential_ciphertext, "credential_ciphertext"),
    credentialIv: decodeBytea(b.credential_iv, "credential_iv"),
    wrappedDek: decodeBytea(b.wrapped_dek, "wrapped_dek"),
    keyVersion: Number(b.key_version),
    grantedScopes: [],
    expiresAt: null,
    status: "active",
    lastError: null,
    revokedAt: null,
  };
}

/** Capture every `console.log` argument, stringified, for the duration of `body`. */
async function captureLog(body: () => Promise<void>): Promise<string> {
  const logged: string[] = [];
  const real = console.log;
  console.log = (...args: unknown[]) => {
    logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  try {
    await body();
  } finally {
    console.log = real;
  }
  // The routes must actually have logged, or an assertion about the log proves nothing by silence
  // -- the same trap as asserting an array is empty that was never assigned.
  expect(
    logged.length,
    "nothing was logged, so the log assertions below are vacuous",
  ).toBeGreaterThan(0);
  return logged.join("\n");
}

const connectionCalls = (h: Harness) =>
  h.calls.filter((c) => c.url.includes("/rest/v1/connections"));

// ------------------------------------------------------------------------------------------------

describe("starting an authorisation", () => {
  it("returns the authorize URL and keeps the verifier out of it", async () => {
    const h = harness();
    const response = await start(
      h.deps,
      { workspace_id: WORKSPACE_A, provider: "ga4" },
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authorization_url: string; expires_at: string };
    const url = new URL(body.authorization_url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(GA4_SCOPE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);

    // The state in the URL is the state the store was asked to persist -- not a second one, and not
    // an echo of anything the caller sent.
    const [row] = [...h.pending.values()];
    expect(url.searchParams.get("state")).toBe(row?.state);

    // THE VERIFIER IS IN NEITHER THE URL NOR THE RESPONSE. It reaches the database and nothing else.
    const text = JSON.stringify(body);
    expect(row?.code_verifier).toBeTruthy();
    expect(body.authorization_url).not.toContain(row?.code_verifier ?? "@");
    expect(text).not.toContain(row?.code_verifier ?? "@");

    // Expiry is the DATABASE's recorded instant plus the one TTL constant, not a second constant.
    expect(body.expires_at).toBe(new Date(NOW.getTime() + PENDING_TTL_MS).toISOString());
  });

  it("is refused for a workspace the database will not have, and persists nothing", async () => {
    const h = harness();
    const response = await start(
      h.deps,
      { workspace_id: WORKSPACE_B, provider: "ga4" },
      `Bearer ${await session()}`,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: "forbidden" });
    expect(h.pending.size).toBe(0);
  });

  it("is refused without a session, and the database is never asked", async () => {
    const h = harness();
    const response = await start(h.deps, { workspace_id: WORKSPACE_A, provider: "ga4" }, null);
    expect(response.status).toBe(401);
    expect(h.calls).toHaveLength(0);
  });

  it("says which client-registration bindings are absent rather than blaming the customer", async () => {
    const h = harness({
      credentials: () => ({ missing: ["OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET"] }),
    });
    const response = await start(
      h.deps,
      { workspace_id: WORKSPACE_A, provider: "ga4" },
      `Bearer ${await session()}`,
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("not_configured");
    expect(body.message).toContain("OAUTH_GOOGLE_CLIENT_ID");
    expect(body.message).toContain("OAUTH_GOOGLE_CLIENT_SECRET");
    // And nothing was written: a deployment that cannot finish the flow must not leave a pending row
    // the customer's browser is then sent away from.
    expect(h.pending.size).toBe(0);
  });
});

describe("a provider whose lane is not oauth", () => {
  it("is refused, and the refusal says which lane it does offer", async () => {
    const h = harness();
    const response = await start(
      h.deps,
      // WooCommerce drives perfectly well here and has no authorisation server at all: its
      // credential is a key and a secret the merchant issued itself. There is no consent screen to
      // send anybody to, so there is nothing for this route to start.
      { workspace_id: WORKSPACE_A, provider: "woocommerce" },
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("unsupported_lane");
    expect(body.message).toContain("key_secret");
    // Refused BEFORE anything was persisted and before any provider was named.
    expect(h.pending.size).toBe(0);
    expect(h.calls).toHaveLength(0);
  });

  it("refuses a provider this build cannot drive at all, which is a different code", async () => {
    const h = harness();
    const response = await start(
      h.deps,
      { workspace_id: WORKSPACE_A, provider: "tiktok_ads" },
      `Bearer ${await session()}`,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "unknown_provider" });
  });

  it("starts loyverse, which is oauth-only BY REFUSAL and unreachable until this route existed", async () => {
    const h = harness();
    const response = await start(
      h.deps,
      { workspace_id: WORKSPACE_A, provider: "loyverse" },
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authorization_url: string };
    const url = new URL(body.authorization_url);
    expect(url.origin + url.pathname).toBe("https://api.loyverse.com/oauth/authorize");
    // Both scopes and no more: RECEIPTS_READ for the takings, MERCHANT_READ for the ISO 4217 code a
    // receipt does not carry. Not SHIFTS_READ, not STORES_READ, not OPENID.
    expect(url.searchParams.get("scope")).toBe("RECEIPTS_READ MERCHANT_READ");
    // PKCE IS SENT TO LOYVERSE TOO, and this is the assertion that records the accepted risk:
    // Loyverse documents neither `code_challenge` nor `code_verifier`. If a real merchant
    // authorisation ever fails, this is the parameter to look at first -- and it is not dropped to
    // make the first attempt more likely to succeed.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });
});

describe("the callback", () => {
  it("exchanges, seals, and writes a row whose credential opens", async () => {
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      ok: true,
      connection_id: CONNECTION,
      status: "active",
    });

    // THE VERIFIER WENT TO THE TOKEN ENDPOINT AND THE CHALLENGE DID NOT. That is PKCE working end to
    // end rather than a parameter being present.
    expect(h.forms[0]?.get("code_verifier")).toBe(pendingRow().code_verifier);
    expect(h.forms[0]?.get("redirect_uri")).toBe(REDIRECT_URI);

    const insert = connectionCalls(h)[0];
    expect(insert).toBeDefined();
    if (insert === undefined) return;
    expect(insert.body.credential_lane).toBe("oauth");
    expect(insert.body.granted_scopes).toEqual([GA4_SCOPE]);
    expect(insert.body.expires_at).toBe(new Date(NOW.getTime() + 3600 * 1000).toISOString());

    // And the bytes it wrote really are the grant, bound to this workspace and this connection.
    const opened = await openCredential(
      h.deps.crypto as unknown as VaultCrypto,
      writtenRow(insert),
      h.kek,
    );
    expect(opened).toEqual({
      kind: "oauth",
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    });
  });

  it("takes the workspace from the redeemed row and not from the body", async () => {
    const h = harness({ seed: [pendingRow()] });
    // A crafted body naming another workspace. The field does not exist on this route, and the
    // insert must still name WORKSPACE_A -- which came off the pending row.
    const response = await callback(
      h.deps,
      callbackBody({ workspace_id: WORKSPACE_B }),
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(201);
    expect(connectionCalls(h)[0]?.body.workspace_id).toBe(WORKSPACE_A);
  });

  it("is refused without a session, and nothing is redeemed", async () => {
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(h.deps, callbackBody(), null);

    expect(response.status).toBe(401);
    expect(h.calls).toHaveLength(0);
    // The pending row SURVIVES: an unauthenticated request must not be able to burn somebody else's
    // single-use authorisation, which would be a denial of service on the connect flow.
    expect(h.pending.size).toBe(1);
  });

  it("reports the provider's own refusal ahead of everything else", async () => {
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(
      h.deps,
      { state: pendingRow().state, provider_error: "access_denied" },
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; message: string };
    // A customer who pressed Cancel is told they declined, not that their state was wrong.
    expect(body.error).toBe("provider_denied");
    expect(body.message).toContain("access_denied");
    expect(h.seals()).toBe(0);
    expect(h.forms).toHaveLength(0);
    // The row is spent anyway: the flow is over, and leaving it would let the same state be
    // presented again with a code.
    expect(h.pending.size).toBe(0);
  });

  it("refuses a grant missing a scope the source needs, before anything is sealed", async () => {
    const h = harness({
      seed: [pendingRow()],
      token: {
        payload: {
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_in: 3600,
          // The customer unticked the analytics box on the consent screen.
          scope: "https://www.googleapis.com/auth/adwords",
        },
      },
    });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "missing_scope" });
    expect(h.seals()).toBe(0);
    expect(connectionCalls(h)).toHaveLength(0);
  });

  it("refuses a Google grant that came back with no refresh token", async () => {
    const h = harness({
      seed: [pendingRow()],
      token: {
        payload: { access_token: ACCESS_TOKEN, expires_in: 3600, scope: GA4_SCOPE },
      },
    });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    // 409, not 502: the request was fine and the GRANT is unusable. Without a refresh token the
    // connection dies silently within the hour.
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "missing_refresh_token" });
    expect(h.seals()).toBe(0);
  });

  it("separates a retryable store failure from an unretryable state failure", async () => {
    // The database is unreachable. The authorisation is UNHARMED and retrying is the right move --
    // which is the distinction `state_mismatch` must never be collapsed into.
    const down = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    const h = harness({ seed: [pendingRow()] });
    const deps: OAuthConnectDeps = {
      ...h.deps,
      postgrest: { ...h.deps.postgrest, fetch: down },
    };

    const response = await callback(deps, callbackBody(), `Bearer ${await session()}`);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "store_unavailable" });
  });
});

describe("the state", () => {
  it("is refused when it names no pending authorisation", async () => {
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(
      h.deps,
      callbackBody({ state: "state-forged-bbbbbbbbbbbbbbbbbbbbbbbbbb" }),
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: "state_mismatch" });
    // Nothing was exchanged and nothing was sealed: the refusal is ahead of the token endpoint.
    expect(h.forms).toHaveLength(0);
    expect(h.seals()).toBe(0);
    // And the real pending row is untouched -- a forged state must not consume somebody's flow.
    expect(h.pending.size).toBe(1);
  });

  it("is refused when another tenant presents it, and the DATABASE is what refuses", async () => {
    const h = harness({ seed: [pendingRow()] });
    // MALLORY has a real, valid, signed session. She is simply not a member of WORKSPACE_A, and the
    // redeem's `app.can_write_workspace(a.workspace_id)` is what stops her.
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session(MALLORY)}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "state_mismatch" });
    expect(h.seals()).toBe(0);
    // NOT CONSUMED. The delete does not match a row the predicate excludes, so Alice can still
    // finish her own flow.
    expect(h.pending.size).toBe(1);
  });

  it("is still compared by `verifyCallback` even though the lookup found the row by it", async () => {
    // A store that answers with a DIFFERENT row than the state asked for -- a mis-keyed cache, a
    // widened query, a future refactor that looks up by workspace. The lookup can no longer be the
    // only thing standing there, and `verifyCallback`'s constant-time compare is what catches it.
    const h = harness();
    const deps: OAuthConnectDeps = {
      ...h.deps,
      pending: {
        start: async () => NOW.toISOString(),
        redeem: async () => ({
          provider: "google",
          workspaceId: WORKSPACE_A,
          sources: ["ga4"],
          state: "a-completely-different-state-cccccccccccc",
          codeVerifier: pendingRow().code_verifier,
          redirectUri: REDIRECT_URI,
          createdAt: NOW.toISOString(),
        }),
      },
    };

    const response = await callback(deps, callbackBody(), `Bearer ${await session()}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "state_mismatch" });
    expect(h.forms).toHaveLength(0);
  });
});

describe("an expired pending authorisation", () => {
  it("is refused against PENDING_TTL_MS, and nothing is exchanged", async () => {
    // One millisecond past the ten-minute window, which is the only boundary that distinguishes a
    // real check from a comment.
    const h = harness({
      seed: [
        pendingRow({ created_at: new Date(NOW.getTime() - PENDING_TTL_MS - 1).toISOString() }),
      ],
    });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "authorization_expired" });
    expect(h.forms).toHaveLength(0);
    expect(h.seals()).toBe(0);
    // The row is destroyed anyway -- the redeem is a delete, and an expired authorisation is not a
    // thing to keep a verifier for.
    expect(h.pending.size).toBe(0);
  });

  it("is accepted one millisecond inside the window, so the refusal is the clock and not the flow", async () => {
    const h = harness({
      seed: [
        pendingRow({ created_at: new Date(NOW.getTime() - PENDING_TTL_MS + 1).toISOString() }),
      ],
    });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);
    expect(response.status).toBe(201);
  });
});

describe("a pending authorisation", () => {
  it("is SINGLE-USE: replaying the same code twice does not attach twice", async () => {
    const h = harness({ seed: [pendingRow()] });
    const auth = `Bearer ${await session()}`;

    const first = await callback(h.deps, callbackBody(), auth);
    expect(first.status).toBe(201);

    // Same state, same code, same session -- a double-submitted callback, a retried fetch, a browser
    // replaying a POST. The provider would refuse the code the second time; nothing here may rely on
    // that, because the second attacker-controlled replay may reach us first.
    const second = await callback(h.deps, callbackBody(), auth);
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ error: "state_mismatch" });

    // THE ASSERTION THAT MATTERS: one authorisation, ONE connection. Two rows here would be two
    // connections from one grant, one of which nobody asked for.
    expect(connectionCalls(h)).toHaveLength(1);
    expect(h.seals()).toBe(1);
  });
});

describe("the token response", () => {
  it("appears in no response body this route can produce", async () => {
    const cases: Array<
      [
        string,
        {
          seed?: PendingRow[];
          body: Record<string, unknown>;
          token?: { status?: number; payload?: Record<string, unknown> };
          /** Whose session presents the callback. Defaults to ALICE, who holds WORKSPACE_A. */
          as?: string;
          /** Asserted, not assumed. See the "refused by the database" case. */
          refused?: boolean;
        },
      ]
    > = [
      ["accepted", { seed: [pendingRow()], body: callbackBody() }],
      [
        "forged state",
        {
          seed: [pendingRow()],
          body: callbackBody({ state: "nope-dddddddddddddddddddddddddddddddd" }),
        },
      ],
      [
        "expired",
        {
          seed: [
            pendingRow({ created_at: new Date(NOW.getTime() - PENDING_TTL_MS - 1).toISOString() }),
          ],
          body: callbackBody(),
        },
      ],
      [
        "declined",
        {
          seed: [pendingRow()],
          body: { state: pendingRow().state, provider_error: "access_denied" },
        },
      ],
      ["exchange refused", { seed: [pendingRow()], body: callbackBody(), token: { status: 400 } }],
      [
        "missing scope",
        {
          seed: [pendingRow()],
          body: callbackBody(),
          token: {
            payload: { access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, scope: "" },
          },
        },
      ],
      [
        // ALICE, NOT MALLORY, AND THAT IS THE WHOLE CASE. `MEMBERSHIP` makes MALLORY a member of
        // WORKSPACE_B, so seeding a WORKSPACE_B row and presenting MALLORY's session is the
        // ACCEPTED path wearing a refusal's label -- which is what this case used to do, silently
        // testing the happy path a second time while reading as cross-tenant coverage. Alice holds
        // only WORKSPACE_A, so `app.can_write_workspace` refuses her, which is the thing named.
        "refused by the database",
        {
          seed: [pendingRow({ workspace_id: WORKSPACE_B })],
          body: callbackBody(),
          as: ALICE,
          refused: true,
        },
      ],
    ];

    for (const [name, c] of cases) {
      const h = harness({
        ...(c.seed === undefined ? {} : { seed: c.seed }),
        ...(c.token === undefined ? {} : { token: c.token }),
      });
      const auth = `Bearer ${await session(c.as ?? ALICE)}`;
      const response = await callback(h.deps, c.body, auth);
      const text = await response.text();

      // A CASE CALLED "refused" MUST ACTUALLY HAVE BEEN REFUSED, asserted rather than assumed.
      // Inferring the session from the seed is how this case quietly became a second copy of the
      // accepted path; asserting the outcome is what stops it happening again, because the next
      // person to change `MEMBERSHIP` gets a failure instead of a passing lie.
      if (c.refused === true) {
        expect(response.ok, `${name} was supposed to be refused and was not`).toBe(false);
      }

      // Not echoed, not masked, not fingerprinted. The client secret is in here too: `exchangeCode`
      // sends it as a form parameter, and providers echo request parameters back in error bodies.
      expect(text, name).not.toContain(ACCESS_TOKEN);
      expect(text, name).not.toContain(REFRESH_TOKEN);
      expect(text, name).not.toContain(CLIENT_SECRET);
      expect(text, name).not.toContain("ya29.");
      expect(text, name).not.toContain("GOCSPX-");
    }
  });

  it("REFUSES a callback with no external_account_id, rather than inventing one", async () => {
    // THE REFUSAL THE WHOLE ACCOUNT-SELECTION DESIGN RESTS ON, and nothing tested it. An
    // adversarial verifier replaced the parse with a branch defaulting to the literal "primary"
    // when the field is absent, and all 25 tests passed.
    //
    // What a default would mean is the thing CLAUDE.md's one rule forbids: the account id is what
    // every later pull is addressed to, so inventing one attaches a real credential to an account
    // nobody named. The customer sees a connection; the pulls address something else. That is a
    // wrong value that looks right, arriving through the one path where the customer has already
    // granted access and cannot easily tell.
    for (const missing of [undefined, "", "   "]) {
      const h = harness({ seed: [pendingRow()] });
      const body =
        missing === undefined
          ? (({ external_account_id: _drop, ...rest }) => rest)(callbackBody())
          : callbackBody({ external_account_id: missing });
      const response = await callback(h.deps, body, `Bearer ${await session()}`);

      expect(response.ok, JSON.stringify(missing)).toBe(false);
      // And nothing was sealed: a refusal that still wrote a row would be worse than no refusal,
      // because the row would hold a credential addressed to nothing.
      expect(connectionCalls(h), JSON.stringify(missing)).toHaveLength(0);
    }
  });

  it("appears in no log line, on the accepted path or on a refused one", async () => {
    // A log line is the likeliest place a credential escapes and the least likely place anyone
    // looks: it survives the request, it leaves the process, and it lands somewhere with different
    // access rules from the database the credential is sealed in.
    //
    // Every argument of every call is stringified, including objects, because a credential nested in
    // a structured log entry is still in the log -- and `%o`-style inspection is exactly how it
    // would get there without appearing in any format string.
    const all = await captureLog(async () => {
      const ok = harness({ seed: [pendingRow()] });
      await callback(ok.deps, callbackBody(), `Bearer ${await session()}`);

      // The path that logs a FAILURE is the one carrying the offending input -- and it has to
      // actually fail. This was MALLORY, who `MEMBERSHIP` makes a member of WORKSPACE_B, so the
      // "failure" was an acceptance and the log line under test was the accepted one. ALICE holds
      // only WORKSPACE_A.
      const refused = harness({ seed: [pendingRow({ workspace_id: WORKSPACE_B })] });
      const refusedResponse = await callback(
        refused.deps,
        callbackBody(),
        `Bearer ${await session(ALICE)}`,
      );
      expect(refusedResponse.ok, "the refused path did not refuse").toBe(false);

      // And the start path, whose log line is the one that could most easily carry a state.
      const started = harness();
      await start(
        started.deps,
        { workspace_id: WORKSPACE_A, provider: "ga4" },
        `Bearer ${await session()}`,
      );
    });

    expect(all).not.toContain(ACCESS_TOKEN);
    expect(all).not.toContain(REFRESH_TOKEN);
    expect(all).not.toContain(CLIENT_SECRET);
    expect(all).not.toContain("ya29.");
    expect(all).not.toContain("GOCSPX-");
    // The code_verifier and the state are not credentials for a provider and ARE credentials for
    // this flow: a state in a log is an authorisation anyone holding the log can complete.
    expect(all).not.toContain(pendingRow().code_verifier);
    expect(all).not.toContain(pendingRow().state);
    // Nor the account: `external_account_id` identifies the customer's business, and
    // `/v1/connections` already documents its log line as omitting it.
    expect(all).not.toContain(ACCOUNT);
  });

  it("appears in no error body even when the provider echoes it back", async () => {
    // The fake token endpoint answers 400 with `client_secret` in the body, which is what a provider
    // that echoes request parameters does. `exchangeCode` deliberately does not read that body.
    const h = harness({ seed: [pendingRow()], token: { status: 400 } });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain("token_exchange_failed");
    expect(text).not.toContain(CLIENT_SECRET);
    expect(h.seals()).toBe(0);
  });
});

describe("the routes", () => {
  it("say which bindings are missing rather than pretending the authorisation was refused", async () => {
    // No binding is set in the test environment, which is the same shape as a half-configured
    // deployment. A 401 or a 400 here would send somebody to look at the customer's account.
    for (const path of ["/v1/connections/oauth/start", "/v1/connections/oauth/callback"]) {
      const response = await SELF.fetch(`https://api-edge.test${path}`, {
        method: "POST",
        body: JSON.stringify({ workspace_id: WORKSPACE_A, provider: "ga4" }),
      });

      expect(response.status, path).toBe(503);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error, path).toBe("not_configured");
      expect(body.message, path).toContain("CREDENTIAL_KEK");
      expect(body.message, path).toContain("OAUTH_REDIRECT_URI");
      expect(body.message, path).toContain("SUPABASE_JWT_SECRET");
    }
  });

  it("are POST only", async () => {
    const h = harness();
    for (const handler of [handleOAuthStart, handleOAuthCallback]) {
      const response = await handler(
        new Request("https://api-edge.test/v1/connections/oauth/start"),
        h.deps,
      );
      expect(response.status).toBe(405);
    }
  });
});

// ------------------------------------------------------------------------------------------------

/**
 * THE ROW THE DATABASE HANDS BACK, NARROWED -- AND WHY IT IS TESTED AWAY FROM THE ROUTE.
 *
 * Every refusal below was reachable only through a database whose contents this suite's fake keeps
 * well-formed by construction, so each one was unreached code with a comment explaining itself.
 * That is the worst place for a refusal to be: it reads as considered, it costs nothing to delete,
 * and nothing notices when it goes.
 *
 * `toPendingAuthorization` is exported for exactly this, and the mutation that matters is the cheap
 * one -- `sources[0]` in place of the length check, `as PendingAuthorization` in place of the field
 * checks. Both leave the route passing every test above.
 */
describe("narrowing a pending authorisation", () => {
  const good = {
    provider: "google",
    sources: ["ga4"],
    state: "state-fixture-aaaaaaaaaaaaaaaaaaaaaaaaa",
    code_verifier: "verifier-fixture-".padEnd(86, "z"),
    workspace_id: WORKSPACE_A,
    redirect_uri: REDIRECT_URI,
    created_at: NOW.toISOString(),
  };

  it("accepts the row the start leg actually writes", () => {
    // The positive case first: a narrowing that refused everything would pass every test below.
    const pending = toPendingAuthorization(good);
    expect(pending.provider).toBe("google");
    expect(pending.sources).toEqual(["ga4"]);
    expect(pending.workspaceId).toBe(WORKSPACE_A);
    expect(pending.codeVerifier).toBe(good.code_verifier);
    expect(pending.createdAt).toBe(good.created_at);
  });

  it("refuses a grant naming two sources rather than connecting the first", () => {
    // THE ONE THIS BLOCK EXISTS FOR. `connect()` writes one connection for one source, so a
    // two-source grant would have to become two connections -- a flow nobody has designed. Taking
    // `sources[0]` would attach a credential for one source and silently drop a permission the
    // customer granted for another, which is the kind of wrong that looks right forever.
    expect(() => toPendingAuthorization({ ...good, sources: ["ga4", "google_ads"] })).toThrow(
      /exactly one source/,
    );
  });

  it("refuses a grant naming no source at all", () => {
    expect(() => toPendingAuthorization({ ...good, sources: [] })).toThrow(/exactly one source/);
    expect(() => toPendingAuthorization({ ...good, sources: "ga4" })).toThrow(/exactly one source/);
  });

  it("refuses a provider this build holds no registration for", () => {
    expect(() => toPendingAuthorization({ ...good, provider: "linkedin" })).toThrow(
      /no registration, endpoints or scopes/,
    );
  });

  it("refuses a source whose provider is not the one on the row", () => {
    // `loyverse` is a real source with a real provider, and that provider is not Google. A row
    // pairing them would send a Google code to Loyverse's token endpoint.
    expect(() => toPendingAuthorization({ ...good, sources: ["loyverse"] })).toThrow(
      /cannot connect through google/,
    );
  });

  it("refuses a source that this product connects by pasting a key", () => {
    // WooCommerce is in the build and has no OAuth lane. Nothing on the callback path would notice
    // until `providerFor` returned nothing useful somewhere further in.
    expect(() => toPendingAuthorization({ ...good, sources: ["woocommerce"] })).toThrow(
      /cannot connect through google/,
    );
  });

  it("refuses a row missing any field the exchange needs", () => {
    for (const field of ["state", "code_verifier", "workspace_id", "redirect_uri", "created_at"]) {
      const row: Record<string, unknown> = { ...good };
      delete row[field];
      expect(() => toPendingAuthorization(row), field).toThrow(/missing a field/);
    }
  });

  it("refuses a created_at that is not a time, rather than treating it as one", () => {
    // `Date.parse` is the check and it is looser than it looks -- this is the reason the scheduler
    // grew its own RFC3339 guard. Here the floor is only that unparseable is refused: a row whose
    // timestamp cannot be read has no expiry, and an authorisation with no expiry never expires.
    expect(() => toPendingAuthorization({ ...good, created_at: "soon" })).toThrow(
      /missing a field/,
    );
    expect(() => toPendingAuthorization({ ...good, created_at: 1_757_764_800_000 })).toThrow(
      /missing a field/,
    );
  });

  it("names no value from the row in any message it throws", () => {
    // `code_verifier` is one of the fields being checked. A message that helpfully printed the row
    // it could not parse would put the PKCE verifier in a response body -- the refusal and the
    // leak would ship together.
    for (const row of [
      { ...good, created_at: undefined },
      { ...good, sources: ["ga4", "google_ads"] },
      { ...good, provider: "linkedin" },
    ]) {
      let message = "";
      try {
        toPendingAuthorization(row);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(good.code_verifier);
      expect(message).not.toContain(WORKSPACE_A);
      expect(message).not.toContain(good.state);
    }
  });

  it("refuses something that is not a row at all", () => {
    for (const row of [null, undefined, "a string", 7, []]) {
      expect(() => toPendingAuthorization(row)).toThrow();
    }
  });
});

/**
 * THE SHAPE OF THE REDEEM ANSWER, WHICH THE SUITE'S FAKE DATABASE CANNOT GET WRONG.
 *
 * `redeem_oauth_authorization` is keyed on `state`, the primary key, so "two rows for one state"
 * cannot happen -- until a migration changes the key, which is the day the guard matters and the
 * day nothing would have failed. The store is built here over a fetch that answers whatever the
 * case needs, because that is the only way to say those answers out loud.
 */
describe("what the store accepts back from a redeem", () => {
  const config = (answer: unknown, status = 200) => ({
    url: URL_BASE,
    apiKey: API_KEY,
    jwtSecret: SECRET,
    fetch: (async () =>
      new Response(JSON.stringify(answer), {
        status,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
  });

  const row = {
    provider: "google",
    sources: ["ga4"],
    state: "state-fixture-aaaaaaaaaaaaaaaaaaaaaaaaa",
    code_verifier: "verifier-fixture-".padEnd(86, "z"),
    workspace_id: WORKSPACE_A,
    redirect_uri: REDIRECT_URI,
    created_at: NOW.toISOString(),
  };

  it("reads the one row a redeem is allowed to return", async () => {
    const store = createPendingAuthorizationStore(config([row]));
    const pending = await store.redeem(row.state, await session());
    expect(pending?.workspaceId).toBe(WORKSPACE_A);
  });

  it("treats no rows as no pending authorisation, which is not an error", async () => {
    // A replayed code and a state belonging to another tenant both arrive here as zero rows, and
    // both are the customer's problem to hear about rather than a fault to report.
    const store = createPendingAuthorizationStore(config([]));
    expect(await store.redeem(row.state, await session())).toBeNull();
  });

  it("refuses two rows rather than choosing which workspace the credential lands in", async () => {
    const store = createPendingAuthorizationStore(
      config([row, { ...row, workspace_id: WORKSPACE_B }]),
    );
    await expect(store.redeem(row.state, await session())).rejects.toThrow(/more than one/);
  });

  it("refuses an answer that is not a set of rows", async () => {
    for (const answer of [row, "ok", 1, null]) {
      const store = createPendingAuthorizationStore(config(answer));
      await expect(store.redeem(row.state, await session())).rejects.toThrow(
        /other than a set of rows/,
      );
    }
  });
});

describe("a corrupt pending row, reached through the route", () => {
  it("refuses the callback before anything is exchanged or sealed", async () => {
    // The narrowing is unit-tested above; this is the wiring. A row that cannot be narrowed must
    // not reach the token endpoint, because the exchange is the irreversible half: a provider that
    // has issued a refresh token against a code we then refuse to store leaves the customer with a
    // grant nothing here will ever use and nothing here will ever revoke.
    const h = harness({ seed: [pendingRow({ sources: ["ga4", "google_ads"] })] });
    const response = await callback(h.deps, callbackBody(), `Bearer ${await session()}`);

    expect(response.ok).toBe(false);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("store_unavailable");
    // Nothing from the row travels: the message is ours, and the verifier is not in it.
    expect(body.message).not.toContain(pendingRow().code_verifier);
    expect(h.forms).toHaveLength(0);
    expect(h.seals()).toBe(0);
    expect(connectionCalls(h)).toHaveLength(0);
  });
});

describe("a callback field that is a pasted document", () => {
  it("is refused by length before it is looked at", async () => {
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(
      h.deps,
      callbackBody({ code: "4/".padEnd(MAX_CALLBACK_FIELD + 1, "a") }),
      `Bearer ${await session()}`,
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("bad_request");
    expect(body.message).toContain(String(MAX_CALLBACK_FIELD));
    // AND THE OVERSIZE VALUE IS NOT ECHOED. The refusal says how long it was, not what it said:
    // the field it most often applies to is `code`, which is a single-use credential.
    expect(body.message).not.toContain("aaaaaaaaaa");
    // Nothing was redeemed, so the customer can retry the same state once the paste is fixed.
    expect(h.pending.size).toBe(1);
    expect(h.seals()).toBe(0);
  });

  it("accepts a field exactly at the bound, so the refusal is the length and not the flow", async () => {
    // The off-by-one that would make the test above pass for the wrong reason. This code is
    // nonsense to the token endpoint, which is not what is under test -- what is under test is that
    // parsing let it through.
    const h = harness({ seed: [pendingRow()] });
    const response = await callback(
      h.deps,
      callbackBody({ code: "4/".padEnd(MAX_CALLBACK_FIELD, "a") }),
      `Bearer ${await session()}`,
    );

    const body = (await response.json()) as { error: string };
    expect(body.error).not.toBe("bad_request");
    expect(h.forms).toHaveLength(1);
  });
});
