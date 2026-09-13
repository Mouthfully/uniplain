/**
 * WHAT THE OWNER SAYS BACK, AND THE ONE THING IT MAY NOT DO.
 *
 * The founder asked for the engine to learn from customer feedback. This module is that, and the
 * shape it takes is decided by a rule that already binds every line of `brief.ts`:
 *
 *   **NOTHING TENANT-WRITTEN REACHES A MODEL PROMPT.**
 *
 * Feedback is, by definition, tenant-written. So either that rule bends or feedback takes a shape
 * that cannot break it, and the rule does not bend: `data_collection: "deny"` still permits 30 to
 * 55 day retention at some providers (note 59), so a sentence an owner typed about their own
 * business is a sentence that may sit on a third party's disk for two months. A closed vocabulary
 * cannot carry one.
 *
 * Hence `ActionFeedback` HAS NO FREE-TEXT FIELD, and that absence is the control. It is not an
 * omission for whoever adds the storage table to fill in: a `note` column may exist in the
 * database and must never be given a path into this package, because a field that does not exist
 * on the type cannot be rendered by a function that only takes the type. `feedback.test.ts`
 * asserts it the only way a runtime can -- it shoves a note onto the object anyway and checks that
 * the rendered prompt never contains it.
 *
 * ================================================================================================
 * "TRAINING", AND WHY THIS IS DELIBERATELY NOT THAT
 * ================================================================================================
 *
 * No model is fine-tuned here, and none should be. Fine-tuning would mean keeping a corpus of
 * customers' business figures for the purpose of improving a model -- the exact practice
 * `provider: { data_collection: "deny", zdr: true }` exists to refuse at the provider, contradicted
 * one layer up by us. It would also be a new PDPA s.28 cross-border transfer, for a new purpose, on
 * data collected for a different one.
 *
 * What learns instead is the ENGINE, per workspace, in TypeScript, from counts this code can show
 * you on demand. That is a weaker claim than "the AI learns from you" and it is the true one, which
 * is the trade this repository makes everywhere else.
 *
 * ================================================================================================
 * THE VERDICT VOCABULARY, AND WHY `wrong` IS NOT LIKE THE OTHER THREE
 * ================================================================================================
 *
 * Three of the four verdicts are an owner making a choice about a suggestion. The fourth is an
 * owner telling us our arithmetic is broken, and treating them the same way is the mistake this
 * module is built to avoid:
 *
 *   did_it         acted on it. Engagement, so the counter that leads to silence is cleared.
 *   not_doing_it   a decision about their own business. Theirs to make, so stop offering it.
 *   already_knew   we told them something they knew. Stop offering it.
 *   wrong          THE NUMBERS ARE WRONG. **This suppresses nothing, ever.**
 *
 * `wrong` is a defect report about a detector, and a broken detector is broken for every workspace.
 * Quietly hiding a finding because one owner called it wrong would destroy the only signal that the
 * detector needs fixing -- and would destroy it fastest in exactly the workspace observant enough
 * to notice. So it is counted, surfaced by `defectSignals()` for a human to work through, and
 * changes nothing about what is shown. An owner who wants it gone says `not_doing_it`, which is a
 * choice rather than a bug report.
 */

import type { Source } from "@repo/contract";

import type { ActionKind } from "./figures.ts";

export const FEEDBACK_VERDICTS = ["did_it", "not_doing_it", "already_knew", "wrong"] as const;

export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

/**
 * One verdict on one action.
 *
 * NO FREE TEXT, DELIBERATELY -- see the module header. `kind` and `source` are carried rather than
 * parsed back out of `actionId`, so that a change to the id format cannot silently re-point a
 * workspace's history at the wrong detector.
 */
export interface ActionFeedback {
  readonly actionId: string;
  readonly kind: ActionKind;
  readonly source: Source | null;
  readonly verdict: FeedbackVerdict;
}

/**
 * How many declines silence a detector for one workspace.
 *
 * THREE IS CHOSEN, NOT DERIVED, and it is the only number in this module that is. One is too
 * eager: an owner dismissing a suggestion on a busy morning has not made a standing decision. Ten
 * is never reached by a small business looking at a weekly list. The cost of being wrong is mild
 * in both directions -- too high and they dismiss it a few more times, too low and they stop
 * seeing a real finding -- which is why `did_it` clears the count outright rather than offsetting
 * it by one.
 */
export const SILENCE_AFTER = 3;

/** A detector's standing with one workspace, as counts anybody can check. */
export interface ActionPrior {
  readonly kind: ActionKind;
  readonly source: Source | null;
  readonly acted: number;
  readonly declined: number;
  readonly disputed: number;
  /** True when this detector should produce nothing for this workspace. */
  readonly silenced: boolean;
}

export interface PriorSet {
  readonly priors: readonly ActionPrior[];
}

/**
 * The key a detector is tracked under.
 *
 * A NULL SOURCE IS ITS OWN BUCKET, NOT A WILDCARD. `weekday_gap` is about the whole business and
 * carries no source; silencing it must not silence a `channel_decline` on one platform, and vice
 * versa. The separator is two colons because `Source` is a dictionary enum of lowercase
 * identifiers and `ActionKind` is a literal union, so neither can contain one.
 */
function keyOf(kind: ActionKind, source: Source | null): string {
  return `${kind}::${source ?? ""}`;
}

/**
 * Fold a workspace's feedback into per-detector standings.
 *
 * ORDER MATTERS AND IT IS THE CALLER'S JOB. `did_it` clears the decline count, so a workspace that
 * declined three times and then acted is NOT silenced -- they came back. Feed this an unordered
 * list and you get a defensible but different answer, so the parameter is documented as **oldest
 * first** and `feedback.test.ts` asserts the two orders genuinely differ. Without that test the
 * requirement reads as incidental and the next caller sorts by something else.
 */
export function buildPriors(feedback: readonly ActionFeedback[]): PriorSet {
  interface Tally {
    kind: ActionKind;
    source: Source | null;
    acted: number;
    declined: number;
    disputed: number;
  }
  const tally = new Map<string, Tally>();

  for (const item of feedback) {
    const key = keyOf(item.kind, item.source);
    const entry: Tally = tally.get(key) ?? {
      kind: item.kind,
      source: item.source,
      acted: 0,
      declined: 0,
      disputed: 0,
    };

    switch (item.verdict) {
      case "did_it":
        entry.acted += 1;
        // ENGAGEMENT CLEARS THE PATH TO SILENCE. Without this, a detector dismissed three times
        // early on stays silent forever, including for a workspace that has acted on it weekly
        // ever since.
        entry.declined = 0;
        break;
      case "not_doing_it":
      case "already_knew":
        entry.declined += 1;
        break;
      case "wrong":
        // COUNTED, AND IT SUPPRESSES NOTHING. See the module header.
        entry.disputed += 1;
        break;
    }

    tally.set(key, entry);
  }

  const priors = [...tally.values()]
    .map((entry) => ({
      kind: entry.kind,
      source: entry.source,
      acted: entry.acted,
      declined: entry.declined,
      disputed: entry.disputed,
      silenced: entry.declined >= SILENCE_AFTER,
    }))
    // A TOTAL ORDER, so a prior set built twice from the same feedback is the same bytes. Same
    // property `brief.ts` keeps, for the same reason: an input nobody can diff is an input nobody
    // can audit when an answer goes wrong.
    .sort((a, b) => a.kind.localeCompare(b.kind) || (a.source ?? "").localeCompare(b.source ?? ""));

  return { priors };
}

/** Whether this detector should produce nothing for this workspace. */
export function isSilenced(priors: PriorSet, kind: ActionKind, source: Source | null): boolean {
  const key = keyOf(kind, source);
  return priors.priors.some((prior) => keyOf(prior.kind, prior.source) === key && prior.silenced);
}

/**
 * Detectors an owner has called WRONG, for a human to read.
 *
 * This is the half of the loop suppression must not swallow. It changes nothing a customer sees;
 * it is the queue that says which arithmetic to go and check.
 */
export function defectSignals(priors: PriorSet): readonly ActionPrior[] {
  return priors.priors.filter((prior) => prior.disputed > 0);
}

/** The standing of a workspace that has never said anything. */
export const NO_PRIORS: PriorSet = { priors: [] };
