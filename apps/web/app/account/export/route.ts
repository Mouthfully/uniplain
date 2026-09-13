import { currentUser } from "../../_auth/server";
import { isAuthConfigured } from "../../_auth/env";
import { buildExport } from "../_export";

/**
 * THE EXPORT AS A DOWNLOAD, AND WHY IT IS A ROUTE RATHER THAN A SERVER ACTION.
 *
 * A server action returns state to a React tree. It cannot set `Content-Disposition`, and the
 * alternatives -- a data: URI, a blob built in the browser -- put the whole file through the page
 * and into whatever the browser caches. A route handler streams it once, with a filename, and
 * nothing of it survives in the document.
 *
 * NEVER CACHED, AND THE HEADER SAYS SO TWICE. This response is one tenant's business data. A
 * shared cache that held it for a second is the failure row-level security exists to make
 * impossible, reintroduced above the database by a default.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!isAuthConfigured()) return new Response(null, { status: 404 });

  const user = await currentUser();
  // 404 AND NOT 401. A signed-out request to this address learns nothing about whether it exists.
  if (!user) return new Response(null, { status: 404 });

  const state = await buildExport();
  if (state.kind !== "ready") {
    // The reason is not surfaced: it is a PostgREST code naming a table or a policy, and the person
    // downloading their own data is not the right reader for either.
    return new Response(null, { status: state.kind === "needsOrganisation" ? 404 : 503 });
  }

  const day = state.data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(state.data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The organisation's own name is NOT in the filename. A download lands in a shared folder or
      // a chat window as often as not, and the name of a business is the one identifier in this
      // file a stranger could read without opening it.
      "content-disposition": `attachment; filename="account-export-${day}.json"`,
      "cache-control": "no-store, private",
      pragma: "no-cache",
    },
  });
}
