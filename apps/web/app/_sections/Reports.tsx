import type { MetricName } from "@repo/contract";
import type { ImplementedSourceId } from "@repo/brand";

import { implementedSources, sourceMark } from "./_source-marks";

/**
 * CONSOLIDATED REPORTS -- the fourth capability, in the section that used to sell templates.
 *
 * WHY IT IS NOT A TEMPLATES SECTION ANY MORE. `docs/marketplane/58-plan-reconciliation.md` section
 * 5.1 lists `Templates` under copy that must stop, with the reason in one line: "the plan's owner
 * does not build reports from templates; the product decides for them". An owner-operator with no
 * analyst does not want a gallery to choose from -- choosing is the work they do not have time
 * for. The section was re-aimed rather than deleted, because the founder's plan has a fourth
 * capability (consolidated reports) with nowhere else to live, and it is exactly a four-up of
 * named, finished documents.
 *
 * THE FOUR WERE THE PLAN'S OWN LIST and two of them are no longer on it: monthly investor update,
 * **P&L by unit and channel**, **bank loan pack**, accountant export. Not a category each -- a
 * document each, with a name the person who asked for it would use.
 *
 * WHY TWO WERE REPLACED RATHER THAN LEFT AS A ROADMAP LINE. `docs/marketplane/60` groups the
 * unbacked copy by what is missing, and these two sit in the group it calls worse than unbuilt:
 * the contract has no shape for them, so no amount of building delivers them without a dictionary
 * change first.
 *
 *   * "P&L by unit and channel" is blocked twice. `dimensionsSchema` carries date, currency,
 *     timezone and attribution_window -- there is no `unit`. And a P&L needs costs:
 *     `packages/contract/src/metrics.ts` has `spend`, `fees` and `commission`, and nothing that
 *     is a cost of goods or an operating expense. A profit-and-loss statement cannot be computed
 *     from a dictionary with no cost side.
 *
 *   * "Bank loan pack" has no bank. `packages/connectors/src/sources` holds air4thai, ga4,
 *     google_ads, meta_ads, search_console and woocommerce. Note 60 section 1.3 records Thai
 *     deposit data as regulator-blocked until roughly 2027, so this is not a connector somebody
 *     writes next quarter.
 *
 * The two replacements are named for what the envelope can actually express today: `source` IS the
 * channel, and revenue, orders, net_revenue, fees and spend are all in the dictionary. None of the
 * four is GENERATED yet -- that is a real gap and note 60 section 6.2 records it -- but a report
 * that has not been written is a roadmap item, and a report the data model cannot express is a
 * promise with nothing behind it.
 *
 * THE CARDS ARE LINKS, NOT BUTTONS. The reference ships each card as `<button data-template="...">`,
 * wired by its own script to open the page's `<dialog id="demo">` with a preview. Neither that
 * script nor a per-report route exists in this app, so a literal transcription would ship four
 * buttons that swallow a click. Each card is an `<a>` to `/dashboard` instead -- a route that
 * exists -- which is the treatment `UseCases.tsx` already settled on for the same `data-template`
 * markup. This stays a server component as a result: nothing here holds state.
 *
 * THE BARS. Heights and per-bar opacities are the reference's own inline styles, transcribed value
 * for value (35/51/42/67/57/85/75/96 on the first card, and so on), because the stagger is the
 * design -- a flat or evenly-ascending set reads as a placeholder. They are inline `style` because
 * they are data that varies per bar, not a design decision: eight Tailwind height classes per card
 * would put the same numbers in the markup with more ceremony. No colour is written there, and the
 * chart's accessible name says "sample" for the reason section 5.3 gives.
 *
 * COLOUR AND RADII, WITH TWO SUBSTITUTIONS, BOTH REPORTED:
 *   * The bar fill is a two-stop vertical gradient in the reference. Its first stop IS the value
 *     of `--mp-brand-blue`; the second has no token, and is that same blue at roughly 40% over
 *     white,
 *     so the gradient is `from-brand-blue to-brand-blue/40` -- no literal, and it follows a palette
 *     change instead of freezing today's one.
 *   * The reference's panel ground and card border are each a percent or two from
 *     `--mp-surface-subtle` and `--mp-line`, which already carry exactly those roles.
 * The panel's 22px radius takes `rounded-xl` (24px, the guide's feature-panel step) and the cards'
 * 12px takes `rounded-lg` (16px, the guide's card step): the guide assigns radii by ROLE, so
 * matching the role beats shaving 2px off the nearest number. The 2px bar caps are the one
 * arbitrary length left inline -- the smallest radius token is 6px, which on a 7px-wide bar reads
 * as a lozenge rather than a bar.
 *
 * The reference gives the cards a hover shadow; the only shadow token is reserved for the hero, so
 * hover moves the border instead, as the other sections do.
 */

/** Section copy. `scripts/check-copy.mjs` refuses a sentence typed into the JSX, so every line
 *  arrives from here. The eyebrow is stored in sentence case because the capitals are CSS. */
const EYEBROW = "Consolidated reports";

/** The line break inside the heading is the design's, so the two lines are two values. */
const HEADING_TOP = "The report a finance team";
const HEADING_BOTTOM = "would write. On the 1st.";

const LEAD =
  "Every sales channel and ad account consolidated into one set of numbers, then written up as the document your co-founder or your accountant actually asked for. Every figure links back to where it came from and when it was read.";

const CTA_LABEL = "See what is in one";

/** One label for all four cards, as in the reference. */
const CARD_CTA_LABEL = "Preview";

/** Names each card's two lists, which otherwise read as runs of bare words. */
const METRICS_LABEL = "Figures in this report";
const SOURCES_LABEL = "Connectors this report reads";

/**
 * THE PANEL'S OWN LABEL, and it is a stronger statement than the one it replaces.
 *
 * The chart carried `aria-label="Sample figures"` -- section 5.3's required mark on an invented
 * figure. It was the only place the page admitted these four documents do not exist, and it was
 * alt text, so no sighted reader ever met it. The bars are gone and the admission is now visible.
 */
const PANEL_NOTE =
  "These four are designed and not yet generated. What each one would contain is listed above, in the metrics this product already stores.";

interface ReportCard {
  readonly name: string;
  /**
   * Who the document is for, or the axis it is cut on. A NOUN PHRASE, NOT A SENTENCE.
   *
   * `check-copy` refused the first version of these and was right to. They read "Every trading day
   * in the period, so a quiet week shows up as a shape." -- a sentence, on the page, describing the
   * behaviour of a report that does not exist. The guard's rule is that a promise reaches the site
   * through `claim()` so the capability gate can withhold it, and there is no reports capability to
   * gate these on; routing them through `CLAIMS` would have withheld them and emptied the cards.
   *
   * Shortening them is not evading the guard, because what was removed is the promise rather than
   * the punctuation: "For a bookkeeper, gross and net apart" says who the document is for and how
   * it is cut, which is part of naming it. It asserts nothing about what the product does.
   */
  readonly asks: string;
  /** Typed against the dictionary, so a metric with no column cannot be listed. */
  readonly metrics: readonly MetricName[];
  /** Typed against the built connectors, so an unbuilt platform cannot be named as a source. */
  readonly sources: readonly ImplementedSourceId[];
}

/**
 * SHORT NAMES FOR THE DICTIONARY'S METRICS, for a card rather than for a prompt.
 *
 * `METRIC_LABELS` in `figures.ts` already names these, and it is deliberately not reused: it is
 * written for a MODEL -- "revenue, as the source reported it" exists at that length so a prompt
 * cannot confuse gross with net. On a card it would wrap to three lines and say less. Two
 * audiences, two renderings, which is a different thing from the same name typed twice.
 *
 * `Record<MetricName, string>` is TOTAL on purpose: adding a metric to the dictionary fails this
 * file until it is named here, so the card cannot quietly stop covering part of the vocabulary.
 */
const METRIC_CARD_LABELS: Readonly<Record<MetricName, string>> = {
  spend: "Ad spend",
  impressions: "Impressions",
  clicks: "Clicks",
  sessions: "Sessions",
  conversions: "Conversions",
  conversions_value: "Conversion value",
  revenue: "Takings",
  orders: "Orders",
  net_revenue: "After platform cut",
  fees: "Fees",
  commission: "Commission",
  position: "Search position",
};

/**
 * THE FOUR REPORTS, AND WHY THE CHART IS GONE.
 *
 * Each card used to carry an eight-bar chart. All four were THE SAME CHART: the second card's
 * heights are the first minus 6, the third minus 12, the fourth minus 18 -- one curve from the
 * reference artboard, shifted down three times. A reader saw four identical shapes above four
 * different names and learned nothing, which is exactly how the section read.
 *
 * It was also a picture that could not be true. "Revenue and ad spend by channel" and "Orders and
 * takings by day" are different shapes of document about different axes; drawing them identically
 * says nothing about either, and the section's own note already warned that "a flat or
 * evenly-ascending set reads as a placeholder" directly above four copies of one.
 *
 * WHAT REPLACED IT IS THE THING A READER ACTUALLY WANTS TO KNOW: what is in it. Each card now
 * states who asks for it, which metrics it is built from, and which connectors it reads. The four
 * become visibly different because their CONTENTS are different -- the accountant export is
 * takings, commission and fees off one till; the channel report is takings against ad spend across
 * four connectors.
 *
 * AND UNLIKE THE BARS, ALL OF IT IS CHECKED. `metrics` is typed `MetricName`, so `check-dictionary`
 * and the compiler both refuse a metric this product has no column for -- which is the discipline
 * the header of this file spends thirty lines on, now applied to the cards rather than only to
 * their names. `sources` is typed `ImplementedSourceId` and narrowed again at render, so no unbuilt
 * platform can appear as a source.
 *
 * NONE OF THESE IS GENERATED TODAY, which was true before this change and is stated on the panel
 * now rather than only in the chart's alt text, where no sighted reader met it.
 */
export const REPORTS = [
  {
    name: "Monthly investor update",
    asks: "For a co-founder or an investor",
    metrics: ["revenue", "net_revenue", "orders", "spend"],
    sources: ["woocommerce", "meta_ads", "google_ads"],
  },
  {
    name: "Revenue and ad spend by channel",
    asks: "Earned against paid, by channel",
    metrics: ["revenue", "spend", "conversions"],
    sources: ["woocommerce", "meta_ads", "google_ads", "ga4"],
  },
  {
    name: "Orders and takings by day",
    asks: "Every trading day, in order",
    metrics: ["orders", "revenue"],
    sources: ["woocommerce"],
  },
  {
    name: "Accountant export",
    asks: "For a bookkeeper, gross and net apart",
    metrics: ["revenue", "commission", "fees", "net_revenue"],
    sources: ["woocommerce"],
  },
] as const satisfies readonly ReportCard[];

export function Reports() {
  return (
    <section
      id="reports"
      aria-labelledby="reports-heading"
      className="mx-auto grid max-w-[1200px] items-center gap-8 px-8 py-12 md:grid-cols-2 md:gap-10 md:py-20 lg:gap-20"
    >
      <div className="reveal-side min-w-0">
        <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
          {EYEBROW}
        </span>
        <h2
          id="reports-heading"
          className="font-display text-ink mt-[18px] text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[36px]"
        >
          {HEADING_TOP}
          <br />
          {HEADING_BOTTOM}
        </h2>
        {/* The design caps the measure at 475px, which is the guide's 60-70 characters a line. */}
        <p className="text-ink-muted mt-5 max-w-[475px] leading-[1.65]">{LEAD}</p>

        <a
          href="/dashboard"
          className="nudge-host bg-surface text-accent border-line hover:bg-surface-subtle mt-6 inline-flex min-h-[46px] items-center gap-3 rounded-md border px-[22px] text-sm font-bold transition-colors"
        >
          {CTA_LABEL}
          <span aria-hidden="true" className="nudge inline-block">
            &#9655;
          </span>
        </a>
      </div>

      {/* The panel is the design's: the four cards sit on a tinted ground with a 2px-larger radius,
          which is what reads as a set rather than four loose cards. It stays two-up at every width
          -- these cards carry two short lines and a chart, so they survive a phone in pairs. */}
      <ul className="reveal-group bg-surface-subtle grid min-w-0 grid-cols-2 gap-2.5 rounded-xl p-2.5 md:gap-4 md:p-[18px]">
        {REPORTS.map((report) => (
          <li key={report.name} className="flex">
            <a
              href="/dashboard"
              className="lift border-line bg-surface hover:border-accent flex flex-1 flex-col rounded-lg border p-3 text-left transition-colors md:p-[18px]"
            >
              <strong className="text-ink text-xs leading-[1.3] font-bold">{report.name}</strong>
              <span className="text-ink-muted mt-1.5 block text-[11px] leading-[1.45]">
                {report.asks}
              </span>

              {/* WHAT IS IN IT. The metric names are the dictionary's, so `check-dictionary` and
                  the compiler both refuse one this product has no column for. */}
              <ul aria-label={METRICS_LABEL} className="mt-3 flex list-none flex-wrap gap-1 p-0">
                {report.metrics.map((metric) => (
                  <li
                    key={metric}
                    className="border-line bg-surface-subtle text-ink-subtle rounded-sm border px-1.5 py-0.5 text-[10px] leading-[1.4]"
                  >
                    {METRIC_CARD_LABELS[metric]}
                  </li>
                ))}
              </ul>

              {/* WHERE IT COMES FROM. Narrowed again at render even though the field is already
                  typed: a cast is all it takes to get an unbuilt platform past a type, and this is
                  a source claim on a marketing page. */}
              <ul aria-label={SOURCES_LABEL} className="mt-2 flex list-none flex-wrap gap-1 p-0">
                {implementedSources(report.sources).map((id) => {
                  const mark = sourceMark(id);
                  return (
                    <li
                      key={mark.id}
                      className="text-ink-faint inline-flex items-center gap-1 text-[10px] leading-[1.4]"
                    >
                      {mark.slug === null ? null : (
                        <img
                          src={`/platforms/${mark.slug}.svg`}
                          alt=""
                          width={10}
                          height={10}
                          className="h-2.5 w-2.5 shrink-0 object-contain"
                        />
                      )}
                      {mark.label}
                    </li>
                  );
                })}
              </ul>

              <span className="text-accent mt-3 inline-flex items-center gap-1.5 text-xs font-bold">
                {CARD_CTA_LABEL}
                <span aria-hidden="true">&rarr;</span>
              </span>
            </a>
          </li>
        ))}
        <li className="col-span-2 list-none">
          <p className="text-ink-faint px-1 pt-1 text-[10px] leading-[1.5]">{PANEL_NOTE}</p>
        </li>
      </ul>
    </section>
  );
}
