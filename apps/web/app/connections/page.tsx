import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser } from "../_auth/server";
import { currentWorkspace } from "../_auth/workspace";
import { Footer, SiteHeader } from "../_chrome";
import { CONNECTIONS } from "../_content";
import { workspaceConnections } from "./_connections";
import { CONNECTED_PARAM, OUTCOME_PARAM, REFERENCE_PARAM, safeReference } from "./_oauth";
import { oauthMessageFor } from "./_oauth-refusals";
import { ConnectionTable } from "./_table";
import { ConnectForm } from "./form";
import { OAuthStartForm } from "./oauth-form";

/**
 * THE SCREEN A CUSTOMER USES TO ATTACH A SOURCE ITSELF.
 *
 * Until this route existed nothing in this app created a connection at all: a paying customer could
 * sign in, see an empty dashboard, and have no way to give us a single row of data. Everything
 * underneath was built -- the vault, `connections`, the connectors, the scheduler and
 * `POST /v1/connections` -- and the only missing piece was a form.
 *
 * TWO HALVES, AND THEY READ THROUGH DIFFERENT DOORS ON PURPOSE. The list is a PostgREST select as
 * the signed-in person, with no workspace predicate, because `connections_select` decides which
 * rows exist for this session. The form posts to the Worker, because the key that seals a
 * credential lives there and must not be on this deploy target. See `_connections.ts` and
 * `actions.ts`; each says why at the point where it would be tempting to do otherwise.
 *
 * TWO KINDS OF CONNECTION, AND THE SCREEN MUST NOT BLUR THEM. One asks the customer to paste a
 * secret they already hold; the other sends them to the provider's own consent screen and brings
 * them back with a permission. Those are different promises about where a secret goes, so they are
 * different sections with different words -- see `form.tsx` and `oauth-form.tsx`. The authorisation
 * half begins at `oauth-actions.ts` and returns at `connections/callback`, and the only thing this
 * app ever holds of it is the account id the customer typed before leaving.
 *
 * WHY IT IS `force-dynamic`, the same reason the dashboard is: with no Supabase variables set at
 * BUILD time this page never touches cookies and Next would prerender it, so a deployment that
 * later sets them would serve a cached, signed-out page to a signed-in person -- a difference that
 * only appears in production.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connections",
  description: CONNECTIONS.lead,
  // A signed-in surface that collects credentials has no business in a search result.
  robots: { index: false, follow: false },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isAuthConfigured()) redirect("/signin");

  // The middleware already refuses an unauthenticated request to this path. This is the second
  // check and it is not redundant: a matcher edit can turn the first one off, and a page that
  // renders credentials-adjacent state must not depend on a routing rule for its access decision.
  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Fconnections");

  const workspace = await currentWorkspace();
  const connections = workspace.kind === "ready" ? await workspaceConnections() : null;

  // THE RETURN LEG'S OUTCOME, WHICH ARRIVES AS A CODE AND IS RENDERED AS OUR OWN SENTENCE.
  //
  // `connections/callback` completes the authorisation and redirects here, because the alternative
  // -- rendering the result on the callback URL -- leaves an authorisation code in the address bar
  // and in the `Referer` of everything the page loads. What survives the redirect is a code, a
  // request id, and nothing else: no account id, no state, nothing from the provider.
  //
  // `oauthMessageFor` is the only thing that turns a code into words, so a query string somebody
  // types by hand can produce a sentence this app wrote or none at all -- never one they chose.
  const params = await searchParams;
  const outcome = typeof params[OUTCOME_PARAM] === "string" ? params[OUTCOME_PARAM] : null;
  const connected = params[CONNECTED_PARAM] === "1";
  const reference = safeReference(params[REFERENCE_PARAM]);

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground min-h-[calc(100dvh-94px)]">
        <div className="mx-auto max-w-[960px] px-8 pt-12 pb-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {CONNECTIONS.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {CONNECTIONS.heading}
          </h1>
          <p className="text-ink-muted mt-4 max-w-[620px] leading-relaxed">{CONNECTIONS.lead}</p>

          {workspace.kind === "ready" ? null : (
            <p className="border-line bg-surface text-ink-muted mt-8 rounded-lg border border-dashed px-5 py-4 text-sm leading-relaxed">
              {workspace.kind === "needsOrganisation"
                ? CONNECTIONS.needsWorkspace
                : CONNECTIONS.workspaceUnavailable}
            </p>
          )}

          {connected ? (
            <section role="status" className="border-line bg-surface mt-8 rounded-xl border p-6">
              <p className="text-ink font-bold">{CONNECTIONS.oauthConnectedHeading}</p>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                {CONNECTIONS.oauthConnectedBody}
              </p>
            </section>
          ) : null}

          {outcome === null ? null : (
            <section role="alert" className="border-line mt-8 rounded-xl border border-dashed p-6">
              <p className="text-accent-hover text-sm font-bold leading-relaxed">
                {oauthMessageFor(outcome)}
              </p>
              {reference === null ? null : (
                <p className="text-ink-subtle mt-2 font-mono text-xs">
                  {CONNECTIONS.referenceLabel} {reference}
                </p>
              )}
            </section>
          )}

          {connections === null ? null : (
            <section className="border-line bg-surface mt-8 rounded-xl border p-6">
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
                {CONNECTIONS.listHeading}
              </h2>
              <p className="text-ink-subtle mt-2 text-xs leading-relaxed">{CONNECTIONS.listNote}</p>

              {connections.kind === "unavailable" ? (
                <p className="text-ink-muted mt-4 text-sm leading-relaxed">
                  {CONNECTIONS.listUnavailable}
                </p>
              ) : connections.rows.length === 0 ? (
                <p className="text-ink-muted mt-4 text-sm leading-relaxed">
                  {CONNECTIONS.listEmpty}
                </p>
              ) : (
                <ConnectionTable rows={connections.rows} />
              )}
            </section>
          )}

          {workspace.kind === "ready" ? (
            <section className="border-line bg-surface mt-6 rounded-xl border p-6">
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
                {CONNECTIONS.formHeading}
              </h2>
              <div className="mt-4">
                <ConnectForm />
              </div>
            </section>
          ) : null}

          {/* THE SECOND DOOR, AND IT IS A SECOND SECTION RATHER THAN SIX OPTIONS IN ONE SELECT.
              These sources are not connected by pasting anything: the customer is sent to the
              provider's consent screen and comes back with a permission, which the Worker exchanges
              and seals. `POST /v1/connections` still refuses `credential_lane: oauth` and that
              refusal is untouched -- this is a different door, not a widened one. Presenting both
              as one control would put two different promises about where a secret goes behind the
              same button. */}
          {workspace.kind === "ready" ? (
            <section className="border-line bg-surface mt-6 rounded-xl border p-6">
              <h2 className="font-display text-ink text-xl font-semibold tracking-[-0.02em]">
                {CONNECTIONS.oauthHeading}
              </h2>
              <p className="text-ink-muted mt-2 max-w-[620px] text-sm leading-relaxed">
                {CONNECTIONS.oauthNote}
              </p>
              <OAuthStartForm />
            </section>
          ) : null}
        </div>
      </main>

      <Footer />
    </>
  );
}
