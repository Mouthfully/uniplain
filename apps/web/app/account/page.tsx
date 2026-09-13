import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { Footer, SiteHeader } from "../_chrome";
import { readMembership } from "../members/_members";
import { ACCOUNT_COPY } from "./_content";
import { NOT_INCLUDED } from "./_export";
import { EraseForm } from "./form";

/**
 * THE TWO RIGHTS THE PDPA GIVES A CUSTOMER, ON ONE PAGE.
 *
 * s.31 portability and s.33 erasure. Both are laws that already bind this controller -- s.5 binds a
 * controller located in the Kingdom, and `brand.legalEntity` is a Thai juristic person -- rather
 * than features to be scheduled, which is why they are here before the things that are easier to
 * build.
 *
 * ALWAYS RENDERED PER REQUEST, and never indexed. The page names an organisation and offers to
 * destroy it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ACCOUNT_COPY.eyebrow,
  description: ACCOUNT_COPY.lead,
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  if (!isAuthConfigured()) redirect("/signin");
  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Faccount");

  // The membership read is reused rather than rewritten: it already returns the three-branch state,
  // the organisation and the caller's own role, and a second query for the same three facts is a
  // second place they can disagree.
  const state = await readMembership(user.id);
  if (state.kind === "needsOrganisation") redirect("/welcome");

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[760px] px-8 py-12 md:py-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {ACCOUNT_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.035em] md:text-[38px]">
            {ACCOUNT_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[560px] leading-[1.65]">{ACCOUNT_COPY.lead}</p>

          {state.kind === "unavailable" ? (
            <p className="text-ink mt-8 text-sm leading-[1.6]">{ACCOUNT_COPY.unavailable}</p>
          ) : (
            <>
              <section className="mt-10">
                <h2 className="text-ink text-sm font-bold">{ACCOUNT_COPY.exportHeading}</h2>
                <div className="border-line bg-surface mt-3 rounded-xl border p-6 md:p-7">
                  <p className="text-ink-muted text-sm leading-[1.6]">{ACCOUNT_COPY.exportBody}</p>
                  {/* A LINK AND NOT A BUTTON: the export is a GET that streams a file with a
                      filename. A server action cannot set Content-Disposition, and building the
                      file in the browser would put a tenant's whole dataset through the document. */}
                  <a
                    href="/account/export"
                    download
                    className="border-line text-ink focus-visible:outline-accent mt-5 inline-flex min-h-[46px] items-center rounded-md border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-[3px]"
                  >
                    {ACCOUNT_COPY.exportButton}
                  </a>

                  <p className="text-ink mt-6 text-sm font-bold">
                    {ACCOUNT_COPY.exportNotIncluded}
                  </p>
                  <ul className="text-ink-subtle mt-2 grid gap-2 text-xs leading-[1.5]">
                    {NOT_INCLUDED.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="mt-12">
                <h2 className="text-ink text-sm font-bold">{ACCOUNT_COPY.eraseHeading}</h2>
                <div className="mt-3">
                  <EraseForm
                    organisationId={state.membership.organisationId}
                    organisationName={state.membership.organisationName}
                    isOwner={state.membership.ownRole === "owner"}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
