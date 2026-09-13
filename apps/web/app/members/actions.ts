"use server";

import { siteUrl } from "@repo/brand";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { supabaseServer } from "../_auth/server";
import {
  INVITABLE_ROLES,
  type InvitableRole,
  MEMBERS_COPY,
  ALL_ROLES,
  type MemberRole,
} from "./_content";
import {
  INVITATION_TTL_MS,
  hashInvitationToken,
  invitationLink,
  newInvitationToken,
} from "./_token";
import { readMembership } from "./_members";

/**
 * THE FOUR THINGS AN ADMIN CAN DO TO SOMEBODY ELSE'S ACCESS, AND WHAT DECIDES EACH.
 *
 * NOT THIS FILE. Every authorisation question here is answered by the database:
 * `invitations_insert` and `invitations_update` are gated on `app.is_org_admin`, `members_update`
 * and `members_delete` likewise, and `20260913000600_membership_guards.sql` adds the two rules a
 * policy cannot express -- an organisation keeps at least one owner, and only an owner may change
 * or remove an owner. This module reads a form, calls the write, and turns whatever comes back into
 * one sentence.
 *
 * That division is the point rather than tidiness. An `if (role === "owner") return refuse()` here
 * would be a second place the rule lives, in the language least likely to be read during an audit,
 * and the one that eventually disagrees with the policy. The screen offers what a role can do; the
 * database decides what it may do, and `18_membership_guards.sql` is where that is proved against a
 * hostile session rather than a rendered button.
 *
 * WHAT NEVER COMES BACK: the invitation token, except once, in the response to the request that
 * created it. It is not stored, not logged, and not recoverable afterwards by anyone -- see
 * `_token.ts`. No refusal path echoes it, so no cache or proxy can hold a working invitation.
 */

const SIGN_IN = "/signin?next=%2Fmembers";

/** The address shape the database's own CHECK constraint accepts, so a refusal is ours not its. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface InviteState {
  readonly error?: string;
  /** Shown once and never again. Absent on every path except a successful creation. */
  readonly link?: string;
  /** Echoed so the form keeps its shape after a refusal. Neither of these is a credential. */
  readonly email?: string;
  readonly role?: string;
}

export interface ManageState {
  readonly error?: string;
  readonly done?: boolean;
}

function isInvitable(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

function isRole(value: string): value is MemberRole {
  return (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * The database's own refusal, turned into one sentence a business owner can act on.
 *
 * NOTHING UPSTREAM IS ECHOED. A PostgreSQL message names tables, columns, constraints and policies,
 * and a signed-in customer is not the right reader for any of them. The code is matched instead,
 * and an unrecognised one says the change was refused rather than inventing a reason for it.
 */
function refusalFor(code: string | undefined): string {
  if (code === "23505") return MEMBERS_COPY.alreadyInvited;
  if (code === "23514") return MEMBERS_COPY.lastOwner;
  if (code === "42501") return MEMBERS_COPY.ownerNeedsOwner;
  return MEMBERS_COPY.refused;
}

export async function createInvitation(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN);

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!EMAIL.test(email)) return { error: MEMBERS_COPY.badEmail, email, role };
  if (!isInvitable(role)) return { error: MEMBERS_COPY.badRole, email, role };
  if (email === user.email?.toLowerCase()) return { error: MEMBERS_COPY.ownEmail, email, role };

  const state = await readMembership(user.id);
  if (state.kind !== "ready") return { error: MEMBERS_COPY.unavailable, email, role };

  // ALREADY HERE IS NOT A DATABASE ERROR, so it is checked before the write rather than read out of
  // one. There is no unique constraint spanning `members` and `invitations` -- an address already
  // in the account would simply produce a second open invitation, which the recipient accepts to no
  // effect while the admin believes something changed.
  if (state.membership.members.some((member) => member.email.toLowerCase() === email)) {
    return { error: MEMBERS_COPY.alreadyMember, email, role };
  }

  const token = newInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  const { error } = await supabase.from("invitations").insert({
    organisation_id: state.membership.organisationId,
    email,
    role,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
  });

  if (error) return { error: refusalFor(error.code), email, role };

  revalidatePath("/members");

  // The link is returned, not redirected to. A token in a redirect target lands in browser history,
  // in every access log on the way, and in the `Referer` of the next request the page makes.
  return { link: invitationLink(siteUrl(process.env), token), email, role };
}

/**
 * Withdraw an invitation, remove a member, or change a member's role.
 *
 * ONE ACTION FOR THREE VERBS, because they share every line except the write itself, and three
 * copies of the session check is how one of them ends up without it.
 */
/**
 * DID THE WRITE ACTUALLY CHANGE A ROW.
 *
 * ROW-LEVEL SECURITY DOES NOT RAISE ON A WRITE IT DISALLOWS -- it removes the row from the
 * statement's view, so an `update` or `delete` a policy forbids returns success having touched
 * nothing. An id belonging to another organisation, a member somebody else removed a second
 * earlier, an invitation already accepted: all three come back with no error at all.
 *
 * Reporting those as done is the failure this repository is named against: the screen would say the
 * colleague was removed, the admin would believe it, and the colleague would still be reading the
 * figures. So every write asks for the rows it changed and refuses when there are none.
 */
function changedSomething(rows: unknown[] | null): boolean {
  return rows !== null && rows.length > 0;
}

export async function manageMembership(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN);

  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: MEMBERS_COPY.refused };

  if (intent === "withdraw") {
    // WITHDRAWN, NOT DELETED. `invitations` records that an address was invited and that the
    // invitation was taken back; deleting the row would erase the fact that the collection ever
    // happened, which is the record a person exercising a PDPA s.30 access request is entitled to
    // see. The partial unique index only covers OPEN invitations, so the address can be invited
    // again afterwards.
    const { data, error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id");
    if (error) return { error: refusalFor(error.code) };
    if (!changedSomething(data)) return { error: MEMBERS_COPY.refused };
  } else if (intent === "remove") {
    const { data, error } = await supabase.from("members").delete().eq("id", id).select("id");
    if (error) return { error: refusalFor(error.code) };
    if (!changedSomething(data)) return { error: MEMBERS_COPY.refused };
  } else if (intent === "role") {
    const role = String(formData.get("role") ?? "");
    if (!isRole(role)) return { error: MEMBERS_COPY.badRole };
    const { data, error } = await supabase
      .from("members")
      .update({ role })
      .eq("id", id)
      .select("id");
    if (error) return { error: refusalFor(error.code) };
    if (!changedSomething(data)) return { error: MEMBERS_COPY.refused };
  } else {
    return { error: MEMBERS_COPY.refused };
  }

  revalidatePath("/members");
  return { done: true };
}
