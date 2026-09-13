"use server";

import { revalidatePath } from "next/cache";

import { supabaseServer } from "../_auth/server";
import { DATA_REQUESTS, REQUEST_KINDS, type RequestKind } from "./_content";
import { currentOrganisationId } from "./_requests";

/**
 * FILING AND WITHDRAWING, AND WHY NEITHER DECIDES ANYTHING.
 *
 * Both calls go to a `SECURITY DEFINER` function that answers the authorisation question itself:
 * `file_data_request` refuses an organisation the session is not a member of, and
 * `withdraw_data_request` matches on `requested_by = app.current_user_id()` so a request can only
 * be withdrawn by the person who made it -- not by an owner, not by an admin. This module reads a
 * form, calls the write, and turns whatever comes back into one sentence.
 *
 * THE ORGANISATION IS READ HERE AND NOT TAKEN FROM THE FORM. A hidden input carrying an
 * organisation id would be a tenancy decision made in the browser; the function would still refuse
 * a foreign one, but the screen would be asking the customer to hold a value it is the server's job
 * to know. The same argument the OAuth callback makes for taking the workspace from the redeemed
 * row rather than from the body.
 */
export interface RequestState {
  readonly error?: string;
  readonly reference?: string;
  readonly filed?: boolean;
  /** Kept across a refusal so a person does not retype a paragraph they have just written. */
  readonly note?: string;
  readonly kind?: string;
}

const MAX_NOTE = 4000;

function isKind(value: unknown): value is RequestKind {
  return typeof value === "string" && (REQUEST_KINDS as readonly string[]).includes(value);
}

export async function fileRequest(_previous: RequestState, form: FormData): Promise<RequestState> {
  const kind = form.get("kind");
  const rawNote = form.get("note");
  const note = typeof rawNote === "string" ? rawNote : "";

  if (!isKind(kind)) return { error: DATA_REQUESTS.errors.unknownKind };

  // Bounded here as well as in the column's CHECK. Not belt-and-braces: this one stops a pasted
  // document travelling at all, and the column's is the authority. Refused rather than truncated --
  // a silently shortened request is a person's words edited by a machine.
  if (note.length > MAX_NOTE) {
    return { error: DATA_REQUESTS.errors.blankNote, kind, note: note.slice(0, MAX_NOTE) };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: DATA_REQUESTS.errors.notSignedIn, kind, note };

  const organisationId = await currentOrganisationId();
  if (organisationId === null) {
    return { error: DATA_REQUESTS.errors.noOrganisation, kind, note };
  }

  const { error } = await supabase.rpc("file_data_request", {
    p_organisation_id: organisationId,
    p_kind: kind,
    p_subject_note: note.trim() === "" ? null : note,
  });

  if (error) {
    // The database's own refusal, not this module's reading of it. 42501 is the tenancy check
    // firing, which a correctly-signed-in person should never see.
    const refused = error.code === "42501";
    return {
      error: refused ? DATA_REQUESTS.errors.refused : DATA_REQUESTS.errors.unavailable,
      ...(error.code === undefined ? {} : { reference: error.code }),
      kind,
      note,
    };
  }

  revalidatePath("/data-requests");
  return { filed: true };
}

export async function withdrawRequest(
  _previous: RequestState,
  form: FormData,
): Promise<RequestState> {
  const id = form.get("id");
  if (typeof id !== "string" || id === "") return { error: DATA_REQUESTS.errors.notYours };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("withdraw_data_request", { p_id: id });

  if (error) {
    // P0002 is the function's single answer for "no such request, somebody else's, or already
    // resolved" -- four cases deliberately collapsed so a signed-in person cannot probe for the
    // existence of other people's requests by id. The screen keeps them collapsed too.
    const notYours = error.code === "P0002";
    return {
      error: notYours ? DATA_REQUESTS.errors.notYours : DATA_REQUESTS.errors.unavailable,
      ...(error.code === undefined || notYours ? {} : { reference: error.code }),
    };
  }

  revalidatePath("/data-requests");
  return { filed: true };
}
