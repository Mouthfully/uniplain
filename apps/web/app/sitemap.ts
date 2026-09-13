import { siteUrl } from "@repo/brand";
import type { MetadataRoute } from "next";

import { AGENT_PAGES } from "./_agent/registry";

/**
 * THE SITEMAP, DERIVED RATHER THAN KEPT.
 *
 * This file used to hold its own hand-written list, and the list was WRONG: eight entries against
 * fourteen indexable routes. Missing were `/envelope` and five of the six connector pages -- the
 * pages that answer "can this product read Google Ads?", which is the single most likely question
 * to bring a crawler or an agent here at all. Every entry pointed at a real page, so the file
 * looked correct under any check anyone thought to write, and the gap survived because nothing ever
 * compared it to the routes on disk.
 *
 * It now reads `AGENT_PAGES`, which `_agent/registry.test.ts` compares against `app/**` in BOTH
 * directions and which also feeds `llms.txt` and the markdown twins. Four descriptions of this
 * site, one list. A page added without an entry now fails a test instead of quietly going unfound.
 *
 * `siteUrl()` resolves the base rather than a literal, for the reason `layout.tsx` records -- a
 * preview deployment must advertise itself and not production. A sitemap generated on a preview
 * therefore describes the preview, which is correct: nothing should ever submit one to a search
 * engine from a branch build.
 *
 * `lastModified` is the build time. It is honest at the granularity anyone uses it: this is a
 * static export, so every page genuinely was generated at this moment. Faking per-page dates from
 * git history would be more precise and no more true, since a shared component changing alters a
 * page its own file's history does not mention.
 *
 * `priority` is deliberately coarse, and lives on the registry entry beside the page it describes.
 * Google has said for years that it ignores the field; it is kept only because other crawlers read
 * it, and a page of invented decimals would imply a precision nobody has.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl(process.env).replace(/\/$/, "");
  const lastModified = new Date();

  return AGENT_PAGES.map((page) => ({
    url: `${base}${page.path === "/" ? "/" : page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
