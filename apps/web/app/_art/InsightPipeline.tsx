import { Figure } from "./Figure";
import { Arrow, CurvedArrow, Station } from "./_ink";

/**
 * THE FIGURE FOR "IT WRITES THE SENTENCE. NEVER THE NUMBER."
 *
 * WHY THIS CLAIM GETS THE PAGE'S BIGGEST DRAWING. It is the only sentence on the marketing site
 * that describes a MECHANISM rather than an outcome, and a mechanism is the one thing prose is bad
 * at: the panel needs four sentences to say that the figures and the language travel separately and
 * meet again at a check, and a reader still has to hold all four in their head at once to see the
 * shape. A drawing says it in one look, and it is the shape that is the product.
 *
 * THE TOPOLOGY IS THE ARGUMENT, and it is drawn the way the code actually runs rather than the way
 * a pipeline diagram usually goes:
 *
 *   * THE FLOW FORKS AT THE COMPUTED FIGURES AND NOT BEFORE. `packages/insights/src/brief.ts`
 *     builds the user prompt from computed figures, dictionary labels and source ids; the model is
 *     handed the numbers as facts and asked for phrasing. So one branch carries the figures to the
 *     model, and the other carries the SAME figures straight to the check -- which is why the two
 *     arrows into the last station come from two different places. A single left-to-right chain
 *     would draw the model as a step the numbers pass THROUGH, which is precisely the thing this
 *     product does not do.
 *
 *   * THE MODEL'S STATION IS DASHED. Everything else on the page is arithmetic; that box is
 *     language. Same flow, different material.
 *
 *   * THE LAST STATION HAS TWO EXITS AND THE REFUSAL IS ONE OF THEM. `verify.ts` refuses a whole
 *     insight over one number it cannot trace, rather than stripping it, rounding it to something
 *     true, or regenerating with a sterner prompt. A drawing with only the happy path would be the
 *     usual marketing diagram; the refusing exit is the differentiator and it is drawn at the same
 *     weight as the other one.
 *
 * NO NUMBER APPEARS IN IT. There is nothing here to label "sample", because the figure describes
 * the path a figure takes and never shows one -- which is the only way to draw this claim without
 * committing the error it is about.
 */

/**
 * Every string the drawing renders. `scripts/check-copy.mjs` reads a `<text>` child exactly as it
 * reads a `<p>`, and the accessible name below is an attribute it also reads, so the whole figure's
 * prose lives here with the section copy rather than inside the geometry.
 */
const STATIONS = {
  rows: ["Your rows"],
  computed: ["Every figure computed", "here, in code"],
  model: ["Phrased by", "the model"],
  checked: ["Each figure in the text", "matched back to one"],
} as const;

/**
 * The two exits. The refusal is set on two lines because it has to sit inside the drawing's right
 * edge at every width -- a label that overflows the viewBox is not clipped, it is SCALED, and the
 * whole figure shrinks to make room for it.
 */
const OUTCOMES = {
  sent: ["Sent to you"],
  refused: ["The whole insight", "refused"],
} as const;

/**
 * The accessible name. It carries no terminal punctuation, which is the copy guard's rule for a
 * human-visible attribute, and it describes the SHAPE rather than naming the boxes: a reader who
 * cannot see the drawing needs the argument, and the four station labels are already read out of
 * the list beside it.
 */
/**
 * Below this rendered width the drawing stops scaling and its frame scrolls instead. Derived
 * rather than chosen: the smallest type in the figure is 13 viewBox units, and this is the width at
 * which that sets at 11 CSS pixels -- the point below which the labels stop being readable.
 */
const FIGURE_MIN_WIDTH = 820;

const FIGURE_LABEL =
  "How an insight is made: the figures are computed from your own rows before a model sees them, the model is asked only for wording, and every figure in the finished sentence is matched back to a computed one or the whole insight is refused";

/* The lanes. Both the arithmetic path and the two branch points read off these, so the figure can
   be re-proportioned by editing numbers here rather than by chasing coordinates through the JSX. */
const LANE_Y = 134;
const BRANCH_Y = 46;
const FORK_X = 420;
const CHECK_CENTRE_X = 832;
const EXIT_Y = 190;
// MEASURED, NOT CHOSEN. At 918 the refusal label -- the widest string in the drawing -- set past
// the right edge of the viewBox, and an `<svg>` clips its overflow by default, so the word
// "refused" simply was not there. It is the one label whose position has to be derived from its own
// width rather than from the box above it.
const EXIT_SENT_X = 700;
const EXIT_REFUSED_X = 876;

export function InsightPipeline() {
  return (
    <Figure minWidth={FIGURE_MIN_WIDTH} label={FIGURE_LABEL}>
      <svg
        viewBox="0 0 960 268"
        role="img"
        aria-label={FIGURE_LABEL}
        // `h-auto` with a viewBox is what makes this scale rather than crop: the drawing is one
        // shape at every width, so there is no mobile version of it to maintain.
        className="h-auto w-full"
      >
        <Station x={16} y={LANE_Y - 30} width={140} height={60} lines={STATIONS.rows} />
        <Arrow from={[156, LANE_Y]} to={[196, LANE_Y]} className="text-brand-blue" />

        <Station
          x={196}
          y={LANE_Y - 30}
          width={184}
          height={60}
          lines={STATIONS.computed}
          tone="text-brand-blue"
        />

        {/* THE FORK. The stub out of the computed station is drawn once and both branches leave its
            end, so the two paths visibly share an origin -- they are the same figures going two
            ways, not two different things happening to travel alongside each other. */}
        <line
          x1={380}
          y1={LANE_Y}
          x2={FORK_X}
          y2={LANE_Y}
          className="text-brand-blue"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx={FORK_X} cy={LANE_Y} r="3.5" className="fill-brand-blue" />

        <CurvedArrow from={[FORK_X, LANE_Y]} to={[460, BRANCH_Y]} className="text-accent" />
        <Arrow from={[FORK_X, LANE_Y]} to={[720, LANE_Y]} className="text-brand-blue" />

        <Station
          x={460}
          y={BRANCH_Y - 30}
          width={220}
          height={60}
          lines={STATIONS.model}
          tone="text-accent"
          dashed
        />
        <CurvedArrow from={[680, BRANCH_Y]} to={[720, LANE_Y - 14]} className="text-accent" />

        <Station x={720} y={LANE_Y - 34} width={224} height={68} lines={STATIONS.checked} />

        {/* THE TWO EXITS. One stem down from the check, then a bracket, then one drop into each
            outcome -- which is how a diagram says "one of these, decided here" rather than "both of
            these, in some order". The bracket ends are pulled well inside the viewBox so the two
            labels can be centred under their own arrows without either running off the edge. */}
        <line
          x1={CHECK_CENTRE_X}
          y1={LANE_Y + 34}
          x2={CHECK_CENTRE_X}
          y2={EXIT_Y}
          className="text-line"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1={EXIT_SENT_X}
          y1={EXIT_Y}
          x2={EXIT_REFUSED_X}
          y2={EXIT_Y}
          className="text-line"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <Arrow
          from={[EXIT_SENT_X, EXIT_Y]}
          to={[EXIT_SENT_X, EXIT_Y + 20]}
          className="text-brand-mint"
        />
        <Arrow
          from={[EXIT_REFUSED_X, EXIT_Y]}
          to={[EXIT_REFUSED_X, EXIT_Y + 20]}
          className="text-ink-subtle"
        />

        <text
          x={EXIT_SENT_X}
          y={EXIT_Y + 40}
          textAnchor="middle"
          className="fill-current text-brand-mint"
          fontSize="13"
          fontWeight="700"
        >
          {OUTCOMES.sent.map((line) => (
            <tspan key={line} x={EXIT_SENT_X}>
              {line}
            </tspan>
          ))}
        </text>
        <text
          x={EXIT_REFUSED_X}
          y={EXIT_Y + 40}
          textAnchor="middle"
          className="fill-current text-ink-subtle"
          fontSize="13"
          fontWeight="700"
        >
          {OUTCOMES.refused.map((line, index) => (
            <tspan key={line} x={EXIT_REFUSED_X} dy={index === 0 ? 0 : 15}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </Figure>
  );
}
