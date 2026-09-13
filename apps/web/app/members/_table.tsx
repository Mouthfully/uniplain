"use client";

import { useActionState } from "react";

import { ALL_ROLES, MEMBERS_COPY, ROLE_LABELS, type MemberRole } from "./_content";
import type { InvitationRow, MemberRow, TrailRow } from "./_members";
import { type ManageState, manageMembership } from "./actions";

/**
 * THE LIST, AND WHY EVERY BUTTON ON IT IS STILL ONLY A SUGGESTION.
 *
 * What this component offers is a function of `ownRole`, and what the database ALLOWS is decided by
 * `members_update`, `members_delete` and the two triggers in
 * `20260913000600_membership_guards.sql`. Those are not the same thing and are not meant to be: a
 * hidden button is a courtesy to somebody who cannot do something, never a control. An admin who
 * reconstructs the form by hand and posts it is refused by the database, and
 * `18_membership_guards.sql` proves that against a real `authenticated` session rather than against
 * this markup.
 *
 * So the rules here are allowed to be approximate, and are written to be generous rather than
 * strict: showing a control that the database then refuses produces one clear sentence; hiding one
 * the database would have allowed produces a customer who believes the product cannot do it.
 */

function canManage(ownRole: MemberRole): boolean {
  return ownRole === "owner" || ownRole === "admin";
}

/**
 * ONE ENTRY IN THE TRAIL, PHRASED FOR A PERSON RATHER THAN AN ENUM.
 *
 * `event` is `member_role_changed` or `member_removed`. Neither is a sentence, and printing the
 * enum would be the same failure as printing a database error at somebody: technically complete and
 * addressed to the wrong reader.
 */
function trailSentence(entry: TrailRow): string {
  return entry.event === "member_removed"
    ? MEMBERS_COPY.trailMemberRemoved
    : MEMBERS_COPY.trailRoleChanged;
}

export function MemberTable({
  members,
  invitations,
  ownRole,
  trail,
}: {
  readonly members: readonly MemberRow[];
  readonly invitations: readonly InvitationRow[] | null;
  readonly ownRole: MemberRole;
  readonly trail: readonly TrailRow[] | null;
}) {
  const [state, submit, pending] = useActionState<ManageState, FormData>(manageMembership, {});
  const manage = canManage(ownRole);

  return (
    <>
      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mb-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}

      <h2 className="text-ink text-sm font-bold">{MEMBERS_COPY.membersHeading}</h2>
      <div className="border-line mt-3 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                {MEMBERS_COPY.emailColumn}
              </th>
              <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                {MEMBERS_COPY.roleColumn}
              </th>
              <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                {MEMBERS_COPY.joinedColumn}
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">{MEMBERS_COPY.remove}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.memberId} className="border-line border-b last:border-0">
                <td className="text-ink px-4 py-3">{member.email}</td>
                <td className="text-ink-muted px-4 py-3">
                  {manage ? (
                    <form action={submit} className="flex gap-2">
                      <input type="hidden" name="intent" value="role" />
                      <input type="hidden" name="id" value={member.memberId} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        aria-label={`${MEMBERS_COPY.roleColumn} — ${member.email}`}
                        className="border-line text-ink rounded-md border px-2 py-1 text-xs"
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={pending}
                        className="border-line text-ink rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-60"
                      >
                        {pending ? MEMBERS_COPY.changing : MEMBERS_COPY.changeRole}
                      </button>
                    </form>
                  ) : (
                    ROLE_LABELS[member.role]
                  )}
                </td>
                <td className="text-ink-subtle px-4 py-3 text-xs">
                  {member.createdAt.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-right">
                  {manage ? (
                    <form action={submit}>
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="id" value={member.memberId} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="border-line text-ink rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-60"
                      >
                        {pending ? MEMBERS_COPY.removing : MEMBERS_COPY.remove}
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-ink mt-10 text-sm font-bold">{MEMBERS_COPY.trailHeading}</h2>
      <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">{MEMBERS_COPY.trailNote}</p>

      {/* NULL IS NOT AN EMPTY LIST HERE EITHER, and the distinction matters more than usual: a page
          that answers "what happened" must not answer "nothing" when it means "I could not tell". */}
      {trail === null ? (
        <p className="text-ink mt-3 text-sm leading-[1.6]">{MEMBERS_COPY.trailUnavailable}</p>
      ) : trail.length === 0 ? (
        <p className="text-ink-subtle mt-3 text-sm">{MEMBERS_COPY.trailEmpty}</p>
      ) : (
        <>
          <ul className="border-line mt-3 grid gap-0 rounded-xl border">
            {trail.map((entry) => (
              <li
                key={entry.id}
                className="border-line flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3 last:border-0"
              >
                <span className="text-ink text-sm font-bold">{trailSentence(entry)}</span>
                <span className="text-ink-muted text-sm">
                  {entry.subjectLabel ?? MEMBERS_COPY.trailRemovedSubject}
                </span>
                {entry.detail === null ? null : (
                  <span className="text-ink-subtle text-xs">{entry.detail}</span>
                )}
                <time dateTime={entry.occurredAt} className="text-ink-faint ml-auto text-xs">
                  {entry.occurredAt.slice(0, 10)}
                </time>
              </li>
            ))}
          </ul>
          <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">
            {MEMBERS_COPY.trailAnonymousNote}
          </p>
        </>
      )}

      {/* NULL IS NOT AN EMPTY LIST. A viewer cannot read `invitations` at all, so the section is
          absent rather than empty -- "nothing is waiting" is a claim this page cannot make to them. */}
      {invitations === null ? null : (
        <>
          <h2 className="text-ink mt-10 text-sm font-bold">{MEMBERS_COPY.invitationsHeading}</h2>
          {invitations.length === 0 ? (
            <p className="text-ink-subtle mt-3 text-sm">{MEMBERS_COPY.noInvitations}</p>
          ) : (
            <div className="border-line mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-line border-b">
                    <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                      {MEMBERS_COPY.emailColumn}
                    </th>
                    <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                      {MEMBERS_COPY.roleColumn}
                    </th>
                    <th scope="col" className="text-ink-faint px-4 py-3 text-xs font-bold">
                      {MEMBERS_COPY.expiresColumn}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">{MEMBERS_COPY.withdraw}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="border-line border-b last:border-0">
                      <td className="text-ink px-4 py-3">{invitation.email}</td>
                      <td className="text-ink-muted px-4 py-3">{ROLE_LABELS[invitation.role]}</td>
                      <td className="text-ink-subtle px-4 py-3 text-xs">
                        {invitation.expiresAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={submit}>
                          <input type="hidden" name="intent" value="withdraw" />
                          <input type="hidden" name="id" value={invitation.id} />
                          <button
                            type="submit"
                            disabled={pending}
                            className="border-line text-ink rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-60"
                          >
                            {pending ? MEMBERS_COPY.withdrawing : MEMBERS_COPY.withdraw}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
