#!/usr/bin/env node
/**
 * THE MAILBOX GUARD: the brand fact and the zone must agree.
 *
 * `brand.supportMailboxDeliverable` says whether the published contact address receives mail.
 * `/privacy` and `/terms` render an admission while it is false, and `/privacy`'s statutory-rights
 * clause names the postal address instead of the mailbox. All of that hangs off one boolean.
 *
 * A BOOLEAN NOBODY CHECKS IS THE COMMENT IT REPLACED. Before it existed, the fact lived in a
 * comment beside the address -- "VERIFIED NOT YET DELIVERABLE... mail to this address bounces" --
 * while `/privacy` told a data subject the same address "reaches the same people". Two statements
 * in one repository, one of them false, and nothing in the world able to notice. Moving the fact
 * into a constant fixes the drift between the pages. It does not fix the drift between the
 * constant and reality, which is what this is for.
 *
 * SO IT ASSERTS AGREEMENT, IN BOTH DIRECTIONS, AND THAT IS WHY IT IS NOT A BUILD BLOCKER TODAY:
 *
 *   fact false, no MX   -> pass. The honest current state: the pages admit it.
 *   fact true,  no MX   -> FAIL. Somebody published a channel by flipping a boolean. This is the
 *                          one this guard exists for, and it is the same interlock `brand.test.ts`
 *                          puts on the certification facts: a claim cannot be made by a
 *                          one-character edit.
 *   fact false, MX      -> FAIL. The records landed and the pages still apologise for a mailbox
 *                          that works. The five-minute DNS task becomes a red build on the day it
 *                          is done rather than a line in AGENTS.md nobody rereads.
 *
 * DNS UNREACHABLE IS A FAILURE, NOT A PASS, for the reason `check-advisories.mjs` gives at length:
 * a check that could not run must not be indistinguishable from one that ran and found nothing.
 *
 * DNS-over-HTTPS rather than `dig`, which is not installed in every environment this runs in, and
 * against Cloudflare's resolver because that is what `AGENTS.md` documents the verification with.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./lib/scan.mjs";

const RESOLVER = "https://cloudflare-dns.com/dns-query";

function brandFacts() {
  const text = readFileSync(join(repoRoot, "packages/brand/src/brand.ts"), "utf8");
  const domain = text.match(/^\s*domain:\s*"([^"]+)",$/m)?.[1] ?? null;
  const claimed = text.match(/^\s*supportMailboxDeliverable:\s*(true|false),$/m)?.[1] ?? null;
  if (domain === null || claimed === null) {
    throw new Error(
      "could not read `domain` and `supportMailboxDeliverable` out of packages/brand/src/brand.ts; " +
        "refusing to pass on a file this guard cannot parse",
    );
  }
  return { domain, claimed: claimed === "true" };
}

/** The MX answer for a zone, or a throw. An empty answer section is NODATA and means no records. */
async function hasMx(domain) {
  const url = `${RESOLVER}?name=${encodeURIComponent(domain)}&type=MX`;
  const response = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!response.ok) {
    throw new Error(`the resolver answered ${response.status} for MX ${domain}`);
  }
  const body = await response.json();
  // Status 3 is NXDOMAIN: the zone does not exist, which is also "no mailbox".
  if (body.Status !== 0 && body.Status !== 3) {
    throw new Error(`the resolver returned DNS status ${body.Status} for MX ${domain}`);
  }
  return Array.isArray(body.Answer) && body.Answer.some((a) => a.type === 15);
}

let facts;
let mx;
try {
  facts = brandFacts();
  mx = await hasMx(facts.domain);
} catch (error) {
  console.error(
    `\ncheck-mailbox: ${error instanceof Error ? error.message : String(error)}\n\n` +
      "This is NOT a pass. The published contact address is the statutory rights channel on " +
      "/privacy, and whether it receives mail is not something to assume either way.\n",
  );
  process.exit(1);
}

if (facts.claimed === mx) {
  console.log(
    `check-mailbox: brand.supportMailboxDeliverable is ${facts.claimed} and the zone ${mx ? "has" : "has no"} MX record. They agree.`,
  );
  process.exit(0);
}

console.error(
  facts.claimed
    ? "\ncheck-mailbox: brand.supportMailboxDeliverable is TRUE and the zone has NO MX RECORD.\n\n" +
        "  The pages stop admitting that the contact address bounces, and /privacy goes back to\n" +
        "  telling a data subject that it reaches somebody. Mail sent to it is still lost, and the\n" +
        "  person misled is the one trying to exercise a right.\n\n" +
        "  Add the MX records, or set the fact back to false.\n"
    : "\ncheck-mailbox: the zone HAS an MX record and brand.supportMailboxDeliverable is FALSE.\n\n" +
        "  The mailbox works and every page still apologises for it, /privacy still sends a data\n" +
        "  subject to the postal address, and the terms still warn that a notice would bounce.\n\n" +
        "  Set brand.supportMailboxDeliverable to true. The copy follows from it.\n",
);
process.exit(1);
