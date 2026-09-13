import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { Footer, SiteHeader } from "../_chrome";
import { readMembership } from "../members/_members";
import { ACCOUNT_COPY } from "./_content";
import { NOT_INCLUDED } from "./_export";
import { EmailForm } from "./email-form";
import { EraseForm } from "./form";
import { SessionForm } from "./session-form";

/**
 * THE TWO RIGHTS THE PDPA GIVES A CUSTOMER, AND THE TWO CHANGES THAT KEEP THE ACCOUNT THEIRS.
 *
 * s.31 portability and s.33 erasure. Both are laws that already bind this controller -- s.5 binds a
 * controller located in the Kingdom, and `brand.legalEntity` is a Thai juristic person -- rather
 * than features to be scheduled, which is why they are here before the things that are easier to
 * build.
 *
 * The middle two sections -- the sign-in address, and the other signed-in devices -- belong beside
 * them rather than on a settings page of their own because they answer the same question: what
 * happens to this account when the person who opened it is no longer the person holding it. An
 * owner-run business changes hands, an office manager leaves with the laptop, a domain is
 * consolidated. Without these the only route is support, and a product sold to a business with no
 * IT department should not make support the route.
 *
 * THE DESTRUCTIVE CONTROL IS LAST on purpose -- a person scrolling to find the export should not
 * pass the button that ends the account on the way.
 *
 * THE TWO MIDDLE SECTIONS ARE OUTSIDE THE MEMBERSHIP BRANCH, and that is the part worth reading
 * twice. An address and a session belong to the sign-in record, not to the organisation:
 * `readMembership` returning `unavailable` means the database could not answer a question about an
 * organisation, which says nothing about whether a person may move their own account to a different
 * mailbox or end a session on a device they no longer have. Rendering them inside that branch would
 * withdraw the only remedies on this page at exactly the moment something is already wrong -- which
 * is the shape of every outage that turns into a support ticket.
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

  // Narrowed ONCE, into a local, because the two organisation-dependent sections are no longer
  // adjacent -- the address sits between them. Two separate `state.kind === "unavailable"` tests
  // would be two places the same question is asked, and the pair that eventually disagrees renders
  // an erase form for an organisation the export above just said it could not read.
  const membership = state.kind === "unavailable" ? null : state.membership;

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

          {membership === null ? (
            <p className="text-ink mt-8 text-sm leading-[1.6]">{ACCOUNT_COPY.unavailable}</p>
          ) : (
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

                <p className="text-ink mt-6 text-sm font-bold">{ACCOUNT_COPY.exportNotIncluded}</p>
                <ul className="text-ink-subtle mt-2 grid gap-2 text-xs leading-[1.5]">
                  {NOT_INCLUDED.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="text-ink text-sm font-bold">{ACCOUNT_COPY.emailHeading}</h2>
            <div className="mt-3">
              <EmailForm currentEmail={user.email ?? null} pendingEmail={user.new_email ?? null} />
            </div>
          </section>

          {/* Beside the address for the same reason it is here at all: both answer "the person who
              set this up is gone". Outside the membership branch on the same grounds -- a session
              belongs to the sign-in record, not to an organisation. */}
          <section className="mt-12">
            <h2 className="text-ink text-sm font-bold">{ACCOUNT_COPY.sessionsHeading}</h2>
            <div className="mt-3">
              <SessionForm />
            </div>
          </section>

          {membership === null ? null : (
            <section className="mt-12">
              <h2 className="text-ink text-sm font-bold">{ACCOUNT_COPY.eraseHeading}</h2>
              <div className="mt-3">
                <EraseForm
                  organisationId={membership.organisationId}
                  organisationName={membership.organisationName}
                  isOwner={membership.ownRole === "owner"}
                />
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
