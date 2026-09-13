import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SubProcessorsPage from "../sub-processors/page";
import { DPA_COPY } from "./dpa-content";
import {
  lastChangedAt,
  noticeWindowOpen,
  SUB_PROCESSOR_CHANGES,
  SUB_PROCESSOR_NOTICE_DAYS,
  SUB_PROCESSORS,
} from "./sub-processors";

/**
 * THE MECHANISM THAT LET THE AGREEMENT MAKE A PROMISE.
 *
 * `/dpa` said, until this unit, that no sub-processor notice period was promised "because no
 * mechanism exists to give one". That was true and it was the right thing to write while it was
 * true. The cost of a promise nothing keeps is highest in exactly that document.
 *
 * So the promise now in the agreement is only as good as what is asserted here. These are not
 * assertions about the sentence; they are assertions about the thing the sentence describes:
 *
 *   - the period the contract states is the period the code computes;
 *   - the window opens on the published date and closes when it should, at both edges;
 *   - the page the agreement points at actually publishes the change and the date;
 *   - a signed-in customer is shown it rather than being expected to go and look.
 *
 * Break any one and the clause becomes what it used to be: a commitment nothing keeps.
 */

const page = renderToStaticMarkup(<SubProcessorsPage />)
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&#x2014;|&mdash;/g, "—")
  .replace(/\s+/g, " ");

describe("the notice window is the one the agreement promises", () => {
  it("states the same period in the contract and in the code", () => {
    // THE FAILURE THIS IS FOR: a number typed into a clause that disagrees with the number the
    // software uses. The contract wins with a customer and the code wins in fact, which is the
    // worst arrangement available.
    expect(SUB_PROCESSOR_NOTICE_DAYS).toBe(30);
    const clause = DPA_COPY.subProcessorBody.join(" ").toLowerCase();
    expect(clause).toContain("thirty days after it is published");
  });

  it("opens on the day of publication and closes exactly at the end of the window", () => {
    const changed = lastChangedAt();
    const day = (offset: number) => {
      const d = new Date(`${changed}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    expect(noticeWindowOpen(changed), "closed on the day it was published").toBe(true);
    expect(noticeWindowOpen(day(SUB_PROCESSOR_NOTICE_DAYS - 1)), "closed a day early").toBe(true);
    // BOTH EDGES, because an off-by-one here shortens or lengthens a contractual window. Day 30 is
    // when the change takes effect, so the notice window is over.
    expect(noticeWindowOpen(day(SUB_PROCESSOR_NOTICE_DAYS)), "still open after the window").toBe(
      false,
    );
    expect(noticeWindowOpen(day(SUB_PROCESSOR_NOTICE_DAYS + 60))).toBe(false);
  });

  it("has a change list to publish into, with real dates", () => {
    // A notice mechanism with no change list is a promise about a page that would be blank the
    // first time it mattered.
    expect(SUB_PROCESSOR_CHANGES.length).toBeGreaterThan(0);
    for (const change of SUB_PROCESSOR_CHANGES) {
      expect(change.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(change.summary.length, `${change.published} has no summary`).toBeGreaterThan(60);
    }
    expect(lastChangedAt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dates every provider, so the trail starts somewhere", () => {
    for (const provider of SUB_PROCESSORS) {
      expect(provider.since, `${provider.name} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("the page the agreement points at carries the notice", () => {
  it("publishes the change list and the date it last changed", () => {
    expect(page).toContain(lastChangedAt());
    for (const change of SUB_PROCESSOR_CHANGES) {
      expect(page, `${change.published} is not published`).toContain(change.published);
    }
  });

  it("explains the window and the remedy on the page, not only in the agreement", () => {
    // A customer who follows the agreement's pointer has to find out there what their options are.
    // "Read the other document" is not informing them.
    expect(page.toLowerCase()).toContain("thirty days");
    expect(page.toLowerCase()).toContain("end the agreement");
  });

  it("shows a signed-in customer the notice, rather than expecting them to go and look", () => {
    // THE HALF A MUTATION WALKED THROUGH. Replacing `noticeWindowOpen(today)` with `false` in the
    // dashboard left every assertion in this file green: they all read the sub-processors page and
    // the agreement, and neither of those is where a customer actually is. Publishing to a page is
    // informing somebody only if they look at the page -- which is the whole reason the in-product
    // half exists, and it was the untested half.
    //
    // Asserted on the SOURCE, the way `_span.test.ts` asserts the LiveRows call: the dashboard is
    // an async server component behind auth, and mocking the session to prove one banner renders
    // would test the mocks. What has to hold is that the window drives the banner.
    const dashboard = readFileSync(
      new URL("../dashboard/page.tsx", import.meta.url).pathname,
      "utf8",
    );
    expect(dashboard, "the dashboard no longer computes the notice window").toContain(
      "noticeWindowOpen(today)",
    );
    expect(dashboard, "the notice is computed and never rendered").toContain(
      "SUB_PROCESSOR_NOTICE.body",
    );
    // And the banner has to be gated on the window rather than always-on or never-on: a constant
    // either shouts at every customer forever or informs nobody.
    expect(dashboard).toMatch(/\{subProcessorNotice \?/);
  });

  it("claims no history it does not have", () => {
    // The four providers predate any customer. Writing a fictional series of additions to make the
    // page look maintained would be the same defect as a fictional retention period: a fact a
    // reviewer would rely on.
    const first = SUB_PROCESSOR_CHANGES.at(-1);
    expect(first?.summary.toLowerCase()).toContain("records a publication rather than a change");
  });
});
