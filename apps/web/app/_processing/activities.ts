/**
 * THE RECORD OF PROCESSING ACTIVITIES, GENERATED FROM THE SCHEMA RATHER THAN WRITTEN ABOUT IT.
 *
 * PDPA s.39 requires a controller to keep one. `AGENTS.md` records that the small-business
 * exemption is **forfeited** here, and not marginally: the exemption turns on processing being
 * occasional, and the ingest runs on a nightly cron. So this is a standing obligation the company
 * has been in plain breach of, and it is also the single artefact a B2B buyer's data-protection
 * reviewer asks for beside the DPA. Both facts point the same way.
 *
 * WHY IT IS CODE AND NOT A DOCUMENT. A record of processing is a description of what a system does
 * with personal data. Written by hand it is accurate on the day it is signed and decays from the
 * next migration onwards -- and nobody notices, because nothing compares it to anything. The
 * failure mode is precise and familiar: a document that looks right, produced for an audience who
 * cannot check it, which is this repository's one rule stated in a different register.
 *
 * So every table in `public` must be accounted for here, and `activities.test.ts` reads the
 * migrations and asserts that in BOTH directions -- a table with no entry fails, an entry naming a
 * table that does not exist fails. A table that genuinely holds no personal data is declared in
 * `NO_PERSONAL_DATA` WITH A REASON, because "it isn't personal data" is a judgement and an
 * unexplained one rots exactly like a stale list.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED. No lawful basis is characterised as *established* -- the
 * `basis` field records the position this repository can support from its own behaviour, and
 * `AGENTS.md` books the legal determination under "needs a human". No retention period is invented:
 * `retention` is null wherever none is set, and the two places a period genuinely exists say so
 * exactly, including the one that is declared in code and does not run.
 */

/** Whether the company decides the purpose and means, or acts on a customer's instructions. */
export type Role = "controller" | "processor";

export interface ProcessingActivity {
  readonly id: string;
  /** What this processing is FOR, in one sentence a non-engineer can check against the product. */
  readonly purpose: string;
  readonly role: Role;
  /** Tables in `public` this activity accounts for. Every table must appear exactly once. */
  readonly tables: readonly string[];
  /** Whose personal data it is. */
  readonly subjects: string;
  /** What is actually held -- read off the columns, not off what the product is imagined to store. */
  readonly categories: string;
  /**
   * The position this repository can support from its own behaviour. NOT a legal determination:
   * whether it holds is a question for counsel, and nothing here claims it has been answered.
   */
  readonly basis: string;
  /** Sub-processors that receive it. Empty means it stays in the primary database. */
  readonly recipients: readonly string[];
  /**
   * The retention period, or null where none is set. NULL IS THE COMMON CASE AND IS THE POINT: an
   * invented period is a commitment the company is measured against.
   */
  readonly retention: string | null;
  /** Where in the repository this entry is checkable. */
  readonly evidence: string;
}

export const PROCESSING_ACTIVITIES: readonly ProcessingActivity[] = [
  {
    id: "account",
    purpose:
      "Running an account: who belongs to an organisation, which workspaces they may see, and inviting colleagues.",
    role: "controller",
    tables: ["organisations", "workspaces", "members", "workspace_members", "invitations"],
    subjects: "People who sign up, and people they invite.",
    categories:
      "An organisation and workspace name, a link to the sign-in identity, a role, and for an invitation the email address it was sent to. Two workspace columns can hold a customer's own client contact details as free text.",
    basis:
      "Necessary to provide the service the account holder asked for. The invitation address is processed to deliver the invitation and for no other purpose.",
    recipients: ["Supabase"],
    retention:
      "No period is set. An account can be erased ON REQUEST by its owner at /account, which removes the organisation and everything that cascades from it -- that is erasure on request and not a retention schedule, and the two are not interchangeable.",
    evidence:
      "supabase/migrations/20260908000200_tenancy.sql, 20260908000400_invitations.sql, 20260913000700_erasure.sql",
  },
  {
    id: "connections",
    purpose:
      "Holding the permission that lets the service read a customer's own platform account on their behalf.",
    role: "controller",
    tables: ["connections", "oauth_authorizations"],
    subjects: "The person who connects a platform account.",
    categories:
      "An account identifier at the platform, the scopes granted, and the credential itself -- sealed, and never readable by this application in plaintext.",
    basis:
      "Necessary to provide the service. The credential is held only to perform the reads the customer asked for.",
    recipients: ["Supabase"],
    retention:
      "A pending authorisation is deleted one hour after it is created, and again the moment it is redeemed. This is the only retention period in the schema that actually operates.",
    evidence:
      "supabase/migrations/20260908000500_connections.sql, 20260913000400_oauth_pending.sql",
  },
  {
    id: "platform-data",
    purpose:
      "Reading figures from a customer's connected platforms and normalising them into one shape so the service can report on them.",
    role: "processor",
    tables: ["envelope_rows", "restatement_events"],
    subjects:
      "Data subjects of the customer, not of this company -- the customer decides what their platform account contains.",
    categories:
      "Figures, dates, currencies and identifiers. The connectors are written to carry no buyer name, email, phone or address. One column holds a platform entity name typed by the customer, which can contain personal data if they put it there.",
    basis:
      "Processed on the customer's documented instruction. This company is a processor for this activity and does not decide its purpose.",
    recipients: ["Supabase", "Cloudflare"],
    retention:
      "None operates. A 30-day period is declared in code for restatement events and does not run: the scheduled job returns not_configured before reaching it.",
    evidence:
      "supabase/migrations/20260908001100_envelope_rows.sql, packages/connectors/src/sources/*/normalize.ts",
  },
  {
    id: "billing",
    purpose: "Taking payment for the service and knowing which plan an organisation is on.",
    role: "controller",
    tables: ["billing_customers", "subscriptions"],
    subjects: "The person who pays for an organisation.",
    categories:
      "A pointer to the record held by the payment processor, the plan, the interval and the period end. No card details reach this application at any point.",
    basis:
      "Necessary to perform the contract, and for the accounting records a business is required to keep.",
    recipients: ["Stripe", "Supabase"],
    retention: null,
    evidence: "supabase/migrations/20260912000600_billing.sql",
  },
  {
    id: "programmatic-access",
    purpose: "Letting a customer's own software read their workspace, and notifying it of changes.",
    role: "controller",
    tables: ["api_keys", "webhook_endpoints"],
    subjects: "The person who creates a key or an endpoint.",
    categories:
      "A key name, a hash of the key, a budget and usage counters, an endpoint address, and a link to the member who created it. The key itself is never stored.",
    basis: "Necessary to provide the service the account holder configured.",
    recipients: ["Supabase"],
    retention: null,
    evidence:
      "supabase/migrations/20260908000600_api_keys.sql, 20260908001200_webhook_delivery.sql",
  },
  {
    id: "data-requests",
    purpose:
      "Receiving and tracking a request from a person to see, correct, take, object to or delete their data.",
    role: "controller",
    tables: ["data_requests"],
    subjects: "Anyone who files a request from inside an account.",
    categories:
      "What was asked for, a link to the person who asked, a free-text note they wrote, and what was done about it.",
    basis:
      "Necessary to comply with a legal obligation. The record is kept because the obligation is to answer, and an unanswerable claim of having answered is worth nothing.",
    recipients: ["Supabase"],
    retention: null,
    evidence: "supabase/migrations/20260913001100_data_requests.sql",
  },
  {
    id: "security-trail",
    purpose:
      "Recording security-relevant acts -- a credential sealed, a connection attached or revoked, a role changed, a key minted -- so that an incident can be assessed and a customer can review their own account.",
    role: "controller",
    tables: ["security_events"],
    subjects: "People who administer an account.",
    categories:
      "What was done, a link to the person who did it, an opaque identifier for the thing it was done to, and a short non-secret note. No credential and no platform data reaches this table; the note column is bounded at 200 characters for that reason.",
    basis:
      "Necessary for the security of the service, and to make a breach assessment possible at all. The trail is append-only: no role holds UPDATE or DELETE on it, so it cannot be edited by the party it is evidence about.",
    recipients: ["Supabase"],
    retention: null,
    evidence: "supabase/migrations/20260913001200_security_events.sql",
  },
  {
    id: "ambient",
    purpose:
      "Knowing which workspaces asked to see public environmental readings alongside their own figures.",
    role: "controller",
    tables: ["ambient_subscriptions"],
    subjects:
      "Nobody directly. The row names a workspace and a station, and is personal data only through its link to the account.",
    categories: "A workspace, a source and a station identifier.",
    basis: "Necessary to provide a feature the account holder switched on.",
    recipients: ["Supabase"],
    retention: null,
    evidence: "supabase/migrations/20260912000900_ambient_readings.sql",
  },
  {
    id: "serving-the-site",
    purpose:
      "Serving this website and the screens an account signs in to, which is processing even though it stores nothing here.",
    role: "controller",
    // NO TABLE, AND THAT IS THE POINT. This entry was missing until the sub-processor guard asked
    // why Vercel was disclosed as a sub-processor while no activity named it. The record had been
    // built table-first, so processing that holds no row was invisible to it -- and serving a
    // signed-in page is processing: a request carries an address, a session and a path, and it
    // passes through a provider. A record of processing that can only see storage is a record of
    // storage.
    tables: [],
    subjects: "Anyone who visits the site, and anyone signed in to an account.",
    categories:
      "Request metadata handled in transit by the host -- an address, a session cookie, a path and a timestamp. Nothing is written to this company's own database by the act of serving a page.",
    basis:
      "Necessary to deliver the service at all. No analytics or advertising identifier is set by this site, so nothing here is processed for a purpose beyond serving the request.",
    recipients: ["Vercel"],
    retention:
      "Not set by this company. What the host keeps in its own request logs is the host's retention and is not stated here, because it was not established and a number written from memory would be a fact a customer's counsel relied on.",
    evidence: "apps/web/app/layout.tsx, apps/web/next.config.ts",
  },
  {
    id: "waiting-list",
    purpose:
      "A list of addresses collected before launch, to tell people when access opened. COLLECTION HAS ENDED.",
    role: "controller",
    tables: ["waitlist"],
    subjects: "People who asked to be told about the product before it launched.",
    categories: "An email address and the page it was submitted from.",
    basis:
      "Consent at the time of collection. The purpose it was collected for no longer exists as a feature, which is the condition that ends a retention basis -- so these rows are held with no current purpose and that is recorded here rather than glossed. Collection is closed in the schema and not merely in the interface: the write path was revoked from every role the internet can reach, so this entry's claim is enforced rather than asserted.",
    recipients: ["Supabase"],
    retention: null,
    evidence:
      "supabase/migrations/20260912000700_waitlist.sql, supabase/migrations/20260913001500_close_waitlist_collection.sql, supabase/tests/23_waitlist_closed.sql, apps/web/app/access/page.tsx",
  },
];

/**
 * Tables that hold no personal data, each with the reason.
 *
 * THE REASON IS REQUIRED. "Not personal data" is a judgement, and an unexplained judgement in a
 * compliance artefact is the thing an auditor asks about first and the thing that silently stops
 * being true when a column is added.
 */
export const NO_PERSONAL_DATA: readonly { readonly table: string; readonly why: string }[] = [
  {
    table: "ambient_readings",
    why: "Public environmental measurements from government monitoring stations. The table has no tenant column and no link to any person -- a station identifier, an instant, a parameter and a number.",
  },
];

/** Sub-processors named above, which must match the ones the privacy notice discloses. */
export const RECIPIENTS = ["Supabase", "Cloudflare", "Vercel", "Stripe"] as const;
