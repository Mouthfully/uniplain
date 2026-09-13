import { DPA_COPY } from "./dpa-content";

/**
 * ARTICLE 28(3), CLAUSE BY CLAUSE, AGAINST THE AGREEMENT THAT IS ACTUALLY PUBLISHED.
 *
 * `/dpa` is a PDPA s.40 instrument. Whether its clauses ALSO satisfy GDPR Art. 28(3)(a)-(h) is a
 * different question, and it is the first one a B2B reviewer asks: Art. 28(3) is a checklist, they
 * read it with the agreement open, and a missing sub-paragraph is a rejection rather than a
 * comment. Writing the agreement first and assuming the checklist fell out of it is how a document
 * comes back marked.
 *
 * It had not fallen out of it. Mapping the eleven clauses against the eight sub-paragraphs found:
 *
 *   (b) CONFIDENTIALITY OF AUTHORISED PERSONS -- absent entirely. No clause anywhere said that the
 *       people who can touch a customer's data are bound to keep it confidential. That is the one a
 *       reviewer notices first, because it is the shortest thing in the Article and the easiest to
 *       have.
 *   (a) instructions did not cover TRANSFERS, and said nothing about a law-compelled disclosure
 *       being notified to the customer first.
 *   (f) assistance stopped at breach. Art. 28(3)(f) spans Arts 32-36 -- security assessment, data
 *       protection impact assessment, prior consultation.
 *   (g) deletion offered export and account closure, which is a self-service feature, not the
 *       "at the choice of the controller, delete or return AFTER THE END OF PROVISION, and delete
 *       existing copies" the sub-paragraph asks for.
 *   (h) information was offered; ALLOWING AND CONTRIBUTING TO AUDITS was not.
 *
 * Five of eight. Those are now in the agreement, and this module reports each sub-paragraph against
 * the clause that answers it.
 *
 * (d) WAS THE EIGHTH, AND IT WAS CLOSED BY DROPPING AN ASSUMPTION RATHER THAN BY A DEPENDENCY.
 * Art. 28(2) requires the controller's prior authorisation for a sub-processor and, where that
 * authorisation is general, that the processor inform it of intended changes AND GIVE IT THE CHANCE
 * TO OBJECT. The agreement said no notice period was promised because no mechanism existed to give
 * one, and the note here said the same: the domain answers NODATA for MX, so the notice could not
 * be sent, so the sub-paragraph waited on DNS.
 *
 * THE ARTICLE SAYS INFORM, NOT SEND. The channel never had to be email. A dated change list on the
 * page the agreement points at, published thirty days before a change takes effect, plus a notice
 * on the screen a signed-in customer lands on, informs them -- and unlike a mailing list it cannot
 * bounce, cannot go to spam, and cannot be sent to an address whose owner left the company.
 *
 * Worth recording as a mistake rather than a win: this was written down as a founder task, in a
 * design note and in an issue, on the strength of an assumption about the medium that nobody
 * checked against the Article's actual words. A blocker that turns out to be a reading is the
 * cheapest kind to find and the easiest to leave sitting there for months.
 *
 * EVERY `met` ENTRY IS CHECKED AGAINST THE RENDERED CLAUSE, not against this file's opinion of it:
 * `article-28.test.ts` requires the quoted commitment to appear in `DPA_COPY`. A mapping that
 * asserts coverage the agreement does not contain is worse than no mapping, because it is the
 * document a reviewer is handed INSTEAD of reading the agreement.
 */

export interface Article28Clause {
  readonly subParagraph: "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
  /** What Art. 28(3) requires, in its own terms. */
  readonly requirement: string;
  readonly state: "met" | "absent";
  /** The clause of the agreement that answers it. */
  readonly clause: string;
  /**
   * A phrase from the published agreement that carries the commitment. The test looks for it in
   * `DPA_COPY`, so this cannot drift from the document without the build saying so.
   */
  readonly commitment: string;
}

export const ARTICLE_28_CLAUSES: readonly Article28Clause[] = [
  {
    subParagraph: "a",
    requirement:
      "Processes personal data only on documented instructions from the controller, including with regard to transfers to a third country, unless required by law -- in which case the processor informs the controller before processing unless the law forbids it.",
    state: "met",
    clause: DPA_COPY.instructionsHeading,
    commitment: "it will tell that customer before doing so unless the law forbids it from saying",
  },
  {
    subParagraph: "b",
    requirement:
      "Ensures that persons authorised to process the personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.",
    state: "met",
    clause: DPA_COPY.confidentialityHeading,
    commitment: "bound to keep it confidential",
  },
  {
    subParagraph: "c",
    requirement: "Takes all measures required pursuant to Article 32 (security of processing).",
    state: "met",
    clause: DPA_COPY.securityHeading,
    commitment: "separated at the database level rather than by application code",
  },
  {
    subParagraph: "d",
    // THE ONE THAT WAS ABSENT, AND THE ASSUMPTION THAT KEPT IT ABSENT. This read: a right to object
    // needs a notice, a notice needs a channel, and the domain answers NODATA for MX -- so the
    // sub-paragraph could not be met until somebody configured DNS.
    //
    // ART. 28(2) SAYS INFORM, NOT SEND. The channel did not have to be email. A dated change list
    // on the page this agreement points at, plus a notice on the screen a signed-in customer lands
    // on, informs them -- and unlike a mailing list it cannot bounce, cannot go to spam, and cannot
    // be sent to an address whose owner left the company. The blocker was an assumption about the
    // medium, not a missing dependency, and it had been written down as a founder task.
    requirement:
      "Respects the conditions in Art. 28(2) and 28(4) for engaging another processor -- in particular, where the controller's authorisation is general, informing it of intended changes and giving it the opportunity to object.",
    state: "met",
    clause: DPA_COPY.subProcessorHeading,
    commitment: "it takes effect no sooner than thirty days after it is published",
  },
  {
    subParagraph: "e",
    requirement:
      "Assists the controller, by appropriate technical and organisational measures and insofar as possible, in fulfilling its obligation to respond to data subject rights requests.",
    state: "met",
    clause: DPA_COPY.rightsHeading,
    commitment: "will pass on any such request it receives and will help the customer answer it",
  },
  {
    subParagraph: "f",
    requirement:
      "Assists the controller in ensuring compliance with Articles 32 to 36 -- security, breach notification to the authority and to data subjects, data protection impact assessment, and prior consultation.",
    state: "met",
    clause: DPA_COPY.breachHeading,
    commitment: "carry out a data protection impact assessment, or consult its regulator",
  },
  {
    subParagraph: "g",
    requirement:
      "At the choice of the controller, deletes or returns all personal data after the end of the provision of services, and deletes existing copies unless law requires storage.",
    state: "met",
    clause: DPA_COPY.deletionHeading,
    commitment: "When the service ends, the customer chooses",
  },
  {
    subParagraph: "h",
    requirement:
      "Makes available all information necessary to demonstrate compliance with this Article, and allows for and contributes to audits, including inspections, conducted by the controller or an auditor it mandates.",
    state: "met",
    clause: DPA_COPY.auditHeading,
    commitment: "will allow it and will take part rather than merely permit it",
  },
];

/** The sub-paragraphs a reviewer will mark. Handed over rather than left to be found. */
export function unmetClauses(): readonly Article28Clause[] {
  return ARTICLE_28_CLAUSES.filter((c) => c.state !== "met");
}
