import { Figure } from "./Figure";
import { CurvedArrow, Station } from "./_ink";

/**
 * THE ENVELOPE, DRAWN -- the integration library's whole argument in one picture.
 *
 * WHAT THE PAGE SAYS AND WHY WORDS ARE THE WRONG MEDIUM FOR IT. The library lists platforms, and a
 * list of platforms is exactly what every competitor's integrations page is. The thing worth
 * knowing is what happens AFTER the list: a till, an ad account, a store and an analytics property
 * arrive as four completely different payloads and leave as ONE row shape, which is the only reason
 * a figure can be computed across them at all. Four arrows arriving at one panel says that; a
 * paragraph saying "unified data model" is what the reader has already stopped believing.
 *
 * THE FIELD NAMES ARE THE REAL ONES. `source`, `entity`, `dimensions`, `metrics`, `fetched_at` and
 * `is_provisional` are the keys of `InsightRow` and of the stored envelope row it narrows, not a
 * tidied-up version drawn for a marketing page. A diagram that renamed them would be the first
 * place a developer checked and the first place they stopped trusting.
 *
 * `is_provisional` IS IN THE DRAWING ON PURPOSE, and it is the field a competitor's diagram would
 * leave out: it is the flag that says a number may still be restated by the platform that reported
 * it. Showing the shape without it would draw a cleaner picture of a less honest product.
 *
 * THE SOURCES ARE NAMED BY KIND, NOT BY BRAND. The page beside this figure is a list of the actual
 * platforms; repeating four of their names here would make the drawing look like a claim about
 * which four are special. "A till" is what the row means.
 */

const SOURCES = ["A till", "An ad account", "A store", "An analytics property"] as const;

const PANEL_TITLE = "One row shape";

/** The envelope's own keys, with what each holds. The keys are copied from the type, not paraphrased. */
const FIELDS = [
  { key: "source", what: "Which account it came from" },
  { key: "entity", what: "What it is about" },
  { key: "dimensions", what: "The day, the currency, the timezone" },
  { key: "metrics", what: "The numbers the platform reported" },
  { key: "fetched_at", what: "When it was read" },
  { key: "is_provisional", what: "Whether it may still change" },
] as const;

/**
 * Below this rendered width the drawing stops scaling and its frame scrolls instead. Derived
 * rather than chosen: the smallest type in the figure is 13 viewBox units, and this is the width at
 * which that sets at 11 CSS pixels -- the point below which the labels stop being readable.
 */
const FIGURE_MIN_WIDTH = 760;

const FIGURE_LABEL =
  "Four kinds of account -- a till, an ad account, a store and an analytics property -- arriving as one row shape whose fields are the source, the entity, the dimensions, the metrics, the time it was fetched and whether it may still change";

const PANEL_X = 344;
const PANEL_WIDTH = 520;
const ENTRY = [PANEL_X - 12, 152] as const;
const FIRST_FIELD_Y = 92;
const FIELD_STEP = 34;

export function OneRowShape() {
  return (
    <Figure minWidth={FIGURE_MIN_WIDTH} label={FIGURE_LABEL}>
      <svg viewBox="0 0 880 300" role="img" aria-label={FIGURE_LABEL} className="h-auto w-full">
        {SOURCES.map((source, index) => {
          const y = 34 + index * 60;
          return (
            <g key={source}>
              <Station
                x={16}
                y={y}
                width={180}
                height={44}
                lines={[source]}
                tone="text-ink-muted"
              />
              <CurvedArrow from={[196, y + 22]} to={ENTRY} className="text-line" />
            </g>
          );
        })}

        <rect
          x={PANEL_X}
          y={16}
          width={PANEL_WIDTH}
          height={268}
          rx="14"
          className="fill-surface stroke-brand-blue"
          strokeWidth="1.6"
        />
        <text
          x={PANEL_X + 24}
          y={52}
          className="fill-current text-ink"
          fontSize="15"
          fontWeight="700"
        >
          {PANEL_TITLE}
        </text>
        <line
          x1={PANEL_X + 24}
          y1={66}
          x2={PANEL_X + PANEL_WIDTH - 24}
          y2={66}
          className="text-line"
          stroke="currentColor"
          strokeWidth="1"
        />

        {FIELDS.map((field, index) => {
          const y = FIRST_FIELD_Y + index * FIELD_STEP;
          return (
            <g key={field.key}>
              <text
                x={PANEL_X + 24}
                y={y}
                className="fill-current text-brand-blue"
                fontSize="13"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                {field.key}
              </text>
              <text x={PANEL_X + 196} y={y} className="fill-current text-ink-muted" fontSize="13">
                {field.what}
              </text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}
