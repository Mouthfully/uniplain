import { brand } from "@repo/brand";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CONTACT_DELIVERY_LINE, RIGHTS_CHANNEL_LINE } from "./_content";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

/**
 * A RIGHTS CHANNEL THAT DOES NOT RECEIVE IS NOT A RIGHTS CHANNEL.
 *
 * `/privacy`'s clause on a data subject's statutory rights ended: **"The contact address at the top
 * of this page reaches the same people."** `packages/brand/src/brand.ts` recorded, in a comment
 * beside that same address, that the zone holds no MX record and that mail to it bounces. Both
 * sentences were in the repository at the same time and only one of them was true.
 *
 * THE PERSON THIS MISLEADS IS THE ONE EXERCISING A RIGHT, and the failure is silent in the worst
 * way available: a request sent to a bouncing address and never answered is indistinguishable, from
 * the outside, from a company that read it and ignored them. Under the PDPA the published channel
 * is how s.30-36 are exercised at all.
 *
 * The terms are worse in one specific respect, which is why they are asserted here too. **Six
 * clauses send a customer to "the contact address above"** -- a refund, a deletion request, the
 * notices clause -- and clause 15 starts a **thirty-day dispute clock** running from a notice sent
 * there. A clock that starts on a bounce is a term a customer loses by relying on.
 *
 * So the fact moved out of a comment and into `brand.supportMailboxDeliverable`, every page that
 * publishes the address reads it, and `scripts/check-mailbox.mjs` holds the fact against the actual
 * zone over DNS -- in BOTH directions, so flipping the boolean without the records fails, and
 * adding the records without flipping it fails too. This file is the other half: that the pages
 * actually say what the fact means.
 */

const privacy = renderToStaticMarkup(PrivacyPage() as ReactElement);
const terms = renderToStaticMarkup(TermsPage() as ReactElement);
const say = (m: string) => m.replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"');

describe("the pages say whether the published address receives mail", () => {
  it("renders both documents, so the assertions below are not vacuous", () => {
    expect(privacy).toContain(brand.supportEmail);
    expect(terms).toContain(brand.supportEmail);
  });

  it("publishes the admission on every document that publishes the address", () => {
    // THE ASSERTION THIS FILE EXISTS FOR, in the state the repository is actually in.
    if (CONTACT_DELIVERY_LINE === null) {
      expect(brand.supportMailboxDeliverable, "the line is null and the mailbox is not live").toBe(
        true,
      );
      return;
    }
    for (const [name, markup] of [
      ["privacy", privacy],
      ["terms", terms],
    ] as const) {
      expect(
        say(markup),
        `${name} publishes an address that bounces and does not say so`,
      ).toContain(CONTACT_DELIVERY_LINE);
    }
  });

  it("never tells a data subject the mailbox reaches somebody while it does not", () => {
    // The exact sentence that was there. Named, because the failure was not a vague imprecision --
    // it was this string, and a change that reintroduces it is the regression.
    if (brand.supportMailboxDeliverable) return;
    expect(
      say(privacy),
      "the rights clause claims the contact address reaches somebody again",
    ).not.toContain("The contact address at the top of this page reaches the same people.");
  });

  it("names a route that does work, rather than only withdrawing one", () => {
    // WITHDRAWING A CHANNEL IS NOT ANSWERING THE OBLIGATION. Art. 12(2) requires a controller to
    // FACILITATE the exercise of rights, and PDPA s.30 assumes a way to ask. So the clause has to
    // leave a reader with somewhere to go, and the one that works for a person with no account is
    // the registered postal address -- which is printed in the same panel.
    expect(say(privacy)).toContain(RIGHTS_CHANNEL_LINE);
    expect(say(privacy), "the postal route is named and not printed").toContain(
      brand.postalAddress.street,
    );
    expect(say(privacy), "the in-product route is not named").toMatch(/Your data/);
  });

  it("keeps the admission tied to the fact rather than typed into a page", () => {
    // Both constants are derived in `_content.ts` from one boolean. If a page ever hand-types the
    // apology, flipping the fact would leave it behind on that page -- which is the drift this
    // whole unit is about, one level down.
    expect(CONTACT_DELIVERY_LINE === null).toBe(brand.supportMailboxDeliverable);
    expect(RIGHTS_CHANNEL_LINE.length).toBeGreaterThan(40);
  });
});
