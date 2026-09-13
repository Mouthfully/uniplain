import { IMPLEMENTED_SOURCE_IDS, type ImplementedSourceId } from "@repo/brand";
import {
  type ActionKind,
  type BusinessType,
  type Estimate,
  type Figure,
  type FigureSet,
  type InsightRow,
  NO_PRIORS,
  buildFigureSet,
} from "@repo/insights";

import { claim, connectionAllowance } from "../_content";

/**
 * THE SEGMENT PAGES: one kind of business per page, and every page is data in this file.
 *
 * WHY THEY EXIST. `app/connectors/*` catches the technical long tail -- somebody who already knows
 * they want a WooCommerce revenue report. An owner does not search that. They search for their own
 * kind of business, and there was no page for one.
 *
 * WHICH SEGMENTS, AND THE RULE THAT PICKED THEM. A segment whose data this product cannot read is a
 * landing page that converts somebody into a refusal, so each one below is named from an IMPLEMENTED
 * source rather than from a marketing list: a till this product can read, a store it can read, an
 * advertising account it can read. `sources` is typed `ImplementedSourceId`, so a segment built on a
 * connector that does not exist is a compile error, and `assertImplementedSource` refuses one at
 * build time even if the type is cast away.
 *
 * WHAT IS DELIBERATELY NOT HERE. No restaurant page and no hotel or guesthouse page, and both
 * omissions are the same finding rather than an oversight. What a delivery-heavy restaurant wants to
 * know is what the delivery platform kept, and what a guesthouse wants to know is what the booking
 * site kept: `commission` is in the dictionary and NO IMPLEMENTED CONNECTOR EMITS IT. Section 5.1 of
 * `docs/marketplane/58-plan-reconciliation.md` separately forbids naming those platforms anywhere on
 * this site until one is built and reachable. A page for either segment could therefore be written
 * only by leaving out the question the owner came with.
 *
 * ==============================================================================================
 * THE NUMBERS ARE THE ENGINE'S. NOT ONE OF THEM IS TYPED INTO THE COPY.
 * ==============================================================================================
 *
 * `app/_sections/_sample-brief.ts` does this for the homepage panel and is the precedent this file
 * follows. It could not be REUSED: it computes one figure set at module scope, for `business:
 * "cafe"`, over rows committed inside it, and exports the result -- there is no exported function
 * taking a `BusinessType`. Parameterising it would mean editing that module, which belongs to the
 * homepage panel and to `sample-brief.test.tsx`. So this file repeats the PATTERN rather than the
 * data: illustrative rows in, `buildFigureSet` over them, and the engine's own rendering printed
 * verbatim.
 *
 * IT REFUSES AT BUILD TIME RATHER THAN RENDERING A FALLBACK. If the engine refuses a segment's rows,
 * or does not produce a figure a segment asks to print, `buildSegment` throws and `next build`
 * fails. A `?? "--"` here would put a dash on a landing page and tell nobody.
 *
 * THE ROWS CARRY NO CONVERSION METRIC, and that is the `attribution-required` claim honoured rather
 * than quoted. `InsightRow.dimensions` carries date, currency and timezone and has nowhere to put an
 * attribution window, and `envelopeRowSchema` refuses a conversion count without one. So the
 * advertising rows below carry `spend` and nothing that is attributed: printing "the ads brought in
 * X" from a row with no window would be the unlabelled conversion count the API is built to refuse,
 * printed on the page that sells the refusal.
 *
 * WHAT THE SAMPLE DOES AND DOES NOT PROVE. It proves the arithmetic on the page is the shipped
 * arithmetic. It proves nothing about a customer: there are none, the rows are illustrative, and
 * section 5.3 of the reconciliation note refuses an unlabelled example of a week's takings as
 * fabricated social proof. Hence `SAMPLE_BADGE` and `SAMPLE_NOTE`, which name no business, no owner
 * and no town.
 */

/* ==============================================================================================
 * SOURCES
 * ============================================================================================== */

/**
 * What each implemented source is called in prose.
 *
 * A SECOND COPY OF A PRIVATE MAP IN `packages/brand/src/claims.ts`, deliberately. That one is not
 * exported, brand is a leaf package, and the alternative -- deriving a label from the id -- prints
 * "Ga4". The type is `Record<ImplementedSourceId, string>`, so a connector added to the implemented
 * list is a compile error here until somebody decides what to call it, which is the only property
 * the shared copy would have bought.
 */
const SOURCE_LABELS: Readonly<Record<ImplementedSourceId, string>> = {
  ga4: "GA4",
  google_ads: "Google Ads",
  loyverse: "Loyverse",
  meta_ads: "Meta Ads",
  search_console: "Search Console",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

/**
 * The label for a source the engine attributed an action to, or a refusal.
 *
 * THE REFUSAL IS THE POINT. `RankedAction.source` is a `Source` -- the whole envelope vocabulary,
 * including `impact`, `awin` and `dataforseo_serp`, none of which is built. A page that printed
 * whatever came back would name an unimplemented platform the moment a future connector's rows
 * reached this module, and it would look exactly like the rest of the page while doing it.
 */
export function assertImplementedSource(source: string): ImplementedSourceId {
  const found = IMPLEMENTED_SOURCE_IDS.find((id) => id === source);
  if (found === undefined) {
    throw new Error(
      `for/_content: "${source}" is not in IMPLEMENTED_SOURCE_IDS, so this page may not name it. ` +
        "Build and export the connector before a segment is written against it -- do not add a " +
        "label here.",
    );
  }
  return found;
}

/* ==============================================================================================
 * COPY
 * ============================================================================================== */

/**
 * Every sentence these pages render that is not a claim and not a figure.
 *
 * `scripts/check-copy.mjs` refuses a JSX text node of five or more words ending in terminal
 * punctuation, so copy arrives from here and never from the markup. Eyebrows and labels are
 * fragments, which is why they carry no full stop.
 *
 * NOTHING HERE PROMISES A SCHEDULE, A LANGUAGE OR A DELIVERY. `/brief` is on demand and signed in --
 * its own module comment says why -- nothing in this repository is localised to Thai, and
 * `docs/marketplane/70-the-mail-nobody-can-send-yet.md` records that the zone holds no MX record, so
 * there is no inbox to arrive in. `segments.test.ts` refuses all three by pattern.
 */
export const FOR_COPY = {
  breadcrumbHome: "Home",

  briefHeading: "What it would say about your week",
  sampleBadge: "Sample figures",
  sampleNote:
    "Illustrative rows, not a customer. The figures are computed from them by the same code that will read yours, and no number below is typed into this page.",

  figuresLabel: "Figures computed from the rows, before any of them was written up",

  /**
   * The chart's accessible name. It says what the drawing IS FOR -- direction, not amount -- because
   * the chart deliberately prints no values and a reader who cannot see it would otherwise be told
   * a chart exists and never told that the numbers are in the list below it.
   *
   * No terminal punctuation: `scripts/check-copy.mjs` reads a human-visible attribute exactly as it
   * reads a paragraph, and refuses one that ends a sentence in five words or more.
   */
  rowsFigureLabel:
    "The same sample rows these figures were computed from, drawn one panel per account so the direction of each is visible; the amounts are printed in the list below rather than on the chart",
  actionHeading: "The one worth acting on",
  worthLabel: "What it is worth",

  /**
   * Which uncertainty the engine actually expressed, in its own three shapes. Which one renders is
   * `buildFigureSet`'s answer and not an editorial choice: a caption promising a range on a figure
   * the engine returned as a point would be describing a behaviour the code did not perform.
   */
  impactRange:
    "A range rather than a figure, because the settled rows and the full set disagree about how much of it is real yet.",
  impactAllProvisional:
    "A single figure, and there is no settled half to compare it against: every row behind it may still be restated.",
  impactSettled: "A single figure, because every row behind it is already settled.",

  allProvisionalNote:
    "Nothing here is final, and the product says so rather than implying otherwise. A receipt can be voided and an order refunded long after the day it belonged to, so every row from a till or a store stays open to change.",
  someSettledNote:
    "Each row carries the time it was read and a mark while the platform may still change it, so a figure that moved can be told from a figure that was wrong.",

  traceNote:
    "A figure in the write-up that cannot be traced back to one of these rows refuses the whole brief. It is not stripped out, rounded to something true, or asked for again in a sterner way.",

  readsEyebrow: "What it reads",
  readsHeading: "Your own accounts, on your own logins",

  ctaEyebrow: "Start reading your own numbers",
  ctaHeading: "Connect one account and ask",
  ctaBody:
    "Sign in, connect the accounts this page names, and ask for a brief when you want one. Nothing is written until you ask for it.",
  ctaLabel: "Sign in",
  ctaHref: "/signin",
  briefLinkLabel: "See the week",

  /** The free allowance, from `PLAN_ENTITLEMENTS` through the one function that formats it. */
  planLine: `The free plan carries ${connectionAllowance("free")}.`,
} as const;

/**
 * What each KIND of finding is, named from the detector that raises it in
 * `packages/insights/src/figures.ts` rather than from what would read well.
 *
 * COMPLETE OVER `ActionKind`, so a new detector cannot ship with no words for what it found. Only
 * `channel_decline` is reachable from the implemented connector set today, and that is worth writing
 * down: `commission_load` needs a source that emits `commission` and none does; `spend_without_return`
 * compares an advertising source's spend against takings ON THE SAME SOURCE, and no implemented
 * advertising connector reports takings; `weekday_gap` has a name in `ACTION_KINDS` and no detector
 * behind it at all.
 */
const ACTION_HEADLINE: Readonly<Record<ActionKind, (source: string) => string>> = {
  channel_decline: (source) => `Takings through ${source} fell against the week before.`,
  commission_load: (source) => `${source} kept part of every sale over the period.`,
  spend_without_return: (source) => `Spend on ${source} rose and what came back did not.`,
  weekday_gap: () => "One weekday earned less than the rest of the week.",
};

/* ==============================================================================================
 * THE SHAPE OF A SEGMENT
 * ============================================================================================== */

/** One figure as the page prints it: authored words, the engine's own rendering. */
export interface SegmentFigure {
  readonly id: string;
  /** Authored. What this figure is, in the segment's own vocabulary. */
  readonly label: string;
  /** The engine's rendering, verbatim. */
  readonly value: string;
  /** The engine's rendering of the change against the previous period, where one was asked for. */
  readonly change: string | null;
  /** Authored. What KIND of arithmetic produced it -- never a restatement of the number. */
  readonly note: string;
}

/** The top-ranked action, as the page prints it. */
export interface SegmentAction {
  readonly kind: ActionKind;
  readonly source: ImplementedSourceId;
  readonly headline: string;
  /** The engine's rendering of the impact, verbatim. */
  readonly worth: string;
  /** Which of the three uncertainty shapes the engine returned. */
  readonly shape: string;
}

/** What one source gives this segment, in that segment's own words. */
export interface SegmentRead {
  readonly source: ImplementedSourceId;
  readonly label: string;
  readonly what: string;
}

export interface SegmentDraft {
  readonly slug: string;
  readonly business: BusinessType;
  /** The breadcrumb's own label. Short, because a breadcrumb names a place rather than a promise. */
  readonly crumb: string;
  /** Head copy. `layout.tsx` appends the product name to the title, so this is the short half. */
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headingTop: string;
  readonly headingBottom: string;
  readonly lead: string;
  readonly reads: readonly { readonly source: ImplementedSourceId; readonly what: string }[];
  readonly briefLead: string;
  /**
   * The figures this segment prints, by the engine's own figure id. A id the engine did not produce
   * is a build failure rather than a blank line -- see `figureOf`.
   */
  readonly figures: readonly {
    readonly id: string;
    readonly label: string;
    readonly note: string;
    /** A second figure id whose text is printed beside the first, where a change is meaningful. */
    readonly changeId?: string;
  }[];
  readonly period: { readonly from: string; readonly to: string };
  readonly comparison: { readonly from: string; readonly to: string };
  readonly rows: readonly InsightRow[];
}

export interface Segment {
  readonly slug: string;
  readonly business: BusinessType;
  readonly crumb: string;
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headingTop: string;
  readonly headingBottom: string;
  readonly lead: string;
  readonly reads: readonly SegmentRead[];
  readonly briefLead: string;
  readonly figures: readonly SegmentFigure[];
  readonly action: SegmentAction;
  /** Every source this page names, which is what the test checks against the implemented list. */
  readonly sources: readonly ImplementedSourceId[];
  /** True when no row behind any figure is settled. The engine's flag, not a decision here. */
  readonly allProvisional: boolean;
  /** Kept so a test can license every number on the page against what the engine allowed. */
  readonly set: FigureSet;
  /**
   * THE ROWS THEMSELVES, carried through so the page can DRAW them.
   *
   * The figures above are the engine's answers; these are what it was asked. `SegmentRows` plots
   * them, which means the chart and the figure list beside it read the same array -- a chart that
   * disagreed with the number next to it would need somebody to have written a second set of rows,
   * and there is nowhere to write one.
   */
  readonly rows: readonly InsightRow[];
  /** The window the figures cover, and the one they are compared against. Both are the draft's. */
  readonly period: { readonly from: string; readonly to: string };
  readonly comparison: { readonly from: string; readonly to: string };
}

/* ==============================================================================================
 * THE ROWS
 * ============================================================================================== */

/**
 * One illustrative day.
 *
 * `is_provisional` DEFAULTS TO TRUE HERE, which is the opposite of the homepage sample and is not a
 * style preference. `RESTATEMENT_CLOCKS.loyverse` and `.woocommerce` both carry `windowDays: null`
 * -- a receipt can be voided and an order refunded at any remove, so no window ever closes and no
 * row from either is ever marked final. The advertising rows below cover the week just gone, which
 * is inside Meta's 28-day and Google's 30-day window, so those are open too. A default of `false`
 * would make every sample on this site quietly claim a settledness the connectors never report.
 */
function row(
  source: InsightRow["source"],
  date: string,
  metrics: InsightRow["metrics"],
  provisional = true,
): InsightRow {
  return {
    source,
    entity: { type: "account", id: `sample-${source}`, account_id: `sample-${source}` },
    dimensions: { date, currency: "THB", timezone: "Asia/Bangkok" },
    metrics,
    fetched_at: `${date}T23:30:00Z`,
    is_provisional: provisional,
  };
}

/** The week every segment measures, and the week it is measured against. */
const PERIOD = { from: "2026-09-07", to: "2026-09-13" } as const;
const COMPARISON = { from: "2026-08-31", to: "2026-09-06" } as const;

/* ==============================================================================================
 * THE SEGMENTS
 * ============================================================================================== */

const DRAFTS: readonly SegmentDraft[] = [
  /**
   * A CAFÉ, ON A LOYVERSE TILL.
   *
   * `packages/connectors/src/sources/loyverse` emits exactly two metrics -- `revenue` and `orders`,
   * one row per receipt -- and its own module note records why average ticket is NOT among them: it
   * is revenue over receipts, computed at read. This segment prints that division because it is the
   * number a counter business actually watches, and it is the engine's `derived.average_ticket`
   * rather than a sum this page performed.
   *
   * The advertising is Meta Ads, and it contributes `spend` only. See the module note on why no row
   * here carries a conversion.
   */
  {
    slug: "cafe",
    crumb: "Cafés",
    business: "cafe",
    title: "Café takings, read from your own till",
    description:
      "A café's week from its own Loyverse receipts and its own Meta Ads account: what the counter took, the average ticket, what the advertising cost, and the one thing the arithmetic found worth acting on.",
    eyebrow: "For cafés and coffee bars",
    headingTop: "Your counter took this much.",
    headingBottom: "Here is what moved.",
    // "WORK OUT WHAT THE AVERAGE TICKET DID" WAS A CLAIM ABOUT A CHANGE THE ENGINE NEVER COMPUTES.
    // `ticketFigures` emits `derived.average_ticket` for the CURRENT period only -- no previous, no
    // delta, no share -- unlike every `metric.*`, which gets all three. The card below this lead
    // already described it correctly, which is how the lead got away with it.
    lead: "The till already knows what every day took. What it does not do is compare this week with last, put the advertising beside it, work out the price of an average sale, and tell you which of those is worth your morning.",
    reads: [
      {
        source: "loyverse",
        // A REFUND IS A SECOND RECEIPT, NOT A MUTATION OF THE FIRST -- the connector's own trap 2
        // says so in capitals, and it carries its own date. Only a VOID reopens the day the
        // original belonged to. The salon card below already had this right.
        what: "Every receipt, as the till rang it: what the day took and how many receipts it took it over. A refund is rung as its own receipt on its own day, and a voided receipt reopens the day it belonged to, so no day is ever marked final.",
      },
      {
        source: "meta_ads",
        // NOT "the same currency as the till" AND NOT "the same calendar". Nothing converts: the FX
        // package has no importer at all, so a set of figures that mixes currencies is REFUSED
        // rather than converted. Saying the two arrive aligned promised a join the data cannot do.
        what: "What the advertising account spent, day by day, in whatever currency and calendar the advertising account itself reports in. Nothing is converted, and a brief whose figures do not share one currency is refused rather than guessed at.",
      },
    ],
    briefLead:
      "One week of receipts against the week before it, with the advertising alongside. Every figure was computed before a word was written about it.",
    figures: [
      {
        id: "metric.revenue",
        label: "Through the till",
        note: "Summed from the receipts in the week, and compared with the same length of week before it.",
        changeId: "metric.revenue.delta_share",
      },
      {
        id: "derived.average_ticket",
        label: "Average ticket",
        note: "Takings divided by receipts, worked out when the brief is built rather than stored as a number somebody rounded.",
      },
      {
        id: "metric.spend",
        label: "Spent on advertising",
        note: "Summed from the advertising rows for the same days, and kept apart from the takings rather than netted off them.",
      },
    ],
    period: PERIOD,
    comparison: COMPARISON,
    rows: [
      row("loyverse", "2026-09-07", { revenue: 14_880, orders: 189 }),
      row("loyverse", "2026-09-08", { revenue: 13_600, orders: 177 }),
      row("loyverse", "2026-09-09", { revenue: 12_860, orders: 164 }),
      row("meta_ads", "2026-09-07", { spend: 980 }),
      row("meta_ads", "2026-09-08", { spend: 1_120 }),
      row("meta_ads", "2026-09-09", { spend: 860 }),

      row("loyverse", "2026-08-31", { revenue: 16_020, orders: 203 }),
      row("loyverse", "2026-09-01", { revenue: 15_340, orders: 196 }),
      row("loyverse", "2026-09-02", { revenue: 14_580, orders: 188 }),
      row("meta_ads", "2026-08-31", { spend: 910 }),
      row("meta_ads", "2026-09-01", { spend: 950 }),
      row("meta_ads", "2026-09-02", { spend: 880 }),
    ],
  },

  /**
   * AN ONLINE SHOP, ON ITS OWN WOOCOMMERCE STORE.
   *
   * THE FEE IS THE WHOLE REASON THIS SEGMENT IS DIFFERENT. `normalizeWooOrders` emits `fees` and
   * `net_revenue` ONLY on an order whose payment fee is knowable, and `takingsMetric` leads with net
   * only when net covers every row gross covers. The rows below carry a fee on every order for that
   * reason: takings after the gateway's cut is then a figure the store reported rather than a
   * percentage this page assumed.
   *
   * The advertising is Google Ads, contributing `spend`.
   */
  {
    slug: "online-shop",
    crumb: "Online shops",
    business: "online_seller",
    title: "Online shop takings, after what the gateway kept",
    description:
      "A week of a WooCommerce store read on your own key: gross orders, the payment fees taken out of them, what is left, and the one change worth acting on. No figure on the page was typed into it.",
    eyebrow: "For shops selling on their own site",
    headingTop: "What the store took.",
    headingBottom: "And what you kept.",
    // STATED UNCONDITIONALLY, AND IT IS CONDITIONAL. `fees` and `net_revenue` are emitted only for
    // an order carrying fee metadata a gateway wrote onto it, and this site's own WooCommerce page
    // records that most gateways write nothing at all. The read card below was already honest about
    // it ("Where the gateway reports what it took"); the lead promised it to everybody, which means
    // the page's central promise failed for most visitors on their first attempt.
    lead: "Your store reports what an order was worth. The gateway takes its cut somewhere else, and the difference is the number you actually live on. Where your gateway writes its fee onto the order, this keeps the two apart rather than folding them together -- and where it writes nothing, it says so instead of estimating.",
    reads: [
      {
        source: "woocommerce",
        what: "Orders from your own store, with a key you issue in your own admin. Where the gateway reports what it took, the fee is carried on the order and takings after it becomes a figure rather than an estimate.",
      },
      {
        source: "google_ads",
        what: "What the advertising account spent, day by day, on the advertising account's own calendar. Nothing is shifted to line up with the orders.",
      },
    ],
    briefLead:
      "One week of orders against the week before it, with the fees separated from the takings rather than folded into them.",
    figures: [
      {
        id: "metric.net_revenue",
        label: "Yours, after the fee",
        note: "Summed from the orders that reported what the gateway kept, and compared with the week before it.",
        changeId: "metric.net_revenue.delta_share",
      },
      {
        id: "metric.fees",
        label: "Kept by the gateway",
        note: "Summed from the same orders, in its own line, because a cost folded into a total is a cost nobody can act on.",
      },
      {
        id: "metric.orders",
        label: "Orders placed",
        note: "A count of the orders in the week. A refund moves the money and leaves the order where it was.",
      },
    ],
    period: PERIOD,
    comparison: COMPARISON,
    rows: [
      row("woocommerce", "2026-09-07", {
        revenue: 23_400,
        fees: 772,
        net_revenue: 22_628,
        orders: 41,
      }),
      row("woocommerce", "2026-09-08", {
        revenue: 21_150,
        fees: 698,
        net_revenue: 20_452,
        orders: 37,
      }),
      row("woocommerce", "2026-09-09", {
        revenue: 19_800,
        fees: 653,
        net_revenue: 19_147,
        orders: 35,
      }),
      row("google_ads", "2026-09-07", { spend: 1_450 }),
      row("google_ads", "2026-09-08", { spend: 1_380 }),
      row("google_ads", "2026-09-09", { spend: 1_510 }),

      row("woocommerce", "2026-08-31", {
        revenue: 26_900,
        fees: 888,
        net_revenue: 26_012,
        orders: 47,
      }),
      row("woocommerce", "2026-09-01", {
        revenue: 25_300,
        fees: 835,
        net_revenue: 24_465,
        orders: 44,
      }),
      row("woocommerce", "2026-09-02", {
        revenue: 24_050,
        fees: 794,
        net_revenue: 23_256,
        orders: 42,
      }),
      row("google_ads", "2026-08-31", { spend: 1_190 }),
      row("google_ads", "2026-09-01", { spend: 1_240 }),
      row("google_ads", "2026-09-02", { spend: 1_160 }),
    ],
  },

  /**
   * A SALON, ON A LOYVERSE TILL WITH A WEBSITE IN FRONT OF IT.
   *
   * `LEADING.salon` in `figures.ts` is the reason this is a segment rather than a second café page:
   * it leads with revenue, orders, net revenue, spend and SESSIONS, and GA4 is the implemented
   * source that reports sessions. So the week reads as takings, the price of a visit, and how many
   * people came to the site -- three different connectors, none of them inferred from another.
   *
   * NOTHING HERE JOINS A SESSION TO A RECEIPT, and the copy does not imply it. That join needs an
   * identity the envelope does not carry, and claiming it would be the confident wrong number this
   * repository is organised against.
   */
  {
    slug: "salon",
    crumb: "Salons",
    business: "salon",
    title: "Salon takings, the price of a visit, and the site in front of it",
    description:
      "A salon's week read from its own Loyverse till, its own Google Ads account and its own GA4 property: takings against last week, the average visit, sessions on the site, and one thing worth doing.",
    eyebrow: "For salons and treatment rooms",
    headingTop: "What the week took,",
    headingBottom: "and what a visit is worth.",
    // "HOW MANY PEOPLE REACHED THE SITE" -- sessions are not people. The dictionary defines
    // `sessions` as the property's own count of sessions, explicitly parallel to `orders` being the
    // shop's own count: nothing is attributed and nothing is deduplicated to a person, so one
    // visitor generates many. The same page says so twice below the fold.
    lead: "Takings, the price of an average visit, and how many visits the site had that week. Separate accounts, read on your own logins, with nothing joined up that the data cannot actually join.",
    reads: [
      {
        source: "loyverse",
        what: "Every receipt the till rang: what the day took and how many visits it took it over. A voided receipt reopens its day, so nothing is marked final.",
      },
      {
        source: "google_ads",
        what: "What the advertising account spent, day by day, in whatever currency the advertising account itself reports in. Nothing is converted between one source and another.",
      },
      {
        source: "ga4",
        what: "Sessions on your own website, counted by your own analytics property. A session is a visit to the site and is never presented as a booking.",
      },
    ],
    briefLead:
      "One week against the week before it, with the site traffic beside the takings rather than mixed into them.",
    figures: [
      {
        id: "metric.revenue",
        label: "Taken over the week",
        note: "Summed from the receipts, and compared with the same length of week before it.",
        changeId: "metric.revenue.delta_share",
      },
      {
        id: "derived.average_ticket",
        label: "Average visit",
        note: "Takings divided by receipts, worked out when the brief is built rather than carried as a stored average.",
      },
      {
        id: "metric.sessions",
        label: "Sessions on the site",
        note: "Summed from your own analytics property for the same days, and left as what it is: visits to a website.",
      },
    ],
    period: PERIOD,
    comparison: COMPARISON,
    rows: [
      row("loyverse", "2026-09-07", { revenue: 9_900, orders: 30 }),
      row("loyverse", "2026-09-08", { revenue: 8_910, orders: 27 }),
      row("loyverse", "2026-09-09", { revenue: 7_590, orders: 23 }),
      row("google_ads", "2026-09-07", { spend: 640 }),
      row("google_ads", "2026-09-08", { spend: 705 }),
      row("google_ads", "2026-09-09", { spend: 590 }),
      row("ga4", "2026-09-07", { sessions: 412 }),
      row("ga4", "2026-09-08", { sessions: 388 }),
      row("ga4", "2026-09-09", { sessions: 341 }),

      row("loyverse", "2026-08-31", { revenue: 10_560, orders: 32 }),
      row("loyverse", "2026-09-01", { revenue: 9_900, orders: 30 }),
      row("loyverse", "2026-09-02", { revenue: 9_240, orders: 28 }),
      row("google_ads", "2026-08-31", { spend: 610 }),
      row("google_ads", "2026-09-01", { spend: 655 }),
      row("google_ads", "2026-09-02", { spend: 620 }),
      row("ga4", "2026-08-31", { sessions: 436 }),
      row("ga4", "2026-09-01", { sessions: 401 }),
      row("ga4", "2026-09-02", { sessions: 377 }),
    ],
  },
];

/* ==============================================================================================
 * BUILDING ONE
 * ============================================================================================== */

function figureOf(set: FigureSet, id: string, slug: string): Figure {
  const found = set.figures.find((figure) => figure.id === id);
  if (found === undefined) {
    throw new Error(
      `for/_content: the engine produced no figure "${id}" for the "${slug}" segment. The page ` +
        "cannot print a number the engine did not compute -- change the rows, or print a figure " +
        "the engine actually returned.",
    );
  }
  return found;
}

/** Which of the three uncertainty shapes the engine returned for an impact. */
function shapeOf(impact: Estimate): string {
  if (impact.kind === "range") return FOR_COPY.impactRange;
  return impact.allProvisional ? FOR_COPY.impactAllProvisional : FOR_COPY.impactSettled;
}

/**
 * One segment, with its figures computed.
 *
 * EXPORTED FOR THE TEST AND FOR NO OTHER CALLER. `segments.test.ts` hands it a draft asking for a
 * figure the engine does not produce and a draft whose rows raise no action, and asserts that each
 * refuses. A refusal nothing tests is one the next person deletes.
 */
export function buildSegment(draft: SegmentDraft): Segment {
  const result = buildFigureSet({
    business: draft.business,
    period: draft.period,
    comparison: draft.comparison,
    rows: draft.rows,
    // NO_PRIORS, AND SAYING SO. Feedback silences detectors an owner has declined; this page shows
    // what a new customer's first week looks like, and nobody has declined anything yet.
    priors: NO_PRIORS,
  });
  if (!result.ok) {
    throw new Error(
      `for/_content: the insight engine refused the "${draft.slug}" rows (${result.code}: ` +
        `${result.detail}). Fix the rows or the engine -- do not render a placeholder figure on a ` +
        "landing page.",
    );
  }
  const set = result.set;

  const figures = draft.figures.map((wanted) => ({
    id: wanted.id,
    label: wanted.label,
    value: figureOf(set, wanted.id, draft.slug).text,
    change: wanted.changeId === undefined ? null : figureOf(set, wanted.changeId, draft.slug).text,
    note: wanted.note,
  }));

  // THE TOP ACTION IS `actions[0]` AND IS READ, NEVER CHOSEN. "Ordered by value, biggest first" is a
  // promise the engine makes about the data, so picking any other index would be this page quietly
  // reordering a ranking it is advertising.
  const top = set.actions[0];
  if (top === undefined) {
    throw new Error(
      `for/_content: the engine raised no action from the "${draft.slug}" rows, so the page has ` +
        "nothing to show as the thing worth doing. Adjust the rows until the arithmetic finds " +
        "something -- do not write one.",
    );
  }
  if (top.source === null) {
    throw new Error(
      `for/_content: the top action for "${draft.slug}" is about no source, and every headline ` +
        "this page can print names one.",
    );
  }
  const source = assertImplementedSource(top.source);

  return {
    slug: draft.slug,
    business: draft.business,
    crumb: draft.crumb,
    title: draft.title,
    description: draft.description,
    eyebrow: draft.eyebrow,
    headingTop: draft.headingTop,
    headingBottom: draft.headingBottom,
    lead: draft.lead,
    reads: draft.reads.map((read) => ({
      source: read.source,
      label: SOURCE_LABELS[read.source],
      what: read.what,
    })),
    briefLead: draft.briefLead,
    figures,
    action: {
      kind: top.kind,
      source,
      headline: ACTION_HEADLINE[top.kind](SOURCE_LABELS[source]),
      worth: top.impactFigure.text,
      shape: shapeOf(top.impact),
    },
    sources: draft.reads.map((read) => read.source),
    allProvisional: set.allProvisional,
    set,
    rows: draft.rows,
    period: draft.period,
    comparison: draft.comparison,
  };
}

export const SEGMENTS: readonly Segment[] = DRAFTS.map(buildSegment);

export const SEGMENT_SLUGS: readonly string[] = SEGMENTS.map((segment) => segment.slug);

/** The segment a route parameter names, or undefined. The route refuses the undefined. */
export function segmentBySlug(slug: string): Segment | undefined {
  return SEGMENTS.find((segment) => segment.slug === slug);
}

/**
 * The three approved sentences these pages carry, resolved through the claims list.
 *
 * `claim()` throws on an unknown or withheld id, which is what stops a promise going round the
 * allowed-claims list by being typed into a page. All three are allowed today: `connectors` is
 * composed from IMPLEMENTED_SOURCE_IDS itself, and neither of the other two is gated on a brand fact
 * or a capability.
 */
export const FOR_CLAIMS = {
  connectors: claim("connectors"),
  // NOT `claim("read-only-oauth")`. That sentence is true of the platforms this product reaches
  // through an authorisation server, and the online-shop page's only connector is not one of them:
  // WooCommerce has a single lane, a key and secret the merchant issues in its own admin, and this
  // site's own WooCommerce page advertises having no OAuth as a FEATURE. Rendering the claim there
  // contradicted the connector page it links to.
  //
  // What is true of every lane is what is said instead: the credential is the merchant's, it is
  // read access, and they can take it back without asking us.
  readOnly:
    "Read access, on a credential you issue yourself and can revoke whenever you like. No password of yours is ever typed into this product.",
  noTraining: claim("no-training"),
} as const;
