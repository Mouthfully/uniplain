import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_COPY } from "./_content";

/**
 * WHAT THIS FILE IS TESTING, AND WHY EACH OF THEM IS INVISIBLE WITHOUT IT.
 *
 *   THE WORK-EMAIL RULE RUNS BEFORE THE PLATFORM IS ASKED. If it did not, a change to a personal
 *   mailbox would be accepted, confirmed by both parties, and then refused by
 *   `auth/callback/route.ts` the next time the person signed in -- an account locked out of itself,
 *   with no screen left to fix it from, because fixing it needs a session. Nothing on screen
 *   distinguishes the two orderings; only this does.
 *
 *   A REQUEST THAT WENT NOWHERE IS NOT A SUCCESS. `updateUser` returns an error object rather than
 *   throwing, so a missing check reads as "both emails are on their way" while nothing was sent.
 *
 *   THE UPSTREAM MESSAGE IS NOT REPEATED. It names the auth server and its rate limits, and a
 *   person changing their own address is the wrong reader for either.
 *
 * The Supabase client is faked; nothing here reaches a network. What is real is the action and, in
 * particular, the ORDER of its checks.
 */

const F = vi.hoisted(() => ({
  user: { email: "ops@northstar.test", new_email: undefined } as {
    email?: string;
    new_email?: string;
  } | null,
  /** Every `updateUser` the action made. Emptiness is the assertion in most tests below. */
  updates: [] as unknown[],
  /** What the next `updateUser` comes back with. */
  result: { error: null as { message: string } | null },
}));

vi.mock("../_auth/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: F.user } }),
      updateUser: async (attributes: unknown) => {
        F.updates.push(attributes);
        return { data: { user: F.user }, error: F.result.error };
      },
    },
  }),
}));

const { changeSignInEmail } = await import("./email-actions");

function form(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

beforeEach(() => {
  F.user = { email: "ops@northstar.test" };
  F.updates = [];
  F.result = { error: null };
});

describe("changing the sign-in address", () => {
  it("asks the platform to send the pair, and reports that it asked", async () => {
    const state = await changeSignInEmail({}, form("  finance@northstar.test  "));

    expect(state).toMatchObject({ requested: true });
    expect(state.error).toBeUndefined();
    // TRIMMED. A pasted address arrives with a trailing space more often than not, and an address
    // with one is a different address to the auth server.
    expect(F.updates).toEqual([{ email: "finance@northstar.test" }]);
  });

  it("refuses a personal mailbox WITHOUT asking the platform", async () => {
    const state = await changeSignInEmail({}, form("someone@gmail.com"));

    // The message is the one `checkWorkEmail` wrote, not a second copy of the rule living here.
    expect(state.error).toBeTruthy();
    expect(state.error).not.toBe(ACCOUNT_COPY.emailFailed);
    expect(state.email).toBe("someone@gmail.com");
    expect(
      F.updates,
      "the confirmation pair was sent for an address the door will later refuse",
    ).toEqual([]);
  });

  it("refuses an empty or malformed address without asking the platform", async () => {
    for (const raw of ["", "   ", "not-an-address", "a@b"]) {
      F.updates = [];
      const state = await changeSignInEmail({}, form(raw));
      expect(state.error, raw).toBeTruthy();
      expect(F.updates, raw).toEqual([]);
    }
  });

  it("refuses the address already in use, whatever its case", async () => {
    const state = await changeSignInEmail({}, form("  OPS@Northstar.TEST "));

    expect(state.error).toBe(ACCOUNT_COPY.emailUnchanged);
    // Supabase would happily send a confirmation for a change to the current address, and the
    // person would work through two emails to arrive exactly where they started.
    expect(F.updates).toEqual([]);
  });

  it("refuses when there is no session, and says so rather than redirecting", async () => {
    F.user = null;

    const state = await changeSignInEmail({}, form("finance@northstar.test"));

    expect(state.error).toBe(ACCOUNT_COPY.emailSignedOut);
    expect(F.updates).toEqual([]);
  });

  it("reports an upstream failure as a failure, and does not repeat what it said", async () => {
    F.result = { error: { message: "email rate limit exceeded for project abcdef" } };

    const state = await changeSignInEmail({}, form("finance@northstar.test"));

    expect(state.requested).toBeUndefined();
    expect(state.error).toBe(ACCOUNT_COPY.emailFailed);
    expect(JSON.stringify(state)).not.toContain("rate limit");
    expect(JSON.stringify(state)).not.toContain("abcdef");
  });

  it("keeps what was typed on every refusal, so the form is not retyped", async () => {
    for (const raw of ["someone@gmail.com", "ops@northstar.test"]) {
      const state = await changeSignInEmail({}, form(raw));
      expect(state.email, raw).toBe(raw);
    }

    F.result = { error: { message: "nope" } };
    const failed = await changeSignInEmail({}, form("finance@northstar.test"));
    expect(failed.email).toBe("finance@northstar.test");
  });
});
