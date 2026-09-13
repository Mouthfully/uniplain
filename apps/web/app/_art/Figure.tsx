/**
 * THE FRAME A WIDE FIGURE SITS IN, AND THE DEFECT IT EXISTS TO FIX.
 *
 * An `<svg>` with a viewBox and `width: 100%` scales to its container, which is exactly what you
 * want until the container is a phone. Measured at a 420px viewport, `InsightPipeline` -- a flow
 * four stations wide -- set its 13px labels at roughly four and a half pixels. Nothing looked
 * broken: the drawing was complete, correctly proportioned and entirely unreadable, which is the
 * worst of the three outcomes because it still costs the vertical space and still says to a reader
 * "there is something here you are not getting".
 *
 * SO THE FIGURE STOPS SHRINKING AND THE FRAME SCROLLS. Below `minWidth` the drawing holds its size
 * and the frame becomes a horizontal scroller -- the reader pans a readable diagram instead of
 * squinting at a complete one. The alternative considered and rejected was hiding wide figures
 * below a breakpoint: it keeps the page tidy by taking the picture away from the readers most
 * likely to be on a phone, which is the opposite of what this work is for.
 *
 * THE SCROLLER IS NOT A BAND WRAPPER, AND THE DIFFERENCE MATTERS. `animation-timeline: view()`
 * resolves against the nearest scrollport, so an `overflow-x` anywhere above a scroll-driven reveal
 * silently retimes it against the wrong box -- which is why `page.tsx` forbids `overflow` on the
 * section bands and a test enforces it. This element is allowed to scroll precisely because nothing
 * animated is ever inside it: the figures are static drawings, and `art.test.tsx` refuses a reveal
 * class within a frame rather than leaving that as a convention.
 *
 * `tabIndex` AND A ROLE ON A SCROLLER, BECAUSE A KEYBOARD HAS TO BE ABLE TO PAN IT. A div that
 * scrolls but cannot be focused is reachable with a mouse or a finger and by nothing else. The
 * group role with the figure's own name is what stops a screen reader announcing an unlabelled
 * focus stop in the middle of the page.
 */
export function Figure({
  minWidth,
  label,
  children,
}: {
  /** The width in CSS pixels below which the drawing stops scaling and the frame starts scrolling. */
  readonly minWidth: number;
  /** The same name the figure carries, so the focusable scroller is announced rather than bare. */
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    // TWO SUPPRESSIONS, AND BOTH ARE THE RULE BEING RIGHT ABOUT THE GENERAL CASE.
    //
    // `noNoninteractiveTabindex` exists to stop a focus stop being added to something a keyboard
    // user can do nothing with. A SCROLL CONTAINER IS THE EXCEPTION: there is something to do with
    // it -- pan a drawing that is wider than the screen -- and without the attribute that is
    // reachable by pointer and by nothing else. Newer engines make overflow containers focusable on
    // their own; this repository will not quote a support table it cannot verify, so the attribute
    // is written rather than assumed.
    //
    // `useSemanticElements` offers `<fieldset>` for `role="group"`, which is a form control
    // grouping with a legend. This is a labelled region of a document, and a focus stop with no
    // accessible name is exactly what the first suppression would otherwise create.
    //
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> is a form grouping; this names a scrollable figure
    <div
      // A suppression attaches to the node on the NEXT line, so this one sits on the attribute it
      // is about rather than above the element -- which is where the first attempt put it, where it
      // silently did nothing and the rule fired anyway.
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container that cannot be focused can only be panned by pointer
      tabIndex={0}
      role="group"
      aria-label={label}
      // `min-w-0` AND `max-w-full`, AND THE FIRST ONE IS NOT OPTIONAL. `overflow-x: auto` scrolls
      // only when the container is itself constrained, and a grid or flex item defaults to
      // `min-width: auto` -- so without this the 820px inner block pushed its own column wide, the
      // scroller never scrolled, and the HOME PAGE gained 474px of sideways scroll at 390px. The
      // figure looked right in isolation and broke the page around it; `art.test.tsx` measures the
      // document rather than the figure for exactly that reason.
      className="min-w-0 max-w-full overflow-x-auto"
    >
      <div style={{ minWidth: `${minWidth}px` }}>{children}</div>
    </div>
  );
}
