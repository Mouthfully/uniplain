import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_COPY } from "./_content";

/**
 * WHAT THIS FILE IS TESTING, AND WHY EVERY ONE OF THEM IS INVISIBLE ON SCREEN.
 *
 *   THE SCOPE IS `others`, NOT `global`. Both end the other devices; only one leaves the person
 *   pressing the button signed in. With `global` the screen would revoke correctly, drop its own
 *   session, and the next render would bounce to sign-in -- indistinguishable, from the outside,
 *   from a failure. The library defaults to `global` when the scope is omitted, so this is one
 *   deleted argument away at all times.
 *
 *   A REVOKE THAT WENT NOWHERE IS NOT A SUCCESS. `signOut` returns an error object rather than
 *   throwing, so a missing check reads as "every other session is finished" while every other
 *   session is exactly where it was.
 *
 *   NOTHING IS SAID ABOUT WHEN. The one number a person would want here -- how long the other
 *   device keeps working -- is the project's access-token lifetime, which this code cannot read.
 *   The copy is asserted to contain no figure, because a reassuring invented one is the failure
 *   this product is sold against.
 *
 * The Supabase client is faked; nothing here reaches a network.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  /** Every `signOut` the action made, with the options it passed. */
  calls: [] as unknown[],
  result: { error: null as { message: string } | null },
}));

vi.mock("../_auth/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: F.user } }),
      signOut: async (options: unknown) => {
        F.calls.push(options);
        return { error: F.result.error };
      },
    },
  }),
}));

const { signOutOtherSessions } = await import("./session-actions");

beforeEach(() => {
  F.user = { id: "user-1" };
  F.calls = [];
  F.result = { error: null };
});

describe("signing out of every other device", () => {
  it("revokes the others and keeps this one, and says it did", async () => {
    const state = await signOutOtherSessions({}, new FormData());

    expect(state).toEqual({ done: true });
    // `others` and nothing else. `global` would also sign out the person pressing the button, and
    // `local` would end only their own session and leave every device they were worried about.
    expect(F.calls).toEqual([{ scope: "others" }]);
  });

  it("never omits the scope, because the library's default is the wrong one", async () => {
    await signOutOtherSessions({}, new FormData());

    const [options] = F.calls;
    expect(options, "signOut was called with no scope, which means global").toBeTypeOf("object");
    expect(options).not.toBeNull();
    expect((options as { scope?: string }).scope).toBe("others");
  });

  it("reports an upstream failure as a failure, and says nothing changed", async () => {
    F.result = { error: { message: "auth server unavailable for project abcdef" } };

    const state = await signOutOtherSessions({}, new FormData());

    expect(state.done).toBeUndefined();
    expect(state.error).toBe(ACCOUNT_COPY.sessionsFailed);
    // The upstream message names the auth server and its project. Neither reaches the screen.
    expect(JSON.stringify(state)).not.toContain("abcdef");
    expect(JSON.stringify(state)).not.toContain("unavailable for");
  });

  it("refuses when there is no session, and does not call the platform", async () => {
    F.user = null;

    const state = await signOutOtherSessions({}, new FormData());

    expect(state.error).toBe(ACCOUNT_COPY.sessionsSignedOut);
    expect(F.calls).toEqual([]);
  });
});

describe("the copy this control renders", () => {
  it("admits the list cannot be shown rather than implying there is nothing to show", () => {
    expect(ACCOUNT_COPY.sessionsNoList).toMatch(/cannot show/i);
  });

  it("quotes no window at all for when the other device stops working", () => {
    // THE ASSERTION THAT CAUGHT ITS OWN FIRST DRAFT. The sentence ended "which is minutes rather
    // than days" -- the project's access-token lifetime, configurable, and unreadable from here.
    // A digit, or one of these words, is a claim about a setting nobody in this repository can see.
    const sentence = ACCOUNT_COPY.sessionsNotInstant;
    expect(sentence, "a figure was quoted for a setting this code cannot read").not.toMatch(/\d/);
    expect(sentence).not.toMatch(/\b(second|minute|hour|day|week|immediat|instantly|at once)/i);
    // And it must still say the thing that is true, or removing the number removed the warning.
    expect(sentence).toMatch(/not instant/i);
  });
});
