import { supabaseServer } from "../_auth/server";
import type { MemberRole } from "./_content";

/**
 * WHO IS IN THIS ACCOUNT, READ THE WAY THE REST OF THE APP READS THINGS.
 *
 * Three branches, none of them a number: `ready`, `needsOrganisation`, `unavailable`. That shape is
 * `_figures.ts`'s rule applied to a list -- a failed read must not arrive as an empty array, because
 * "nobody is in this account" and "the list could not be read" render identically and mean opposite
 * things. An admin who sees the first when the second is true removes a colleague who is still
 * there, or invites one who already is.
 *
 * THE MEMBER LIST COMES FROM AN RPC AND THE INVITATION LIST FROM THE TABLE, AND THAT ASYMMETRY IS
 * THE POINT. `members` holds `user_id` and nothing a person would recognise, and `authenticated`
 * holds no grant on `auth.users` -- correctly, since a tenant role able to read it could enumerate
 * every user of the platform. `public.organisation_members` is the one definer function that joins
 * the address, and it returns no user id at all. `invitations` already holds the address it was
 * sent to, so it needs no such hop; `invitations_select` restricts it to admins, which is why a
 * viewer's page shows members and no invitations rather than an error.
 */

export interface MemberRow {
  readonly memberId: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly createdAt: string;
}

/**
 * One entry in the membership trail.
 *
 * `subjectLabel` IS RESOLVED HERE AND CAN BE NULL, which is the honest shape rather than a
 * convenience. `security_events.subject_id` is an opaque member id and not an address -- deliberately,
 * because the trail has no retention period and an address here would be a store of identifiers
 * nothing expires. So a member still in the account resolves to their address, and one who has been
 * removed does not resolve at all. The screen says which; it does not invent a name.
 */
export interface TrailRow {
  readonly id: number;
  readonly event: string;
  readonly detail: string | null;
  readonly occurredAt: string;
  readonly subjectLabel: string | null;
  readonly actorLabel: string | null;
}

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface Membership {
  readonly organisationId: string;
  readonly organisationName: string;
  /** The signed-in person's own role, which decides what the page offers rather than what it shows. */
  readonly ownRole: MemberRole;
  readonly members: readonly MemberRow[];
  /**
   * NULL MEANS "NOT SHOWN TO YOU", NOT "THERE ARE NONE". A viewer cannot read `invitations` at all,
   * and an empty array would tell them there is nothing waiting -- a claim this code cannot make.
   */
  readonly invitations: readonly InvitationRow[] | null;
  /**
   * NULL MEANS THE TRAIL COULD NOT BE READ, not that nothing has happened. An empty array is a real
   * answer -- a young account where nobody has changed anything -- and the two must not render the
   * same way on a page whose whole purpose is answering "what happened here".
   */
  readonly trail: readonly TrailRow[] | null;
}

export type MembershipState =
  | { readonly kind: "ready"; readonly membership: Membership }
  | { readonly kind: "needsOrganisation" }
  | { readonly kind: "unavailable"; readonly reason: string };

export async function readMembership(userId: string): Promise<MembershipState> {
  const supabase = await supabaseServer();

  // No predicate: row-level security returns exactly the organisations this session belongs to.
  // A `.eq("user_id", …)` here would be a second place tenancy is decided, and the one that
  // eventually disagrees with the policy -- the house rule `_auth/workspace.ts` sets out.
  const { data: orgs, error: orgError } = await supabase
    .from("organisations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) return { kind: "unavailable", reason: orgError.code ?? "unknown" };
  const organisation = orgs?.[0];
  if (!organisation) return { kind: "needsOrganisation" };

  // The caller's OWN role. This one does filter by user id, and that is not a tenancy decision:
  // RLS has already decided which rows are visible, and this picks the reader's own out of them.
  const { data: own, error: ownError } = await supabase
    .from("members")
    .select("role")
    .eq("organisation_id", organisation.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownError) return { kind: "unavailable", reason: ownError.code ?? "unknown" };
  if (!own) return { kind: "unavailable", reason: "not_a_member" };

  const { data: rows, error: membersError } = await supabase.rpc("organisation_members", {
    p_organisation_id: organisation.id,
  });

  if (membersError) return { kind: "unavailable", reason: membersError.code ?? "unknown" };
  if (!rows) return { kind: "unavailable", reason: "no_rows" };

  const members: MemberRow[] = (rows as RawMember[]).map((row) => ({
    memberId: row.member_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));

  // AN ADMIN-ONLY READ, AND ITS REFUSAL IS NOT AN ERROR. `invitations_select` is gated on
  // `app.is_org_admin`, so a viewer gets zero rows rather than a failure -- indistinguishable from
  // an account with nothing pending. The role is what separates them, so the role decides whether
  // the query runs at all.
  let invitations: InvitationRow[] | null = null;
  if (own.role === "owner" || own.role === "admin") {
    const { data: open, error: inviteError } = await supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("organisation_id", organisation.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: true });

    if (inviteError) return { kind: "unavailable", reason: inviteError.code ?? "unknown" };
    invitations = (open ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      role: row.role as MemberRole,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
    }));
  }

  // THE MEMBERSHIP TRAIL. Readable by any member -- `security_events_select` is gated on
  // `app.is_org_member`, not on admin -- so it is not behind the role check the invitations are.
  // Bounded at fifty: this is the recent history a person checks after something changed, not an
  // export, and an unbounded read on a table that only grows is a page that gets slower for ever.
  let trail: TrailRow[] | null = null;
  const { data: events, error: trailError } = await supabase
    .from("security_events")
    .select("id, event, detail, occurred_at, subject_id, actor")
    .eq("organisation_id", organisation.id)
    .in("event", MEMBERSHIP_EVENTS)
    .order("id", { ascending: false })
    .limit(50);

  if (trailError === null) {
    const byMemberId = new Map(members.map((member) => [member.memberId, member.email]));
    trail = (events ?? []).map((row) => ({
      id: row.id as number,
      event: row.event as string,
      detail: (row.detail as string | null) ?? null,
      occurredAt: row.occurred_at as string,
      // Resolves while the person is still here, and null once they are not. See `TrailRow`.
      subjectLabel: byMemberId.get(row.subject_id as string) ?? null,
      // The actor is an auth user id, which this app has no read path for at all -- the whole point
      // of `organisation_members`. It resolves only when the actor is themselves a current member,
      // which is the common case and the only one that can be answered honestly here.
      actorLabel: null,
    }));
  }

  return {
    kind: "ready",
    membership: {
      organisationId: organisation.id as string,
      organisationName: organisation.name as string,
      ownRole: own.role as MemberRole,
      members,
      invitations,
      trail,
    },
  };
}

/**
 * The events this screen shows.
 *
 * NAMED RATHER THAN "everything for this organisation". `security_events` carries connection,
 * credential and API-key events too, and a members page listing a credential being sealed would be
 * a different page wearing this one's title.
 */
const MEMBERSHIP_EVENTS = ["member_role_changed", "member_removed"] as const;

/** The row shape `public.organisation_members` returns. Named so the mapping above stays readable. */
interface RawMember {
  readonly member_id: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly created_at: string;
}
