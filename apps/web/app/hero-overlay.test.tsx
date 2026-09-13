import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SITE } from "./_content";
import Page from "./page";

/**
 * THE PILL, THE CAPTION, AND THE NEGATIVE MARGIN BETWEEN THEM.
 *
 * The hero's floating pill hangs off the bottom edge of the visual card, and `-mt-4` is how. That
 * margin is a claim about whatever element sits immediately above it -- and the sample-figures
 * caption had been inserted between the card and the pill, so the claim became false: sixteen
 * pixels of lift pulled the pill up over a line of text rather than over the card, and
 * "Sample figures. An illustration, not a customer." rendered underneath the pill's own opaque
 * background.
 *
 * IT WAS NOT A NARROW-SCREEN EDGE CASE. The caption is full width and the pill is centred and
 * narrower, so they overlap in the middle at every width where the caption is long enough to reach
 * the centre -- which is every width, because the caption is one fixed sentence.
 *
 * WHY THIS ASSERTS ORDER RATHER THAN SPACING. The bug is not that `-mt-4` is the wrong number; it
 * is that the element it was measured against moved. A test pinning the value would pass on the
 * broken layout and fail on a legitimate redesign -- exactly backwards. What has to hold is
 * adjacency: the pill immediately follows the card, and nothing with a negative top margin is
 * pulled over the caption.
 *
 * THE CAPTION IS THE LABEL SECTION 5.3 MAKES MANDATORY, which is the other reason this matters more
 * than a cosmetic overlap. `docs/marketplane/58-plan-reconciliation.md` refuses an unlabelled
 * example of a week's takings as fabricated social proof. A label a visitor cannot read because a
 * pill is sitting on it is, to that visitor, an absent label.
 */

const markup = renderToStaticMarkup(<Page />);

describe("the hero caption is not underneath the pill", () => {
  it("renders both, so the ordering assertions below are not vacuous", () => {
    expect(markup).toContain(SITE.syncPill);
    expect(markup).toContain(SITE.heroVisualLabel);
  });

  it("puts the pill before the caption, so the lift lands on the card", () => {
    // `-mt-4` pulls the pill over whatever precedes it. That must be the card, not the caption.
    const pillAt = markup.indexOf(SITE.syncPill);
    const captionAt = markup.indexOf(SITE.heroVisualLabel);
    expect(pillAt).toBeGreaterThan(-1);
    expect(captionAt).toBeGreaterThan(-1);
    expect(
      pillAt,
      "the caption sits between the card and the pill again, so the pill is lifted over the text",
    ).toBeLessThan(captionAt);
  });

  it("pulls nothing up over the caption", () => {
    // THE PROPERTY, STATED DIRECTLY. Whatever follows the caption must not carry a negative top
    // margin, whichever element that turns out to be after a redesign.
    const after = markup.slice(markup.indexOf(SITE.heroVisualLabel));
    const nextTag = after.slice(after.indexOf(">") + 1).match(/<[a-z]+[^>]*>/);
    expect(nextTag, "nothing follows the caption at all; re-read this test").not.toBeNull();
    expect(
      nextTag?.[0] ?? "",
      "the element after the caption is lifted over it by a negative top margin",
    ).not.toMatch(/class="[^"]*\s-mt-/);
  });

  it("keeps the pill hanging off the card rather than removing the lift", () => {
    // The fix was the ordering, not deleting the negative margin: a pill that no longer overlaps
    // the card is a different design, and reaching green that way would lose the thing the margin
    // is for. Asserted loosely -- any negative top margin, not a specific step.
    const pillBlock = markup.slice(0, markup.indexOf(SITE.syncPill));
    const openTag = pillBlock.lastIndexOf("<div");
    expect(
      pillBlock.slice(openTag),
      "the pill no longer overlaps the card it is supposed to hang off",
    ).toMatch(/-mt-\d/);
  });
});
