import { brand } from "@repo/brand";

/**
 * EVERY HOST THIS PRODUCT'S CODE NAMES, AND WHAT EACH ONE IS.
 *
 * ================================================================================================
 * WHY THIS EXISTS: A SUB-PROCESSOR WAS RECEIVING DATA AND WAS DISCLOSED NOWHERE.
 * ================================================================================================
 *
 * `/privacy` said "Four providers process data on our behalf" and named Supabase, Cloudflare,
 * Vercel and Stripe. `SUB_PROCESSORS` held the same four, `/sub-processors` published them, the
 * Art. 30(1)(d) record generated from them and SCC Annex III listed them.
 *
 * **`apps/web/app/brief/actions.ts` was calling `openrouter.ai` the whole time** -- a shipped,
 * signed-in route sending a workspace's computed figures to a model router on a platform key.
 * OpenRouter appeared in no processing activity, in no sub-processor list, on no page, and in no
 * annex. Every artefact agreed with every other artefact and all of them were missing the same
 * recipient, which is exactly the failure a set of mutually-consistent hand-kept lists produces.
 *
 * The count is the part worth dwelling on. **"Four providers" was a number in a statutory
 * disclosure**, typed by hand, describing a set that had five members. A wrong number that looks
 * right, in the document a customer's counsel reads.
 *
 * THE FIX IS NOT "REMEMBER OPENROUTER". It is that a host appearing in shipped code now has to be
 * classified here before the build passes, and a host classified `sub-processor` has to appear in
 * `SUB_PROCESSORS`. `scripts/check-recipients.mjs` reads this list and the source tree and holds
 * them against each other; `recipients.test.ts` holds this list against the disclosure.
 *
 * ================================================================================================
 * THE DISTINCTION THE ROLES EXIST TO MAKE
 * ================================================================================================
 *
 * **A platform the customer connects is not our sub-processor.** Google Ads, Meta, Loyverse,
 * Shopify and the rest are reached with the CUSTOMER'S OWN credential, under the customer's own
 * relationship with that platform -- that is what BYOC means and it is the whole architecture. Data
 * arriving from them is not data we sent them. Listing them as sub-processors would misdescribe who
 * is accountable to whom, and would put a dozen names into a document whose purpose is to tell a
 * controller who WE hand their data to.
 *
 * **A public source we read is not a recipient either.** Nothing tenant-specific is sent to a
 * public air-quality feed; the request says which station and nothing about who is asking.
 *
 * **A host nothing requests is neither**, and it is still listed, because the alternative is a
 * guard that ignores whatever it cannot classify.
 */

export type RecipientRole =
  /** Receives data on our behalf. MUST be in `SUB_PROCESSORS` and therefore on every disclosure. */
  | "sub-processor"
  /** The customer's own platform, reached with the customer's own credential. Not ours to disclose. */
  | "tenant-platform"
  /** A public source. Read from, never told anything about a tenant. */
  | "public-source"
  /** This product's own domain. */
  | "own"
  /** Named in the source and requested by no code path. The note says why it is there. */
  | "not-requested";

export interface OutboundHost {
  readonly host: string;
  readonly role: RecipientRole;
  /** The `SUB_PROCESSORS` name, for `sub-processor` hosts. Null for every other role. */
  readonly processor: string | null;
  /** What this host is, and for `not-requested`, why a literal exists with no request behind it. */
  readonly note: string;
  /**
   * For a `not-requested` host that a written-but-unwired package would call: that package's name.
   *
   * `check-recipients.mjs` asserts nothing outside the package imports it. The day something does,
   * the guard fails and names the disclosure that has to be written in the same change -- which is
   * the ordering `packages/email/src/send.ts` asks for in prose and had no way to enforce.
   */
  readonly noCallerOf?: string;
}

/**
 * The product's own domain, read rather than written.
 *
 * `check-brand.mjs` refuses the domain as a literal outside `packages/brand` -- comments and
 * fixtures included -- so it could not be typed here even if that were a good idea, and it is not:
 * a second copy of the domain is a second thing to change on the day it moves.
 */
const OWN_DOMAIN = brand.domain;

export const OUTBOUND_HOSTS: readonly OutboundHost[] = [
  // ---- Sub-processors: data goes to them, on our behalf ------------------------------------
  {
    host: "openrouter.ai",
    role: "sub-processor",
    processor: "OpenRouter",
    note: "The model router `/brief` posts a workspace's computed figures to. THE RECIPIENT THIS FILE WAS WRITTEN AFTER: live in `apps/web/app/brief/actions.ts` and disclosed nowhere until now.",
  },
  {
    host: "x.supabase.co",
    role: "sub-processor",
    processor: "Supabase",
    note: "A placeholder project host in `packages/store/src/postgrest.ts`'s error text, showing the shape of the URL a deployment must supply. The real host is per-project and comes from the environment, which is why no other Supabase literal exists to find.",
  },

  // ---- The customer's own platforms, reached with the customer's own credential ------------
  //
  // Every one of these is BYOC. Listing them as sub-processors would say that we hand a
  // controller's data to Google, when what happens is that the controller's own Google account
  // hands it to us.
  {
    host: "accounts.google.com",
    role: "tenant-platform",
    processor: null,
    note: "Where the customer authorises their own Google account. The consent screen is Google's and the customer is the one standing in front of it.",
  },
  {
    host: "oauth2.googleapis.com",
    role: "tenant-platform",
    processor: null,
    note: "Exchanges and refreshes the customer's own Google token.",
  },
  {
    host: "www.googleapis.com",
    role: "tenant-platform",
    processor: null,
    note: "Google's shared API host, used for token metadata and revocation on the customer's credential.",
  },
  {
    host: "googleads.googleapis.com",
    role: "tenant-platform",
    processor: null,
    note: "The customer's own Google Ads account.",
  },
  {
    host: "analyticsdata.googleapis.com",
    role: "tenant-platform",
    processor: null,
    note: "The customer's own Google Analytics 4 property.",
  },
  {
    host: "searchconsole.googleapis.com",
    role: "tenant-platform",
    processor: null,
    note: "The customer's own Search Console property.",
  },
  {
    host: "graph.facebook.com",
    role: "tenant-platform",
    processor: null,
    note: "The customer's own Meta ad account.",
  },
  {
    host: "www.facebook.com",
    role: "tenant-platform",
    processor: null,
    note: "Meta's authorisation screen, where the customer authorises their own ad account.",
  },
  {
    host: "api.loyverse.com",
    role: "tenant-platform",
    processor: null,
    note: "The customer's own Loyverse till.",
  },

  // ---- Public sources: read from, told nothing --------------------------------------------
  {
    host: "air4thai.pcd.go.th",
    role: "public-source",
    processor: null,
    note: "The Pollution Control Department's public air-quality feed. The request names a station; `ambient_readings` is a SHARED table with no per-tenant attribution, so there is nothing tenant-specific to send and none is sent.",
  },

  // ---- This product's own domain ----------------------------------------------------------
  ...(OWN_DOMAIN === null
    ? []
    : [
        {
          host: OWN_DOMAIN,
          role: "own" as const,
          processor: null,
          note: "This product's own domain. Not a recipient of anything: it is where the pages are served from.",
        },
      ]),

  // ---- Named in source, requested by nothing ----------------------------------------------
  {
    host: "api.resend.com",
    role: "not-requested",
    processor: null,
    noCallerOf: "@repo/email",
    note: "`packages/email` is written, tested and WIRED TO NOTHING -- no module outside the package imports it, which `check-recipients.mjs` asserts rather than trusts. Its own header says the sub-processor clause must be amended in the change that gives it a caller, and the guard is what makes that ordering binding instead of hoped for. A mail provider receives a recipient's address, so disclosing it before it receives anything would be as wrong in the other direction.",
  },
  {
    host: "iapi.bot.or.th",
    role: "not-requested",
    processor: null,
    note: "Appears only in `packages/fx/src/bot.ts`'s header, recording a VERIFIED NEGATIVE: the Bank of Thailand's v1 host does not resolve, and the module ships no default endpoint because of it. The literal is the evidence for a refusal, not an address anything calls.",
  },
  {
    host: "developer.loyverse.com",
    role: "not-requested",
    processor: null,
    note: "Loyverse's published API reference, cited in comments in `packages/contract/src/restatement.ts` and the Loyverse client. A citation, not an endpoint: the till itself is `api.loyverse.com`.",
  },
  {
    host: "schema.org",
    role: "not-requested",
    processor: null,
    note: "The JSON-LD vocabulary identifier in the FAQ's structured data. `@context` is a name for a vocabulary, not an address this product fetches -- nothing in the page resolves it.",
  },
  {
    host: "developers.google.com",
    role: "not-requested",
    processor: null,
    note: "A documentation link on `/fields/google-ads`, pointing a reader at Google's own field reference. If it is requested at all it is requested by the reader's browser, on the reader's own account, which is a different thing from this service calling a host.",
  },
  {
    host: "example.com",
    role: "not-requested",
    processor: null,
    note: "RFC 2606 reserved for documentation. Used in comments and normaliser examples.",
  },
  {
    host: "shop.example.com",
    role: "not-requested",
    processor: null,
    note: "RFC 2606 reserved. The example store URL in the WooCommerce connector's documentation.",
  },
  {
    host: "example.test",
    role: "not-requested",
    processor: null,
    note: "RFC 6761 reserved for testing. Search Console fixtures.",
  },
  {
    host: "evil.example",
    role: "not-requested",
    processor: null,
    note: "RFC 2606 reserved. The hostile redirect target in `auth/callback-policy.ts`'s comment, which is the case that policy exists to refuse.",
  },
];

/** Hosts that receive data on our behalf, by the name they are disclosed under. */
export function disclosedProcessors(): readonly string[] {
  return [
    ...new Set(
      OUTBOUND_HOSTS.filter((h) => h.role === "sub-processor").map((h) => h.processor ?? ""),
    ),
  ].filter((name) => name !== "");
}
