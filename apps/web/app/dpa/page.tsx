import { brand } from "@repo/brand";
import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import { PROCESSING_ACTIVITIES } from "../_processing/activities";
import { DPA_COPY, DPA_VERSION } from "../_processing/dpa-content";
import { SUB_PROCESSORS } from "../_processing/sub-processors";

/**
 * THE DATA PROCESSING AGREEMENT.
 *
 * PDPA s.40 puts the duty to prepare one on the CONTROLLER, who in a business sale is the customer.
 * A vendor who cannot produce an agreement is one their reviewer cannot clear, so this exists to be
 * producible -- and it is a PDPA instrument, not a GDPR Article 28 one. `brand.euRepresentative` is
 * null and Art. 3(2) applicability has never been decided, so the `dpa` claim, whose text promises
 * "Article 28 terms", stays withheld on that second requirement even though `dpaAvailable` is now
 * true. That is the correct outcome rather than an awkward one: the company has an agreement and
 * still may not advertise the thing it does not have.
 *
 * THE FACTUAL CLAUSES ARE RENDERED FROM THE RECORD OF PROCESSING rather than typed into the prose.
 * Section 3 lists categories straight out of `PROCESSING_ACTIVITIES` and section 6 names providers
 * straight out of `SUB_PROCESSORS`, so an agreement that says something the system does not do
 * cannot be written by editing this page. That is the part a downloaded template cannot give a
 * reviewer, and the part they actually test.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Data processing agreement",
  description: DPA_COPY.lead,
};

const H2 = "font-display text-ink text-xl font-semibold tracking-[-0.02em]";
const P = "text-ink-muted mt-2 max-w-[680px] text-sm leading-relaxed";

export default function DpaPage() {
  // The customer's data, not this company's own records -- section 1 draws that line, and this is
  // the same line drawn in code, so the two cannot disagree.
  const processorActivities = PROCESSING_ACTIVITIES.filter((a) => a.role === "processor");

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground min-h-[calc(100dvh-94px)]">
        <div className="mx-auto max-w-[960px] px-8 pt-12 pb-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {DPA_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {DPA_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[680px] leading-relaxed">{DPA_COPY.lead}</p>
          <p className="text-ink-subtle mt-3 font-mono text-xs">
            {DPA_COPY.versionLabel} {DPA_VERSION}
          </p>
          <p className="text-ink-subtle mt-2 max-w-[680px] text-xs leading-relaxed">
            {DPA_COPY.versionNote}
          </p>

          <section className="border-line mt-8 rounded-xl border border-dashed p-6">
            <h2 className={H2}>{DPA_COPY.reviewHeading}</h2>
            <p className={P}>{DPA_COPY.reviewNote}</p>
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.rolesHeading}</h2>
            {DPA_COPY.rolesBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.instructionsHeading}</h2>
            {DPA_COPY.instructionsBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.scopeHeading}</h2>
            <p className={P}>{DPA_COPY.scopeIntro}</p>
            {processorActivities.map((activity) => (
              <div key={activity.id} className="mt-4">
                <p className="text-ink text-sm font-bold">{activity.purpose}</p>
                <p className={P}>{activity.subjects}</p>
                <p className={P}>{activity.categories}</p>
              </div>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.securityHeading}</h2>
            {DPA_COPY.securityBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.confidentialityHeading}</h2>
            {DPA_COPY.confidentialityBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.breachHeading}</h2>
            {DPA_COPY.breachBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.subProcessorHeading}</h2>
            {DPA_COPY.subProcessorBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
            <ul className="mt-3">
              {SUB_PROCESSORS.map((provider) => (
                <li key={provider.name} className="text-ink-muted text-sm leading-relaxed">
                  {provider.name}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.rightsHeading}</h2>
            {DPA_COPY.rightsBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.deletionHeading}</h2>
            {DPA_COPY.deletionBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.transferHeading}</h2>
            {DPA_COPY.transferBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.auditHeading}</h2>
            {DPA_COPY.auditBody.map((line) => (
              <p key={line} className={P}>
                {line}
              </p>
            ))}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className={H2}>{DPA_COPY.contactHeading}</h2>
            <p className={P}>{brand.legalEntity}</p>
            <p className={P}>
              <a className="text-accent underline-offset-4 hover:underline" href="/privacy">
                {DPA_COPY.contactLink}
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
