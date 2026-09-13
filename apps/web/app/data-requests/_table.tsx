import { DATA_REQUESTS } from "./_content";
import type { DataRequestRow } from "./_requests";

/**
 * The list, and the one thing it must not do.
 *
 * IT RENDERS NO DEADLINE AND NO ESTIMATE. Each row shows what was asked, when, and where it has
 * got to -- all facts. "Expected by" would be a number nobody has established, printed next to a
 * person's own request, which is the worst place in this product for one.
 *
 * The state comes through `DATA_REQUESTS.stateNames`, so a state the database grows and this
 * screen has not been taught renders as itself rather than as a confident mistranslation. That is
 * deliberately a visible oddity rather than a fallback sentence.
 */
export function DataRequestTable({ rows }: { rows: readonly DataRequestRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-ink-subtle text-xs">
          <tr>
            <th className="py-2 pr-4 font-bold">{DATA_REQUESTS.kindLabel}</th>
            <th className="py-2 pr-4 font-bold">{DATA_REQUESTS.listHeading}</th>
            <th className="py-2 pr-4 font-bold">{DATA_REQUESTS.referenceLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-line border-t align-top">
              <td className="text-ink py-3 pr-4">
                {DATA_REQUESTS.kindNames[row.kind as keyof typeof DATA_REQUESTS.kindNames] ??
                  row.kind}
              </td>
              <td className="text-ink-muted py-3 pr-4">
                {DATA_REQUESTS.stateNames[row.state as keyof typeof DATA_REQUESTS.stateNames] ??
                  row.state}
                {row.resolution_note === null ? null : (
                  <span className="text-ink-subtle mt-1 block text-xs leading-relaxed">
                    {row.resolution_note}
                  </span>
                )}
              </td>
              <td className="text-ink-subtle py-3 pr-4 font-mono text-xs">{row.requested_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-ink-subtle mt-3 text-xs leading-relaxed">{DATA_REQUESTS.withdrawNote}</p>
    </div>
  );
}
