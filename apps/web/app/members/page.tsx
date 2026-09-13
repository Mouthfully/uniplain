import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { Footer, SiteHeader } from "../_chrome";
import { MEMBERS_COPY, ROLE_DESCRIPTIONS, ROLE_LABELS, ALL_ROLES } from "./_content";
import { readMembership } from "./_members";
import { MemberTable } from "./_table";
import { InviteForm } from "./form";

/**
 * WHO CAN SEE THIS ACCOUNT.
 *
 * ALWAYS RENDERED PER REQUEST. The list is one organisation's membership -- including colleagues'
 * email addresses -- and a cached render would serve one business's people to another. That is the
 * failure row-level security exists to make impossible and the one caching reintroduces above it.
 *
 * AND NEVER INDEXED. `robots` says so, which matters more here than on the brief: a search engine
 * that reached this page would publish a list of named individuals working at a named business,
 * which is a personal-data disclosure rather than a leak of trading figures.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: MEMBERS_COPY.eyebrow,
  description: MEMBERS_COPY.lead,
  robots: { index: false, follow: false },
};

export default async function MembersPage() {
  if (!isAuthConfigured()) redirect("/signin");
  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Fmembers");

  const state = await readMembership(user.id);
  if (state.kind === "needsOrganisation") redirect("/welcome");

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[860px] px-8 py-12 md:py-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {MEMBERS_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.035em] md:text-[38px]">
            {MEMBERS_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[600px] leading-[1.65]">{MEMBERS_COPY.lead}</p>

          {state.kind === "unavailable" ? (
            <p className="text-ink mt-8 text-sm leading-[1.6]">{MEMBERS_COPY.unavailable}</p>
          ) : (
            <>
              <div className="mt-10">
                <MemberTable
                  members={state.membership.members}
                  invitations={state.membership.invitations}
                  ownRole={state.membership.ownRole}
                  trail={state.membership.trail}
                />
              </div>

              {state.membership.ownRole === "owner" || state.membership.ownRole === "admin" ? (
                <div className="mt-12">
                  <h2 className="text-ink text-sm font-bold">{MEMBERS_COPY.inviteHeading}</h2>
                  <div className="mt-3">
                    <InviteForm />
                  </div>
                </div>
              ) : (
                <p className="text-ink-subtle mt-10 text-sm leading-[1.6]">
                  {MEMBERS_COPY.notAdmin}
                </p>
              )}

              {/* WHAT EACH ROLE MEANS, PRINTED. A role nobody can define is a role nobody chose,
                  and the difference between analyst and viewer is invisible from the word alone. */}
              <dl className="border-line mt-12 grid gap-3 rounded-xl border p-6">
                {ALL_ROLES.map((role) => (
                  <div key={role} className="grid gap-1">
                    <dt className="text-ink text-sm font-bold">{ROLE_LABELS[role]}</dt>
                    <dd className="text-ink-subtle text-xs leading-[1.5]">
                      {ROLE_DESCRIPTIONS[role]}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
