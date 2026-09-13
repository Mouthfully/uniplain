import { brand, formatAddress } from "@repo/brand";

import { FOOTER_LEGAL_LINKS, NAV, NAV_MENU, SITE } from "./_content";

/**
 * The header and footer, shared by the marketing page and the dashboard.
 *
 * THE WORDMARK IS THE SUPPLIED SVG AND IS NEVER RE-TYPED. BRAND.md is explicit: "use the supplied
 * SVG paths as the master artwork ... do not rebuild it with live text or manually realign
 * individual letters". So the logo is an <img>, its width is the guide's navigation preference
 * (146px, inside the 144-180px band), and its alt text comes from `brand.productName` -- which is
 * also what keeps the brand guard satisfied, since the product name may not appear as a literal
 * anywhere outside the brand file.
 *
 * CLEAR SPACE. The guide requires at least 0.25H around the visible artwork, H being the symbol
 * height. At a 146px lockup H is about 37px, so 0.25H is roughly 10px; the 10px vertical padding
 * on the link is that allowance, and the header's own gap supplies far more horizontally.
 */

/* The disclosure's id, used by the Escape handler below and asserted by `_chrome.test.tsx`. One
 * constant so the script and the markup cannot drift. */
const MENU_ID = "site-menu";

/**
 * ESCAPE, AND NOTHING ELSE.
 *
 * <details> is the whole drawer: the open state is the `open` attribute, the control is a
 * <summary>, and both are the browser's. That buys the expanded state in the accessibility tree,
 * keyboard operation, and a panel that works with JavaScript switched off -- none of which this
 * file would get from React state, and all of which would have cost `"use client"` on a component
 * every route renders.
 *
 * The one thing <details> does not do is close on Escape, and the brief requires it. This is the
 * smallest thing that adds it: a static listener, emitted as text, with no React, no hydration and
 * no component state. It is an ENHANCEMENT and is written to behave like one -- with the script
 * blocked the drawer still opens, still closes from its own control, and still reads correctly to
 * assistive technology. Nothing below depends on it having run.
 *
 * Focus returns to the summary, because closing a panel while the focus ring is inside it leaves a
 * keyboard user on an element that no longer renders, and their next Tab starts from the top of
 * the document.
 */
const MENU_ESCAPE_SCRIPT = `document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var d=document.getElementById(${JSON.stringify(
  MENU_ID,
)});if(!d||!d.open)return;d.open=false;var s=d.querySelector("summary");if(s)s.focus();});`;

/**
 * THE PHONE AND TABLET NAVIGATION, AND THE TWO MEASUREMENTS THAT SHAPED IT.
 *
 * Both numbers come from `apps/web/scripts/mobile-audit.mjs` against a production build, not from
 * reading the classes:
 *
 *   1. NOTHING BUT THE LOGO AND THE CTA WAS REACHABLE ON A PHONE. The six NAV entries live in a
 *      `hidden md:flex` element, so below md they are display:none -- not merely small, but absent
 *      from the accessibility tree and from keyboard order. Measured over every visible link on the
 *      home page at 360, with all seven <details> on the page forced open, the complete set of
 *      internal destinations was `/`, `/dashboard`, `/terms`, `/privacy`. `/connections` -- the
 *      screen that attaches a data source, which is what the product is for -- was reachable from
 *      no page on the site.
 *
 *   2. `md:` WAS REVEALING A NAV THAT DOES NOT FIT AT md. At exactly 768px the six links appear and
 *      the header's minimum content width goes from 767px to 964px, so all 19 header-bearing routes
 *      scrolled sideways by 196px. The sweep: broken at 320 (+46) and 360 (+6), clean 375-767,
 *      broken continuously 768-963. So the row is revealed at `lg` (1024) instead, which is the
 *      first breakpoint above the 964px the row actually needs, and the drawer covers everything
 *      below it. This is why the fix is not simply "add a hamburger below md".
 *
 * WHY THE BAR LOSES THE CTA BELOW lg. At 320 the header's own minimum was 366px -- 46px more than
 * the viewport -- with only the logo and the CTA in it. The logo is 146px and fixed by the brand
 * guide, so a 44px control and a 140px CTA cannot both be added to it: the CTA moves into the
 * panel, where it is full-width and 48px tall rather than 140x40, and the bar is the logo plus one
 * control. `/dashboard` is therefore in the panel twice, as the wayfinding entry NAV already
 * carries and as the accent action the bar can no longer hold. That is deliberate duplication and
 * not an oversight.
 *
 * THE PANEL IS ABSOLUTE, NOT IN FLOW. An open disclosure in the header's flex row would push the
 * page down under the reader's thumb between the tap that opened it and the tap that follows. It
 * is positioned against the header instead, so it overlays; `top-full` reads the header's height
 * rather than restating 94px.
 */
export function SiteHeader() {
  return (
    <>
      <header className="relative mx-auto flex h-[94px] max-w-[1200px] items-center gap-4 px-8 lg:gap-12">
        <a href="/" className="flex shrink-0 py-2.5">
          <img src={brand.logoPath} alt={brand.productName} width={146} height={42} />
        </a>

        {/* The row. `hidden lg:flex` rather than `hidden md:flex` -- see 2 above. It is also FIRST
            among the header's two <nav> elements on purpose: the harness probes
            `header nav` to prove the stylesheet arrived, and that probe must find the one whose
            computed display is none below the breakpoint. */}
        <nav aria-label={NAV_MENU.navLabel} className="hidden flex-1 gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-ink-muted hover:text-accent inline-flex min-h-[44px] items-center text-sm"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="/dashboard"
          className="bg-accent text-ink-on-accent hover:bg-accent-hover ml-auto hidden min-h-[44px] items-center gap-3 rounded-[10px] px-5 text-sm font-bold transition-colors lg:ml-0 lg:inline-flex"
        >
          {SITE.ctaNav}
          <span aria-hidden="true">&rarr;</span>
        </a>

        <details id={MENU_ID} className="group ml-auto lg:hidden">
          {/* `list-none` removes the disclosure triangle in every engine that follows the spec and
              the ::-webkit-details-marker rule removes it in the one that does not. The accessible
              name is the aria-label AND the visible word, which are the same constant: below 360px
              the bar has no room for the word, and a control that loses its name at 320 is a
              control a voice user cannot say. */}
          <summary
            aria-label={NAV_MENU.label}
            className="border-line bg-surface text-ink hover:border-accent inline-flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-bold transition-colors [&::-webkit-details-marker]:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="block group-open:hidden"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="hidden group-open:block"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span className="hidden min-[360px]:inline">{NAV_MENU.label}</span>
          </summary>

          {/* `hidden group-open:block` IS NOT DECORATION, and it is not what <details> already does.
              A closed <details> hides its contents with `content-visibility: hidden`, which also
              applies PAINT CONTAINMENT to the slot -- and a paint-contained box is a containing
              block for absolutely positioned descendants. So while closed, this panel resolved
              `inset-x-0` against the summary's own box instead of against the header, and laid out
              as a 40px-wide box that nothing paints. Invisible to a reader; NOT invisible to a
              measuring instrument, which duly reported a 40x48 tap target and a content overflow
              inside a drawer nobody had opened. Being display:none while closed removes the
              phantom box rather than the report of it. */}
          <div className="border-line bg-surface absolute inset-x-0 top-full z-50 hidden max-h-[calc(100dvh-94px)] overflow-y-auto border-y px-8 py-4 shadow-[0_16px_40px] shadow-line-soft group-open:block">
            <nav aria-label={NAV_MENU.navLabel}>
              <ul className="m-0 list-none p-0">
                {NAV.map((item) => (
                  <li key={item.href} className="border-line-soft border-b last:border-b-0">
                    <a
                      href={item.href}
                      className="text-ink hover:text-accent flex min-h-[52px] items-center text-base font-bold transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <a
              href="/dashboard"
              className="bg-accent text-ink-on-accent hover:bg-accent-hover mt-4 flex min-h-[48px] items-center justify-center gap-3 rounded-[10px] px-5 text-sm font-bold transition-colors"
            >
              {SITE.ctaNav}
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </details>
      </header>

      {/* The value is a module constant in this file. There is no input to it, and Next has no
          other way to emit a listener that does not arrive as a hydrated client component. */}
      <script dangerouslySetInnerHTML={{ __html: MENU_ESCAPE_SCRIPT }} />
    </>
  );
}

/**
 * The footer carries the imprint, which is a legal requirement rather than a design choice: the
 * entity, its registered address, its registration number and a contact address. Every one of them
 * comes from `@repo/brand` and none is restated here.
 */
export function Footer() {
  return (
    <footer className="border-line bg-surface border-t">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-8 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <img src={brand.logoPath} alt={brand.productName} width={136} height={39} />
          <p className="text-ink-muted mt-3 text-xs">{SITE.footerTagline}</p>
        </div>

        <div className="text-xs">
          <strong className="text-ink mb-2 block">{brand.legalEntity}</strong>
          <p className="text-ink-muted">{formatAddress()}</p>
          <p className="text-ink-muted mt-2">
            <a
              className="text-accent underline-offset-4 hover:underline"
              href={`mailto:${brand.supportEmail}`}
            >
              {brand.supportEmail}
            </a>
          </p>
        </div>

        <div className="text-ink-muted text-xs">
          <p>{SITE.footerNote}</p>
          <p className="mt-1">{SITE.footerNote2}</p>
          {/* A registration number is an identifier, not a sentence, so it is written inline. */}
          <p className="mt-4">Company registration {brand.companyRegistration}</p>

          {/* Linked from every page, because a policy reachable only by typing its URL is not
              published in any sense a regulator or a customer would accept. */}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <a key={link.href} className="text-accent hover:underline" href={link.href}>
                {link.label}
              </a>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
