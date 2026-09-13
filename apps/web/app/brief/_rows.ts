import { METRICS, type MetricName, SOURCES, type Source } from "@repo/contract";
import type { InsightRow } from "@repo/insights";

import { supabaseServer } from "../_auth/server";

/**
 * THE ROWS THE BRIEF IS BUILT FROM, AND THE ONE COLUMN THAT IS DELIBERATELY NOT SELECTED.
 *
 * This is a second read of `envelope_rows` beside `performanceRows` in `_auth/workspace.ts`, and
 * it is a second one on purpose rather than a widening of the first. The dashboard's select is
 * tuned for a table a person reads; the engine needs three columns that table has no use for --
 * `timezone`, `account_id` and `entity_type` -- and widening the shared list would put them into a
 * query that renders them nowhere.
 *
 * ================================================================================================
 * `entity_name` IS NOT IN THIS SELECT AND MUST NOT BE ADDED
 * ================================================================================================
 *
 * The column exists on the table. It holds a campaign, ad group, listing or product name **typed
 * by the customer**, which makes it the one field on this row that can contain anything at all --
 * including a person's name or address, which is issue #53.
 *
 * `InsightRow` has no field to receive it, so the type already refuses it. This select refuses it
 * a second time, one layer earlier, because the two refusals fail differently: the type stops a
 * mistake at compile time, and not selecting it means the value never enters this process even if
 * somebody later adds a field to the type. `CLAUDE.md`'s rule -- nothing tenant-written reaches a
 * model prompt -- is worth two locks.
 *
 * ================================================================================================
 * NO TENANCY PREDICATE, FOR THE REASON `workspace.ts` GIVES
 * ================================================================================================
 *
 * There is no `.eq("workspace_id", ...)` here and there must not be one. Row-level security
 * returns exactly the rows this session may see. A filter here would be a SECOND place tenancy is
 * decided, and the one that eventually disagrees with the first while being invisible to a policy
 * audit, because it lives in a React file.
 */

/**
 * Dimension columns the ENGINE needs, which is not the same set the dashboard needs.
 *
 * `entity_type` is selected because `InsightRow.entity.type` is a string the engine carries
 * through to nothing -- it never reaches a prompt -- but dropping it would mean inventing a value,
 * and inventing a value is how a field stops meaning what its name says.
 */
const BRIEF_DIMENSIONS = [
  "source",
  "account_id",
  "entity_id",
  "entity_type",
  "date",
  "currency",
  "timezone",
  "is_provisional",
  "fetched_at",
] as const;

const BRIEF_METRICS: readonly MetricName[] = Object.keys(METRICS) as MetricName[];

/** Exported so a test can assert that no dictionary metric has fallen out of the select. */
export const BRIEF_COLUMNS: readonly string[] = [...BRIEF_DIMENSIONS, ...BRIEF_METRICS];

/**
 * THE ROW CAP, AND WHY IT REFUSES RATHER THAN TRUNCATES.
 *
 * A figure set built from the first thousand of two thousand rows is not a smaller brief -- it is
 * a brief about a period the owner did not ask about, with a total that is wrong and no marker
 * saying so. Every other cap in this repository is a `limit` that silently drops the rest; this one
 * reads one row past the cap so it can tell the difference between "that was all of them" and
 * "there were more", and refuse in the second case.
 */
export const MAX_BRIEF_ROWS = 2000;

export type BriefRowsResult =
  | { readonly ok: true; readonly rows: readonly InsightRow[] }
  | { readonly ok: false; readonly code: "unreadable" | "too_many_rows"; readonly detail: string };

/** Narrow PostgREST's `string` back to the dictionary enum, refusing anything unrecognised. */
function asSource(value: unknown): Source | null {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value)
    ? (value as Source)
    : null;
}

export async function briefRows(from: string, to: string): Promise<BriefRowsResult> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("envelope_rows")
    .select(BRIEF_COLUMNS.join(", "))
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .limit(MAX_BRIEF_ROWS + 1);

  if (error) {
    // A FAILED READ IS NOT AN EMPTY PERIOD. Returning `[]` here would hand the engine a set with no
    // rows, which it refuses as `no_rows` -- and the owner would be told their period was empty
    // when what actually happened was a database fault. The distinction is the dashboard's own,
    // recorded in `DASH_STATE.rowsUnavailable`, and it matters more here because a brief makes
    // sentences out of what it is given.
    return { ok: false, code: "unreadable", detail: error.code ?? "unknown" };
  }

  const raw = (data ?? []) as unknown as readonly Record<string, unknown>[];
  if (raw.length > MAX_BRIEF_ROWS) {
    return {
      ok: false,
      code: "too_many_rows",
      detail: `more than ${MAX_BRIEF_ROWS} rows cover this period`,
    };
  }

  const rows: InsightRow[] = [];
  for (const row of raw) {
    const source = asSource(row.source);
    // A row whose source is not in the dictionary is dropped rather than guessed at. It cannot
    // happen through the ingest path -- the column is an enum -- so reaching this branch means the
    // dictionary and the database have diverged, and carrying on with a made-up source id would
    // put a wrong provenance mark under a real figure.
    if (source === null) continue;
    if (
      typeof row.entity_id !== "string" ||
      typeof row.account_id !== "string" ||
      typeof row.entity_type !== "string" ||
      typeof row.date !== "string" ||
      typeof row.currency !== "string" ||
      typeof row.timezone !== "string" ||
      typeof row.fetched_at !== "string" ||
      typeof row.is_provisional !== "boolean"
    ) {
      continue;
    }

    const metrics: Partial<Record<MetricName, unknown>> = {};
    // EVERY METRIC STAYS `unknown`. PostgREST serialises `numeric` as a JSON number today and the
    // column is `numeric(20, 6)`; a driver that returned it as a string would make a coercion here
    // compile and lie. `readMetric` in the engine is the one place that decides what is a number,
    // what is absent and what is neither, exactly as `readFigure` is for the dashboard.
    for (const name of BRIEF_METRICS) {
      if (row[name] !== null && row[name] !== undefined) metrics[name] = row[name];
    }

    rows.push({
      source,
      entity: { type: row.entity_type, id: row.entity_id, account_id: row.account_id },
      dimensions: { date: row.date, currency: row.currency, timezone: row.timezone },
      metrics,
      fetched_at: row.fetched_at,
      is_provisional: row.is_provisional,
    });
  }

  return { ok: true, rows };
}
