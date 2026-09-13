import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DATA_REQUESTS, REQUEST_KINDS } from "./_content";

/**
 * THE SCREEN THAT ANSWERS A STATUTORY RIGHT, AND THE TWO THINGS IT MUST NEVER SAY.
 *
 * 1. A DEADLINE. `app.data_request_deadline()` returns NULL because nobody has established which
 *    PDPA s.30-36 period applies, and a date rendered here would be shown to the one person
 *    entitled to enforce it. The tripwire is on the rendered markup rather than on the function,
 *    because the function being right does not stop a page printing "within 30 days" beside it.
 *
 * 2. THAT ANYTHING HAS BEEN DELETED. Nothing in this product can perform an erasure -- DELETE is
 *    withheld from organisations, workspaces, invitations and api_keys, nothing reaches
 *    auth.users, and deleteWorkspacePayloads has no caller. The page may offer to RECORD a
 *    deletion request and must not imply it performed one.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  requests: { kind: "ready", rows: [] } as { kind: string; rows?: unknown[]; reason?: string },
  redirects: [] as string[],
}));

vi.mock("../_auth/env", () => ({ isAuthConfigured: () => true }));
vi.mock("../_auth/server", () => ({ currentUser: async () => F.user }));
vi.mock("./_requests", () => ({
  organisationDataRequests: async () => F.requests,
  currentOrganisationId: async () => "org-1",
}));
vi.mock("./actions", () => ({ fileRequest: async () => ({}), withdrawRequest: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    F.redirects.push(to);
    throw new Error(`redirected to ${to}`);
  },
}));

const Page = (await import("./page")).default;

async function render(): Promise<string> {
  return renderToStaticMarkup(await Page());
}

/** Entities back to characters, so a `not.toContain` on a sentence is not vacuously true. */
function say(markup: string): string {
  return markup
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("the data request screen", () => {
  it("offers every request kind the database can store", async () => {
    const markup = await render();
    for (const kind of REQUEST_KINDS) {
      expect(markup, kind).toContain(`value="${kind}"`);
      expect(say(markup), kind).toContain(DATA_REQUESTS.kindNames[kind]);
    }
  });

  it("says in words that no response time is published, rather than showing one", async () => {
    const text = say(await render());
    expect(text).toContain(DATA_REQUESTS.pendingNote);

    // THE TRIPWIRE. Any of these beside a person's own statutory request would be a commitment
    // nobody has established. The list is the phrasings somebody reaching for a reassuring
    // sentence actually writes.
    for (const promise of [
      "within 30 days",
      "30 days",
      "within a month",
      "we will respond",
      "we aim to respond",
      "business days",
      "working days",
    ]) {
      expect(text.toLowerCase(), `the screen promises "${promise}"`).not.toContain(
        promise.toLowerCase(),
      );
    }
  });

  it("does not claim anything has been deleted", async () => {
    const text = say(await render()).toLowerCase();
    for (const claim of [
      "has been deleted",
      "your data has been",
      "permanently removed",
      "we have deleted",
      "erased your",
    ]) {
      expect(text, `the screen claims "${claim}"`).not.toContain(claim);
    }
  });

  it("names the processor split, so a request about a platform goes to the right controller", async () => {
    // A buyer whose name sits in a merchant's Shopify is that merchant's data subject, not ours.
    // A screen that took the request anyway would be answering for somebody else's obligation.
    expect(say(await render())).toContain(DATA_REQUESTS.processorNote);
  });

  it("takes no organisation id from the browser", async () => {
    // A hidden input carrying an organisation would be a tenancy decision made in the page. The
    // definer function refuses a foreign organisation anyway; this asserts the screen never asks.
    const markup = await render();
    expect(markup).not.toContain('name="organisation_id"');
    expect(markup).not.toContain('name="p_organisation_id"');
    expect(markup).not.toContain("org-1");
  });

  it("says the list is empty rather than rendering nothing", async () => {
    expect(say(await render())).toContain(DATA_REQUESTS.listEmpty);
  });

  it("reports an unavailable list without implying the requests were lost", async () => {
    F.requests = { kind: "unavailable", reason: "PGRST301" };
    try {
      const text = say(await render());
      expect(text).toContain(DATA_REQUESTS.listUnavailable);
      expect(text).not.toContain("PGRST301");
    } finally {
      F.requests = { kind: "ready", rows: [] };
    }
  });

  it("redirects a signed-out request rather than rendering it", async () => {
    F.user = null;
    try {
      await expect(render()).rejects.toThrow(/redirected/);
      expect(F.redirects.at(-1)).toBe("/signin?next=%2Fdata-requests");
    } finally {
      F.user = { id: "user-1" };
    }
  });
});
