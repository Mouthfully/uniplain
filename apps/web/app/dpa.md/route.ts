import { pageMarkdown } from "../_agent/render";
import { AGENT_PAGES } from "../_agent/registry";

/**
 * The markdown twin of `/dpa`.
 *
 * A customer's reviewer reads this one through tooling more often than through a browser: a data
 * processing agreement is the document that gets pasted into a checklist, and the markdown is what
 * survives that paste with its clause structure intact.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/dpa");
  if (page === undefined) {
    return new Response("registry has no entry for /dpa", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
