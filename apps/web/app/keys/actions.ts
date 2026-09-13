"use server";

import { hashApiKey } from "@repo/store/jwt";
import { revalidatePath } from "next/cache";

import { currentUser, supabaseServer } from "../_auth/server";
import { currentWorkspace } from "../_auth/workspace";
import { readMembership } from "../members/_members";
import { KEYS_COPY } from "./_content";
import { mintApiKey } from "./_mint";

/**
 * CREATING AND RETIRING AN API KEY.
 *
 * ================================================================================================
 * THE PLAINTEXT IS RETURNED ONCE AND WRITTEN NOWHERE
 * ================================================================================================
 *
 * What goes into `api_keys` is the SHA-256 and a display prefix. The key itself is in the returned
 * state, rendered once, and then gone -- not logged on the happy path, not logged on a refusal, and
 * not put in a `revalidatePath` cache entry, because the row it would be cached beside does not
 * contain it.
 *
 * This is the same discipline `members/actions.ts` records for an invitation token, and for the
 * same reason: a credential in a log line is a working credential sitting where nobody audits.
 *
 * ================================================================================================
 * THE HASH COMES FROM `@repo/store`, NOT FROM A SECOND SHA-256 WRITTEN HERE
 * ================================================================================================
 *
 * `hashApiKey` is what the Worker feeds `verify_api_key`. Writing the digest again in this file
 * would compile, pass a test of its own, and mint keys nothing can verify -- including the `\x`
 * bytea framing, which is not decoration: the column is `bytea` and the function refuses anything
 * that is not exactly 32 bytes.
 *
 * IMPORTED FROM `@repo/store/jwt` AND NOT FROM `@repo/store`. The package's barrel re-exports its
 * siblings as `./thing.js`, and Turbopack does not map a `.js` specifier onto the `.ts` beside it --
 * the rule `tsconfig.base.json` writes down and `next.config.ts` explains at length. The barrel
 * fails `next build` with eight `Module not found`s; `src/jwt.ts` imports nothing at all. Same
 * function, one file.
 *
 * ================================================================================================
 * A WRITE THAT CHANGED NOTHING IS NOT A SUCCESS
 * ================================================================================================
 *
 * Row-level security does not raise on a write it disallows. It removes the row from the
 * statement's view, so a revoke a viewer is not permitted to make returns NO ERROR having touched
 * nothing. Reporting that as done tells somebody a credential is dead while it still opens the
 * door. Both writes therefore `.select()` what they changed and count it.
 */

export interface CreateKeyState {
  readonly error?: string;
  /**
   * THE ONLY PLACE THIS VALUE EVER EXISTS OUTSIDE THE CUSTOMER'S CLIPBOARD. Present exactly once,
   * on the response to the creation that made it. Never read back, never stored.
   */
  readonly key?: string;
  readonly name?: string;
}

export interface RevokeKeyState {
  readonly error?: string;
  readonly done?: boolean;
}

/** The caller's workspace and whether they may administer it, resolved once. */
async function adminContext(): Promise<
  { ok: true; workspaceId: string; memberId: string } | { ok: false; error: string }
> {
  const user = await currentUser();
  if (!user) return { ok: false, error: KEYS_COPY.signedOut };

  const membership = await readMembership(user.id);
  if (membership.kind === "needsOrganisation")
    return { ok: false, error: KEYS_COPY.noOrganisation };
  if (membership.kind === "unavailable") return { ok: false, error: KEYS_COPY.unavailable };

  const role = membership.membership.ownRole;
  if (role !== "owner" && role !== "admin") return { ok: false, error: KEYS_COPY.notAdmin };

  const workspace = await currentWorkspace();
  if (workspace.kind !== "ready") return { ok: false, error: KEYS_COPY.noWorkspace };

  return {
    ok: true,
    workspaceId: workspace.workspace.id,
    memberId: membership.membership.ownMemberId,
  };
}

export async function createApiKey(
  _previous: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const name = String(formData.get("name") ?? "").trim();

  // The column checks `length(btrim(name)) between 1 and 120`. Checked here too, not to duplicate
  // the rule but so the refusal is a sentence rather than a constraint violation code -- the
  // database stays the one that decides.
  if (name.length === 0 || name.length > 120) return { error: KEYS_COPY.nameRequired, name };

  const context = await adminContext();
  if (!context.ok) return { error: context.error, name };

  const minted = mintApiKey(crypto);
  const keyHash = await hashApiKey(minted.key, crypto);

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      workspace_id: context.workspaceId,
      name,
      key_prefix: minted.prefix,
      key_hash: keyHash,
      created_by: context.memberId,
    })
    // `id` only. The row is re-read by the page through `workspaceApiKeys`, which names its
    // columns; asking for them here would be a second column list to keep in step.
    .select("id");

  if (error || !data || data.length === 0) {
    // NOTHING FROM THE UPSTREAM ERROR, and nothing of the key. A failed insert means the credential
    // was minted and thrown away, which is the correct outcome: it exists nowhere.
    return { error: KEYS_COPY.createFailed, name };
  }

  revalidatePath("/keys");
  return { key: minted.key };
}

export async function revokeApiKey(
  _previous: RevokeKeyState,
  formData: FormData,
): Promise<RevokeKeyState> {
  const id = String(formData.get("id") ?? "").trim();
  if (id.length === 0) return { error: KEYS_COPY.revokeFailed };

  const context = await adminContext();
  if (!context.ok) return { error: context.error };

  const supabase = await supabaseServer();

  // `revoked_at` RATHER THAN A DELETE, and not by choice here: `20260908000700_rls.sql` grants no
  // DELETE on `api_keys` at all. "A hard delete of an api_key erases the audit trail of what that
  // key did" -- the row is the only record that the calls made with it were authorised.
  //
  // THE TIMESTAMP IS THIS PROCESS'S CLOCK AND NOT THE DATABASE'S, which is worth a sentence
  // because two clocks can disagree and this repository refuses guessed times elsewhere. It is
  // safe here for a specific reason: `verify_api_key` tests `revoked_at is null`, never its VALUE.
  // Skew can make the recorded moment a second early or late in a list; it cannot make a revoked
  // key verify. If anything ever reads the value as a fact -- a billing boundary, a report -- this
  // becomes a definer function that writes `now()` instead.
  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");

  if (error) return { error: KEYS_COPY.revokeFailed };

  // ZERO ROWS IS A REFUSAL WEARING A SUCCESS. Either the policy removed the row from this
  // statement's view, or the key was already revoked. Neither is "done", and saying it is tells
  // somebody a credential is dead while it still works.
  if (!data || data.length === 0) return { error: KEYS_COPY.revokeChangedNothing };

  revalidatePath("/keys");
  return { done: true };
}
