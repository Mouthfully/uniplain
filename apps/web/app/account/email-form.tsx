"use client";

import { useActionState } from "react";

import { ACCOUNT_COPY } from "./_content";
import { type EmailChangeState, changeSignInEmail } from "./email-actions";

/**
 * THE FORM THAT MOVES AN ACCOUNT TO A DIFFERENT ADDRESS.
 *
 * THE PENDING CHANGE IS RENDERED FROM THE SERVER'S `new_email`, NOT FROM THIS FORM'S OWN STATE.
 * A person who requests a change and then reloads the page -- or comes back tomorrow, or opens it
 * on their phone -- would otherwise see no sign that anything is outstanding, request it again,
 * and invalidate the pair of links they are in the middle of confirming. The one thing this screen
 * has to be right about is what is currently true of the account, and only the auth server knows
 * that.
 *
 * `requested` from the action is still shown, because a form that accepts a submission and renders
 * nothing back reads as a failure. The two coexist: the action's own acknowledgement for the
 * submission just made, and the server's `new_email` for the state of the account.
 *
 * THE ADDRESS IS NOT VALIDATED HERE BEYOND `type="email"`. `checkWorkEmail` runs in the action,
 * where it cannot be skipped by posting the form without ever loading this file -- the same split
 * `_auth/actions.ts` records for sign-in. A second copy of the domain rule in a client component is
 * the one that eventually disagrees with the one that counts.
 */
export function EmailForm({
  currentEmail,
  pendingEmail,
}: {
  readonly currentEmail: string | null;
  /** `user.new_email`: a change the auth server is holding until both mailboxes confirm. */
  readonly pendingEmail: string | null;
}) {
  const [state, submit, pending] = useActionState<EmailChangeState, FormData>(
    changeSignInEmail,
    {},
  );

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <p className="text-ink-muted text-sm leading-[1.6]">{ACCOUNT_COPY.emailBody}</p>

      {currentEmail === null ? null : (
        <p className="text-ink-subtle mt-5 text-xs leading-[1.5]">
          {ACCOUNT_COPY.emailCurrent} <span className="text-ink font-mono">{currentEmail}</span>
        </p>
      )}

      {pendingEmail === null ? null : (
        <div className="border-line mt-5 rounded-lg border border-dashed p-4">
          <p className="text-ink text-sm font-bold">{ACCOUNT_COPY.emailPendingHeading}</p>
          <p className="text-ink mt-2 font-mono text-sm">{pendingEmail}</p>
          <p className="text-ink-subtle mt-2 text-xs leading-[1.5]">
            {ACCOUNT_COPY.emailPendingBody}
          </p>
        </div>
      )}

      <p className="text-ink-subtle mt-5 text-sm leading-[1.6]">{ACCOUNT_COPY.emailBothConfirm}</p>

      <label htmlFor="new-email" className="text-ink mt-6 block text-sm font-bold">
        {ACCOUNT_COPY.emailLabel}
      </label>
      <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{ACCOUNT_COPY.emailHint}</p>
      <input
        id="new-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        spellCheck={false}
        // React 19 resets an uncontrolled field after a form action, restoring `defaultValue` --
        // so a refusal keeps what was typed rather than making the person retype it, and an
        // accepted request empties the box rather than leaving an address that is now in flight
        // sitting under a button that would send a second pair of links and cancel the first.
        defaultValue={state.requested === true ? "" : (state.email ?? "")}
        className="border-line text-ink focus-visible:outline-accent mt-2 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
      />

      <button
        type="submit"
        disabled={pending}
        className="border-line text-ink focus-visible:outline-accent mt-5 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
      >
        {pending ? ACCOUNT_COPY.emailSending : ACCOUNT_COPY.emailSubmit}
      </button>

      {state.requested === true ? (
        <p role="status" className="text-ink mt-4 text-sm leading-[1.6]">
          {ACCOUNT_COPY.emailRequested}
        </p>
      ) : null}

      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}
    </form>
  );
}
