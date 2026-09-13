import { pageMarkdown } from "../_agent/render";
import { AGENT_PAGES } from "../_agent/registry";

/**
 * The markdown twin of `/integrations`, per the llms.txt convention: same URL, extension replaced.
 *
 * One handler per page rather than a catch-all. A root `[...slug]/route.ts` would answer every
 * unmatched path on the site, which turns a 404 into a 200 carrying an empty document -- the
 * "soft 404" that machine-readability checkers specifically penalise and that a crawler reads as a
 * page existing. Fourteen four-line files are the boring version and cannot do that.
 *
 * The entry is LOOKED UP, not passed in: if the registry ever stops describing this route the
 * lookup fails loudly here rather than serving a document about nothing.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/integrations");
  if (page === undefined) {
    // Unreachable while `registry.test.ts` passes, which asserts this route has an entry. A 500 and
    // not an empty 200, because a machine-readable surface that answers "fine, nothing here" is
    // worse than one that admits it is broken.
    return new Response("registry has no entry for /integrations", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
