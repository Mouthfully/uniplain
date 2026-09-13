import { describe, expect, it } from "vitest";

// The real lane table, by relative path, for `_providers.test.ts`'s reason: vitest and tsc resolve
// it, Turbopack does not, and no file under `app/` may copy this import into shipped code.
import { PROVIDER_LANES } from "../../../../packages/connections/src/connections.ts";
import { CONNECTIONS } from "../_content";
import { OAUTH_ONLY_PROVIDERS, TYPED_PROVIDERS } from "./_providers";

/**
 * THE OTHER HALF OF THE MIRROR.
 *
 * `_providers.test.ts` asserts that nothing is OFFERED FOR TYPING that `PROVIDER_LANES` does not
 * give a typed lane. That property was enough while the four OAuth sources were named and marked
 * unavailable -- a list of words cannot be wrong about a flow nobody can start.
 *
 * They are now buttons. A source on this list with no `oauth` lane in the package would send a
 * customer to a consent screen and come back with `unsupported_lane` from the endpoint, after the
 * detour rather than before it. So the same mirror is asserted in this direction too.
 */

const LANES = PROVIDER_LANES as Record<string, readonly string[] | undefined>;

describe("the authorisation screen offers only sources the package can authorise", () => {
  it("gives every source it lists an oauth lane in PROVIDER_LANES", () => {
    expect(OAUTH_ONLY_PROVIDERS.length).toBeGreaterThan(0);
    for (const id of OAUTH_ONLY_PROVIDERS) {
      expect(LANES[id], id).toBeDefined();
      expect(LANES[id], id).toContain("oauth");
    }
  });

  /**
   * A SOURCE IS OFFERED BY EXACTLY ONE DOOR ON THIS SCREEN, AND `meta_ads` IS WHY THIS IS WRITTEN
   * DOWN RATHER THAN ASSUMED. The package gives it both lanes -- the same ad account can be
   * connected by authorisation or by a System User token the customer minted itself -- and the
   * Worker's route would accept either. This screen offers the typed one and not the other, because
   * presenting one account under two doors makes a customer choose between two promises about where
   * their credential goes, and nothing here would be able to tell them which they had picked
   * afterwards. Stated as a decision so that the day it changes, it changes deliberately.
   */
  it("lists no source that is also offered for typing", () => {
    const typed = TYPED_PROVIDERS.map((provider) => provider.id);
    for (const id of OAUTH_ONLY_PROVIDERS) expect(typed, id).not.toContain(id);
    expect(typed).toContain("meta_ads");
    expect(LANES.meta_ads).toContain("oauth");
    expect(OAUTH_ONLY_PROVIDERS).not.toContain("meta_ads");
  });
});

describe("every source the authorisation screen offers has words for it", () => {
  it("names each one", () => {
    for (const id of OAUTH_ONLY_PROVIDERS) {
      expect(CONNECTIONS.providerNames[id], id).toBeTypeOf("string");
    }
  });

  /**
   * A SOURCE ADDED HERE WITHOUT FIELD COPY WOULD RENDER NOTHING AT ALL -- `OAuthStartForm` returns
   * null rather than showing a blank label over the field that decides which account a connection
   * reads. That is the right refusal and the wrong place to discover it, so it fails here instead.
   */
  it("labels the account field of each one", () => {
    for (const id of OAUTH_ONLY_PROVIDERS) {
      const copy = CONNECTIONS.oauthFields[id];
      expect(copy, id).toBeDefined();
      expect(copy?.accountLabel, id).toBeTypeOf("string");
      expect(copy?.accountHint, id).toBeTypeOf("string");
    }
  });

  /**
   * AND THE WORDS ARE THE PLATFORM'S OWN, WHICH MEANS THEY DIFFER. A property id, a customer id, a
   * Search Console property and a merchant id are four different identifiers in four different
   * shapes; one shared hint across them would be a sentence that is wrong for three.
   */
  it("says something different for each one", () => {
    const hints = OAUTH_ONLY_PROVIDERS.map((id) => CONNECTIONS.oauthFields[id]?.accountHint);
    expect(new Set(hints).size).toBe(OAUTH_ONLY_PROVIDERS.length);
  });
});
