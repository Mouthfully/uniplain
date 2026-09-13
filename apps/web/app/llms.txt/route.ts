import { llmsTxt } from "../_agent/render";

/**
 * `/llms.txt`.
 *
 * A ROUTE AND NOT A FILE IN `public/`, for two reasons that both fail the build if ignored.
 * `check-brand` refuses the product name and the domain outside `packages/brand`, so a static file
 * spelling either cannot exist here; and `forbidden-claims.test.ts` scans the SOURCE of everything
 * under `app/`, so putting this under `app/` is what subjects the most quotable document on the
 * site to the same claims ban every route already carries. A file in `public/` would have been
 * shorter and would have been scanned by nothing.
 *
 * `text/plain` rather than `text/markdown`: the convention names the file `llms.txt`, and a `.txt`
 * served as markdown is a disagreement between the extension and the header for no gain. The `.md`
 * twins it links to are served as markdown, which is where the distinction earns anything.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // A day. The file changes when the site's page set changes, which is a deploy, and a stale
      // copy for a few hours costs an agent nothing that a wrong copy would not cost more.
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
