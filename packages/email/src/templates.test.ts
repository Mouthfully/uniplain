import { FORBIDDEN_CLAIMS, brand } from "@repo/brand";
import { describe, expect, it } from "vitest";

import {
  type BriefContent,
  BRIEF_SPANS,
  EMAIL_COPY,
  briefEmail,
  howToUseEmail,
  refusalEmail,
  welcomeEmail,
} from "./templates.ts";

const TO = "owner@example.test";

const CONTENT: BriefContent = {
  summary: ["Takings held steady.", "Orders held steady.", "Nothing broke."],
  unusual: "One channel was quiet on Tuesday.",
  action: { title: "Look at Tuesday lunch", why: "It was the quietest slot of the week." },
  figures: [
    {
      label: "Takings",
      text: "THB 12,450.00",
      sources: ["woocommerce"],
      fetchedAt: "2026-09-12T23:30:00Z",
      provisional: true,
    },
    {
      label: "Orders",
      text: "318",
      sources: ["woocommerce"],
      fetchedAt: "2026-09-12T23:30:00Z",
      provisional: false,
    },
  ],
  period: { from: "2026-09-06", to: "2026-09-12" },
};

/** Every message this package can produce, for the checks that must hold across all of them. */
function everyMessage() {
  return [
    welcomeEmail(TO),
    howToUseEmail(TO),
    ...BRIEF_SPANS.map((span) => briefEmail(TO, span, CONTENT)),
    ...BRIEF_SPANS.map((span) =>
      refusalEmail(TO, span, CONTENT.period, "unverifiable_number: THB 900.00 is not any figure"),
    ),
  ];
}

describe("what every message must satisfy", () => {
  /**
   * THE BLIND SPOT THIS CLOSES. `forbidden-claims.test.ts` scans routes under `apps/web/app`. An
   * email never passes through a React page, so a banned claim written here would reach a customer
   * without any existing guard seeing it. This runs the same ban list over every rendered message.
   */
  it("matches no forbidden claim, in subject or body", () => {
    for (const message of everyMessage()) {
      for (const text of [message.subject, message.text]) {
        const hit = FORBIDDEN_CLAIMS.find((entry) => entry.pattern.test(text));
        expect(hit, `forbidden claim in an email: ${hit?.reason}`).toBeUndefined();
      }
    }
  });

  /**
   * NO CADENCE THE PRODUCT DOES NOT KEEP. Nothing schedules a brief, and until the domain's DNS
   * exists nothing can be delivered at all. A welcome message promising a brief every morning would
   * be false on the day it was sent.
   */
  it("promises no schedule, because there is none", () => {
    for (const message of everyMessage()) {
      const text = `${message.subject} ${message.text}`;
      expect(text).not.toMatch(/every (morning|day|week|month)\b/i);
      expect(text).not.toMatch(/\beach (morning|day)\b/i);
      expect(text).not.toMatch(/\bwe.ll send\b|\bwill arrive\b|\bdelivered (each|every)\b/i);
    }
  });

  it("says who it is from without typing the identity strings", () => {
    // The product name reaches the copy through `packages/brand`; this asserts it actually arrives,
    // so a refactor that broke the interpolation would not ship messages naming nobody.
    expect(welcomeEmail(TO).subject).toContain(brand.productName);
  });

  it("addresses the recipient it was given and nobody else", () => {
    for (const message of everyMessage()) expect(message.to).toBe(TO);
  });

  it("writes a real subject and body for each", () => {
    for (const message of everyMessage()) {
      expect(message.subject.length).toBeGreaterThan(8);
      expect(message.text.split(/\s+/).length).toBeGreaterThan(20);
      expect(message.text).not.toMatch(/TODO|TBD|lorem|\{\{|\}\}/i);
    }
  });
});

describe("the brief message", () => {
  /**
   * THE ONE THAT MATTERS MOST.
   *
   * `verify.ts` refuses a whole insight over one numeral it cannot trace. A template that then
   * wrapped the verified text in numbers of its own -- "3 actions", "up 12%" -- would reintroduce
   * the fabrication one layer further out, past every check, on the copy a customer actually reads.
   *
   * So: every numeric token in the rendered message must come from the content it was handed. The
   * allowed set is the figures' own text, the period dates, and the step numbers in the fixed
   * copy -- nothing else.
   */
  it("emits no number that did not come from the content it was given", () => {
    for (const span of BRIEF_SPANS) {
      const message = briefEmail(TO, span, CONTENT);
      const rendered = `${message.subject}\n${message.text}`;

      const given = [
        ...CONTENT.summary,
        CONTENT.unusual ?? "",
        CONTENT.action?.title ?? "",
        CONTENT.action?.why ?? "",
        ...CONTENT.figures.flatMap((f) => [f.text, f.fetchedAt ?? "", ...f.sources]),
        CONTENT.period.from,
        CONTENT.period.to,
      ].join(" ");

      const tokensIn = (text: string) => (text.match(/\d[\d,._:-]*/g) ?? []).map((t) => t.trim());
      const allowed = new Set(tokensIn(given));

      for (const token of tokensIn(rendered)) {
        expect(allowed.has(token), `"${token}" is in the email and not in the content`).toBe(true);
      }
    }
  });

  it("keeps the subject to the span and the dates, with no claim about the result", () => {
    const subject = briefEmail(TO, "week", CONTENT).subject;
    expect(subject).toContain(CONTENT.period.from);
    expect(subject).toContain(CONTENT.period.to);
    // A subject summarising the outcome would be a claim made outside the verifier, by code that
    // never saw the figures.
    expect(subject).not.toMatch(/\bup\b|\bdown\b|\bfell\b|\brose\b|\bgrew\b|\bdropped\b/i);
  });

  it("carries the source and read time for every figure that has them", () => {
    const text = briefEmail(TO, "week", CONTENT).text;
    for (const figure of CONTENT.figures) {
      expect(text).toContain(figure.label);
      expect(text).toContain(figure.text);
      expect(text).toContain(figure.sources[0] as string);
      expect(text).toContain(figure.fetchedAt as string);
    }
  });

  it("marks a figure that may still be restated, and does not mark one that may not", () => {
    const lines = briefEmail(TO, "week", CONTENT).text.split("\n");
    // ANCHORED TO THE PROVENANCE LINE'S OWN PREFIX. Matching on "Takings" alone found the summary
    // sentence "Takings held steady." first, which carries no marker and never should -- the marker
    // belongs to the figure, not to the model's prose about it.
    const takings = lines.find((line) => line.startsWith("- Takings")) ?? "";
    const orders = lines.find((line) => line.startsWith("- Orders")) ?? "";
    expect(takings).toContain(EMAIL_COPY.provisionalNote);
    expect(orders).not.toContain(EMAIL_COPY.provisionalNote);
  });

  it("omits an absent unusual line and an absent action rather than printing an empty heading", () => {
    const bare = briefEmail(TO, "week", { ...CONTENT, unusual: null, action: null }).text;
    expect(bare).not.toContain(EMAIL_COPY.unusualHeading);
    expect(bare).not.toContain(EMAIL_COPY.actionHeading);
    expect(bare).toContain(CONTENT.summary[0] as string);
  });
});

describe("the refusal message", () => {
  /**
   * IT EXISTS RATHER THAN THE MESSAGE SIMPLY NOT BEING SENT. An owner expecting something and
   * getting silence learns the product is unreliable; one who is told a figure could not be traced
   * learns that it refuses to guess.
   */
  it("carries the engine's own reason through unedited", () => {
    const reason = "unverifiable_number: THB 900.00 is not any figure in the input set";
    expect(refusalEmail(TO, "week", CONTENT.period, reason).text).toContain(reason);
  });

  it("attaches no figures and estimates nothing to fill the gap", () => {
    const text = refusalEmail(
      TO,
      "month",
      CONTENT.period,
      "no_rows: nothing covered the period",
    ).text;
    for (const figure of CONTENT.figures) expect(text).not.toContain(figure.text);
    expect(text).toContain(EMAIL_COPY.refusalTrust);
  });

  it("says in the subject that there is no brief, so it is clear before it is opened", () => {
    expect(refusalEmail(TO, "week", CONTENT.period, "no_rows").subject).toMatch(/^No /);
  });
});
