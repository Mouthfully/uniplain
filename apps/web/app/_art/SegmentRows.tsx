import { METRIC_LABELS, readMetric, type InsightRow } from "@repo/insights";
import type { MetricName } from "@repo/contract";

/**
 * THE ROWS A SEGMENT PAGE'S FIGURES WERE COMPUTED FROM, DRAWN.
 *
 * WHY THIS IS THE ONE CHART ON THE SITE THAT CANNOT GO WRONG. Every other illustration of data on a
 * marketing page is drawn from numbers somebody typed for the drawing. This one reads
 * `segment.rows` -- the same array `buildFigureSet` was handed to produce the figures printed
 * beside it. There is no second set of numbers to drift, because there is nowhere to write one: a
 * chart that disagreed with the figure next to it would have to come from rows that do not exist.
 *
 * IT DRAWS SHAPE AND NEVER PRINTS A VALUE, and that is a rule rather than a shortcut. The figures
 * beside this chart were rendered by the engine -- `renderMoney` and `renderCount` in `figures.ts`
 * decide the currency, the precision and the thousands separator. If this component formatted an
 * axis it would be a SECOND renderer for the same numbers, and the first time the two disagreed on
 * a rounding the page would show one number twice, differently, with nothing to say which was
 * right. So the axis carries no numbers at all: the chart is here for direction and relative
 * height, which is what a reader cannot get from a list, and the values stay where the engine
 * formatted them.
 *
 * EACH SOURCE IS ITS OWN PANEL, SCALED TO ITSELF. A cafe's takings and its advertising spend differ
 * by an order of magnitude; one shared axis would draw the spend as a flat line at zero and say
 * something false about it. Separate panels with a hairline between them are what stops a reader
 * comparing two heights that were never on the same scale -- the same reason the panels never share
 * a gridline.
 *
 * THE METRIC NAME COMES FROM THE DICTIONARY. `METRIC_LABELS` is exported from `@repo/insights` for
 * this; a label typed here would be a second name for a metric that already has one.
 */

/** Geometry, in viewBox units. One panel per source, stacked. */
const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 118;
const PLOT_TOP = 46;
const PLOT_BOTTOM = 104;
const PLOT_LEFT = 10;
const PLOT_RIGHT = PANEL_WIDTH - 10;
const BAR_MAX_WIDTH = 24;
const BAR_GAP = 4;

/** The legend's two words, and the figure's accessible name. Constants, as the copy guard requires. */
const LEGEND_EARLIER = "Period before";
const LEGEND_CURRENT = "This period";
const SAMPLE_NOTE = "Sample rows";

/**
 * A bar has to be visible even when its value is the smallest in the panel, or a reader reads
 * "nothing happened that day" off what is really "less than the others". Two viewBox units is the
 * floor.
 */
const MIN_BAR_HEIGHT = 2;

interface Day {
  readonly date: string;
  readonly value: number;
}

interface Panel {
  readonly source: string;
  readonly label: string;
  readonly metric: string;
  readonly earlier: readonly Day[];
  readonly current: readonly Day[];
  readonly max: number;
}

function within(date: string, window: { readonly from: string; readonly to: string }): boolean {
  // ISO dates compare correctly as strings, which is the reason the envelope stores them this way.
  return date >= window.from && date <= window.to;
}

/**
 * The metric a source's panel draws: the first one its own rows carry.
 *
 * NOT "the biggest" and not a per-source table written here. Insertion order in the sample rows is
 * the order the connector's own normaliser emits, and picking by magnitude would silently change
 * which metric a page draws when a number moves -- a chart whose subject depends on its data is a
 * chart that can relabel itself between two deploys.
 */
function leadMetric(rows: readonly InsightRow[]): MetricName | null {
  for (const row of rows) {
    const [first] = Object.keys(row.metrics);
    if (first !== undefined) return first as MetricName;
  }
  return null;
}

function buildPanels(
  rows: readonly InsightRow[],
  labels: Readonly<Record<string, string>>,
  period: { readonly from: string; readonly to: string },
  comparison: { readonly from: string; readonly to: string },
): readonly Panel[] {
  const sources = [...new Set(rows.map((row) => row.source))];

  return sources.flatMap((source) => {
    const ofSource = rows.filter((row) => row.source === source);
    const metric = leadMetric(ofSource);
    const label = labels[source];
    // A source with no metric, or one this page has no label for, is skipped rather than drawn
    // with a placeholder: a panel headed by a raw source id is worse than one fewer panel.
    if (metric === null || label === undefined) return [];

    /**
     * `readMetric` AND NOT `row.metrics[metric] ?? 0`. The envelope types a metric as `unknown`
     * because the store can hand back a quoted decimal where the connector emitted a number, and
     * the repository's first rule is that an absent measurement is not a zero. A `??` here would
     * draw a bar of height nothing for a day that was never measured, which is a chart stating
     * something false in the one visual language a reader trusts without checking. A day whose
     * metric cannot be read gets NO BAR, which is what a gap in the data looks like.
     */
    const daysIn = (window: { readonly from: string; readonly to: string }): Day[] =>
      ofSource
        .filter((row) => within(row.dimensions.date, window))
        .flatMap((row) => {
          const reading = readMetric(row.metrics[metric]);
          return reading.kind === "value"
            ? [{ date: row.dimensions.date, value: reading.value }]
            : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    const earlier = daysIn(comparison);
    const current = daysIn(period);
    if (current.length === 0) return [];

    const max = Math.max(...earlier.map((d) => d.value), ...current.map((d) => d.value));
    if (!(max > 0)) return [];

    return [{ source, label, metric, earlier, current, max }];
  });
}

function barHeight(value: number, max: number): number {
  return Math.max(MIN_BAR_HEIGHT, ((PLOT_BOTTOM - PLOT_TOP) * value) / max);
}

export function SegmentRows({
  rows,
  labels,
  period,
  comparison,
  figureLabel,
}: {
  readonly rows: readonly InsightRow[];
  /** Source id to the page's own label for it, so this component names no platform itself. */
  readonly labels: Readonly<Record<string, string>>;
  readonly period: { readonly from: string; readonly to: string };
  readonly comparison: { readonly from: string; readonly to: string };
  /** The accessible name, authored beside the rest of the page's copy. */
  readonly figureLabel: string;
}) {
  const panels = buildPanels(rows, labels, period, comparison);
  // Nothing to draw is a blank, not a frame around nothing. The page reads the same without it.
  if (panels.length === 0) return null;

  const height = panels.length * PANEL_HEIGHT + 26;

  return (
    <svg
      viewBox={`0 0 ${PANEL_WIDTH} ${height}`}
      role="img"
      aria-label={figureLabel}
      className="h-auto w-full"
    >
      {/* The legend, once, at the top. Two swatches rather than a colour named in words: the
          panels below are the same two fills, so the reader matches shapes and not adjectives. */}
      <g>
        <rect x={PLOT_LEFT} y={5} width="11" height="11" rx="2" className="fill-line" />
        <text
          x={PLOT_LEFT + 14}
          y={14}
          className="fill-current text-ink-subtle"
          fontSize="11"
          fontWeight="600"
        >
          {LEGEND_EARLIER}
        </text>
        <rect x={PLOT_LEFT + 104} y={5} width="11" height="11" rx="2" className="fill-brand-blue" />
        <text
          x={PLOT_LEFT + 118}
          y={14}
          className="fill-current text-ink-subtle"
          fontSize="11"
          fontWeight="600"
        >
          {LEGEND_CURRENT}
        </text>
        <text
          x={PLOT_RIGHT}
          y={14}
          textAnchor="end"
          className="fill-current text-ink-faint"
          fontSize="11"
          fontWeight="700"
        >
          {SAMPLE_NOTE}
        </text>
      </g>

      {panels.map((panel, index) => {
        const top = 26 + index * PANEL_HEIGHT;
        const baseline = top + PLOT_BOTTOM;
        const groups = Math.max(panel.current.length, panel.earlier.length);
        const groupWidth = (PLOT_RIGHT - PLOT_LEFT) / groups;
        const barWidth = Math.min(BAR_MAX_WIDTH, (groupWidth - BAR_GAP * 3) / 2);

        return (
          <g key={panel.source}>
            <text
              x={PLOT_LEFT}
              y={top + 18}
              className="fill-current text-ink"
              fontSize="13"
              fontWeight="700"
            >
              {panel.label}
            </text>
            <text x={PLOT_LEFT} y={top + 34} className="fill-current text-ink-subtle" fontSize="11">
              {METRIC_LABELS[panel.metric as MetricName]}
            </text>

            {/* The baseline is the only rule drawn. A gridline would need a value against it, and
                this chart deliberately has none. */}
            <line
              x1={PLOT_LEFT}
              y1={baseline}
              x2={PLOT_RIGHT}
              y2={baseline}
              className="text-line"
              stroke="currentColor"
              strokeWidth="1"
            />

            {Array.from({ length: groups }, (_, day) => {
              const earlier = panel.earlier[day];
              const current = panel.current[day];
              const centre = PLOT_LEFT + groupWidth * (day + 0.5);
              const left = centre - barWidth - BAR_GAP / 2;

              return (
                <g key={current?.date ?? earlier?.date ?? day}>
                  {earlier !== undefined ? (
                    <rect
                      x={left}
                      y={baseline - barHeight(earlier.value, panel.max)}
                      width={barWidth}
                      height={barHeight(earlier.value, panel.max)}
                      rx="2"
                      className="fill-line"
                    />
                  ) : null}
                  {current !== undefined ? (
                    <rect
                      x={left + barWidth + BAR_GAP}
                      y={baseline - barHeight(current.value, panel.max)}
                      width={barWidth}
                      height={barHeight(current.value, panel.max)}
                      rx="2"
                      className="fill-brand-blue"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
