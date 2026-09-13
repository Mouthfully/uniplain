"use client";

import { useActionState } from "react";

import { ACCOUNT_COPY } from "./_content";
import { type SessionRevokeState, signOutOtherSessions } from "./session-actions";

/**
 * THE CONTROL FOR EVERY DEVICE THIS SCREEN CANNOT SHOW YOU.
 *
 * The two sentences above the button are the ones that matter, and they are both admissions: the
 * list cannot be shown, and the revoke is not instant. They are rendered BEFORE the control rather
 * than after it, for the reason `form.tsx` records about erasure -- a person who has pressed this
 * believes the other devices are out, and a footnote read afterwards is a sentence nobody reads at
 * the moment it counts.
 *
 * THE BUTTON STAYS AFTER IT SUCCEEDS, and that is deliberate. A person who sells a phone, then
 * remembers the laptop, needs to press it again; replacing the form with a receipt would make the
 * second press require a page reload they have no reason to know about. The confirmation appears
 * beside it instead.
 */
export function SessionForm() {
  const [state, submit, pending] = useActionState<SessionRevokeState, FormData>(
    signOutOtherSessions,
    {},
  );

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <p className="text-ink-muted text-sm leading-[1.6]">{ACCOUNT_COPY.sessionsBody}</p>

      <ul className="text-ink-subtle mt-4 grid gap-2 text-xs leading-[1.5]">
        <li>{ACCOUNT_COPY.sessionsNoList}</li>
        <li>{ACCOUNT_COPY.sessionsNotInstant}</li>
      </ul>

      <button
        type="submit"
        disabled={pending}
        className="border-line text-ink focus-visible:outline-accent mt-5 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
      >
        {pending ? ACCOUNT_COPY.sessionsWorking : ACCOUNT_COPY.sessionsButton}
      </button>

      {state.done === true ? (
        <p role="status" className="text-ink mt-4 text-sm leading-[1.6]">
          {ACCOUNT_COPY.sessionsDone}
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
