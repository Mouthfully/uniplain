import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Footer, SiteHeader } from "../_chrome";
import { FOR_CLAIMS, FOR_COPY, SEGMENTS, type Segment, segmentBySlug } from "./_content";

/**
 * ONE PAGE COMPONENT FOR EVERY SEGMENT, AT /for/<segment>.
 *
 * A DYNAMIC ROUTE RATHER THAN A FOLDER PER SEGMENT, and the choice is not about saving files.
 * `app/connectors/*` is a folder per platform because those pages genuinely differ: each transcribes
 * a different connector's fields, limits, credential lane and setup sequence, and there is no shared
 * shape to render. These pages are the same page about different businesses -- heading, lead, the
 * week the engine computed, what it reads, and a way in -- so the honest representation is one
 * component over a record per segment.
 *
 * WHAT THAT BUYS IS A CLASS OF BUG, NOT TIDINESS. Three near-identical files are three places for a
 * heading to drift, for a metadata description to be copied and half-edited, and for one page to
 * quietly keep a figure the engine stopped producing. With the copy in `../_content.ts` and the
 * figures computed there, two segments cannot ship with the same description (a test refuses it) and
 * no segment can print a number the engine did not return (the module throws at build).
 *
 * `dynamicParams = false` closes the other half: a slug that is not a segment 404s rather than
 * rendering an empty shell, and nothing is generated at request time.
 *
 * EVERY SENTENCE COMES FROM `../_content.ts`, because `scripts/check-copy.mjs` refuses a sentence
 * typed into the JSX. Every number comes from the engine's figure set, through the same module.
 *
 * INDEXED, DELIBERATELY. These are the pages an owner searching for their own kind of business
 * should find, so each declares its own canonical and none carries a noindex. They are NOT in
 * `app/sitemap.ts` or `NAV` -- both belong to another unit in this change and are the integrator's
 * to wire.
 */

/**
 * THREE STATIC ROUTES RATHER THAN ONE DYNAMIC ONE, AND THE REGISTRY IS WHY.
 *
 * This began as `/for/[segment]` with `generateStaticParams`. `_agent/registry.ts` -- the
 * machine-readable surface -- asserts that every indexable route has a registry entry, that every
 * entry has a `page.tsx` on disk at that literal path, and that every entry has a markdown twin at
 * the same URL with the extension replaced. A dynamic segment satisfies none of those: the sitemap
 * would emit the literal `/for/[segment]`, and the markdown handler would describe a template
 * rather than a page.
 *
 * So each segment is its own folder, four lines long, and this module is what they render. The
 * duplication is three imports; what it buys is that the registry, the sitemap and the markdown
 * surface all describe the same three real URLs.
 */

/** The segment, or a 404 -- which is what an unknown slug reaching this component means. */
function resolve(slug: string): Segment {
  const segment = segmentBySlug(slug);
  if (segment === undefined) notFound();
  return segment;
}

export function segmentMetadata(slug: string): Metadata {
  const segment = resolve(slug);
  // `layout.tsx` appends the product name through its title template, so the title here is the
  // short half. The canonical is written per segment rather than inherited: a shared canonical
  // across three pages would ask a crawler to drop two of them.
  return {
    title: segment.title,
    description: segment.description,
    alternates: { canonical: `/for/${segment.slug}` },
  };
}

/** Shared class strings, so the two calls to action cannot drift apart. */
const PRIMARY_BUTTON =
  "bg-accent text-ink-on-accent hover:bg-accent-hover inline-flex min-h-[46px] items-center justify-center gap-4 rounded-md px-[22px] text-sm font-bold transition-colors";
const SECONDARY_BUTTON =
  "bg-surface text-accent border-line hover:bg-surface-subtle inline-flex min-h-[46px] items-center justify-center rounded-md border px-[22px] text-sm font-bold transition-colors";

export function SegmentPage({ slug }: { readonly slug: string }) {
  const segment = resolve(slug);

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* HERO. The same 1fr/1fr split every other page on this site takes, collapsing to one
            column below the guide's 768px. */}
        <section className="mx-auto max-w-[1200px] px-8 pt-4 pb-9 md:pt-7 md:pb-14">
          <nav aria-label="Breadcrumb">
            <ol className="text-ink-subtle flex flex-wrap items-center gap-3 text-[13px]">
              <li>
                <a href="/" className="hover:text-accent">
                  {FOR_COPY.breadcrumbHome}
                </a>
              </li>
              <li aria-hidden="true" className="text-ink-faint">
                /
              </li>
              <li aria-current="page">{segment.crumb}</li>
            </ol>
          </nav>

          <div className="mt-9 grid items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-16">
            <div className="min-w-0">
              <span className="text-ink-subtle text-[11px] font-bold tracking-[0.12em] uppercase">
                {segment.eyebrow}
              </span>

              <h1 className="font-display text-ink mt-6 text-[36px] leading-[1.06] font-semibold tracking-[-0.04em] md:text-[42px] lg:text-[48px]">
                {segment.headingTop}
                <br />
                <span className="brand-gradient-text">{segment.headingBottom}</span>
              </h1>

              {/* 475px is the design's measure cap, which is the guide's 60-70 characters. */}
              <p className="text-ink-muted mt-6 max-w-[475px] text-base leading-[1.65] md:text-[17px]">
                {segment.lead}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={FOR_COPY.ctaHref} className={PRIMARY_BUTTON}>
                  {FOR_COPY.ctaLabel}
                  <span aria-hidden="true">&rarr;</span>
                </a>
                <a href="#brief" className={SECONDARY_BUTTON}>
                  {FOR_COPY.briefLinkLabel}
                </a>
              </div>

              <p className="text-ink-faint mt-6 max-w-[475px] text-xs leading-[1.6]">
                {FOR_CLAIMS.readOnly}
              </p>
            </div>

            {/* THE WEEK. The card labels itself as a sample in its own header, which section 5.3 of
                the reconciliation note makes mandatory rather than optional: an unlabelled example
                of a week's takings is fabricated social proof. */}
            {/* A <section> rather than a <div>, because the card is named by its own heading and a
                bare <div> carries no role for `aria-labelledby` to name. */}
            <section
              id="brief"
              className="bg-surface-inset min-w-0 scroll-mt-8 rounded-xl p-4 md:p-6"
              aria-labelledby="brief-heading"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="brief-heading" className="font-display text-ink text-base font-semibold">
                  {FOR_COPY.briefHeading}
                </h2>
                <span className="border-line bg-surface text-ink-subtle rounded-sm border px-2 py-1 text-[10px] font-bold">
                  {FOR_COPY.sampleBadge}
                </span>
              </div>
              <p className="text-ink-subtle mt-1 text-xs leading-[1.5]">{segment.briefLead}</p>

              <ol aria-label={FOR_COPY.figuresLabel} className="mt-4 list-none p-0">
                {segment.figures.map((figure) => (
                  <li
                    key={figure.id}
                    className="border-line bg-surface mt-3 rounded-lg border p-4 first:mt-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <strong className="text-ink text-sm leading-[1.35]">{figure.label}</strong>
                      <span className="text-accent text-sm font-bold [overflow-wrap:anywhere]">
                        {figure.value}
                        {figure.change === null ? null : (
                          <span className="text-ink-subtle ml-2 font-normal">{figure.change}</span>
                        )}
                      </span>
                    </div>
                    <p className="text-ink-faint mt-2 text-[10px] leading-[1.5]">{figure.note}</p>
                  </li>
                ))}
              </ol>

              <section
                aria-labelledby="action-heading"
                className="border-line bg-surface mt-4 rounded-lg border p-4"
              >
                <h3
                  id="action-heading"
                  className="text-ink-faint text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  {FOR_COPY.actionHeading}
                </h3>
                <strong className="text-ink mt-2 block text-sm leading-[1.35]">
                  {segment.action.headline}
                </strong>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-ink-subtle text-[10px]">{FOR_COPY.worthLabel}</span>
                  <strong className="text-accent text-sm font-bold">{segment.action.worth}</strong>
                </div>
                <p className="text-ink-faint mt-2 text-[10px] leading-[1.5]">
                  {segment.action.shape}
                </p>
              </section>

              <p className="bg-surface text-ink-subtle mt-4 rounded-sm p-3 text-[11px] leading-[1.5]">
                {segment.allProvisional ? FOR_COPY.allProvisionalNote : FOR_COPY.someSettledNote}
              </p>
              <p className="text-ink-faint mt-3 text-[10px] leading-[1.5]">{FOR_COPY.sampleNote}</p>
            </section>
          </div>
        </section>

        {/* WHAT IT READS. One card per account, and no card for anything unimplemented: the list is
            typed to IMPLEMENTED_SOURCE_IDS and `segments.test.ts` checks it again at runtime. */}
        <section
          id="reads"
          aria-labelledby="reads-heading"
          className="border-line bg-surface scroll-mt-8 border-y"
        >
          <div className="mx-auto max-w-[1200px] px-8 py-12 md:py-16">
            <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
              {FOR_COPY.readsEyebrow}
            </span>
            <h2
              id="reads-heading"
              className="font-display text-ink mt-[18px] text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[36px]"
            >
              {FOR_COPY.readsHeading}
            </h2>
            <p className="text-ink-muted mt-5 max-w-[620px] leading-[1.65]">
              {FOR_CLAIMS.connectors}
            </p>

            <ul className="mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
              {segment.reads.map((read) => (
                <li
                  key={read.source}
                  className="border-line bg-ground min-w-0 rounded-lg border p-5"
                >
                  <strong className="text-ink font-display block text-[15px] font-semibold">
                    {read.label}
                  </strong>
                  <p className="text-ink-muted mt-2 text-sm leading-[1.6]">{read.what}</p>
                </li>
              ))}
            </ul>

            <p className="text-ink-subtle mt-6 max-w-[620px] text-sm leading-[1.6]">
              {FOR_COPY.traceNote}
            </p>
          </div>
        </section>

        {/* THE WAY IN. One destination, /signin, because it is the only door: /brief and
            /connections are both signed-in routes and the middleware sends a visitor here anyway. */}
        <section
          aria-labelledby="cta-heading"
          className="mx-auto max-w-[1200px] px-8 py-12 md:py-16"
        >
          <div className="bg-surface-inset rounded-xl p-6 md:p-10">
            <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
              {FOR_COPY.ctaEyebrow}
            </span>
            <h2
              id="cta-heading"
              className="font-display text-ink mt-[18px] text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[36px]"
            >
              {FOR_COPY.ctaHeading}
            </h2>
            <p className="text-ink-muted mt-5 max-w-[560px] leading-[1.65]">{FOR_COPY.ctaBody}</p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a href={FOR_COPY.ctaHref} className={PRIMARY_BUTTON}>
                {FOR_COPY.ctaLabel}
                <span aria-hidden="true">&rarr;</span>
              </a>
              <span className="text-ink-subtle text-xs">{FOR_COPY.planLine}</span>
            </div>

            <p className="text-ink-faint mt-6 max-w-[560px] text-xs leading-[1.6]">
              {FOR_CLAIMS.noTraining}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
