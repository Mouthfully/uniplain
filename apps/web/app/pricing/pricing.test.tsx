import { readFileSync } from "node:fs";
import { brand } from "@repo/brand";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { representativeRequired } from "../_processing/representative-requirement";
import { CURRENCIES } from "../_billing/plans";
import Page from "./page";

/**
 * THE PAGE WHERE THE DECISION TO BUY IS MADE, AND THE FACT IT WAS NOT CARRYING.
 *
 * `/terms` says no representative is appointed in the European Union. `/dpa` says it. The Art. 30
 * record says it. **None of them is this page** -- and this is the page that offers a euro price to
 * a visitor who may be in the Union.
 *
 * Nothing tested this page either, which is how a euro price and a missing Art. 27 representative
 * coexisted on the same site for as long as they did without anybody putting them in the same
 * sentence. The terms page had exactly this shape: a disclosure that existed where nobody reads it,
 * and no test to notice.
 *
 * The assertions run in both directions. While a representative is required and none is designated,
 * the disclosure must be here. The day one is designated it must go -- because a page still warning
 * about a gap that has closed is the stale denial again, in the other direction.
 */

const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
const text = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&#x2014;|&mdash;/g, "—")
  .replace(/\s+/g, " ");

describe("the page offering a euro price says what is missing", () => {
  it("still offers a Member State currency, so the disclosure is not moot", () => {
    // If this ever goes red the EU is no longer a market, and the disclosure below should go with
    // the price rather than linger.
    expect(CURRENCIES as readonly string[]).toContain("eur");
  });

  it("discloses that no representative is designated, where the buyer will see it", () => {
    expect(representativeRequired()).toBe(true);
    expect(brand.euRepresentative).toBeNull();
    expect(
      text,
      "the pricing page offers a euro price and says nothing about the Art. 27 gap",
    ).toContain("none is designated yet");
    expect(text).toContain("Representative in the European Union");
  });

  it("does not claim the gap is smaller than it is", () => {
    // A disclosure that softens into "we are working on it" is worse than none: it reads as
    // reassurance and tells the buyer nothing they can act on.
    const lower = text.toLowerCase();
    for (const softener of [
      "we are in the process of appointing",
      "a representative will be appointed shortly",
      "this does not affect you",
    ]) {
      expect(lower, `the disclosure softens the gap: "${softener}"`).not.toContain(softener);
    }
  });

  it("claims no compliance anywhere on the page", () => {
    // The same bans `forbidden-claims.test.ts` enforces, run against the RENDERED text, because
    // this page composes at module scope and a source scan reads the branch that did not render.
    const lower = text.toLowerCase();
    for (const claimText of [
      "soc 2",
      "iso 27001",
      "gdpr compliant",
      "pdpa compliant",
      "independently audited",
      "penetration tested",
    ]) {
      expect(lower, `the pricing page claims "${claimText}"`).not.toContain(claimText);
    }
  });
});

describe("the disclosure is derived, so it cannot outlive its own truth", () => {
  it("is gated on the assessment rather than typed into the markup", () => {
    // ASSERTED ON THE SOURCE, like the dashboard notice. The gate is what makes this disclosure
    // disappear on the same commit as the fact changes -- a paragraph typed unconditionally would
    // still be warning about a designation that had been made, which is the stale denial running
    // the other way.
    const page = readFileSync(new URL("./page.tsx", import.meta.url).pathname, "utf8");
    expect(page, "the disclosure is no longer gated on the assessment").toContain(
      "representativeRequired() && brand.euRepresentative === null",
    );
  });
});
