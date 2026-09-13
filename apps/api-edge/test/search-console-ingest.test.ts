import { SELF } from "cloudflare:test";
import type { EnvelopeRow } from "@repo/contract";
import type { ConnectionRecord, IngestContext } from "@repo/store";
import { type CryptoLike as VaultCrypto, seal } from "@repo/vault";
import { describe, expect, it } from "vitest";

import {
  IngestError,
  IngestRunFailure,
  type IngestDeps,
  parseIngestRequest,
  runIngest,
} from "../src/ingest.js";

/**
 * A DAY-BASED SOURCE, ASKED FOR IN DAYS.
 *
 * Search Console reports in **the platform's own Pacific reporting day**. The two sources dispatched
 * before it report in instants, and `IngestRequest` carried only instants -- so the obvious way to
 * wire this one was to truncate `since` to its first ten characters.
 *
 * THAT WOULD PICK A REPORTING DAY BY ACCIDENT. A run asked for from `2026-09-11T20:00:00Z` would
 * read the 11th when Google's own day had not started, and every impression and click would be
 * attributed to a day the platform would not have answered for -- with nothing marking it. It is the
 * Bangkok-receipt error from the Loyverse unit, in a different timezone, and it is the reason the
 * request grew `from`/`to` instead.
 *
 * The other half of this file is what the dispatch REFUSES to decide. The report pair is the
 * connector's own (`["totals", "byQuery"]`, and not optional: Google's anonymity threshold makes a
 * query-grain response a subset whose sum is quietly lower than the truth), and there is no default
 * lookback because how long a Search Console figure keeps moving is unmeasured.
 */

const WORKSPACE = "7c000000-0000-0000-0000-000000000001";
const CONNECTION = "8d000000-0000-0000-0000-000000000004";
const SITE = "sc-domain:example.com";
const NOW = new Date("2026-09-12T02:00:00.000Z");
const webcrypto = crypto as unknown as VaultCrypto;

/** One Search Analytics response. The fields the normaliser reads and nothing else. */
function analytics(rows: unknown[]): Response {
  return new Response(JSON.stringify({ rows }), {
    headers: { "content-type": "application/json" },
  });
}

function row(date: string, query?: string) {
  return {
    keys: query === undefined ? [date] : [date, query],
    clicks: 12,
    impressions: 340,
    ctr: 0.035,
    position: 8.4,
  };
}

async function connection(
  kek: Uint8Array,
  overrides: Partial<ConnectionRecord> = {},
): Promise<ConnectionRecord> {
  const sealed = await seal(webcrypto, {
    plaintext: JSON.stringify({ kind: "oauth", accessToken: "ya29.test", refreshToken: "1//rt" }),
    kek,
    keyVersion: 1,
    scope: { workspaceId: WORKSPACE, connectionId: CONNECTION },
  });
  return {
    id: CONNECTION,
    workspaceId: WORKSPACE,
    provider: "search_console",
    credentialLane: "oauth",
    externalAccountId: SITE,
    displayName: "example.com",
    credentialCiphertext: sealed.ciphertext,
    credentialIv: sealed.iv,
    wrappedDek: sealed.wrappedDek,
    keyVersion: sealed.keyVersion,
    grantedScopes: [],
    expiresAt: null,
    status: "active",
    lastError: null,
    revokedAt: null,
    timezone: "Asia/Bangkok",
    ingestCheckpoint: null,
    ...overrides,
  };
}

async function harness(
  options: { kek?: Uint8Array; record?: ConnectionRecord; failAtCall?: number } = {},
) {
  const kek = options.kek ?? crypto.getRandomValues(new Uint8Array(32));
  const record = options.record ?? (await connection(kek));
  const written: Array<{ rows: readonly EnvelopeRow[]; context: IngestContext }> = [];
  let call = 0;
  const deps: IngestDeps = {
    connections: { read: async () => record } as unknown as IngestDeps["connections"],
    ingest: {
      write: async (rows: readonly EnvelopeRow[], context: IngestContext) => {
        written.push({ rows, context });
        return rows.length;
      },
    } as unknown as IngestDeps["ingest"],
    kek: btoa(String.fromCharCode(...kek)),
    crypto: webcrypto,
    now: () => NOW,
    sleep: async () => {},
    random: () => 0.5,
    fetchImpl: (async () => {
      call += 1;
      // A run that dies part way, so `readThrough` is the last chunk read IN FULL rather than the
      // span's end. Without this the `??` branch below is never reached and the assertion about it
      // is decorative -- which is exactly what a mutation proved before this existed.
      if (options.failAtCall !== undefined && call >= options.failAtCall) {
        throw new Error("the platform stopped answering");
      }
      // The unthresholded total is issued first within a chunk; the query grain follows.
      return call % 2 === 1
        ? analytics([row("2026-09-10")])
        : analytics([row("2026-09-10", "iced latte")]);
    }) as typeof fetch,
  };
  return { deps, written };
}

const SPAN = { from: "2026-09-10", to: "2026-09-10" };

describe("a Search Console connection produces envelope rows", () => {
  it("dispatches to the Search Console backfill and writes what it reads", async () => {
    const { deps, written } = await harness();
    const report = await runIngest(
      {
        workspaceId: WORKSPACE,
        connectionId: CONNECTION,
        since: "2026-09-10T00:00:00.000Z",
        ...SPAN,
      },
      deps,
    );
    expect(report.source).toBe("search_console");
    expect(report.rowsRead, "the run read no rows").toBeGreaterThan(0);
    expect(report.rowsWritten).toBe(report.rowsRead);
    expect(written[0]?.context.workspaceId).toBe(WORKSPACE);
  });

  it("refuses to derive a reporting day from an instant", async () => {
    // THE ASSERTION THIS FILE EXISTS FOR. Truncating `since` is the change somebody makes to delete
    // two fields from a request shape, and it moves every figure onto a day Google never answered
    // for. The refusal names the reason rather than the field.
    const { deps } = await harness();
    await expect(
      runIngest(
        { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T20:00:00.000Z" },
        deps,
      ),
    ).rejects.toThrow(/Pacific reporting day/);
  });

  it("invents no lookback when only one end of the span is given", async () => {
    // There is no N. How long a Search Console figure keeps moving is unmeasured, so a default
    // would silently decide how much of a customer's history is re-read.
    const { deps } = await harness();
    await expect(
      runIngest(
        {
          workspaceId: WORKSPACE,
          connectionId: CONNECTION,
          since: "2026-09-10T00:00:00.000Z",
          from: SPAN.from,
        },
        deps,
      ),
    ).rejects.toThrow(/`from` and `to`/);
  });

  it("reports the day it read through, not the day it was asked to reach", async () => {
    // THE ASSERTION THE FIELD'S OWN COMMENT DEMANDS: "a partial run that reported the span's END
    // would skip everything it did not reach, which is correct-looking and wrong forever."
    //
    // THIS TEST WAS WRONG FIRST. It used a one-day span, so `from` and `to` were the same string
    // and no assertion could tell them apart -- a mutation swapping one for the other stayed green.
    // The span is three days now and the run is made to die part way, so the two are distinguishable
    // and the `??` branch is actually reached.
    const { deps } = await harness({ failAtCall: 3 });
    await expect(
      runIngest(
        {
          workspaceId: WORKSPACE,
          connectionId: CONNECTION,
          since: "2026-09-10T00:00:00.000Z",
          from: "2026-09-10",
          to: "2026-09-12",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(IngestRunFailure);

    try {
      await runIngest(
        {
          workspaceId: WORKSPACE,
          connectionId: CONNECTION,
          since: "2026-09-10T00:00:00.000Z",
          from: "2026-09-10",
          to: "2026-09-12",
        },
        await harness({ failAtCall: 3 }).then((h) => h.deps),
      );
    } catch (error) {
      const report = (error as IngestRunFailure).report;
      expect(report.complete, "a run that threw reported itself complete").toBe(false);
      expect(
        report.checkpoint,
        "the partial run reported the span's end, skipping every day it never read",
      ).not.toBe("2026-09-12");
    }
  });

  it("reports the span's START when it died before any chunk completed", async () => {
    // THE CASE THE `??` BRANCH ACTUALLY EXISTS FOR, and it took two attempts to reach. The first
    // version failed at the third request, by which point the first chunk had completed and
    // `readThrough` was a real date -- so the fallback was never evaluated and a mutation swapping
    // `spanFrom` for `spanTo` stayed green through a test written to catch exactly that.
    //
    // Failing at the FIRST request leaves `readThrough` null, which is the only state in which this
    // run has no watermark of its own. Reporting the span's end there would tell the next run to
    // start after three days nothing ever read.
    const { deps } = await harness({ failAtCall: 1 });
    try {
      await runIngest(
        {
          workspaceId: WORKSPACE,
          connectionId: CONNECTION,
          since: "2026-09-10T00:00:00.000Z",
          from: "2026-09-10",
          to: "2026-09-12",
        },
        deps,
      );
      expect.unreachable("the run should have failed on its first request");
    } catch (error) {
      expect(error).toBeInstanceOf(IngestRunFailure);
      const report = (error as IngestRunFailure).report;
      expect(report.chunks, "a chunk completed; this case needs one that did not").toBe(0);
      expect(
        report.checkpoint,
        "a run that read nothing reported a watermark past three unread days",
      ).toBe("2026-09-10");
    }
  });

  it("completes a whole span and reports the last day read in full", async () => {
    const { deps } = await harness();
    const report = await runIngest(
      {
        workspaceId: WORKSPACE,
        connectionId: CONNECTION,
        since: "2026-09-10T00:00:00.000Z",
        from: "2026-09-10",
        to: "2026-09-12",
      },
      deps,
    );
    expect(report.complete).toBe(true);
    expect(report.checkpoint).toBe("2026-09-12");
  });
});

describe("the request boundary validates a day span", () => {
  it("refuses a from/to that is not YYYY-MM-DD", () => {
    expect(() =>
      parseIngestRequest({
        workspace_id: WORKSPACE,
        connection_id: CONNECTION,
        since: "2026-09-10T00:00:00.000Z",
        from: "10/09/2026",
      }),
    ).toThrow(IngestError);
  });

  it("refuses a span that ends before it starts", () => {
    expect(() =>
      parseIngestRequest({
        workspace_id: WORKSPACE,
        connection_id: CONNECTION,
        since: "2026-09-10T00:00:00.000Z",
        from: "2026-09-12",
        to: "2026-09-10",
      }),
    ).toThrow(/before/);
  });

  it("carries a well-formed span through", () => {
    const parsed = parseIngestRequest({
      workspace_id: WORKSPACE,
      connection_id: CONNECTION,
      since: "2026-09-10T00:00:00.000Z",
      from: "2026-09-10",
      to: "2026-09-12",
    });
    expect(parsed.from).toBe("2026-09-10");
    expect(parsed.to).toBe("2026-09-12");
  });
});
