import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * EVERY COLUMN THE EXPORT NAMES EXISTS IN THE SCHEMA.
 *
 * THIS TEST EXISTS BECAUSE THE FIRST VERSION OF `_export.ts` NAMED FIVE COLUMNS THAT DO NOT EXIST.
 * It asked `workspaces` for a `timezone`, and `envelope_rows` for `grain`, `period_start`,
 * `period_end`, `metric` and `value` -- a metric/value shape that column list was remembered from
 * rather than read. `envelope_rows` carries a `date` and one column per metric.
 *
 * PostgREST answers an unknown column with an error, and `buildExport` refuses the whole export on
 * any error -- correctly. So the feature would have shipped downloading nothing at all, for every
 * customer, on every attempt. The unit test passed: it is a source scan for what must NOT be in the
 * list, and it has no opinion about whether what IS in the list is real. The SQL suite passed too:
 * it never goes through PostgREST.
 *
 * It is exactly the failure the design notes keep recording in other people's work -- a column
 * remembered rather than read -- committed by the author of those notes. The guard is the answer,
 * not the resolution to be more careful.
 *
 * HOW IT WORKS: the migrations are the schema, so the column names come from them --
 * `create table` bodies plus every `alter table ... add column`. A column added by a migration
 * tomorrow is known the day it lands, and an export naming something that never existed fails here
 * rather than in a customer's browser.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "..", "..", "..", "supabase", "migrations");

/** Every column of every `public` table, read out of the migrations. */
function schemaColumns(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");

    for (const match of sql.matchAll(
      /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const table = match[1] as string;
      const body = match[2] as string;
      const columns = tables.get(table) ?? new Set<string>();
      for (const line of body.split("\n")) {
        // A column definition starts with a name at the top level of the body. `constraint`,
        // `unique`, `check`, `primary` and `foreign` start a table constraint instead.
        const name = line.match(/^\s{2}([a-z_][a-z0-9_]*)\s+\S/);
        if (name === null) continue;
        const word = name[1] as string;
        if (["constraint", "unique", "check", "primary", "foreign", "exclude"].includes(word))
          continue;
        columns.add(word);
      }
      tables.set(table, columns);
    }

    for (const match of sql.matchAll(
      /alter table (?:if exists )?public\.(\w+)\s+add column (?:if not exists )?([a-z_][a-z0-9_]*)/g,
    )) {
      const table = match[1] as string;
      const columns = tables.get(table) ?? new Set<string>();
      columns.add(match[2] as string);
      tables.set(table, columns);
    }
  }
  return tables;
}

/** The `{ table, columns }` pairs the export asks for, read out of its source. */
function exportedColumns(): { table: string; columns: string[] }[] {
  const source = readFileSync(join(HERE, "_export.ts"), "utf8");
  const block = source.slice(
    source.indexOf("const TABLES"),
    source.indexOf("export const NOT_INCLUDED"),
  );
  const out: { table: string; columns: string[] }[] = [];

  // SPLIT ON THE `table:` KEYS AND TAKE EACH SPAN UP TO THE NEXT ONE.
  //
  // The first version matched `table: "X", columns: ... }` in one regex and quietly MERGED two
  // entries, because one of them spells `columns:` across several lines and the closing `}` it
  // found belonged to the entry after. Four tables were parsed instead of five and one column list
  // was two lists concatenated -- so the guard was reporting a nonsense column name and silently
  // not checking a table at all. The floor below is what caught it.
  const keys = [...block.matchAll(/table:\s*"(\w+)"/g)];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i] as RegExpMatchArray;
    const from = (key.index ?? 0) + key[0].length;
    const to =
      i + 1 < keys.length
        ? ((keys[i + 1] as RegExpMatchArray).index ?? block.length)
        : block.length;
    const span = block.slice(from, to);
    const columns = span.slice(span.indexOf("columns:"));
    const joined = [...columns.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");
    out.push({
      table: key[1] as string,
      columns: joined
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c !== ""),
    });
  }
  return out;
}

const SCHEMA = schemaColumns();
const EXPORTED = exportedColumns();

describe("the export against the schema it reads", () => {
  it("parses both sides, so a passing run means something", () => {
    // A parser that matched nothing would pass for ever, which is the failure this whole file is
    // about. Both floors are asserted before anything is compared.
    expect(SCHEMA.size).toBeGreaterThan(10);
    expect(EXPORTED.length).toBeGreaterThanOrEqual(5);
    for (const { table, columns } of EXPORTED) {
      expect(columns.length, `no columns parsed for ${table}`).toBeGreaterThan(2);
    }
  });

  it("names only tables that exist", () => {
    const missing = EXPORTED.filter((e) => !SCHEMA.has(e.table)).map((e) => e.table);
    expect(missing).toEqual([]);
  });

  it("names only columns that exist", () => {
    const missing: string[] = [];
    for (const { table, columns } of EXPORTED) {
      const known = SCHEMA.get(table);
      if (known === undefined) continue;
      for (const column of columns) {
        if (!known.has(column)) missing.push(`${table}.${column}`);
      }
    }
    expect(
      missing,
      "PostgREST answers an unknown column with an error, and the export refuses on any error",
    ).toEqual([]);
  });

  /**
   * AND THE SEALED COLUMNS ARE CHECKED AGAINST THE SCHEMA TOO, not just against the export.
   *
   * `_export.test.ts` asserts the export does not name them. This asserts they are still THERE to
   * be named: if `credential_ciphertext` were renamed, that test would keep passing while the new
   * name went unguarded.
   */
  it("still knows which columns it is keeping out", () => {
    const connections = SCHEMA.get("connections");
    expect(connections).toBeDefined();
    for (const sealed of ["credential_ciphertext", "credential_iv", "wrapped_dek"]) {
      expect(connections?.has(sealed), `${sealed} has been renamed -- update _export.test.ts`).toBe(
        true,
      );
    }
  });
});
