import { METRICS } from "@repo/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REPORTS, Reports } from "./Reports";
import { implementedSources } from "./_source-marks";

/**
 * FOUR REPORTS THAT LOOK LIKE FOUR REPORTS.
 *
 * They did not. Each card carried an eight-bar chart, and all four were THE SAME CHART: the second
 * card's heights were the first minus 6, the third minus 12, the fourth minus 18 -- one curve from
 * the reference artboard, shifted down three times. Four different names above four identical
 * shapes, and a reader learned nothing from any of them.
 *
 * It was also a picture that could not have been true. "Revenue and ad spend by channel" and
 * "Orders and takings by day" are documents about different axes; drawing them identically says
 * nothing about either. The file's own note warned that "a flat or evenly-ascending set reads as a
 * placeholder" -- directly above four copies of one.
 *
 * So the assertion that matters here is DIFFERENCE, and it is the first one below. The rest hold
 * the replacement to the same standard the rest of this repository works to: the metrics are the
 * dictionary's, the sources are built connectors, and the admission that none of these documents
 * exists yet is visible rather than buried in alt text.
 */

const markup = renderToStaticMarkup(<Reports />);
const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the four cards describe four different documents", () => {
  it("has four, so the comparisons below are not vacuous", () => {
    expect(REPORTS.length).toBe(4);
  });

  it("gives no two reports the same set of figures", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. The old cards failed the spirit of this with pictures;
    // it would be just as easy to fail it with contents, by listing revenue and orders on all four.
    const sets = REPORTS.map((r) => [...r.metrics].sort().join("+"));
    expect(new Set(sets).size, `two reports list identical figures: ${sets.join(" / ")}`).toBe(
      REPORTS.length,
    );
  });

  it("gives every report its own one-line question", () => {
    const asks = REPORTS.map((r) => r.asks);
    expect(new Set(asks).size).toBe(REPORTS.length);
    for (const ask of asks) {
      expect(ask.length, "a card's line is too short to differentiate it").toBeGreaterThan(20);
      // A NOUN PHRASE, NOT A SENTENCE, and asserted so it stays one. `check-copy` refused the
      // first draft of these lines: they were sentences describing the behaviour of reports that
      // do not exist, and a promise on this site has to arrive through `claim()`. Keeping them
      // terminal-punctuation-free is not a trick to pass the guard -- it is the shape that carries
      // no promise, and this assertion is what stops one growing back into it.
      expect(ask, `"${ask}" ends a sentence, which makes it a promise`).not.toMatch(/[.!?]$/);
      expect(text, "a card's line is not rendered").toContain(ask);
    }
  });

  it("draws no chart, because the one it drew was the same on every card", () => {
    // The bars were inline `height: n%` styles. If they come back, so does the thing being fixed.
    expect(markup, "a per-bar inline height is back on the cards").not.toMatch(/style="height:/);
  });
});

describe("what the cards claim is checked, unlike the bars", () => {
  it("lists only metrics the dictionary has a column for", () => {
    // Typed as `MetricName` too, but a type is not a guard once somebody writes a cast -- and this
    // is the list a reader takes as the report's contents.
    const known = Object.keys(METRICS);
    for (const report of REPORTS) {
      expect(report.metrics.length, `${report.name} lists no figures`).toBeGreaterThan(0);
      for (const metric of report.metrics) {
        expect(known, `${report.name} lists "${metric}", which is not in the dictionary`).toContain(
          metric,
        );
      }
    }
  });

  it("names only connectors this product reads", () => {
    // §5.1: no platform appears as a source, in any form, before it is built.
    for (const report of REPORTS) {
      const shown = implementedSources(report.sources);
      expect(shown.length, `${report.name} shows no source`).toBeGreaterThan(0);
      expect(shown.length, `${report.name} lists a source that is not a built connector`).toBe(
        report.sources.length,
      );
    }
  });

  it("renders no unbuilt platform name anywhere in the section", () => {
    for (const banned of ["GrabFood", "foodpanda", "LINE MAN", "Shopee", "Lazada", "Xero"]) {
      expect(text, `the section names ${banned}, which is not a source`).not.toContain(banned);
    }
  });
});

describe("the section still says these documents do not exist yet", () => {
  it("states it where a reader will see it, not in alt text", () => {
    // The bars carried `aria-label="Sample figures"` -- section 5.3's required mark on an invented
    // figure, and the only admission on the page that none of these four is generated. It was alt
    // text, so no sighted reader ever met it. Removing the bars removed it; this replaced it.
    expect(text).toContain("not yet generated");
    expect(markup, "the note is inside an aria-label again").toMatch(
      /<p[^>]*>[^<]*not yet generated/,
    );
  });
});
