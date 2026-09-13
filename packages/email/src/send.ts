import { brand } from "@repo/brand";

/**
 * SENDING MAIL, AND THE DNS RECORD THIS WHOLE PACKAGE IS WAITING ON.
 *
 * ================================================================================================
 * READ THIS BEFORE WIRING A FEATURE TO IT: NOTHING SENT FROM THIS DOMAIN WILL ARRIVE YET.
 * ================================================================================================
 *
 * Verified over DNS-over-HTTPS against Cloudflare's resolver at the time of writing:
 *
 *   MX  <the product domain>  -> NOERROR, no answer section, SOA only
 *   TXT <the product domain>  -> NOERROR, no answer section, SOA only
 *
 * NODATA rather than NXDOMAIN: the zone exists and is served, and holds neither record. No TXT
 * means **no SPF and no DKIM**, so Resend cannot verify the sending domain and mail from
 * the product domain is unauthenticated -- rejected outright by some receivers and filed as spam by
 * most of the rest.
 *
 * So this package is written, tested and deliberately NOT yet wired to a customer-facing feature.
 * `sendEmail` will do exactly what it says the moment the records exist, and until then it would
 * report success for mail nobody receives. **A send that returns ok for a message that silently
 * lands in a spam folder is the delivery version of a confident wrong number**, which is the thing
 * this repository is organised against. The DNS task is recorded in `AGENTS.md` and is the same
 * five-minute job that fixes inbound mail to the statutory rights address on `/privacy`.
 *
 * ================================================================================================
 * WHY RESEND, AND WHAT USING IT COSTS IN OBLIGATIONS
 * ================================================================================================
 *
 * It is an HTTP API with no SDK required, which matters because `apps/api-edge` is a Cloudflare
 * Worker: a package that reached for Node's `net` or `nodemailer` could not run there, and the
 * morning brief is meant to be sent by the scheduler eventually. One `fetch` runs in both runtimes.
 *
 * IT IS ALSO A FIFTH SUB-PROCESSOR. `/privacy` names exactly four today -- Supabase, Cloudflare,
 * Vercel and Stripe -- and that clause was closed from the code only hours ago. A mail provider
 * receives a recipient's address and the body of what is sent them, which is personal data leaving
 * for a new party and a new PDPA s.28 transfer. **The clause must be amended in the change that
 * gives this package its first real caller, not later**, and that ordering is the point of saying
 * so here rather than in a ticket.
 */

export type EmailErrorCode =
  /** The API rejected the request: bad key, unverified domain, malformed address. Never retried. */
  | "rejected"
  /** The provider failed or was unreachable. Retryable by the caller, which this module does not do. */
  | "unavailable"
  /** The request outlived its timeout. */
  | "timeout"
  /** No API key was configured. The caller decides whether that is fatal. */
  | "not_configured";

export class EmailError extends Error {
  readonly code: EmailErrorCode;
  readonly status: number | null;

  constructor(code: EmailErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "EmailError";
    this.code = code;
    this.status = status;
  }
}

export const RESEND_SEND_URL = "https://api.resend.com/emails";

/**
 * Long enough for a provider under load, short enough that a request a person is waiting behind
 * does not hang. Matches `DEFAULT_TIMEOUT_MS` in the insight client, for the same reason.
 */
export const DEFAULT_EMAIL_TIMEOUT_MS = 10_000;

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain text only. See `sendEmail` for why there is no HTML field. */
  readonly text: string;
}

export interface SendOptions {
  readonly apiKey: string;
  readonly timeoutMs?: number;
  /** Injected in tests. Defaults to the runtime's own fetch. */
  readonly fetchImpl?: typeof fetch;
}

export interface SendResult {
  /** The provider's own id for the message, kept so a delivery can be traced afterwards. */
  readonly id: string | null;
}

/**
 * The address mail is sent FROM, derived rather than typed.
 *
 * `check-brand.mjs` refuses the product domain anywhere outside `packages/brand`, comments and test
 * fixtures included, so this is composed from `brand.domain` at runtime. That guard is why there is
 * no hard-coded `FROM` constant on the product domain here, and the indirection is the guard
 * working rather than ceremony.
 *
 * A NULL DOMAIN IS NOT A DEFAULT. `brand.domain` is typed nullable and this refuses rather than
 * falling back to a sender on somebody else's domain, which would be both undeliverable and a
 * quiet lie about who sent it.
 */
export function senderAddress(localPart: string): string {
  if (brand.domain === null) {
    throw new Error("email: no domain is set on the brand, so there is no address to send from");
  }
  if (!/^[a-z][a-z0-9._-]*$/.test(localPart)) {
    throw new Error("email: a sender local part must be a plain lowercase identifier");
  }
  return `${localPart}@${brand.domain}`;
}

/**
 * Send one message.
 *
 * PLAIN TEXT ONLY, AND THAT IS A DECISION RATHER THAN A GAP. What this product sends is a brief:
 * three sentences, a line about something unusual, and one thing to do. HTML would add a rendering
 * surface, a tracking pixel somebody would eventually ask for, and a second copy of every string
 * that could drift from the first. Plain text also cannot carry a remote image, which is how most
 * mail tracking works and which `/privacy` currently says this product does not do.
 *
 * NOTHING IS LOGGED HERE. Not the recipient, not the subject, not the body. A log line carrying a
 * customer's address is personal data in a place nothing in `AGENTS.md`'s retention story covers,
 * and `packages/payloads`' redaction does not reach application logs.
 *
 * ONE ATTEMPT. A 4xx is never retried -- an unverified domain or a malformed address fails the same
 * way every time, and retrying turns one rejection into several. A 5xx or a network failure is
 * reported as `unavailable` for the caller to decide about, because whether a brief is worth
 * re-sending is a product question this module has no business answering.
 */
export async function sendEmail(
  message: EmailMessage,
  from: string,
  options: SendOptions,
): Promise<SendResult> {
  if (options.apiKey.trim() === "") {
    throw new EmailError("not_configured", "email: no API key was configured for the sender");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_EMAIL_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetchImpl(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // The abort and a genuine network failure arrive the same way, so they are told apart by the
    // controller rather than by the error's own text, which varies between runtimes.
    if (controller.signal.aborted) {
      throw new EmailError("timeout", "email: the provider did not answer in time");
    }
    throw new EmailError(
      "unavailable",
      `email: the provider could not be reached (${String(error)})`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // THE BODY IS READ AND NOT FORWARDED. Resend echoes the request in some error shapes, so the
    // response can contain the recipient address; the code and status are what a caller needs.
    const code: EmailErrorCode = response.status >= 500 ? "unavailable" : "rejected";
    throw new EmailError(code, `email: the provider answered ${response.status}`, response.status);
  }

  const parsed: unknown = await response.json().catch(() => null);
  const id =
    parsed !== null && typeof parsed === "object" && "id" in parsed
      ? typeof (parsed as { id: unknown }).id === "string"
        ? (parsed as { id: string }).id
        : null
      : null;

  return { id };
}
