import { brand } from "@repo/brand";

import { CURRENCIES } from "../_billing/plans";
import { SITE } from "../_content";

/**
 * WHETHER THE GDPR REACHES THIS ENTITY, ASSESSED FROM WHAT THE SITE ACTUALLY OFFERS.
 *
 * `AGENTS.md` §2 opens: "Applicability is genuinely open and nobody has decided it... That turns on
 * whether the business sells into the EU." That sentence has been false for as long as the pricing
 * table has existed. **The site sells into the EU.** It quotes prices in euros to any visitor,
 * tells them on every page that the product is built for businesses everywhere, heads the pricing
 * page "Priced in your currency", and adds tax at checkout according to where the buyer is.
 *
 * Nobody decided that as a legal position. A pricing table decided it, and the conclusion was never
 * carried back to the file that says the question is open.
 *
 * THIS MODULE DOES NOT ISSUE A LEGAL OPINION. It cannot, and a repository that invented one would
 * be doing the thing this one refuses everywhere else. What it does is narrower and harder to
 * argue with: it reads the configuration, scores it against the factors the EDPB actually names in
 * Guidelines 3/2018 for Art. 3(2)(a), and reports what it finds. A lawyer reaches the conclusion;
 * this makes sure they reach it holding the facts rather than the intention.
 *
 * WHY IT MATTERS MORE THAN THE OTHER OPEN ITEMS. Every other gap on the compliance list is a
 * MISSING DOCUMENT -- a DPA, a transfer instrument, a retention schedule. Those are things not yet
 * done. This is LIVE CONDUCT: if Art. 3(2)(a) is engaged, the obligations attached the day the
 * first euro price rendered, and Art. 27 requires a representative in the Union designated in
 * writing. An obligation is not a claim. `FORBIDDEN_CLAIMS` can stop the site SAYING it is GDPR
 * compliant; nothing in a claim gate stops the GDPR applying.
 *
 * THE HONEST RANGE OF OUTCOMES, since only one of them is "do nothing":
 *
 *   1. Counsel finds Art. 3(2)(a) engaged -> an Art. 27 representative must be designated, and
 *      every PDPA gap reappears with a different section number and a larger ceiling.
 *   2. The founder decides the EU is not a market -> the euro price, and the copy that offers the
 *      product everywhere, come off. That is a commercial decision and is NOT taken here.
 *   3. Counsel finds the factors insufficient -> the finding is recorded WITH THIS EVIDENCE, so
 *      the next person does not rediscover it, and the guard below reopens it if the facts move.
 *
 * Doing nothing is not on that list, which is the entire reason this file is generated rather than
 * written as a paragraph somebody can stop reading.
 */

export interface ScopeFactor {
  readonly id: string;
  /** The factor as the EDPB frames it, not as this company would like it framed. */
  readonly factor: string;
  /** Present in the configuration as it stands today. */
  readonly present: boolean;
  /** Where in this repository the answer was read from. A factor with no evidence is an opinion. */
  readonly evidence: string;
}

/** Currencies of Member States that the billing surface quotes. */
const EU_CURRENCIES = ["eur"] as const;

const offersEuroPrices = CURRENCIES.some((c) => (EU_CURRENCIES as readonly string[]).includes(c));

/**
 * Copy that offers the product without territorial limit.
 *
 * Read from the constants rather than matched against a typed sentence, so that rewording the
 * footer cannot silently remove a factor from the assessment. The words looked for are the ones
 * that make an offering universal; a site that named its markets would not contain them.
 */
const UNIVERSAL_OFFER = /\b(everywhere|worldwide|any country|globally)\b/i;
const universalCopy = [SITE.footerNote, SITE.footerNote2].filter((line) =>
  UNIVERSAL_OFFER.test(line),
);

export const SCOPE_FACTORS: readonly ScopeFactor[] = [
  {
    id: "member-state-currency",
    // EDPB Guidelines 3/2018 treat the possibility of paying in a currency of one or more Member
    // States -- other than the one generally used in the trader's own State -- as a factor. The
    // trader's State is Thailand; the euro is neither the local currency nor the account default.
    factor:
      "The service can be paid for in the currency of one or more Member States, which is not the currency generally used in the controller's own State.",
    present: offersEuroPrices,
    evidence: `apps/web/app/_billing/plans.ts CURRENCIES = [${CURRENCIES.join(", ")}]; brand.defaultCurrency = ${brand.defaultCurrency}; the controller is established in ${brand.postalAddress.country}`,
  },
  {
    id: "universal-offer",
    factor:
      "The offering is addressed without territorial limit, rather than to named markets, on every page.",
    present: universalCopy.length > 0,
    evidence:
      universalCopy.length > 0
        ? `apps/web/app/_content.ts SITE footer, rendered site-wide by app/_chrome.tsx: ${universalCopy.map((l) => `"${l}"`).join(" ")}`
        : "apps/web/app/_content.ts SITE footer names no territory-free offering",
  },
  {
    id: "currency-choice-offered",
    // Not the same factor as the first. That one is "euros are accepted"; this is the site
    // ADVERTISING currency choice as a feature, which speaks to what the controller envisages
    // rather than to what its payment processor happens to support.
    factor:
      "Currency choice is presented to the visitor as a feature of the offering, rather than being a payment-processor detail.",
    present: true,
    evidence:
      'apps/web/app/pricing/page.tsx heading "Priced in your currency."; PRICING copy states tax is added at checkout according to where the buyer is',
  },
  {
    id: "representative-designated",
    // Art. 27, the obligation that follows if the factors above engage Art. 3(2)(a).
    factor:
      "A representative in the Union is designated in writing, as Art. 27 requires of a controller not established in the Union.",
    present: brand.euRepresentative !== null,
    evidence: `packages/brand/src/brand.ts euRepresentative = ${JSON.stringify(brand.euRepresentative)}`,
  },
];

/** Factors pointing towards Art. 3(2)(a) being engaged, excluding the Art. 27 response to it. */
export function targetingSignals(): readonly ScopeFactor[] {
  return SCOPE_FACTORS.filter((f) => f.id !== "representative-designated" && f.present);
}

/**
 * Is the entity offering into the Union while holding no representative?
 *
 * THE QUESTION A BUYER'S COUNSEL ASKS IN FIVE MINUTES, and the one this repository could not answer
 * before. It is deliberately not called `isGdprApplicable`: that is a legal conclusion and this
 * returns a fact about the configuration.
 */
export function unrepresentedOffering(): boolean {
  return targetingSignals().length > 0 && brand.euRepresentative === null;
}

/**
 * WHAT WOULD HAVE TO CHANGE FOR THE OFFERING TO STOP REACHING THE UNION.
 *
 * Generated from the signals that are actually present, so it is a work list rather than an
 * opinion. It exists because the Art. 27 obligation has been described in four documents as
 * something to obtain, and never once as something to make inapplicable -- and Art. 27 applies only
 * because Art. 3(2)(a) is engaged, and Art. 3(2)(a) is engaged because of these three decisions.
 *
 * THIS IS NOT A RECOMMENDATION. The founder chose to keep the Union twice, on the record, and
 * `brand.unionOffering` is that answer. What was missing was the other side of the door written
 * down anywhere, so a decision taken when the cost was abstract could be retaken now that it is a
 * representative, a set of Clauses and a counsel opinion.
 */
export function closingRequirements(): readonly string[] {
  return targetingSignals().map((factor) => {
    switch (factor.id) {
      case "member-state-currency":
        return "Stop quoting a euro price. `CURRENCIES` in `apps/web/app/_billing/plans.ts` is where the offering accepts a Member State's currency, and the EDPB treats that as a targeting factor in its own right.";
      case "universal-offer":
        return "Stop addressing the offering without territorial limit. The footer constants in `_content.ts` render site-wide; a site that named its markets would not read as an offer to the Union.";
      case "currency-choice-offered":
        return "Stop presenting currency choice as a feature of the offering. `apps/web/app/pricing/page.tsx` heads the page with it, and that factor speaks to what the controller ENVISAGES -- the question Art. 3(2)(a) actually asks -- rather than to what a payment processor happens to support.";
      default:
        return `Remove the factor "${factor.id}", which this function does not have a description for -- add one rather than leaving a gap in a work list somebody would act on.`;
    }
  });
}

/**
 * Whether the recorded decision and the site agree.
 *
 * `"coherent"` in both directions. The two incoherent states are named separately because they are
 * different failures with different owners: a site offering to the Union while the record says it
 * does not is a compliance exposure nobody has decided to take, and a record saying the Union is
 * served by a site that names no territory is a set of obligations being carried for nothing.
 */
export function offeringCoherence(): "coherent" | "offers-undeclared" | "declared-unoffered" {
  const signals = targetingSignals().length > 0;
  if (brand.unionOffering === signals) return "coherent";
  return brand.unionOffering ? "declared-unoffered" : "offers-undeclared";
}
