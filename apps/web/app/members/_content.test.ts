import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  INVITABLE_ROLES,
  MEMBERS_COPY,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "./_content.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

describe("the roles this surface offers", () => {
  /**
   * THE DRIFT GUARD, AND IT IS THE SAME SHAPE AS `check-dictionary`.
   *
   * `app.member_role` is a PostgreSQL enum. A role added there and missing here is one the page
   * renders as `undefined`; a role listed here and missing there is an invitation the database
   * refuses with a message nobody can act on. Both are silent until a customer meets them, so the
   * list is read out of the migration rather than trusted to stay in step by hand.
   */
  it("matches `app.member_role` in the migration exactly", () => {
    const sql = readFileSync(join(REPO, "supabase/migrations/20260908000200_tenancy.sql"), "utf8");
    const match = sql.match(/create type app\.member_role as enum \(([^)]*)\)/);
    expect(match, "app.member_role is not declared where this test looks for it").not.toBeNull();

    const declared = [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect([...ALL_ROLES].sort()).toEqual([...declared].sort());
  });

  /**
   * OWNER IS NOT INVITABLE, AND THIS IS THE ASSERTION THAT KEEPS IT THAT WAY.
   *
   * An invitation is accepted by whoever holds the link. One that conferred ownership would hand
   * the whole account -- billing, every connected source, the right to remove everyone else -- to
   * an address typed into a form, on the strength of a link that could be forwarded or mistyped.
   * Promoting somebody already in the account to owner is a separate, deliberate act against a
   * person who is already known.
   */
  it("does not offer owner as a role somebody can be invited as", () => {
    expect(INVITABLE_ROLES).not.toContain("owner");
    for (const role of INVITABLE_ROLES) expect(ALL_ROLES).toContain(role);
  });

  it("names and describes every role, including the ones it will not invite", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role], role).toBeTypeOf("string");
      expect((ROLE_LABELS[role] ?? "").length, role).toBeGreaterThan(2);
      // A description short enough to be a restatement of the label describes nothing.
      expect((ROLE_DESCRIPTIONS[role] ?? "").split(/\s+/).length, role).toBeGreaterThan(5);
    }
  });
});

describe("the notice an invited person is owed", () => {
  /**
   * NOT COPY -- A NOTICE. An admin typing a colleague's address is collecting a third party's
   * personal data: that person has visited nothing, agreed to nothing, and may not know the account
   * exists. PDPA s.23 entitles them to be told who holds their data and why. Nothing can send mail
   * yet, so the admin passes the notice on, which is only possible if the page prints it.
   *
   * This asserts it still says the three things it has to say. A test that only checked the string
   * was non-empty would pass on a version trimmed to "Let them know."
   */
  it("still tells the admin to say who they are, that the person was added, and what is held", () => {
    const notice = MEMBERS_COPY.noticeBody.toLowerCase();
    expect(notice).toContain("who you are");
    expect(notice).toContain("leave at any time");
    expect(notice).toContain("trading figures");
    expect(MEMBERS_COPY.noticeBody.split(/\s+/).length).toBeGreaterThan(30);
  });

  /**
   * THE LINK IS SHOWN ONCE AND THE COPY MUST SAY SO. Only a fingerprint of the token is stored, so
   * there is no "resend" and there never can be. An admin who does not know that closes the tab.
   */
  it("says the link cannot be recovered, rather than leaving it to be discovered", () => {
    expect(MEMBERS_COPY.linkBody).toMatch(/only time/i);
    expect(MEMBERS_COPY.linkBody).toMatch(/fingerprint|hash/i);
  });

  /**
   * AND THAT NOTHING WAS SENT. `packages/email` cannot deliver until the domain's DNS exists (note
   * 70). Copy implying an email went out would have the admin wait for a colleague who was never
   * written to.
   */
  it("does not claim an email was sent, because none was", () => {
    const everySentence = Object.values(MEMBERS_COPY).join(" ");
    expect(everySentence).not.toMatch(/\bwe (have )?(e-?mailed|sent)\b/i);
    expect(everySentence).not.toMatch(/\ban (invitation|e-?mail) (has been|was) sent\b/i);
    expect(MEMBERS_COPY.noMail).toMatch(/nothing was emailed/i);
  });
});
