import { brand } from "@repo/brand";

import type { EmailMessage } from "./send.ts";

/**
 * THE MESSAGES THIS PRODUCT SENDS, AND THE ONES IT REFUSES TO.
 *
 * Four templates: a welcome, a how-to-use, the brief itself on whatever cadence, and -- the one
 * worth arguing for -- a message that says no brief could be written and why.
 *
 * ================================================================================================
 * WHAT THESE MAY NOT SAY, WHICH IS MOST OF THE DESIGN
 * ================================================================================================
 *
 * 1. NO NUMBER THAT DID NOT COME FROM THE ENGINE. `verify.ts` refuses a whole insight over one
 *    numeral it cannot trace; an email template that then added "3 actions this week" around it
 *    would reintroduce exactly the fabrication the gate exists to stop, one layer further out and
 *    past every check. So the only digits any template here emits are ones handed to it: the
 *    period's own dates, and the text the verifier already passed. `templates.test.ts` asserts it
 *    by rendering with a figure set and checking every numeric token against the allowed set.
 *
 * 2. NO CADENCE THE PRODUCT DOES NOT KEEP. Nothing schedules a brief today -- no cron calls the
 *    engine, and until the domain's DNS exists nothing can be delivered at all. So the welcome
 *    message does NOT say "you will get a brief every morning". It says what actually happens:
 *    connect a source, and ask for a brief when you want one. The day a scheduler exists, this
 *    copy changes in the same commit as the cron and not before.
 *
 * 3. NO CLAIM `FORBIDDEN_CLAIMS` BANS. These are customer-facing sentences that never pass through
 *    a React page, so `forbidden-claims.test.ts` -- which scans routes under `apps/web/app` -- does
 *    not see them. A template is exactly the blind spot that guard has, so this package runs the
 *    same ban list over every rendered message.
 *
 * ================================================================================================
 * WHY THE INPUT SHAPE IS DEFINED HERE RATHER THAN IMPORTED FROM `@repo/insights`
 * ================================================================================================
 *
 * A plain-text renderer has no business depending on the engine. `BriefContent` below is the
 * narrowest thing a message needs, and the caller maps a `GenerateResult` onto it -- which keeps
 * the mail package installable in the Worker without pulling the arithmetic in behind it, and keeps
 * this file honest about what it actually consumes.
 */

/** One figure as a message prints it. The caller maps this from the engine's `Figure`. */
export interface BriefFigure {
  readonly label: string;
  readonly text: string;
  readonly sources: readonly string[];
  readonly fetchedAt: string | null;
  readonly provisional: boolean;
}

export interface BriefContent {
  readonly summary: readonly string[];
  readonly unusual: string | null;
  readonly action: { readonly title: string; readonly why: string } | null;
  readonly figures: readonly BriefFigure[];
  readonly period: { readonly from: string; readonly to: string };
}

/**
 * How long a brief covers.
 *
 * NOT A PROMISE ABOUT WHEN IT ARRIVES. It names the span the figures describe -- seven days or a
 * calendar month -- which is a property of the data and true whenever the message is sent. A word
 * like "daily" would be a claim about a schedule, and there is no schedule.
 */
export const BRIEF_SPANS = ["week", "month"] as const;

export type BriefSpan = (typeof BRIEF_SPANS)[number];

const SPAN_WORD: Readonly<Record<BriefSpan, string>> = {
  week: "seven days",
  month: "month",
};

/* ==============================================================================================
 * COPY
 * ============================================================================================ */

/**
 * Every sentence, in one place.
 *
 * The product name is interpolated from `packages/brand` rather than typed: `check-brand.mjs`
 * refuses the identity string anywhere else, comments included, and it has already caught this
 * author once in this package.
 */
const PRODUCT = brand.productName;

export const EMAIL_COPY = {
  welcomeSubject: `Your ${PRODUCT} account is ready`,
  welcomeOpening: "Your account is set up. Here is what it does and what it needs from you.",
  welcomeWhat:
    "It reads the tools your business already runs on, works out what changed, and writes it in plain sentences. Every figure it gives you names the source it came from and the time it was read.",
  welcomeNext: "Two things get you to a first brief:",
  welcomeStepConnect: "Connect a source. You log in to it yourself; we ask for read access only.",
  welcomeStepAsk:
    "Open the brief page, say what kind of business you run, and ask for a brief. It reads your rows and writes one.",
  // NO CADENCE. Nothing schedules a brief, so nothing here says one arrives.
  welcomeCadence:
    "Briefs are written when you ask for one. Nothing is sent on a schedule at the moment, and this message will say so differently when that changes.",
  welcomeControl:
    "Nothing is done for you. The product reads; it never writes back to a connected tool, so prices, ads and staffing stay yours.",

  howToSubject: `Getting a first brief out of ${PRODUCT}`,
  howToOpening: "A brief needs rows, and rows come from a connected source. The order is short.",
  howToConnect:
    "Connect a source from the connections page. You sign in at the platform itself and approve read access, so no password is ever typed into this product.",
  howToWait:
    "Give it a night. The first read pulls your recent history, and a figure is only as settled as the platform that reported it.",
  howToAsk:
    "Open the brief page and choose the kind of business you run. That decides which numbers lead; nothing works it out from your data, so you say it.",
  howToRead:
    "Read the three lines, then the one thing worth doing. Underneath each figure is the source it came from and the moment it was read.",
  howToRefusal:
    "If a figure cannot be traced back to your own rows, you get no brief rather than a guess. That is deliberate, and it is the whole reason to trust the ones you do get.",

  briefIntro: "Here is what changed, from your own rows.",
  unusualHeading: "Worth a look",
  actionHeading: "One thing to do",
  figuresHeading: "The figures, with where each came from",
  provisionalNote: "may still be restated",

  refusalSubject: "No brief this time, and why",
  refusalOpening:
    "Nothing is attached, and that is a decision rather than a fault. A brief was not written for the period below, and the reason is named underneath.",
  refusalTrust:
    "A brief you never see is the alternative to one you cannot trust. Nothing here is estimated to fill the gap.",

  signOffHelp: "Reply to this message if something looks wrong.",
} as const;

/* ==============================================================================================
 * TEMPLATES
 * ============================================================================================ */

/** Joins paragraphs with a blank line between them, dropping any that are empty. */
function body(lines: readonly (string | null)[]): string {
  return lines.filter((line): line is string => line !== null && line !== "").join("\n\n");
}

/** A numbered step list, which is the only place this file emits a digit of its own. */
function steps(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function welcomeEmail(to: string): EmailMessage {
  return {
    to,
    subject: EMAIL_COPY.welcomeSubject,
    text: body([
      EMAIL_COPY.welcomeOpening,
      EMAIL_COPY.welcomeWhat,
      EMAIL_COPY.welcomeNext,
      steps([EMAIL_COPY.welcomeStepConnect, EMAIL_COPY.welcomeStepAsk]),
      EMAIL_COPY.welcomeCadence,
      EMAIL_COPY.welcomeControl,
      EMAIL_COPY.signOffHelp,
    ]),
  };
}

export function howToUseEmail(to: string): EmailMessage {
  return {
    to,
    subject: EMAIL_COPY.howToSubject,
    text: body([
      EMAIL_COPY.howToOpening,
      steps([
        EMAIL_COPY.howToConnect,
        EMAIL_COPY.howToWait,
        EMAIL_COPY.howToAsk,
        EMAIL_COPY.howToRead,
      ]),
      EMAIL_COPY.howToRefusal,
      EMAIL_COPY.signOffHelp,
    ]),
  };
}

/**
 * The brief itself.
 *
 * THE SUBJECT CARRIES THE SPAN AND THE DATES AND NOTHING ELSE. A subject line summarising the
 * result -- "takings up this week" -- would be a claim made outside the verifier, by code that
 * never saw the figures. The dates are facts about the request.
 */
export function briefEmail(to: string, span: BriefSpan, content: BriefContent): EmailMessage {
  const provenance = content.figures
    .filter((figure) => figure.sources.length > 0 && figure.fetchedAt !== null)
    .map(
      (figure) =>
        `- ${figure.label}: ${figure.text} (${figure.sources.join(", ")}, read ${figure.fetchedAt}${
          figure.provisional ? `, ${EMAIL_COPY.provisionalNote}` : ""
        })`,
    )
    .join("\n");

  return {
    to,
    subject: `Your ${SPAN_WORD[span]}: ${content.period.from} to ${content.period.to}`,
    text: body([
      EMAIL_COPY.briefIntro,
      content.summary.join("\n"),
      content.unusual === null ? null : `${EMAIL_COPY.unusualHeading}\n${content.unusual}`,
      content.action === null
        ? null
        : `${EMAIL_COPY.actionHeading}\n${content.action.title}\n${content.action.why}`,
      provenance === "" ? null : `${EMAIL_COPY.figuresHeading}\n${provenance}`,
      EMAIL_COPY.signOffHelp,
    ]),
  };
}

/**
 * No brief, and why.
 *
 * THIS TEMPLATE IS THE PRODUCT'S THESIS IN EMAIL FORM, which is why it exists rather than the
 * message simply not being sent. An owner expecting something and receiving silence learns that
 * the product is unreliable; an owner who is told a figure could not be traced learns that it
 * refuses to guess. The `reason` is the engine's own code and detail, passed through unedited.
 */
export function refusalEmail(
  to: string,
  span: BriefSpan,
  period: { readonly from: string; readonly to: string },
  reason: string,
): EmailMessage {
  return {
    to,
    subject: `No ${SPAN_WORD[span]} brief: ${period.from} to ${period.to}`,
    text: body([
      EMAIL_COPY.refusalOpening,
      `${period.from} to ${period.to}`,
      reason,
      EMAIL_COPY.refusalTrust,
      EMAIL_COPY.signOffHelp,
    ]),
  };
}
