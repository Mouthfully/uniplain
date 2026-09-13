import { apiUrl } from "@repo/brand";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { Footer, SiteHeader } from "../_chrome";
import { readMembership } from "../members/_members";
import { KEYS_COPY } from "./_content";
import { workspaceApiKeys } from "./_keys";
import { KeyTable } from "./_table";
import { CreateKeyForm } from "./form";

/**
 * THE SCREEN FOR A TABLE THAT HAS EXISTED SINCE SEPTEMBER AND HAD NO DOOR.
 *
 * `public.api_keys` shipped with a spend budget, a tool allow-list, a hashed credential, three RLS
 * policies and a `verify_api_key` function the Worker already calls. Nothing could make one. A
 * customer could be sold an API they had no way to get a key for, which is the same family of
 * defect as an audit trail nothing writes to: every artefact says the feature is there except the
 * one a customer touches.
 *
 * THE BASE URL IS NOT INVENTED WHEN IT IS NOT KNOWN. `apiUrl()` throws unless `PUBLIC_API_URL` is
 * set or `brand.apiBaseUrl` is settled, and its own message says why: "Refusing to derive one from
 * the site URL -- the API is a different origin, and a URL on the site's domain would resolve to
 * the marketing site rather than fail." A page that printed a plausible address would hand a
 * customer a key and a URL that 404s into a marketing site, which is worse than saying nothing.
 *
 * So the throw is CAUGHT and turned into a sentence. That is the only `try` in this file and it
 * exists to convert a refusal into an explanation, never into a default.
 *
 * ADMIN-ONLY, AND THE REFUSAL IS A SENTENCE RATHER THAN AN EMPTY TABLE. `api_keys_select` is gated
 * on `app.is_org_admin`, so a viewer's query succeeds and returns nothing. Rendering that as an
 * empty list would tell a viewer this workspace has no keys -- a claim this code cannot make.
 *
 * ALWAYS RENDERED PER REQUEST, and never indexed. The page lists credentials by name.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: KEYS_COPY.eyebrow,
  description: KEYS_COPY.lead,
  robots: { index: false, follow: false },
};

/** The API's address, or null when nobody has settled one. Never a guess. */
function apiBase(): string | null {
  try {
    return apiUrl(process.env);
  } catch {
    // The error is not surfaced: it is written for whoever deploys this, and names environment
    // variables. The customer gets `endpointUnsettled` instead, which says whose decision it is.
    return null;
  }
}

export default async function KeysPage() {
  if (!isAuthConfigured()) redirect("/signin");
  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Fkeys");

  const membership = await readMembership(user.id);
  if (membership.kind === "needsOrganisation") redirect("/welcome");

  const isAdmin =
    membership.kind === "ready" &&
    (membership.membership.ownRole === "owner" || membership.membership.ownRole === "admin");

  const keys = await workspaceApiKeys(isAdmin);
  const base = apiBase();

  // `Date.now()` ONCE, HERE, and handed down. `_table.tsx` decides whether a key has expired, and a
  // clock read inside a render would make two rows in the same table answer as of different
  // moments -- the defect `dashboardSpan` was given an argument to avoid.
  const now = Date.now();

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[860px] px-8 py-12 md:py-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {KEYS_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.035em] md:text-[38px]">
            {KEYS_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[600px] leading-[1.65]">{KEYS_COPY.lead}</p>

          {keys.kind === "notAdmin" ? (
            <p className="text-ink mt-8 text-sm leading-[1.6]">{KEYS_COPY.notAdmin}</p>
          ) : keys.kind === "unavailable" ? (
            <p className="text-ink mt-8 text-sm leading-[1.6]">{KEYS_COPY.unavailable}</p>
          ) : (
            <>
              <section className="mt-10">
                <h2 className="text-ink text-sm font-bold">{KEYS_COPY.endpointHeading}</h2>
                <div className="border-line bg-surface mt-3 rounded-xl border p-6 md:p-7">
                  {base === null ? (
                    <p className="text-ink-muted text-sm leading-[1.6]">
                      {KEYS_COPY.endpointUnsettled}
                    </p>
                  ) : (
                    <>
                      <p className="text-ink-subtle text-xs leading-[1.5]">
                        {KEYS_COPY.endpointLabel}
                      </p>
                      <code className="text-ink mt-2 block font-mono text-sm break-all">
                        {base}
                      </code>
                    </>
                  )}
                </div>
              </section>

              <section className="mt-12">
                <h2 className="text-ink text-sm font-bold">{KEYS_COPY.createHeading}</h2>
                <div className="mt-3">
                  <CreateKeyForm />
                </div>
              </section>

              <section className="mt-12">
                <h2 className="text-ink text-sm font-bold">{KEYS_COPY.listHeading}</h2>
                <div className="mt-3">
                  <KeyTable keys={keys.keys} now={now} />
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
