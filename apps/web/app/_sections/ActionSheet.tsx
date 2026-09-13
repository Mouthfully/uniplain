/**
 * THE ACTION SHEET -- the section this site did not have and the founder's plan is built around.
 *
 * WHY IT EXISTS. `design/bi-plan/Main.dc.html` states the product's actual promise in one line:
 * "Every insight ends in a to-do, not a chart." Everything else on this page can be read as a
 * dashboard pitch; this section is the one that cannot. It is rendered third, above the capability
 * grid that merely names it, because the argument has to arrive before the feature list.
 *
 * THE THREE PROPERTIES ARE NOT DECORATION. The artboard states them explicitly and all three are
 * carried here verbatim in substance, because they are what make the promise credible rather than
 * boastful:
 *
 *   ordered by value          a list that is not ranked is a backlog, and a backlog is what an
 *                             owner with no analyst already has
 *   impact is an estimate     stated as a range wherever the platform may still restate the
 *                             figures underneath it -- `is_provisional` on the envelope row is
 *                             exactly the flag that decides point estimate or band
 *   nothing is done for you   the product reads and never writes. It is already a trust pillar
 *                             elsewhere on the site and it belongs hardest here, where a list of
 *                             instructions could otherwise read as a list of things being done
 *
 * WHY THE CARD SAYS "SAMPLE FIGURES" IN ITS OWN HEADER.
 * `docs/marketplane/58-plan-reconciliation.md` section 5.3 refuses a named Chiang Mai cafe as
 * proof at any price: there are no customers, the artboard's owner quotes are recorded as
 * unapproved drafts, and its figures are invented. An unlabelled example of a week's takings is
 * therefore fabricated social proof. The artboard's own answer is the one taken here -- it marks
 * "Sample figures" in three separate places -- so this card marks itself, names no business, no
 * owner and no platform, and the section carries no quote and no "trusted by" row of any kind.
 *
 * LAYOUT. The reference's `.split`: copy left, panel right, 1fr/1fr with the gutter narrowing once
 * the columns get cramped and collapsing to one column below 768px. Same three steps every other
 * split section on this page takes, and the same card geometry -- hairline border, 16px radius,
 * no shadow, since the token file reserves its one elevation for the hero.
 */

/** Section copy. `scripts/check-copy.mjs` refuses a sentence typed into the JSX, so every line
 *  arrives from here. The eyebrow is stored in sentence case because the capitals are CSS. */
const EYEBROW = "The action sheet";

/** The line break inside the heading is the design's, so the two lines are two values. */
const HEADING_TOP = "Every insight ends in a to-do,";
const HEADING_BOTTOM = "not a chart.";

/**
 * THE SECOND SENTENCE WAS "Next Monday it checks whether each one worked and says so." It is gone,
 * along with the `FOLLOW_UP` line it was illustrated by (see `FOOTNOTE` for what took that row)
 * and the matching clauses in `FeatureGrid`
 * and `SimplerWay`. Nothing in `apps/` or `packages/` compares a recommendation against what
 * happened afterwards. That is not a cadence that a cron supplies -- it needs a record of what was
 * recommended, a record of what the owner did, and a measurement of the period after. None of the
 * three exists, and the first two would each be a table.
 *
 * The replacement sentence is the uncertainty rule, which IS real: `estimateFrom` in
 * `packages/insights/src/figures.ts` returns a range rather than a point whenever settled and
 * provisional rows disagree, and refuses to produce a figure at all when neither is readable.
 */
const LEAD =
  "Each Monday you get a short list for the week: what to do, why, what it is worth and how long it takes. Where the numbers behind a figure may still change, it gives you a range instead of a number.";

/**
 * The three properties, as fragments and one short sentence pair. They carry terminal punctuation
 * where the artboard's own wording does, which is safe here: the guard reads JSX text nodes, and
 * these reach the markup through an expression.
 */
const PROPERTIES = [
  "Ordered by value, biggest first",
  "Impact is an estimate from your own numbers, shown as a range where it is uncertain",
  "Nothing is done for you. You stay in control of prices, ads and staff",
] as const;

const CTA_LABEL = "See this week's list";

/** The card's own chrome. `SAMPLE` is the label section 5.3 makes mandatory, not a flourish. */
const CARD_TITLE = "This week";
const SAMPLE = "Sample figures";
/**
 * THIS LINE ADDED A WEEKLY FIGURE INTO A MONTHLY TOTAL, which is the exact arithmetic this product
 * refuses. It read "Three actions, worth about ฿6,400 a month between them", and ฿6,400 is roughly
 * ฿3,600 + ฿1,840 + ฿900 -- the first two monthly, the third the top of a range quoted PER WEEK.
 * The monthly total of the three is nearer ฿8,800 to ฿11,500, and that figure has a division by
 * weeks-per-month buried in it that nothing on this page states.
 *
 * So it does not convert. It sums the two figures that share a unit and leaves the third in its
 * own, which is exactly what `combineMetric` does with an incompatible aggregation: a total across
 * units is not a smaller total, it is a different quantity. Both ends are exact --
 * ฿3,100 + ฿1,840 and ฿3,600 + ฿1,840 -- so nothing here is rounded into truth either.
 */
export const CARD_SUMMARY = "Three actions: ฿4,940 to ฿5,440 a month, plus ฿900 to ฿1,400 a week";

/**
 * The card's footer strip, which the deleted `FOLLOW_UP` used to fill. The row is kept because the
 * design uses it to close the card, and what goes in it is the single most heavily backed sentence
 * on this page: `packages/insights/src/verify.ts` extracts every numeral from what the model wrote
 * and refuses the WHOLE insight if one of them is not traceable to the input rows -- it does not
 * strip the number, round it to something true, or retry with a sterner prompt.
 */
const FOOTNOTE =
  "If a figure cannot be traced back to your own data, you get nothing rather than a guess.";

/** Names the ordered list for assistive tech, which otherwise hears three bare numerals. */
const ACTIONS_LABEL = "This week's actions, most valuable first";

/**
 * The three sample actions, in value order, which is the order the section promises.
 *
 * EXPORTED, ALONG WITH `CARD_SUMMARY`, FOR ONE TEST AND NO OTHER CALLER.
 * `action-sheet-arithmetic.test.tsx` checks that the summary is the sum of these, per period, with
 * nothing converted between weeks and months. Scraping the two out of the rendered markup was tried
 * first and is worse: the list's accessible name is an ATTRIBUTE, so stripping tags removes the
 * boundary the scrape needed and the match ran on into the action titles, where it found a ฿5 and
 * compared it to a total. A test that reads its own inputs out of prose is a test with a parser in
 * it. The test still asserts both values appear in the markup, so the export cannot drift from what
 * a reader sees.
 *
 * `impact` is a RANGE on two of the three and a point on the one whose inputs are settled -- that
 * asymmetry is the second property made visible rather than merely asserted. `note` says where the
 * estimate came from, because an impact figure with no provenance is the exact kind of confident
 * number this product is sold against.
 *
 * No platform is named in any row. Section 5.1 stops the delivery platforms and the Thai POS
 * vendors appearing as sources anywhere on the site until one is both built and reachable, and a
 * row reading "GrabFood takes 30%" -- as the artboard's does -- is a source claim in a sentence.
 */
export const ACTIONS = [
  {
    id: "price",
    title: "Raise two delivery items by ฿5",
    why: "Both held their volume through the last two price rises, and delivery carries a fee the counter does not.",
    impact: "฿3,100 to ฿3,600 a month",
    note: "From your own prices and last month's volume",
    effort: "10 minutes",
  },
  {
    id: "ad",
    title: "Stop the weekday 11:00 to 14:00 ad",
    why: "It spent ฿1,840 last month and four orders came back against it. Your lunch hour fills without it.",
    impact: "฿1,840 a month",
    note: "Spend is settled, so this one is not a range",
    effort: "2 minutes",
  },
  {
    id: "shift",
    title: "Move one barista to Saturday lunch",
    why: "Orders waited longest at 12:40 last Saturday, which is also your busiest half hour of the week.",
    impact: "฿900 to ฿1,400 a week",
    note: "A range: last week's orders may still be restated",
    effort: "One rota change",
  },
] as const;

export function ActionSheet() {
  return (
    <section
      id="actions"
      aria-labelledby="action-sheet-heading"
      className="mx-auto grid max-w-[1200px] items-center gap-8 px-8 py-12 md:grid-cols-2 md:gap-10 md:py-20 lg:gap-20"
    >
      <div className="min-w-0">
        <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
          {EYEBROW}
        </span>
        <h2
          id="action-sheet-heading"
          className="font-display text-ink mt-[18px] text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[36px]"
        >
          {HEADING_TOP}
          <br />
          <span className="brand-gradient-text">{HEADING_BOTTOM}</span>
        </h2>
        {/* The design caps the measure at 475px, which is the guide's 60-70 characters a line. */}
        <p className="text-ink-muted mt-5 max-w-[475px] leading-[1.65]">{LEAD}</p>

        <ul className="mt-6 list-none p-0">
          {PROPERTIES.map((property) => (
            <li key={property} className="text-ink-muted my-[9px] flex items-baseline gap-2">
              {/* Decorative: the list already reads as a list, so the mark is not announced. */}
              <span aria-hidden="true" className="text-brand-mint font-bold">
                &#10003;
              </span>
              {property}
            </li>
          ))}
        </ul>

        <a
          href="/dashboard"
          className="bg-surface text-accent border-line hover:bg-surface-subtle mt-6 inline-flex min-h-[46px] items-center gap-3 rounded-md border px-[22px] text-sm font-bold transition-colors"
        >
          {CTA_LABEL}
          <span aria-hidden="true">&#9655;</span>
        </a>
      </div>

      {/* The panel is the design's tinted ground with the cards sitting on it, which is what reads
          as one sheet rather than three loose rows. */}
      <div className="bg-surface-inset min-w-0 rounded-xl p-4 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-ink text-base font-semibold">{CARD_TITLE}</h3>
          <span className="border-line bg-surface text-ink-subtle rounded-sm border px-2 py-1 text-[10px] font-bold">
            {SAMPLE}
          </span>
        </div>
        <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{CARD_SUMMARY}</p>

        <ol aria-label={ACTIONS_LABEL} className="mt-4 list-none p-0">
          {ACTIONS.map((action, index) => (
            <li
              key={action.id}
              className="border-line bg-surface mt-3 flex gap-3 rounded-lg border p-4 first:mt-0"
            >
              {/* The numeral is the list marker made visible, so it is not read out twice. */}
              <span
                aria-hidden="true"
                className="bg-accent text-ink-on-accent mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <strong className="text-ink block text-sm leading-[1.35] [overflow-wrap:anywhere]">
                  {action.title}
                </strong>
                <p className="text-ink-subtle mt-1.5 text-xs leading-[1.5]">{action.why}</p>

                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <strong className="text-accent text-sm font-bold">{action.impact}</strong>
                  <span className="text-ink-faint text-[10px] leading-[1.4]">{action.note}</span>
                </div>

                <span className="bg-surface-subtle text-ink-subtle mt-2.5 inline-block rounded-sm px-2 py-1 text-[10px]">
                  {action.effort}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="bg-surface text-ink-subtle mt-4 rounded-sm p-3 text-[11px] leading-[1.5]">
          {FOOTNOTE}
        </p>
      </div>
    </section>
  );
}
