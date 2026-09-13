"use client";

import { useActionState, useId, useState } from "react";

import { DATA_REQUESTS, REQUEST_KINDS } from "./_content";
import { fileRequest, type RequestState } from "./actions";

/**
 * THE FORM, AND THE TWO THINGS IT IS CAREFUL ABOUT.
 *
 * THE NOTE IS KEPT ACROSS A REFUSAL. It is not a secret -- the opposite of the credential form,
 * where clearing the field is the point -- and a person who has just written a paragraph about
 * what happened to their data should not have to write it again because a database was briefly
 * unreachable.
 *
 * NO DEADLINE IS RENDERED. `DATA_REQUESTS.pendingNote` says in words that no response time is
 * published, because `app.data_request_deadline()` returns NULL and nobody has established which
 * statutory period applies. A confident date here would be the exact failure this repository is
 * built to refuse, one step worse than usual because it would be shown to the person the
 * obligation is owed to.
 */
const LABEL = "text-ink block text-sm font-bold";
const INPUT =
  "border-line text-ink focus-visible:outline-accent mt-2 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]";
const HINT = "text-ink-subtle mt-2 text-xs leading-relaxed";

export function DataRequestForm() {
  const [state, submit, pending] = useActionState<RequestState, FormData>(fileRequest, {});
  const [kind, setKind] = useState<string>(state.kind ?? REQUEST_KINDS[0]);

  const kindField = useId();
  const noteField = useId();

  return (
    <form action={submit} className="mt-6">
      <label htmlFor={kindField} className={LABEL}>
        {DATA_REQUESTS.kindLabel}
      </label>
      <select
        id={kindField}
        name="kind"
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        className={INPUT}
      >
        {REQUEST_KINDS.map((id) => (
          <option key={id} value={id}>
            {DATA_REQUESTS.kindNames[id]}
          </option>
        ))}
      </select>

      <label htmlFor={noteField} className={`${LABEL} mt-6`}>
        {DATA_REQUESTS.noteLabel}
      </label>
      <textarea
        id={noteField}
        name="note"
        rows={4}
        maxLength={4000}
        defaultValue={state.note}
        className={`${INPUT} min-h-[112px] py-3 leading-relaxed`}
      />
      <p className={HINT}>{DATA_REQUESTS.noteHint}</p>
      <p className={HINT}>{DATA_REQUESTS.pendingNote}</p>

      {state.error === undefined ? null : (
        <p role="alert" className="text-accent-hover mt-6 text-xs font-bold leading-relaxed">
          {state.error}
          {state.reference === undefined ? null : (
            <span className="text-ink-subtle mt-2 block font-mono font-normal">
              {DATA_REQUESTS.referenceLabel} {state.reference}
            </span>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-ink-on-accent hover:bg-accent-hover mt-6 min-h-[46px] w-full rounded-md px-5 text-sm font-bold transition-colors disabled:opacity-60"
      >
        {pending ? DATA_REQUESTS.pending : DATA_REQUESTS.submit}
      </button>
    </form>
  );
}
