"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "../_auth/server";
import { hashInvitationToken } from "../members/_token";
import { JOIN_COPY } from "./_content";

/**
 * ACCEPTING AN INVITATION, WHICH IS THE ONE MEMBERSHIP WRITE NO POLICY CAN AUTHORISE.
 *
 * The person accepting is by definition not yet a member, so there is no membership to test them
 * against -- which is why `20260908000700_rls.sql` says accepting is deliberately not a policy and
 * `public.accept_invitation` is a SECURITY DEFINER function that takes the token instead. Holding
 * the token IS the authorisation, and that is why `_token.ts` treats it as a bearer credential.
 *
 * THE HASH IS COMPUTED HERE AND THE TOKEN NEVER LEAVES THIS PROCESS. `accept_invitation` takes a
 * `bytea` digest, so the credential itself never reaches the database, its query log, or a backup.
 *
 * EVERY FAILURE IS THE SAME SENTENCE, AND THAT IS DELIBERATE. The function returns one refusal for
 * "no such token", "already accepted", "withdrawn" and "expired". Telling them apart would let
 * somebody working through guessed tokens learn which ones had ever been real, which is the same
 * reason a sign-in form does not say whether the address exists.
 */

export interface JoinState {
  readonly error?: string;
  readonly accepted?: boolean;
}

export async function acceptInvitation(
  _previous: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  if (token === "") return { error: JOIN_COPY.noToken };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The token travels in `next` so the person lands back on their own invitation rather than on a
  // generic page. It is already in a URL -- it arrived in one -- so this adds no exposure it did
  // not already have, and the alternative is an invitation that silently stops working at sign-in.
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/join?token=${token}`)}`);

  const { error } = await supabase.rpc("accept_invitation", {
    p_token_hash: await hashInvitationToken(token),
  });

  // `22023` is what the function raises for every unusable invitation, and `42501` for a caller
  // with no session. Neither message is surfaced: PostgreSQL names tables and constraints, and the
  // person reading this is not the right reader for either.
  if (error) {
    return { error: error.code === "22023" ? JOIN_COPY.refused : JOIN_COPY.unavailable };
  }

  return { accepted: true };
}
