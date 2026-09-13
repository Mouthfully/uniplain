import { describe, expect, it } from "vitest";

import { hashInvitationToken, invitationLink, newInvitationToken } from "./_token.ts";

describe("the invitation token", () => {
  it("is long enough that guessing one is not a strategy", () => {
    // 32 bytes, base64url, no padding.
    expect(newInvitationToken()).toHaveLength(43);
  });

  it("is URL-safe, so it survives being a query parameter unencoded", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(newInvitationToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  /**
   * THE ONE THAT WOULD BE CATASTROPHIC AND SILENT. A token generator that repeated itself would
   * hand one business's invitation to another, and every other test here would still pass.
   */
  it("does not repeat itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(newInvitationToken());
    expect(seen.size).toBe(500);
  });

  it("hashes to a Postgres bytea literal of exactly 32 bytes", async () => {
    const hash = await hashInvitationToken("a-token");
    expect(hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("hashes the same token to the same digest and different tokens differently", async () => {
    const a = await hashInvitationToken("one");
    const b = await hashInvitationToken("one");
    const c = await hashInvitationToken("two");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("never puts the token itself into the hash", async () => {
    const token = newInvitationToken();
    expect(await hashInvitationToken(token)).not.toContain(token);
  });

  it("builds a link that carries the token and names no other parameter", () => {
    const link = invitationLink("https://example.test/", "tok-en_1");
    expect(link).toBe("https://example.test/join?token=tok-en_1");
    expect(new URL(link).searchParams.get("token")).toBe("tok-en_1");
    expect([...new URL(link).searchParams.keys()]).toEqual(["token"]);
  });
});
