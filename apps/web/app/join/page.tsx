import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";
import { JOIN_COPY } from "./_content";
import { JoinForm } from "./form";

/**
 * THE PAGE SOMEBODY WHO IS NOT A CUSTOMER LANDS ON.
 *
 * NOT INDEXED, and here that is not a formality: the URL carries a bearer token, and a crawler that
 * reached one would publish a working invitation to somebody else's business account.
 *
 * ALWAYS RENDERED PER REQUEST, because the token is in the request. A cached render is a cached
 * credential.
 *
 * IT DOES NOT REQUIRE A SESSION TO RENDER. The person arriving may have no account at all, and a
 * redirect to sign-in before they have read what they are being asked to join tells them nothing
 * about what they are agreeing to. The action sends them to sign in when they press the button.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: JOIN_COPY.eyebrow,
  description: JOIN_COPY.lead,
  robots: { index: false, follow: false },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).token;
  // A repeated parameter arrives as an array. Taking the first would be a guess about which one the
  // sender meant, so a malformed address carries no invitation at all.
  const token = typeof raw === "string" ? raw : "";

  return (
    <>
      <SiteHeader />

      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[640px] px-8 py-12 md:py-16">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {JOIN_COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.035em] md:text-[38px]">
            {JOIN_COPY.heading}
          </h1>
          <p className="text-ink-muted mt-4 leading-[1.65]">{JOIN_COPY.lead}</p>

          <div className="mt-8">
            {token === "" ? (
              <p className="text-ink text-sm leading-[1.6]">{JOIN_COPY.noToken}</p>
            ) : (
              <JoinForm token={token} />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
