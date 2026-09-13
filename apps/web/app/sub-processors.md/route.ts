import { pageMarkdown } from "../_agent/render";
import { AGENT_PAGES } from "../_agent/registry";

/** The markdown twin of `/sub-processors`, which a reviewer's tooling reads as often as they do. */
export const dynamic = "force-static";

export function GET(): Response {
  const page = AGENT_PAGES.find((p) => p.path === "/sub-processors");
  if (page === undefined) {
    return new Response("registry has no entry for /sub-processors", { status: 500 });
  }
  return new Response(pageMarkdown(page), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
