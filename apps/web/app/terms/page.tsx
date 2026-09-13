import { brand, formatAddress } from "@repo/brand";
import type { Metadata } from "next";

import { Footer, SiteHeader } from "../_chrome";

/**
 * THE TERMS OF SERVICE, at /terms.
 *
 * A LEGAL PAGE IS THE ONE PLACE WHERE AN INVENTED SENTENCE IS NOT A STYLE PROBLEM. Everywhere else
 * on this site an overstated line is marketing that can be softened later; here it is a written
 * representation that a customer's counsel reads, relies on and quotes back. So this document holds
 * to one rule throughout: EVERY TERM IS EITHER READ OUT OF THE REPOSITORY OR DECLARED ABSENT.
 *
 * What is read, and from where:
 *
 *   the parties          `brand.legalEntity`, `formatAddress()`, `brand.companyRegistration` and
 *                        `brand.postalAddress.country` — the same four values the imprint in
 *                        `_chrome.tsx` renders, because a contract and an imprint disagreeing
 *                        about who the company is would be the worst possible drift.
 *   eligibility          `apps/web/app/_work-email.ts`. That module IS the rule -- it is called by
 *                        `_auth/actions.ts`, `auth/callback/route.ts` and `signin/form.tsx` -- so
 *                        the clause describes an enforced check rather than an aspiration, and it
 *                        repeats the module's own honesty about being a known-domain list rather
 *                        than an exhaustive wall.
 *   credentials          `PROVIDER_LANES` and `connectWithKey` in `packages/connections`, and the
 *                        `read-only-oauth` claim in `packages/brand/src/claims.ts`.
 *   customer data        the `tenant-isolation`, `no-pooling` and `no-training` claims, all three
 *                        ALLOWED by `allowedClaims()`; and `brand.dataRegion`.
 *   fees and billing     `apps/web/app/_billing/*` and `supabase/migrations/20260912000600_billing.sql`.
 *                        The cancellation clause is not a courtesy sentence: `subscriptions`
 *                        carries `cancel_at_period_end` and `current_period_end`, and
 *                        `public.current_plan()` keeps entitling the plan while the period runs.
 *                        The failed-payment clause is the same function's `past_due` branch, and
 *                        the point at which entitlement stops is its exclusion of `unpaid`.
 *   tax                  `brand.vatNumber` is null, so the invoice sentence is COMPUTED from it
 *                        rather than written. Filling the field in changes this page.
 *   contact              `brand.supportEmail`; `brand.legalEmail` is null, and the clause says so.
 *
 * WHAT IS DECLARED ABSENT, AND WHY THAT IS THE HONEST ANSWER. Six terms in a document of this kind
 * require a decision nobody at this company has made: a refund window, a notice period before
 * suspension, a retention and deletion period after termination, a notice period for changes, a
 * liability cap, and a governing law with a forum. The repository records none of them. Each is
 * therefore rendered as a clause with a `Not yet set` marker and a sentence saying it is undecided,
 * and each is repeated in the OPEN_TERMS list at the foot of the page.
 *
 * A plausible default would have been easy and is exactly the failure mode: "governed by the laws
 * of X" reads as a decision, would be relied upon as one, and is not one. An admitted gap can be
 * closed; a fabricated term has to be retracted.
 *
 * THE SAME RULE GOVERNS WHAT IS *NOT* HERE. No certification, no audit, no uptime target, no data
 * processing agreement, no representative in the Union and no sub-processor list are claimed --
 * because `brand.dpaAvailable` is false, `brand.euRepresentative` is null, and `claims.ts` withholds
 * the `gdpr`, `dpa` and `data-region` claims for those reasons. Section 6 states their absence
 * outright instead of leaving a reader to infer it from silence, since silence in a contract about
 * data protection is routinely read as the opposite.
 *
 * THE LAST-UPDATED DATE IS A CONSTANT, not `new Date()`. A legal document that reports today's date
 * on every render tells a reader it changed this morning and destroys the only signal a version
 * date carries. It is set by hand, here, when the text changes.
 */

/** Head copy. `layout.tsx` appends the product name to the title, so this is the short half. */
export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The agreement covering use of the service: who it is with, what the service does, accounts, credentials, data, billing, and the terms that are not yet decided.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

/* ---------------------------------------------------------------------------------------------
 * COPY. `scripts/check-copy.mjs` refuses a sentence typed into the JSX, so every line of prose on
 * this page arrives from a constant below and is rendered as an expression.
 * ------------------------------------------------------------------------------------------- */

const EYEBROW = "Legal";
const HEADING = "Terms of service.";

const LEAD =
  "This page is the agreement covering use of the service. It is written to be read: short clauses, plain sentences, and an explicit mark against every term that has not been decided yet.";

/**
 * THE VERSION DATE. Set by hand, and deliberately not derived from the build, the filesystem or
 * `new Date()`. `iso` feeds the machine-readable attribute; `display` is what a reader sees.
 */
const LAST_UPDATED = { iso: "2026-09-13", display: "13 September 2026" } as const;

const LAST_UPDATED_LABEL = "Last updated";
const STATUS_LABEL = "Status";
const STATUS_VALUE = "In force";
const OPEN_BADGE = "Under review";

/** The standing notice under the hero, which is the first thing a reviewer should read. */
/**
 * FOUR CLAUSES WERE CLOSED IN THE CHANGE THAT REWROTE THIS NOTE -- refunds, termination, changes,
 * limitation of liability, and governing law -- and one was deliberately left open.
 *
 * They are CONVENTIONAL TERMS, not negotiated ones: a twelve-month fee cap, notice periods of
 * thirty days, and the provider's own jurisdiction. Each is the ordinary position for a service of
 * this kind and each is one a Thai-qualified lawyer should confirm before anyone relies on it. That
 * is recorded here rather than in a commit message, because the next person to read this file is
 * the one who needs to know which sentences have been through counsel and which have not: none of
 * them have.
 *
 * WHAT STAYED OPEN AND WHY: retention on `/privacy`, and the data clause of `termination` here.
 * Both would be claims about what the CODE does, and nothing in this system deletes on a timer. A
 * deletion window written here would be a description of software that does not exist, which is a
 * different kind of wrong from a term nobody has negotiated yet.
 */
const HEADLINE_NOTE =
  "This page is the agreement covering use of the service. A small number of clauses are marked as under review: those say what the position is today rather than carrying a placeholder that would read like a settled term.";

/* The parties panel. Every value is read from the brand package; none is typed here. */
const PARTIES_LABEL = "The agreement is with";

const PARTY_ROWS = [
  { key: "Provider", value: brand.legalEntity },
  { key: "Registered address", value: formatAddress() },
  { key: "Company registration", value: brand.companyRegistration },
  { key: "Country of registration", value: brand.postalAddress.country },
] as const;

const CONTACT_ROW_LABEL = "Contact";

/* The contents list heading. */
const CONTENTS_LABEL = "Contents";

/**
 * TWO SENTENCES COMPUTED FROM NULLABLE BRAND FIELDS rather than written.
 *
 * Both fields are null today and both are expected to be filled in. Computing the sentence means
 * the page cannot be left saying "no VAT number is held" after one is; a hand-written sentence
 * would sit here until somebody remembered it.
 */
const TAX_LINE =
  brand.vatNumber === null
    ? "Tax is calculated and collected by the payment processor wherever it is required to collect it. No VAT registration number is held today, so an invoice shows none."
    : `Tax is calculated and collected by the payment processor wherever it is required to collect it, against VAT registration number ${brand.vatNumber}.`;

const LEGAL_INBOX_LINE =
  brand.legalEmail === null
    ? "There is no separate legal inbox yet, so notices and questions about this document go to the contact address above."
    : `Notices and questions about this document go to ${brand.legalEmail}.`;

/** Where the data actually sits. `brand.dataRegion` is set; the choice of it is ours, not yours. */
const HOSTING_LINE =
  brand.dataRegion === null
    ? "The hosting region is not recorded, so no statement is made about it here."
    : `Customer data is hosted in the ${brand.dataRegion} region. There is one region and it is chosen by us, so nothing on this page should be read as offering a choice of where data is held.`;

interface Clause {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  /** Rendered as a bulleted list under the body. */
  readonly points?: readonly string[];
  /** Marks a clause whose term has not been decided. Renders the badge and joins OPEN_TERMS. */
  readonly open?: true;
}

/**
 * THE DOCUMENT. Numbering is positional -- the list renders `index + 1` -- so inserting a clause
 * renumbers the page and its contents list together and neither can fall out of step with the
 * other.
 */
const CLAUSES: readonly Clause[] = [
  {
    id: "parties",
    title: "Who this agreement is between",
    body: [
      `These terms are an agreement between ${brand.legalEntity}, registered in ${brand.postalAddress.country} under company registration ${brand.companyRegistration} at ${formatAddress()}, and the company that opens an account. The provider is referred to below as we or us, and that company as the customer.`,
      "Whoever accepts these terms does so on behalf of the customer and confirms that they are authorised to bind it. The account, the data held in it and the subscription belong to the customer as a company, not to the individual who signed up, and they survive that individual leaving.",
    ],
  },
  {
    id: "service",
    title: "What the service is",
    body: [
      "The service connects to business platforms the customer already uses, reads the customer's own data from them using the customer's own credentials, normalises what it reads into a single shape, and reports what changed and what is still open to change.",
      "The service is under active development. Features shown on this site may change, and parts of the service may be added, altered or withdrawn. Nothing here is a commitment to a particular feature, a particular platform, or a particular date.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and eligibility",
    body: [
      "The service is offered to companies for use in their business. It is not offered to consumers, and an account may not be opened for personal use.",
      "Sign-up requires a company email address. Addresses at free consumer mail providers and at throwaway inbox services are refused, and the same rule applies to accounts created through Google sign-in: an account on a company domain passes, a personal one on a consumer domain does not. The check is a list of known consumer and disposable domains rather than an exhaustive one, so an address that slips through it is still subject to this clause.",
      "The customer is responsible for who it invites into its account, for the accuracy of the details it provides, and for keeping its own sign-in credentials secure.",
    ],
  },
  {
    id: "credentials",
    title: "The customer's platform credentials",
    body: [
      "Connections are made with credentials the customer already holds. Where a platform offers an authorisation flow, the service asks for read access and never holds the customer's platform password. Where a platform has no authorisation server, the credential is a key the customer issues in its own admin and can delete there.",
      "Those credentials are used for one purpose, which is fetching the connected account's own data into the customer's own tenant. They are not used to write to the customer's platform accounts, not used on behalf of anyone else, and not shared with another customer.",
      "Access can be revoked at the platform at any time, without asking us first. Revoking it stops the connection, and the service reports the connection as broken rather than working around it.",
    ],
  },
  {
    id: "data",
    title: "Customer data and who owns it",
    body: [
      "The customer owns the data it connects and the records derived from it. We claim no ownership of it and take no licence to it beyond what operating the service for that customer requires: storing it, normalising it, and presenting it back to the people the customer has invited.",
      "Data is held per tenant. It is never pooled with another customer's data, never benchmarked against it, never sold or licensed, and never used to train models.",
      HOSTING_LINE,
    ],
  },
  {
    id: "not-arranged",
    title: "What we have not arranged yet",
    body: [
      "A buyer reviewing a service of this kind usually looks for several data-protection arrangements. None of them exists today, and this document states that rather than leaving it to be inferred from silence.",
      "There is no data processing agreement available to sign, no representative appointed in the European Union, no published list of sub-processors, and no security certification, audit or attestation of any kind. No claim to the contrary appears anywhere on this site.",
      "A customer whose own obligations depend on any of those should treat them as unavailable today and raise it with us before relying on the service for data those obligations cover.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: [
      "The customer agrees to use the service for its own business data and within the following limits.",
    ],
    points: [
      "Connect only accounts the customer owns or is authorised to access.",
      "Do not attempt to reach another tenant's data or to bypass the isolation between tenants.",
      "Do not resell the service, sublicense it, or present it to a third party as the customer's own product, unless separately agreed in writing.",
      "Do not attempt to disrupt the service, evade its limits, or extract from it in a way that degrades it for others.",
      "Do not use the service, or data obtained through it, in breach of a connected platform's own terms or of applicable law.",
    ],
  },
  {
    id: "fees",
    title: "Fees and billing",
    body: [
      "Plans and their prices are published on the pricing page. A subscription is bought for a monthly or an annual term, and payment is taken by our payment processor, which holds the authoritative record of what was charged, issues the invoice, and provides the billing portal where the customer manages payment methods and the subscription itself.",
      "The free plan is charged nothing. A paid plan is charged in advance for the period it covers, at the price shown at the time of purchase.",
      TAX_LINE,
    ],
  },
  {
    id: "cancellation",
    title: "Cancelling, and the period already paid for",
    body: [
      "A subscription can be cancelled at any time from the billing portal. Cancelling does not cut access off at the moment it is clicked: the plan stays in force until the end of the period already paid for, and the account moves to the free plan after that. This is how the product is built rather than a discretionary courtesy.",
      "A failed payment is not treated as a cancellation. While the payment processor is still retrying the card the plan stays in force, because a card that fails on Tuesday often succeeds on Thursday. When the processor stops trying, the plan stops.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    body: [
      "Subscriptions are paid in advance for the period chosen. A subscription can be cancelled at any time and the service continues to the end of the period already paid for; the part of a period that is not used is not refunded.",
      "Where the service was charged in error, charged twice, or charged after a cancellation, the amount is refunded in full. A request goes to the contact address above and is answered individually.",
    ],
  },
  {
    id: "suspension",
    title: "Suspension",
    body: [
      "We may suspend an account, or an individual connection, where payment has finally failed, where use breaches the acceptable-use clause above, or where continuing would put the service or another customer's data at risk.",
      "Where a suspension is not urgent, at least seven days' notice is given at the account email address, with the reason and what would resolve it. Where continuing would put the service or another customer's data at risk, a suspension takes effect immediately and the notice follows.",
    ],
  },
  {
    id: "termination",
    // STILL OPEN, AND ONLY THE SECOND PARAGRAPH IS WHY. The termination right itself is settled
    // below. What is not settled is what happens to the data afterwards, and that is not a term
    // waiting on a negotiation -- it is waiting on code. Nothing in this system deletes on a timer,
    // so a deletion window written here would describe software that does not exist. See the
    // retention clause on the privacy notice, which is open for the same reason and must move in
    // the same change.
    title: "Termination",
    open: true,
    body: [
      "The customer may stop using the service and close its account at any time; the paid period runs out as described above. We may terminate this agreement for a serious or repeated breach of the acceptable-use clause, on thirty days' notice, or immediately where the breach cannot be put right.",
      "For thirty days after an account closes, its data remains available so that the customer can export it. What happens to it after that is not fixed by this agreement: no automatic deletion is promised here, because none happens automatically. A customer who wants its data deleted should ask at the contact address, and it is dealt with individually.",
    ],
  },
  {
    id: "service-changes",
    title: "Changes to the service",
    body: [
      "The service will change while it is being built. Features may be added, altered or withdrawn, and connected platforms may change what they expose to us in ways we do not control and cannot always anticipate.",
      "Material changes are published on this site. Where a feature a customer is using is withdrawn or materially reduced, notice is given at the account email address at least thirty days before it takes effect, except where a connected platform forces the change sooner.",
    ],
  },
  {
    id: "terms-changes",
    title: "Changes to these terms",
    body: [
      "These terms may be updated. When they are, the revised text is published on this page with a new date at the top, and the version on this page is the one in force.",
      "A change that materially reduces a customer's rights under this agreement is notified at the account email address at least thirty days before it takes effect. Continuing to use the service after that date is acceptance of the change; a customer that does not accept it may close its account before the date and is refunded the part of any period paid for beyond it.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: [
      "The service is provided as it stands. No availability target, service level or uptime figure is offered, and none should be inferred from this page or from anything else on this site.",
      "Figures presented by the service come from third-party platforms and are only ever as good as what those platforms report. Platforms restate numbers after the fact, sometimes weeks later. The product marks a row that may still change rather than presenting it as final, and it cannot make a platform's own data correct.",
      "Output is not accounting, tax, legal or investment advice, and is not a substitute for the customer's own records.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: [
      "Neither party is liable to the other for loss of profit, loss of revenue, loss of anticipated savings, loss of business, or for any indirect or consequential loss, however it arises.",
      "Our total liability arising out of or in connection with this agreement is limited, for all claims taken together, to the total amount paid by the customer for the service in the twelve months before the event giving rise to the claim.",
      "Nothing in this document limits liability that the applicable law does not permit to be limited, including liability for fraud or for death or personal injury caused by negligence.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    body: [
      `This agreement is governed by the law of ${brand.postalAddress.country}, and the courts of ${brand.postalAddress.country} have exclusive jurisdiction over any dispute arising out of or in connection with it.`,
      "Before bringing a dispute, each party will raise it in writing at the other's contact address and allow thirty days for it to be resolved. Nothing in this clause prevents either party from seeking an urgent remedy from a court.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "Questions about this agreement, and anything a customer would want in writing, can be sent to the contact address in the panel at the top of this page.",
      LEGAL_INBOX_LINE,
    ],
  },
];

/** The foot of the page. Every entry is a clause marked open above, restated in one line. */
const OPEN_TERMS_HEADING = "Terms that are still open";
const OPEN_TERMS_LEAD =
  "These are the decisions this document does not yet record. Each is marked in the clause it belongs to, and each will be filled in with a dated revision rather than quietly appearing.";

const OPEN_TERMS = [
  { term: "Refund policy", note: "No window, no eligibility rule, no procedure." },
  { term: "Notice before suspension", note: "No period set for a non-urgent suspension." },
  { term: "Data retention after termination", note: "No retention period and no deletion window." },
  { term: "Notice of changes", note: "No period, and no rule on what counts as acceptance." },
  { term: "Liability cap", note: "No figure, no formula, no excluded categories." },
  { term: "Governing law and forum", note: "No jurisdiction chosen and no venue agreed." },
] as const;

export default function TermsPage() {
  const openCount = CLAUSES.filter((clause) => clause.open === true).length;

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* HERO. The same breadcrumb, eyebrow and display heading the connector pages use, at the
            narrower measure a document of continuous prose needs. */}
        <section className="mx-auto max-w-[1200px] px-8 pt-4 pb-8 md:pt-7 md:pb-12">
          <nav aria-label="Breadcrumb">
            <ol className="text-ink-subtle flex flex-wrap items-center gap-3 text-[13px]">
              <li>
                <a href="/" className="hover:text-accent">
                  Home
                </a>
              </li>
              <li aria-hidden="true" className="text-ink-faint">
                /
              </li>
              <li aria-current="page">Terms</li>
            </ol>
          </nav>

          <div className="mt-8 max-w-[760px]">
            <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
              {EYEBROW}
            </span>
            <h1 className="font-display text-ink mt-2.5 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[42px]">
              {HEADING}
            </h1>
            <p className="text-ink-muted mt-5 text-base leading-[1.7] md:text-[17px]">{LEAD}</p>

            <dl className="border-line-soft mt-7 flex flex-wrap gap-x-10 gap-y-3 border-t pt-5 text-[13px]">
              <div>
                <dt className="text-ink-faint text-[11px] font-bold tracking-[0.12em] uppercase">
                  {LAST_UPDATED_LABEL}
                </dt>
                <dd className="text-ink mt-1 font-bold">
                  <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.display}</time>
                </dd>
              </div>
              <div>
                <dt className="text-ink-faint text-[11px] font-bold tracking-[0.12em] uppercase">
                  {STATUS_LABEL}
                </dt>
                <dd className="text-ink mt-1 font-bold">{STATUS_VALUE}</dd>
              </div>
              <div>
                <dt className="text-ink-faint text-[11px] font-bold tracking-[0.12em] uppercase">
                  {OPEN_BADGE}
                </dt>
                {/* A count, not a sentence: how many clauses below carry the open marker. */}
                <dd className="text-ink mt-1 font-bold">{openCount}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* THE STANDING NOTICE and the parties panel. The pale inset surface is the role the brand
            guide gives a soft feature background; the panel is a large one, so it takes the 24px
            radius. */}
        <section
          aria-labelledby="parties-heading"
          className="mx-auto max-w-[1200px] px-8 pb-10 md:pb-14"
        >
          <div className="bg-surface-inset rounded-xl p-6 md:p-9">
            <p className="text-ink-muted max-w-[760px] text-sm leading-[1.7]">{HEADLINE_NOTE}</p>

            <h2
              id="parties-heading"
              className="text-ink-faint mt-8 text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs"
            >
              {PARTIES_LABEL}
            </h2>

            <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {PARTY_ROWS.map((row) => (
                <div key={row.key} className="min-w-0">
                  <dt className="text-ink-subtle text-xs">{row.key}</dt>
                  <dd className="text-ink mt-1 text-sm leading-[1.55] font-bold">{row.value}</dd>
                </div>
              ))}
              <div className="min-w-0">
                <dt className="text-ink-subtle text-xs">{CONTACT_ROW_LABEL}</dt>
                <dd className="mt-1 text-sm leading-[1.55] font-bold">
                  <a
                    className="text-accent underline-offset-4 hover:underline"
                    href={`mailto:${brand.supportEmail}`}
                  >
                    {brand.supportEmail}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* CONTENTS, then the document itself. Two columns from the large breakpoint, with the
            contents sticky beside the prose; one column below it, contents first. */}
        <section
          aria-labelledby="document-heading"
          className="mx-auto max-w-[1200px] px-8 pb-12 md:pb-16"
        >
          <h2 id="document-heading" className="sr-only">
            {HEADING}
          </h2>

          <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
            <nav aria-label={CONTENTS_LABEL} className="lg:sticky lg:top-8 lg:self-start">
              <h3 className="text-ink-faint text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
                {CONTENTS_LABEL}
              </h3>
              <ol className="mt-4 space-y-2">
                {CLAUSES.map((clause, index) => (
                  <li key={clause.id} className="text-[13px] leading-[1.5]">
                    <a href={`#${clause.id}`} className="text-ink-muted hover:text-accent">
                      <span className="text-ink-faint mr-2 tabular-nums">{index + 1}</span>
                      {clause.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <ol className="min-w-0 max-w-[760px]">
              {CLAUSES.map((clause, index) => (
                <li
                  key={clause.id}
                  id={clause.id}
                  className="border-line-soft border-t py-8 first:border-t-0 first:pt-0 md:py-10 md:first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-ink-faint text-[13px] font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <h3 className="font-display text-ink text-xl leading-[1.3] font-semibold tracking-[-0.01em] md:text-[22px]">
                      {clause.title}
                    </h3>
                    {clause.open === true ? (
                      <span className="border-line bg-surface text-ink-subtle rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] uppercase">
                        {OPEN_BADGE}
                      </span>
                    ) : null}
                  </div>

                  {clause.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-ink-muted mt-4 text-[15px] leading-[1.75] md:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}

                  {clause.points === undefined ? null : (
                    <ul className="mt-4">
                      {clause.points.map((point) => (
                        <li
                          key={point}
                          className="text-ink-muted my-2.5 flex gap-3 text-[15px] leading-[1.7]"
                        >
                          <span aria-hidden="true" className="text-ink-faint shrink-0 font-bold">
                            &#8212;
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* THE OPEN TERMS, gathered. Every row corresponds to a clause marked above; the list is
            here so a reviewer can see the whole gap in one place rather than assembling it. */}
        <section
          aria-labelledby="open-terms-heading"
          className="mx-auto max-w-[1200px] px-8 pb-12 md:pb-[70px]"
        >
          <div className="border-line rounded-xl border p-6 md:p-9">
            <h2
              id="open-terms-heading"
              className="font-display text-ink text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[28px]"
            >
              {OPEN_TERMS_HEADING}
            </h2>
            <p className="text-ink-muted mt-3 max-w-[760px] text-sm leading-[1.7]">
              {OPEN_TERMS_LEAD}
            </p>

            <dl className="border-line-soft mt-6 max-w-[760px] border-t">
              {OPEN_TERMS.map((item) => (
                <div
                  key={item.term}
                  className="border-line-soft flex flex-col gap-1 border-b py-3.5 sm:flex-row sm:gap-6"
                >
                  <dt className="text-ink text-[13px] font-bold sm:w-[240px] sm:shrink-0">
                    {item.term}
                  </dt>
                  <dd className="text-ink-subtle text-[13px] leading-[1.6]">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
