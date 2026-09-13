/**
 * THE MOBILE AND THAI MEASUREMENT HARNESS.
 *
 * Issue #54 phase 1. It measures; it changes nothing. Every number a design decision rests on
 * comes out of a real Chromium against a real production build, because the failure this repo
 * keeps hitting is a plausible number nobody produced -- an audit that read `max-w-[1200px]` as a
 * fixed width and filed twenty false positives is the local instance of it.
 *
 * WHY A PRODUCTION BUILD AND NOT `next dev`. Dev injects the error overlay and the dev toolbar
 * into the DOM, and does not tree-shake. Both change what is on the page and therefore what
 * `scrollWidth` reports, so an overflow measured in dev is not the overflow a customer gets. This
 * script refuses to guess: it runs `next build` (unless a build is already present and
 * --no-build is passed) and serves it with `next start`.
 *
 * WHY THE BROWSER DECODES ITS OWN SCREENSHOTS. The Thai question -- do the tone marks actually
 * clip -- cannot be answered from the layout API. `getBoundingClientRect()` returns the line box,
 * which is font-size x line-height, and says nothing about where the glyph's ink lands. So the
 * harness screenshots the heading, hands the PNG back to a second page as a data URL, draws it to
 * a canvas and reads the pixels: the topmost and bottommost row containing ink IS the answer,
 * measured rather than predicted. A `<canvas>` in the page is used the same way to get the font's
 * own ink extents via TextMetrics.actualBoundingBoxAscent/Descent.
 *
 * PINNED PLAYWRIGHT. `playwright@1.56.0` is the release whose chromium revision is 1194, which is
 * what is installed under PLAYWRIGHT_BROWSERS_PATH. Bumping playwright without a matching browser
 * download makes this script fail at launch with "Executable doesn't exist"; that is the version
 * pin's whole job, so change both together or neither.
 *
 *   usage:  node apps/web/scripts/mobile-audit.mjs
 *           node apps/web/scripts/mobile-audit.mjs --no-build          reuse .next
 *           node apps/web/scripts/mobile-audit.mjs --base=http://host  measure something running
 *           node apps/web/scripts/mobile-audit.mjs --out=DIR           default .mobile-audit/
 *           node apps/web/scripts/mobile-audit.mjs --widths=360,768
 *           node apps/web/scripts/mobile-audit.mjs --routes=/,/pricing
 *
 * Writes <out>/report.json (every measurement, machine-readable), <out>/summary.txt (the same
 * thing readable) and <out>/shots/*.png. Exits 0 when it measured successfully -- a FINDING IS
 * NOT A FAILURE. This is an instrument, not a guard: it must not start refusing builds on its own
 * authority, and the numbers it prints are for a person to decide about.
 */

import { spawn } from "node:child_process";
import { mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* The workspace-local binary, not `npx`: `npx` may go to the network and may resolve to a
 * different Next than the one that produced .next, which would serve a build this did not make. */
const NEXT_BIN = resolve(WEB_DIR, "node_modules/.bin/next");

/* The four widths in the issue. 320 is the iPhone SE / small Android floor, 360 the single most
 * common Android width, 390 the modern iPhone, 768 the tablet portrait breakpoint -- which is
 * also `md`, so it is the width at which the header nav is supposed to reappear. */
const DEFAULT_WIDTHS = [320, 360, 390, 768];

/* Every route reachable without a session. The signed-in four are included deliberately and
 * flagged: with no NEXT_PUBLIC_SUPABASE_URL set, middleware.ts returns `next()` rather than
 * redirecting, so they render here. That is a measurement convenience, not a claim that a
 * stranger can reach them in production. */
const DEFAULT_ROUTES = [
  "/",
  "/pricing",
  "/integrations",
  "/docs",
  "/privacy",
  "/terms",
  "/signin",
  "/envelope",
  "/fields/google-ads",
  "/waitlist",
  "/connectors/ga4",
  "/connectors/google-ads",
  "/connectors/meta-ads",
  "/connectors/search-console",
  "/connectors/shopify",
  "/connectors/woocommerce",
  "/dashboard",
  "/connections",
  "/billing",
  "/welcome",
];

/* Tone marks ABOVE the base glyph and sara-u BELOW it, in the same word, which is the whole point:
 * a string with marks on only one level cannot reveal a leading that is too tight for two.
 *
 *   ธุ  = THO THONG + SARA U        (below)
 *   ข้  = KHO KHAI + MAI THO        (above)
 *   คุ  = KHO KHWAI + SARA U        (below)
 *   น้  = NO NU + MAI THO           (above)
 *
 * It means "your business on one page", so it is also plausibly a headline rather than lorem. */
const THAI = "ธุรกิจของคุณในหน้าเดียว";
/* Long enough to wrap at 320px, which is where two adjacent lines can collide. */
const THAI_LONG = "ธุรกิจของคุณในหน้าเดียว ทุกยอดขายและค่าโฆษณาอยู่ที่นี่ทั้งหมด";

const WCAG_TAP_MIN = 44; /* WCAG 2.5.5 AAA / Apple HIG. */
const MIN_FONT_PX = 12;

const argv = process.argv.slice(2);
const flag = (name) => argv.some((a) => a === `--${name}`);
const value = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};

const OUT = resolve(process.cwd(), value("out", ".mobile-audit"));
const WIDTHS = value("widths", "") ? value("widths", "").split(",").map(Number) : DEFAULT_WIDTHS;
const ROUTES = value("routes", "") ? value("routes", "").split(",") : DEFAULT_ROUTES;

/* ------------------------------------------------------------------------------------------
 * Serving
 * ---------------------------------------------------------------------------------------- */

function run(cmd, args, opts = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))));
    child.on("error", fail);
  });
}

async function waitForServer(base, tries = 120, exited = () => null) {
  for (let i = 0; i < tries; i += 1) {
    const code = exited();
    if (code !== null) {
      throw new Error(
        `next start exited ${code} before serving -- see ${join(OUT, "next-start.log")}`,
      );
    }
    try {
      const res = await fetch(base, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${base} never answered`);
}

/* ------------------------------------------------------------------------------------------
 * In-page measurement. Everything below runs inside the browser.
 * ---------------------------------------------------------------------------------------- */

/**
 * A selector that identifies the element to a person reading the report.
 *
 * NOT `nth-child` alone. A bare structural path tells you where an element sits and nothing about
 * what it is, and the reader of this report has to find the JSX that produced it. So each step
 * carries the tag, up to three of its classes, and an nth-of-type only where it is needed to
 * disambiguate. Utility classes are what make it findable in a Tailwind codebase -- `px-8` in the
 * path is the grep that fixes it.
 */
const PAGE_HELPERS = `
function mpSelector(el) {
  const steps = [];
  let node = el;
  while (node && node.nodeType === 1 && steps.length < 5) {
    if (node.tagName === 'HTML' || node.tagName === 'BODY') break;
    let step = node.tagName.toLowerCase();
    if (node.id) { steps.unshift(step + '#' + node.id); break; }
    const cls = (node.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean);
    if (cls.length) step += '.' + cls.slice(0, 3).join('.');
    const parent = node.parentElement;
    if (parent) {
      const sibs = [...parent.children].filter((c) => c.tagName === node.tagName);
      if (sibs.length > 1) step += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
    }
    steps.unshift(step);
    node = node.parentElement;
  }
  return steps.join(' > ');
}

function mpVisible(el) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/* Is this element's horizontal reach absorbed by a scrolling/clipping ancestor? If it is, it
 * cannot be what made the DOCUMENT scroll, and reporting it as the culprit sends the next person
 * to the wrong file. Every wide table on this site sits inside overflow-x-auto on purpose. */
function mpContained(el) {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const o = getComputedStyle(node).overflowX;
    if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return mpSelector(node);
    node = node.parentElement;
  }
  return null;
}

function mpText(el) {
  const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
  return t.length > 60 ? t.slice(0, 60) + '\\u2026' : t;
}
`;

async function measureRoute(page) {
  return page.evaluate(`(() => {
    ${PAGE_HELPERS}
    const de = document.documentElement;
    const clientWidth = de.clientWidth;
    const scrollWidth = de.scrollWidth;
    const overflowPx = scrollWidth - clientWidth;

    /* DOES IT ACTUALLY PAN. scrollWidth is a number about boxes; this is the thing a customer
     * experiences -- swipe left and see whether the page moves. Both are reported because they
     * are not always the same number and the difference is informative. */
    const scrollYWas = window.scrollY;
    window.scrollTo(100000, scrollYWas);
    const panXAchieved = Math.round(window.scrollX);
    window.scrollTo(0, scrollYWas);

    /* --- who is wide ---------------------------------------------------------------------- */
    /* TWO WAYS AN ELEMENT PUSHES THE DOCUMENT WIDER, and a scan that knows only the first will
     * confidently name the wrong element.
     *
     *   BOX overflow   -- the element's own border box sticks out past the viewport. A bounding
     *                     rect shows it.
     *   CONTENT overflow -- the border box fits, but what is inside it does not and cannot be
     *                     broken: a long unwrapped numeral, a nowrap label, a min-content floor.
     *                     getBoundingClientRect() reports the box, which is INSIDE the viewport,
     *                     so a rect-only scan sees nothing at all -- while scrollWidth on the
     *                     element is larger than clientWidth and the excess propagates up every
     *                     ancestor with overflow-x: visible until it reaches <html>.
     *
     * The second is what the hero mock does at 360, and it is invisible to the kind of audit that
     * reads class names or rects. So REACH below is the further of the two edges, and the culprit
     * is the deepest element that reaches furthest. */
    const wide = [];
    for (const el of document.querySelectorAll('*')) {
      if (!mpVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const visibleX = getComputedStyle(el).overflowX === 'visible';
      const contentRight = visibleX ? r.left + el.scrollWidth : r.right;
      const reach = Math.max(r.right, contentRight);
      const under = Math.round(r.left * 100) / 100;
      if (reach <= clientWidth + 0.5 && under >= -0.5) continue;
      wide.push({
        el,
        right: reach,
        boxRight: r.right,
        contentRight,
        kind: contentRight > r.right + 0.5 ? 'content' : 'box',
        left: r.left,
        over: Math.round((reach - clientWidth) * 100) / 100,
        width: r.width,
        scrollWidth: el.scrollWidth,
        clientWidthOfEl: el.clientWidth,
      });
    }
    /* The culprit is the DEEPEST element that reaches furthest -- a parent is only as wide as the
     * child that stretched it, and naming the parent is how a fix lands on the wrong element. */
    const deepest = wide.filter(
      ({ el, right }) => !wide.some((o) => o.el !== el && el.contains(o.el) && o.right >= right - 0.5),
    );
    const described = deepest
      .map(({ el, over, width, right, left, kind, boxRight, scrollWidth: sw, clientWidthOfEl }) => ({
        selector: mpSelector(el),
        tag: el.tagName.toLowerCase(),
        kind,
        overflowPx: over,
        leftPx: Math.round(left * 100) / 100,
        widthPx: Math.round(width * 100) / 100,
        boxRightPx: Math.round(boxRight * 100) / 100,
        rightPx: Math.round(right * 100) / 100,
        elScrollWidth: sw,
        elClientWidth: clientWidthOfEl,
        containedBy: mpContained(el),
        text: mpText(el),
      }))
      .sort((a, b) => b.rightPx - a.rightPx);

    /* THE SPLIT THAT MATTERS. An element inside overflow-x-auto reaches 2900px and scrolls its own
     * container; it did not make the DOCUMENT scroll, and every wide table on this site is one
     * deliberately. Only the uncontained ones are answerable for the number at the top of the
     * report, so they are reported first and separately -- ranking by raw width alone buries the
     * 30px culprit under eight marquee tiles. */
    const culprits = described.filter((c) => c.containedBy === null);
    const containedCulprits = described.filter((c) => c.containedBy !== null);

    /* --- WHO IS ANSWERABLE, PROVED RATHER THAN INFERRED -------------------------------------- */
    /* Reading rects and class names is how the last audit of this page produced a list nobody
     * could act on. Two different real overflows here are invisible to it: content that does not
     * fit an in-viewport box, and -- on /pricing -- absolutely-positioned .sr-only spans inside a
     * table that DO sit inside overflow-x-auto and are not clipped by it anyway, because that
     * scroller is position:static and so is not their containing block.
     *
     * So this does not reason about it. It hides one candidate, re-reads
     * documentElement.scrollWidth, and puts it back. An element whose removal makes the document
     * narrower is answerable for the difference; one whose removal changes nothing is not,
     * however wide it looks. Candidates are every element reaching past the viewport plus every
     * element whose own content does not fit, deepest first, so the blame lands on the leaf and
     * not on the <section> that merely carries it. */
    const proven = [];
    if (overflowPx > 0.5) {
      const candidates = [];
      for (const el of document.querySelectorAll('*')) {
        if (el === de || el === document.body) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const fitsOwnContent = el.scrollWidth <= el.clientWidth + 0.5;
        if (r.right <= clientWidth + 0.5 && r.left >= -0.5 && fitsOwnContent) continue;
        let depth = 0;
        for (let n = el; n; n = n.parentElement) depth += 1;
        candidates.push({ el, depth });
      }
      candidates.sort((a, b) => b.depth - a.depth);
      for (const { el, depth } of candidates.slice(0, 400)) {
        const prev = el.style.display;
        el.style.display = 'none';
        const without = de.scrollWidth;
        el.style.display = prev;
        if (without >= scrollWidth - 0.5) continue;
        proven.push({
          selector: mpSelector(el),
          tag: el.tagName.toLowerCase(),
          depth,
          documentWidthWithoutIt: without,
          removesPx: Math.round((scrollWidth - without) * 100) / 100,
          /* Does removing this ONE element end the overflow completely, or only shorten it. */
          endsOverflow: without <= clientWidth + 0.5,
          rectRight: Math.round(el.getBoundingClientRect().right * 100) / 100,
          elScrollWidth: el.scrollWidth,
          elClientWidth: el.clientWidth,
          position: getComputedStyle(el).position,
          containedBy: mpContained(el),
          text: mpText(el),
        });
      }
      proven.sort((a, b) => b.removesPx - a.removesPx || b.depth - a.depth);
    }

    /* --- where content overflow STARTS ------------------------------------------------------ */
    /* The hero section reports the whole +30px, but it is not the thing to change: the excess is
     * born in a leaf whose own text will not fit its cell and is carried upward by every ancestor
     * with visible overflow. These are the leaves -- the elements with no descendant that also
     * fails to fit -- which is where the change belongs. */
    const origins = [];
    for (const el of document.querySelectorAll('*')) {
      if (!mpVisible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible') continue;
      const excess = el.scrollWidth - el.clientWidth;
      if (excess <= 0.5) continue;
      const deeper = [...el.querySelectorAll('*')].some(
        (d) => getComputedStyle(d).overflowX === 'visible' && d.scrollWidth - d.clientWidth > 0.5,
      );
      if (deeper) continue;
      origins.push({
        selector: mpSelector(el),
        tag: el.tagName.toLowerCase(),
        excessPx: excess,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        whiteSpace: cs.whiteSpace,
        text: mpText(el),
      });
    }
    origins.sort((a, b) => b.excessPx - a.excessPx);

    /* --- tap targets ---------------------------------------------------------------------- */
    const taps = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role=button], [role=link], summary')) {
      if (!mpVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width * 100) / 100;
      const h = Math.round(r.height * 100) / 100;
      if (w >= ${WCAG_TAP_MIN} && h >= ${WCAG_TAP_MIN}) continue;
      const sel = mpSelector(el);
      const key = sel + '|' + w + 'x' + h;
      if (seen.has(key)) continue;
      seen.add(key);
      taps.push({
        selector: sel,
        tag: el.tagName.toLowerCase(),
        width: w,
        height: h,
        under: [w < ${WCAG_TAP_MIN} ? 'width' : null, h < ${WCAG_TAP_MIN} ? 'height' : null].filter(Boolean).join('+'),
        text: mpText(el),
        href: el.getAttribute('href') || null,
      });
    }

    /* --- small type ----------------------------------------------------------------------- */
    const small = [];
    const smallSeen = new Set();
    for (const el of document.querySelectorAll('*')) {
      /* Only elements with their OWN text. Reporting a wrapper repeats one <span> as six findings
       * and buries how many distinct places actually set 9px. */
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length);
      if (!own || !mpVisible(el)) continue;
      const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100;
      if (px >= ${MIN_FONT_PX}) continue;
      const sel = mpSelector(el);
      const key = sel + '|' + px;
      if (smallSeen.has(key)) continue;
      smallSeen.add(key);
      small.push({ selector: sel, px, text: mpText(el) });
    }

    /* --- the header, specifically ---------------------------------------------------------- */
    const header = document.querySelector('header');
    const headerLinks = header
      ? [...header.querySelectorAll('a, button')].filter(mpVisible).map((el) => ({
          text: mpText(el),
          href: el.getAttribute('href') || null,
          label: el.getAttribute('aria-label') || null,
        }))
      : [];
    const headerHiddenNav = header
      ? [...header.querySelectorAll('nav a')].filter((el) => !mpVisible(el)).map((el) => ({
          text: mpText(el),
          href: el.getAttribute('href') || null,
        }))
      : [];
    const footerLinks = [...document.querySelectorAll('footer a')].filter(mpVisible).map((el) => ({
      text: mpText(el),
      href: el.getAttribute('href') || null,
    }));

    return {
      clientWidth,
      scrollWidth,
      overflowPx: Math.round(overflowPx * 100) / 100,
      culprits: culprits.slice(0, 8),
      culpritCount: culprits.length,
      containedCulprits: containedCulprits.slice(0, 4),
      containedCulpritCount: containedCulprits.length,
      contentOverflowOrigins: origins.slice(0, 10),
      contentOverflowOriginCount: origins.length,
      panXAchieved,
      provenCulprits: proven.slice(0, 10),
      provenCulpritCount: proven.length,
      tapTargets: taps,
      smallText: small,
      headerLinks,
      headerHiddenNav,
      footerLinks,
    };
  })()`);
}

/* ------------------------------------------------------------------------------------------
 * The Thai test
 * ---------------------------------------------------------------------------------------- */

/**
 * Substitute Thai, then measure four different things, because "does it clip" is four questions:
 *
 *   1. WHICH FACE ACTUALLY RENDERED. --mp-font-display carries no Thai face by design, so a Thai
 *      h1 falls out of Inter Tight into whatever the fallback chain finds. Measured by comparing
 *      the string's advance width under the computed stack against the same string under a
 *      deliberately absent family; if they match, nothing in the stack has the glyphs.
 *   2. INK vs LINE BOX. TextMetrics.actualBoundingBox{Ascent,Descent} are the real inked extents
 *      of THIS string in THIS face at THIS size. Line box is font-size x line-height. Ink taller
 *      than the box is the condition that makes marks collide between lines.
 *   3. LINE COLLISION. With the string wrapped over two or more lines, does line N's ink bottom
 *      cross line N+1's ink top.
 *   4. WHETHER ANYTHING IS ACTUALLY CUT OFF. An ancestor with overflow hidden and a constrained
 *      height is what turns "ink outside the box" into a visibly severed tone mark.
 */
/**
 * WHICH FACE ACTUALLY DREW THE THAI, settled three ways rather than one.
 *
 * The obvious test -- measure the string under the computed stack and again under a family that
 * does not exist, and call them equal or not -- is WRONG, and produced a confidently inverted
 * answer on the first run of this harness: it reported that the display stack (which by design
 * carries no Thai face) HAD rendered its declared face, and that the body stack (which carries
 * Noto Sans Thai) had NOT. The reason is that the two fallbacks are not the same fallback. A
 * missing family on its own falls to the browser's standard font; a stack ending in sans-serif
 * falls to the generic sans. Both mean "the declared face did not draw this", and their advances
 * differ, so the comparison answers a question nobody asked.
 *
 * So inkOf() compares the computed stack against sans-serif alone -- equal means every named face
 * in the stack was skipped for this string -- and against Noto Sans Thai named explicitly. And
 * then the measurement that does not depend on advance arithmetic at all: whether the Noto Sans
 * Thai FontFace in document.fonts reached status "loaded". layout.tsx declares it preload:false
 * and subset to the Thai block, so the browser fetches that file if and only if something on the
 * page painted a Thai codepoint in it. A face still "unloaded" after the substitution is proof
 * the heading did not use it.
 */
async function measureThai(page, lineHeightOverride, which, forceThai, tagLang) {
  return page.evaluate(
    `((over, which, forceThai, tagLang) => {
    ${PAGE_HELPERS}

    function inkOf(el, text) {
      const cs = getComputedStyle(el);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const head = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ';
      const advanceUnder = (family) => {
        ctx.font = head + family;
        return Math.round(ctx.measureText(text).width * 100) / 100;
      };

      ctx.font = head + cs.fontFamily;
      const m = ctx.measureText(text);
      const declared = Math.round(m.width * 100) / 100;
      const genericSans = advanceUnder('sans-serif');
      const explicitThai = advanceUnder('"Noto Sans Thai", sans-serif');
      const missing = advanceUnder('"MpNoSuchFamily"');

      return {
        requestedFamily: cs.fontFamily,
        advanceUnderDeclaredStack: declared,
        advanceUnderGenericSans: genericSans,
        advanceUnderExplicitNotoThai: explicitThai,
        advanceUnderMissingFamily: missing,
        /* Every named face in the declared stack was skipped for this string. */
        fellThroughToGenericSans: Math.abs(declared - genericSans) < 0.5,
        matchesExplicitNotoThai: Math.abs(declared - explicitThai) < 0.5,
        inkAscent: Math.round(m.actualBoundingBoxAscent * 100) / 100,
        inkDescent: Math.round(m.actualBoundingBoxDescent * 100) / 100,
        inkHeight: Math.round((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 100) / 100,
        fontAscent: Math.round(m.fontBoundingBoxAscent * 100) / 100,
        fontDescent: Math.round(m.fontBoundingBoxDescent * 100) / 100,
      };
    }

    function mpFontStatuses() {
      return [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, status: f.status }));
    }

    function clipAncestor(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.overflowY === 'hidden' || cs.overflowY === 'clip') {
          return { selector: mpSelector(node), scrollH: node.scrollHeight, clientH: node.clientHeight };
        }
        node = node.parentElement;
      }
      return null;
    }

    function lineBoxes(el) {
      const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim().length);
      if (!node) return [];
      const range = document.createRange();
      range.selectNodeContents(node);
      return [...range.getClientRects()].map((r) => ({
        top: Math.round(r.top * 100) / 100,
        bottom: Math.round(r.bottom * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        width: Math.round(r.width * 100) / 100,
      }));
    }

    function probe(el, label, text, forceThaiFace) {
      if (!el) return null;
      window.__mpTarget = el;
      if (forceThaiFace) {
        /* The Thai face named FIRST, with the authored stack still behind it. This is the exact
         * shape --mp-font-body already has and --mp-font-display deliberately does not, so what
         * it measures is not a hypothetical: it is what the display stack would render if the
         * Thai face were appended to it. Nothing is forced about the SIZE or the LEADING here --
         * only which face draws the glyphs -- so the leading question stays separable. */
        el.style.fontFamily = forceThaiFace;
      }
      const before = getComputedStyle(el);
      const beforeRect = el.getBoundingClientRect();
      const original = el.textContent;
      el.textContent = text;
      if (over !== null) el.style.lineHeight = String(over);
      /* force layout */
      void el.offsetHeight;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const fontSize = parseFloat(cs.fontSize);
      const lh = cs.lineHeight === 'normal' ? NaN : parseFloat(cs.lineHeight);
      const ink = inkOf(el, text);
      const boxes = lineBoxes(el);

      /* Line N's ink bottom against line N+1's ink top, using the real ink extents. */
      let worstCollision = null;
      for (let i = 0; i + 1 < boxes.length; i += 1) {
        const a = boxes[i];
        const b = boxes[i + 1];
        const aBaseline = a.top + (a.height + fontSize * 0.0) / 2;
        /* Baseline is approximated as the line box centre plus half the font's own ascent/descent
         * imbalance; what matters is the DELTA between two consecutive baselines, which is exact. */
        const baselineGap = b.top - a.top;
        const needed = ink.inkAscent + ink.inkDescent;
        const overlap = Math.round((needed - baselineGap) * 100) / 100;
        if (worstCollision === null || overlap > worstCollision.overlapPx) {
          worstCollision = { lineIndex: i, baselineGapPx: Math.round(baselineGap * 100) / 100, inkHeightPx: needed, overlapPx: overlap };
        }
      }

      const result = {
        label,
        selector: mpSelector(el),
        originalText: original.trim().slice(0, 60),
        thaiText: text,
        fontSizePx: Math.round(fontSize * 100) / 100,
        lineHeightPx: Math.round(lh * 100) / 100,
        lineHeightRatio: Math.round((lh / fontSize) * 1000) / 1000,
        lineHeightSource: over !== null ? 'forced:' + over : 'as-authored',
        fontFamilyDeclared: cs.fontFamily,
        ink,
        /* The measurement H5 turns on: ink taller than the box the leading gives it. */
        inkOverflowsLineBoxPx: Math.round((ink.inkHeight - lh) * 100) / 100,
        lineCount: boxes.length,
        lineBoxes: boxes,
        worstCollision,
        heightBeforePx: Math.round(beforeRect.height * 100) / 100,
        heightAfterPx: Math.round(rect.height * 100) / 100,
        elementScrollH: el.scrollHeight,
        elementClientH: el.clientHeight,
        clippingAncestor: clipAncestor(el),
        /* Viewport-relative box, so the screenshot pass can crop to it. */
        box: {
          x: Math.round(rect.x),
          y: Math.round(rect.y + window.scrollY),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      };
      return result;
    }

    const h1 = document.querySelector('h1');
    /* A card title: the first h3 that sits inside something with a border or a surface class,
     * which is what "card" means in this codebase. Falls back to the first h3. */
    const h3s = [...document.querySelectorAll('h3')].filter(mpVisible);
    const card = h3s.find((el) => {
      let n = el.parentElement;
      for (let i = 0; i < 3 && n; i += 1) {
        const c = n.getAttribute('class') || '';
        if (/border|rounded|bg-surface/.test(c)) return true;
        n = n.parentElement;
      }
      return false;
    }) || h3s[0] || null;

    /* ONE ELEMENT PER PASS. Substituting both at once makes the font-load evidence useless: if
     * either heading pulls Noto Sans Thai the face reads "loaded" and there is no way to say
     * which one did it. The driver reloads between targets so each answer is attributable. */
    const target = which === 'h1' ? h1 : card;
    /* The real family name of the Thai FontFace as the document knows it. Read from
     * document.fonts rather than typed as a literal: next/font controls the emitted family name,
     * and a literal that no longer matches it fails silently as a fallback measurement that looks
     * like a real one. */
    const thaiFace = [...document.fonts]
      .map((f) => f.family)
      .find((fam) => /thai/i.test(fam) && !/fallback/i.test(fam)) || null;
    const text = which === 'h1' ? ${JSON.stringify(THAI_LONG)} : ${JSON.stringify(THAI)};
    const fontsBefore = mpFontStatuses();
    const forced = forceThai && thaiFace ? '"' + thaiFace + '", ' + getComputedStyle(target).fontFamily : null;
    /* TAG THE ELEMENT'S LANGUAGE BEFORE ANYTHING IS READ OFF IT.
     *
     * globals.css gives Thai its own display leading through \`:lang(th)\`, and a rule that
     * matches on language is invisible to a probe that substitutes Thai TEXT into an element the
     * document still calls English -- which is what the earlier variants do, deliberately, because
     * that is the untagged case. Setting \`lang\` here is not cosmetic: it is the whole difference
     * between measuring the rule and measuring its absence, and it has to happen before
     * getComputedStyle, or the value read back is the one from before the rule applied. */
    if (tagLang) target.lang = tagLang;
    const result = probe(target, which, text, forced);
    return { which, thaiFace, lang: target.lang || null, forcedFamily: forced, probe: result, fontsBefore, fontsAfter: mpFontStatuses() };
  })(${lineHeightOverride === undefined ? "null" : lineHeightOverride}, ${JSON.stringify(which)}, ${forceThai ? "true" : "false"}, ${JSON.stringify(tagLang || null)})`,
  );
}

/**
 * Decode a PNG in a browser page and find the topmost and bottommost row that contains ink.
 *
 * This is the only way to answer "did the glyph get cut" without a native image library. The
 * screenshot is cropped to the heading's box PLUS a margin; if ink appears in the margin, the
 * glyph reached outside its own box, and if ink stops exactly at the box edge with the element's
 * ancestor clipping, it was severed there.
 */
async function inkRows(decoder, pngBuffer, marginTop, marginBottom) {
  const b64 = pngBuffer.toString("base64");
  return decoder.evaluate(
    async ({ b64, marginTop, marginBottom }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      /* Background is sampled from the very first row, which is inside the margin. */
      const bg = [data[0], data[1], data[2]];
      const rowHasInk = [];
      for (let y = 0; y < c.height; y += 1) {
        let ink = 0;
        for (let x = 0; x < c.width; x += 1) {
          const i = (y * c.width + x) * 4;
          const d =
            Math.abs(data[i] - bg[0]) +
            Math.abs(data[i + 1] - bg[1]) +
            Math.abs(data[i + 2] - bg[2]);
          if (d > 40) ink += 1;
        }
        rowHasInk.push(ink);
      }
      const rows = rowHasInk.map((n, y) => ({ y, n })).filter((r) => r.n > 0);
      const first = rows.length ? rows[0].y : null;
      const last = rows.length ? rows[rows.length - 1].y : null;
      const boxTop = marginTop;
      const boxBottom = c.height - marginBottom - 1;

      /* CONTIGUOUS INK BANDS, which is how line collision is settled without arithmetic. Each
       * wrapped line paints one band; the blank rows between two bands are the visual air between
       * them. Two bands that merge into one are two lines whose marks are touching -- and a gap
       * of zero on a multi-line heading is the collision H5 predicts, observed rather than
       * inferred from line-height. */
      const bands = [];
      let open = null;
      for (let y = 0; y < c.height; y += 1) {
        if (rowHasInk[y] > 0) {
          if (open === null) open = y;
        } else if (open !== null) {
          bands.push({ top: open, bottom: y - 1, height: y - open });
          open = null;
        }
      }
      if (open !== null) bands.push({ top: open, bottom: c.height - 1, height: c.height - open });
      const gaps = [];
      for (let i = 0; i + 1 < bands.length; i += 1)
        gaps.push(bands[i + 1].top - bands[i].bottom - 1);

      return {
        imageHeight: c.height,
        imageWidth: c.width,
        marginTop,
        marginBottom,
        boxTopInImage: boxTop,
        boxBottomInImage: boxBottom,
        /* Coordinates relative to the element's own border box: 0 is its top edge. */
        inkTopRelativeToBox: first === null ? null : first - boxTop,
        inkBottomRelativeToBox: last === null ? null : last - boxBottom,
        inkAboveBoxPx: first === null ? null : Math.max(0, boxTop - first),
        inkBelowBoxPx: last === null ? null : Math.max(0, last - boxBottom),
        inkRowsTotal: rows.length,
        bands,
        gapsBetweenBands: gaps,
        smallestGapPx: gaps.length ? Math.min(...gaps) : null,
      };
    },
    { b64, marginTop, marginBottom },
  );
}

/* ------------------------------------------------------------------------------------------
 * Driver
 * ---------------------------------------------------------------------------------------- */

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "shots"), { recursive: true });

  let base = value("base", "");
  let server = null;

  if (!base) {
    if (!flag("no-build")) {
      await run("pnpm", ["--filter", "web", "build"], { cwd: resolve(WEB_DIR, "../..") });
    }
    const port = Number(value("port", "3123"));
    base = `http://127.0.0.1:${port}`;

    /* REFUSE A PORT SOMEONE ELSE IS ON, rather than measuring whatever answers.
     *
     * waitForServer only asks "did something reply". A leftover `next start` from an earlier run
     * replies instantly -- while serving a .next directory that has since been rebuilt or deleted,
     * which is how this harness produced a full page of numbers about an unstyled document. The
     * spawned child does exit with EADDRINUSE, but the old server answers the first poll before
     * that exit is observed, so the race is always lost. Checking first removes the race. */
    const inUse = await fetch(base, { redirect: "manual" }).then(
      () => true,
      () => false,
    );
    if (inUse) {
      throw new Error(
        `something is already listening on ${base}. This harness will not measure a server it did not ` +
          "start -- it is probably a leftover `next start` serving an older build. Stop it (fuser -k " +
          `${port}/tcp) or pass --port= with a free port.`,
      );
    }
    /* THE CHILD'S OUTPUT GOES TO A FILE, NOT TO A PIPE NOBODY READS. An unread pipe is how the
     * first run of this script hung with no output at all: `next start` failed, the reason sat
     * unread in a pipe, and waitForServer polled a port that was never going to answer. */
    const serverLog = openSync(join(OUT, "next-start.log"), "a");
    server = spawn(NEXT_BIN, ["start", "-p", String(port)], {
      cwd: WEB_DIR,
      stdio: ["ignore", serverLog, serverLog],
      /* No NEXT_PUBLIC_SUPABASE_* and no SITE_PASSWORD: the gate middleware stays off and the
       * session middleware short-circuits, so every route renders and can be measured. */
      env: { ...process.env, SITE_PASSWORD: "" },
    });
    let serverExit = null;
    server.on("exit", (code) => {
      serverExit = code;
    });
    await waitForServer(base, 120, () => serverExit);
  }

  const browser = await chromium.launch();
  const decoder = await (await browser.newContext()).newPage();
  await decoder.setContent("<html><body></body></html>");

  /**
   * REFUSE TO MEASURE AN UNSTYLED PAGE.
   *
   * This is not hypothetical. Two `next start` processes sharing one .next directory make one of
   * them serve a 500 for the CSS chunk, and the page still renders -- as unstyled HTML. Every
   * number the harness then produces is real, reproducible, and about a document nobody will ever
   * see: the hero image reported 1186px wide because `w-full` was not applied, and the nav
   * reported display:block because `hidden` was not either. A run like that is indistinguishable
   * from a genuinely broken layout unless something checks, so something checks.
   *
   * The probe is a property only the stylesheet can produce: `header nav` is `hidden md:flex`, so
   * below md its computed display must be `none`. If it is anything else, the CSS did not arrive.
   */
  async function assertStyled(page, where) {
    const styled = await page.evaluate(() => {
      const sheets = [...document.styleSheets].reduce((n, s) => {
        try {
          return n + s.cssRules.length;
        } catch {
          return n;
        }
      }, 0);
      const nav = document.querySelector("header nav");
      return {
        ruleCount: sheets,
        navDisplay: nav ? getComputedStyle(nav).display : null,
        bodyFont: getComputedStyle(document.body).fontFamily,
      };
    });
    if (styled.ruleCount === 0 || (styled.navDisplay !== null && styled.navDisplay !== "none")) {
      throw new Error(
        `stylesheet did not apply at ${where} (${styled.ruleCount} rules, header nav display=${styled.navDisplay}, ` +
          `body font=${styled.bodyFont}). Measuring this would produce confident numbers about an unstyled ` +
          "document. Most likely another `next start` is serving the same .next directory -- stop it and rerun.",
      );
    }
  }

  const report = {
    measuredAt: new Date().toISOString(),
    base,
    chromium: browser.version(),
    widths: WIDTHS,
    routes: {},
    thai: [],
    notes: [],
  };

  for (const width of WIDTHS) {
    /* isMobile IS DELIBERATELY OFF, and this is not a shortcut.
     *
     * With Playwright's isMobile:true, Chromium's mobile emulation widens the LAYOUT viewport to
     * whatever the content needs -- window.innerWidth came back as 763 on a 390px /pricing -- and
     * then fits that to the screen. The page therefore reports no scrollX, and a harness that
     * trusted window.scrollX would file "no horizontal overflow" on a page that visibly has 373px
     * of it. That is the exact shape of wrong number this repository cares about.
     *
     * layout.tsx declares width=device-width with initial-scale=1, which pins the layout viewport
     * to the device width; leaving isMobile off reproduces that, and the pan measured above is
     * then the pan a person gets. hasTouch stays on so touch-only styling still applies. */
    const context = await browser.newContext({
      viewport: { width, height: 780 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: width < 768,
      userAgent:
        width < 768
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : undefined,
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const url = base + route;
      let status = null;
      try {
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        status = res ? res.status() : null;
      } catch (err) {
        report.notes.push(`${route} @${width}: navigation failed -- ${err.message}`);
        continue;
      }
      await page.evaluate(() => document.fonts.ready);
      /* Below md, so the nav probe in assertStyled is meaningful. */
      if (width < 768) await assertStyled(page, `${route} @${width}`);
      const landed = new URL(page.url()).pathname;
      const measured = await measureRoute(page);
      report.routes[`${route}@${width}`] = { route, width, status, landed, ...measured };
      if (route === "/" || route === "/pricing") {
        await page.screenshot({
          path: join(OUT, "shots", `route${route.replace(/\//g, "_")}-${width}.png`),
          fullPage: false,
        });
      }
    }
    await context.close();
  }

  /* --- the Thai pass -------------------------------------------------------------------- */
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    /* Three leadings, because the tokens and the markup disagree and both have to be measured:
     *   null  -- as the page is actually authored (h1 is leading-[1.06])
     *   1     -- --mp-leading-hero, the value the token file says the hero is set in
     *   1.15  -- --mp-leading-h3, the card-title value */
    /* FOUR VARIANTS, because "does Thai clip" is two independent questions and running them
     * together answers neither:
     *
     *   as-shipped      the leading the markup actually sets, and the face the stack actually
     *                   resolves -- which for a display heading is NOT the loaded Thai face
     *   face-fixed      same leading, Thai face forced: isolates the LEADING question from the
     *                   font-fallback question
     *   lh 1            --mp-leading-hero, the value the token file says the hero is set in
     *   lh 1.15         --mp-leading-h3, the card-title value
     */
    const VARIANTS = [
      { lh: null, forceThai: false, name: "as-shipped" },
      { lh: null, forceThai: true, name: "face-fixed" },
      { lh: 1, forceThai: true, name: "lh1-face-fixed" },
      { lh: 1.15, forceThai: true, name: "lh1.15-face-fixed" },
      /* THE REFERENCE, and the reason the band counts below can be read at all. Thai paints a
       * tone mark as ink that is often separated from its base glyph by a blank row, so a line
       * can contribute two or three bands on its own. Counting bands at a leading where lines
       * CANNOT touch gives the per-line band count; a lower count at the authored leading is then
       * lines merging, rather than a property of the face. Without this row, "1 band" and "6
       * bands" are two numbers with no scale. */
      { lh: 2, forceThai: true, name: "lh2-reference-face-fixed" },
      { lh: 2, forceThai: false, name: "lh2-reference-as-shipped" },
      /* THE TWO ROWS THAT MEASURE THE FIX RATHER THAN THE DEFECT. Everything above substitutes
       * Thai text into an element the document still declares English, which is the honest reading
       * of an untranslated page. These two tag the element `lang="th"` first, which is what a Thai
       * page does and what globals.css's `:lang(th)` rule keys on. The leading is left as authored
       * on purpose: the point is to see what the STYLESHEET does, not what an override does, so if
       * the rule is ever deleted these two rows collapse back onto `as-shipped` and the collision
       * reappears in the report. Nothing forces a number here. */
      { lh: null, forceThai: false, lang: "th", name: "lang-th-as-shipped" },
      { lh: null, forceThai: true, lang: "th", name: "lang-th-face-fixed" },
    ];
    for (const variant of VARIANTS) {
      const lh = variant.lh;
      for (const which of ["h1", "cardTitle"]) {
        await page.reload({ waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const pass = await measureThai(
          page,
          lh === null ? undefined : lh,
          which,
          variant.forceThai,
          variant.lang,
        );
        /* The Thai face is preload:false; if this heading pulled it, it is fetched only now. */
        await page.evaluate(() => document.fonts.ready);
        const probe = pass.probe;
        if (!probe) continue;
        probe.fontsAfterLoad = await page.evaluate(() =>
          [...document.fonts].map((f) => ({
            family: f.family,
            weight: f.weight,
            status: f.status,
          })),
        );

        /* ISOLATE BEFORE SCREENSHOTTING. The first version of this cropped the heading's box plus
         * a 30px margin and counted ink in the margin as the heading's glyphs escaping. It is not:
         * at 360 the eyebrow above the h1 sits inside that margin, and the harness reported 28px
         * of "ink above the box" that belonged to a different element entirely. That is exactly
         * the kind of confident wrong number this exercise exists to avoid, so everything but the
         * target and its ancestor chain is made `visibility: hidden` first. Nothing is removed and
         * nothing is re-laid-out -- visibility does not affect layout, so the box measured above
         * is still the box in the picture.
         *
         * No colour is set anywhere here. The page keeps its own background, and the ink threshold
         * samples that background from the first row of the crop. */
        const boxNow = await page.evaluate(() => {
          const el = window.__mpTarget;
          const keep = new Set();
          for (let n = el; n; n = n.parentElement) keep.add(n);
          for (const other of document.body.querySelectorAll("*")) {
            if (keep.has(other) || el.contains(other)) continue;
            other.style.visibility = "hidden";
          }
          const r = el.getBoundingClientRect();
          return {
            x: Math.round(r.x),
            y: Math.round(r.y + window.scrollY),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        });

        const margin = 40;
        const clip = {
          x: Math.max(0, boxNow.x - 4),
          y: Math.max(0, boxNow.y - margin),
          width: Math.min(width - Math.max(0, boxNow.x - 4), boxNow.w + 8),
          height: boxNow.h + margin * 2,
        };
        const name = `thai-${which}-${width}-${variant.name}.png`;
        const buf = await page.screenshot({ clip, fullPage: true });
        writeFileSync(join(OUT, "shots", name), buf);
        probe.screenshot = `shots/${name}`;
        probe.isolatedBox = boxNow;
        probe.pixels = await inkRows(decoder, buf, margin, margin);

        report.thai.push({
          width,
          variant: variant.name,
          leading: lh === null ? "as-authored" : lh,
          faceForcedTo: pass.forcedFamily,
          lang: pass.lang,
          which,
          probe,
          thaiFaceBefore: pass.fontsBefore.filter((f) => /Thai/i.test(f.family)),
          thaiFaceAfter: probe.fontsAfterLoad.filter((f) => /Thai/i.test(f.family)),
        });
      }
    }

    /* A Latin control at the same width and leading, so "the ink overflows the line box" can be
     * read against how much Latin overflows it too. Latin at leading 1 also overflows -- the
     * question is by how much more Thai does. */
    await page.reload({ waitUntil: "networkidle" });
    const latin = await page.evaluate(`(() => {
      ${PAGE_HELPERS}
      const el = document.querySelector('h1');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const m = ctx.measureText(el.textContent.trim());
      const fontSize = parseFloat(cs.fontSize);
      const lh = parseFloat(cs.lineHeight);
      return {
        text: el.textContent.trim().slice(0, 60),
        fontSizePx: fontSize,
        lineHeightPx: lh,
        inkHeight: Math.round((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 100) / 100,
        inkOverflowsLineBoxPx: Math.round((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent - lh) * 100) / 100,
      };
    })()`);
    report.thai.push({ width, leading: "latin-control", latinControl: latin });

    await context.close();
  }

  await browser.close();
  if (server) server.kill("SIGTERM");

  writeFileSync(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(OUT, "summary.txt"), summarise(report));
  process.stdout.write(summarise(report));
  process.stdout.write(`\nwrote ${join(OUT, "report.json")}\n`);
}

function summarise(report) {
  const L = [];
  L.push(`mobile-audit  ${report.measuredAt}  chromium ${report.chromium}  base ${report.base}`);
  L.push("");
  L.push("OVERFLOW  (documentElement.scrollWidth - clientWidth)");
  for (const key of Object.keys(report.routes)) {
    const r = report.routes[key];
    if (r.overflowPx <= 0) continue;
    L.push(
      `  ${r.route} @${r.width}  +${r.overflowPx}px  (scroll ${r.scrollWidth} / client ${r.clientWidth}` +
        `; the viewport actually pans ${r.panXAchieved}px)`,
    );
    for (const c of (r.provenCulprits || []).slice(0, 4)) {
      L.push(
        `      PROVEN -${c.removesPx}px  ${c.tag}  ${c.endsOverflow ? "removing it ends the overflow" : `document still ${c.documentWidthWithoutIt}px without it`}` +
          `  position:${c.position}  "${c.text}"`,
      );
      L.push(`          ${c.selector}`);
    }
    for (const c of r.culprits.slice(0, 3)) {
      L.push(
        `      +${c.overflowPx}px  ${c.kind}-overflow  ${c.tag}  reaches ${c.rightPx}px` +
          (c.kind === "content"
            ? ` (box ends ${c.boxRightPx}px, scrollWidth ${c.elScrollWidth} vs clientWidth ${c.elClientWidth})`
            : "") +
          `  "${c.text}"`,
      );
      L.push(`          ${c.selector}`);
    }
    if (!r.culprits.length) {
      L.push(
        `      no uncontained element exceeds the viewport -- ${r.containedCulpritCount} contained ones do`,
      );
    }
    for (const o of (r.contentOverflowOrigins || []).slice(0, 3)) {
      L.push(
        `      origin: ${o.tag} content ${o.scrollWidth}px in a ${o.clientWidth}px box (+${o.excessPx}, white-space:${o.whiteSpace})  "${o.text}"`,
      );
      L.push(`          ${o.selector}`);
    }
  }
  if (!Object.values(report.routes).some((r) => r.overflowPx > 0)) L.push("  none at any width");

  L.push("");
  L.push(`TAP TARGETS under ${WCAG_TAP_MIN}px`);
  for (const key of Object.keys(report.routes)) {
    const r = report.routes[key];
    if (!r.tapTargets.length) continue;
    L.push(`  ${r.route} @${r.width}  ${r.tapTargets.length}`);
    for (const t of r.tapTargets.slice(0, 6)) {
      L.push(`      ${t.width}x${t.height}  ${t.tag}  ${t.text || t.href || ""}  ${t.selector}`);
    }
  }

  L.push("");
  L.push(`TYPE under ${MIN_FONT_PX}px`);
  for (const key of Object.keys(report.routes)) {
    const r = report.routes[key];
    if (!r.smallText.length) continue;
    const bySize = {};
    for (const s of r.smallText) bySize[s.px] = (bySize[s.px] || 0) + 1;
    L.push(`  ${r.route} @${r.width}  ${r.smallText.length}  ${JSON.stringify(bySize)}`);
  }

  L.push("");
  L.push("HEADER REACHABILITY");
  for (const key of Object.keys(report.routes)) {
    const r = report.routes[key];
    if (r.route !== "/") continue;
    L.push(`  @${r.width}  visible: ${r.headerLinks.map((l) => l.href).join(", ")}`);
    L.push(`  @${r.width}  hidden : ${r.headerHiddenNav.map((l) => l.href).join(", ") || "-"}`);
  }

  L.push("");
  L.push("THAI");
  for (const t of report.thai) {
    if (t.latinControl) {
      L.push(
        `  @${t.width} latin control  ink ${t.latinControl.inkHeight}px vs line box ${t.latinControl.lineHeightPx}px  (over ${t.latinControl.inkOverflowsLineBoxPx}px)`,
      );
      continue;
    }
    const p = t.probe;
    if (!p) continue;
    const face = t.thaiFaceAfter.map((f) => `${f.family}:${f.status}`).join(",") || "no-thai-face";
    L.push(
      `  @${t.width} ${t.which} [${t.variant}] lang=${t.lang || "(untagged)"} lh=${t.leading} ` +
        `size ${p.fontSizePx}px box ${p.lineHeightPx}px ` +
        `ink ${p.ink.inkHeight}px (over ${p.inkOverflowsLineBoxPx}px) lines ${p.lineCount}`,
    );
    L.push(
      `        face: fellThroughToGenericSans=${p.ink.fellThroughToGenericSans} ` +
        `matchesExplicitNotoThai=${p.ink.matchesExplicitNotoThai} fontset=[${face}]`,
    );
    L.push(
      `        pixels: above box ${p.pixels ? p.pixels.inkAboveBoxPx : "?"}px, below box ${p.pixels ? p.pixels.inkBelowBoxPx : "?"}px, ` +
        `bands ${p.pixels ? p.pixels.bands.length : "?"}, smallest gap ${p.pixels ? p.pixels.smallestGapPx : "?"}px, ` +
        `clipAncestor=${p.clippingAncestor ? p.clippingAncestor.selector : "none"}`,
    );
  }
  L.push("");
  for (const n of report.notes) L.push(`note: ${n}`);
  return `${L.join("\n")}\n`;
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
