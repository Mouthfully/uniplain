import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import { activitiesFor, SUB_PROCESSORS } from "../_processing/sub-processors";
import { SUB_PROCESSOR_COPY } from "../_processing/sub-processor-content";

/**
 * THE PUBLIC SUB-PROCESSOR LIST.
 *
 * One of the two artefacts a data processing agreement rests on, and the half that is fact rather
 * than legal drafting. `claims.ts` states the condition for the `dpa` claim exactly -- "a
 * click-through Article 28 DPA plus a public sub-processor list" -- and this is the second half.
 *
 * THE CLAIM STAYS WITHHELD. `brand.dpaAvailable` is still false, nothing here changes it, and
 * `brand.test.ts` would go red if it did without the matching ban being lifted in the same change.
 * Half a condition met is not the condition, and the most tempting thing to do on the day this page
 * ships is to decide it is close enough.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sub-processors",
  description: SUB_PROCESSOR_COPY.lead,
};

export default function SubProcessorsPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground min-h-[calc(100dvh-94px)]">
        <div className="mx-auto max-w-[960px] px-8 pt-12 pb-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {SUB_PROCESSOR_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {SUB_PROCESSOR_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[620px] leading-relaxed">
            {SUB_PROCESSOR_COPY.lead}
          </p>
          <p className="text-ink-subtle mt-3 max-w-[620px] text-sm leading-relaxed">
            {SUB_PROCESSOR_COPY.whyNote}
          </p>
          <p className="text-ink-subtle mt-3 max-w-[620px] text-sm leading-relaxed">
            {SUB_PROCESSOR_COPY.generatedNote}
          </p>

          {SUB_PROCESSORS.map((provider) => (
            <section
              key={provider.name}
              className="border-line bg-surface mt-6 rounded-xl border p-6"
            >
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
                {provider.name}
              </h2>
              <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
                {provider.role}
              </p>

              <p className="text-ink-subtle mt-4 text-xs font-bold">
                {SUB_PROCESSOR_COPY.locationHeading}
              </p>
              <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                {provider.location ?? SUB_PROCESSOR_COPY.locationUnknown}
              </p>

              <p className="text-ink-subtle mt-4 text-xs font-bold">
                {SUB_PROCESSOR_COPY.activitiesHeading}
              </p>
              <ul className="mt-1">
                {activitiesFor(provider.name).map((purpose) => (
                  <li key={purpose} className="text-ink-muted text-sm leading-relaxed">
                    {purpose}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {SUB_PROCESSOR_COPY.changeHeading}
            </h2>
            <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
              {SUB_PROCESSOR_COPY.changeNote}
            </p>
          </section>

          <section className="border-line mt-6 rounded-xl border border-dashed p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {SUB_PROCESSOR_COPY.openHeading}
            </h2>
            <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
              {SUB_PROCESSOR_COPY.openNote}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
