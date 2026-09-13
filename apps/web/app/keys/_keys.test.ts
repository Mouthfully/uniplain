import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { KEY_COLUMNS } from "./_keys";

/**
 * THE COLUMN THAT MUST NOT BE HERE, AND THE COLUMNS THAT MUST EXIST.
 *
 * `api_keys_select` returns the WHOLE ROW to an org admin, `key_hash` included. Row-level security
 * decides which ROWS a session sees; it has no opinion about columns, and nothing in this schema
 * would stop `select("*")` handing a server-rendered page the SHA-256 of every live credential in
 * the account. That digest is what `verify_api_key` is looked up by.
 *
 * So two assertions in opposite directions, and the second is the one that keeps the first honest:
 * the hash must be absent from what this screen reads, AND it must really be a column of the table,
 * or "absent" is a fact about a typo rather than about the schema.
 *
 * AND EVERY NAMED COLUMN MUST EXIST. `account/_columns.test.ts` exists because an earlier column
 * list was remembered rather than read -- six names that were not in the schema, which PostgREST
 * answers with an error, which the caller turns into a refusal. The feature would have shipped
 * showing nothing at all. Same failure, same guard, one table.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "..", "..", "..", "supabase", "migrations");

/** Every column of `public.api_keys`, read out of the migrations rather than remembered. */
function apiKeyColumns(): Set<string> {
  const columns = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");

    for (const match of sql.matchAll(
      /create table (?:if not exists )?public\.api_keys\s*\(([\s\S]*?)\n\);/g,
    )) {
      for (const line of (match[1] as string).split("\n")) {
        const name = line.match(/^\s{2}([a-z_][a-z0-9_]*)\s+\S/);
        if (name === null) continue;
        const word = name[1] as string;
        // A table constraint is not a column.
        if (["constraint", "unique", "check", "primary", "foreign", "exclude"].includes(word)) {
          continue;
        }
        columns.add(word);
      }
    }

    for (const match of sql.matchAll(
      /alter table (?:if exists )?public\.api_keys\s+add column (?:if not exists )?([a-z_][a-z0-9_]*)/g,
    )) {
      columns.add(match[1] as string);
    }
  }
  return columns;
}

/** Every source file in this directory, excluding the tests. */
function sourcesHere(): { name: string; text: string }[] {
  return readdirSync(HERE)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((name) => ({ name, text: readFileSync(join(HERE, name), "utf8") }));
}

const SCHEMA = apiKeyColumns();
const SOURCES = sourcesHere();

describe("what this screen reads from api_keys", () => {
  it("parsed both sides, so a passing run means something", () => {
    // A parser that matched nothing would pass for ever, which is the failure this file is about.
    expect(SCHEMA.size).toBeGreaterThan(10);
    expect(KEY_COLUMNS.length).toBeGreaterThan(5);
    expect(SOURCES.length).toBeGreaterThan(3);
  });

  it("names only columns the table actually has", () => {
    const missing = KEY_COLUMNS.filter((column) => !SCHEMA.has(column));
    expect(
      missing,
      `PostgREST answers an unknown column with an error and the caller refuses the whole read: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("does not read the hash, which is a real column and therefore really excluded", () => {
    // The second half is what stops this being an assertion about a typo.
    expect(SCHEMA.has("key_hash"), "key_hash is not a column, so excluding it proves nothing").toBe(
      true,
    );
    expect([...KEY_COLUMNS]).not.toContain("key_hash");
  });

  it("writes the hash in exactly one place and reads it in none", () => {
    // THE RULE IS NOT "NEVER MENTION IT". The digest has to be WRITTEN -- that is the whole point
    // of minting -- and must never be READ BACK, because a value that comes back comes back into a
    // rendered document. So: one file may name it, and only in the insert it belongs to.
    const stripComments = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    for (const { name, text } of SOURCES) {
      const code = stripComments(text);
      if (name === "actions.ts") continue;
      expect(code, `${name} names key_hash outside the one file that mints it`).not.toContain(
        "key_hash",
      );
    }

    const minting = SOURCES.find((s) => s.name === "actions.ts");
    expect(minting, "actions.ts is not in this directory any more").toBeDefined();
    const code = stripComments(minting?.text ?? "");
    const mentions = [...code.matchAll(/key_hash/g)];
    expect(mentions, "key_hash is named more than once in the minting path").toHaveLength(1);
    // And the one mention is an object key being written, not a column being asked for.
    expect(code).toMatch(/key_hash:\s/);
  });

  it("never selects every column", () => {
    for (const { name, text } of SOURCES) {
      // `select("*")` would be green under every RLS test in the suite and would still put the
      // digest of every live credential into a rendered document.
      expect(text, `${name} selects every column`).not.toMatch(/\.select\(\s*["'`]\s*\*/);
    }
  });
});
