import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHAT THIS FILE IS ACTUALLY TESTING.
 *
 * Two absences and one silence, because all three are invisible on screen and none of them fails a
 * build:
 *
 *   THE TOKEN IS NEVER WRITTEN DOWN. What reaches `invitations.token_hash` must be a digest, and
 *   the token itself must appear in exactly one place -- the link returned to the admin who created
 *   it -- and nowhere else, on any path, including every refusal.
 *
 *   A WRITE THAT CHANGED NOTHING IS NOT A SUCCESS. Row-level security does not raise on a write it
 *   disallows; it removes the row from the statement's view, so a forbidden `delete` returns no
 *   error having touched nothing. Reporting that as done tells an admin a colleague was removed
 *   while they are still reading the figures.
 *
 *   NOTHING IS LOGGED. Not on the happy path and not in a refusal. An invitation token in a log
 *   line is a working credential sitting in a place nobody audits.
 *
 * The Supabase client is faked; nothing here reaches a network or a database. What is real is the
 * action, including the ORDER of its checks -- which is what stops a malformed address ever
 * reaching a query.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1", email: "owner@example.test" } as { id: string; email?: string } | null,
  membership: {
    kind: "ready" as string,
    membership: {
      organisationId: "org-1",
      organisationName: "Org",
      ownRole: "owner",
      members: [
        { memberId: "m-1", email: "owner@example.test", role: "owner", createdAt: "2026-01-01" },
        {
          memberId: "m-2",
          email: "Colleague@Example.test",
          role: "viewer",
          createdAt: "2026-01-02",
        },
      ],
      invitations: [],
    },
  },
  /** Every write the action made, so a test can look at what was actually sent. */
  writes: [] as { table: string; op: string; values: unknown }[],
  /** What the next write comes back with. `rows` is what `.select()` yields. */
  result: { error: null as { code?: string } | null, rows: [{ id: "x" }] as unknown[] | null },
}));

vi.mock("../_auth/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: F.user } }) },
    from: (table: string) => builder(table),
  }),
}));

vi.mock("./_members", () => ({
  readMembership: async () => F.membership,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

/**
 * A chainable stand-in for the query builder.
 *
 * The two shapes the action actually uses are the only two modelled: `insert(...)` awaited
 * directly, and `update(...)`/`delete()` filtered and then awaited after `.select()`. Filters
 * return the chain and record nothing -- what a test cares about is the values a write was given
 * and whether the action looked at how many rows came back.
 *
 * NO `then` PROPERTY, deliberately: a thenable that is also a chain is the shape that resolves
 * itself by accident when something awaits it one call too early, and `lint/suspicious` refuses it
 * for the same reason.
 */
function outcome() {
  return Promise.resolve({ data: F.result.rows, error: F.result.error });
}

function chain() {
  const self: Record<string, unknown> = {
    eq: () => self,
    is: () => self,
    order: () => self,
    select: () => outcome(),
  };
  return self;
}

function builder(table: string) {
  return {
    insert(values: unknown) {
      F.writes.push({ table, op: "insert", values });
      return outcome();
    },
    update(values: unknown) {
      F.writes.push({ table, op: "update", values });
      return chain();
    },
    delete() {
      F.writes.push({ table, op: "delete", values: null });
      return chain();
    },
    select: () => chain(),
  };
}

import { MEMBERS_COPY } from "./_content";
import { createInvitation, manageMembership } from "./actions";

function inviteForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("email", "new@example.test");
  form.set("role", "viewer");
  for (const [name, value] of Object.entries(overrides)) form.set(name, value);
  return form;
}

function manageForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

let logged: string[] = [];

beforeEach(() => {
  F.user = { id: "user-1", email: "owner@example.test" };
  F.writes = [];
  F.result = { error: null, rows: [{ id: "x" }] };
  F.membership.kind = "ready";
  logged = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("creating an invitation", () => {
  it("stores a digest and never the token itself", async () => {
    const state = await createInvitation({}, inviteForm());

    expect(state.link).toBeDefined();
    const token = new URL(state.link as string).searchParams.get("token") as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const insert = F.writes.find((write) => write.table === "invitations");
    expect(insert, "no row was written").toBeDefined();
    const row = insert?.values as Record<string, unknown>;
    expect(row.token_hash).toMatch(/^\\x[0-9a-f]{64}$/);

    // THE ASSERTION THAT MATTERS: the token appears nowhere in what was written, under any key.
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("lower-cases the address, because the open-invitation index is on lower(email)", async () => {
    await createInvitation({}, inviteForm({ email: "  NEW@Example.TEST " }));
    const row = F.writes[0]?.values as Record<string, unknown>;
    expect(row.email).toBe("new@example.test");
  });

  it("refuses a malformed address before it reaches a query", async () => {
    const state = await createInvitation({}, inviteForm({ email: "not-an-address" }));
    expect(state.error).toBe(MEMBERS_COPY.badEmail);
    expect(F.writes).toHaveLength(0);
    expect(state.link).toBeUndefined();
  });

  it("refuses a role nobody may be invited as, owner included", async () => {
    const state = await createInvitation({}, inviteForm({ role: "owner" }));
    expect(state.error).toBe(MEMBERS_COPY.badRole);
    expect(F.writes).toHaveLength(0);
  });

  it("refuses your own address rather than creating an invitation you already hold", async () => {
    const state = await createInvitation({}, inviteForm({ email: "OWNER@example.test" }));
    expect(state.error).toBe(MEMBERS_COPY.ownEmail);
    expect(F.writes).toHaveLength(0);
  });

  /**
   * NO CONSTRAINT SPANS `members` AND `invitations`, so nothing in the database would have stopped
   * this. The recipient would accept an invitation that changed nothing while the admin believed
   * something had.
   */
  it("refuses an address that is already a member, case-insensitively", async () => {
    const state = await createInvitation({}, inviteForm({ email: "colleague@example.test" }));
    expect(state.error).toBe(MEMBERS_COPY.alreadyMember);
    expect(F.writes).toHaveLength(0);
  });

  it("turns a unique violation into the one sentence about an open invitation", async () => {
    F.result = { error: { code: "23505" }, rows: null };
    const state = await createInvitation({}, inviteForm());
    expect(state.error).toBe(MEMBERS_COPY.alreadyInvited);
    expect(state.link).toBeUndefined();
  });

  it("echoes the address and role back so the form keeps its shape, and nothing else", async () => {
    F.result = { error: { code: "23505" }, rows: null };
    const state = await createInvitation({}, inviteForm());
    expect(state.email).toBe("new@example.test");
    expect(state.role).toBe("viewer");
    expect(Object.keys(state).sort()).toEqual(["email", "error", "role"]);
  });
});

describe("changing somebody's access", () => {
  /**
   * THE ONE THAT WOULD BE SILENT. A policy-forbidden write returns no error and touches no row, so
   * without this check the screen says the colleague was removed and the colleague is still there.
   */
  it("refuses when the write changed no row, rather than reporting it done", async () => {
    F.result = { error: null, rows: [] };
    const state = await manageMembership({}, manageForm({ intent: "remove", id: "m-2" }));
    expect(state.done).toBeUndefined();
    expect(state.error).toBe(MEMBERS_COPY.refused);
  });

  it("reports done when a row actually changed", async () => {
    const state = await manageMembership({}, manageForm({ intent: "remove", id: "m-2" }));
    expect(state.done).toBe(true);
    expect(state.error).toBeUndefined();
  });

  it("says which rule refused it, for each of the two the database enforces", async () => {
    F.result = { error: { code: "23514" }, rows: null };
    expect((await manageMembership({}, manageForm({ intent: "remove", id: "m-1" }))).error).toBe(
      MEMBERS_COPY.lastOwner,
    );

    F.result = { error: { code: "42501" }, rows: null };
    expect((await manageMembership({}, manageForm({ intent: "remove", id: "m-1" }))).error).toBe(
      MEMBERS_COPY.ownerNeedsOwner,
    );
  });

  it("withdraws an invitation rather than deleting the record that it happened", async () => {
    await manageMembership({}, manageForm({ intent: "withdraw", id: "i-1" }));
    const write = F.writes.find((entry) => entry.table === "invitations");
    expect(write, "no write reached invitations").toBeDefined();
    expect(write?.op).toBe("update");
    expect((write?.values as Record<string, unknown> | undefined)?.revoked_at).toBeTypeOf("string");
  });

  it("refuses a role the database does not have", async () => {
    const state = await manageMembership(
      {},
      manageForm({ intent: "role", id: "m-2", role: "god" }),
    );
    expect(state.error).toBe(MEMBERS_COPY.badRole);
    expect(F.writes).toHaveLength(0);
  });

  it("refuses an intent it does not recognise instead of guessing at one", async () => {
    const state = await manageMembership({}, manageForm({ intent: "", id: "m-2" }));
    expect(state.error).toBe(MEMBERS_COPY.refused);
    expect(F.writes).toHaveLength(0);
  });
});

describe("what is never written anywhere", () => {
  it("logs nothing, on any path, including the refusals", async () => {
    await createInvitation({}, inviteForm());
    await createInvitation({}, inviteForm({ email: "bad" }));
    F.result = { error: { code: "23505" }, rows: null };
    await createInvitation({}, inviteForm());
    F.result = { error: null, rows: [] };
    await manageMembership({}, manageForm({ intent: "remove", id: "m-2" }));

    expect(logged).toEqual([]);
  });
});
