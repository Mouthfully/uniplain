import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE MOTION SYSTEM'S ONE RULE: NO ARRANGEMENT OF FAILURES LEAVES CONTENT INVISIBLE.
 *
 * The usual scroll reveal sets `opacity: 0` in a stylesheet and repaints the element when a script
 * says so. That makes the page's DEFAULT state blank and its readable state conditional on a
 * script running -- so a JavaScript error earlier in the bundle, a blocked third party, a crawler
 * that does not execute scripts, or a reader whose extension disabled the observer all get an
 * empty page. This site publishes `llms.txt` specifically because things that do not run scripts
 * come here to read it.
 *
 * So the reveal is opt-IN through `@supports (animation-timeline: view())`: hiding the element
 * requires a feature which, if present, also un-hides it. These tests hold that arrangement in
 * place, because it is invisible in review -- a reveal built the wrong way looks identical on a
 * developer's machine, where the script always runs.
 *
 * SCANNED AS TEXT, NOT EXERCISED. jsdom implements neither `@supports` nor scroll timelines, so a
 * rendering test here would assert nothing about the thing that matters. What is under test is the
 * literal stylesheet a human edits.
 */

const GLOBALS = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const TOKENS = readFileSync(
  new URL("../../../packages/tokens/src/tokens.css", import.meta.url),
  "utf8",
);

/** The body of the first `@supports (animation-timeline: view())` block, brace-matched. */
function supportsBlock(css: string): string | null {
  const start = css.indexOf("@supports (animation-timeline: view())");
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  if (open === -1) return null;
  let depth = 1;
  let i = open + 1;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
  }
  return css.slice(open + 1, i - 1);
}

/** The body of a named `@keyframes`, brace-matched. */
function keyframes(css: string, name: string): string | null {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
  }
  return css.slice(open + 1, i - 1);
}

/**
 * Every `@media (prefers-reduced-motion: no-preference)` body, brace-matched.
 *
 * WRITTEN AFTER A MUTATION WALKED THROUGH THE FIRST VERSION. That version asked whether the
 * nearest `prefers-reduced-motion` string ABOVE a selector existed -- `lastIndexOf` from the
 * selector's index -- which is proximity, not containment. Moving the hero's animations out of
 * their gate entirely left the test green, because the reveal block's query was still further up
 * the file and still matched. A rule is inside a query or it is not; nothing about how far away
 * the words are is evidence either way.
 */
function reducedMotionBodies(css: string): string[] {
  const bodies: string[] = [];
  const marker = "@media (prefers-reduced-motion: no-preference)";
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) break;
    const open = css.indexOf("{", start);
    let depth = 1;
    let i = open + 1;
    for (; i < css.length && depth > 0; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
    }
    bodies.push(css.slice(open + 1, i - 1));
    from = i;
  }
  return bodies;
}

/** True when `needle` appears inside some reduced-motion query rather than merely near one. */
function gatedByReducedMotion(css: string, needle: string): boolean {
  return reducedMotionBodies(css).some((body) => body.includes(needle));
}

const SUPPORTS = supportsBlock(GLOBALS);

describe("the scroll reveal", () => {
  it("read both stylesheets, so the assertions below are not vacuous", () => {
    // A path that resolved to nothing would make every `not.toContain` below pass on an empty
    // string -- the failure mode every guard in this repository has hit at least once.
    expect(GLOBALS.length).toBeGreaterThan(2000);
    expect(TOKENS.length).toBeGreaterThan(2000);
    expect(SUPPORTS, "no @supports (animation-timeline: view()) block in globals.css").toBeTypeOf(
      "string",
    );
  });

  it("declares the animation only inside the support query", () => {
    // THE ASSERTION THE WHOLE FILE EXISTS FOR. `animation-timeline` outside the query would be
    // harmless; `animation: mp-reveal` outside it would hide content on every browser that cannot
    // run it, which is the exact defect this design refuses.
    const outside = GLOBALS.replace(SUPPORTS ?? "", "");
    expect(
      outside,
      "mp-reveal is applied outside @supports, so content is hidden where the timeline cannot run",
    ).not.toMatch(/animation:[^;]*mp-reveal/);

    // AND NOTHING ANYWHERE MAY SET A BARE `opacity: 0` ON A REVEAL CLASS. The support query is one
    // way to build the defect; a stylesheet that starts the element transparent and relies on the
    // animation to bring it back is the other, and it fails identically wherever the timeline does
    // not run. Checked over the whole file, inside the query and out.
    expect(
      GLOBALS,
      "a reveal class is given opacity: 0 in a stylesheet, which hides it wherever the animation does not run",
    ).not.toMatch(/\.reveal[^{]*\{[^}]*opacity:\s*0/);
  });

  it("declares it only for a reader who has not asked for stillness", () => {
    // `no-preference` and not an override. An override can be beaten by specificity; a
    // declaration that was never written cannot.
    expect(SUPPORTS).toContain("prefers-reduced-motion: no-preference");
    const beforeQuery = (SUPPORTS ?? "").slice(
      0,
      (SUPPORTS ?? "").indexOf("prefers-reduced-motion"),
    );
    expect(
      beforeQuery,
      "an animation is declared inside @supports but outside the reduced-motion query",
    ).not.toContain("animation:");
  });

  it("finishes before the element reaches the middle of the screen", () => {
    // A reveal still running where the eye has arrived is one the reader waits out. Every range
    // this file declares must end inside `cover`, well short of the centre.
    const ranges = [
      ...(SUPPORTS ?? "").matchAll(/animation-range:\s*entry\s[\d.]+%\s+cover\s+([\d.]+)%/g),
    ];
    expect(ranges.length, "no animation-range declarations were parsed").toBeGreaterThan(3);
    for (const [, end] of ranges) {
      expect(Number(end), `a reveal runs to cover ${end}%, past the reading position`).toBeLessThan(
        50,
      );
    }
  });
});

describe("the reveal keyframe", () => {
  const body = keyframes(TOKENS, "mp-reveal");

  it("exists and was parsed", () => {
    expect(body, "no @keyframes mp-reveal in tokens.css").toBeTypeOf("string");
    expect((body ?? "").length).toBeGreaterThan(20);
  });

  it("animates nothing that participates in layout", () => {
    // THE NO-SHIFT RULE. `opacity` and `transform` are composited; anything below moves the page
    // under a reader's thumb mid-scroll, which on a phone is the worst thing this page could do.
    // THE LONGHANDS COUNT, AND THAT IS WHAT THIS LIST GOT WRONG FIRST. The original matched
    // `margin` exactly, so a mutation putting `margin-top: 18px` in the keyframe sailed through --
    // the guard was checking for the one spelling nobody would actually write. Each entry below is
    // a STEM: `margin` catches margin-top, padding catches padding-inline-start, border catches
    // border-width. A property that shifts the page has no spelling that makes it safe.
    const LAYOUT_STEMS = [
      "height",
      "width",
      "margin",
      "padding",
      "border",
      "top",
      "bottom",
      "left",
      "right",
      "inset",
      "font",
      "line-height",
      "letter-spacing",
      "display",
      "position",
      "flex",
      "grid",
      "gap",
      "zoom",
    ];
    for (const stem of LAYOUT_STEMS) {
      expect(body, `mp-reveal animates ${stem}, which shifts the page as it scrolls`).not.toMatch(
        new RegExp(`(^|[;{\\s])${stem}(-[a-z-]+)?\\s*:`),
      );
    }
  });

  it("animates exactly opacity and transform, and nothing else at all", () => {
    // The other direction, and the stronger one: an allow-list rather than a ban list. A ban list
    // can only refuse what somebody thought to name -- which is precisely how `margin-top` walked
    // through the first version of the test above.
    const declared = [...(body ?? "").matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(declared.length, "no declarations were parsed out of the keyframe").toBeGreaterThan(2);
    for (const property of new Set(declared)) {
      expect(
        ["opacity", "transform"],
        `mp-reveal declares ${property}; only opacity and transform are composited`,
      ).toContain(property);
    }
  });

  it("ends fully opaque and in place, so a finished reveal is indistinguishable from no reveal", () => {
    expect(body).toMatch(/to\s*\{[^}]*opacity:\s*1/);
    expect(body).toMatch(/to\s*\{[^}]*transform:\s*none/);
  });
});

describe("the hover lift", () => {
  it("is declared only for a reader who has not asked for stillness", () => {
    // The lift lives outside @supports -- it needs no scroll timeline -- so its reduced-motion
    // gate is its own, and this is the assertion that holds it there.
    // Containment, not proximity -- the same correction the hero tests needed.
    expect(GLOBALS.indexOf(".lift"), "no .lift rule in globals.css").toBeGreaterThan(-1);
    expect(
      gatedByReducedMotion(GLOBALS, "translateY(var(--mp-motion-lift))"),
      "the lift is declared outside a prefers-reduced-motion: no-preference query",
    ).toBe(true);
    expect(
      gatedByReducedMotion(GLOBALS, "transition: transform var(--mp-motion-base)"),
      "the lift's transition is declared outside a reduced-motion query",
    ).toBe(true);
  });

  it("answers a keyboard as well as a pointer", () => {
    // A card a mouse can lift and a keyboard cannot has an affordance half its readers never see.
    expect(GLOBALS, "the lift has no focus state").toContain(".lift:focus-within");
  });

  it("does not animate a property that cannot be composited", () => {
    // `box-shadow` on a four-card grid repaints every card every frame, which on a mid-range
    // phone is the difference between a lift and a stutter.
    const rule = GLOBALS.slice(
      GLOBALS.indexOf(".lift {"),
      GLOBALS.indexOf("}", GLOBALS.indexOf(".lift {")),
    );
    expect(rule).not.toContain("box-shadow");
    expect(rule).toContain("transition: transform");
  });
});

describe("the hero, on load", () => {
  it("draws the trend line without ever leaving it half drawn", () => {
    // NO fill-mode, and that is the whole safety argument. `both` or `backwards` would apply the
    // keyframe's `from` state before the animation starts -- a reader on a slow first paint would
    // see an empty chart where a line belongs. With no fill the line is drawn except during the
    // 620ms it is being drawn.
    const rule = GLOBALS.slice(GLOBALS.indexOf(".draw-trend {"));
    expect(GLOBALS.indexOf(".draw-trend {"), "no .draw-trend rule").toBeGreaterThan(-1);
    const decl = rule.slice(0, rule.indexOf("}"));
    expect(decl).toContain("mp-draw");
    expect(decl, "the draw-on uses a fill mode, which can leave the chart incomplete").not.toMatch(
      /\b(both|backwards|forwards)\b/,
    );
  });

  it("measures the draw in whole paths rather than in user units", () => {
    // `pathLength="1"` is what stops a redrawn trend, a new hour on the axis or a changed viewBox
    // silently animating the wrong length. The keyframe and the markup have to agree.
    const keyframe = keyframes(TOKENS, "mp-draw") ?? "";
    expect(keyframe).toMatch(/stroke-dasharray:\s*1\b/);
    expect(keyframe).toMatch(/stroke-dashoffset:\s*1\b/);

    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page, "the trend path carries .draw-trend without pathLength").toMatch(
      /pathLength="1"[\s\S]{0,120}draw-trend|draw-trend[\s\S]{0,120}pathLength="1"/,
    );
  });

  it("breathes the hero wash on a pseudo-element, which holds no content", () => {
    // The one animation on this page that runs forever. It is allowed to, because `::before`
    // paints a gradient and contains nothing a reader came for.
    expect(GLOBALS).toContain(".hero-glow::before");
    const rule = GLOBALS.slice(GLOBALS.indexOf(".hero-glow::before {\n    animation"));
    expect(rule).toContain("mp-drift");
    expect(
      rule,
      "the wash loops by jumping back to its start, which pulses once a cycle",
    ).toContain("alternate");
  });

  it("declares both INSIDE a reduced-motion query, not merely somewhere below one", () => {
    // Containment, not proximity. See `reducedMotionBodies` on the mutation that made this
    // distinction necessary.
    expect(
      gatedByReducedMotion(GLOBALS, "mp-draw"),
      "the draw-on animation is declared outside a prefers-reduced-motion: no-preference query",
    ).toBe(true);
    expect(
      gatedByReducedMotion(GLOBALS, "mp-drift"),
      "the hero wash is animated outside a prefers-reduced-motion: no-preference query",
    ).toBe(true);
  });
});

describe("the motion values", () => {
  it("come from tokens rather than being typed into the stylesheet", () => {
    // Three durations and two curves in the whole system. A duration typed into one section and a
    // different one typed into the next is how a page stops reading as one thing.
    for (const token of [
      "--mp-motion-fast",
      "--mp-motion-base",
      "--mp-motion-slow",
      "--mp-motion-settle",
      "--mp-motion-standard",
      "--mp-motion-rise-distance",
      "--mp-motion-lift",
    ]) {
      expect(TOKENS, `${token} is not declared in tokens.css`).toContain(`${token}:`);
    }

    // And no raw duration in the motion rules. `0s` and `0ms` are not values, they are absences.
    const motionRules = GLOBALS.slice(GLOBALS.indexOf(".reveal,"));
    const literals = [...motionRules.matchAll(/transition:[^;]*?(\d+)(ms|s)\b/g)];
    expect(
      literals.map((m) => m[0]),
      "a duration is typed into globals.css instead of read from a token",
    ).toEqual([]);
  });
});
