import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * EVERY `signOut` IN THIS APP STATES ITS SCOPE, AND THIS IS WHY THAT IS A GUARD AND NOT A STYLE.
 *
 * `@supabase/auth-js` documents the default plainly: "the default `scope` is `'global'`. This signs
 * the user out of EVERY DEVICE they are currently signed in on, not just the current tab/session.
 * If you only want to sign the user out of the current session (the behavior most other auth
 * libraries default to), pass `{ scope: 'local' }` explicitly."
 *
 * This app had two call sites and neither passed one. The header's "Sign out" button was therefore
 * ending the session on the owner's phone and on the shop's counter tablet, and nothing in the
 * code, the copy or the diff said so -- the behaviour lived entirely in a library default. That is
 * the shape of defect this repository keeps finding: a fact about the system that nothing in the
 * system states.
 *
 * So the rule is not "use local". It is that the scope is WRITTEN DOWN at every call site, each one
 * having chosen. A new call site added without one fails here rather than quietly inheriting
 * "every device this person owns".
 *
 * SCANNED FROM SOURCE rather than exercised, for the same reason `_oauth-refusals.test.ts` scans
 * the Worker: `auth/callback/route.ts` cannot be unit tested without standing up a cookie store and
 * an auth server, and what is under test is the literal argument a human edits.
 */

const APP = new URL("../", import.meta.url).pathname;

/** Every `.ts`/`.tsx` under `app/`, excluding test files. */
function sources(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
      // `new URL("../")` keeps its trailing slash, so the join above doubles it. Normalised here
      // rather than left to each assertion, because a path that is nearly right is how the last
      // assertion in this file passed by comparing `undefined` to `undefined`.
      out.push({
        path: full.slice(APP.length).replace(/^\/+/, ""),
        text: readFileSync(full, "utf8"),
      });
    }
  };
  walk(APP);
  return out;
}

/** Call sites of `auth.signOut(...)`, with whatever was written between the parentheses. */
function callSites(): { path: string; argument: string }[] {
  const out: { path: string; argument: string }[] = [];
  for (const { path, text } of sources()) {
    for (const match of text.matchAll(/auth\.signOut\(([^)]*)\)/g)) {
      out.push({ path, argument: (match[1] ?? "").trim() });
    }
  }
  return out;
}

describe("the scope on every sign-out", () => {
  const sites = callSites();

  it("found the call sites at all, so the assertions below are not vacuous", () => {
    // A regex that matched nothing would make every "for each" below pass by iterating nothing --
    // which is precisely how a guard reports coverage it does not have.
    expect(sites.length).toBeGreaterThanOrEqual(2);
    // And the paths are the ones the last assertion looks up. A near-miss there compares
    // `undefined` to `undefined` and reports green; this caught exactly that on the first run.
    expect(sites.map((s) => s.path).sort()).toContain("_auth/actions.ts");
  });

  it("never calls signOut with no argument, because that means every device", () => {
    const bare = sites.filter((s) => s.argument === "").map((s) => s.path);
    expect(
      bare,
      `these sign out of EVERY device the person is signed in on, by library default rather than by choice: ${bare.join(", ")}`,
    ).toEqual([]);
  });

  it("writes a scope this library actually has at every call site", () => {
    for (const site of sites) {
      expect(site.argument, `${site.path} passes something that is not a scope`).toMatch(
        /^\{\s*scope:\s*"(local|global|others)"\s*\}$/,
      );
    }
  });

  it("signs out only this device from the button, and everywhere from the refusal", () => {
    // The two scopes are opposite and both are deliberate. The header button is one person leaving
    // one screen. The callback refusal is an identity the door turns away, which should hold no
    // session anywhere -- including one made before the rule was applied to it.
    const byPath = new Map(sites.map((s) => [s.path, s.argument]));
    expect(byPath.get("_auth/actions.ts")).toBe('{ scope: "local" }');
    expect(byPath.get("auth/callback/route.ts")).toBe('{ scope: "global" }');
  });
});
