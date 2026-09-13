"use client";

import { useActionState } from "react";

import { KEYS_COPY } from "./_content";
import { type CreateKeyState, createApiKey } from "./actions";

/**
 * THE FORM THAT MAKES A CREDENTIAL, AND THE PANEL THAT SHOWS IT ONCE.
 *
 * THE WARNING IS ABOVE THE BUTTON. A person who misses "you will see this once" closes the panel
 * and is left with a row in a table naming a key nobody holds — recoverable only by retiring it and
 * making another, which is exactly the kind of small avoidable humiliation that makes a customer
 * stop trusting a screen.
 *
 * THE KEY IS RENDERED AS TEXT IN A `<code>`, NOT IN AN INPUT. An input invites a browser or a
 * password manager to remember it, and the whole design of this page is that nothing remembers it.
 * There is no copy button for the same reason a copy button would need the value in a click
 * handler: selecting the text is a browser affordance that costs the page nothing.
 */
export function CreateKeyForm() {
  const [state, submit, pending] = useActionState<CreateKeyState, FormData>(createApiKey, {});

  if (state.key !== undefined) {
    return (
      <div className="border-line bg-surface rounded-xl border p-6 md:p-7">
        <p className="text-ink text-sm font-bold">{KEYS_COPY.revealHeading}</p>
        <p className="text-ink-muted mt-2 text-sm leading-[1.6]">{KEYS_COPY.revealBody}</p>
        <code className="text-ink border-line mt-4 block overflow-x-auto rounded-md border px-4 py-3 font-mono text-sm break-all">
          {state.key}
        </code>
      </div>
    );
  }

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <p className="text-ink-muted text-sm leading-[1.6]">{KEYS_COPY.createBody}</p>
      <p className="text-ink mt-4 text-sm leading-[1.6]">{KEYS_COPY.createOnce}</p>

      <label htmlFor="key-name" className="text-ink mt-6 block text-sm font-bold">
        {KEYS_COPY.nameLabel}
      </label>
      <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{KEYS_COPY.nameHint}</p>
      <input
        id="key-name"
        name="name"
        type="text"
        required
        maxLength={120}
        autoComplete="off"
        defaultValue={state.name ?? ""}
        className="border-line text-ink focus-visible:outline-accent mt-2 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
      />

      <button
        type="submit"
        disabled={pending}
        className="border-line text-ink focus-visible:outline-accent mt-5 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
      >
        {pending ? KEYS_COPY.creating : KEYS_COPY.createButton}
      </button>

      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}
    </form>
  );
}
