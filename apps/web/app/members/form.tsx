"use client";

import { useActionState } from "react";

import { INVITABLE_ROLES, MEMBERS_COPY, ROLE_DESCRIPTIONS, ROLE_LABELS } from "./_content";
import { type InviteState, createInvitation } from "./actions";

/**
 * THE INVITE FORM, AND THE ONE MOMENT THE LINK EXISTS.
 *
 * `state.link` is rendered exactly once -- in the response to the submission that created it. It is
 * held in no module variable, written to no storage, and gone on the next navigation. That is not a
 * limitation being apologised for: only a fingerprint of the token is stored, so nobody can recover
 * it afterwards, including us. The copy says so rather than leaving a customer to discover it by
 * looking for a "resend" button that cannot exist.
 *
 * THE NOTICE BESIDE IT IS NOT DECORATION. The person whose address was just typed in has agreed to
 * nothing and may not know this account exists. `MEMBERS_COPY.noticeBody` is what they are entitled
 * to be told, and while nothing can send mail it is the admin who has to tell them.
 */
export function InviteForm() {
  const [state, submit, pending] = useActionState<InviteState, FormData>(createInvitation, {});

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <label htmlFor="invite-email" className="text-ink block text-sm font-bold">
        {MEMBERS_COPY.emailLabel}
      </label>
      <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{MEMBERS_COPY.emailHint}</p>
      <input
        id="invite-email"
        name="email"
        type="email"
        required
        autoComplete="off"
        defaultValue={state.email ?? ""}
        className="border-line text-ink focus-visible:outline-accent mt-3 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
      />

      <fieldset className="mt-6">
        <legend className="text-ink text-sm font-bold">{MEMBERS_COPY.roleLabel}</legend>
        <div className="mt-3 grid gap-2">
          {INVITABLE_ROLES.map((role) => (
            <label key={role} className="border-line flex gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="role"
                value={role}
                defaultChecked={state.role === role}
                required
                className="mt-1"
              />
              <span>
                <span className="text-ink block text-sm font-bold">{ROLE_LABELS[role]}</span>
                <span className="text-ink-subtle block text-xs leading-[1.5]">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="border-line text-ink focus-visible:outline-accent mt-6 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
      >
        {pending ? MEMBERS_COPY.inviting : MEMBERS_COPY.invite}
      </button>

      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}

      {state.link === undefined ? null : (
        <div className="border-line mt-6 rounded-md border p-4">
          <p className="text-ink text-sm font-bold">{MEMBERS_COPY.linkHeading}</p>
          {/* `readOnly` and not `disabled`: a disabled input cannot be selected, and the whole
              purpose of this field is that its contents are copied out once. */}
          <input
            readOnly
            value={state.link}
            aria-label={MEMBERS_COPY.linkHeading}
            className="border-line text-ink mt-3 min-h-[46px] w-full rounded-md border px-3 font-mono text-xs"
          />
          <p className="text-ink-subtle mt-3 text-xs leading-[1.5]">{MEMBERS_COPY.linkBody}</p>
          <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">{MEMBERS_COPY.linkExpiry}</p>
          <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">{MEMBERS_COPY.noMail}</p>

          <p className="text-ink mt-4 text-sm font-bold">{MEMBERS_COPY.noticeHeading}</p>
          <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">{MEMBERS_COPY.noticeBody}</p>
        </div>
      )}
    </form>
  );
}
