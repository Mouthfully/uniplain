import { FORBIDDEN_CLAIMS, IMPLEMENTED_SOURCE_IDS } from "@repo/brand";
import { type InsightRow, allowedNumbers, canonicalNumber, numericTokens } from "@repo/insights";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PLAN_ENTITLEMENTS } from "../_billing/entitlements";
import SegmentPage, { generateMetadata, generateStaticParams } from "./[segment]/page";
import {
  FOR_COPY,
  SEGMENTS,
  type Segment,
  type SegmentDraft,
  assertImplementedSource,
  buildSegment,
} from "./_content";

/**
 * THE SEGMENT PAGES, CHECKED AGAINST WHAT THE PRODUCT CAN ACTUALLY DO.
 *
 * A landing page for a kind of business is a promise that this product can read that business's
 * numbers. Every check below is one way that promise could be false while the page still looked
 * finished:
 *
 *   a source named that nobody built            -> the visitor connects nothing and leaves
 *   a figure typed in because it read better    -> the page argues for traceable arithmetic in
 *                                                  words and breaks it in the same card
 *   a capability promised that does not exist   -> discovered on the first attempt, which is the
 *                                                  most expensive moment to discover it
 *   two pages with one description              -> two of our own pages competing in search
 *
 * The shape is borrowed from `_sections/sample-brief.test.tsx` (every number licensed by the engine)
 * and `_sections/faq.test.tsx` (no unbuilt capability, no unimplemented platform), because both
 * failures have already happened on this site once.
 */

/* ----------------------------------------------------------------------------------------------
 * RENDERING
 * -------------------------------------------------------------------------------------------- */

/**
 * The `<main>` of one segment page, as text.
 *
 * SCOPED TO `<main>` DELIBERATELY. `Footer` renders the imprint -- a postcode and a company
 * registration number -- which are identifiers from `@repo/brand` rather than figures this page
 * asserts, and licensing them here would mean licensing every digit the chrome will ever carry.
 * What this file is about is the copy and the figures of the page itself.
 *
 * Decorative elements are stripped first, the same line `sample-brief.test.tsx` draws: what a screen
 * reader skips is not something the page asserts.
 */
async function mainTextOf(slug: string): Promise<string> {
  const markup = renderToStaticMarkup(
    await SegmentPage({ params: Promise.resolve({ segment: slug }) }),
  );
  const main = /<main[^>]*>([\s\S]*)<\/main>/.exec(markup);
  expect(main, `no <main> rendered for /for/${slug}`).not.toBeNull();
  return (main?.[1] ?? "")
    .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&rarr;/g, " ")
    .replace(/\s+/g, " ");
}

const RENDERED = new Map<string, string>(
  await Promise.all(
    SEGMENTS.map(async (segment) => [segment.slug, await mainTextOf(segment.slug)] as const),
  ),
);

function textOf(segment: Segment): string {
  const text = RENDERED.get(segment.slug);
  if (text === undefined) throw new Error(`no markup captured for ${segment.slug}`);
  return text;
}

/**
 * Every string this page authored, per segment -- and NOT the figures, which come from the engine.
 * The split is the point of the digit check below: copy is what a person writes, and a person
 * writing a number here is the defect.
 */
function copyOf(segment: Segment): string[] {
  return [
    segment.title,
    segment.description,
    segment.crumb,
    segment.eyebrow,
    segment.headingTop,
    segment.headingBottom,
    segment.lead,
    segment.briefLead,
    segment.action.headline,
    segment.action.shape,
    ...segment.figures.flatMap((figure) => [figure.label, figure.note]),
    ...segment.reads.flatMap((read) => [read.label, read.what]),
  ];
}

/* ----------------------------------------------------------------------------------------------
 * THE SOURCES
 * -------------------------------------------------------------------------------------------- */

describe("every segment is built on a connector that exists", () => {
  it("has segments to check, so a green run is not vacuous", () => {
    expect(SEGMENTS.length).toBeGreaterThan(1);
  });

  it("names only sources in IMPLEMENTED_SOURCE_IDS", () => {
    const implemented = new Set<string>(IMPLEMENTED_SOURCE_IDS);
    for (const segment of SEGMENTS) {
      expect(segment.sources.length, `${segment.slug} names no source at all`).toBeGreaterThan(0);
      for (const source of segment.sources) {
        expect(implemented.has(source), `${segment.slug} names ${source}`).toBe(true);
      }
      // The action's source is the engine's answer rather than the draft's, so it is checked
      // separately: a detector firing on a source this page never listed would still print its name.
      expect(
        implemented.has(segment.action.source),
        `${segment.slug} acts on ${segment.action.source}`,
      ).toBe(true);
    }
  });

  it("refuses a source that is not implemented", () => {
    // `apps/web/app/connectors/shopify` is a real page for a connector that does not exist in
    // `IMPLEMENTED_SOURCE_IDS`, which is exactly the kind of near-miss this refusal is for.
    expect(() => assertImplementedSource("shopify")).toThrow(/IMPLEMENTED_SOURCE_IDS/);
    expect(() => assertImplementedSource("dataforseo_serp")).toThrow(/IMPLEMENTED_SOURCE_IDS/);
  });

  /**
   * Platforms an owner in this market would expect and this product cannot read. Taken from
   * `_sections/faq.test.tsx`, which keeps the same list for the same reason: naming one here is a
   * promise the visitor tests by connecting it.
   */
  const UNIMPLEMENTED = [
    "Shopify",
    "Lazada",
    "Shopee",
    "foodpanda",
    "StoreHub",
    "QuickBooks",
    "FlowAccount",
    "Stripe",
    "Omise",
    "TikTok",
    "Klaviyo",
    "Mailchimp",
    "DataForSEO",
    "Booking.com",
    "Agoda",
  ];
  const UNIMPLEMENTED_CASE_SENSITIVE = ["Grab", "LINE"];

  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s names no platform this product cannot read",
    (_slug, segment) => {
      const text = textOf(segment);
      for (const name of UNIMPLEMENTED) {
        expect(text, `${name} is not a source this product reads`).not.toMatch(
          new RegExp(`\\b${name.replace(/\./g, "\\.")}\\b`, "i"),
        );
      }
      for (const name of UNIMPLEMENTED_CASE_SENSITIVE) {
        expect(text, `${name} is not a source this product reads`).not.toMatch(
          new RegExp(`\\b${name}\\b`),
        );
      }
    },
  );
});

/* ----------------------------------------------------------------------------------------------
 * THE BAN LIST
 * -------------------------------------------------------------------------------------------- */

describe("no segment carries a forbidden claim", () => {
  it.each(FORBIDDEN_CLAIMS.map((entry) => [entry.pattern.source, entry] as const))(
    "nothing rendered matches %s",
    (_source, forbidden) => {
      const hits: string[] = [];
      for (const segment of SEGMENTS) {
        // The rendered page AND the copy record, because a string can be in the record and not yet
        // on the page -- and a forbidden phrase one edit away from rendering is still forbidden.
        for (const text of [textOf(segment), ...copyOf(segment)]) {
          if (new RegExp(forbidden.pattern.source, forbidden.pattern.flags).test(text)) {
            hits.push(`${segment.slug}: ${text.slice(0, 120)}`);
          }
        }
      }
      expect(hits, forbidden.reason).toEqual([]);
    },
  );

  it("states no count of sources, spelled or in digits", () => {
    // `check-claim-sources.mjs` and FORBIDDEN_CLAIMS between them refuse "22 integrations" and
    // "200+ integrations". Neither sees "six connectors", and a segment page listing what it reads
    // is the most natural place on this site for somebody to write it.
    const counted =
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:sources|integrations|connectors|platforms)\b/i;
    for (const segment of SEGMENTS) {
      expect(textOf(segment), `${segment.slug} counts what it reads`).not.toMatch(counted);
    }
  });
});

/* ----------------------------------------------------------------------------------------------
 * THE NUMBERS
 * -------------------------------------------------------------------------------------------- */

/**
 * Digits that are part of a NAME rather than a quantity.
 *
 * `allowedNumbers` in the engine makes exactly this concession for the same reason -- a brief that
 * named GA4 as the source of a figure would otherwise be refused for writing "4". Here it is needed
 * because the `connectors` claim names every implemented source on every one of these pages.
 */
const NAME_DIGITS = new Set(
  IMPLEMENTED_SOURCE_IDS.flatMap((id) => id.match(/\d+/g) ?? []).flatMap((run) => {
    const canonical = canonicalNumber(run);
    return canonical === null ? [] : [canonical];
  }),
);

/** Every allowance `PLAN_ENTITLEMENTS` publishes. The call to action quotes the free one. */
const PLAN_DIGITS = new Set(
  Object.values(PLAN_ENTITLEMENTS).map((entitlement) => String(entitlement.connections.count)),
);

describe("every number on a segment page came out of the insight engine", () => {
  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s renders numbers at all, so a green run is not vacuous",
    (_slug, segment) => {
      expect(numericTokens(textOf(segment)).length).toBeGreaterThan(3);
    },
  );

  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s licenses every one of them against the figure set the engine returned",
    (_slug, segment) => {
      const allowed = allowedNumbers(segment.set);
      const unlicensed = [
        ...new Set(
          numericTokens(textOf(segment)).filter((token) => {
            const canonical = canonicalNumber(token);
            if (canonical === null) return true;
            return (
              !allowed.has(canonical) && !NAME_DIGITS.has(canonical) && !PLAN_DIGITS.has(canonical)
            );
          }),
        ),
      ];
      expect(
        unlicensed,
        "A figure on a segment page is not one the engine computed from that segment's rows, and " +
          "is not an allowance from PLAN_ENTITLEMENTS either. Either the rows changed, the engine " +
          "changed, or a number was typed into the page -- and the third is what this test exists " +
          "to stop.",
      ).toEqual([]);
    },
  );

  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s prints the engine's renderings verbatim, not a re-formatted copy",
    (_slug, segment) => {
      const text = textOf(segment);
      for (const figure of segment.figures) {
        expect(text, `${figure.label} is not on the page`).toContain(figure.value);
        if (figure.change !== null) expect(text).toContain(figure.change);
      }
      expect(text).toContain(segment.action.worth);
    },
  );

  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s writes no number into its copy",
    (_slug, segment) => {
      // THE OTHER DIRECTION OF THE SAME RULE. The check above licenses what RENDERS; this one says
      // the authored half may not contain a quantity at all, so a figure can only reach the page
      // through the engine. A source's own name is allowed to carry a digit and nothing else is.
      for (const line of copyOf(segment)) {
        let stripped = line;
        for (const source of segment.reads) stripped = stripped.split(source.label).join(" ");
        expect(stripped, `a number is typed into "${line.slice(0, 60)}"`).not.toMatch(/\d/);
      }
    },
  );

  it("quotes the free allowance from the entitlement record rather than typing it", () => {
    const free = String(PLAN_ENTITLEMENTS.free.connections.count);
    expect(FOR_COPY.planLine).toContain(free);
    for (const segment of SEGMENTS) expect(textOf(segment)).toContain(FOR_COPY.planLine);
  });
});

/* ----------------------------------------------------------------------------------------------
 * CAPABILITIES THAT DO NOT EXIST
 * -------------------------------------------------------------------------------------------- */

/**
 * Each pattern is a sentence somebody would write next on a page like this, with the file that
 * proves the capability is absent. The first three are the register
 * `docs/marketplane/65-the-deletion-pass.md` and `70-the-mail-nobody-can-send-yet.md` set for this
 * whole site, and all three would be discovered by a customer on their first attempt.
 */
const UNBUILT = [
  {
    pattern: /\be-?mails?\b|\be-?mailed\b|\binbox\b|\bmailbox\b/i,
    reason:
      "No mail can be sent. docs/marketplane/70-the-mail-nobody-can-send-yet.md verifies the zone " +
      "holds neither an MX nor a TXT record, and packages/email has no caller.",
  },
  {
    pattern: /\b(?:in|into|to)\s+thai\b|\bthai[-\s](?:language|interface|version|copy)\b/i,
    reason:
      "NOTHING IN THIS REPOSITORY IS LOCALISED TO THAI -- not a string table, not a locale, not a " +
      "model instruction. 65-the-deletion-pass.md removed this exact promise from the FAQ once.",
  },
  {
    // The baht sign U+0E3F sits in the Thai block and is CURRENCY. These pages print money through
    // the engine, which renders "THB" rather than the sign, so no exception is needed here.
    pattern: /[ก-฾เ-๛]/,
    reason:
      "Thai script would be an interface promise made in the language itself, and there is no " +
      "localisation behind it.",
  },
  {
    pattern:
      /\bwe.?ll send\b|\bwill arrive\b|\bdelivered (?:each|every)\b|\bsent (?:each|every)\b|\b(?:each|every)\s+(?:morning|monday)\b|\bon a schedule\b|\bscheduled\b/i,
    reason:
      "Nothing schedules a brief. /brief is on demand and signed in, and its own module comment " +
      "says so: there is no cron calling the engine and no channel to deliver through. The only " +
      "schedule in the codebase is app.due_connections, which decides when a connection is PULLED.",
  },
  {
    pattern: /\b(?:alert|alerts|notif\w+)\b/i,
    reason:
      "The verified-alerts claim is withheld -- surface:verified-alerts is not in " +
      "AVAILABLE_CAPABILITIES -- and nothing watches a figure between one request and the next. " +
      "docs/marketplane/65-the-deletion-pass.md records that restating a withheld claim in your " +
      "own words is the failure this rule exists for.",
  },
  {
    pattern: /\b(?:export|download)\W{0,12}(?:your|all|a\W{0,4}copy\W{0,4}of)\b/i,
    reason: "AGENTS.md gap 6: there is no export route and no report writer anywhere in apps/web.",
  },
  {
    pattern: /\b(?:predict|predicts|forecast\w*|projection)\b/i,
    reason:
      "Nothing forecasts anything. packages/insights computes a period against a previous period " +
      "and ranks what it finds; there is no model of the future anywhere in the repository.",
  },
];

describe("no segment promises a capability the product does not have", () => {
  it.each(
    SEGMENTS.flatMap((segment) =>
      UNBUILT.map((entry) => [segment.slug, entry.pattern.source, segment, entry] as const),
    ),
  )("%s matches nothing for %s", (_slug, _pattern, segment, entry) => {
    expect(textOf(segment), entry.reason).not.toMatch(entry.pattern);
  });
});

/* ----------------------------------------------------------------------------------------------
 * TWO PAGES, NOT ONE PAGE TWICE
 * -------------------------------------------------------------------------------------------- */

describe("no two segments compete with each other in search", () => {
  it("gives every segment its own slug, title and description", () => {
    for (const field of ["slug", "title", "description"] as const) {
      const values = SEGMENTS.map((segment) => segment[field]);
      expect(new Set(values).size, `two segments share a ${field}`).toBe(values.length);
      for (const value of values) expect(value.length).toBeGreaterThan(0);
    }
  });

  it("gives every segment its own heading and lead", () => {
    // A distinct description over an identical page is still one page twice: what a visitor reads
    // has to differ too, not only what the crawler is told.
    const headings = SEGMENTS.map((segment) => `${segment.headingTop} ${segment.headingBottom}`);
    expect(new Set(headings).size).toBe(headings.length);
    const leads = SEGMENTS.map((segment) => segment.lead);
    expect(new Set(leads).size).toBe(leads.length);
  });

  it("publishes each segment's own metadata, with its own canonical", async () => {
    for (const segment of SEGMENTS) {
      const metadata = await generateMetadata({
        params: Promise.resolve({ segment: segment.slug }),
      });
      expect(metadata.title).toBe(segment.title);
      expect(metadata.description).toBe(segment.description);
      expect(metadata.alternates?.canonical).toBe(`/for/${segment.slug}`);
      // These are pages meant to be found. A noindex here would make the whole unit pointless, and
      // it is one line to add by accident when copying another route's metadata block.
      expect(metadata.robots).toBeUndefined();
    }
  });

  it("generates a route for every segment and nothing else", () => {
    expect(generateStaticParams().map((entry) => entry.segment)).toEqual(
      SEGMENTS.map((segment) => segment.slug),
    );
  });
});

/* ----------------------------------------------------------------------------------------------
 * THE REFUSALS
 * -------------------------------------------------------------------------------------------- */

/** A minimal draft, so each refusal below differs from a working one in exactly one way. */
function draft(over: Partial<SegmentDraft>): SegmentDraft {
  const rows: readonly InsightRow[] = [
    sample("2026-09-07", 14_000, 180),
    sample("2026-09-08", 13_000, 170),
    sample("2026-08-31", 16_000, 200),
    sample("2026-09-01", 15_000, 190),
  ];
  return {
    slug: "test",
    crumb: "c",
    business: "cafe",
    title: "t",
    description: "d",
    eyebrow: "e",
    headingTop: "h",
    headingBottom: "h",
    lead: "l",
    reads: [{ source: "loyverse", what: "w" }],
    briefLead: "b",
    figures: [{ id: "metric.revenue", label: "r", note: "n" }],
    period: { from: "2026-09-07", to: "2026-09-13" },
    comparison: { from: "2026-08-31", to: "2026-09-06" },
    rows,
    ...over,
  };
}

function sample(date: string, revenue: number, orders: number): InsightRow {
  return {
    source: "loyverse",
    entity: { type: "account", id: "t", account_id: "t" },
    dimensions: { date, currency: "THB", timezone: "Asia/Bangkok" },
    metrics: { revenue, orders },
    fetched_at: `${date}T23:30:00Z`,
    is_provisional: true,
  };
}

describe("a segment refuses rather than rendering a gap", () => {
  it("builds at all from the minimal draft, so the refusals below are about one change each", () => {
    expect(() => buildSegment(draft({}))).not.toThrow();
  });

  it("refuses a figure the engine did not compute", () => {
    expect(() =>
      buildSegment(draft({ figures: [{ id: "metric.moonshine", label: "m", note: "n" }] })),
    ).toThrow(/produced no figure/);
  });

  it("refuses rows the engine itself refuses", () => {
    expect(() => buildSegment(draft({ rows: [] }))).toThrow(/refused/);
  });

  it("refuses rows that raise no action, rather than showing a week with nothing to do", () => {
    // Takings ROSE here, so no detector fires. A page that shrugged and printed the figures without
    // the action would be selling "one thing worth doing" above a card that never does it.
    const rising: readonly InsightRow[] = [
      sample("2026-09-07", 20_000, 200),
      sample("2026-08-31", 10_000, 100),
    ];
    expect(() => buildSegment(draft({ rows: rising }))).toThrow(/raised no action/);
  });
});

describe("the card describes the uncertainty the engine actually returned", () => {
  it.each(SEGMENTS.map((segment) => [segment.slug, segment] as const))(
    "%s captions the impact with the shape it has",
    (_slug, segment) => {
      // A caption promising a range under a point estimate -- or the reverse -- is copy describing
      // an arithmetic the code did not perform, which is the same defect as a wrong number.
      const action = segment.set.actions[0];
      expect(action).toBeDefined();
      const impact = action?.impact;
      if (impact?.kind === "range") {
        expect(segment.action.shape).toBe(FOR_COPY.impactRange);
        expect(segment.action.worth).toContain(" to ");
      } else if (impact?.kind === "point" && impact.allProvisional) {
        expect(segment.action.shape).toBe(FOR_COPY.impactAllProvisional);
      } else {
        expect(segment.action.shape).toBe(FOR_COPY.impactSettled);
      }
    },
  );

  it("never shows a plus-or-minus band, which the engine does not produce", () => {
    // An error bar is a constant somebody chose. `figures.ts` has none: its range ends are the
    // settled rows and every row.
    for (const segment of SEGMENTS) {
      expect(textOf(segment)).not.toMatch(/give or take|plus or minus|±/i);
    }
  });

  it("says whether the rows behind the week are settled, from the engine's own flag", () => {
    for (const segment of SEGMENTS) {
      const expected = segment.set.allProvisional
        ? FOR_COPY.allProvisionalNote
        : FOR_COPY.someSettledNote;
      expect(segment.allProvisional).toBe(segment.set.allProvisional);
      expect(textOf(segment)).toContain(expected);
    }
  });
});
