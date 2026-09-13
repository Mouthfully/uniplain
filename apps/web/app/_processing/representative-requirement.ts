import { PROCESSING_ACTIVITIES } from "./activities";
import { DPO_LIMBS } from "./dpo-requirement";
import { targetingSignals } from "./territorial-scope";

/**
 * IS AN ART. 27 REPRESENTATIVE ACTUALLY REQUIRED? THE EXEMPTION NOBODY HAD READ.
 *
 * Every document in this repository now says a representative in the Union is outstanding, and each
 * one treats that as obvious: Art. 3(2) is engaged, the controller is outside the Union, therefore
 * Art. 27(1) bites. **That skips Art. 27(2), which is the paragraph that decides whether Art. 27(1)
 * applies at all**, and which nobody here had read.
 *
 * The pattern is familiar enough by now to be worth naming. `AGENTS.md` said GDPR applicability was
 * open while the pricing table quoted euros. Art. 28(3)(d) sat recorded as blocked on DNS because
 * "inform" was read as "send". The DPO question sat undecided when its three limbs were all
 * assessable. **Each time the obstacle was a framing carried forward without being re-read**, and
 * each time it had been written down confidently enough that nobody re-opened it. "A representative
 * is required" is the same kind of sentence: true or false, never checked.
 *
 * So this checks it. Art. 27(2) disapplies the obligation in two cases:
 *
 *   (a) processing which is **occasional**, does not include on a large scale special categories or
 *       Art. 10 data, and **is unlikely to result in a risk** to the rights and freedoms of natural
 *       persons -- and these are CONJUNCTIVE, so failing any one leaves the obligation standing; or
 *   (b) the controller is a public authority or body.
 *
 * THE FINDING IS THAT THE EXEMPTION IS NOT AVAILABLE, and the reason is the first limb rather than
 * the dramatic one. This service reads a customer's connected accounts on a nightly schedule for
 * the duration of their subscription. That is the opposite of occasional, and it is the opposite of
 * occasional by design -- "every morning" is what the product is for. No amount of the other two
 * limbs going the company's way rescues it.
 *
 * WHY THAT IS WORTH BUILDING RATHER THAN ASSUMING. Two reasons, and the second is the point.
 *
 *   The obvious one: it settles a question that was being asserted. The conclusion happens to match
 *   what everybody assumed, which is the outcome an assessment is least likely to be built for and
 *   most useful in -- an assumption that turns out right is indistinguishable from one that turns
 *   out wrong until somebody checks.
 *
 *   The one that matters: it converts "we should probably get a representative" into a finding with
 *   the limb, the evidence and the reason attached. **The founder is being asked to engage a third
 *   party and pay them a recurring fee.** That request is worth a page that says exactly why, which
 *   limb closes the exemption, and what would have to change for it not to -- rather than a line on
 *   a gap list that everybody has stopped reading.
 */

export interface ExemptionLimb {
  readonly id: string;
  /** The limb as Art. 27(2) frames it. */
  readonly test: string;
  /** True where this limb is satisfied -- that is, where it points TOWARDS the exemption. */
  readonly satisfied: boolean;
  readonly evidence: string;
}

const specialCategories = DPO_LIMBS.find((l) => l.id === "special-categories");

export const EXEMPTION_LIMBS: readonly ExemptionLimb[] = [
  {
    id: "occasional",
    test: "The processing is occasional (Art. 27(2)(a), first limb).",
    // THE LIMB THAT CLOSES IT, and it closes by design rather than by accident.
    satisfied: false,
    evidence: `The service reads a customer's connected platform accounts on a nightly schedule for the duration of their subscription, and holds the result continuously. The scheduled sweep is declared in apps/api-edge/wrangler.jsonc and dispatched in src/scheduled.ts. Of ${PROCESSING_ACTIVITIES.length} processing activities, the core one is a standing nightly read -- "every morning" is what the product is sold as doing, so this is not occasional and cannot become occasional without the product becoming something else.`,
  },
  {
    id: "no-large-scale-special-categories",
    test: "The processing does not include, on a large scale, special categories of data under Art. 9 or personal data relating to criminal convictions and offences under Art. 10 (Art. 27(2)(a), second limb).",
    // Satisfied -- this limb DOES point towards the exemption. It does not rescue it, because the
    // three limbs of (a) are conjunctive, and stating that plainly is the point of scoring each.
    satisfied: specialCategories?.triggered === false,
    evidence: `Taken from the same scan the DPO assessment runs: ${specialCategories?.evidence ?? "the special-category limb is unavailable"}`,
  },
  {
    id: "unlikely-to-result-in-a-risk",
    test: "The processing is unlikely to result in a risk to the rights and freedoms of natural persons, taking into account its nature, context, scope and purposes (Art. 27(2)(a), third limb).",
    // NOT CLAIMED. A controller asserting its own processing is low-risk is the least reliable
    // sentence in data protection, and this one holds sealed platform credentials whose compromise
    // would reach a customer's advertising accounts. Scored `false` because it is not established,
    // which is the honest state -- and because nothing turns on it: the first limb already closes
    // the exemption, so claiming this one would be taking a position for no benefit.
    satisfied: false,
    evidence:
      "Not established, and not asserted. The service holds sealed credentials for a customer's platform accounts and the figures read from them; a compromise reaches a customer's advertising and commerce accounts. A controller's own assessment that its processing is low-risk is the least reliable sentence available, and nothing here turns on it because the first limb already closes the exemption.",
  },
  {
    id: "public-authority",
    test: "The controller is a public authority or body (Art. 27(2)(b)).",
    satisfied: false,
    evidence:
      "A Thai private limited company performing no public function. The same finding the DPO assessment records against Art. 37(1)(a).",
  },
];

/**
 * Is the Art. 27(2) exemption available?
 *
 * (a) is CONJUNCTIVE -- all three of its limbs must hold -- and (b) is an alternative. Written out
 * rather than reduced to `.every()`, because the structure of the paragraph is the thing a reader
 * needs to check and a clever one-liner would hide it.
 */
export function exemptionAvailable(): boolean {
  const limb = (id: string) => EXEMPTION_LIMBS.find((l) => l.id === id)?.satisfied === true;
  const paragraphA =
    limb("occasional") &&
    limb("no-large-scale-special-categories") &&
    limb("unlikely-to-result-in-a-risk");
  return paragraphA || limb("public-authority");
}

/**
 * Is a representative required on the facts as they stand?
 *
 * The chain, stated once so it can be checked rather than inferred: Art. 27(1) applies where
 * Art. 3(2) applies, and is disapplied by Art. 27(2). `territorial-scope.ts` holds the first link
 * and this module holds the second.
 */
export function representativeRequired(): boolean {
  return targetingSignals().length > 0 && !exemptionAvailable();
}

/**
 * What the founder is actually being asked for, stated once.
 *
 * NOT A DRAFT MANDATE. Art. 27(4) requires the representative to be mandated to be addressed by
 * supervisory authorities and data subjects on all issues related to the processing -- the terms of
 * that mandate are a contract with a named third party, and this repository does not have a party
 * to name. What it can do is say precisely what the engagement has to cover, so the request is a
 * specification rather than a vague obligation.
 */
export const DESIGNATION_REQUIREMENTS: readonly string[] = [
  "Established in one of the Member States where the data subjects whose data is processed are located (Art. 27(3)). Which Member State follows from where the customers are, which is a commercial fact this repository does not hold.",
  "Designated IN WRITING (Art. 27(1)). A verbal arrangement or an unsigned intention does not satisfy the Article.",
  "Mandated to be addressed in addition to, or instead of, the controller by supervisory authorities and data subjects on all issues related to the processing, for the purposes of ensuring compliance (Art. 27(4)).",
  "Named in the privacy notice so data subjects can reach them, which means brand.euRepresentative stops being null -- and three test files go red on that change until the assessments are rewritten to match it.",
  "Able to maintain the record of processing, which Art. 30(1) requires of the representative as well as the controller. That record already exists, generated, in apps/web/app/_processing/article-30.ts -- so this requirement is met the day the representative is engaged rather than being work that follows it.",
];
