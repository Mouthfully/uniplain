# 70. Resend, and the DNS record every email feature is behind

**PR:** #60 &nbsp;·&nbsp; **Date:** 2026-09-13 &nbsp;·&nbsp; **Status:** proposed

---

## 1. The question, and the finding that answers it differently than expected

The founder asked whether to use Resend for email. The answer is yes — and the useful part of this
unit is what verifying the question turned up first.

**No email is sent anywhere in this repository today.** Not Resend, not SendGrid, not SMTP, not
`nodemailer` — a grep across `apps/`, `packages/` and `supabase/` finds nothing. `invitations` has a
table and an insert policy and **no application code that creates a row**, so the invitation feature
is unbuilt rather than broken.

More importantly:

## 2. The domain can neither receive nor send mail, and that is now verified

`brand.ts` carried a note that the zone had "one CNAME and no MX record". That is confirmed, and it
is worse than recorded. Queried over DNS-over-HTTPS against Cloudflare's resolver — which `curl`
reaches where `dig` is absent from this container:

| Query | Result |
|---|---|
| `MX` | `Status: 0` (NOERROR), **no answer section**, SOA only |
| `TXT` | `Status: 0` (NOERROR), **no answer section**, SOA only |

NODATA rather than NXDOMAIN: the zone exists and is served, and holds **neither record**.

**Two consequences, and the second is new.**

1. **Inbound mail bounces.** `brand.supportEmail` is published on `/privacy` and `/terms` as the
   route for data-subject requests — under PDPA s.30–36 that is the statutory rights channel, and
   it does not receive mail. `AGENTS.md` listed this as *unverified and load-bearing*; it is now a
   confirmed defect.
2. **No outbound mail can leave the domain either.** No TXT means **no SPF and no DKIM**. Resend
   cannot verify the sending domain, and unauthenticated mail is rejected outright by some
   receivers and filed as spam by most of the rest.

**Every email feature in the plan — the morning brief, a workspace invitation, a password reset
that is not Supabase's default sender — is behind the same five-minute DNS task.** That is the
single most useful thing this investigation produced, and it is not code.

## 3. So the package is written and deliberately not wired to anything

`packages/email` exists, is tested, and has **no caller**. That is normally the defect this
repository keeps finding — a thing that exists and is never reached — so the exception is argued
rather than assumed:

**Wiring it now would make it lie.** `sendEmail` would return `{ id }` for a message the recipient
never sees, because unauthenticated mail from an unverified domain is accepted by the provider and
dropped by the receiver. **A send that reports success for mail that lands in a spam folder is the
delivery version of a confident wrong number.** The moment the records exist, the package does
exactly what it says, and the first caller can be reviewed on its own merits rather than on whether
the channel works at all.

## 4. Why Resend, in one line

It is an HTTP API with no SDK required, and `apps/api-edge` is a Cloudflare Worker: a package that
reached for Node's `net` or `nodemailer` could not run there, and the morning brief is meant to be
sent by the scheduler eventually. **One `fetch` runs in both runtimes.**

## 5. What it costs in obligations, stated before it is used

**Resend would be a fifth sub-processor.** `/privacy` names exactly four — Supabase, Cloudflare,
Vercel and Stripe — and that clause was closed from the code hours ago in note 68. A mail provider
receives a recipient's address and the body of what is sent to them: personal data leaving for a new
party, and a new PDPA s.28 cross-border transfer.

**The clause must be amended in the change that gives this package its first caller, not later.**
That ordering is recorded in the module header rather than in a ticket, because the person wiring
the first caller is the one who needs to see it.

## 6. The decisions inside the module

**Plain text only**, and it is a decision rather than a gap. HTML would add a rendering surface, a
second copy of every string that could drift from the first, and the remote-image path that most
mail tracking uses — which `/privacy` currently says this product does not do. A test asserts the
request body carries no `html` field.

**Nothing is logged.** Not the recipient, not the subject, not the body. A log line carrying a
customer's address is personal data in a place nothing in `AGENTS.md`'s retention story covers.

**The thrown error carries no recipient.** Resend echoes the request in some error shapes, so an
error that forwarded the provider's body would put a customer's address into whatever catches it —
a log, an error tracker, a server action's return value. The code and status are what a caller
needs.

**One attempt; a 4xx is never retried.** An unverified sending domain — the state this domain is in
today — fails identically every time, and retrying turns one rejection into several. A 5xx is
reported as `unavailable` for the caller to decide about, because whether a brief is worth
re-sending is a product question this module has no business answering.

**The sender address is composed from `brand.domain`, not typed.** `check-brand.mjs` bans the
product domain outside `packages/brand`, and a null domain refuses rather than falling back to a
sender on somebody else's.

## 7. Cost estimate

**Per connected account per month:** `N/A — nothing is sent.` For when something is: Resend's free
tier is 3,000 messages a month, and one brief a day per connected account is ~30. The line to watch
is the same one note 69 names — it becomes accounts × days when the cron lands, not before.

## 8. Platform-terms check

Gates 1–5, 7–17: `N/A` — no platform API call is made by anything today.

**4 (credential hygiene).** `PASS`. `RESEND_API_KEY` is carried in the `authorization` header and a
test asserts it never appears in the request body.

**6 (PII path).** `PASS`, with the caveat that is the point of §5: this package is the first thing
capable of sending a customer's address to a new processor, and the privacy clause is not yet
amended **because nothing calls it**. The two must move together.

**18 (claim provenance).** `PASS`. No user-visible claim changes.

**Result:** `3 PASS, 15 N/A, 0 FAIL`

## 9. Mutation testing

| Mutation | Result |
|---|---|
| forward the provider's error body into the thrown error | *puts no address or body into the error it throws* |
| retry a 4xx | *reports a 4xx as rejected, and calls once* |
| add an `html` body beside the text | *posts plain text to the provider and returns the message id* |

All reverted. Email suite **10 tests**.

**And one the gate caught on me rather than a mutation:** the first draft of this work put the
literal product domain into a module comment and into a fenced shell example in `AGENTS.md`.
`check-brand.mjs` failed both. The guard bans the identity string **everywhere outside
`packages/brand`, comments and documentation included**, which is exactly what it claims to do and
exactly what I forgot. The DNS example now reads the domain from the brand package.

## 10. What was left out

**The DNS records themselves**, which are the whole blocker and are not something code can do. SPF
and DKIM for the sending domain, plus MX for inbound so the statutory rights address works.

**Every caller.** No invitation, no brief delivery, no cron. Each is its own unit, and each needs
the privacy clause amended in the same change.

**Supabase's auth mail is untouched and is a separate question.** Sign-in mail goes through
Supabase's own sender today, whose default SMTP is rate-limited and not intended for production.
Pointing it at Resend is a setting in the Supabase dashboard rather than code in this repository —
worth doing at the same time as the DNS, since it needs the same records.

**No bounce or complaint handling.** Resend can webhook both, and nothing here receives them. A
sender that ignores bounces degrades its own domain reputation, so this matters before volume, not
after.
