"use client";

import { useActionState } from "react";

import { KEYS_COPY } from "./_content";
// A TYPE-ONLY IMPORT, AND NOT A STYLE PREFERENCE. `_keys.ts` imports `supabaseServer`, which
// imports `next/headers`. This file is a client component, so a value import of that module drags
// a server-only module into the browser bundle and the build fails -- which is exactly what it did.
// `import type` is erased before the bundler ever sees it.
import type { ApiKeyRow } from "./_keys";
import { type RevokeKeyState, revokeApiKey } from "./actions";

/**
 * THE LIST, AND THE THREE ABSENCES IT REFUSES TO RENDER AS NUMBERS.
 *
 * `lastUsedAt` null is "never used" and NOT a blank cell — a blank reads as a rendering fault, and
 * "never used" is the single most useful thing this table can tell somebody deciding what to
 * retire. `monthlyCreditBudget` null is "no ceiling set", which is a different fact from a ceiling
 * of zero and must never be shown as `0`. `allowedTools` empty means every tool, per the schema's
 * own comment, and is not a null meaning something else.
 *
 * DATES CARRY THEIR ZONE. There is no workspace timezone column to read, so the alternative to
 * naming the zone is resolving to whatever the runtime happens to be — which on this deploy target
 * is UTC, and which would show a key last used at 18:00 UTC as the previous day in Bangkok. The
 * same defect `/billing` was fixed for, and the same fix: say which zone, rather than guess one.
 */
const KEY_ZONE = "UTC";

function formatMoment(iso: string): string {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: KEY_ZONE }).format(
    new Date(iso),
  )} ${KEY_ZONE}`;
}

function statusOf(row: ApiKeyRow, now: number): string {
  if (row.revokedAt !== null) return KEYS_COPY.statusRevoked;
  if (row.expiresAt !== null && new Date(row.expiresAt).getTime() <= now) {
    return KEYS_COPY.statusExpired;
  }
  return KEYS_COPY.statusLive;
}

function RevokeButton({ id, disabled }: { readonly id: string; readonly disabled: boolean }) {
  const [state, submit, pending] = useActionState<RevokeKeyState, FormData>(revokeApiKey, {});

  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="border-line text-ink focus-visible:outline-accent min-h-[38px] rounded-md border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px] disabled:opacity-40"
      >
        {pending ? KEYS_COPY.revoking : KEYS_COPY.revokeButton}
      </button>
      {state.error === undefined ? null : (
        <p role="alert" className="text-ink mt-2 text-xs leading-[1.5]">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function KeyTable({
  keys,
  now,
}: {
  readonly keys: readonly ApiKeyRow[];
  readonly now: number;
}) {
  if (keys.length === 0) {
    return <p className="text-ink-muted text-sm leading-[1.6]">{KEYS_COPY.listEmpty}</p>;
  }

  return (
    <div className="border-line bg-surface overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-line border-b">
            <th className="text-ink-subtle px-5 py-3 text-xs font-bold">{KEYS_COPY.columnName}</th>
            <th className="text-ink-subtle px-5 py-3 text-xs font-bold">
              {KEYS_COPY.columnPrefix}
            </th>
            <th className="text-ink-subtle px-5 py-3 text-xs font-bold">{KEYS_COPY.columnUsed}</th>
            <th className="text-ink-subtle px-5 py-3 text-xs font-bold">
              {KEYS_COPY.columnBudget}
            </th>
            <th className="text-ink-subtle px-5 py-3 text-xs font-bold">
              {KEYS_COPY.columnStatus}
            </th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {keys.map((row) => (
            <tr key={row.id} className="border-line border-b last:border-b-0">
              <td className="text-ink px-5 py-3">{row.name}</td>
              <td className="text-ink px-5 py-3 font-mono text-xs">{row.keyPrefix}</td>
              <td className="text-ink-muted px-5 py-3 text-xs">
                {row.lastUsedAt === null ? KEYS_COPY.neverUsed : formatMoment(row.lastUsedAt)}
              </td>
              <td className="text-ink-muted px-5 py-3 text-xs">
                {row.monthlyCreditBudget === null
                  ? KEYS_COPY.noBudget
                  : `${row.creditsUsed} / ${row.monthlyCreditBudget}`}
              </td>
              <td className="text-ink-muted px-5 py-3 text-xs">{statusOf(row, now)}</td>
              <td className="px-5 py-3">
                <RevokeButton id={row.id} disabled={row.revokedAt !== null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
