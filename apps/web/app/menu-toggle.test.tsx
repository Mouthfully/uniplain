import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./_chrome";

/**
 * THE ONE PROPERTY THAT DECIDES WHETHER THE DRAWER CLOSES ON AN IPHONE.
 *
 * The menu opened and would not close. The markup was correct, the `<details>`/`<summary>` pair was
 * the browser's own, and **Chromium toggled it perfectly** -- which is why it shipped: the harness
 * in `scripts/mobile-audit.mjs` runs Chromium, every test here renders in Node, and neither sees
 * the engine the bug lives in.
 *
 * WEBKIT STOPS TREATING A <summary> AS THE DISCLOSURE CONTROL WHEN ITS `display` IS FLEX,
 * INLINE-FLEX OR GRID. The summary carried `inline-flex` for centring the icon, so on iOS the
 * second tap landed on an element the engine no longer wired to the <details>. All layout has moved
 * to an inner span and the summary now sets no `display` at all.
 *
 * NOT VERIFIED IN WEBKIT. No WebKit build is installed in this environment, so this is the known
 * cause applied rather than a reproduction observed -- said here because a comment claiming a fix
 * was confirmed when it was not is worse than no comment. What this file CAN assert is the property
 * the bug depends on, which is a display value on one element, and that is what it asserts.
 */

const header = renderToStaticMarkup(<SiteHeader />);
const summaryTag = header
  .slice(header.indexOf("<summary"))
  .slice(0, header.slice(header.indexOf("<summary")).indexOf(">") + 1);

describe("the summary stays the disclosure control WebKit recognises", () => {
  it("found the summary, so the assertion below is not vacuous", () => {
    expect(summaryTag).toContain("<summary");
    expect(summaryTag).toContain("class=");
  });

  it("sets no flex, inline-flex or grid display on the summary itself", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. `inline-flex` here is what broke the toggle on iOS, and
    // it is the obvious thing to reach for again the next time this control needs centring.
    for (const display of ["inline-flex", "flex", "grid", "inline-grid"]) {
      expect(
        summaryTag,
        `the summary sets display:${display}, which stops WebKit toggling the drawer`,
      ).not.toMatch(new RegExp(`class="[^"]*\\b${display}\\b`));
    }
  });

  it("keeps the layout on an element inside the summary instead", () => {
    // The centring still has to happen somewhere; losing it would be a different regression.
    const control = header.slice(header.indexOf("<summary"), header.indexOf("</summary>"));
    expect(control, "the icon is no longer centred by anything").toMatch(
      /<span[^>]*class="[^"]*\bflex\b[^"]*items-center/,
    );
  });

  it("keeps the tap target at the 44px floor on the element that draws it", () => {
    // WCAG 2.5.5 / Apple HIG. The floor moved from the summary to the span with the layout, so it
    // is asserted where it now lives rather than wherever it used to.
    const control = header.slice(header.indexOf("<summary"), header.indexOf("</summary>"));
    expect(control).toMatch(/min-h-\[44px\]/);
    expect(control).toMatch(/min-w-\[44px\]/);
  });

  it("shows a hamburger closed and a cross open, with no visible word", () => {
    const control = header.slice(header.indexOf("<summary"), header.indexOf("</summary>"));
    // Two icons, swapped by `group-open`, and nothing else: the label is the aria-label now.
    expect(control).toContain("group-open:hidden");
    expect(control).toContain("group-open:block");
    expect(control.replace(/<[^>]+>/g, "").trim(), "the control renders visible text").toBe("");
  });
});
