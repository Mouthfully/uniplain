import type { Metadata } from "next";

import { SegmentPage, segmentMetadata } from "../_segment-page";

/**
 * `/for/salon` -- one of three static segment routes.
 *
 * The page itself is `../_segment-page.tsx`; this file exists so the route is a real path on disk,
 * which `_agent/registry.ts` requires of every indexable page and which a dynamic segment could
 * not satisfy. See that module's note.
 */
export const metadata: Metadata = segmentMetadata("salon");

export default function Page() {
  return <SegmentPage slug="salon" />;
}
