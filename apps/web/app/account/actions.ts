"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "../_auth/server";
import { ACCOUNT_COPY } from "./_content";

/**
 * CLOSING AN ACCOUNT, WHICH IS THE ONE IRREVERSIBLE THING THIS PRODUCT DOES.
 *
 * EVERY RULE IS IN THE DATABASE AND NONE OF THEM IS HERE. `public.delete_organisation` checks that
 * the caller is an OWNER -- not an admin, because ending the business is not a delegated act --
 * that the typed confirmation matches the organisation's name exactly, and that no subscription is
 * still collecting money. This module reads a form, calls it, and turns whatever comes back into
 * one sentence.
 *
 * The confirmation in particular is checked in the FUNCTION and not in the form, deliberately. A
 * confirmation enforced only by a screen is a confirmation absent from every other caller, and
 * `19_erasure.sql` proves the refusal against a real `authenticated` session rather than against a
 * rendered input.
 */

const SIGN_IN = "/signin?next=%2Faccount";

export interface EraseState {
  readonly error?: string;
  readonly done?: boolean;
}

export async function eraseAccount(_previous: EraseState, formData: FormData): Promise<EraseState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN);

  const organisationId = String(formData.get("organisation") ?? "");
  // NOT TRIMMED. The function compares exactly, and trimming here would make the screen accept
  // something the database refuses -- a disagreement between two places the same rule lives, which
  // is the whole reason the rule only lives in one of them.
  const confirmation = String(formData.get("confirmation") ?? "");

  if (organisationId === "" || confirmation === "") {
    return { error: ACCOUNT_COPY.confirmMismatch };
  }

  const { error } = await supabase.rpc("delete_organisation", {
    p_organisation_id: organisationId,
    p_confirmation: confirmation,
  });

  if (error) {
    // The database's own message names tables, functions and constraints, and somebody closing
    // their account is not the right reader for any of them. The code is matched instead, and an
    // unrecognised one says nothing was changed rather than inventing a reason.
    if (error.code === "42501") return { error: ACCOUNT_COPY.notOwner };
    if (error.code === "22023") return { error: ACCOUNT_COPY.confirmMismatch };
    if (error.code === "23514") return { error: ACCOUNT_COPY.liveSubscription };
    return { error: ACCOUNT_COPY.unavailable };
  }

  // NO `revalidatePath`. There is nothing left to revalidate -- every row this session could read
  // is gone, and re-rendering the page would run a read that now returns nothing and present it as
  // an empty account rather than a closed one. The form renders the closing sentence instead.
  return { done: true };
}
