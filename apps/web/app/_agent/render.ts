import { brand, siteUrl } from "@repo/brand";

import { SITE } from "../_content";
import { type AgentPage, AGENT_PAGES, markdownPath, publishableClaims } from "./registry";

/**
 * THE TWO MACHINE-READABLE RENDERINGS, BUILT FROM THE SAME REGISTRY THE SITEMAP IS BUILT FROM.
 *
 * WHY THESE ARE GENERATED AND NOT CHECKED-IN FILES. `scripts/check-brand.mjs` refuses the product
 * name, the domain and the contact address anywhere outside `packages/brand` -- comments and
 * fixtures included. A static `public/llms.txt` naming the product would fail the build, and the
 * ways round that are all worse than generating it: an exemption comment would switch the guard off
 * for the one file whose whole content is the brand, and a placeholder would ship a document that
 * says less than the page it describes. Generating from `@repo/brand` means the day the name or the
 * domain changes, this changes with it and nobody has to remember.
 *
 * It also means the base URL is right per deployment. `siteUrl()` resolves the deployment's own
 * origin, so a preview build advertises the preview -- the same reason `sitemap.ts` and `layout.tsx`
 * already resolve rather than hardcode. An `llms.txt` on a branch build that pointed at production
 * would send an agent to read a different site than the one it was given.
 */

const base = (): string => siteUrl(process.env).replace(/\/$/, "");

/** `text/markdown` with a charset, which is what the llms.txt convention's link relation promises. */
export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/**
 * One page as markdown.
 *
 * DELIBERATELY NOT A RENDERING OF THE HTML. Turning the React tree into markdown would be a scrape
 * of a presentation layer -- it would carry the nav, the footer, the decorative headings and the
 * hero's sample figures, and it would change whenever the layout did. What an agent wants is the
 * page's content, so this is the SAME constants the page renders, emitted in a second format. The
 * cost is that the two can drift; `registry.test.ts` is what stops the drift that matters, which is
 * a page existing with nothing said about it.
 */
export function pageMarkdown(page: AgentPage): string {
  const origin = base();
  const claims = publishableClaims(page);

  const lines = [`# ${page.title}`, "", `> ${page.summary}`, ""];

  if (claims.length > 0) {
    for (const text of claims) lines.push(`- ${text}`);
    lines.push("");
  }

  lines.push(
    "---",
    "",
    `Source: [${page.title}](${origin}${page.path === "/" ? "" : page.path})`,
    `Index: [llms.txt](${origin}/llms.txt)`,
    "",
  );

  return lines.join("\n");
}

/**
 * `/llms.txt`, in the structure the convention requires: an H1 naming the site, a blockquote
 * summarising it, then H2 sections whose bodies are markdown link lists.
 *
 * The link targets are the `.md` twins rather than the HTML pages. That is the point of the file --
 * an agent that follows a link from here should land on something it can read without stripping a
 * layout first, and the HTML original is one line further down each page for anything that wants it.
 */
export function llmsTxt(): string {
  const origin = base();
  const pages = AGENT_PAGES;

  const section = (heading: string, entries: readonly AgentPage[]): string[] =>
    entries.length === 0
      ? []
      : [
          `## ${heading}`,
          "",
          ...entries.map((p) => `- [${p.title}](${origin}${markdownPath(p.path)}): ${p.summary}`),
          "",
        ];

  const isConnector = (p: AgentPage) =>
    p.path.startsWith("/connectors/") || p.path === "/fields/google-ads";
  const isLegal = (p: AgentPage) => p.path === "/terms" || p.path === "/privacy";

  return [
    `# ${brand.productName}`,
    "",
    `> ${SITE.heroLead}`,
    "",
    // Not a capability claim and not marketing: the one thing an agent most needs to know before
    // quoting anything from this site, which is who is answerable for it.
    `Published by ${brand.legalEntity}, ${brand.postalAddress.city}, ${brand.postalAddress.countryCode}.`,
    `Contact: ${brand.supportEmail}`,
    "",
    ...section(
      "Product",
      pages.filter((p) => !isConnector(p) && !isLegal(p)),
    ),
    ...section("Sources this product can read", pages.filter(isConnector)),
    ...section("Legal", pages.filter(isLegal)),
  ].join("\n");
}
