import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { Footer, SiteHeader } from "../_chrome";
import { DATA_REQUESTS } from "./_content";
import { organisationDataRequests } from "./_requests";
import { DataRequestTable } from "./_table";
import { DataRequestForm } from "./form";

/**
 * THE FIRST WORKING ROUTE TO A STATUTORY RIGHT THIS PRODUCT HAS EVER HAD.
 *
 * `/privacy` has always told a data subject to write to the contact address. AGENTS.md records,
 * verified over DNS-over-HTTPS rather than assumed, that the brand domain answers NODATA for both
 * MX and TXT: the zone exists and holds no mail exchanger at all. The published intake for a PDPA
 * s.30-36 right therefore does not receive mail. This screen is not an improvement on that channel,
 * it is the first one that works -- which is the whole argument for building it before the erasure
 * machinery it will eventually drive.
 *
 * WHAT IT PROMISES, AND WHAT IT CAREFULLY DOES NOT. It records a request and shows its state. It
 * does not delete anything and must never grow a button that claims to: `20260908000700_rls.sql`
 * withholds DELETE from `organisations`, `workspaces`, `invitations` and `api_keys` deliberately,
 * nothing here can touch an `auth.users` row, and `deleteWorkspacePayloads` has no caller. A
 * "delete my account" button would be a promise every one of those facts denies.
 *
 * AND NO DEADLINE IS SHOWN, because `app.data_request_deadline()` returns NULL until a
 * Thai-qualified lawyer establishes the period. The screen says so in words. A date here would be
 * a commitment shown to the very person entitled to enforce it.
 *
 * `force-dynamic` for the same reason the dashboard is: with no Supabase variables at BUILD time
 * this page never touches cookies and Next would prerender it, so a deployment that later set them
 * would serve a cached, signed-out page to a signed-in person.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your data",
  description: DATA_REQUESTS.lead,
  // A signed-in surface carrying other people's statutory requests has no business in a search
  // result, and `PRIVATE_PATHS` refuses it to every crawler including the AI ones.
  robots: { index: false, follow: false },
};

export default async function DataRequestsPage() {
  if (!isAuthConfigured()) redirect("/signin");

  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Fdata-requests");

  const requests = await organisationDataRequests();

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground min-h-[calc(100dvh-94px)]">
        <div className="mx-auto max-w-[960px] px-8 pt-12 pb-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {DATA_REQUESTS.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {DATA_REQUESTS.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[620px] leading-relaxed">{DATA_REQUESTS.lead}</p>
          <p className="text-ink-subtle mt-3 max-w-[620px] text-sm leading-relaxed">
            {DATA_REQUESTS.processorNote}
          </p>

          <section className="border-line bg-surface mt-8 rounded-xl border p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {DATA_REQUESTS.listHeading}
            </h2>
            <p className="text-ink-subtle mt-2 text-xs leading-relaxed">{DATA_REQUESTS.listNote}</p>

            {requests.kind === "unavailable" ? (
              <p className="text-ink-muted mt-4 text-sm leading-relaxed">
                {DATA_REQUESTS.listUnavailable}
              </p>
            ) : requests.rows.length === 0 ? (
              <p className="text-ink-muted mt-4 text-sm leading-relaxed">
                {DATA_REQUESTS.listEmpty}
              </p>
            ) : (
              <DataRequestTable rows={requests.rows} />
            )}
          </section>

          <section className="border-line bg-surface mt-6 rounded-xl border p-6">
            <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
              {DATA_REQUESTS.heading}
            </h2>
            <DataRequestForm />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
