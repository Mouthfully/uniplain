import { brand } from "@repo/brand";
import { describe, expect, it, vi } from "vitest";

import { EmailError, RESEND_SEND_URL, sendEmail, senderAddress } from "./send.ts";

const MESSAGE = { to: "owner@example.test", subject: "Your brief", text: "Takings held steady." };
const FROM = "briefs@example.test";

function respond(status: number, body: unknown = { id: "re_123" }): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

describe("the sender address", () => {
  it("is composed from the brand domain rather than typed", () => {
    expect(senderAddress("briefs").endsWith(`@${brand.domain}`)).toBe(true);
  });

  it("refuses a local part that is not a plain identifier", () => {
    for (const bad of ["", "Briefs", "a b", "a@b", "1brief", "brief;drop"]) {
      expect(() => senderAddress(bad)).toThrow(/local part/);
    }
  });
});

describe("sending", () => {
  it("posts plain text to the provider and returns the message id", async () => {
    const fetchImpl = respond(200);
    const result = await sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl });

    expect(result.id).toBe("re_123");
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_SEND_URL);

    const body = JSON.parse(String(init.body));
    expect(body.text).toBe(MESSAGE.text);
    // PLAIN TEXT ONLY, and this asserts it: an `html` field would add a rendering surface and the
    // remote-image path that most mail tracking uses, which `/privacy` says this product does not do.
    expect(body).not.toHaveProperty("html");
  });

  /**
   * A MISSING KEY IS NOT A SEND. It refuses with its own code rather than posting an unauthenticated
   * request and reporting whatever the provider says about it.
   */
  it("refuses without an API key instead of calling anything", async () => {
    const fetchImpl = respond(200);
    await expect(sendEmail(MESSAGE, FROM, { apiKey: "  ", fetchImpl })).rejects.toMatchObject({
      code: "not_configured",
    });
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  /**
   * A 4xx IS NEVER RETRIED. An unverified sending domain -- which is the state this domain is in
   * today, with no SPF or DKIM record -- fails identically every time, and retrying turns one
   * rejection into several.
   */
  it("reports a 4xx as rejected, and calls once", async () => {
    const fetchImpl = respond(403, { message: "domain not verified" });
    await expect(sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl })).rejects.toMatchObject({
      code: "rejected",
      status: 403,
    });
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });

  it("reports a 5xx as unavailable, for the caller to decide about", async () => {
    const fetchImpl = respond(503, {});
    await expect(sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl })).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
    });
  });

  /**
   * THE ERROR CARRIES NO RECIPIENT. Resend echoes the request in some error shapes, so a thrown
   * error that forwarded the provider's body would put a customer's address into whatever catches
   * it -- a log line, a Sentry event, a server action's return value.
   */
  it("puts no address or body into the error it throws", async () => {
    const fetchImpl = respond(422, { message: `invalid recipient ${MESSAGE.to}` });
    try {
      await sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl });
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
      const serialised = `${(error as EmailError).message} ${JSON.stringify(error)}`;
      expect(serialised).not.toContain(MESSAGE.to);
      expect(serialised).not.toContain(MESSAGE.text);
      expect(serialised).not.toContain(MESSAGE.subject);
    }
  });

  it("reports a network failure as unavailable rather than throwing raw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    await expect(sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("returns a null id rather than inventing one when the provider sends no body", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("not json", { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(sendEmail(MESSAGE, FROM, { apiKey: "re_test", fetchImpl })).resolves.toEqual({
      id: null,
    });
  });

  it("carries the API key in the header and never in the body", async () => {
    const fetchImpl = respond(200);
    await sendEmail(MESSAGE, FROM, { apiKey: "re_secret_value", fetchImpl });
    const [, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0] as [string, RequestInit];
    expect(String(init.body)).not.toContain("re_secret_value");
    expect(JSON.stringify(init.headers)).toContain("re_secret_value");
  });
});
