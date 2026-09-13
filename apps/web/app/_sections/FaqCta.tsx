import { brand } from "@repo/brand";
import { claim, connectionAllowance } from "../_content";

/**
 * THE FAQ AND THE CLOSING PANEL -- the reference's `<section id="faq" class="section container
 * split faq">` and the `<section class="container final-cta">` directly beneath it. They ship in
 * one file because they are one closing movement in the design: the FAQ's bottom padding and the
 * panel's top margin are a single 20px seam in the stylesheet, and splitting them across two files
 * would put the two halves of that seam out of each other's sight.
 *
 * THE ACCORDION IS NATIVE, AND THAT IS THE POINT. `<details>`/`<summary>` already own everything a
 * hand-rolled accordion has to re-implement badly: keyboard operation, the expanded/collapsed state
 * announced to assistive tech, in-page find that opens the panel holding the match, and correct
 * behaviour before hydration. So this file ships no client boundary -- it stays a server component,
 * and the whole section costs zero JavaScript.
 *
 * THE +/- AFFORDANCE IS TWO ELEMENTS, NOT A SWAPPED `content`. The reference draws it with
 * `summary:after{content:'+'}` and `details[open] summary:after{content:'−'}`. Reproducing that
 * literally would mean a Tailwind arbitrary `content-['...']` carrying a non-ASCII glyph inside a
 * class name, which is a fragile thing to make a visual state depend on. Instead both glyphs are
 * real spans and `group-open:` shows one and hides the other -- still pure CSS, still no script,
 * but the glyphs live in the markup where they can be read. The pair is `aria-hidden` because the
 * disclosure state is already in the accessibility tree: a screen reader saying "plus" after the
 * question it just announced as collapsed is noise, not information.
 *
 * THE MARKER IS KILLED TWICE. `list-none` handles the standards-track triangle; the
 * `::-webkit-details-marker` rule handles older WebKit, which ignores it. Both are needed, and the
 * reference sets `list-style:none` for the same reason.
 *
 * THE CLOSING PANEL'S GRADIENT HAS NO TOKEN. The reference fills it with a two-stop pale blue to
 * pale mint wash. The token file defines the two brand gradients it needs (display text and the
 * hero glow) and no third one, so the panel takes the flat pale-blue inset surface instead -- the
 * token whose documented role is exactly this, a soft feature background. Writing the gradient's
 * two stops here would create a second source of truth for colour, which the tokens guard refuses
 * outright. See the report note.
 *
 * THE PANEL IS TWO ELEMENTS, NOT ONE. In the reference a single element is both the 1200px
 * container and the padded panel, so its 32px gutter and its 48px padding are set on the same box.
 * Split here: the outer <section> carries the width and the gutter, the inner <div> the fill,
 * radius and padding. Collapsed into one box the panel would run to the screen edges on any
 * viewport under 1200px, because the gutter would be inside the fill rather than outside it.
 */

/**
 * Section copy, rewritten for the new positioning.
 *
 * THE OLD FAQ ANSWERED A DASHBOARD BUYER. "What platforms does it support?", "Do I need technical
 * skills?" -- the questions of someone deciding between reporting tools. The page no longer sells a
 * reporting tool, so the questions an owner-operator actually has are the ones asked here: what
 * lands, where the numbers came from, whether anything gets changed on their behalf, and what it
 * costs.
 *
 * AND THE TRAP THIS FILE ALREADY WALKED INTO ONCE, which is why it is written down twice. The old
 * "Can I try it for free?" answer restated three claims -- "three connectors, daily refresh and
 * standard reports" -- that the pricing block one section above had just dropped. The FAQ is where
 * a reader goes precisely when the card did not answer them, so a claim withheld above and
 * restated here is a claim republished. Three consequences bind every answer below:
 *
 *   * No answer names a source. `docs/marketplane/58-plan-reconciliation.md` section 5.1 stops the
 *     Thai POS vendors, the delivery platforms and the banks appearing as sources anywhere on this
 *     site, and the old first answer listed an integration library by category. Gone, not moved.
 *   * No answer counts anything. `check-claim-sources.mjs` bans a source or integration count, and
 *     the reconciliation notes "200+" once evaded the pattern by putting the `+` where the regex
 *     expected whitespace. The guard is not the reason not to write a count.
 *   * Read-only is worded as WHAT WE ASK FOR AND ENFORCE, never as a guarantee the platforms make.
 *     Section 5.1 is explicit: it is true of Loyverse and Xero, and on QuickBooks, FlowAccount,
 *     Grab, foodpanda and StoreHub one token covers read and write, so the promise there is our
 *     code and not their scope.
 *
 * THEN THE BUYER CHANGED AGAIN, AND THE QUESTIONS DID NOT. The six above are the questions of one
 * person deciding whether to bother. A business asks four others before it signs anything, and
 * until now every one of them was answered only on `/privacy` and `/terms` -- which is to say, only
 * to a reader who had already decided. Four are added here, and each is answerable TODAY from
 * something in this repository rather than from something on a roadmap:
 *
 *   * DELEGATED ACCESS, because for a Thai SMB the bookkeeping is somebody else's job. `/members`
 *     ships (`docs/marketplane/72-people-in-an-account.md`): its roles, the one-owner floor and the
 *     hand-delivered invitation are all real, and the answer says so in the account holder's words.
 *   * WHO HERE CAN SEE IT, answered with the mechanism and no compliance verdict. Row access is
 *     decided by `20260908000700_rls.sql` per workspace, and the scheduler is a second identity
 *     that holds execute on `due_connections` and no table grant at all -- scheduling metadata,
 *     never a figure. What the answer does NOT say is "nobody here can see your data": a
 *     service-role key exists for the billing webhook (`_billing/stripe.ts`), and a sentence that
 *     forgets it would be the comfortable half of a true statement.
 *   * TRAINING, which is the one genuine differentiator on the page. It goes through `claim()`
 *     rather than being written here, because `no-training` is already an allowed claim with a
 *     citation; the second sentence is the enforcement, phrased as what `request.ts` and
 *     `client.ts` actually do. `request.ts` warns in its own module note that `data_collection:
 *     "deny"` still leaves retention at some providers, so the answer promises OUR conduct and not
 *     the provider's.
 *   * LEAVING, which is the one that had to be written down rather than sold. There is no export
 *     path, no erasure path and no retention timer anywhere -- `AGENTS.md` gaps 1 and 6 -- so the
 *     answer states the limit instead of the wish: revoking at the platform is the part a customer
 *     can do unilaterally, and everything else is a request handled by hand, which is exactly what
 *     `/privacy` already commits to. Promising a button here would be the worst sentence on the
 *     site, because it is the one a customer only tests on the day they are already unhappy.
 *
 * AND ONE QUESTION WAS DELETED RATHER THAN REWRITTEN. "Can I change plans later?" was answered
 * with "the pricing model is designed to let you upgrade as your data and team grow", which
 * asserts nothing and cannot be checked. What the code does is narrower than the sentence implies:
 * `_billing/actions.ts` opens a checkout for a chosen plan and the provider's own portal for cards,
 * invoices and cancellation, and there is no swap, proration or downgrade path anywhere. So the
 * true half of it moved into the plan answer, where the allowance already is.
 *
 * The eyebrow is stored in sentence case because the capitals are CSS, not content.
 */
const EYEBROW = "Frequently asked questions";

/** The line break inside the heading is the design's, so the two lines are two values. */
const HEADING_TOP = "Still have questions?";
const HEADING_BOTTOM = "We're here to help.";

const LEAD = "Find setup guides, field definitions, and answers in our documentation.";
const HELP_LINK_LABEL = "Visit the help center";

/**
 * The first question names the product, which may not be typed as a literal anywhere outside the
 * brand package -- `scripts/check-brand.mjs` enforces that. The brand file holds the name as a
 * lowercase identifier, so only the leading capital the sentence needs is derived here. This is the
 * same derivation the first split section makes, for the same reason.
 */
const PRODUCT = brand.productName;

const QUESTIONS = [
  {
    question: `What does ${PRODUCT} send me each morning?`,
    // The second sentence was "You can reply to ask a follow-up, in Thai or English." It is gone
    // for the reason given at `FeatureGrid`'s brief card: no channel adapter exists, so there is
    // nothing to reply to, and -- the half that is not merely unbuilt -- NOTHING IN THIS REPOSITORY
    // IS LOCALISED TO THAI. Not a string table, not a locale, not a model instruction. Naming a
    // language is a specific promise a customer tests on their first attempt.
    answer:
      "Yesterday in three lines, anything that looks unusual, and one thing worth doing today. " +
      "Every figure in it names the source it came from and the time it was read.",
  },
  {
    question: "Where do the numbers come from?",
    answer:
      "From the tools you log in to yourself. Every figure carries the time it was read and a " +
      "marker for as long as the platform may still revise it. On a shop's own till that marker " +
      "never comes off, and the brief says so in words.",
  },
  {
    question: "Will it change anything in my accounts?",
    answer:
      "No. Nothing is done for you: you stay in control of prices, ads and staff. We ask each " +
      "platform for read access only, and where a platform will not issue a token limited to " +
      "reading, our own code is what refuses to write.",
  },
  {
    question: "Do I need to understand any of the charts?",
    answer:
      "The brief is sentences. A chart is there if you want to look, and nothing asks you to " +
      "read one to find out what to do.",
  },
  {
    question: "Can I give my accountant access without giving them my login?",
    // A SHARED LOGIN IS THE DEFAULT ANSWER WHEN THE PRODUCT HAS NO SECOND ONE, and it is the one
    // thing a bookkeeping firm should never be handed. Every clause here is a real behaviour of
    // `/members`: `ROLE_DESCRIPTIONS` is what "read the figures" and "connect a source" come from,
    // the one-owner floor is a trigger rather than a screen rule (note 72 section 2), and an
    // invitation can be withdrawn because the row records the withdrawal instead of vanishing.
    //
    // THE LAST SENTENCE IS THE HONEST ONE AND IT IS NOT AN APOLOGY. Nothing here sends mail --
    // `docs/marketplane/70-the-mail-nobody-can-send-yet.md` -- so a buyer who reads "invite" and
    // expects an email to arrive would find out on their first attempt. Saying which way the link
    // travels costs one clause; discovering it costs the trust the rest of the page is asking for.
    answer:
      "Yes. Add them with their own sign-in, and choose what they may do: read the figures in the " +
      "workspaces you give them, or that plus connecting a source and inviting other people. You " +
      "can change what somebody may do later, take an invitation back before it is used, or " +
      "remove them, and an account always keeps at least one owner so nobody can shut everybody " +
      "out. Nothing is sent for you: the invitation is a link you pass on yourself.",
  },
  {
    question: "Who at your company can see my numbers?",
    // NO JARGON AND NO VERDICT. "Row-level security", "tenant isolation" and any of the four
    // acronyms would each be a word the reader has to take on trust; the mechanism said plainly is
    // checkable by the person asking. The sentence that is deliberately absent is "nobody here can
    // see it" -- see the module note, which names the key that makes it false.
    answer:
      "Which figures a signed-in person may read is decided by the database, one workspace at a " +
      "time, rather than by the screen doing the asking. Somebody who was never added to your " +
      "account cannot reach it by opening the right page. The nightly job that works out whose " +
      "data is due to be fetched is a separate identity that can read the schedule and no figures " +
      "at all.",
  },
  {
    question: "Is my data used to train AI models?",
    // THE FIRST SENTENCE IS `claim()` AND NOT PROSE. `no-training` is an allowed claim with a
    // specification citation, so writing the same promise by hand would be a sentence that reads
    // identically and is reviewed by nothing -- the exact failure `65-the-deletion-pass.md`
    // records. The rest is the enforcement, and it stops where the enforcement stops: `request.ts`
    // notes that `data_collection: "deny"` still leaves retention at some providers, so this says
    // what we send and what we refuse to send, never what a provider guarantees.
    answer: `${claim("no-training")} Every request that leaves for a model carries the instruction that the provider may not collect or keep it, and our own code refuses to send one that does not. What it carries is figures and metric labels: not your business name, not your customers, not an account id.`,
  },
  {
    // The second person stays singular here, as it is in every other question, even though this is
    // the one a finance director asks. A page that switches between "my" and "our" halfway down
    // reads as two people writing, which is the impression a buyer weighing a supplier notices.
    question: "What happens to my data if I stop paying or leave?",
    // WHAT THIS ANSWER CANNOT SAY, WHICH IS MOST OF WHAT A BUYER WANTS TO HEAR. There is no export
    // route, no erasure route and no retention timer in any migration or module (`AGENTS.md` gaps
    // 1 and 6). Revocation is the one lever that genuinely belongs to the customer, so it leads;
    // the rest is stated as a limit. `/privacy` already says requests are dealt with individually
    // and by hand, and this answer points at that rather than inventing a better-sounding version
    // of it. Rewrite this the day a deletion path ships, and not one commit earlier.
    answer:
      "Revoking our access at the platform stops any further reading, and that is yours to do " +
      "without asking us first. What was read before then stays where it is: no schedule clears " +
      "it out and no button on this site does either. The privacy notice says what is held and " +
      "how to ask about it, and a request of that kind is dealt with by hand.",
  },
  {
    question: "Can I try it for free?",
    // THE OLD ANSWER RESTATED ALL THREE CLAIMS /pricing HAD JUST DROPPED -- "three connectors,
    // daily refresh, and standard reports" -- one section below the pricing block that no longer
    // makes any of them. Deleting a claim from the page that sells it and leaving it in the FAQ
    // republishes it; the FAQ is where a reader goes precisely when the card did not answer them.
    //
    // The allowance is the one part that survives, because `PLAN_ENTITLEMENTS` backs it, and it is
    // read from there rather than spelled out so the answer cannot drift from the card above it.
    //
    // THE SECOND SENTENCE IS WHAT IS LEFT OF "CAN I CHANGE PLANS LATER?". It names where the
    // decision is made and who holds the card, both of which are true of `_billing/actions.ts`
    // today. It does not say the change is instant, prorated or reversible, because no code in
    // this repository swaps a subscription's price -- see the module note.
    answer:
      `The Free plan includes ${connectionAllowance("free")}. ` +
      "Choosing a plan happens on your billing page, and the card, the invoices and cancelling " +
      "are handled by our payment provider rather than by us, so nothing here holds your card " +
      "details.",
  },
] as const;

/**
 * The closing panel.
 *
 * "READY TO UNIFY YOUR DATA?" IS NAMED IN SECTION 5.1 AS COPY THAT MUST STOP, alongside its lead,
 * "One connected workspace. A clearer way forward." Both sold the plumbing. The panel now closes on
 * the thing the page spent its length arguing: connect it tonight, and tomorrow you are told what
 * to do rather than shown a chart.
 *
 * WHAT THE ARTBOARD'S OWN CLOSING LINE SAYS, AND WHY IT IS NOT HERE. It reads "Free to start; pay
 * as you go after that, nothing monthly." `FORBIDDEN_CLAIMS` in `packages/brand/src/claims.ts` bans
 * `/\bnothing monthly\b|\bpay as you go\b/i` and `page.test.tsx` asserts the rendered page matches
 * no forbidden pattern, so writing the plan's sign-off would be a red build. Billing is
 * subscriptions -- four plans and six live Stripe prices -- and the lead says only what the Free
 * tier really is.
 */
const CTA_HEADING = "Connect tonight. Decide at breakfast.";
const CTA_LEAD = "Free to start. We ask each platform for read access and nothing more.";
const CTA_LABEL = "Start free";

export function Faq() {
  return (
    // The design's `.split`: 1fr 1fr with an 80px gutter, narrowing to 40px once the columns get
    // cramped and collapsing to one column below 768px -- the same three steps the other split
    // sections take. The top padding is 40px rather than the section scale's 80px because the
    // reference halves it here, closing the gap to the pricing table above.
    <section
      id="faq"
      className="mx-auto grid max-w-[1200px] items-center gap-8 px-8 pt-5 pb-12 md:grid-cols-2 md:gap-10 md:pt-10 md:pb-20 lg:gap-20"
    >
      <div className="min-w-0">
        <span className="text-ink-faint block text-[11px] font-bold tracking-[0.14em] uppercase md:text-xs">
          {EYEBROW}
        </span>
        <h2 className="font-display text-ink mt-[18px] text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[36px]">
          {HEADING_TOP}
          <br />
          {HEADING_BOTTOM}
        </h2>
        <p className="text-ink-muted mt-5 max-w-[475px] leading-[1.65]">{LEAD}</p>

        {/* THE HELP CENTRE HAS A ROUTE NOW, and this comment used to say it did not. `/docs`
            shipped and this link was never updated, so the closing section of the home page sent
            readers to an anchor no element carries. That is the failure mode of a placeholder that
            reads like a decision: it survives the thing it was waiting for. */}
        <a
          href="/docs"
          className="text-accent mt-6 inline-flex items-center gap-3 text-sm font-bold hover:underline"
        >
          {HELP_LINK_LABEL}
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>

      <div className="min-w-0">
        {QUESTIONS.map((item) => (
          <details key={item.question} className="group border-line border-b py-[18px]">
            <summary className="text-ink flex cursor-pointer list-none justify-between gap-5 text-sm font-bold [&::-webkit-details-marker]:hidden">
              {item.question}
              {/* Hidden from assistive tech: <details> already announces expanded/collapsed. */}
              <span aria-hidden="true" className="text-ink-subtle shrink-0 leading-[1.5]">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">&#8722;</span>
              </span>
            </summary>
            <p className="text-ink-muted mt-3.5 text-sm leading-[1.65]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    // No `.section` class in the reference, so this one carries margins rather than the 80px
    // section padding: the panel sits tight under the FAQ and holds the page's bottom margin.
    <section className="mx-auto mt-5 mb-[45px] max-w-[1200px] px-8 md:mb-[70px]">
      <div className="bg-surface-inset flex flex-col gap-6 rounded-xl p-[30px] md:flex-row md:items-center md:justify-between md:p-12">
        <div className="min-w-0">
          <h2 className="font-display text-ink text-[28px] leading-[1.16] font-semibold tracking-[-0.03em] md:text-[30px]">
            {CTA_HEADING}
          </h2>
          <p className="text-ink-muted mt-2.5 leading-[1.65]">{CTA_LEAD}</p>
        </div>

        {/* Points at the pricing section, as the reference does -- "start free" means "choose the
            Free tier", and the tiers are the thing directly above. */}
        <a
          href="#pricing"
          className="bg-accent text-ink-on-accent hover:bg-accent-hover inline-flex min-h-[46px] shrink-0 items-center justify-center gap-[18px] rounded-md px-[22px] py-3 text-sm font-bold transition-colors"
        >
          {CTA_LABEL}
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </section>
  );
}
