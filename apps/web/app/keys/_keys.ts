import { supabaseServer } from "../_auth/server";

/**
 * READING A WORKSPACE'S API KEYS, AND THE COLUMN THAT MUST NEVER APPEAR HERE.
 *
 * ================================================================================================
 * `key_hash` IS NOT IN THE SELECT, AND `select *` IS NOT AN OPTION
 * ================================================================================================
 *
 * `api_keys_select` returns the WHOLE ROW to an org admin, hash included. Row-level security
 * decides which rows a session may see; it does not decide which columns, and there is no policy
 * anywhere in this schema that would stop `select("*")` handing a page the SHA-256 of every live
 * credential in the account.
 *
 * That digest is not the key, but it is the thing `verify_api_key` is looked up by, and putting it
 * in a server-rendered document puts it in a browser's memory, in a bfcache entry, and in whatever
 * error reporter the deployment later grows. Every column is named for the same reason
 * `account/_export.ts` names its own, and `_keys.test.ts` scans this directory's source for the
 * string so a later `*` fails rather than ships.
 *
 * ================================================================================================
 * NO WORKSPACE PREDICATE, FOR THE HOUSE REASON
 * ================================================================================================
 *
 * `_auth/workspace.ts` sets it out: RLS does tenancy, not application code. A
 * `.eq("workspace_id", …)` here would be a second place tenancy is decided and the one a policy
 * audit cannot see. The workspace arrives from the session, not from the caller.
 *
 * ================================================================================================
 * A VIEWER GETS ZERO ROWS, AND ZERO ROWS IS NOT "NO KEYS"
 * ================================================================================================
 *
 * `api_keys_select` is gated on `app.is_org_admin`, so a viewer's query succeeds and returns
 * nothing -- indistinguishable, from the data alone, from an account that has never made a key. The
 * role is what separates them, so the role decides whether the query runs at all and the page says
 * which of the two it is looking at.
 */

/** Every column this screen reads. `key_hash` is deliberately absent; see above. */
export const KEY_COLUMNS = [
  "id",
  "name",
  "key_prefix",
  "monthly_credit_budget",
  "credits_used",
  "allowed_tools",
  "last_used_at",
  "expires_at",
  "revoked_at",
  "created_at",
] as const;

export interface ApiKeyRow {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  /** NULL is "no ceiling", which is a different fact from a ceiling of zero. Never collapsed. */
  readonly monthlyCreditBudget: number | null;
  readonly creditsUsed: number;
  /** Empty means every tool. The schema's own comment; not a null that means "all". */
  readonly allowedTools: readonly string[];
  /** NULL is "never used", which is the whole reason `verify_api_key` writes this column. */
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

export type KeysState =
  | { readonly kind: "ready"; readonly keys: readonly ApiKeyRow[] }
  | { readonly kind: "notAdmin" }
  | { readonly kind: "unavailable"; readonly reason: string };

interface RawKey {
  id: string;
  name: string;
  key_prefix: string;
  monthly_credit_budget: number | null;
  credits_used: number;
  allowed_tools: string[] | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function workspaceApiKeys(isAdmin: boolean): Promise<KeysState> {
  // The role gate is here rather than on the caller so that "a viewer saw nothing" can never be
  // rendered as "there is nothing"; see the third block above.
  if (!isAdmin) return { kind: "notAdmin" };

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("api_keys")
    .select(KEY_COLUMNS.join(", "))
    .order("created_at", { ascending: false });

  if (error) {
    // The database's own message names tables and policies. A signed-in customer is not the reader
    // for either, and the code is enough for a support conversation.
    return { kind: "unavailable", reason: error.code ?? "unknown" };
  }

  return {
    kind: "ready",
    keys: ((data ?? []) as unknown as RawKey[]).map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      monthlyCreditBudget: row.monthly_credit_budget,
      creditsUsed: row.credits_used,
      // `allowed_tools` is NOT NULL in the schema with a `'{}'` default, so the fallback is for the
      // driver rather than the data -- and it is an empty array, which the schema's own comment
      // defines as "every tool". It is never turned into a null meaning something else.
      allowedTools: row.allowed_tools ?? [],
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    })),
  };
}
