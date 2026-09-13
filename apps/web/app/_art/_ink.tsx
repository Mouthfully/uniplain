/**
 * THE DRAWING PRIMITIVES THE FIGURES SHARE.
 *
 * WHY THERE IS A MODULE HERE AT ALL, RATHER THAN SVG TYPED INTO EACH SECTION. Two of these rules
 * are the kind nobody notices being broken:
 *
 *   * AN ARROWHEAD DRAWN BY HAND POINTS THE WRONG WAY EVENTUALLY. Every figure in this directory
 *     is a flow, every flow has arrows, and a triangle written out as three coordinates is three
 *     chances to draw a line that says the data moves the other way. `Arrow` takes a start, an end
 *     and nothing else, and computes the head from the direction of travel.
 *
 *   * NO `<marker>`, DELIBERATELY. The obvious way to put a head on a line is a `<marker>` in
 *     `<defs>` referenced by id -- and an id in an inlined SVG is document-global. Two figures on
 *     one page, or one figure rendered twice, and both arrows resolve to whichever definition the
 *     document parsed last. Nothing breaks loudly; the heads just stop matching their lines. A
 *     drawn triangle has no id to collide.
 *
 * NO COLOUR IS WRITTEN IN THIS DIRECTORY. Every stroke and fill is `currentColor` or a token
 * utility class, so the figures follow the palette and invert with the theme like everything else.
 * `scripts/check-tokens.mjs` enforces the first half; the second is what makes a figure drawn for
 * the light scheme legible on the dark one without a second drawing.
 */

/** How far back from the tip the head reaches, and how wide it opens. Pixels in the viewBox. */
const HEAD_LENGTH = 9;
const HEAD_HALF_WIDTH = 5;

/**
 * A straight connector with a head at the far end.
 *
 * The head is computed from the angle between the two points rather than passed in, which is the
 * whole reason this exists: a figure can be re-laid out by moving coordinates, and every arrow
 * still points along its own line.
 */
export function Arrow({
  from,
  to,
  className = "text-line",
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly className?: string;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // The shaft stops where the head begins. Drawing it all the way to the tip leaves a stub poking
  // through the triangle at any stroke width above a hairline.
  const shaftX = x2 - Math.cos(angle) * HEAD_LENGTH;
  const shaftY = y2 - Math.sin(angle) * HEAD_LENGTH;

  const wingX = Math.cos(angle + Math.PI / 2) * HEAD_HALF_WIDTH;
  const wingY = Math.sin(angle + Math.PI / 2) * HEAD_HALF_WIDTH;

  return (
    <g className={className}>
      <line
        x1={x1}
        y1={y1}
        x2={shaftX}
        y2={shaftY}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={`M${x2} ${y2}L${shaftX + wingX} ${shaftY + wingY}L${shaftX - wingX} ${shaftY - wingY}Z`}
        fill="currentColor"
      />
    </g>
  );
}

/**
 * A curved connector with a head at the far end, for a branch that leaves a lane.
 *
 * The control points are horizontal from each end, so a branch leaves its source travelling the way
 * the lane was travelling and arrives at its target the same way. A straight diagonal between two
 * lanes reads as a different KIND of link; keeping the tangents horizontal says it is the same flow
 * changing height.
 */
export function CurvedArrow({
  from,
  to,
  className = "text-line",
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly className?: string;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const bend = Math.abs(x2 - x1) * 0.6;

  // The head is horizontal because the curve arrives horizontally, which is the one thing the
  // control points above guarantee.
  const tipBack = x2 - HEAD_LENGTH;

  return (
    <g className={className}>
      <path
        d={`M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${tipBack} ${y2}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={`M${x2} ${y2}L${tipBack} ${y2 - HEAD_HALF_WIDTH}L${tipBack} ${y2 + HEAD_HALF_WIDTH}Z`}
        fill="currentColor"
      />
    </g>
  );
}

/**
 * A station on a flow: a rounded panel with one or two lines of label inside it.
 *
 * `dashed` is not decoration. It marks the one station in `InsightPipeline` where the contents are
 * language rather than arithmetic, and the figure's whole argument is that those two are different
 * materials. A reader who takes nothing else from the drawing should still see that one box is not
 * made of the same stuff as its neighbours.
 */
export function Station({
  x,
  y,
  width,
  height,
  lines,
  tone = "text-ink",
  dashed = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly string[];
  readonly tone?: string;
  readonly dashed?: boolean;
}) {
  const centreX = x + width / 2;
  // Two lines straddle the middle; one sits on it. Computed rather than nudged per figure, so a
  // station that gains a second line does not need its y hand-corrected.
  const firstBaseline = y + height / 2 + (lines.length > 1 ? -2 : 5);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="10"
        className={`fill-surface ${dashed ? "stroke-accent" : "stroke-line"}`}
        strokeWidth="1.4"
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text
        x={centreX}
        y={firstBaseline}
        textAnchor="middle"
        className={`fill-current ${tone}`}
        fontSize="13"
        fontWeight="600"
      >
        {lines.map((line, index) => (
          <tspan key={line} x={centreX} dy={index === 0 ? 0 : 16}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
