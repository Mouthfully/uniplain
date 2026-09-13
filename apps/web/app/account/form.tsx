"use client";

import { useActionState } from "react";

import { ACCOUNT_COPY } from "./_content";
import { type EraseState, eraseAccount } from "./actions";

/**
 * THE CLOSE BUTTON, AND THE THREE THINGS IT SAYS BEFORE IT LETS ANYBODY PRESS IT.
 *
 * What survives an erasure is printed ABOVE the control rather than under it. A customer pressing
 * this believes they are gone; two things are not, and a footnote after the fact is a sentence
 * nobody reads at the moment it matters.
 *
 * THE TYPED NAME IS NOT VALIDATED HERE. The screen does not compare it, does not trim it and does
 * not disable the button on a mismatch -- `delete_organisation` compares it exactly, and a second
 * copy of that rule in a client component is the one that eventually disagrees. What this does is
 * ask for it.
 */
export function EraseForm({
  organisationId,
  organisationName,
  isOwner,
}: {
  readonly organisationId: string;
  readonly organisationName: string;
  readonly isOwner: boolean;
}) {
  const [state, submit, pending] = useActionState<EraseState, FormData>(eraseAccount, {});

  if (state.done === true) {
    return (
      <p role="status" className="text-ink text-sm leading-[1.6]">
        {ACCOUNT_COPY.eraseDone}
      </p>
    );
  }

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <p className="text-ink-muted text-sm leading-[1.6]">{ACCOUNT_COPY.eraseBody}</p>

      <p className="text-ink mt-5 text-sm font-bold">{ACCOUNT_COPY.eraseSurvives}</p>
      <ul className="text-ink-subtle mt-2 grid gap-2 text-xs leading-[1.5]">
        <li>{ACCOUNT_COPY.eraseSurvivesLogin}</li>
        <li>{ACCOUNT_COPY.eraseSurvivesBilling}</li>
      </ul>

      {isOwner ? (
        <>
          <input type="hidden" name="organisation" value={organisationId} />
          <label htmlFor="confirmation" className="text-ink mt-6 block text-sm font-bold">
            {ACCOUNT_COPY.eraseConfirmLabel}
          </label>
          <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">
            {ACCOUNT_COPY.eraseConfirmHint}
          </p>
          {/* The name is shown as text the customer must reproduce, and is NOT the input's
              placeholder or default value: a confirmation you can submit by pressing return is not
              a confirmation. */}
          <p className="text-ink mt-2 font-mono text-sm">{organisationName}</p>
          <input
            id="confirmation"
            name="confirmation"
            type="text"
            required
            autoComplete="off"
            spellCheck={false}
            className="border-line text-ink focus-visible:outline-accent mt-2 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
          />
          <button
            type="submit"
            disabled={pending}
            className="border-line text-ink focus-visible:outline-accent mt-5 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
          >
            {pending ? ACCOUNT_COPY.erasing : ACCOUNT_COPY.eraseButton}
          </button>
        </>
      ) : (
        <p className="text-ink-subtle mt-5 text-sm leading-[1.6]">{ACCOUNT_COPY.ownerOnly}</p>
      )}

      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}
    </form>
  );
}
