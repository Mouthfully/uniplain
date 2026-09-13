import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ACCOUNT_COPY } from "./_content.ts";
import { NOT_INCLUDED } from "./_export.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_SOURCE = readFileSync(join(HERE, "_export.ts"), "utf8");

/** The columns in `public.connections` that must never leave this boundary. */
const SEALED = ["credential_ciphertext", "credential_iv", "wrapped_dek", "key_version"];

describe("what an export may never contain", () => {
  /**
   * THE ASSERTION THIS FILE EXISTS FOR.
   *
   * A tenant CAN select the sealed columns -- `connections_select` allows it deliberately, because
   * the scheduler needs the ciphertext and reading it yields nothing without the KEK, which lives
   * in Cloudflare. So nothing in the database stops them reaching an export; only this does.
   *
   * And an export is a file a customer emails to their accountant or drops in a shared folder.
   * Sealed or not, a platform credential belongs to the boundary that holds it, and the moment it
   * is in a downloaded file it is outside that boundary for good.
   */
  it("names none of the sealed credential columns", () => {
    for (const column of SEALED) {
      expect(EXPORT_SOURCE.includes(`${column},`) || EXPORT_SOURCE.includes(`${column} `)).toBe(
        false,
      );
    }
  });

  /**
   * `select *` IS THE WAY THE COLUMN ABOVE GETS INTO THE FILE WITHOUT ANYBODY DECIDING IT SHOULD.
   * It also exports whatever the schema grows next, and nobody reviews a column they did not add
   * to a list. Every table names its columns, and this is what keeps it that way.
   */
  it("selects named columns everywhere, never a wildcard", () => {
    expect(EXPORT_SOURCE).not.toMatch(/\.select\(\s*["'`]\s*\*/);
    expect(EXPORT_SOURCE).not.toMatch(/columns:\s*["'`]\s*\*/);
  });

  it("says inside the file itself what it does not contain", () => {
    // The list travels with the download. A customer who opens this in six months has no page to
    // go back to, and "is this everything?" is the question they will have.
    expect(NOT_INCLUDED.length).toBeGreaterThanOrEqual(3);
    const all = NOT_INCLUDED.join(" ").toLowerCase();
    expect(all).toContain("credential");
    expect(all).toContain("sign-in");
    expect(all).toContain("payment provider");
  });

  it("never writes to the log, on any path", () => {
    expect(EXPORT_SOURCE).not.toMatch(/console\.(log|info|warn|error|debug)/);
  });
});

describe("what the page promises before it destroys anything", () => {
  /**
   * THE COPY IS A CORRECTNESS PROPERTY HERE, NOT A TONE ONE.
   *
   * Two things outlive an erasure: the sign-in record, because the cascade runs away from
   * `auth.users`, and anything the payment provider holds. A customer pressing the button believes
   * they are gone. If either sentence is edited out, the page becomes a lie at the exact moment
   * trust is being cashed in -- and no other test in this repository would notice.
   */
  it("says the sign-in record survives, and that the payment provider is not told", () => {
    expect(ACCOUNT_COPY.eraseSurvivesLogin.toLowerCase()).toContain("sign-in record");
    expect(ACCOUNT_COPY.eraseSurvivesBilling.toLowerCase()).toContain("payment provider");
    // Long enough to be an explanation rather than a label.
    expect(ACCOUNT_COPY.eraseSurvivesLogin.split(/\s+/).length).toBeGreaterThan(15);
    expect(ACCOUNT_COPY.eraseSurvivesBilling.split(/\s+/).length).toBeGreaterThan(15);
  });

  it("says the erasure cannot be undone, rather than leaving it to be discovered", () => {
    expect(ACCOUNT_COPY.eraseBody).toMatch(/no undo|cannot be undone|permanently|at once/i);
  });

  /**
   * THE CONFIRMATION HINT MUST NOT PROMISE LENIENCE THE FUNCTION DOES NOT GIVE.
   * `delete_organisation` compares the typed name exactly -- no trimming, no case folding -- and
   * `19_erasure.sql` proves both. A hint saying "roughly" would send a customer round a loop they
   * cannot get out of.
   */
  it("tells the customer the name is compared exactly", () => {
    expect(ACCOUNT_COPY.eraseConfirmHint.toLowerCase()).toContain("exactly");
  });

  it("gives a distinct sentence to each way the database refuses", () => {
    const refusals = [
      ACCOUNT_COPY.confirmMismatch,
      ACCOUNT_COPY.notOwner,
      ACCOUNT_COPY.liveSubscription,
      ACCOUNT_COPY.unavailable,
    ];
    // None of them collapses into "something went wrong", which is the failure `_figures.ts` and
    // `/brief`'s refusal states are both written against.
    expect(new Set(refusals).size).toBe(refusals.length);
    for (const sentence of refusals) expect(sentence.split(/\s+/).length).toBeGreaterThan(5);
  });
});
