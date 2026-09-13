"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServer } from "../_auth/server";
import { type Interval, type Plan, priceIdFor } from "./plans";
import { stripeClient } from "./stripe";

/**
 * CHECKOUT AND THE CUSTOMER PORTAL.
 *
 * Neither writes billing state. Checkout creates a Stripe session and sends the customer there;
 * the webhook writes what comes back. That separation is why a customer who closes the tab
 * mid-payment leaves nothing half-written behind -- there is no local "pending subscription" row
 * to reconcile, because this app never invents one.
 *
 * THE PORTAL IS STRIPE'S, ON PURPOSE. Payment methods, invoice history, VAT numbers, cancellation
 * and dunning are all things Stripe already does correctly and that a hand-built version would do
 * worse and then have to maintain against card-network rules. The only thing worth building here
 * is the decision of WHICH customer's portal to open, and the membership check that guards it.
 */

async function originOf(): Promise<string> {
  const header = await headers();
  return header.get("origin") ?? `https://${header.get("host") ?? ""}`;
}

/**
 * The organisation the signed-in user belongs to, read through RLS.
 *
 * No `.eq("user_id", …)`. `organisations_select` resolves through `app.is_org_member`, so this
 * returns exactly the organisations this session belongs to and the membership check IS the query.
 * A filter here would be a second place the same decision is made.
 */
async function currentOrganisation(): Promise<{ id: string; name: string } | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("organisations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1);
  const first = data?.[0];
  return first ? { id: first.id as string, name: first.name as string } : null;
}

export async function startCheckout(plan: Plan, interval: Interval): Promise<never> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Fbilling");

  const organisation = await currentOrganisation();
  if (!organisation) redirect("/welcome");

  const origin = await originOf();
  const stripe = stripeClient();

  // An existing customer is reused so a returning buyer keeps one billing history and one set of
  // saved cards. Read through RLS, so it is this organisation's or nothing.
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    success_url: `${origin}/billing?checkout=done`,
    cancel_url: `${origin}/billing?checkout=cancelled`,

    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id as string }
      : { customer_email: user.email ?? undefined }),

    // THE TENANT, CARRIED ON BOTH OBJECTS. The webhook reads organisation_id from here and trusts
    // nothing else in the payload to say which tenant an event is about. It is set on the
    // subscription as well as the session because later subscription events do not carry the
    // session's metadata.
    metadata: { organisation_id: organisation.id },
    subscription_data: { metadata: { organisation_id: organisation.id } },

    // Stripe collects and remits where it must, and produces the invoice. Building either here
    // would be re-implementing tax law and a PDF renderer.
    automatic_tax: { enabled: true },
    customer_update: existing?.stripe_customer_id ? { address: "auto" } : undefined,
    billing_address_collection: "required",
    allow_promotion_codes: true,
  });

  if (!session.url) redirect("/billing?checkout=failed");
  redirect(session.url as Parameters<typeof redirect>[0]);
}

export async function openBillingPortal(): Promise<never> {
  const supabase = await supabaseServer();
  const organisation = await currentOrganisation();
  if (!organisation) redirect("/signin?next=%2Fbilling");

  const { data } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  const customer = data?.stripe_customer_id as string | undefined;
  // Nothing has ever been bought, so there is no portal to open. Sending them to the plans is the
  // useful answer; a Stripe error page is not.
  if (!customer) redirect("/billing?portal=none");

  const session = await stripeClient().billingPortal.sessions.create({
    customer,
    return_url: `${await originOf()}/billing`,
  });
  redirect(session.url as Parameters<typeof redirect>[0]);
}

/**
 * CANCELLING, WITHOUT DEPENDING ON A SETTING NOBODY IN THIS REPOSITORY CAN SEE.
 *
 * The portal above already offers cancellation -- IF the Stripe dashboard's portal configuration
 * has it switched on, and whether it does is not knowable from this codebase. A customer who has
 * decided to leave and finds no cancel button in the portal has been given a runaround by a
 * checkbox nobody here can read.
 *
 * So this asks Stripe directly. `cancel_at_period_end` needs no portal configuration at all, and
 * the webhook already handles `customer.subscription.updated`, which is exactly what this produces
 * -- so the row's `cancel_at_period_end` and `current_period_end` are written by the same path that
 * writes every other billing fact. NOTHING HERE WRITES THE DATABASE. This app has one billing
 * writer and it is the webhook; a second one is how two truths about the same subscription start
 * disagreeing.
 *
 * AT PERIOD END, NEVER IMMEDIATELY. An immediate cancellation takes away service the customer has
 * already paid for, and Stripe's proration would then owe them money this product has no path to
 * return. They keep what they bought until it runs out.
 *
 * AND THE DATE IS NEVER COMPUTED. `/billing` prints the stop date from `current_period_end` as
 * Stripe reported it. Adding a month to something here would be exactly the guess wearing the
 * costume of a fact that CLAUDE.md bans -- and it would be wrong for every customer whose billing
 * anniversary is not today.
 */
export async function cancelSubscription(): Promise<never> {
  const supabase = await supabaseServer();
  const organisation = await currentOrganisation();
  if (!organisation) redirect("/signin?next=%2Fbilling");

  // ADMIN OR OWNER, decided by the database rather than here: `subscriptions` is readable through
  // RLS only for a member, and the row this finds is by definition this organisation's.
  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status, cancel_at_period_end")
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  const id = data?.stripe_subscription_id as string | undefined;
  if (!id) redirect("/billing?cancel=none");

  // ALREADY CANCELLING IS NOT AN ERROR AND NOT A NO-OP TO HIDE. Saying so is the difference between
  // a customer believing it worked the first time and a customer pressing it again tomorrow.
  if (data?.cancel_at_period_end === true) redirect("/billing?cancel=already");

  try {
    await stripeClient().subscriptions.update(id, { cancel_at_period_end: true });
  } catch {
    // The upstream message is not surfaced: it names a Stripe object and an API version, and a
    // customer trying to stop paying is not the right reader for either.
    redirect("/billing?cancel=failed");
  }

  // The webhook writes the row. This returns to a page that reads it, so what the customer sees
  // next is the synced state rather than this action's optimism about it.
  redirect("/billing?cancel=requested");
}

/**
 * Undoing it, before the period runs out.
 *
 * WORTH BUILDING AT THE SAME TIME rather than later: a cancel button with no way back makes the
 * decision feel irreversible when it is not, and the customer most likely to press it is the one
 * having a bad month. Between pressing cancel and the period ending, nothing has been lost.
 */
export async function resumeSubscription(): Promise<never> {
  const supabase = await supabaseServer();
  const organisation = await currentOrganisation();
  if (!organisation) redirect("/signin?next=%2Fbilling");

  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, cancel_at_period_end")
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  const id = data?.stripe_subscription_id as string | undefined;
  if (!id) redirect("/billing?cancel=none");
  if (data?.cancel_at_period_end !== true) redirect("/billing?resume=nothing");

  try {
    await stripeClient().subscriptions.update(id, { cancel_at_period_end: false });
  } catch {
    redirect("/billing?resume=failed");
  }

  redirect("/billing?resume=requested");
}
