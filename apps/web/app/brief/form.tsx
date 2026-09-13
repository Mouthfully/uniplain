"use client";

import { BUSINESS_TYPES, type Figure } from "@repo/insights";
import { useActionState } from "react";

import { BRIEF_COPY, BUSINESS_LABELS } from "./_content";
import { type BriefState, generateBrief } from "./actions";

/**
 * THE ONLY CLIENT COMPONENT ON THIS SURFACE, and it holds no data of its own.
 *
 * Everything that decides anything -- the read, the arithmetic, the prompt, the gate -- runs in the
 * server action. This file submits a form and renders whichever `BriefState` comes back. That
 * matters for one reason beyond tidiness: `OPENROUTER_API_KEY` and `INSIGHT_TENANT_SALT` are read
 * inside the action and never appear in any value it returns, so neither can reach the browser
 * bundle however this component is edited.
 *
 * EVERY STATE IS RENDERED, AND NONE OF THEM IS SWALLOWED. There is no `default:` that shows a
 * shrug. The refusal state in particular is given the most space on the page, because a customer
 * who never sees a refusal has no reason to believe the figures they do see.
 */
export function BriefForm({ today }: { today: string }) {
  const [state, submit, pending] = useActionState<BriefState, FormData>(generateBrief, {
    kind: "idle",
  });

  return (
    <>
      <form action={submit} className="border-line bg-surface rounded-xl border p-6 md:p-7">
        {/* The date the period is derived from, computed on the server. It is a hidden field rather
            than a clock read inside the action so that the period a brief covers is an input to it,
            reconstructible afterwards from the form that produced it. */}
        <input type="hidden" name="today" value={today} />

        <label htmlFor="business" className="text-ink block text-sm font-bold">
          {BRIEF_COPY.businessLabel}
        </label>
        <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{BRIEF_COPY.businessHint}</p>

        <div className="mt-3 flex flex-wrap gap-3">
          <select
            id="business"
            name="business"
            required
            defaultValue=""
            className="border-line text-ink focus-visible:outline-accent min-h-[46px] min-w-[200px] flex-1 rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
          >
            {/* NO PRE-SELECTED TYPE. An owner who never touches this control must not silently get
                a cafe's layout, so the empty option is the initial value and the field is required. */}
            <option value="" disabled>
              {BRIEF_COPY.businessPlaceholder}
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {BUSINESS_LABELS[type]}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-on-accent hover:bg-accent-hover min-h-[46px] rounded-md px-6 text-sm font-bold transition-colors disabled:opacity-60"
          >
            {pending ? BRIEF_COPY.submitting : BRIEF_COPY.submit}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <BriefResult state={state} />
      </div>
    </>
  );
}

function Notice({
  heading,
  body,
  detail,
  tone = "neutral",
}: {
  heading: string;
  body: string;
  detail?: string;
  tone?: "neutral" | "refusal";
}) {
  return (
    <div
      role="status"
      className={`rounded-xl border p-6 ${
        tone === "refusal" ? "border-accent bg-surface" : "border-line bg-surface-subtle"
      }`}
    >
      <p className="text-ink text-sm font-bold">{heading}</p>
      <p className="text-ink-muted mt-2 text-sm leading-[1.65]">{body}</p>
      {detail === undefined ? null : (
        // The engine's own code and detail, verbatim. A customer reporting a problem can quote it,
        // and a developer can match it to a named refusal rather than to a paraphrase.
        <p className="text-ink-faint mt-3 font-mono text-xs break-words">{detail}</p>
      )}
    </div>
  );
}

function BriefResult({ state }: { state: BriefState }) {
  switch (state.kind) {
    case "idle":
      return <p className="text-ink-muted text-sm">{BRIEF_COPY.idle}</p>;
    case "signed_out":
      return <p className="text-ink-muted text-sm">{BRIEF_COPY.signedOut}</p>;
    case "no_workspace":
      return <p className="text-ink-muted text-sm">{BRIEF_COPY.noWorkspace}</p>;
    case "no_business_type":
      return <p className="text-ink-muted text-sm">{BRIEF_COPY.noBusinessType}</p>;
    case "not_configured":
      return (
        <Notice
          heading={BRIEF_COPY.notConfiguredHeading}
          body={BRIEF_COPY.notConfiguredBody}
          detail={state.missing.join(", ")}
        />
      );
    case "rows_unreadable":
      return (
        <Notice
          heading={BRIEF_COPY.rowsUnreadableHeading}
          body={BRIEF_COPY.rowsUnreadableBody}
          detail={state.detail}
        />
      );
    case "too_many_rows":
      return (
        <Notice
          heading={BRIEF_COPY.tooManyRowsHeading}
          body={BRIEF_COPY.tooManyRowsBody}
          detail={state.detail}
        />
      );
    case "figures_refused":
      return (
        <Notice
          heading={BRIEF_COPY.figuresRefusedHeading}
          body={BRIEF_COPY.figuresRefusedBody}
          detail={`${state.code}: ${state.detail}`}
        />
      );
    case "model_failed":
      return (
        <Notice
          heading={BRIEF_COPY.modelFailedHeading}
          body={BRIEF_COPY.modelFailedBody}
          detail={`${state.code}: ${state.detail}`}
        />
      );
    case "refused":
      return (
        <div className="border-accent bg-surface rounded-xl border p-6">
          <p className="text-ink text-sm font-bold">{BRIEF_COPY.refusedHeading}</p>
          <p className="text-ink-muted mt-2 text-sm leading-[1.65]">{BRIEF_COPY.refusedBody}</p>
          <p className="text-ink-muted mt-3 text-sm leading-[1.65]">
            {BRIEF_COPY.refusedReassurance}
          </p>
          <p className="text-ink-faint mt-3 font-mono text-xs break-words">
            {`${state.code}: ${state.detail}`}
          </p>
        </div>
      );
    case "ready":
      return <Brief state={state} />;
  }
}

function Brief({ state }: { state: Extract<BriefState, { kind: "ready" }> }) {
  return (
    <article className="border-line bg-surface rounded-xl border p-6 md:p-8">
      <p className="text-ink-faint text-xs">
        {BRIEF_COPY.periodLabel}
        {": "}
        {state.period.from}
        {" – "}
        {state.period.to}
      </p>

      <ol className="mt-4 space-y-2">
        {state.summary.map((line) => (
          <li key={line} className="text-ink text-[17px] leading-[1.6]">
            {line}
          </li>
        ))}
      </ol>

      {state.unusual === null ? null : (
        <div className="border-line mt-6 border-t pt-5">
          <p className="text-ink-faint text-xs font-bold tracking-[0.14em] uppercase">
            {BRIEF_COPY.unusualHeading}
          </p>
          <p className="text-ink mt-2 leading-[1.65]">{state.unusual}</p>
        </div>
      )}

      {state.action === null ? null : (
        <div className="border-line mt-6 border-t pt-5">
          <p className="text-ink-faint text-xs font-bold tracking-[0.14em] uppercase">
            {BRIEF_COPY.actionHeading}
          </p>
          <p className="text-ink mt-2 font-bold">{state.action.title}</p>
          <p className="text-ink-muted mt-1 leading-[1.65]">{state.action.why}</p>
        </div>
      )}

      <Provenance figures={state.figures} />

      {state.servedBy === null ? null : (
        <p className="text-ink-faint mt-5 text-xs">
          {BRIEF_COPY.servedByLabel}
          {": "}
          {state.servedBy}
        </p>
      )}
    </article>
  );
}

/**
 * WHERE EACH FIGURE CAME FROM, AND WHEN IT WAS READ.
 *
 * Rendered from the figure set rather than written by the model, and that is the whole point.
 * `brief.ts` deliberately keeps `fetched_at` out of the prompt -- "2026-09-07T23:30:00Z" is six
 * numeric tokens, and licensing them would put 23, 30 and 0 into the allowed set for every brief,
 * after which a model writing "takings are up 23%" would sail through a gate that had allowed that
 * number for an unrelated reason. So the promise that every figure links to its source and fetch
 * time is kept by code that cannot invent either.
 */
function Provenance({ figures }: { figures: readonly Figure[] }) {
  const shown = figures.filter((figure) => figure.sources.length > 0 && figure.fetchedAt !== null);
  if (shown.length === 0) return null;

  return (
    <div className="border-line mt-6 border-t pt-5">
      <p className="text-ink-faint text-xs font-bold tracking-[0.14em] uppercase">
        {BRIEF_COPY.provenanceHeading}
      </p>
      <ul className="mt-3 space-y-1.5">
        {shown.map((figure) => (
          <li key={figure.id} className="text-ink-subtle text-xs leading-[1.5]">
            <span className="text-ink">{figure.label}</span>
            {": "}
            {figure.text}
            {" · "}
            {figure.sources.join(", ")}
            {" · "}
            {figure.fetchedAt}
            {figure.provisional ? " · may still be restated" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
