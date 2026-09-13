/**
 * HOW MUCH A CHANGE MATTERS, DECIDED BY ARITHMETIC AND PRINTED AS A WORD.
 *
 * The prompt used to hand the model a list of figures and ask it to phrase them. Every figure
 * arrived with equal weight, so a takings movement of 0.4% and one of 38% were presented
 * identically, and the model chose for itself which mattered. That choice is a judgement about
 * magnitude, which is arithmetic, which by the one rule is not the model's to make. In practice it
 * produced briefs whose first line was whichever figure happened to sort first, described with
 * whatever adverb the model reached for.
 *
 * So materiality is computed here and handed over as a band, and the prompt tells the model what it
 * may say about each band.
 *
 * ================================================================================================
 * A BAND IS A WORD, AND THAT IS THE WHOLE DESIGN CONSTRAINT
 * ================================================================================================
 *
 * `verify.ts` refuses a brief carrying any numeral that no figure licensed. So anything added to
 * the prompt that LOOKS like a number widens the allowed set, and a widened allowed set is a
 * weaker gate everywhere else in the same brief.
 *
 * `brief.ts` already learned this the expensive way and records it: the fetch time was removed from
 * the prompt because "2026-09-07T23:30:00Z" would have licensed 23, 30 and 0 for every brief, after
 * which a model writing "takings are up 23%" would have sailed through a gate that allowed that
 * number for an unrelated reason.
 *
 * The thresholds below therefore never reach the prompt. **Not the percentages, not the band
 * boundaries, not a count of how many figures fall in each band.** Only one of four words does.
 *
 * ================================================================================================
 * THE THRESHOLDS ARE CHOSEN, NOT DERIVED, AND THIS SAYS SO
 * ================================================================================================
 *
 * There is no measurement behind 2% and 15%. They are a judgement about a small business reading
 * three lines over coffee: below roughly 2% a daily figure is noise a shop cannot act on, and above
 * roughly 15% something happened that an owner would want named. They are exported so a caller can
 * see them, and they are in one place so changing them is one edit and one diff.
 *
 * What matters more than their values is that they are APPLIED CONSISTENTLY and that the model
 * cannot overrule them with an adverb. That is `brief.ts`'s job, and it is tested.
 */

import type { MetricName } from "@repo/contract";

import type { FigureSet } from "./figures.ts";

/**
 * How much a change matters.
 *
 * `unknown` IS NOT A FOURTH SIZE and must never be treated as a small one. It means the comparison
 * could not be made -- the previous period measured zero, or the metric was absent or unreadable --
 * so there is no percentage and nothing to band. Collapsing it into "negligible" would be the
 * `?? 0` mistake in a new costume: a period nobody measured presented as a period where nothing
 * happened.
 */
export const SALIENCE_BANDS = ["large", "notable", "negligible", "unknown"] as const;

export type Salience = (typeof SALIENCE_BANDS)[number];

/** At or above this percentage change, a movement is `large`. */
export const LARGE_AT_PERCENT = 15;

/** At or above this percentage change, a movement is `notable`. Below it, `negligible`. */
export const NOTABLE_AT_PERCENT = 2;

/**
 * Band one percentage change.
 *
 * Takes the ABSOLUTE percentage: direction is already carried by the delta figure's own text, and
 * a fall of 20% matters exactly as much as a rise of 20%. A non-finite input -- which arithmetic
 * upstream should already have refused rather than produced -- bands as `unknown` rather than
 * throwing, because one unbandable metric must not cost the owner the whole brief.
 */
export function bandOf(absolutePercent: number): Salience {
  if (!Number.isFinite(absolutePercent)) return "unknown";
  const magnitude = Math.abs(absolutePercent);
  if (magnitude >= LARGE_AT_PERCENT) return "large";
  if (magnitude >= NOTABLE_AT_PERCENT) return "notable";
  return "negligible";
}

/**
 * The band for one metric in one set, read off the figure the set already computed.
 *
 * WHY THIS READS `allows` RATHER THAN RE-DIVIDING. The percentage was computed once, in
 * `buildFigureSet`, and printed to a stated precision. Recomputing it here from the totals would
 * produce a second number that agrees with the first almost always -- and the interesting case is
 * the "almost". A figure printed as `0.0%` after rounding must band as the figure the owner will
 * actually read, not as the unrounded quantity nobody sees. So the band is derived from exactly
 * the token the prompt prints, which is the same discipline `allows` itself follows.
 */
export function salienceOf(set: FigureSet, metric: MetricName): Salience {
  const share = set.figures.find((figure) => figure.id === `metric.${metric}.delta_share`);
  if (share === undefined) return "unknown";

  // An absent or unreadable figure licenses nothing, which is precisely the `unknown` case: the
  // previous period measured zero, or the metric could not be read at all.
  if (share.kind === "absent" || share.kind === "unreadable") return "unknown";

  const token = share.allows[0];
  if (token === undefined) return "unknown";

  const parsed = Number(token);
  return bandOf(parsed);
}

/**
 * Every metric in the set that banded `large`, in the set's own figure order.
 *
 * Used by `brief.ts` to tell the model which figures to lead with. Order is taken from
 * `set.figures` rather than re-sorted here, so the prompt's ordering decision stays in one file.
 */
export function leadingChanges(
  set: FigureSet,
  metrics: readonly MetricName[],
): readonly MetricName[] {
  return metrics.filter((metric) => salienceOf(set, metric) === "large");
}
