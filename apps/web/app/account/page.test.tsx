import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_COPY } from "./_content";

/**
 * THE THREE SECTIONS, AND THE ONE THAT MUST SURVIVE THE OTHER TWO FAILING.
 *
 * `readMembership` answers about an ORGANISATION. The sign-in address belongs to the auth record,
 * and the two have nothing to do with each other -- so a database that cannot answer the first
 * question must not withdraw the second answer. Rendering the address form inside the membership
 * branch would take away the only remedy on this page at exactly the moment something is already
 * wrong, and nothing on screen would say that had happened: the page would look like a page that
 * simply does not offer it.
 *
 * THE ORDER IS ALSO ASSERTED. Take, move, close -- a person scrolling to find the export should not
 * pass the button that permanently ends the account on the way to it.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1", email: "ops@northstar.test" } as {
    id: string;
    email?: string;
    new_email?: string;
  } | null,
  membership: {
    kind: "ready",
    membership: {
      organisationId: "org-1",
      organisationName: "Northstar Trading",
      ownRole: "owner",
    },
  } as { kind: string; membership?: Record<string, unknown> },
}));

vi.mock("../_auth/env", () => ({ isAuthConfigured: () => true }));
vi.mock("../_auth/server", () => ({ currentUser: async () => F.user }));
vi.mock("../members/_members", () => ({ readMembership: async () => F.membership }));
vi.mock("./actions", () => ({ eraseAccount: async () => ({}) }));
vi.mock("./email-actions", () => ({ changeSignInEmail: async () => ({}) }));
vi.mock("./session-actions", () => ({ signOutOtherSessions: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirected to ${to}`);
  },
}));

const Page = (await import("./page")).default;

async function render(): Promise<string> {
  return renderToStaticMarkup(await Page());
}

/** Entities back to characters, so a `toContain` on a sentence is not vacuously false. */
function say(markup: string): string {
  return markup
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

beforeEach(() => {
  F.user = { id: "user-1", email: "ops@northstar.test" };
  F.membership = {
    kind: "ready",
    membership: {
      organisationId: "org-1",
      organisationName: "Northstar Trading",
      ownRole: "owner",
    },
  };
});

describe("the account page", () => {
  it("offers all four, with the one that cannot be undone last", async () => {
    const markup = say(await render());

    // Each anchored on copy the SECTION's own form prints, not on its heading: a heading is
    // cheap to leave behind, and a heading over a section that no longer renders is worse than
    // an absent one.
    const take = markup.indexOf(ACCOUNT_COPY.exportButton);
    const move = markup.indexOf(ACCOUNT_COPY.emailSubmit);
    const devices = markup.indexOf(ACCOUNT_COPY.sessionsButton);
    const close = markup.indexOf(ACCOUNT_COPY.eraseConfirmLabel);

    expect(take, ACCOUNT_COPY.exportButton).toBeGreaterThan(-1);
    expect(move, ACCOUNT_COPY.emailSubmit).toBeGreaterThan(-1);
    expect(devices, ACCOUNT_COPY.sessionsButton).toBeGreaterThan(-1);
    expect(close, ACCOUNT_COPY.eraseConfirmLabel).toBeGreaterThan(-1);

    expect(take).toBeLessThan(move);
    expect(move).toBeLessThan(devices);
    // The one that matters most: nobody scrolling for the export or the address should pass the
    // button that permanently ends the account on the way to it.
    expect(devices).toBeLessThan(close);
  });

  it("admits, above the button, what signing out everywhere cannot do", async () => {
    const markup = say(await render());

    // Both admissions are rendered, and rendered BEFORE the control. A person who has pressed it
    // believes the other devices are out; a footnote read afterwards is a sentence nobody reads at
    // the moment it counts.
    const noList = markup.indexOf(ACCOUNT_COPY.sessionsNoList);
    const notInstant = markup.indexOf(ACCOUNT_COPY.sessionsNotInstant);
    const button = markup.indexOf(ACCOUNT_COPY.sessionsButton);

    expect(noList, ACCOUNT_COPY.sessionsNoList).toBeGreaterThan(-1);
    expect(notInstant, ACCOUNT_COPY.sessionsNotInstant).toBeGreaterThan(-1);
    expect(noList).toBeLessThan(button);
    expect(notInstant).toBeLessThan(button);
  });

  it("names the address currently signed in with, and says both mailboxes must confirm", async () => {
    const markup = say(await render());

    expect(markup).toContain("ops@northstar.test");
    expect(markup).toContain(ACCOUNT_COPY.emailBothConfirm);
  });

  it("shows a change in flight, read from the auth record rather than from the form", async () => {
    // A person who requests a change and then reloads -- or opens the page on another device --
    // sees nothing outstanding unless this comes from the server, requests it again, and cancels
    // the pair of links they are in the middle of confirming.
    F.user = { id: "user-1", email: "ops@northstar.test", new_email: "finance@northstar.test" };

    const markup = say(await render());

    expect(markup).toContain(ACCOUNT_COPY.emailPendingHeading);
    expect(markup).toContain("finance@northstar.test");
  });

  it("says nothing about a change in flight when there is none", async () => {
    const markup = say(await render());
    expect(markup).not.toContain(ACCOUNT_COPY.emailPendingHeading);
  });

  it("still offers the address form when the organisation cannot be read", async () => {
    F.membership = { kind: "unavailable" };

    const markup = say(await render());

    expect(markup).toContain(ACCOUNT_COPY.unavailable);
    // THE FORM, NOT THE HEADING. A mutation that wrapped only `<EmailForm>` in the membership
    // branch left this test green, because the `<h2>` above it still rendered -- a heading over
    // nothing, which is the exact defect and reads on screen as a section that does not exist.
    // So every assertion here is on copy only the form itself prints.
    expect(
      markup,
      "the one remedy on this page was withdrawn because a different question failed",
    ).toContain(ACCOUNT_COPY.emailBothConfirm);
    expect(markup).toContain(ACCOUNT_COPY.emailSubmit);
    expect(markup).toContain(ACCOUNT_COPY.emailHeading);
    // The other remedy on this page belongs to the sign-in record too, and survives for the same
    // reason: a device somebody else is holding is not the organisation's question.
    expect(markup).toContain(ACCOUNT_COPY.sessionsButton);
    // The two that DO depend on the organisation are correctly absent.
    expect(markup).not.toContain(ACCOUNT_COPY.exportButton);
    expect(markup).not.toContain(ACCOUNT_COPY.eraseConfirmLabel);
  });
});
