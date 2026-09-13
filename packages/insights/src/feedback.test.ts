import { describe, expect, it } from "vitest";

import { renderUserPrompt } from "./brief.ts";
import {
  type ActionFeedback,
  NO_PRIORS,
  SILENCE_AFTER,
  buildPriors,
  defectSignals,
  isSilenced,
} from "./feedback.ts";
import { buildFigureSet } from "./figures.ts";
import { COMPARISON, PERIOD, settledWeek } from "./fixtures.ts";

function set(priors = NO_PRIORS) {
  const result = buildFigureSet({
    business: "cafe",
    priors,
    period: PERIOD,
    comparison: COMPARISON,
    rows: settledWeek(),
  });
  if (!result.ok) throw new Error(`expected a figure set, got ${result.code}: ${result.detail}`);
  return result.set;
}

function verdict(
  verdictName: ActionFeedback["verdict"],
  kind: ActionFeedback["kind"] = "channel_decline",
  source: ActionFeedback["source"] = "woocommerce",
): ActionFeedback {
  return { actionId: `action.${kind}`, kind, source, verdict: verdictName };
}

describe("the verdict vocabulary is closed, and that is the privacy control", () => {
  /**
   * THE ONE THIS MODULE EXISTS FOR.
   *
   * `ActionFeedback` has no free-text field, so a note an owner typed has no path into a prompt.
   * A type cannot be asserted at runtime, so this does the only thing a runtime can: shoves the
   * note on anyway, through the cast a careless caller would reach for, and checks the rendered
   * prompt never carries it. If someone later adds a `note` field "because storage has one", this
   * goes red on the first render.
   */
  it("a note forced onto the object reaches no prompt", () => {
    const smuggled = {
      ...verdict("not_doing_it"),
      note: "Somchai next door undercut us on the set lunch",
    } as ActionFeedback;

    const priors = buildPriors([smuggled, smuggled, smuggled]);
    const prompt = renderUserPrompt(set(priors));

    expect(prompt).not.toContain("Somchai");
    expect(prompt).not.toContain("undercut");
    expect(JSON.stringify(priors)).not.toContain("Somchai");
  });
});

describe("counts", () => {
  it("tallies each verdict against its own detector", () => {
    const priors = buildPriors([
      verdict("did_it"),
      verdict("already_knew"),
      verdict("wrong"),
      verdict("wrong"),
    ]);
    expect(priors.priors).toHaveLength(1);
    expect(priors.priors[0]).toMatchObject({ acted: 1, declined: 1, disputed: 2 });
  });

  it("keeps a null source in its own bucket rather than treating it as a wildcard", () => {
    const priors = buildPriors([
      verdict("already_knew", "weekday_gap", null),
      verdict("already_knew", "weekday_gap", null),
      verdict("already_knew", "weekday_gap", null),
    ]);
    expect(isSilenced(priors, "weekday_gap", null)).toBe(true);
    expect(isSilenced(priors, "weekday_gap", "woocommerce")).toBe(false);
    expect(isSilenced(priors, "channel_decline", null)).toBe(false);
  });

  it("is a total order, so the same feedback folds to the same bytes", () => {
    const feedback = [
      verdict("did_it", "spend_without_return", "google_ads"),
      verdict("wrong", "channel_decline", "woocommerce"),
      verdict("already_knew", "commission_load", "woocommerce"),
    ];
    expect(JSON.stringify(buildPriors(feedback))).toBe(
      JSON.stringify(buildPriors([...feedback].reverse().reverse())),
    );
    // Different input order is allowed to give a different answer -- see the ordering test below --
    // but the SORT of the output must not depend on which detector was seen first.
    const a = buildPriors(feedback).priors.map((p) => `${p.kind}:${p.source}`);
    const b = buildPriors([...feedback].reverse()).priors.map((p) => `${p.kind}:${p.source}`);
    expect(a).toEqual(b);
  });
});

describe("silence, and the one verdict that never causes it", () => {
  it(`falls silent after ${SILENCE_AFTER} declines`, () => {
    const declines = Array.from({ length: SILENCE_AFTER }, () => verdict("already_knew"));
    expect(
      isSilenced(
        buildPriors(declines.slice(0, SILENCE_AFTER - 1)),
        "channel_decline",
        "woocommerce",
      ),
    ).toBe(false);
    expect(isSilenced(buildPriors(declines), "channel_decline", "woocommerce")).toBe(true);
  });

  it("treats not_doing_it and already_knew alike, because both are the owner's choice", () => {
    const mixed = [verdict("not_doing_it"), verdict("already_knew"), verdict("not_doing_it")];
    expect(isSilenced(buildPriors(mixed), "channel_decline", "woocommerce")).toBe(true);
  });

  /**
   * `wrong` IS A BUG REPORT, NOT A PREFERENCE. Ten of them must not silence anything: hiding a
   * finding because an owner called it wrong destroys the evidence that the detector is broken,
   * and destroys it first in the workspace that noticed.
   */
  it("never falls silent on `wrong`, however many times it is said", () => {
    const disputes = Array.from({ length: 10 }, () => verdict("wrong"));
    const priors = buildPriors(disputes);
    expect(isSilenced(priors, "channel_decline", "woocommerce")).toBe(false);
    expect(priors.priors[0]?.disputed).toBe(10);
  });

  it("surfaces disputes for a human instead", () => {
    const priors = buildPriors([
      verdict("wrong"),
      verdict("did_it", "commission_load", "woocommerce"),
    ]);
    const signals = defectSignals(priors);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ kind: "channel_decline", disputed: 1 });
  });

  /**
   * ORDER IS LOAD-BEARING, so this asserts the two orders genuinely disagree. Without it, a caller
   * who sorts feedback newest-first changes the answer and nothing says so.
   */
  it("clears the path to silence when the owner comes back and acts", () => {
    const declines = Array.from({ length: SILENCE_AFTER }, () => verdict("already_knew"));

    const declinedThenActed = buildPriors([...declines, verdict("did_it")]);
    expect(isSilenced(declinedThenActed, "channel_decline", "woocommerce")).toBe(false);

    const actedThenDeclined = buildPriors([verdict("did_it"), ...declines]);
    expect(isSilenced(actedThenDeclined, "channel_decline", "woocommerce")).toBe(true);
  });
});

describe("what silence does to the action list", () => {
  it("removes the silenced detector and leaves no hole in the ranking", () => {
    const before = set();
    expect(before.actions.length).toBeGreaterThan(0);

    const target = before.actions[0];
    if (target === undefined) throw new Error("fixture produced no action to silence");

    const priors = buildPriors(
      Array.from({ length: SILENCE_AFTER }, () =>
        verdict("already_knew", target.kind, target.source),
      ),
    );
    const after = set(priors);

    expect(after.actions.map((a) => a.id)).not.toContain(target.id);
    expect(after.actions).toHaveLength(before.actions.length - 1);
    // RANKS ARE 1..n WITH NO GAP. Filtering happens before ranks are assigned precisely so no
    // impact label reads "what action 3 is worth" beside a list of two.
    expect(after.actions.map((a) => a.rank)).toEqual(after.actions.map((_, i) => i + 1));
  });

  it("leaves the survivors in value order, because feedback may not re-rank", () => {
    const before = set();
    const target = before.actions[0];
    if (target === undefined) throw new Error("fixture produced no action to silence");

    const priors = buildPriors(
      Array.from({ length: SILENCE_AFTER }, () =>
        verdict("already_knew", target.kind, target.source),
      ),
    );
    const after = set(priors);

    const survivors = before.actions.filter((a) => a.id !== target.id).map((a) => a.id);
    expect(after.actions.map((a) => a.id)).toEqual(survivors);
  });

  it("changes nothing when the workspace has said nothing", () => {
    expect(renderUserPrompt(set(NO_PRIORS))).toBe(renderUserPrompt(set(buildPriors([]))));
  });

  it("does not silence anything on `wrong`, end to end", () => {
    const before = set();
    const target = before.actions[0];
    if (target === undefined) throw new Error("fixture produced no action to silence");

    const priors = buildPriors(
      Array.from({ length: 10 }, () => verdict("wrong", target.kind, target.source)),
    );
    expect(set(priors).actions.map((a) => a.id)).toEqual(before.actions.map((a) => a.id));
  });
});
