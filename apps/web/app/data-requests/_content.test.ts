import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DATA_REQUESTS, REQUEST_KINDS } from "./_content";

/**
 * THE FORM'S KINDS AND THE DATABASE'S ENUM, COMPARED INSTEAD OF ASSERTED.
 *
 * `REQUEST_KINDS` carried the comment "Keys match `app.data_request_kind`" and nothing compared
 * them. That is the arrangement `check-providers.mjs` exists because of: its header records that
 * `app.connection_provider` and its TypeScript twin drifted, and that the dangerous direction is a
 * member TypeScript can name and the column cannot store -- which fails on the INSERT, in
 * production, after the person has finished filling the form in.
 *
 * Here the drift ran the other way and was quieter. Neither side named **restriction** -- GDPR
 * Art. 18, PDPA s.34 -- so nothing failed, and the missing right was invisible from both files. A
 * comparison that had existed would not have found it either; what would have found it is reading
 * the enum against the statutes, which is what this file's second block does.
 *
 * THE MIGRATIONS ARE THE SOURCE, not a generated type. `alter type ... add value` in a later
 * migration is part of the enum's definition, so both the `create type` and every later addition
 * are read -- the same rule `check-providers.mjs` states about folding additions into the base.
 */

const MIGRATIONS = new URL("../../../../supabase/migrations/", import.meta.url).pathname;

/** Every member of `app.data_request_kind`, read from the migrations that define it. */
function enumMembers(): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const members: string[] = [];

  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}${file}`, "utf8");

    const created = sql.match(/create type app\.data_request_kind as enum\s*\(([^)]*)\)/s);
    if (created?.[1] !== undefined) {
      for (const m of created[1].matchAll(/'([a-z_]+)'/g)) members.push(m[1] ?? "");
    }

    // Later additions. Comments are stripped first: this migration's header discusses the enum at
    // length and quotes member names, and a scan that read prose would invent members.
    const code = sql.replace(/^\s*--[^\n]*$/gm, " ");
    for (const m of code.matchAll(
      /alter type app\.data_request_kind add value(?: if not exists)? '([a-z_]+)'/g,
    )) {
      const name = m[1] ?? "";
      if (!members.includes(name)) members.push(name);
    }
  }
  return members;
}

describe("the form offers exactly what the database can store", () => {
  const members = enumMembers();

  it("found the enum, so the comparison below is not vacuous", () => {
    expect(members.length, "no members parsed out of the migrations").toBeGreaterThanOrEqual(5);
    expect(members).toContain("erasure");
  });

  it("has no kind the column cannot hold", () => {
    // THE DANGEROUS DIRECTION. A kind the form can submit and the enum cannot store fails on the
    // insert, after the person has typed their request.
    for (const kind of REQUEST_KINDS) {
      expect(
        members,
        `the form offers "${kind}", which app.data_request_kind cannot store`,
      ).toContain(kind);
    }
  });

  it("leaves no member of the enum unreachable from the form", () => {
    // The quieter direction, and the one that hid the missing right for as long as it was missing
    // from both sides. A member nobody can select is a right nobody can exercise.
    for (const member of members) {
      expect(
        REQUEST_KINDS as readonly string[],
        `app.data_request_kind has "${member}", which the form never offers`,
      ).toContain(member);
    }
  });

  it("labels every kind it offers", () => {
    const labels = DATA_REQUESTS.kindNames as Record<string, string>;
    for (const kind of REQUEST_KINDS) {
      const label = labels[kind];
      expect(label, `${kind} has no label`).toBeDefined();
      expect((label ?? "").length, `${kind}'s label is a placeholder`).toBeGreaterThan(12);
    }
  });
});

describe("the rights both governing regimes actually grant", () => {
  it("offers restriction as well as objection, which are different rights", () => {
    // GDPR Art. 21 / PDPA s.32 -- objection -- asks the controller to STOP, and may be refused on
    // compelling legitimate grounds. GDPR Art. 18 / PDPA s.34 -- restriction -- asks it to HOLD:
    // keep the data, stop using it, while accuracy is contested or an objection is being weighed.
    //
    // A form offering only the first asks someone mid-dispute to choose between abandoning the
    // dispute and erasing the evidence for it. Erasure is the irreversible one.
    expect(REQUEST_KINDS as readonly string[]).toContain("objection");
    expect(REQUEST_KINDS as readonly string[]).toContain("restriction");
    expect(DATA_REQUESTS.kindNames.restriction.toLowerCase()).toContain("stop using it");
  });

  it("covers the access, rectification, erasure and portability rights", () => {
    for (const right of ["access", "rectification", "erasure", "portability"]) {
      expect(REQUEST_KINDS as readonly string[], `no way to exercise ${right}`).toContain(right);
    }
  });
});
