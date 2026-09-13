/**
 * WHAT THIS COUNTS, AND WHY IT DOES NOT COUNT `<svg>` ELEMENTS.
 *
 * The benchmark figure this harness exists to close -- "203 image elements on each reference
 * against one screenshot here" -- was taken by counting `<img>`, `<picture>`, `<video>` and
 * `<svg>` tags in the two references' HTML. Counting tags flatters this page badly in one
 * direction and punishes it in another, and both are worth refusing:
 *
 *   * A 24x24 line icon repeated down a feature list is four `<svg>` elements and no imagery. A
 *     tag count says the page is illustrated; a reader says it is a list with bullets.
 *   * A panel drawn in markup -- the hero's dashboard, a bar chart built from divs -- is zero
 *     tags and is unmistakably a picture. Those already carry `role="img"` and an `aria-label`,
 *     because a screen reader needs to be told the same thing, so the selector reads that rather
 *     than an attribute invented for this harness. A count you can raise by adding an attribute is
 *     a count worth nothing; this one moves only when something is actually drawn.
 *
 * So this measures PAINTED AREA, per element, in CSS pixels, and only counts an element whose
 * painted box is large enough to read as a picture rather than as a bullet. That is the number a
 * visitor experiences, and it is the number that cannot be inflated by adding more bullets.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3312";
const PAGES = (
  process.env.PAGES ??
  "/,/pricing,/integrations,/for/cafe,/for/salon,/for/online-shop,/security,/docs"
)
  .split(",")
  .filter(Boolean);

/** Below this, an element is a glyph. A 28px icon is 784px^2; the floor sits well above it. */
const PICTURE_AREA_FLOOR = 6000;

// MEASURING THE REFERENCES WITH THE SAME RULER IS THE POINT OF THE HARNESS, so it has to be
// able to reach them. Outbound HTTPS in this environment goes through an agent proxy that
// Chromium does not read from the environment the way Node does; a bare launch reports
// ERR_CONNECTION_RESET, which looks exactly like a site refusing us. Passing it explicitly is the
// difference between "the reference has no imagery" and "we could not load the reference".
const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch(
  proxy && !BASE.startsWith("http://127.0.0.1") ? { proxy: { server: proxy } } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let total = 0;
for (const path of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (!res || res.status() !== 200) {
    console.log(`${path.padEnd(18)} HTTP ${res ? res.status() : "no response"} -- NOT MEASURED`);
    process.exitCode = 1;
    continue;
  }
  const counted = await page.evaluate((floor) => {
    // An element counts once. A `<figure>` wrapping an `<svg>` must not score twice, so a
    // candidate whose ancestor already counted is skipped.
    const counted = [];
    const claimed = new Set();
    const candidates = document.querySelectorAll('img, picture, video, canvas, svg, [role="img"]');
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < floor) continue;
      let p = el.parentElement;
      let nested = false;
      while (p) {
        if (claimed.has(p)) {
          nested = true;
          break;
        }
        p = p.parentElement;
      }
      if (nested) continue;
      claimed.add(el);
      counted.push({ tag: el.tagName.toLowerCase(), area: Math.round(area) });
    }
    return counted;
  }, PICTURE_AREA_FLOOR);

  total += counted.length;
  const byTag = counted.reduce((acc, c) => ({ ...acc, [c.tag]: (acc[c.tag] ?? 0) + 1 }), {});
  console.log(
    `${path.padEnd(18)} pictures=${String(counted.length).padStart(3)}  ` +
      Object.entries(byTag)
        .map(([t, n]) => `${t}:${n}`)
        .join(" "),
  );
}

console.log(`TOTAL pictures across ${PAGES.length} pages: ${total}`);
await browser.close();
