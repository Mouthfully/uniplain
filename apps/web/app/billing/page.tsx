import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthConfigured } from "../_auth/env";
import { currentUser, supabaseServer } from "../_auth/server";
import {
  cancelSubscription,
  openBillingPortal,
  resumeSubscription,
  startCheckout,
} from "../_billing/actions";
import {
  DEFAULT_CURRENCY,
  PLAN_DISPLAY,
  type Plan,
  asCurrency,
  formatAmount,
} from "../_billing/plans";
import { isBillingConfigured, stripeClient } from "../_billing/stripe";
import { Footer, SiteHeader } from "../_chrome";

export const dynamic = "force-dynamic";

const COPY = {
  eyebrow: "Billing",
  heading: "Your plan and invoices.",
  currentPlan: "Current plan",
  renews: "Renews",
  ends: "Access ends",
  cancelling: "Cancels at the end of this period",
  cancel: "Cancel at period end",
  resume: "Keep the subscription",

  // WHAT CAME BACK, IN ONE SENTENCE EACH. Every outcome of the two actions has its own, because
  // "something went wrong" over a cancellation is how a customer ends up cancelling twice or,
  // worse, believing they have when they have not.
  cancelRequested:
    "Stripe has been told to stop this subscription at the end of the period you have already paid for. The date above updates once the change comes back from them.",
  cancelAlready: "This subscription is already set to stop at the end of the period.",
  cancelNone: "There is no subscription to cancel.",
  cancelFailed:
    "Nothing was changed, and we could not tell you why. Try again, and tell us if it keeps happening.",
  resumeRequested: "Stripe has been told to keep this subscription running.",
  resumeNothing: "This subscription was not cancelling, so nothing changed.",
  resumeFailed:
    "Nothing was changed, and we could not tell you why. Try again, and tell us if it keeps happening.",
  managed: "Payment method, VAT details and cancellation are handled by our payment provider.",
  portal: "Manage billing",
  invoices: "Invoices",
  noInvoices: "No invoices yet. They appear here once a subscription starts.",
  notConfigured: "Billing is not configured on this deployment.",
  noOrganisation: "Create your organisation before choosing a plan.",
  perMonth: "per month",
  perYear: "per year, billed annually",
  choose: "Choose",
  currentLabel: "Your plan",
  invoicesFromStripe:
    "Invoice history is read from our payment provider, so it is never out of date.",
} as const;

export const metadata: Metadata = {
  title: "Billing",
  description: COPY.heading,
  robots: { index: false, follow: false },
};

/**
 * THE BILLING PAGE.
 *
 * INVOICES ARE READ FROM STRIPE ON EACH LOAD RATHER THAN STORED. A local invoices table would be a
 * second copy of a fact Stripe keeps changing -- a refund, a credit note, a tax correction, a
 * retried charge -- and the stale copy would be the one a customer quotes back. The cost is one API
 * call on a page nobody opens hourly; the benefit is that "paid" here always means what Stripe
 * means by it.
 *
 * THE PLAN, BY CONTRAST, IS READ LOCALLY, through `current_plan`. That question is asked on every
 * page load to decide what a tenant may do, and a gate that depends on a third party being
 * reachable either fails open or fails slow.
 */
/**
 * THE OUTCOME OF THE LAST ACTION, MAPPED TO A SENTENCE.
 *
 * The two billing actions redirect with a query parameter rather than returning state, because both
 * end in `redirect()` and a redirect carries no state. The parameter is NOT shown to anybody -- it
 * is matched against this table, and an unrecognised one produces nothing rather than being echoed
 * into the page, which is how a query string becomes a cross-site scripting hole.
 */
const NOTICES: Readonly<Record<string, string>> = {
  "cancel=requested": COPY.cancelRequested,
  "cancel=already": COPY.cancelAlready,
  "cancel=none": COPY.cancelNone,
  "cancel=failed": COPY.cancelFailed,
  "resume=requested": COPY.resumeRequested,
  "resume=nothing": COPY.resumeNothing,
  "resume=failed": COPY.resumeFailed,
};

function noticeFor(params: Record<string, string | string[] | undefined>): string | null {
  for (const key of ["cancel", "resume"]) {
    const value = params[key];
    // A repeated parameter arrives as an array, and picking one would be a guess about which the
    // sender meant. Neither is shown.
    if (typeof value !== "string") continue;
    const found = NOTICES[`${key}=${value}`];
    if (found !== undefined) return found;
  }
  return null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const notice = noticeFor(await searchParams);
  if (!isAuthConfigured()) redirect("/signin");
  const user = await currentUser();
  if (!user) redirect("/signin?next=%2Fbilling");

  const supabase = await supabaseServer();

  // Through RLS: exactly the organisations this session belongs to.
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1);
  const organisation = orgs?.[0];
  if (!organisation) redirect("/welcome");

  const { data: plan } = await supabase.rpc("current_plan", {
    p_organisation_id: organisation.id,
  });
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, billing_interval")
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  const activePlan = (plan as Plan | null) ?? "free";

  // The currency this organisation is already billed in, once it has a subscription: Stripe fixes
  // a customer's currency at their first one and it cannot change afterwards. Before that there is
  // nothing to be consistent with, so the default applies.
  const billingCurrency = asCurrency(
    (subscription as { currency?: string } | null)?.currency ?? DEFAULT_CURRENCY,
  );
  const invoices = await recentInvoices(organisation.id as string);

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-ground">
        <div className="mx-auto max-w-[900px] px-8 py-14">
          <span className="text-ink-faint block text-xs font-bold tracking-[0.14em] uppercase">
            {COPY.eyebrow}
          </span>
          <h1 className="font-display text-ink mt-3 text-[clamp(28px,3vw,38px)] leading-[1.1] font-semibold tracking-[-0.04em]">
            {COPY.heading}
          </h1>

          <section className="border-line bg-surface mt-8 rounded-xl border p-7">
            <p className="text-ink-subtle text-xs">{COPY.currentPlan}</p>
            <p className="font-display text-ink mt-1 text-2xl font-semibold">
              {PLAN_DISPLAY.find((p) => p.plan === activePlan)?.name ?? activePlan}
            </p>

            {subscription ? (
              <p className="text-ink-muted mt-2 text-sm">
                {subscription.cancel_at_period_end ? COPY.cancelling : COPY.renews}{" "}
                <time dateTime={String(subscription.current_period_end)}>
                  {formatDate(String(subscription.current_period_end))}
                </time>
              </p>
            ) : null}

            <p className="text-ink-subtle mt-4 text-xs leading-relaxed">{COPY.managed}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <form action={openBillingPortal}>
                <button
                  type="submit"
                  className="border-line text-ink hover:bg-surface-inset min-h-[44px] rounded-md border px-5 text-sm font-bold transition-colors"
                >
                  {COPY.portal}
                </button>
              </form>

              {/* CANCELLING DOES NOT GO THROUGH THE PORTAL, and the reason is in `actions.ts`:
                  whether the portal offers a cancel button depends on a Stripe dashboard setting
                  nobody in this repository can read. A customer who has decided to leave and finds
                  no button has been given a runaround by a checkbox. This asks Stripe directly.

                  Shown only when there is something to cancel, and swapped for the undo once it is
                  cancelling -- so the control always describes the state it would move to. */}
              {subscription && !subscription.cancel_at_period_end ? (
                <form action={cancelSubscription}>
                  <button
                    type="submit"
                    className="border-line text-ink hover:bg-surface-inset min-h-[44px] rounded-md border px-5 text-sm font-bold transition-colors"
                  >
                    {COPY.cancel}
                  </button>
                </form>
              ) : null}

              {subscription?.cancel_at_period_end ? (
                <form action={resumeSubscription}>
                  <button
                    type="submit"
                    className="border-line text-ink hover:bg-surface-inset min-h-[44px] rounded-md border px-5 text-sm font-bold transition-colors"
                  >
                    {COPY.resume}
                  </button>
                </form>
              ) : null}
            </div>

            {notice === null ? null : (
              <p role="status" className="text-ink mt-4 text-sm leading-[1.6]">
                {notice}
              </p>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-display text-ink text-lg font-semibold">Plans</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLAN_DISPLAY.map((entry) => (
                <li key={entry.plan} className="border-line bg-surface rounded-lg border p-5">
                  <p className="text-ink text-sm font-bold">{entry.name}</p>
                  <p className="font-display text-ink mt-1 text-2xl font-semibold tracking-[-0.03em]">
                    {formatAmount(entry.monthly[billingCurrency], billingCurrency)}
                  </p>
                  <p className="text-ink-subtle text-xs">{COPY.perMonth}</p>

                  {entry.plan === activePlan ? (
                    <p className="text-accent mt-4 text-xs font-bold">{COPY.currentLabel}</p>
                  ) : entry.plan === "free" ? null : (
                    <form
                      action={async () => {
                        "use server";
                        await startCheckout(entry.plan, "month");
                      }}
                      className="mt-4"
                    >
                      <button
                        type="submit"
                        className="bg-accent text-ink-on-accent hover:bg-accent-hover min-h-[40px] w-full rounded-md px-4 text-xs font-bold transition-colors"
                      >
                        {COPY.choose} {entry.name}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-ink text-lg font-semibold">{COPY.invoices}</h2>
            <p className="text-ink-subtle mt-1 text-xs">{COPY.invoicesFromStripe}</p>

            {invoices.length === 0 ? (
              <p className="border-line text-ink-muted mt-4 rounded-lg border border-dashed px-5 py-6 text-sm">
                {COPY.noInvoices}
              </p>
            ) : (
              <ul className="border-line bg-surface mt-4 divide-y rounded-lg border">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <time className="text-ink-muted text-sm" dateTime={invoice.date}>
                      {formatDate(invoice.date)}
                    </time>
                    <span className="text-ink flex-1 text-sm font-bold">{invoice.total}</span>
                    <span className="text-ink-subtle text-xs">{invoice.status}</span>
                    {invoice.url ? (
                      <a
                        href={invoice.url}
                        className="text-accent text-sm font-bold hover:underline"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        View
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

interface InvoiceRow {
  readonly id: string;
  readonly date: string;
  readonly total: string;
  readonly status: string;
  readonly url: string | null;
}

/**
 * The organisation's invoices, from Stripe.
 *
 * Returns an empty list rather than throwing when billing is unconfigured or Stripe is unreachable.
 * This section is history; the page's job is to show the plan, and losing the invoice list is not a
 * reason to fail the whole screen.
 */
async function recentInvoices(organisationId: string): Promise<InvoiceRow[]> {
  if (!isBillingConfigured()) return [];

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  const customer = data?.stripe_customer_id as string | undefined;
  if (!customer) return [];

  try {
    const list = await stripeClient().invoices.list({ customer, limit: 12 });
    return list.data.map((invoice) => ({
      id: invoice.id ?? invoice.number ?? String(invoice.created),
      date: new Date(invoice.created * 1000).toISOString(),
      // Stripe's amounts are in the currency's minor unit. Dividing by 100 is wrong for
      // zero-decimal currencies, so the formatter is given the currency and does it.
      total: formatMoney(invoice.total, invoice.currency),
      status: invoice.status ?? "unknown",
      url: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
    }));
  } catch {
    return [];
  }
}

function formatMoney(minorUnits: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  // `Intl` knows which currencies have no minor unit, so the scale comes from it rather than a
  // hard-coded 100 that is wrong for JPY, KRW and a dozen others.
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** digits);
}

/**
 * THE TIMEZONE IS NAMED, AND IT USED NOT TO BE.
 *
 * This read `new Intl.DateTimeFormat("en", { dateStyle: "medium" })` with no `timeZone`, which
 * resolves to whatever the RUNTIME is set to -- UTC on the deploy target, and something else on a
 * developer's machine. A subscription ending at 18:00 UTC is the following day in Asia/Bangkok, so
 * the date a customer was shown for "when does this stop" could be a day early, and would differ
 * between where it was tested and where it runs.
 *
 * CLAUDE.md names this exact defect: never default a unit, a window, a timezone or a currency,
 * because `coalesce(timezone, 'UTC')` is "a guess wearing the costume of a fact". The fix is not to
 * pick a better default -- there is no workspace timezone column to read, so any choice here would
 * be another guess. It is to say WHICH zone the date is in, so the customer can do the arithmetic
 * this code cannot do for them.
 */
const BILLING_ZONE = "UTC";

function formatDate(iso: string): string {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: BILLING_ZONE }).format(
    new Date(iso),
  )} ${BILLING_ZONE}`;
}
