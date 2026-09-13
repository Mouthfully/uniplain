import { Figure } from "./Figure";
import { Arrow, Station } from "./_ink";

/**
 * THE ACCESS MODEL, DRAWN -- for the one page where trust is the product and nothing was drawn.
 *
 * WHY A DIAGRAM EARNS ITS SPACE HERE AND NOT ON, SAY, THE PRICING PAGE. A price is a number and a
 * number is already in its best form; an ACCESS MODEL is a shape, and the shape is the entire claim.
 * "Two identities, never one" is four words that mean nothing until a reader can see that the two
 * lanes never touch -- and a reader who has been sold a security page before is right to want to
 * see it rather than be told it.
 *
 * EVERY BOX IS SOMETHING THE SCHEMA ENFORCES, not something this page asserts:
 *
 *   * `app_scheduler` holds NO TABLE GRANT AT ALL. It is not a role with narrow grants; it is a
 *     role with none, which is why the cross-tenant lane can only reach the one view.
 *   * `public.due_connections` returns scheduling metadata and nothing else. `supabase/tests/13`
 *     asserts its column set exactly, so widening it fails the suite rather than passing review.
 *   * The per-tenant lane runs as `authenticated` under row-level security, FORCED rather than
 *     merely enabled -- `supabase/tests/15_force_rls.sql` reads the catalogue and asserts both
 *     settings for every table in `public`.
 *   * There is no service-role key in the Worker. The struck box at the bottom is the only part of
 *     the drawing that shows an ABSENCE, and it is here because the absence is the point: a reader
 *     comparing products needs to see the thing that is missing, and a diagram that only draws what
 *     exists cannot show it.
 *
 * NO CLAIM ABOUT AN AUDIT, A CERTIFICATE OR A TEST APPEARS ANYWHERE IN IT. Every label names a role,
 * a view or a setting -- things this repository can be read to confirm -- which is the same line the
 * rest of this page holds and the reason `FORBIDDEN_CLAIMS` has nothing to catch here.
 */

const LANES = {
  crossTenant: "Cross-tenant work",
  perTenant: "Your workspace",
} as const;

const BOXES = {
  scheduler: ["app_scheduler"],
  schedulerNote: "Holds no table grant at all",
  due: ["public.due_connections", "Scheduling metadata, nothing else"],
  authenticated: ["authenticated"],
  authenticatedNote: "One workspace, row-level security forced",
  rows: ["Your own rows", "and nothing from another tenant"],
} as const;

const ABSENT = {
  label: "A service-role key",
  note: "Not in the Worker",
} as const;

/**
 * Below this rendered width the drawing stops scaling and its frame scrolls instead. Derived
 * rather than chosen: the smallest type in the figure is 13 viewBox units, and this is the width at
 * which that sets at 11 CSS pixels -- the point below which the labels stop being readable.
 */
const FIGURE_MIN_WIDTH = 760;

const FIGURE_LABEL =
  "The two database identities: cross-tenant work runs as a role holding no table grant at all and can reach only the scheduling view, per-tenant reads run as an authenticated role under forced row-level security for one workspace, and there is no service-role key in the Worker";

/* Lane geometry. Both columns read off these so the two sides stay symmetrical by construction
   rather than by two sets of numbers that agree today. */
const LEFT_X = 24;
const RIGHT_X = 464;
const LANE_WIDTH = 392;
const LEFT_CENTRE = LEFT_X + LANE_WIDTH / 2;
const RIGHT_CENTRE = RIGHT_X + LANE_WIDTH / 2;
const TOP_Y = 42;
const BOTTOM_Y = 162;

function Lane({
  x,
  centre,
  title,
  head,
  note,
  tail,
  tone,
}: {
  readonly x: number;
  readonly centre: number;
  readonly title: string;
  readonly head: readonly string[];
  readonly note: string;
  readonly tail: readonly string[];
  readonly tone: string;
}) {
  return (
    <g>
      <text
        x={centre}
        y={22}
        textAnchor="middle"
        className="fill-current text-ink-faint"
        fontSize="11"
        fontWeight="700"
        letterSpacing="1.4"
      >
        {title}
      </text>

      <Station x={x} y={TOP_Y} width={LANE_WIDTH} height={50} lines={head} tone={tone} />
      <text
        x={centre}
        y={TOP_Y + 72}
        textAnchor="middle"
        className="fill-current text-ink-subtle"
        fontSize="12"
      >
        {note}
      </text>

      <Arrow from={[centre, TOP_Y + 84]} to={[centre, BOTTOM_Y]} className={tone} />
      <Station x={x} y={BOTTOM_Y} width={LANE_WIDTH} height={60} lines={tail} />
    </g>
  );
}

export function TwoIdentities() {
  return (
    <Figure minWidth={FIGURE_MIN_WIDTH} label={FIGURE_LABEL}>
      <svg viewBox="0 0 880 302" role="img" aria-label={FIGURE_LABEL} className="h-auto w-full">
        <Lane
          x={LEFT_X}
          centre={LEFT_CENTRE}
          title={LANES.crossTenant}
          head={BOXES.scheduler}
          note={BOXES.schedulerNote}
          tail={BOXES.due}
          tone="text-accent"
        />
        <Lane
          x={RIGHT_X}
          centre={RIGHT_CENTRE}
          title={LANES.perTenant}
          head={BOXES.authenticated}
          note={BOXES.authenticatedNote}
          tail={BOXES.rows}
          tone="text-brand-blue"
        />

        {/* THE DIVIDER IS THE CLAIM. Two columns side by side read as two halves of one thing; a rule
            between them with nothing crossing it is what says these are separate lanes. Nothing in
            this drawing spans it, and that is the property the schema enforces. */}
        <line
          x1={440}
          y1={12}
          x2={440}
          y2={236}
          className="text-line"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 5"
        />

        {/* THE ABSENCE, MARKED WITH A GLYPH RATHER THAN A STRIKE THROUGH THE WORDS. The first draft
            drew a rule across the label, which meant guessing how wide the text would set -- and a
            strike computed from an estimate lands across the wrong words the moment a font falls
            back, or strikes the explanation as well as the thing being denied. A circle and a slash
            are geometry: they are in the right place at every width, in every font, in both themes. */}
        <g>
          <rect
            x={LEFT_X}
            y={252}
            width={832}
            height={40}
            rx="10"
            className="fill-surface-subtle stroke-line"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
          <g className="text-ink-subtle">
            <circle
              cx={LEFT_X + 28}
              cy={272}
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <line
              x1={LEFT_X + 22.3}
              y1={277.7}
              x2={LEFT_X + 33.7}
              y2={266.3}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          <text
            x={LEFT_X + 46}
            y={277}
            className="fill-current text-ink-subtle"
            fontSize="13"
            fontWeight="600"
          >
            {ABSENT.label}
          </text>
          <text
            x={LEFT_X + 808}
            y={277}
            textAnchor="end"
            className="fill-current text-ink-faint"
            fontSize="13"
          >
            {ABSENT.note}
          </text>
        </g>
      </svg>
    </Figure>
  );
}
