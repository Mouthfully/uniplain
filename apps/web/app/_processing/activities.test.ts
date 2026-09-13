import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { NO_PERSONAL_DATA, PROCESSING_ACTIVITIES, RECIPIENTS } from "./activities";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PrivacyPage from "../privacy/page";
import { SUB_PROCESSORS } from "./sub-processors";

const MIGRATIONS = new URL("../../../../supabase/migrations/", import.meta.url).pathname;

/**
 * THE GUARD THAT TURNS A COMPLIANCE DOCUMENT INTO A RECORD.
 *
 * A record of processing written by hand is accurate the day it is signed and decays from the next
 * migration onwards, and nothing notices because nothing compares it to anything. PDPA s.39 is not
 * satisfied by a document that was true once.
 *
 * So the tables are read out of `supabase/migrations` and compared BOTH WAYS. A new table with no
 * entry fails; an entry naming a table that no longer exists fails; a table claimed to hold no
 * personal data must say why. The failure message names the table, because the point of failing is
 * that somebody has to decide what the new column is for.
 */
function tablesInSchema(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(`${MIGRATIONS}${file}`, "utf8");
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)) {
      if (m[1] !== undefined) found.add(m[1]);
    }
  }
  return [...found].sort();
}

const schema = tablesInSchema();
const accounted = [
  ...PROCESSING_ACTIVITIES.flatMap((a) => a.tables),
  ...NO_PERSONAL_DATA.map((n) => n.table),
].sort();

describe("the record of processing activities", () => {
  it("read the schema at all, so the comparisons below are not vacuous", () => {
    // An empty scan would make every assertion pass by comparing two empty lists -- the same trap
    // as an array asserted empty that was never assigned.
    expect(schema.length).toBeGreaterThan(15);
    expect(schema).toContain("envelope_rows");
  });

  it("accounts for every table in the schema", () => {
    const missing = schema.filter((t) => !accounted.includes(t));
    expect(
      missing,
      `these tables exist and no processing activity accounts for them, so the s.39 record is ` +
        `incomplete: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("names no table that does not exist", () => {
    const invented = accounted.filter((t) => !schema.includes(t));
    expect(
      invented,
      `the record describes tables that are not in the schema: ${invented.join(", ")}`,
    ).toEqual([]);
  });

  it("accounts for each table exactly once", () => {
    // A table in two activities would be described twice, and the two descriptions would
    // eventually disagree -- which is worse than either being wrong on its own, because a reader
    // cannot tell which one the system follows.
    const seen = new Map<string, number>();
    for (const t of accounted) seen.set(t, (seen.get(t) ?? 0) + 1);
    const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
    expect(twice, `described more than once: ${twice.join(", ")}`).toEqual([]);
  });

  it("gives a reason for every table it says holds no personal data", () => {
    for (const entry of NO_PERSONAL_DATA) {
      expect(entry.why.length, `${entry.table} is declared clean with no reason`).toBeGreaterThan(
        60,
      );
    }
  });
});

describe("what the record refuses to assert", () => {
  it("invents no retention period", () => {
    // Every activity either has no period -- which is the truth for six of the eight -- or states
    // one that genuinely exists in the schema. A plausible interval typed here would be a
    // commitment in a document a regulator reads.
    for (const a of PROCESSING_ACTIVITIES) {
      if (a.retention === null) continue;
      expect(
        a.retention.length,
        `${a.id} states a retention period too short to be checkable`,
      ).toBeGreaterThan(40);
    }
  });

  it("says plainly that the one declared period does not run", () => {
    // The restatement prune is written, granted, scheduled and unreachable, because the Worker
    // passes a null store. A record that listed "30 days" without that sentence would describe a
    // control the company does not have -- the exact shape of a wrong number that looks right.
    const platform = PROCESSING_ACTIVITIES.find((a) => a.id === "platform-data");
    expect(platform).toBeDefined();
    expect(platform?.retention).toMatch(/does not run|not_configured/);
  });

  it("records the waiting list as held with no current purpose, rather than quietly", () => {
    const waitlist = PROCESSING_ACTIVITIES.find((a) => a.id === "waiting-list");
    expect(waitlist?.basis).toMatch(/no longer exists|no current purpose/);
  });

  it("claims no lawful basis is established", () => {
    // `basis` records the position this repository can support from its own behaviour. A sentence
    // asserting the determination has been MADE would be a legal claim no file here can support,
    // and AGENTS.md books that determination under "needs a human".
    for (const a of PROCESSING_ACTIVITIES) {
      const b = a.basis.toLowerCase();
      for (const overclaim of ["we have determined", "legally compliant", "fully compliant"]) {
        expect(b, `${a.id} overclaims: ${overclaim}`).not.toContain(overclaim);
      }
    }
  });

  it("marks exactly the activities done on a customer's instruction as processor-role", () => {
    // THE DISTINCTION A B2B BUYER IS ACTUALLY BUYING. Their data subjects are theirs; ours are
    // ours. A record that blurred it would either claim their obligations or disclaim ours.
    //
    // A CLOSED LIST RATHER THAN A COUNT. This read `toEqual(["platform-data"])` and went red when
    // `insight-generation` was added, which is the assertion working: generating a brief from a
    // customer's figures on their request is processor-role, and it had to be argued rather than
    // waved through. It stays an exact list so the next one is argued too -- loosening it to
    // "at least one" would let a controller-role activity be relabelled to dodge the check.
    const processors = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor").map((a) => a.id);
    expect(processors.sort()).toEqual(["insight-generation", "platform-data"]);
  });
});

describe("the sub-processors", () => {
  it("are exactly the ones the privacy notice publishes", () => {
    // READS THE RENDERED PAGE, NOT ITS SOURCE. This used to `readFileSync` the page and look for
    // each name in the text, which passed on a name that appeared anywhere in the file -- in a
    // comment, in an unused constant, in a clause about something else. It now renders, because
    // the property that matters to a customer's counsel is what the page SAYS, and because the
    // clause is generated from `SUB_PROCESSORS` and no longer contains any of these names as
    // literals at all.
    const notice = renderToStaticMarkup(PrivacyPage() as ReactElement);
    for (const name of RECIPIENTS) {
      expect(notice, `${name} processes data and the privacy notice does not name it`).toContain(
        name,
      );
    }
    // And nothing beyond the record, so the notice cannot over-disclose either: a provider named
    // to a reader and absent from the operational list is a disclosure nobody is keeping.
    for (const provider of SUB_PROCESSORS) {
      expect(
        (RECIPIENTS as readonly string[]).includes(provider.name),
        `the notice publishes ${provider.name}, which no processing activity sends data to`,
      ).toBe(true);
    }
  });

  it("names no recipient that is not a disclosed sub-processor", () => {
    // THIS USED TO COMPARE AGAINST `RECIPIENTS`, WHICH IS NOW DERIVED FROM THESE SAME ACTIVITIES --
    // so written that way it would assert that a list equals itself and pass forever. It is pointed
    // at `SUB_PROCESSORS` instead, which is the published disclosure and the thing that can
    // actually disagree.
    const disclosed = SUB_PROCESSORS.map((p) => p.name);
    for (const a of PROCESSING_ACTIVITIES) {
      for (const r of a.recipients) {
        expect(
          disclosed.includes(r),
          `${a.id} sends data to ${r}, which is not in the published sub-processor list`,
        ).toBe(true);
      }
    }
  });
});
