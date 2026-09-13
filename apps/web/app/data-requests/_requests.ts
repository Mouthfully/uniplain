import { supabaseServer } from "../_auth/server";

/**
 * Reading the requests this session may see.
 *
 * NO WORKSPACE OR ORGANISATION PREDICATE. `data_requests_select` decides which rows exist for this
 * session, and a `.eq("organisation_id", …)` here would be a second place tenancy is decided --
 * the one that eventually disagrees with the policy. Same rule, same reason, as `_connections.ts`
 * and `_members.ts`.
 */
export interface DataRequestRow {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly subject_note: string | null;
  readonly resolution_note: string | null;
  readonly requested_by: string | null;
  readonly requested_at: string;
  readonly state_changed_at: string;
}

export type DataRequestsResult =
  | { readonly kind: "ready"; readonly rows: readonly DataRequestRow[] }
  | { readonly kind: "unavailable"; readonly reason: string };

export async function organisationDataRequests(): Promise<DataRequestsResult> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("data_requests")
    .select(
      "id, kind, state, subject_note, resolution_note, requested_by, requested_at, state_changed_at",
    )
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) return { kind: "unavailable", reason: error.code ?? "unknown" };
  return { kind: "ready", rows: (data ?? []) as unknown as readonly DataRequestRow[] };
}

/**
 * The organisation this session belongs to, or null.
 *
 * One row, no predicate, for the reason above. `file_data_request` refuses an organisation the
 * caller is not a member of anyway -- this is what the form needs in order to ask, not what
 * decides whether the asking is allowed.
 */
export async function currentOrganisationId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) return null;
  return (data?.[0]?.id as string | undefined) ?? null;
}
