import { siteUrl } from "@repo/brand";
import type { MetadataRoute } from "next";

import { PRIVATE_PATHS } from "./_agent/registry";

/**
 * robots.txt.
 *
 * SAYING IT IN BOTH PLACES IS DELIBERATE RATHER THAN REDUNDANT: the meta tag stops a page that has
 * been CRAWLED from being indexed, and this stops it being crawled. Neither implies the other.
 *
 * NOTE THE ORDER OF OPERATIONS, because it is the usual way this pair goes wrong. A path that is
 * Disallow-ed here can still appear in results as a bare URL, since the crawler never fetches the
 * page and so never sees the noindex telling it to stay out. Several of these are linked from the
 * header, so that is a real possibility rather than a theoretical one -- and it is why the meta
 * directive is the primary control and this file is the bandwidth saving.
 *
 * ---------------------------------------------------------------------------------------------
 * AI CRAWLERS ARE ALLOWED, INCLUDING FOR TRAINING. THAT IS A FOUNDER DECISION, RECORDED HERE.
 *
 * Every token below is allowed to crawl the public pages and, where the token exists to control
 * training specifically, to train. `Google-Extended` and `Applebot-Extended` are that second kind:
 * Google's own documentation says `Google-Extended` "does not impact a site's inclusion in Google
 * Search nor is it used as a ranking signal" -- it governs training and nothing else. Allowing them
 * is therefore an affirmative permission rather than the absence of a refusal, which is the only
 * reason to name a token that robots.txt would permit by silence anyway.
 *
 * THIS DOES NOT CONTRADICT THE `no-training` CLAIM, and the distinction is the whole point. That
 * claim -- "Never used to train models. Your data answers your questions." -- is about a CUSTOMER'S
 * PLATFORM DATA: the rows read out of their Shopify, their Google Ads, their till. None of that is
 * on this website. What is on this website is marketing copy, documentation and a privacy notice,
 * written by this company about itself, and a model trained on that has learned what the product
 * does. The promise covers the tenant's data, which lives behind a login this file forbids to
 * everyone. If those two ever have to be argued in the same sentence, this paragraph is the
 * argument.
 *
 * WHY EVERY NAMED GROUP REPEATS THE DISALLOW. In robots.txt a crawler obeys exactly ONE group --
 * the most specific one whose user-agent matches -- and a named group does NOT inherit from `*`.
 * So `User-agent: GPTBot` followed by `Allow: /` alone would not merely permit the public pages, it
 * would REVOKE the `/connections` and `/dashboard` disallows that `*` carries, for that crawler
 * only, silently. Naming an agent to be generous to it is how a site accidentally opens its
 * signed-in surfaces. `PRIVATE_PATHS` is therefore spread into every group, and
 * `registry.test.ts` asserts no group is missing it.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Tokens verified against each operator's own published documentation, not from memory.
 *
 * OpenAI (developers.openai.com/api/docs/bots): `GPTBot` crawls "content that may be used in
 * training our generative AI foundation models"; `OAI-SearchBot` surfaces sites in ChatGPT search;
 * `ChatGPT-User` serves user-initiated fetches. Anthropic (support.claude.com): `ClaudeBot`
 * collects content for training, `Claude-User` serves user-initiated access, `Claude-SearchBot`
 * indexes for search. Google: `Google-Extended` is training-only, as above.
 *
 * A token nobody could verify is not listed. An invented user-agent string costs nothing to write
 * and silently governs no crawler at all, which is worse than an absent line because it reads on
 * the page as a decision that was taken.
 */
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl(process.env).replace(/\/$/, "");
  const disallow = [...PRIVATE_PATHS];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // One group per agent rather than one group naming all of them. A shared group is legal and
      // shorter; separate ones survive a later change that permits or refuses a single crawler
      // without anybody having to notice the others were riding on the same line.
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
