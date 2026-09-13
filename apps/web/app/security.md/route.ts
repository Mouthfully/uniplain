import { pageMarkdown } from "../_agent/render";
import { AGENT_PAGES } from "../_agent/registry";

/**
 * The markdown twin of `/security`, per the llms.txt convention: same URL, extension replaced.
 *
 * WORTH HAVING FOR THIS PAGE IN PARTICULAR. It is the page a buyer's procurement checklist looks
 * for, and increasingly the one an agent reads on their behalf. A machine-readable version that
 * states what is enforced and what is NOT held is better read than a rendered page an agent
 * summarises loosely -- and this page's whole value is in the precision of that distinction.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/security");
  if (page === undefined) {
    return new Response("registry has no entry for /security", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
