/**
 * THE DESKTOP FIT HARNESS -- the widths nobody had measured.
 *
 * `mobile-audit.mjs` covers 320 through 768. Everything above that was assumed, and the assumption
 * was wrong: the site's primary call to action sat past the right edge of a 13-inch laptop for as
 * long as `NAV` had nine entries. This measures the laptop range against a real production build
 * and reports three things per width, because they fail independently:
 *
 *   doc      the DOCUMENT scrolling sideways -- the whole page draggable, which is the visible one
 *   hdr      the HEADER overflowing its own box -- invisible where the bar clips, a clipped CTA
 *            where it does not, and the thing that was actually broken
 *   clipped  a link whose right edge is past the viewport -- unreachable, whatever the two above say
 *
 * IT ALSO PROVES THE STYLESHEET ARRIVED, and that check is not decoration. A first run of this
 * measurement was taken against a server still holding a previous build's asset hashes, so every
 * utility was absent: `display: inline` on elements classed `block`, `max-width: none` on a
 * `max-w-[1200px]` section, and 570px of invented overflow. An unstyled page measures beautifully
 * wrong. If `max-width` on the first constrained section is not 1200px, nothing else here means
 * anything.
 *
 * Usage: node scripts/header-fit.mjs   (with a production server already running)
 *        BASE=http://127.0.0.1:3001 node scripts/header-fit.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const WIDTHS = [360, 768, 1024, 1152, 1280, 1366, 1440, 1600, 1920];

const browser = await chromium.launch();
const rows = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  // Walk the page so lazily-loaded images take their real size before anything is measured.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);

  rows.push(
    await page.evaluate((w) => {
      const cw = document.documentElement.clientWidth;
      const header = document.querySelector("header");
      const links = [...header.querySelectorAll("a")].filter((a) => a.getClientRects().length > 0);
      const section = document.querySelector('section[class*="max-w-"]');
      return {
        width: w,
        styled: section ? getComputedStyle(section).maxWidth : "no section",
        doc: document.documentElement.scrollWidth - cw,
        hdr: header.scrollWidth - header.clientWidth,
        clipped: links.filter((a) => a.getBoundingClientRect().right > innerWidth + 0.5).length,
        links: links.length,
      };
    }, width),
  );
  await ctx.close();
}
await browser.close();

let bad = 0;
for (const r of rows) {
  const ok = r.styled !== "none" && r.doc === 0 && r.hdr === 0 && r.clipped === 0;
  if (!ok) bad += 1;
  console.log(
    `${String(r.width).padStart(4)}px  styled=${String(r.styled).padStart(7)}  doc=${String(r.doc).padStart(4)}  header=${String(r.hdr).padStart(4)}  clipped=${r.clipped}  links=${r.links}  ${ok ? "" : "<-- FAIL"}`,
  );
}
console.log(bad === 0 ? "PASS: fits at every measured width" : `FAIL at ${bad} widths`);
process.exit(bad === 0 ? 0 : 1);
