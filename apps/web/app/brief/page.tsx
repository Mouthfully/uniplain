import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import { BRIEF_COPY } from "./_content";
import { BRIEF_PERIOD } from "./_period";
import { BriefForm } from "./form";

/**
 * THE FIRST SURFACE THAT DELIVERS AN INSIGHT TO A CUSTOMER.
 *
 * `packages/insights` has been able to write a brief since it landed and nothing called it: no
 * route, no cron, no key. That gap is what issue #49's last unmet criterion turns on, and it is
 * what this page closes -- for one customer, on demand, on one screen.
 *
 * ON DEMAND RATHER THAN ON A CLOCK, DELIBERATELY. The product's own copy promises a brief every
 * morning, and this is not that: there is no scheduler calling the engine and no channel to deliver
 * through. A page that generated on every view would also spend money on a provider call each time
 * somebody refreshed. So the owner asks, and gets one. The morning half is a cron and a channel
 * adapter, and it is the next unit rather than a claim this page makes.
 *
 * ALWAYS RENDERED PER REQUEST. The brief is about the signed-in workspace's own rows; a cached
 * render would serve one tenant's period to another, which is the failure row-level security exists
 * to make impossible and which caching would reintroduce above it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: BRIEF_COPY.eyebrow,
  description: BRIEF_COPY.lead,
  robots: { index: false, follow: false },
};

export default async function BriefPage() {
  // TODAY IS READ HERE AND NOWHERE ELSE, and it is handed to the action as a form value rather than
  // read inside it. `periodFor` therefore takes the date as an argument: the period a brief covers
  // becomes an input to the request that produced it, reconstructible afterwards, instead of a
  // function of when the action happened to run. It is also the only clock read on this surface.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[760px] px-8 py-12 md:py-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {BRIEF_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.035em] md:text-[38px]">
            {BRIEF_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[560px] leading-[1.65]">{BRIEF_COPY.lead}</p>
          <p className="text-ink-faint mt-2 text-xs">
            {BRIEF_COPY.periodLabel}
            {": "}
            {BRIEF_PERIOD.label}
          </p>

          <div className="mt-8">
            <BriefForm today={today} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
