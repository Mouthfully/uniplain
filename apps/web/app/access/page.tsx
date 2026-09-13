import { brand } from "@repo/brand";
import type { Metadata } from "next";

import { SITE } from "../_content";
import { isGated } from "../_gate/token";

export const dynamic = "force-dynamic";

const COPY = {
  eyebrow: "Private access",
  lead: "This site is password protected. Enter the password to continue.",
  passwordLabel: "Password",
  passwordCta: "Enter",
  wrong: "That password is not right.",
  noPassword:
    "Access is arranged directly. If you need it, write to the address below and we will reply.",
} as const;

export const metadata: Metadata = {
  title: "Access",
  description: COPY.lead,
  // NOT INDEXED. The previous version of this page was the waiting-list door and was deliberately
  // indexable, because it was the one page a stranger could usefully reach. A password prompt is
  // not: indexing it invites traffic that can do nothing, and puts the door rather than the product
  // in front of anyone searching for the company.
  robots: { index: false, follow: false },
};

/**
 * THE DOOR.
 *
 * Every route redirects here until someone enters the password, which is what `isGated()` and the
 * middleware do between them.
 *
 * THIS PAGE USED TO BE `/waitlist` AND USED TO DO TWO JOBS. It carried a waiting-list form for
 * strangers alongside the password box, under the heading "Not open yet". The waiting list is gone
 * -- with it the form, the server action and the `join_waitlist` call -- because the product is no
 * longer collecting addresses against a future opening. What is left is the half that still has a
 * job: a password box for people who have been given a password.
 *
 * THE ROUTE WAS RENAMED WITH IT. `/waitlist` in the address bar announced a pre-launch product on
 * every redirect, before a visitor had read a word. `/access` describes what the page does.
 *
 * WHAT WAS NOT REMOVED: `public.waitlist` and `public.join_waitlist` are still in the schema. Any
 * address already submitted is still held, and dropping a table that may hold real sign-ups is a
 * destructive act that belongs to the founder, not to a copy change. `/privacy` therefore still
 * discloses that those addresses are held -- see the `former-waiting-list` clause. When the founder
 * confirms the table is empty or should be cleared, the migration and that clause go together.
 *
 * THE PASSWORD FORM IS A PLAIN POST to /api/gate, not a client component calling an action. It
 * therefore works with JavaScript disabled, and -- more to the point -- the password never enters
 * React state, a URL, or anything a browser extension reads off the page.
 */
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; wrong?: string }>;
}) {
  const { from, wrong } = await searchParams;
  // Only ever a path off this site. A full URL here would be an open redirect.
  const next = from && /^\/(?!\/)/.test(from) ? from : "/";

  return (
    <main id="main" className="bg-ground flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-8 py-16">
        <img src={brand.logoPath} alt={brand.productName} width={160} height={46} />

        <span className="text-ink-faint mt-12 block text-xs font-bold tracking-[0.14em] uppercase">
          {COPY.eyebrow}
        </span>
        <h1 className="font-display text-ink mt-3 text-[clamp(30px,4vw,44px)] leading-[1.06] font-semibold tracking-[-0.045em]">
          {SITE.heroLine1}
          <br />
          <span className="brand-gradient-text">{SITE.heroLine2}</span>
        </h1>
        <p className="text-ink-muted mt-4 leading-relaxed">{COPY.lead}</p>

        {/* `isGated()` is false when no password is configured, and then this page has nothing to
            offer -- so it shows the contact route instead of an input that would accept anything.
            A door with no lock must not look like a locked one. */}
        {isGated() ? (
          <div className="border-line bg-surface mt-8 rounded-xl border p-7">
            <form action="/api/gate" method="post" className="flex flex-wrap gap-3">
              <input type="hidden" name="from" value={next} />
              <input
                name="password"
                type="password"
                required
                aria-label={COPY.passwordLabel}
                autoComplete="current-password"
                className="border-line text-ink focus-visible:outline-accent min-h-[46px] min-w-[200px] flex-1 rounded-md border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-[3px]"
              />
              <button
                type="submit"
                className="bg-accent text-on-accent hover:bg-accent-hover min-h-[46px] rounded-md px-6 text-sm font-bold transition-colors"
              >
                {COPY.passwordCta}
              </button>
            </form>
            {wrong ? (
              <p role="alert" className="text-accent-hover mt-3 text-xs font-bold">
                {COPY.wrong}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-muted mt-8 text-sm leading-relaxed">{COPY.noPassword}</p>
        )}

        <p className="text-ink-faint mt-10 text-xs">
          {brand.legalEntity} &middot; {brand.companyRegistration}
        </p>
      </div>
    </main>
  );
}
