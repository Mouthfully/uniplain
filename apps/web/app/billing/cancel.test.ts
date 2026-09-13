import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Comments are blanked before anything is scanned.
 *
 * This repository explains a ban in prose beside the code it binds, so `formatDate`'s own comment
 * QUOTES the broken formatter it replaced -- and the first version of this file duly reported the
 * explanation as the defect. A comment renders nothing and formats nothing.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, lead) => lead);
}

const PAGE = stripComments(readFileSync(join(HERE, "page.tsx"), "utf8"));
const ACTIONS = stripComments(readFileSync(join(HERE, "..", "_billing", "actions.ts"), "utf8"));

/**
 * CANCELLING, AND THE TWO WAYS THIS PAGE COULD LIE ABOUT MONEY.
 *
 * Both are invisible on screen and neither fails a build:
 *
 *   A COMPUTED STOP DATE. The date a subscription ends is Stripe's fact, synced by the webhook into
 *   `current_period_end`. Adding a month to today here would render plausibly for the customer
 *   whose anniversary is today and be wrong for everybody else -- the exact shape of "a wrong
 *   number that looks right", in the one place a customer is deciding whether to keep paying.
 *
 *   A SECOND BILLING WRITER. This app has one, the webhook. An action that also wrote
 *   `cancel_at_period_end` would be a second truth about the same subscription, and the two would
 *   disagree the first time a webhook arrived out of order -- which the webhook already defends
 *   against with `stripe_event_at`, and which a second writer would walk straight past.
 */

describe("the stop date", () => {
  it("is never computed from a clock in this page", () => {
    // No date arithmetic at all: no month or day offsets, no `Date.now()` feeding a formatter.
    expect(PAGE).not.toMatch(/setMonth|setDate|addMonths|\+\s*30\s*\*|86400000|2_592_000/);
  });

  /**
   * THE TIMEZONE IS NAMED, AND IT USED NOT TO BE. `Intl.DateTimeFormat` with no `timeZone` resolves
   * to the runtime's, so a subscription ending at 18:00 UTC showed the previous day in Bangkok and
   * a different day on a developer's machine than on the deploy target. CLAUDE.md bans exactly this
   * -- never default a timezone.
   */
  it("names the timezone it is printed in, rather than inheriting the runtime's", () => {
    // EVERY formatter on this page, not just the one that exists today. The first version of this
    // assertion banned `DateTimeFormat(...).format` outright, which forbids the CORRECT code as
    // well as the wrong code -- a test that cannot be satisfied is a test that gets deleted.
    const constructions = [...PAGE.matchAll(/DateTimeFormat\((\{|"[^"]*",\s*\{)([^}]*)\}/g)];
    expect(constructions.length, "no Intl formatter found to check").toBeGreaterThan(0);
    for (const construction of constructions) {
      expect(
        construction[2],
        `a date or time formatter with no timeZone: ${construction[0]}`,
      ).toMatch(/timeZone/);
    }
    // And the zone is printed, not merely applied: a date with no zone beside it is a date the
    // reader has to guess about, which is the thing this is preventing.
    expect(PAGE).toMatch(/\$\{BILLING_ZONE\}/);
  });
});

describe("who writes the billing row", () => {
  it("the cancel and resume actions write no table", () => {
    const block = ACTIONS.slice(ACTIONS.indexOf("export async function cancelSubscription"));
    // Reads are fine and necessary -- finding WHICH subscription to cancel is a read. A write is
    // the thing that must not be here.
    expect(block).not.toMatch(/\.update\(\s*\{/);
    expect(block).not.toMatch(/\.insert\(|\.upsert\(|\.delete\(/);
  });

  it("asks Stripe to cancel at period end, never immediately", () => {
    expect(ACTIONS).toMatch(/cancel_at_period_end:\s*true/);
    // An immediate cancellation takes away service already paid for, and the proration would owe
    // the customer money this product has no path to return.
    expect(ACTIONS).not.toMatch(/subscriptions\.cancel\(/);
    expect(ACTIONS).not.toMatch(/invoice_now|prorate/);
  });

  it("offers the undo, so the decision is not made to feel irreversible", () => {
    expect(ACTIONS).toMatch(/export async function resumeSubscription/);
    expect(ACTIONS).toMatch(/cancel_at_period_end:\s*false/);
  });
});

describe("what comes back from an action", () => {
  /**
   * A QUERY PARAMETER IS NEVER ECHOED. The actions redirect with one, and an unrecognised value
   * must produce nothing rather than reach the page -- echoing a query string into the document is
   * how one becomes a cross-site scripting hole.
   */
  it("maps the parameter through a table and renders nothing for an unknown one", () => {
    expect(PAGE).toMatch(/const NOTICES: Readonly<Record<string, string>>/);
    const notice = PAGE.slice(PAGE.indexOf("function noticeFor"), PAGE.indexOf("export default"));
    expect(notice).toMatch(/return null;/);
    // The raw value must not be interpolated into anything rendered.
    expect(PAGE).not.toMatch(/\{\s*(?:cancel|resume)Param\s*\}/);
  });

  it("gives every outcome its own sentence", () => {
    for (const key of [
      "cancelRequested",
      "cancelAlready",
      "cancelNone",
      "cancelFailed",
      "resumeRequested",
      "resumeNothing",
      "resumeFailed",
    ]) {
      expect(PAGE, `${key} is missing`).toContain(`${key}:`);
    }
  });

  it("never surfaces Stripe's own message", () => {
    const block = ACTIONS.slice(ACTIONS.indexOf("export async function cancelSubscription"));
    // `catch {}` without binding the error is the shape that makes this impossible to get wrong.
    expect(block).not.toMatch(/catch\s*\(\s*\w+\s*\)/);
    expect(block).not.toMatch(/console\./);
  });
});
