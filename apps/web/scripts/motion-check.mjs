/**
 * THE MOTION HARNESS -- does the reveal run, and can it ever leave a reader looking at nothing?
 *
 * Two questions, and the second is the one a stylesheet cannot answer on its own. `motion.test.ts`
 * proves the CSS is *written* so that content cannot be hidden; this proves it *behaves* that way
 * in an engine that actually implements scroll-driven animations.
 *
 * THE THIRD CHECK IS THE ONE WORTH KEEPING. "Nothing is invisible" is also exactly what a reveal
 * that never runs looks like -- a passing report from a system doing nothing at all. So with motion
 * welcome, something must be caught PART-WAY through a reveal mid-scroll, and with reduced motion
 * asked for, nothing may ever be part-way anywhere. The two together distinguish "working" from
 * "inert" and from "broken", which no single measurement does.
 *
 * THE SELECTOR IS THE THING TO KEEP IN STEP. Adding `.reveal-side` to the stylesheet without
 * adding it here dropped the tracked count from 27 to 24 and the harness still reported OK -- it
 * was simply not looking at the three elements that had just changed. A count is printed on every
 * run for that reason: a number that falls after a change is the tell.
 *
 * Usage: node scripts/motion-check.mjs   (with a production server already running)
 *        BASE=http://127.0.0.1:3001 node scripts/motion-check.mjs
 */
import { launchBrowser } from "./_browser.mjs";

const URL_BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const browser = await launchBrowser();

async function probe(label, reduced) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(URL_BASE, { waitUntil: "networkidle" });

  // Every element the motion system touches, and whether a reader can actually see it.
  const read = async () =>
    page.$$eval(".reveal, .reveal-side, .reveal-group > *, .draw-trend", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          cls: (el.className.baseVal ?? el.className).toString().slice(0, 28),
          opacity: Number(cs.opacity),
          inView: r.top < innerHeight && r.bottom > 0,
        };
      }),
    );

  const atTop = await read();

  // THE OTHER DIRECTION, AND THE ONE THAT MATTERS MORE. "Nothing is invisible" is also exactly
  // what a reveal that never runs looks like. Mid-scroll, something should be caught in the act.
  await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight * 0.22)));
  await page.waitForTimeout(120);
  const midScroll = await read();
  const inProgress = midScroll.filter((e) => e.opacity > 0.01 && e.opacity < 0.99);
  console.log(
    `${label}: mid-scroll elements caught part-way through a reveal: ${inProgress.length}`,
  );

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  const atBottom = await read();

  // An element that is in view and still transparent is one a reader is looking at and cannot see.
  const invisibleInView = atBottom.filter((e) => e.inView && e.opacity < 0.95);
  console.log(
    `${label}: ${atBottom.length} tracked elements | in-view-but-invisible after scroll: ${invisibleInView.length}`,
  );
  for (const e of invisibleInView) console.log(`    ${e.tag}.${e.cls} opacity=${e.opacity}`);
  const topInvisible = atTop.filter((e) => e.inView && e.opacity < 0.95);
  console.log(`    above the fold on load, invisible: ${topInvisible.length}`);
  for (const e of topInvisible) console.log(`      ${e.tag}.${e.cls} opacity=${e.opacity}`);

  await page.screenshot({ path: `/tmp/shot-${label}.png`, fullPage: false });
  await ctx.close();
  return { broken: invisibleInView.length + topInvisible.length, inProgress: inProgress.length };
}

const a = await probe("motion", false);
const b = await probe("reduced", true);
await browser.close();

const problems = [];
if (a.broken + b.broken > 0) problems.push("content a reader is looking at is invisible");
// With motion welcome the reveal must actually be observable, or this whole system is inert.
if (a.inProgress === 0)
  problems.push("no reveal was caught running -- the animation is not applying");
// With stillness asked for, nothing may ever be part-way anywhere.
if (b.inProgress > 0) problems.push("a reveal ran for a reader who asked for reduced motion");
console.log(problems.length === 0 ? "OK" : `PROBLEM: ${problems.join("; ")}`);
process.exit(problems.length === 0 ? 0 : 1);
