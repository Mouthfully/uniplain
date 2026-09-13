import { beforeEach, describe, expect, it, vi } from "vitest";

import { KEYS_COPY } from "./_content";

/**
 * WHAT THIS FILE IS TESTING, AND WHY NONE OF IT IS VISIBLE ON SCREEN.
 *
 *   THE PLAINTEXT KEY IS WRITTEN NOWHERE. What reaches `api_keys` must be a hash and a display
 *   prefix, and the key itself must appear in exactly one place -- the state returned to the admin
 *   who made it -- and nowhere else, on any path, including every refusal.
 *
 *   A WRITE THAT CHANGED NOTHING IS NOT A SUCCESS. Row-level security does not raise on a write it
 *   disallows; it removes the row from the statement's view, so a viewer's revoke returns no error
 *   having touched nothing. Reporting that as done tells somebody a credential is dead while it
 *   still opens the door.
 *
 *   NOTHING IS LOGGED. Not on the happy path and not in a refusal.
 *
 *   THE ROLE IS CHECKED BEFORE THE WRITE, so a viewer never reaches the table at all -- the policy
 *   is the guarantee, and this is the sentence that explains the refusal instead of an empty
 *   result.
 *
 * The Supabase client is faked; nothing here reaches a network or a database.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  membership: {
    kind: "ready",
    membership: { ownRole: "owner", ownMemberId: "member-1" },
  } as { kind: string; membership?: { ownRole: string; ownMemberId: string } },
  workspace: { kind: "ready", workspace: { id: "ws-1", name: "Shop" } } as {
    kind: string;
    workspace?: { id: string; name: string };
  },
  /** Every write the actions made, with the values they were given. */
  writes: [] as { op: string; values: unknown }[],
  /** What the next write comes back with. `rows` is what `.select()` yields. */
  result: {
    error: null as { code?: string; message?: string } | null,
    rows: [{ id: "k1" }] as unknown[] | null,
  },
  /** Anything that reached a console. Must stay empty. */
  logs: [] as unknown[],
}));

/**
 * A chainable stand-in for the query builder.
 *
 * NO `then` PROPERTY, deliberately: a thenable that is also a chain resolves itself by accident
 * when something awaits it one call too early, which is a defect that looks like a passing test.
 */
function builder(_table: string) {
  const chain = {
    insert(values: unknown) {
      F.writes.push({ op: "insert", values });
      return chain;
    },
    update(values: unknown) {
      F.writes.push({ op: "update", values });
      return chain;
    },
    eq: () => chain,
    is: () => chain,
    select: async () => ({ data: F.result.rows, error: F.result.error }),
  };
  return chain;
}

vi.mock("../_auth/server", () => ({
  currentUser: async () => F.user,
  supabaseServer: async () => ({ from: (table: string) => builder(table) }),
}));
vi.mock("../_auth/workspace", () => ({ currentWorkspace: async () => F.workspace }));
vi.mock("../members/_members", () => ({ readMembership: async () => F.membership }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { createApiKey, revokeApiKey } = await import("./actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  F.user = { id: "user-1" };
  F.membership = { kind: "ready", membership: { ownRole: "owner", ownMemberId: "member-1" } };
  F.workspace = { kind: "ready", workspace: { id: "ws-1", name: "Shop" } };
  F.writes = [];
  F.result = { error: null, rows: [{ id: "k1" }] };
  F.logs = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      F.logs.push(args);
    });
  }
});

describe("making a key", () => {
  it("returns the key once and writes only a hash and a prefix", async () => {
    const state = await createApiKey({}, form({ name: "Nightly export" }));

    expect(state.error).toBeUndefined();
    expect(state.key).toBeTypeOf("string");

    expect(F.writes).toHaveLength(1);
    const values = F.writes[0]?.values as Record<string, unknown>;

    // THE ASSERTION THE WHOLE FILE IS FOR. Not "the key is absent from this field" -- absent from
    // EVERY field, because a credential that reaches the table reaches every backup of it.
    for (const [column, written] of Object.entries(values)) {
      expect(String(written), `the key itself was written to ${column}`).not.toContain(
        state.key as string,
      );
    }

    expect(values.key_hash).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(values.key_prefix).toMatch(/^mp_(live|test)_[a-z0-9]{8}$/);
    expect(values.workspace_id).toBe("ws-1");
    expect(values.created_by).toBe("member-1");
    expect(values.name).toBe("Nightly export");
  });

  it("stores the prefix of the key it actually returned", async () => {
    const state = await createApiKey({}, form({ name: "Reports" }));
    const values = F.writes[0]?.values as Record<string, unknown>;

    // A prefix drawn independently would name no key anybody holds, and the list would be rows
    // nobody can match to anything.
    expect((state.key as string).startsWith(`${values.key_prefix as string}_`)).toBe(true);
  });

  it("refuses a viewer before it touches the table", async () => {
    F.membership = { kind: "ready", membership: { ownRole: "viewer", ownMemberId: "member-9" } };

    const state = await createApiKey({}, form({ name: "Nightly export" }));

    expect(state.error).toBe(KEYS_COPY.notAdmin);
    expect(state.key).toBeUndefined();
    expect(F.writes).toEqual([]);
  });

  it("refuses an empty or oversized name without minting anything", async () => {
    for (const name of ["", "   ", "x".repeat(121)]) {
      F.writes = [];
      const state = await createApiKey({}, form({ name }));
      expect(state.error, name).toBe(KEYS_COPY.nameRequired);
      expect(F.writes, name).toEqual([]);
    }
  });

  it("reports a failed insert as a failure and returns no key", async () => {
    F.result = { error: { code: "23505", message: "duplicate key value" }, rows: null };

    const state = await createApiKey({}, form({ name: "Nightly export" }));

    expect(state.key, "a key was handed over for a row that was never written").toBeUndefined();
    expect(state.error).toBe(KEYS_COPY.createFailed);
    expect(JSON.stringify(state)).not.toContain("duplicate");
    expect(JSON.stringify(state)).not.toContain("23505");
  });

  it("treats an insert that returned no row as a failure", async () => {
    // PostgREST returns an empty array rather than an error when a policy removes the inserted row
    // from the statement's view. A key handed over for a row that does not exist is a credential
    // that will be refused at the door with nothing to explain it.
    F.result = { error: null, rows: [] };

    const state = await createApiKey({}, form({ name: "Nightly export" }));

    expect(state.key).toBeUndefined();
    expect(state.error).toBe(KEYS_COPY.createFailed);
  });

  it("logs nothing, on the happy path or on a refusal", async () => {
    await createApiKey({}, form({ name: "Nightly export" }));
    F.result = { error: { code: "42501" }, rows: null };
    await createApiKey({}, form({ name: "Nightly export" }));

    expect(F.logs, "something reached a log line on a path that handles a credential").toEqual([]);
  });
});

describe("retiring a key", () => {
  it("sets revoked_at and reports it did", async () => {
    const state = await revokeApiKey({}, form({ id: "k1" }));

    expect(state).toEqual({ done: true });
    expect(F.writes).toHaveLength(1);
    expect(F.writes[0]?.op).toBe("update");
    const values = F.writes[0]?.values as Record<string, unknown>;
    // A retire, not a delete: `20260908000700_rls.sql` grants no DELETE on this table at all.
    expect(Object.keys(values)).toEqual(["revoked_at"]);
    expect(String(values.revoked_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuses when the write changed nothing, rather than reporting success", async () => {
    // THE REFUSAL THAT WEARS A SUCCESS. RLS removes a row it will not let you write instead of
    // raising, so a viewer's update returns no error having done nothing at all.
    F.result = { error: null, rows: [] };

    const state = await revokeApiKey({}, form({ id: "k1" }));

    expect(state.done).toBeUndefined();
    expect(state.error).toBe(KEYS_COPY.revokeChangedNothing);
  });

  it("refuses a viewer before it touches the table", async () => {
    F.membership = { kind: "ready", membership: { ownRole: "viewer", ownMemberId: "member-9" } };

    const state = await revokeApiKey({}, form({ id: "k1" }));

    expect(state.error).toBe(KEYS_COPY.notAdmin);
    expect(F.writes).toEqual([]);
  });

  it("refuses an empty id without touching the table", async () => {
    const state = await revokeApiKey({}, form({ id: "  " }));

    expect(state.error).toBe(KEYS_COPY.revokeFailed);
    expect(F.writes).toEqual([]);
  });
});
