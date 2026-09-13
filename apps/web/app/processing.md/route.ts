import { pageMarkdown } from "../_agent/render";
import { AGENT_PAGES } from "../_agent/registry";

/**
 * The markdown twin of `/processing`, per the llms.txt convention: same URL, extension replaced.
 *
 * This one earns the convention more than most. A record of processing is read by a reviewer's
 * tooling as often as by the reviewer, and handing it over as clean markdown rather than a page
 * they have to strip is the difference between a link that answers a diligence question and one
 * that starts a task.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/processing");
  if (page === undefined) {
    return new Response("registry has no entry for /processing", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
