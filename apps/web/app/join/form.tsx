"use client";

import Link from "next/link";
import { useActionState } from "react";

import { JOIN_COPY } from "./_content";
import { type JoinState, acceptInvitation } from "./actions";

/**
 * ACCEPTING IS A BUTTON, NOT A PAGE LOAD.
 *
 * A link that granted membership on GET would be accepted by every mail scanner, link preview
 * fetcher and corporate proxy that touched the message -- consuming the one-use invitation before
 * the person ever saw it, and recording an acceptance nobody made. The write happens on a POST that
 * a person has to press.
 */
export function JoinForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState<JoinState, FormData>(acceptInvitation, {});

  if (state.accepted === true) {
    return (
      <div className="border-line bg-surface rounded-xl border p-6 md:p-7">
        <p className="text-ink text-sm leading-[1.6]">{JOIN_COPY.accepted}</p>
        <Link
          href="/dashboard"
          className="border-line text-ink focus-visible:outline-accent mt-5 inline-flex min-h-[46px] items-center rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px]"
        >
          {JOIN_COPY.goToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
      <input type="hidden" name="token" value={token} />
      <p className="text-ink-muted text-sm leading-[1.6]">{JOIN_COPY.whatYouGet}</p>
      <button
        type="submit"
        disabled={pending}
        className="border-line text-ink focus-visible:outline-accent mt-5 min-h-[46px] rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-60"
      >
        {pending ? JOIN_COPY.accepting : JOIN_COPY.accept}
      </button>

      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-4 text-sm leading-[1.6]">
          {state.error}
        </p>
      )}
    </form>
  );
}
