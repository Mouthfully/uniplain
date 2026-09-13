import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import {
  ASSURANCE_DOCUMENTS,
  CONTROLS,
  FACT_ROWS,
  GAPS,
  LAW_POINTS,
  SECURITY_COPY,
  assurance,
  assuranceNotice,
  documentsNotHeld,
} from "./_content";

/**
 * /security -- the page a business buyer opens after asking whether this is safe to connect.
 *
 * IT ANSWERS IN TWO HALVES AND THE SECOND HALF IS THE ONE THAT SELLS. What the software enforces
 * is a list of properties with a file behind each. What is not held is a list of documents somebody
 * else issues, and saying so plainly is the only version of this page that survives contact with a
 * reader who checks. `privacy/page.tsx` already holds the line for the legal document; this is the
 * commercial one, written to the same rule.
 *
 * EVERY SENTENCE COMES FROM `_content.ts`, and `security.test.ts` asserts it against this file's
 * own source rather than trusting `scripts/check-copy.mjs` to be run. Nothing below is a literal
 * longer than a label.
 *
 * THE THREE THINGS THIS FILE IS FORBIDDEN TO DECIDE, all of them in `_content.ts`: whether an
 * assurance document is held, where the data sits, and which law applies. Each is computed from a
 * brand fact, because a page that types the current answer into prose keeps publishing it after the
 * fact moves -- and of everything on this site, "we hold no report" is the sentence that would do
 * the most damage by surviving its own truth.
 *
 * INDEXED, unlike `/members` and `/brief`. This is a page a buyer should be able to find, and a
 * `noindex` on it would mean the only public answer to "are they secure" was somebody else's.
 * It needs a `sitemap.ts` entry to match, which belongs to whoever wires the routes.
 */

export const metadata: Metadata = {
  title: SECURITY_COPY.metaTitle,
  description: SECURITY_COPY.metaDescription,
  alternates: { canonical: "/security" },
  robots: { index: true, follow: true },
};

export default function SecurityPage() {
  const held = assurance();
  const notHeld = documentsNotHeld();

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* HERO, at the narrower measure continuous prose needs -- the same shape /privacy and
            /terms use, so the three document pages read as one set. */}
        <section className="mx-auto max-w-[1200px] px-8 pt-4 pb-8 md:pt-7 md:pb-12">
          <nav aria-label="Breadcrumb">
            <ol className="text-ink-subtle flex flex-wrap items-center gap-3 text-[13px]">
              <li>
                <a href="/" className="hover:text-accent">
                  Home
                </a>
              </li>
              <li aria-hidden="true" className="text-ink-faint">
                /
              </li>
              <li aria-current="page">Security</li>
            </ol>
          </nav>

          <div className="mt-8 max-w-[760px]">
            <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
              {SECURITY_COPY.eyebrow}
            </span>
            <h1 className="font-display text-ink mt-2.5 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[42px]">
              {SECURITY_COPY.heading}
            </h1>
            <p className="text-ink-muted mt-5 text-base leading-[1.7] md:text-[17px]">
              {SECURITY_COPY.lead}
            </p>
          </div>
        </section>

        {/* THE STANDING NOTICE AND THE FACTS PANEL. The panel prints values in labelled cells
            rather than sentences: a sentence about the governing law is a withheld claim, and the
            facts it is built from are not. */}
        <section
          aria-labelledby="facts-heading"
          className="mx-auto max-w-[1200px] px-8 pb-10 md:pb-14"
        >
          <div className="bg-surface-inset rounded-xl p-6 md:p-9">
            <p className="text-ink-muted max-w-[760px] text-sm leading-[1.7]">
              {SECURITY_COPY.notice}
            </p>

            <h2
              id="facts-heading"
              className="text-ink-faint mt-8 text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs"
            >
              {SECURITY_COPY.factsHeading}
            </h2>

            <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {FACT_ROWS.map((row) => (
                <div key={row.key} className="min-w-0">
                  <dt className="text-ink-subtle text-xs">{row.key}</dt>
                  <dd className="text-ink mt-1 text-sm leading-[1.55] font-bold">{row.value}</dd>
                </div>
              ))}
              <div className="min-w-0">
                <dt className="text-ink-subtle text-xs">{SECURITY_COPY.factsAssurance}</dt>
                {/* The one cell on this page that is a count rather than a value, and it is read
                    from the brand facts. Typing "None" here is the whole defect this section
                    exists to avoid. */}
                <dd className="text-ink mt-1 text-sm leading-[1.55] font-bold">
                  {ASSURANCE_DOCUMENTS.length - notHeld.length}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* WHAT IS ENFORCED. */}
        <section
          aria-labelledby="controls-heading"
          className="mx-auto max-w-[1200px] px-8 pb-12 md:pb-16"
        >
          <div className="max-w-[760px]">
            <h2
              id="controls-heading"
              className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[28px]"
            >
              {SECURITY_COPY.controlsHeading}
            </h2>
            <p className="text-ink-muted mt-3 text-sm leading-[1.7]">
              {SECURITY_COPY.controlsLead}
            </p>
          </div>

          <ol className="mt-6 max-w-[760px]">
            {CONTROLS.map((control, index) => (
              <li
                key={control.id}
                id={control.id}
                className="border-line-soft border-t py-8 first:border-t-0 first:pt-0 md:py-10 md:first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-ink-faint text-[13px] font-bold tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="font-display text-ink text-xl leading-[1.3] font-semibold tracking-[-0.01em] md:text-[22px]">
                    {control.title}
                  </h3>
                </div>

                {control.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-ink-muted mt-4 text-[15px] leading-[1.75] md:text-base"
                  >
                    {paragraph}
                  </p>
                ))}

                <div className="border-line bg-surface mt-5 rounded-lg border p-5">
                  <span className="text-ink-faint text-[11px] font-bold tracking-[0.1em] uppercase">
                    {SECURITY_COPY.controlsCheckLabel}
                  </span>
                  <p className="text-ink-subtle mt-2 text-[13px] leading-[1.7]">{control.check}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* WHAT IS NOT HELD. The list is `documentsNotHeld()`, so a document that becomes held
            leaves this section by itself rather than by somebody remembering. */}
        <section
          aria-labelledby="not-held-heading"
          className="bg-surface-subtle border-line-soft border-y"
        >
          <div className="mx-auto max-w-[1200px] px-8 py-12 md:py-16">
            <div className="max-w-[760px]">
              <h2
                id="not-held-heading"
                className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[28px]"
              >
                {SECURITY_COPY.notHeldHeading}
              </h2>
              <p className="text-ink-muted mt-3 text-sm leading-[1.7]">
                {SECURITY_COPY.notHeldLead}
              </p>

              {/* The two branches of the union. Neither sentence is written as a fact about
                  today; each belongs to the branch the brand facts select. */}
              <p className="text-ink mt-5 text-[15px] leading-[1.75] font-bold md:text-base">
                {assuranceNotice(held)}
              </p>
            </div>

            <ul className="mt-8 grid max-w-[1000px] gap-4 md:grid-cols-2 md:gap-6">
              {notHeld.map((document) => (
                <li
                  key={document.id}
                  id={document.id}
                  className="border-line bg-surface flex flex-col rounded-lg border p-6 md:p-7"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-ink text-xl leading-[1.3] font-semibold tracking-[-0.01em]">
                      {document.title}
                    </h3>
                    <span className="border-line bg-surface-inset text-ink-subtle rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] uppercase">
                      {SECURITY_COPY.notHeldStatus}
                    </span>
                  </div>

                  {document.what.map((paragraph) => (
                    <p key={paragraph} className="text-ink-muted mt-4 text-[15px] leading-[1.7]">
                      {paragraph}
                    </p>
                  ))}

                  <p className="text-ink-subtle mt-4 text-[13px] leading-[1.6]">
                    {document.issuedBy}
                  </p>

                  <span className="text-ink-faint mt-6 text-[11px] font-bold tracking-[0.1em] uppercase">
                    {SECURITY_COPY.notHeldRequiredLabel}
                  </span>
                  <ul className="mt-3">
                    {document.required.map((requirement) => (
                      <li
                        key={requirement}
                        className="text-ink-muted my-2.5 flex gap-3 text-[14px] leading-[1.7]"
                      >
                        <span aria-hidden="true" className="text-ink-faint shrink-0 font-bold">
                          &#8212;
                        </span>
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* THE LAW, kept apart from the two documents because it is not one. */}
        <section
          aria-labelledby="law-heading"
          className="mx-auto max-w-[1200px] px-8 pt-12 pb-12 md:pt-16 md:pb-16"
        >
          <div className="max-w-[760px]">
            <h2
              id="law-heading"
              className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[28px]"
            >
              {SECURITY_COPY.lawHeading}
            </h2>
            <p className="text-ink-muted mt-3 text-sm leading-[1.7]">{SECURITY_COPY.lawLead}</p>

            <ul className="mt-5">
              {LAW_POINTS.map((point) => (
                <li
                  key={point}
                  className="text-ink-muted my-3 flex gap-3 text-[15px] leading-[1.75] md:text-base"
                >
                  <span aria-hidden="true" className="text-ink-faint shrink-0 font-bold">
                    &#8212;
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* THE GAPS, gathered in one place for the same reason /privacy gathers its open items:
            a reviewer should be able to see the whole of it without assembling it. */}
        <section
          aria-labelledby="gaps-heading"
          className="mx-auto max-w-[1200px] px-8 pb-12 md:pb-[70px]"
        >
          <div className="border-line rounded-xl border p-6 md:p-9">
            <h2
              id="gaps-heading"
              className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[28px]"
            >
              {SECURITY_COPY.gapsHeading}
            </h2>
            <p className="text-ink-muted mt-3 max-w-[760px] text-sm leading-[1.7]">
              {SECURITY_COPY.gapsLead}
            </p>

            <dl className="border-line-soft mt-6 max-w-[760px] border-t">
              {GAPS.map((gap) => (
                <div
                  key={gap.term}
                  className="border-line-soft flex flex-col gap-1 border-b py-3.5 sm:flex-row sm:gap-6"
                >
                  <dt className="text-ink text-[13px] font-bold sm:w-[240px] sm:shrink-0">
                    {gap.term}
                  </dt>
                  <dd className="text-ink-subtle text-[13px] leading-[1.6]">{gap.note}</dd>
                </div>
              ))}
            </dl>

            <h3 className="font-display text-ink mt-9 text-xl leading-[1.3] font-semibold tracking-[-0.01em]">
              {SECURITY_COPY.closingHeading}
            </h3>
            <p className="text-ink-muted mt-3 max-w-[760px] text-[15px] leading-[1.75]">
              {SECURITY_COPY.closingBody}
            </p>
            <a
              className="text-accent mt-4 inline-block text-sm font-bold underline-offset-4 hover:underline"
              href="/privacy"
            >
              {SECURITY_COPY.closingLink}
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
