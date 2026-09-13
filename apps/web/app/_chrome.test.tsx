import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer, SiteHeader } from "./_chrome";
import { FOOTER_LEGAL_LINKS, NAV, NAV_MENU } from "./_content";

/**
 * THE NAVIGATION A PHONE CAN ACTUALLY REACH.
 *
 * What these tests are for, stated as the failure they exist to catch: the six NAV entries were in
 * the DOM on every route and were display:none below md, so a customer on a phone could reach `/`,
 * `/dashboard`, `/terms` and `/privacy` and nothing else -- measured over every visible link on the
 * home page with all seven of its <details> forced open. `/connections`, the screen that attaches a
 * data source, was reachable from no page on the site. Being present in the markup was never the
 * property worth asserting; being present in the element a phone renders is.
 *
 * So every assertion below reads the DISCLOSURE'S OWN markup, sliced out of the render, rather than
 * the header as a whole. A test that searched the whole string would pass on the broken version --
 * the labels were always there -- which is exactly the kind of green that costs a release.
 *
 * `renderToStaticMarkup` rather than a DOM, matching `page.test.tsx`: the assertions are about what
 * is in the markup and which classes gate it, and jsdom would be a dependency bought for nothing.
 * The class assertions are deliberate. A breakpoint and a tap-target floor are the change here, and
 * a class name is where they live; the pixel numbers behind them are re-measured in a real browser
 * by `scripts/mobile-audit.mjs`, which is the instrument and not a guard.
 */

const html = renderToStaticMarkup(<SiteHeader />);

/** The drawer, and only the drawer. See the header comment for why this slice matters. */
const drawer = (() => {
  const start = html.indexOf("<details");
  const end = html.indexOf("</details>");
  expect(start, "the header no longer renders a <details> disclosure").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
})();

/** The <nav> that is revealed on wide viewports, which is a different element from the drawer's. */
const inlineRow = (() => {
  const match = html.match(/<nav[^>]*class="([^"]*)"/);
  expect(match, "the header renders no <nav> at all").not.toBeNull();
  return (match as RegExpMatchArray)[1];
})();

const source = readFileSync(new URL("./_chrome.tsx", import.meta.url), "utf8");

describe("every destination is reachable from a phone", () => {
  it.each(NAV.map((item) => [item.label, item.href] as const))(
    "puts %s (%s) inside the disclosure, not only in the wide row",
    (label, href) => {
      expect(drawer).toContain(`href="${href}"`);
      expect(drawer).toContain(label);
    },
  );

  it("carries the three destinations that are the product itself", () => {
    // The marketing routes are replaceable; these three are not. `/connections` attaches a data
    // source, and a signed-in owner on the device they own could not navigate to it at all.
    for (const href of ["/signin", "/dashboard", "/connections"]) {
      expect(drawer).toContain(`href="${href}"`);
    }
  });

  it("does not hide the disclosure at any width below the row's own breakpoint", () => {
    // `xl:hidden` and nothing else: a `hidden` in the base classes would reproduce the original
    // defect with a control nobody can see. It was `lg:hidden` until the row moved up -- see the
    // measurement in the next block; the drawer has to cover exactly the widths the row does not.
    const details = drawer.slice(0, drawer.indexOf(">") + 1);
    expect(details).toMatch(/class="[^"]*\bxl:hidden\b/);
    expect(details).not.toMatch(/class="[^"]*(^|\s)hidden(\s|")/);
  });
});

describe("the wide row is revealed only where it fits", () => {
  it("is gated at xl, and not at lg or md", () => {
    // MEASURED, not preferred, TWICE -- and the second measurement is why this says `xl`.
    //
    // First: at exactly 768 the row appeared and the header's minimum content width went
    // 767 -> 964, so all 19 header-bearing routes scrolled sideways by 196px. That moved it to lg.
    //
    // Then `NAV` grew from six entries to nine, one at a time, and nobody measured the bar again.
    // `scripts/header-fit.mjs` against a production build, with the stylesheet confirmed applied:
    //
    //     1024px   231px of sideways page scroll; "Sign in" AND the primary CTA off-screen
    //     1152px   103px; the CTA off-screen
    //     1280px    15px of page scroll, 55px of header overflow; the CTA clipped
    //     1366px+   the page fits and the header still overflows its own box by 55px
    //
    // Ten links (Sign in is one of them), a logo and a CTA need about 1250px, so the row moves to
    // xl and the gaps tighten.
    // Both earlier spellings are asserted against by name, because each was once the right answer.
    expect(inlineRow).toContain("xl:flex");
    expect(inlineRow).not.toContain("lg:flex");
    expect(inlineRow).not.toContain("md:flex");
  });

  it("is not left to drift the next time a link is added", () => {
    // THE REAL LESSON OF THE SECOND MEASUREMENT: the breakpoint was right when it was written and
    // wrong four links later, and nothing in the build noticed. This asserts the count the measured
    // width was taken against, so adding an eleventh link fails here -- with a pointer at the harness
    // -- instead of silently pushing the CTA off a laptop again.
    expect(
      NAV.length,
      "NAV changed size; re-run `node apps/web/scripts/header-fit.mjs` against a production " +
        "build and move the breakpoint if the bar no longer fits, then update this number",
    ).toBe(10);
  });

  it("keeps the 140x40 header CTA out of the phone bar", () => {
    // At 320 the bar's own minimum was 366px with just the logo and this CTA in it. The logo is
    // fixed at 146px by the brand guide, so the CTA is what gives way; it reappears at lg.
    const cta = html.slice(html.indexOf('<a href="/dashboard"'));
    expect(cta).toMatch(/class="[^"]*\bhidden\b[^"]*\bxl:inline-flex\b/);
  });
});

describe("the control is operable without a pointer and without React", () => {
  it("is a summary with an accessible name from _content.ts", () => {
    expect(drawer).toContain(`aria-label="${NAV_MENU.label}"`);
    // THE VISIBLE WORD IS GONE and this assertion changed with it, deliberately rather than to get
    // green. It used to require the label to appear as text too, on WCAG 2.5.3 (Label in Name) --
    // but 2.5.3 applies to controls that HAVE a visible text label, and requires the accessible
    // name to contain it. An icon-only control has no visible label for the accessible name to
    // disagree with, so the criterion is not engaged. 4.1.2 still is, and the aria-label satisfies
    // it: a voice user says "Menu" because that is still the control's name.
    expect(drawer).not.toContain(`>${NAV_MENU.label}</span>`);
    expect(drawer).toContain("<summary");
  });

  it("names the navigation landmark inside the panel", () => {
    expect(drawer).toContain(`aria-label="${NAV_MENU.navLabel}"`);
  });

  it("holds no client state, no event handler and no hydration", () => {
    // The expanded state is the `open` attribute and the control is a <summary>: the browser
    // conveys both. `"use client"` on a component every route renders would be paid on every route.
    // The directive, not the words: this file's own comments explain why it is absent, and a test
    // that grepped for the phrase would fail on the explanation.
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(/\bonClick\b|\buseState\b|\buseEffect\b/);
  });

  it("closes on Escape, and the handler names the disclosure it closes", () => {
    // <details> is the only thing here that does not close on Escape. This is the enhancement that
    // adds it -- if the script is removed, or stops targeting the drawer, this goes red.
    expect(html).toContain("<script>");
    expect(html).toMatch(/Escape/);
    expect(html).toMatch(/getElementById\("site-menu"\)/);
    expect(html).toMatch(/id="site-menu"/);
    // It must also put the focus ring back somewhere that still exists after the close.
    expect(html).toMatch(/querySelector\("summary"\)/);
  });
});

describe("nothing in the header is under the tap floor", () => {
  // WCAG 2.5.5 / Apple HIG: 44px. The measured header was 140x40 for the CTA, 40px-tall row links
  // and 14-16px footer links. These are the two the header owns.
  it("sizes the disclosure control to at least 44px in both directions", () => {
    expect(drawer).toMatch(/min-h-\[44px\]/);
    expect(drawer).toMatch(/min-w-\[44px\]/);
  });

  it("sizes every row in the panel above the floor", () => {
    const rows = drawer.match(/min-h-\[(\d+)px\]/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(NAV.length);
    for (const row of rows) {
      expect(Number(row.replace(/\D/g, ""))).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * THE FOOTER, WHICH IS WHERE A REVIEWER LOOKS FOR THE DOCUMENTS THAT DECIDE A PURCHASE.
 *
 * The header tests above exist because six links were in the markup and reachable by nobody. The
 * footer had the opposite defect and the same cause: it linked `/terms` and `/privacy` under a
 * comment saying "a policy reachable only by typing its URL is not published in any sense a
 * regulator or a customer would accept", while `/processing`, `/sub-processors` and `/dpa` shipped
 * beside them and were linked from nothing.
 *
 * THAT IS NOT A NAVIGATION BUG, IT IS A DILIGENCE ONE. A customer's reviewer does not guess URLs.
 * They open the footer, see two documents, and conclude the other three do not exist -- which is
 * the same wrong answer a stale denial gives, arrived at through absence instead of prose.
 *
 * Both directions are asserted. Every registered link must render, and every href must be a route
 * that exists on disk, because a footer link to a 404 is worse than no link: it reads as a document
 * that was withdrawn.
 */
describe("the footer publishes the legal surface", () => {
  const footer = renderToStaticMarkup(<Footer />);

  it.each(FOOTER_LEGAL_LINKS.map((link) => [link.href, link.label] as const))(
    "links %s",
    (href, label) => {
      expect(footer).toContain(`href="${href}"`);
      expect(footer).toContain(label);
    },
  );

  it("links a route that exists for every href", () => {
    for (const link of FOOTER_LEGAL_LINKS) {
      const page = new URL(`.${link.href}/page.tsx`, import.meta.url).pathname;
      expect(existsSync(page), `the footer links ${link.href}, which has no page.tsx`).toBe(true);
    }
  });

  it("publishes the agreement a controller's own obligations require", () => {
    // Named rather than left to the loop above. `/dpa` is the one whose absence from the footer
    // costs a sale outright: a reviewer who cannot find an agreement concludes the vendor cannot be
    // appointed as a processor, and PDPA s.40 puts the duty to hold one on THEM, not on us.
    expect(FOOTER_LEGAL_LINKS.map((l) => l.href)).toContain("/dpa");
  });
});
