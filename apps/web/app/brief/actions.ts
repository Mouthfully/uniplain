"use server";

import {
  BUSINESS_TYPES,
  type BusinessType,
  type Figure,
  NO_PRIORS,
  generateInsight,
  opaqueTenantId,
} from "@repo/insights";

import { currentWorkspace } from "../_auth/workspace";
import { briefRows } from "./_rows";
import { BRIEF_PERIOD, periodFor } from "./_period";

/**
 * GENERATING A BRIEF, AND THE RULE THAT EVERY REFUSAL IS SHOWN.
 *
 * This is the first thing in the repository that delivers an insight to a customer. Everything it
 * does is already built and tested -- the read, the arithmetic, the prompt, the gate -- so what
 * this file is actually for is the seam between them, and the seam is where a product usually
 * starts lying.
 *
 * THE RULE: no branch here returns something that looks like a brief. There is a `BriefState` for
 * every way this can fail, each carries the engine's own code, and the page renders it. A screen
 * that fell back to a cheerful empty state on a verifier refusal would be hiding the single most
 * valuable thing this product does -- refusing a number it cannot trace -- from the only person who
 * needs to see it.
 *
 * THE KEY IS A PLATFORM SECRET, NOT A TENANT CREDENTIAL. `OPENROUTER_API_KEY` is ours, and it is
 * read here on the server and passed to `postInsight`. It must never go near `CREDENTIAL_KEK` or
 * the vault path, which exist for per-tenant secrets held under row-level security, and it must
 * never be prefixed `NEXT_PUBLIC_`. Nothing in the returned state carries it.
 *
 * THE SALT HAS NO DEFAULT, and that is `opaqueTenantId`'s rule rather than this file's: without a
 * salt the `user` field on the call is a bare hash of a workspace uuid, which anyone holding the
 * uuid can reproduce to confirm that a particular workspace made a particular call. That is the
 * exact join the field exists to prevent, so a missing salt is `not_configured` here rather than a
 * fallback.
 */

export type BriefState =
  | { readonly kind: "idle" }
  | { readonly kind: "not_configured"; readonly missing: readonly string[] }
  | { readonly kind: "signed_out" }
  | { readonly kind: "no_workspace" }
  | { readonly kind: "rows_unreadable"; readonly detail: string }
  | { readonly kind: "too_many_rows"; readonly detail: string }
  | { readonly kind: "no_business_type" }
  /** The arithmetic refused before a model was ever called. */
  | { readonly kind: "figures_refused"; readonly code: string; readonly detail: string }
  /** The provider could not be reached, or answered with an error. */
  | { readonly kind: "model_failed"; readonly code: string; readonly detail: string }
  /** THE IMPORTANT ONE: the model wrote something the figures do not support. */
  | { readonly kind: "refused"; readonly code: string; readonly detail: string }
  | {
      readonly kind: "ready";
      readonly summary: readonly string[];
      readonly unusual: string | null;
      readonly action: { readonly title: string; readonly why: string } | null;
      readonly figures: readonly Figure[];
      readonly servedBy: string | null;
      readonly period: { readonly from: string; readonly to: string };
    };

/**
 * The model this surface asks for.
 *
 * NAMED HERE RATHER THAN READ FROM THE ENVIRONMENT, so that which model wrote a customer's brief is
 * a fact in version control rather than a deployment setting nobody can reconstruct afterwards.
 * `InsightCompletion` still records which model and which provider ACTUALLY served it, because
 * OpenRouter's routing can answer the same request from a different provider run to run.
 */
const MODEL = "anthropic/claude-sonnet-4.5";

function config(): { apiKey: string; salt: string } | { missing: readonly string[] } {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  const salt = process.env.INSIGHT_TENANT_SALT ?? "";
  const missing: string[] = [];
  if (apiKey.trim() === "") missing.push("OPENROUTER_API_KEY");
  if (salt.trim() === "") missing.push("INSIGHT_TENANT_SALT");
  return missing.length > 0 ? { missing } : { apiKey, salt };
}

function asBusinessType(value: unknown): BusinessType | null {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value)
    ? (value as BusinessType)
    : null;
}

export async function generateBrief(_previous: BriefState, form: FormData): Promise<BriefState> {
  // THE BUSINESS TYPE COMES FROM THE OWNER, and there is no default. `leadingMetrics(business)`
  // takes the type as an INPUT -- nothing in this repository infers it from the data, and
  // `SimplerWay`'s "Learn" step says so in as many words. A default here would quietly decide that
  // every guesthouse is a cafe.
  const business = asBusinessType(form.get("business"));
  if (business === null) return { kind: "no_business_type" };

  const settings = config();
  if ("missing" in settings) return { kind: "not_configured", missing: settings.missing };

  const state = await currentWorkspace();
  if (state.kind === "unavailable") return { kind: "signed_out" };
  if (state.kind !== "ready") return { kind: "no_workspace" };

  const period = periodFor(form.get("today"));
  const read = await briefRows(period.comparison.from, period.period.to);
  if (!read.ok) {
    return read.code === "too_many_rows"
      ? { kind: "too_many_rows", detail: read.detail }
      : { kind: "rows_unreadable", detail: read.detail };
  }

  const tenant = await opaqueTenantId(state.workspace.id, settings.salt);

  const result = await generateInsight({
    business,
    priors: NO_PRIORS,
    period: period.period,
    comparison: period.comparison,
    rows: read.rows,
    model: MODEL,
    tenant,
    client: { apiKey: settings.apiKey },
  });

  if (!result.ok) {
    // THREE FAILURES THAT MUST NOT BE ONE. The arithmetic refusing (no rows, mixed currency) is a
    // statement about the customer's data; the provider failing is a statement about our
    // infrastructure; the verifier refusing is a statement about the model. Collapsing them into
    // "something went wrong" would hide the third, which is the one the whole product is sold on.
    if (result.stage === "figures") {
      return { kind: "figures_refused", code: result.code, detail: result.detail };
    }
    if (result.stage === "client") {
      return { kind: "model_failed", code: result.code, detail: result.detail };
    }
    return { kind: "refused", code: result.code, detail: result.detail };
  }

  return {
    kind: "ready",
    summary: result.insight.summary,
    unusual: result.insight.unusual,
    action: result.insight.action,
    // THE FIGURES TRAVEL WITH THE WORDS. `brief.ts` deliberately keeps the fetch time out of the
    // prompt -- its digits would license 23, 30 and 0 for the whole brief -- so the provenance the
    // product promises is rendered from the figure set by code that cannot invent it.
    figures: result.set.figures,
    servedBy: result.provenance.servedByModel,
    period: period.period,
  };
}

export { BRIEF_PERIOD };
