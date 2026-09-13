import { pageMarkdown } from "../../_agent/render";
import { AGENT_PAGES } from "../../_agent/registry";

/**
 * The markdown twin of `/for/cafe`, per the llms.txt convention: same URL, extension replaced.
 *
 * One handler per page rather than a catch-all, for the reason the connector handlers give: a root
 * `[...slug]` route answers every unmatched path, turning a 404 into a 200 carrying an empty
 * document -- the soft 404 a crawler reads as a page existing.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/for/cafe");
  if (page === undefined) {
    return new Response("registry has no entry for /for/cafe", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
