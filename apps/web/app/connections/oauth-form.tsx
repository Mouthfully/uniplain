"use client";

import { useActionState, useId, useState } from "react";

import { CONNECTIONS } from "../_content";
import { MAX_ACCOUNT } from "./_oauth";
import { OAUTH_ONLY_PROVIDERS } from "./_providers";
import { beginAuthorization, type OAuthStartState } from "./oauth-actions";

/**
 * THE OTHER KIND OF CONNECTION, AND THE DIFFERENCE MADE VISIBLE RATHER THAN IMPLIED.
 *
 * A customer on this screen is being asked for two different things by two different forms, and the
 * difference is a promise about where their secret goes. The form above takes a key they already
 * hold and sends it once, to be sealed. This one takes NO SECRET AT ALL: there is no password
 * field, nothing is pasted, and the only thing typed is the name of the account. What it does
 * instead is leave -- the customer grants read access on the provider's own screen, and the
 * permission that comes back is exchanged and sealed without ever passing through a form.
 *
 * SO THE TWO ARE SEPARATE SECTIONS WITH SEPARATE WORDS, not one select with six options. A single
 * list would put "paste your consumer secret" and "you will be taken to Google" behind the same
 * control, and the customer would learn which promise applies only after choosing.
 *
 * WHY THERE IS NO CREDENTIAL FIELD HERE TO GET WRONG: `POST /v1/connections` refuses a body naming
 * the oauth lane, deliberately, because accommodating it would mean fabricating a token response
 * out of a pasted string. Loyverse is the case that proves the rule -- it does issue a pasteable
 * token, and `PROVIDER_LANES.loyverse` is `["oauth"]` as a refusal, because that token is described
 * by the platform as giving unlimited access to the account, which on that API includes writing
 * receipts and inventory. This product reads. It should not hold a credential that can write.
 */

const LABEL = "text-ink block text-sm font-bold";
const INPUT =
  "border-line text-ink focus-visible:outline-accent mt-2 min-h-[46px] w-full rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]";
const HINT = "text-ink-subtle mt-2 text-xs leading-relaxed";

export function OAuthStartForm() {
  const [state, submit, pending] = useActionState<OAuthStartState, FormData>(
    beginAuthorization,
    {},
  );
  const first = OAUTH_ONLY_PROVIDERS[0];
  const [providerId, setProviderId] = useState<string>(state.provider ?? first ?? "");

  const providerField = useId();
  const accountField = useId();

  const copy = CONNECTIONS.oauthFields[providerId];
  // `_oauth-providers.test.ts` asserts every offered source has these words, so this is the
  // unreachable branch rather than a fallback: a blank label on a field that decides which account
  // a connection reads is worse than no field.
  if (copy === undefined) return null;

  return (
    <form action={submit} className="mt-6">
      <label htmlFor={providerField} className={LABEL}>
        {CONNECTIONS.providerLabel}
      </label>
      <select
        id={providerField}
        name="provider"
        value={providerId}
        onChange={(event) => setProviderId(event.target.value)}
        className={INPUT}
      >
        {OAUTH_ONLY_PROVIDERS.map((id) => (
          <option key={id} value={id}>
            {CONNECTIONS.providerNames[id] ?? id}
          </option>
        ))}
      </select>

      <label htmlFor={accountField} className={`${LABEL} mt-6`}>
        {copy.accountLabel}
      </label>
      <input
        id={accountField}
        name="external_account_id"
        required
        maxLength={MAX_ACCOUNT}
        // Kept across a refusal, unlike the credential fields on the form above: this is not a
        // secret, and a merchant who has just looked up a property id should not look it up twice.
        defaultValue={state.account}
        autoComplete="off"
        spellCheck={false}
        className={INPUT}
      />
      <p className={HINT}>{copy.accountHint}</p>
      <p className={HINT}>{CONNECTIONS.oauthAccountNote}</p>

      {state.error === undefined ? null : (
        <p role="alert" className="text-accent-hover mt-6 text-xs font-bold leading-relaxed">
          {state.error}
          {state.reference === undefined ? null : (
            <span className="text-ink-subtle mt-2 block font-mono font-normal">
              {CONNECTIONS.referenceLabel} {state.reference}
            </span>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-ink-on-accent hover:bg-accent-hover mt-6 min-h-[46px] w-full rounded-md px-5 text-sm font-bold transition-colors disabled:opacity-60"
      >
        {pending ? CONNECTIONS.oauthPending : CONNECTIONS.oauthSubmit}
      </button>

      <p className={HINT}>{CONNECTIONS.oauthLeaveNote}</p>
    </form>
  );
}
