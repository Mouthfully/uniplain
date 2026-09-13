import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FOR_COPY, SEGMENTS } from "../for/_content";
import { InsightPipeline } from "./InsightPipeline";
import { OneRowShape } from "./OneRowShape";
import { SegmentRows } from "./SegmentRows";
import { TwoIdentities } from "./TwoIdentities";

/**
 * THE RULES EVERY DRAWN FIGURE ON THIS SITE OBEYS.
 *
 * A picture fails differently from a sentence, and that is the reason for this file. A wrong
 * sentence is read and argued with; a wrong picture is absorbed. Every assertion here is a way a
 * figure can be silently wrong while looking entirely finished:
 *
 *   * it can be invisible to a screen reader, and nothing on screen says so;
 *   * it can be pinned to a fixed size, and break the page it is on at a width nobody opened;
 *   * it can draw a zero for a measurement that was never taken;
 *   * it can name a field the data model does not have, and be believed because it is a diagram.
 *
 * `renderToStaticMarkup` rather than a DOM: these are static drawings, the assertions are about
 * markup, and jsdom would be a dependency bought for nothing. Same choice, same reason, as
 * `page.test.tsx`.
 */

const CAFE = SEGMENTS.find((segment) => segment.slug === "cafe");
if (CAFE === undefined)
  throw new Error("art.test: the cafe segment is the fixture these tests use");

/**
 * THE LABEL THE PAGE ACTUALLY PASSES, not one written for the test.
 *
 * The first version of this fixture invented a short label of its own, and the "a name has to carry
 * the argument" assertion then measured the FIXTURE rather than anything shipped -- it would have
 * gone on passing with the real label deleted. A test that supplies its own copy is testing itself.
 */
const ROWS_LABEL = FOR_COPY.rowsFigureLabel;

const FIGURES = [
  { name: "InsightPipeline", markup: renderToStaticMarkup(<InsightPipeline />) },
  { name: "TwoIdentities", markup: renderToStaticMarkup(<TwoIdentities />) },
  { name: "OneRowShape", markup: renderToStaticMarkup(<OneRowShape />) },
  {
    name: "SegmentRows",
    markup: renderToStaticMarkup(
      <SegmentRows
        rows={CAFE.rows}
        labels={Object.fromEntries(CAFE.reads.map((read) => [read.source, read.label]))}
        period={CAFE.period}
        comparison={CAFE.comparison}
        figureLabel={ROWS_LABEL}
      />,
    ),
  },
] as const;

/** Every `<text>` a figure renders, with the tags stripped. */
function textNodes(markup: string): string[] {
  return [...markup.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((match) =>
    (match[1] ?? "").replace(/<[^>]+>/g, " ").trim(),
  );
}

describe.each(FIGURES)("$name", ({ markup }) => {
  it("is announced as one picture with a name, rather than as a pile of loose labels", () => {
    // Without `role="img"` a screen reader walks the `<text>` elements and reads the station
    // labels out in document order -- which for a branching flow is an order that means nothing.
    // The role collapses the figure to its name, so the name has to carry the argument.
    // `\srole=` AND NOT `role=`. The first version of this assertion was `<svg[^>]*role="img"`,
    // which `[^>]*` happily satisfies by matching `data-was-` -- so renaming the attribute to
    // anything ENDING in `role` left the test green while the figure went silent. Mutation-proven
    // the second time; the first time it proved the regex.
    expect(markup).toMatch(/<svg[^>]*\srole="img"/);

    const label = /aria-label="([^"]+)"/.exec(markup)?.[1];
    expect(label, "the figure has no accessible name").toBeDefined();
    // A one-word name is the same as no name: it tells a reader a picture exists and nothing else.
    expect((label ?? "").split(/\s+/).length).toBeGreaterThanOrEqual(8);
  });

  it("scales with its container instead of being pinned to one size", () => {
    // A viewBox with no width/height attribute is what lets the CSS decide. A fixed `width` on the
    // svg is the defect that survives review: it looks right at the width it was drawn at and
    // pushes the page sideways at every other one.
    expect(markup).toMatch(/<svg[^>]*viewBox="/);
    expect(markup).not.toMatch(/<svg[^>]*\swidth="/);
    expect(markup).not.toMatch(/<svg[^>]*\sheight="/);
  });

  it("writes no colour of its own", () => {
    // `scripts/check-tokens.mjs` scans source; this scans OUTPUT, where an inline style or a
    // computed attribute would surface and a source scan ends. Same rule, the other side of it.
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
  });

  it("puts nothing animated inside a figure frame", () => {
    // A `Figure` frame sets `overflow-x`, which makes it the nearest scrollport -- and
    // `animation-timeline: view()` resolves against the nearest scrollport. A reveal placed inside
    // one would be timed against the frame instead of the page and would fire at the wrong moment,
    // or never. Nothing here is animated; this is what keeps it that way.
    expect(markup).not.toMatch(/class="[^"]*\breveal\b/);
    expect(markup).not.toMatch(/class="[^"]*\bdraw-trend\b/);
  });
});

describe("SegmentRows", () => {
  const markup = FIGURES[3].markup;

  it("draws shape and never prints a value", () => {
    /**
     * THE RULE THIS PROTECTS. The figures beside this chart were rendered by the engine --
     * `renderMoney` and `renderCount` decide the currency, the precision and the separator. An axis
     * label here would be a SECOND renderer for the same numbers, and the first time the two
     * disagreed about a rounding the page would print one number twice, differently, with nothing
     * on it to say which was right.
     *
     * So no text this chart renders may contain a digit. The legend and the source names do not;
     * an axis, a data label or a date would.
     */
    for (const node of textNodes(markup)) {
      expect(node, `"${node}" puts a number on a chart that must not carry one`).not.toMatch(/\d/);
    }
  });

  it("gives an unreadable measurement no bar at all, rather than a bar of height zero", () => {
    /**
     * `?? 0` IS THE DEFECT, AND IT LOOKS LIKE A WORKING CHART. A day whose metric is absent or
     * unreadable is not a day the business took nothing; drawing it at zero states something false
     * in the one language a reader trusts without checking. The row below carries a metric the
     * envelope types as `unknown` and that `readMetric` cannot read, and the assertion is on the
     * COUNT of bars: the drawing must be one bar shorter, not one bar flatter.
     */
    const readable = renderToStaticMarkup(
      <SegmentRows
        rows={CAFE.rows}
        labels={Object.fromEntries(CAFE.reads.map((read) => [read.source, read.label]))}
        period={CAFE.period}
        comparison={CAFE.comparison}
        figureLabel={ROWS_LABEL}
      />,
    );

    const broken = CAFE.rows.map((row, index) =>
      index === 0 ? { ...row, metrics: { ...row.metrics, revenue: "not a number" } } : row,
    );
    const withGap = renderToStaticMarkup(
      <SegmentRows
        rows={broken}
        labels={Object.fromEntries(CAFE.reads.map((read) => [read.source, read.label]))}
        period={CAFE.period}
        comparison={CAFE.comparison}
        figureLabel={ROWS_LABEL}
      />,
    );

    const bars = (svg: string) =>
      (svg.match(/<rect[^>]*class="[^"]*fill-brand-blue/g) ?? []).length;
    expect(bars(withGap)).toBe(bars(readable) - 1);
  });

  it("draws nothing at all rather than an empty frame when there is nothing to draw", () => {
    expect(
      renderToStaticMarkup(
        <SegmentRows
          rows={[]}
          labels={{}}
          period={CAFE.period}
          comparison={CAFE.comparison}
          figureLabel={ROWS_LABEL}
        />,
      ),
    ).toBe("");
  });
});

describe("OneRowShape", () => {
  it("names only fields the envelope row actually has", () => {
    /**
     * THE FAILURE THIS CATCHES IS A DIAGRAM GOING STALE. A field renamed in the contract leaves
     * every test green and this drawing still showing the old name -- and a picture of a data model
     * is exactly the artefact a developer trusts without checking, because it looks like
     * documentation. The keys are read off a real row rather than a list typed twice.
     */
    const sample = CAFE.rows[0];
    expect(sample, "art.test: the cafe fixture has no rows to read keys from").toBeDefined();
    const real = new Set(Object.keys(sample ?? {}));

    const drawn = textNodes(FIGURES[2].markup).filter((node) => /^[a-z_]+$/.test(node));
    expect(drawn.length, "the drawing names no fields at all").toBeGreaterThanOrEqual(6);
    for (const key of drawn) {
      expect(real.has(key), `the drawing names "${key}", which an envelope row does not have`).toBe(
        true,
      );
    }
  });
});
