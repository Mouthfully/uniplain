import { FORBIDDEN_CLAIMS, IMPLEMENTED_SOURCE_IDS } from "@repo/brand";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PLAN_ENTITLEMENTS } from "../_billing/entitlements";
import { claim, connectionAllowance } from "../_content";
import { Faq, FinalCta } from "./FaqCta";

/**
 * WHAT THE FAQ IS ALLOWED TO PROMISE.
 *
 * This section is the one place on the site where a reader who was not convinced by a card goes
 * looking for the sentence that convinces them -- which makes it the place where an unbacked
 * promise is most useful to write and most expensive to have written. `page.test.tsx` renders the
 * whole homepage and checks the ban list over it; that catches a forbidden CLAIM here and nothing
 * else. The four rules below are the ones specific to this section, and each exists because the
 * answer above it could have been written the other way in one edit.
 *
 * NOTHING IS STRIPPED BEFORE SCANNING, and that is a difference from `sample-brief.test.tsx` worth
 * stating. That file removes `aria-hidden` spans because the assistant card draws decorative
 * numerals a screen reader skips. This section draws no decoration carrying prose or figures -- the
 * only hidden glyphs are the +/- affordance and two arrows -- so the whole rendered text is
 * scanned, and a sentence or a digit hidden inside an `aria-hidden` span is caught rather than
 * excused.
 *
 * BOTH EXPORTS ARE RENDERED. The closing panel ships in the same file for the layout reason its
 * module comment gives, and a promise typed into `CTA_LEAD` is as published as one typed into an
 * answer. A test that covered only the accordion would leave half the file unguarded.
 */

const html = renderToStaticMarkup(
  <>
    <Faq />
    <FinalCta />
  </>,
);

const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

describe("the section renders enough to be worth checking", () => {
  it("renders every answer, so a green run is not vacuous", () => {
    // Every assertion below is an absence, and an absence over an empty string is free. This is
    // the floor under all of them: if the accordion ever stops rendering, this fails first and the
    // rest of the file stops being reassuring for the wrong reason.
    const questions = html.split("<details").length - 1;
    expect(questions).toBeGreaterThanOrEqual(6);
    expect(questions).toBeLessThanOrEqual(9);
    expect(text.length).toBeGreaterThan(1000);
  });

  it("keeps the promise the resolver owns in the resolver's words", () => {
    // The training answer opens with `claim("no-training")`. Asserting the resolved TEXT, not the
    // topic, is what stops the next edit paraphrasing a cited claim into a hand-typed sentence
    // that reads the same and is reviewed by nothing -- the failure 65-the-deletion-pass.md
    // records. If the claim is ever withheld, `claim()` throws and this file fails at import.
    expect(text).toContain(claim("no-training"));
  });

  it("reads the plan allowance from the entitlement record", () => {
    expect(text).toContain(connectionAllowance("free"));
  });

  it("does not restate the non-answer this rewrite deleted", () => {
    // "The pricing model is designed to let you upgrade as your data and team grow" asserted
    // nothing checkable, which is why it survived two rewrites. Naming it here costs one line and
    // makes its return a red test rather than a judgement call in review.
    expect(text).not.toMatch(/designed to let you upgrade/i);
  });
});

describe("nothing the specification dropped can reach the FAQ", () => {
  it.each(FORBIDDEN_CLAIMS.map((f) => [f.pattern.source, f] as const))(
    "does not match the forbidden pattern %s",
    (_source, forbidden) => {
      expect(text, forbidden.reason).not.toMatch(forbidden.pattern);
    },
  );
});

/**
 * PLATFORM NAMES THAT ARE NOT IN THE SOURCE TREE.
 *
 * `docs/marketplane/58-plan-reconciliation.md` section 5.1 stops the Thai POS vendors, the delivery
 * platforms and the banks appearing as sources anywhere on this site. These are the names this
 * repository's own notes reach for when it is describing what it cannot yet read.
 *
 * TWO NAMES ARE MATCHED CASE-SENSITIVELY AND THE REASON IS NOT PEDANTRY. "Grab" and "LINE" are
 * ordinary English words; matched case-insensitively they would fire on "grab" in a sentence about
 * nothing at all, and a guard that fires on innocent copy is a guard somebody deletes. A platform
 * name is capitalised where it is being claimed as a source, which is the case worth catching.
 */
const UNIMPLEMENTED_SOURCES = [
  "Xero",
  "QuickBooks",
  "FlowAccount",
  "foodpanda",
  "StoreHub",
  "Shopify",
  "TikTok",
  "HubSpot",
  "Stripe",
  "Lazada",
  "Shopee",
  "Klaviyo",
  "Mailchimp",
  "DataForSEO",
  "air4thai",
];

const UNIMPLEMENTED_SOURCES_CASE_SENSITIVE = ["Grab", "LINE"];

describe("no answer names a source", () => {
  it("names no platform that is not in IMPLEMENTED_SOURCE_IDS", () => {
    for (const name of UNIMPLEMENTED_SOURCES) {
      expect(text, `${name} is not a source this product reads`).not.toMatch(
        new RegExp(`\\b${name}\\b`, "i"),
      );
    }
    for (const name of UNIMPLEMENTED_SOURCES_CASE_SENSITIVE) {
      expect(text, `${name} is not a source this product reads`).not.toMatch(
        new RegExp(`\\b${name}\\b`),
      );
    }
  });

  it("names no source at all, including the ones that are implemented", () => {
    // STRICTER THAN THE BAN, ON PURPOSE, and derived rather than typed so it cannot go stale. The
    // section's own rule is that no answer names a source: a reader who is told which platforms
    // are read counts them, and a count is what `check-claim-sources.mjs` refuses. The list comes
    // from IMPLEMENTED_SOURCE_IDS, so a connector added tomorrow is covered the day it lands.
    const lower = text.toLowerCase();
    for (const id of IMPLEMENTED_SOURCE_IDS) {
      for (const spelling of [id, id.replace(/_/g, " "), id.replace(/_/g, "")]) {
        expect(lower, `an answer names the source ${id}`).not.toContain(spelling);
      }
    }
  });
});

describe("every digit on the page came from the entitlement record", () => {
  it("licenses each numeric token against PLAN_ENTITLEMENTS", () => {
    // A HAND-TYPED NUMBER IN AN ANSWER IS A CLAIM, and the one place it does the most damage is
    // directly below a pricing card that gets its figures from `PLAN_ENTITLEMENTS`. The two drift
    // silently: the card changes, the answer does not, and the FAQ -- read precisely when the card
    // did not convince somebody -- publishes the older number as if it were the current one.
    //
    // The licensed set is every plan's allowance, not just Free's. Quoting another tier's figure
    // here would be odd but it would not be false, and a test should refuse what is wrong rather
    // than what is unusual.
    const licensed = new Set(
      Object.values(PLAN_ENTITLEMENTS).map((entitlement) => String(entitlement.connections.count)),
    );
    const tokens = text.match(/\d+/g) ?? [];
    expect(tokens.length, "no digit renders at all, so this check proves nothing").toBeGreaterThan(
      0,
    );
    expect([...new Set(tokens)].filter((token) => !licensed.has(token))).toEqual([]);
  });
});

/**
 * CAPABILITIES THE PRODUCT DOES NOT HAVE.
 *
 * Each pattern is built against a sentence that was either on this page once or would be the
 * obvious thing to write next, and each names the file that proves the capability is absent. None
 * of them is a style rule: every one of these would be discovered by a customer on their first
 * attempt, which is the most expensive moment to discover it.
 */
const UNBUILT = [
  {
    pattern: /\be-?mails?\b|\be-?mailed\b|\binbox\b|\bmailbox\b/i,
    reason:
      "No mail can be sent or received. docs/marketplane/70-the-mail-nobody-can-send-yet.md " +
      "verifies the zone holds neither an MX nor a TXT record, so there is no delivery and no " +
      "SPF or DKIM either -- and packages/email has no caller for exactly that reason. The " +
      "invitation answer says the link is passed on by hand; anything mentioning an inbox is a " +
      "channel that does not exist.",
  },
  {
    pattern: /\b(?:in|into|to)\s+thai\b|\bthai[-\s](?:language|interface|version|copy)\b/i,
    reason:
      "NOTHING IN THIS REPOSITORY IS LOCALISED TO THAI -- not a string table, not a locale, not a " +
      "model instruction. docs/marketplane/65-the-deletion-pass.md removed this exact promise " +
      "from this file once already, where it read 'reply to ask a follow-up, in Thai or English'.",
  },
  {
    // The baht sign U+0E3F sits inside the Thai block and is CURRENCY, not language: the homepage
    // renders it deliberately and `page.test.tsx` asserts it. Excluding it by codepoint rather
    // than widening the check to "no Thai at all" is what keeps this pattern about the promise.
    pattern: /[ก-฾เ-๛]/,
    reason:
      "Thai script on the page would be an interface promise made in the language itself. The " +
      "baht sign is excluded because it is currency and the hero already prints it.",
  },
  {
    pattern: /\b(?:we|it|the system)\W{0,12}(?:will\W{0,6})?(?:delete|erase|wipe|purge)\b/i,
    reason:
      "No deletion system exists. AGENTS.md gap 1: no retention period is set on any table and " +
      "nothing deletes any of them.",
  },
  {
    pattern:
      /\b(?:delete|erase|wipe|purge|close)\W{0,12}your\W{0,12}(?:account|data|figures|numbers)\b/i,
    reason:
      "There is no account-deletion path in any route or migration. Offering one here is a " +
      "promise a customer tests on the day they have already decided to leave.",
  },
  {
    pattern: /\b(?:export|download)\W{0,12}(?:your|all|a\W{0,4}copy\W{0,4}of)\b/i,
    reason:
      "AGENTS.md gap 6: no data-subject rights path at all -- no intake, no clock, no export. " +
      "There is no report writer and no export route anywhere in apps/web.",
  },
  {
    pattern:
      /\byour\W{0,12}data\W{0,12}(?:is|are|will\W{0,4}be)\W{0,12}(?:deleted|erased|removed|destroyed)\b|\bright\W{0,4}to\W{0,4}be\W{0,4}forgotten\b/i,
    reason:
      "The passive voice is the way this promise gets written without anybody deciding to make " +
      "it. Nothing removes anything on a schedule; /privacy says so in its retention clause.",
  },
  {
    // Borrowed verbatim in spirit from packages/email/src/templates.test.ts, which refuses a
    // cadence for messages that cannot be delivered. Narrowed to DELIVERY rather than to "every
    // morning": the page's positioning is that a brief covers each morning, and the hero says so.
    // What is unbuilt is anything that pushes it to somebody -- nothing schedules a send.
    pattern:
      /\bwe.?ll send\b|\bwill arrive\b|\bdelivered (?:each|every)\b|\bsent (?:each|every)\b/i,
    reason:
      "Nothing schedules a delivery. The only schedule in the codebase is app.due_connections, " +
      "which decides when a connection is PULLED, and there is no sender on the other end.",
  },
];

describe("no answer promises a capability the product lacks", () => {
  it.each(UNBUILT.map((entry) => [entry.pattern.source, entry] as const))(
    "matches nothing for %s",
    (_source, entry) => {
      expect(text, entry.reason).not.toMatch(entry.pattern);
    },
  );
});
