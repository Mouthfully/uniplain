import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KEYS_COPY } from "./_content";

/**
 * THE THREE THINGS THIS SCREEN MUST NOT DO.
 *
 *   INVENT AN ADDRESS. `apiUrl()` throws unless somebody has settled one, and it throws on purpose:
 *   "Refusing to derive one from the site URL -- the API is a different origin, and a URL on the
 *   site's domain would resolve to the marketing site rather than fail." A page that printed a
 *   plausible address would hand a customer a working key pointed at a marketing page.
 *
 *   TELL A VIEWER THERE ARE NO KEYS. `api_keys_select` is gated on `app.is_org_admin`, so a
 *   viewer's query succeeds and returns nothing. Rendering that as an empty list is a claim this
 *   code cannot make, and it is the wrong-number failure in a different currency.
 *
 *   RENDER AN ABSENCE AS A NUMBER. A key that has never been used and a ceiling nobody set are not
 *   zero, and a table that shows them as zero is telling an owner something false about their own
 *   account.
 */

const F = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  role: "owner" as string,
  keys: [] as unknown[],
  keysKind: "ready" as string,
}));

vi.mock("../_auth/env", () => ({ isAuthConfigured: () => true }));
vi.mock("../_auth/server", () => ({ currentUser: async () => F.user }));
vi.mock("../members/_members", () => ({
  readMembership: async () => ({
    kind: "ready",
    membership: { ownRole: F.role, ownMemberId: "member-1" },
  }),
}));
vi.mock("./_keys", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  workspaceApiKeys: async (isAdmin: boolean) =>
    isAdmin ? { kind: F.keysKind, keys: F.keys, reason: "x" } : { kind: "notAdmin" },
}));
vi.mock("./actions", () => ({
  createApiKey: async () => ({}),
  revokeApiKey: async () => ({}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirected to ${to}`);
  },
}));

const Page = (await import("./page")).default;

async function render(): Promise<string> {
  return renderToStaticMarkup(await Page());
}

function say(markup: string): string {
  return markup
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

const LIVE_KEY = {
  id: "k1",
  name: "Nightly export",
  keyPrefix: "mp_live_a2b3c4d5",
  monthlyCreditBudget: null,
  creditsUsed: 0,
  allowedTools: [],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  F.user = { id: "user-1" };
  F.role = "owner";
  F.keys = [LIVE_KEY];
  F.keysKind = "ready";
  delete process.env.PUBLIC_API_URL;
});

afterEach(() => {
  delete process.env.PUBLIC_API_URL;
});

describe("the keys screen", () => {
  it("says the address is unsettled rather than printing one", async () => {
    // `brand.apiBaseUrl` is null and `brand.test.ts` asserts it, so with no environment variable
    // `apiUrl()` throws. The screen must still hand over a key.
    const markup = say(await render());

    expect(markup).toContain(KEYS_COPY.endpointUnsettled);
    expect(markup).toContain(KEYS_COPY.createButton);
    // Nothing that looks like an address. The site's own origin is the tempting wrong answer.
    expect(markup).not.toContain(KEYS_COPY.endpointLabel);
  });

  it("prints the address once somebody has settled one", async () => {
    process.env.PUBLIC_API_URL = "https://api.example.test/";

    const markup = say(await render());

    expect(markup).toContain(KEYS_COPY.endpointLabel);
    // Trailing slash trimmed by `apiUrl`, and the value shown is the one it returned.
    expect(markup).toContain("https://api.example.test");
    expect(markup).not.toContain(KEYS_COPY.endpointUnsettled);
  });

  it("tells a viewer they cannot see keys rather than showing an empty list", async () => {
    F.role = "viewer";

    const markup = say(await render());

    expect(markup).toContain(KEYS_COPY.notAdmin);
    expect(
      markup,
      "a viewer was told this workspace has no keys, which this code cannot know",
    ).not.toContain(KEYS_COPY.listEmpty);
    expect(markup).not.toContain(KEYS_COPY.createButton);
  });

  it("renders never-used and no-ceiling as words, never as zero", async () => {
    const markup = say(await render());

    expect(markup).toContain(KEYS_COPY.neverUsed);
    expect(markup).toContain(KEYS_COPY.noBudget);
    expect(markup).toContain("mp_live_a2b3c4d5");
  });

  it("names the timezone beside a date rather than resolving to the runtime's", async () => {
    F.keys = [{ ...LIVE_KEY, lastUsedAt: "2026-09-10T18:30:00.000Z" }];

    const markup = say(await render());

    // The same defect `/billing` was fixed for: 18:30 UTC is the following day in Bangkok, and a
    // date with no zone is read by its reader in theirs.
    expect(markup).toMatch(/Sep 10, 2026 UTC/);
    expect(markup).not.toContain(KEYS_COPY.neverUsed);
  });

  it("formats that date IN the zone it names, not merely beside it", async () => {
    /**
     * THE ASSERTION ABOVE WAS NOT ENOUGH, AND A MUTATION IS WHAT SAID SO.
     *
     * Deleting `timeZone: KEY_ZONE` from the formatter left it GREEN. The " UTC" it looks for is
     * appended from a constant either way, and CI runs in UTC, so the rendered string was
     * byte-identical while the formatter had quietly gone back to resolving to whatever zone the
     * process happens to be in. On the deploy target that is UTC and the bug is invisible; on a
     * developer's machine in Bangkok it is a date that disagrees with the label printed next to it,
     * which is worse than no label at all.
     *
     * The runner's own zone cannot be changed from inside the test -- Node resolves it once at
     * startup -- so the OPTION is asserted rather than the output. What went missing is the
     * argument, and this is the thing that sees it go.
     */
    const original = Intl.DateTimeFormat;
    const options: (Intl.DateTimeFormatOptions | undefined)[] = [];

    // A CLASS, NOT AN ARROW, and one that RETURNS the real formatter rather than extending it.
    // An arrow has no [[Construct]], so `new` on it throws -- vitest says so in as many words.
    // And `extends Intl.DateTimeFormat` throws differently: the built-in hands back its own object
    // instead of initialising `this`, so the subclass instance has no `format` at all. A
    // constructor that returns an object replaces `this` with it, which is the one shape that both
    // records the options and behaves exactly like the thing it stands in for.
    class Recording {
      constructor(locale?: string, opts?: Intl.DateTimeFormatOptions) {
        options.push(opts);
        // biome-ignore lint/correctness/noConstructorReturn: replacing `this` with the real formatter is the point; see above.
        return new original(locale, opts) as unknown as Recording;
      }
    }
    const spy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(Recording as unknown as typeof Intl.DateTimeFormat);

    try {
      F.keys = [{ ...LIVE_KEY, lastUsedAt: "2026-09-10T18:30:00.000Z" }];
      await render();
    } finally {
      spy.mockRestore();
    }

    expect(options.length, "no date was formatted, so this asserts nothing").toBeGreaterThan(0);
    for (const opts of options) {
      expect(opts?.timeZone, "a date was formatted in whatever zone the runtime is in").toBe("UTC");
    }
  });

  it("distinguishes an empty list from a list it could not read", async () => {
    F.keys = [];
    const empty = say(await render());
    expect(empty).toContain(KEYS_COPY.listEmpty);

    F.keysKind = "unavailable";
    const broken = say(await render());
    expect(broken).toContain(KEYS_COPY.unavailable);
    expect(broken, "a failed read was rendered as an account with no keys").not.toContain(
      KEYS_COPY.listEmpty,
    );
  });
});
