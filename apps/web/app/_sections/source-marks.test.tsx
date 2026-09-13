import { existsSync } from "node:fs";
import { IMPLEMENTED_SOURCE_IDS, SOURCE_LABELS } from "@repo/brand";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ACTIONS, ActionSheet } from "./ActionSheet";
import { artworkSlugs, sourceMark } from "./_source-marks";

/**
 * WHERE A FIGURE CAME FROM, HELD TO WHAT THIS PRODUCT CAN ACTUALLY READ.
 *
 * The provenance row is a source claim on the home page, which is the thing
 * `docs/marketplane/58-plan-reconciliation.md` section 5.1 is almost entirely about. Its rule is
 * that FoodStory, Ocha, StoreHub, GrabFood, foodpanda, LINE MAN, Booking.com, K PLUS, SCB, Shopee,
 * Lazada and TikTok Shop must not appear as sources "in any form -- logo, chip, 'planned' row or
 * FAQ sentence" while they do not exist.
 *
 * A chip with a logo on it is exactly the form that rule names. So the defence is not that this
 * row is different in kind -- it is that a source here is an **id** checked against
 * `IMPLEMENTED_SOURCE_IDS`, which `check-capabilities.mjs` already holds against the source tree.
 * The compiler refuses an unbuilt source at the type level; these assertions prove the set at
 * runtime, because a type is not a guard once someone writes a cast.
 *
 * THE MISSING ARTWORK IS THE CASE WORTH TESTING. Three of the seven implemented sources ship no
 * file, and the honest rendering is a label with no mark rather than a placeholder invented for
 * someone else's trademark. A `src` built from a slug that does not exist would render as a broken
 * image underneath a sentence asking the reader to trust where a number came from.
 */

const markup = renderToStaticMarkup(<ActionSheet />);
const text = markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

const PUBLIC = new URL("../../public/platforms/", import.meta.url).pathname;

describe("every source on a card is one this product can read", () => {
  it("puts sources on every action, so the assertions below are not vacuous", () => {
    expect(ACTIONS.length).toBeGreaterThan(0);
    for (const action of ACTIONS) {
      expect(action.sources.length, `${action.id} cites no source`).toBeGreaterThan(0);
    }
  });

  it("names no source that is not implemented", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. A chip reading "GrabFood" on the home page is the §5.1
    // violation in its exact named form, and the type alone does not stop a cast.
    for (const action of ACTIONS) {
      for (const id of action.sources) {
        expect(
          IMPLEMENTED_SOURCE_IDS as readonly string[],
          `${action.id} cites "${id}", which is not an implemented source`,
        ).toContain(id);
      }
    }
  });

  it("renders the label from the brand map rather than a retyped name", () => {
    for (const action of ACTIONS) {
      for (const id of action.sources) {
        expect(sourceMark(id).label).toBe(SOURCE_LABELS[id]);
        expect(text, `${SOURCE_LABELS[id]} is not rendered`).toContain(SOURCE_LABELS[id]);
      }
    }
  });
});

describe("the artwork is artwork that exists", () => {
  it("ships a file for every slug the map claims", () => {
    // A slug with no file renders a broken image under a sentence asking the reader to trust the
    // provenance, which is a worse outcome than showing no mark at all.
    const slugs = artworkSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(existsSync(`${PUBLIC}${slug}.svg`), `/platforms/${slug}.svg does not exist`).toBe(
        true,
      );
    }
  });

  it("emits no image for a source with no artwork, rather than a placeholder", () => {
    // Loyverse, Search Console and WooCommerce ship no file. Inventing a mark for them would be
    // artwork this repository made up for somebody else's trademark.
    const withoutArt = IMPLEMENTED_SOURCE_IDS.filter((id) => sourceMark(id).slug === null);
    expect(withoutArt.length, "every source now has artwork; re-read this test").toBeGreaterThan(0);

    const cited = new Set<string>(ACTIONS.flatMap((a) => [...a.sources]));
    const citedWithoutArt = withoutArt.filter((id) => cited.has(id));
    expect(citedWithoutArt.length, "no card cites an artwork-less source").toBeGreaterThan(0);

    for (const id of citedWithoutArt) {
      // The label is present, and no img src was built for it.
      expect(text).toContain(SOURCE_LABELS[id]);
      expect(markup, `an image was emitted for ${id}, which has no artwork`).not.toContain(
        `/platforms/${id}.svg`,
      );
    }
  });

  it("emits every image against a path under /platforms and with an empty alt", () => {
    const images = markup.match(/<img[^>]*>/g) ?? [];
    expect(images.length, "the provenance row rendered no artwork at all").toBeGreaterThan(0);
    for (const img of images) {
      expect(img, "a mark is served from outside /platforms").toMatch(
        /src="\/platforms\/[a-z0-9]+\.svg"/,
      );
      // The label sits beside the mark as live text; alt text would announce it twice. Same
      // decision `IntegrationsStrip` records for the same artwork.
      expect(img, "a decorative mark carries alt text").toContain('alt=""');
    }
  });
});

describe("the card still says the figures are samples", () => {
  it("keeps the sample label beside the provenance", () => {
    // Showing real connector names next to invented figures makes the sample MORE convincing, so
    // the label that stops it reading as a customer matters more after this change than before.
    expect(text).toContain("Sample figures");
  });
});
