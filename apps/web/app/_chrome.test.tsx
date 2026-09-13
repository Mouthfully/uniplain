import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer, SiteHeader } from "./_chrome";
import { NAV, NAV_MENU } from "./_content";
import { FOOTER_GROUPS, footerHrefs, footerLinks } from "./_footer-links";

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

  it("does not hide the disclosure at any width a phone or tablet has", () => {
    // `lg:hidden` and nothing else: a `hidden` in the base classes would reproduce the original
    // defect with a control nobody can see.
    const details = drawer.slice(0, drawer.indexOf(">") + 1);
    expect(details).toMatch(/class="[^"]*\blg:hidden\b/);
    expect(details).not.toMatch(/class="[^"]*(^|\s)hidden(\s|")/);
  });
});

describe("the wide row is revealed only where it fits", () => {
  it("is gated at lg and not at md", () => {
    // MEASURED, not preferred: at exactly 768 the row appears and the header's minimum content
    // width goes 767 -> 964, so all 19 header-bearing routes scrolled sideways by 196px. 964 needs
    // the next breakpoint up. `md:flex` here is the bug, so it is asserted against by name.
    expect(inlineRow).toContain("lg:flex");
    expect(inlineRow).not.toContain("md:flex");
  });

  it("keeps the 140x40 header CTA out of the phone bar", () => {
    // At 320 the bar's own minimum was 366px with just the logo and this CTA in it. The logo is
    // fixed at 146px by the brand guide, so the CTA is what gives way; it reappears at lg.
    const cta = html.slice(html.indexOf('<a href="/dashboard"'));
    expect(cta).toMatch(/class="[^"]*\bhidden\b[^"]*\blg:inline-flex\b/);
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
 * What is asserted here is that the footer RENDERS what `_footer-links.ts` registers. Whether the
 * register itself covers the site is `footer-links.test.tsx`, which is the half that can drift.
 */
describe("the footer publishes the legal surface", () => {
  const footer = renderToStaticMarkup(<Footer />);

  it.each(FOOTER_GROUPS.flatMap((g) => footerLinks(g).map((l) => [l.href, l.label] as const)))(
    "links %s",
    (href, label) => {
      expect(footer).toContain(`href="${href}"`);
      expect(footer).toContain(label);
    },
  );

  it("renders every column heading", () => {
    for (const group of FOOTER_GROUPS) {
      expect(footer, `the ${group.id} column is not rendered`).toContain(group.heading);
    }
  });

  it("publishes the agreement a controller's own obligations require", () => {
    // Named rather than left to the loop above. `/dpa` is the one whose absence from the footer
    // costs a sale outright: a reviewer who cannot find an agreement concludes the vendor cannot be
    // appointed as a processor, and PDPA s.40 puts the duty to hold one on THEM, not on us.
    expect(footerHrefs()).toContain("/dpa");
  });

  it("keeps every footer link at the WCAG 2.5.8 tap floor", () => {
    // 24px, not the header's 44. The reason is in `_chrome.tsx` beside the class; what matters here
    // is that the floor is stated somewhere a change has to walk past, rather than being whatever
    // the line height happens to produce.
    const links = footer.slice(footer.indexOf("<nav"), footer.lastIndexOf("</nav>"));
    const sizes = links.match(/min-h-\[(\d+)px\]/g) ?? [];
    expect(sizes.length, "no footer link states a tap height").toBeGreaterThanOrEqual(
      footerHrefs().length,
    );
    for (const size of sizes) {
      expect(Number(size.replace(/\D/g, ""))).toBeGreaterThanOrEqual(24);
    }
  });
});
