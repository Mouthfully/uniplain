import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { brand, withheldClaims } from "@repo/brand";
import { describe, expect, it } from "vitest";

import { PROCESSING_ACTIVITIES } from "./activities";
import { SUB_PROCESSORS, activitiesFor, recipientsInRecord } from "./sub-processors";
import { SUB_PROCESSOR_COPY } from "./sub-processor-content";
import Page from "../sub-processors/page";

/**
 * THE DISCLOSURE, HELD TO WHAT THE SERVICE ACTUALLY DOES.
 *
 * This page is one of the two things a data processing agreement rests on, and it is the half a
 * customer's counsel will check against reality. A list that drifts from the record of processing
 * is worse than no list: it is a disclosure the customer relied on.
 */

const markup = renderToStaticMarkup(<Page />);
const say = (m: string) =>
  m
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

describe("the sub-processor list", () => {
  it("names exactly the recipients the record of processing names, in both directions", () => {
    expect([...SUB_PROCESSORS.map((p) => p.name)].sort()).toEqual([...recipientsInRecord()].sort());
  });

  it("gives every provider at least one activity, read off the record", () => {
    // A provider with no activity is either not a sub-processor or the record has stopped
    // describing what it does. Either way the disclosure is wrong.
    for (const provider of SUB_PROCESSORS) {
      expect(
        activitiesFor(provider.name).length,
        `${provider.name} is disclosed as a sub-processor and no processing activity sends it data`,
      ).toBeGreaterThan(0);
    }
  });

  it("renders every provider and its activities", () => {
    const text = say(markup);
    for (const provider of SUB_PROCESSORS) {
      expect(text, provider.name).toContain(provider.name);
      for (const purpose of activitiesFor(provider.name)) expect(text, purpose).toContain(purpose);
    }
  });

  it("admits an unknown location rather than guessing one", () => {
    // Three of the four have no location recorded. A plausible region in a disclosure a customer's
    // counsel relies on is the same failure as a plausible retention period, with a signature on it.
    const unknown = SUB_PROCESSORS.filter((p) => p.location === null);
    expect(unknown.length).toBeGreaterThan(0);
    expect(say(markup)).toContain(SUB_PROCESSOR_COPY.locationUnknown);
  });

  it("promises no notice period for a change, because none exists", () => {
    const text = say(markup).toLowerCase();
    for (const promise of [
      "30 days",
      "days' notice",
      "days notice",
      "we will notify",
      "advance notice",
    ]) {
      expect(text, `the page promises "${promise}"`).not.toContain(promise);
    }
  });
});

describe("the DPA claim is still withheld, even now that an agreement exists", () => {
  it("keeps the claim withheld on the requirement that is still missing", () => {
    // THIS ASSERTION CHANGED SHAPE AND THAT IS THE POINT. It used to read
    // `expect(brand.dpaAvailable).toBe(false)`, which was right while no agreement existed and
    // became wrong the moment one did. What it protects is not the fact but the CLAIM: `claims.ts`
    // requires BOTH `dpaAvailable` and `euRepresentative`, because the claim's text promises
    // "Article 28 terms" -- GDPR -- and a representative in the Union. A PDPA s.40 agreement is not
    // that, `euRepresentative` is null, and Art. 3(2) applicability has never been decided.
    //
    // So the company now has an agreement and still may not advertise this claim, and pinning the
    // withholding to its actual cause is what stops the next person reading `dpaAvailable: true`
    // and concluding the marketing line is unlocked.
    expect(brand.dpaAvailable).toBe(true);
    expect(brand.euRepresentative).toBeNull();
    const withheld = withheldClaims().find((entry) => entry.claim.id === "dpa");
    expect(withheld, "the dpa claim is no longer withheld").toBeDefined();
    expect(withheld?.missing).toContain("euRepresentative");
  });

  it("claims no agreement anywhere in the rendered page", () => {
    const text = say(markup).toLowerCase();
    for (const claim of [
      "dpa is available",
      "data processing agreement is available",
      "dpa on request",
      "sign our dpa",
    ]) {
      expect(text, `the page claims "${claim}"`).not.toContain(claim);
    }
  });

  it("keeps the privacy notice's DPA clause open", () => {
    // Two files, one fact. If somebody flips `dpaAvailable` the clause below changes shape and this
    // catches the half-done version where the page says one thing and the notice another.
    const notice = readFileSync(new URL("../privacy/page.tsx", import.meta.url).pathname, "utf8");
    expect(notice).toContain("There is no data processing agreement available to sign today");
  });
});

describe("what a counsel brief would need", () => {
  it("has a stated role for every provider, long enough to be checkable", () => {
    for (const p of SUB_PROCESSORS) {
      expect(p.role.length, `${p.name} has no usable description`).toBeGreaterThan(60);
    }
  });

  it("covers every activity that names a recipient", () => {
    // The other direction: an activity sending data somewhere not on this page would be an
    // undisclosed sub-processor, which is the defect this page exists to make impossible.
    const disclosed = new Set(SUB_PROCESSORS.map((p) => p.name));
    for (const a of PROCESSING_ACTIVITIES) {
      for (const r of a.recipients) {
        expect(disclosed.has(r), `${a.id} sends data to ${r}, which is not disclosed`).toBe(true);
      }
    }
  });
});
