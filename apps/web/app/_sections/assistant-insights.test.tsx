import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantPanel } from "./AssistantPanel";
import { SAMPLE_FIGURES, SAMPLE_SET } from "./_sample-brief";
import { implementedSources } from "./_source-marks";

/**
 * THE COPY CANNOT OUTRUN THE ARITHMETIC.
 *
 * The card's captions used to describe the arithmetic -- "Both totals summed from the rows; the
 * difference computed in code, not written". True, and it tells an owner nothing about their shop.
 * They now state a finding: orders rose faster than takings, so the average ticket is what it is;
 * spend rose while takings barely moved, which is what raised an action.
 *
 * THAT IS A MORE DANGEROUS KIND OF SENTENCE, which is why this file exists. The section directly
 * above the card promises every figure is computed before a model sees it and that an untraceable
 * number refuses the whole insight. A caption with a hand-typed percentage in it would break that
 * promise on the same screen that makes it -- and it would be the easiest thing in the world to do,
 * because "orders rose about 7%" reads fine and nothing would complain.
 *
 * So every numeral the card prints is checked back against the figure set, the way `verify.ts`
 * checks a model's answer against the figures it was given. The mechanism is the same and the
 * reason is the same.
 */

const markup = renderToStaticMarkup(<AssistantPanel />);

/** Every rendering the engine produced, as one haystack. */
const ENGINE_TEXT = SAMPLE_SET.figures.map((f) => f.text).join(" | ");

/** Number-like tokens: digits with optional separators, decimals and a trailing percent. */
const NUMERALS = /\d[\d,]*(?:\.\d+)?%?/g;

describe("every numeral on the card came out of the engine", () => {
  it("has copy to check, so the assertion below is not vacuous", () => {
    expect(SAMPLE_FIGURES.length).toBe(3);
    const withDetail = SAMPLE_FIGURES.filter((f) => f.detail !== null);
    expect(withDetail.length, "no row carries a composed sentence").toBeGreaterThan(0);
  });

  it("traces every number in a row's title and caption to a figure", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. A percentage typed into a caption -- the natural way to
    // make an insight read well -- fails here.
    for (const row of SAMPLE_FIGURES) {
      const copy = [row.label, row.value, row.change ?? "", row.detail ?? ""].join(" ");
      for (const numeral of copy.match(NUMERALS) ?? []) {
        expect(
          ENGINE_TEXT,
          `the row "${row.id}" prints ${numeral}, which no figure contains`,
        ).toContain(numeral);
      }
    }
  });

  it("states a finding rather than describing the arithmetic", () => {
    // The old captions are the thing being replaced; if one comes back, so does a card that
    // explains how a sum works to somebody who wanted to know about their shop.
    const text = markup.replace(/<[^>]+>/g, " ");
    for (const old of ["the difference computed in code, not written", "so the parts add up"]) {
      expect(text, `the card went back to describing the arithmetic: "${old}"`).not.toContain(old);
    }
  });
});

describe("money is printed at the currency's own scale", () => {
  it("gives no money figure more decimals than the currency has", () => {
    // `derived.average_ticket` rendered as "THB 81.28266" -- five decimal places of satang, on a
    // marketing page and in a model prompt. `moneyFormatter` was passing `DECIMALS`, which is the
    // 6 of `numeric(20, 6)`: right for canonicalising, wrong for printing money to a person.
    const money = SAMPLE_SET.figures.filter((f) => /^[A-Z]{3} /.test(f.text));
    expect(money.length, "no money figures found; re-read this test").toBeGreaterThan(0);
    for (const figure of money) {
      const decimals = figure.text.match(/\.(\d+)/)?.[1]?.length ?? 0;
      expect(
        decimals,
        `${figure.id} prints "${figure.text}", which is ${decimals} decimal places of a currency that has 2`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("still prints the ISO code rather than a bare symbol", () => {
    // The reason `figures.ts` gives: "$" is the currency of at least four countries and a reader
    // who sees it supplies the wrong one for free. Fixing the decimals must not lose that.
    const revenue = SAMPLE_SET.figures.find((f) => f.id === "metric.revenue");
    expect(revenue?.text).toMatch(/^THB /);
  });
});

describe("the connector chips name only connectors this product reads", () => {
  it("shows a chip for every implemented source on a row", () => {
    for (const row of SAMPLE_FIGURES) {
      const shown = implementedSources(row.sources);
      expect(shown.length, `${row.id} shows no source`).toBeGreaterThan(0);
    }
  });

  it("drops a source that is in the contract but is not a built connector", () => {
    // `Source` carries `dataforseo_serp`, `awin`, `cj`, `impact`, `partnerstack` and `ai_answers`.
    // None is a connector, and §5.1 bans exactly this: a platform advertised as a source in any
    // form, logo or chip, before it exists. A figure legitimately computed from one of them must
    // render no chip for it.
    const unbuilt = ["dataforseo_serp", "awin", "cj", "impact", "partnerstack", "ai_answers"];
    expect(implementedSources(unbuilt)).toEqual([]);
    // And the narrowing keeps the ones that are real, so it is a filter rather than a blanket.
    expect(implementedSources([...unbuilt, "woocommerce"])).toEqual(["woocommerce"]);
  });

  it("renders no unbuilt platform name anywhere on the card", () => {
    const text = markup.replace(/<[^>]+>/g, " ");
    for (const banned of ["GrabFood", "foodpanda", "LINE MAN", "Shopee", "Lazada", "FoodStory"]) {
      expect(text, `the card names ${banned}, which is not a source`).not.toContain(banned);
    }
  });
});
