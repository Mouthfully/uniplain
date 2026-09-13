import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import { NO_PERSONAL_DATA, PROCESSING_ACTIVITIES } from "../_processing/activities";
import { PROCESSING_COPY } from "../_processing/content";

/**
 * THE RECORD OF PROCESSING ACTIVITIES, PUBLISHED.
 *
 * PDPA s.39 requires a controller to keep one; it does not require publishing it. This publishes it
 * anyway, for a commercial reason rather than a legal one: a B2B customer's own obligations depend
 * on being able to check their processor's, and the reviewer who asks for this document is the one
 * who decides whether the sale happens. A record that already exists, is specific, and is
 * demonstrably generated from the schema answers that conversation in one link.
 *
 * WHAT MAKES IT WORTH READING is the same thing that makes it awkward: it states what is NOT in
 * place. No transfer instrument, no DPA, no retention schedule, no DPO. A reviewer finds those out
 * in the first meeting regardless; finding them stated on the vendor's own page is the difference
 * between a vendor who knows their position and one who has not looked.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Record of processing",
  description: PROCESSING_COPY.lead,
};

const CELL = "text-ink-muted py-3 pr-4 align-top text-sm leading-relaxed";
const HEAD = "text-ink-subtle py-2 pr-4 text-left text-xs font-bold";

export default function ProcessingPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground min-h-[calc(100dvh-94px)]">
        <div className="mx-auto max-w-[960px] px-8 pt-12 pb-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {PROCESSING_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {PROCESSING_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[620px] leading-relaxed">
            {PROCESSING_COPY.lead}
          </p>
          <p className="text-ink-subtle mt-3 max-w-[620px] text-sm leading-relaxed">
            {PROCESSING_COPY.generatedNote}
          </p>

          <section className="border-line bg-surface mt-8 rounded-xl border p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {PROCESSING_COPY.roleHeading}
            </h2>
            <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
              {PROCESSING_COPY.roleNote}
            </p>
          </section>

          {PROCESSING_ACTIVITIES.map((activity) => (
            <section
              key={activity.id}
              className="border-line bg-surface mt-6 rounded-xl border p-6"
            >
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
                {activity.purpose}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <tbody>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.role}
                      </th>
                      <td className={CELL}>{activity.role}</td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.subjects}
                      </th>
                      <td className={CELL}>{activity.subjects}</td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.categories}
                      </th>
                      <td className={CELL}>{activity.categories}</td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.basis}
                      </th>
                      <td className={CELL}>{activity.basis}</td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.recipients}
                      </th>
                      <td className={CELL}>
                        {activity.recipients.length === 0
                          ? PROCESSING_COPY.noRecipients
                          : activity.recipients.join(", ")}
                      </td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.retention}
                      </th>
                      <td className={CELL}>
                        {activity.retention === null
                          ? PROCESSING_COPY.noRetention
                          : activity.retention}
                      </td>
                    </tr>
                    <tr className="border-line border-t">
                      <th scope="row" className={HEAD}>
                        {PROCESSING_COPY.tableHeadings.tables}
                      </th>
                      <td className={`${CELL} font-mono text-xs`}>{activity.tables.join(", ")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {PROCESSING_COPY.cleanHeading}
            </h2>
            <p className="text-ink-subtle mt-2 text-xs leading-relaxed">
              {PROCESSING_COPY.cleanNote}
            </p>
            {NO_PERSONAL_DATA.map((entry) => (
              <p key={entry.table} className="text-ink-muted mt-4 text-sm leading-relaxed">
                <span className="text-ink font-mono text-xs font-bold">{entry.table}</span>{" "}
                {entry.why}
              </p>
            ))}
          </section>

          <section className="border-line mt-6 rounded-xl border border-dashed p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {PROCESSING_COPY.openHeading}
            </h2>
            <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
              {PROCESSING_COPY.openNote}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
