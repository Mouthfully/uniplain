import { supabaseServer } from "../_auth/server";

/**
 * WHAT A CUSTOMER GETS WHEN THEY ASK FOR THEIR DATA, AND WHAT THEY DELIBERATELY DO NOT.
 *
 * PDPA s.31 gives a data subject the right to receive their data in a commonly used, machine-
 * readable form. JSON, in one file, with the shape of the tables it came from rather than a
 * flattened report: a flattening is an editorial decision about what mattered, and the point of
 * portability is that the customer decides that.
 *
 * ================================================================================================
 * THE CREDENTIALS ARE NOT IN IT, AND THAT IS NOT AN OVERSIGHT
 * ================================================================================================
 *
 * `connections` carries `credential_ciphertext`, `credential_iv` and `wrapped_dek`. A tenant can
 * SELECT those columns -- `connections_select` allows it, deliberately, because the scheduler needs
 * the ciphertext to do its job and reading it yields nothing without the KEK, which lives in
 * Cloudflare.
 *
 * That makes it easy to put them in an export by writing `select *`, and it must not happen. An
 * export is a file a customer emails to their accountant, drops in a shared folder, or uploads to
 * whatever asked them for it. Sealed or not, a platform credential belongs to the boundary that
 * holds it, and the moment it is in a downloaded file it is outside that boundary for ever.
 *
 * So every table names its columns. There is no `select *` in this module, and
 * `_export.test.ts` asserts the absence by name: a column added to `connections` tomorrow is
 * missing from the export until somebody decides it belongs there, which is the direction this
 * should fail in.
 *
 * ================================================================================================
 * AND THE THINGS THAT ARE NOT HERE BECAUSE THEY DO NOT EXIST
 * ================================================================================================
 *
 * No archived platform payloads: `putPayload` has no call site under `apps/api-edge/src`, so
 * nothing has ever been written to the R2 bucket. No audit log: nothing records who did what
 * (issue #63). No invoices: `20260912000600_billing.sql` deliberately stores none, because the
 * payment processor holds the authoritative billing record and the customer can get it from there.
 */

/** One table in the export. `rows` is whatever RLS returned for this session. */
export interface ExportTable {
  readonly table: string;
  readonly rows: readonly Record<string, unknown>[];
}

export interface AccountExport {
  readonly exportedAt: string;
  readonly organisation: Record<string, unknown>;
  readonly tables: readonly ExportTable[];
  /** Said in the file itself, so it travels with it. */
  readonly notIncluded: readonly string[];
}

export type ExportState =
  | { readonly kind: "ready"; readonly data: AccountExport }
  | { readonly kind: "needsOrganisation" }
  | { readonly kind: "unavailable"; readonly reason: string };

/**
 * THE COLUMNS, WRITTEN OUT.
 *
 * Every entry is a decision. `connections` is the one that matters -- see the module comment -- and
 * the rest are written out for the same reason: an export built from `select *` exports whatever
 * the schema grows next, and nobody reviews a column they did not add to a list.
 */
const TABLES: readonly { readonly table: string; readonly columns: string }[] = [
  { table: "workspaces", columns: "id, name, slug, timezone, created_at" },
  {
    table: "invitations",
    columns: "id, email, role, created_at, expires_at, accepted_at, revoked_at",
  },
  {
    table: "connections",
    columns:
      "id, workspace_id, provider, external_account_id, display_name, credential_lane, " +
      "granted_scopes, status, expires_at, last_health_check_at, restatement_window_days, created_at",
  },
  {
    table: "envelope_rows",
    columns:
      "id, workspace_id, source, entity_id, grain, period_start, period_end, metric, value, " +
      "currency, timezone, fetched_at, source_updated_at, is_provisional, restates_until, " +
      "attribution_window, fx_rate",
  },
  {
    table: "subscriptions",
    columns: "plan, status, billing_interval, current_period_end, cancel_at_period_end",
  },
];

export const NOT_INCLUDED = [
  "The sealed credential for each connected platform. It is held so the product can read on your behalf, it is unreadable without a key this application does not have, and a credential in a downloaded file is outside that protection for good.",
  "Your sign-in record. It belongs to the authentication service rather than to this account, and the same address may sign in to more than one.",
  "Invoices and card details. The payment provider holds those and can give you them directly; nothing of the sort is stored here.",
] as const;

export async function buildExport(): Promise<ExportState> {
  const supabase = await supabaseServer();

  // No predicate anywhere below. Row-level security returns exactly the rows this session may see,
  // which is the house rule: RLS does tenancy, not application code.
  const { data: orgs, error: orgError } = await supabase
    .from("organisations")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) return { kind: "unavailable", reason: orgError.code ?? "unknown" };
  const organisation = orgs?.[0];
  if (!organisation) return { kind: "needsOrganisation" };

  const tables: ExportTable[] = [];
  for (const spec of TABLES) {
    const { data, error } = await supabase.from(spec.table).select(spec.columns);
    // A TABLE THAT COULD NOT BE READ REFUSES THE WHOLE EXPORT. A file that silently omits a table
    // is worse than no file: the customer believes they have everything, and the thing they are
    // missing is the thing they will need. This is `_figures.ts`'s three-branch rule applied to a
    // download.
    if (error) return { kind: "unavailable", reason: error.code ?? "unknown" };
    // `as unknown as` rather than a direct cast, because the client types a dynamic `.from(name)`
    // as possibly-an-error-shape and the two do not overlap. The narrowing is safe only because the
    // `error` branch above has already returned -- which is the whole reason that branch refuses
    // the export rather than skipping the table.
    tables.push({
      table: spec.table,
      rows: (data ?? []) as unknown as Record<string, unknown>[],
    });
  }

  return {
    kind: "ready",
    data: {
      exportedAt: new Date().toISOString(),
      organisation: organisation as Record<string, unknown>,
      tables,
      notIncluded: NOT_INCLUDED,
    },
  };
}
