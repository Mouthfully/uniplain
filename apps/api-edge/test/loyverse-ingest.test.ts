import { SELF } from "cloudflare:test";
import { LOYVERSE_SCOPES } from "@repo/connectors";
import type { EnvelopeRow } from "@repo/contract";
import type { ConnectionRecord, IngestContext } from "@repo/store";
import { type CryptoLike as VaultCrypto, seal } from "@repo/vault";
import { describe, expect, it } from "vitest";

import { IngestError, type IngestDeps, runIngest } from "../src/ingest.js";

/**
 * THE TILL THIS PRODUCT IS DESIGNED AROUND, PULLED END TO END.
 *
 * `runLoyverseBackfill` was written, tested and exported from `@repo/connectors`, and **nothing
 * called it**. `runIngest` refused every provider but `woocommerce`, and the nightly sweep filtered
 * the rest out before they were leased -- so a café in Bangkok could connect their Loyverse
 * account, watch the connection go healthy, and never receive a single row. The home page
 * meanwhile said "Reads GA4, Google Ads, Loyverse, Meta Ads, Search Console, Shopify and
 * WooCommerce on your own credentials."
 *
 * This file is the assertion that the dispatch exists and works, which is a different claim from
 * "the backfill has tests". The backfill's own tests prove it walks a window. **Nothing proved a
 * connection row could be turned into the arguments that walk needs**, and that resolution -- the
 * credential lane, the OAuth grant, the granted scopes, the timezone the dates are computed in --
 * is the whole of what was missing.
 *
 * Sealed for real under a real KEK, like `ingest.test.ts`: a run that could not decrypt fails here
 * rather than on stage.
 */

const WORKSPACE = "7c000000-0000-0000-0000-000000000001";
const CONNECTION = "8d000000-0000-0000-0000-000000000003";
const MERCHANT = "b0a0c0d0-0000-0000-0000-00000000000a";
const NOW = new Date("2026-09-12T02:00:00.000Z");
const webcrypto = crypto as unknown as VaultCrypto;

/** The merchant profile. The currency lives here and nowhere else on this platform. */
function merchantBody(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: MERCHANT,
      business_name: "Baan Kafe",
      currency: { code: "THB", decimal_places: 2 },
      ...overrides,
    }),
    { headers: { "content-type": "application/json" } },
  );
}

/**
 * One receipt, with the four fields the normaliser actually refuses without.
 *
 * Written out here rather than imported: `@repo/connectors` does not export `fixtures.ts` from its
 * barrel and should not -- a fixture is a connector's own test material, and exporting it would
 * make it part of the package contract. `ingest.test.ts` gives the same reason for its orders.
 */
function receipt(number: string, updatedAt = "2026-09-11T04:00:00.000Z") {
  return {
    receipt_number: number,
    receipt_type: "SALE",
    refund_for: null,
    created_at: updatedAt,
    receipt_date: updatedAt,
    updated_at: updatedAt,
    cancelled_at: null,
    source: "point of sale",
    total_money: 245.0,
    total_tax: 16.03,
    total_discount: 0,
    tip: 0,
    surcharge: 0,
    store_id: "s-1",
    line_items: [],
    payments: [],
  };
}

function receiptsBody(receipts: unknown[], cursor: string | null = null): Response {
  return new Response(JSON.stringify({ receipts, ...(cursor === null ? {} : { cursor }) }), {
    headers: { "content-type": "application/json" },
  });
}

/** A Loyverse connection row, sealed for real. OAuth lane, because that is the only lane it has. */
async function connection(
  kek: Uint8Array,
  overrides: Partial<ConnectionRecord> = {},
): Promise<ConnectionRecord> {
  const sealed = await seal(webcrypto, {
    plaintext: JSON.stringify({ kind: "oauth", accessToken: "lv_at_123", refreshToken: "lv_rt_1" }),
    kek,
    keyVersion: 1,
    scope: { workspaceId: WORKSPACE, connectionId: CONNECTION },
  });
  return {
    id: CONNECTION,
    workspaceId: WORKSPACE,
    provider: "loyverse",
    credentialLane: "oauth",
    externalAccountId: MERCHANT,
    displayName: "Baan Kafe",
    credentialCiphertext: sealed.ciphertext,
    credentialIv: sealed.iv,
    wrappedDek: sealed.wrappedDek,
    keyVersion: sealed.keyVersion,
    grantedScopes: [...LOYVERSE_SCOPES],
    expiresAt: null,
    status: "active",
    lastError: null,
    revokedAt: null,
    timezone: "Asia/Bangkok",
    ingestCheckpoint: null,
    ...overrides,
  };
}

interface Harness {
  readonly deps: IngestDeps;
  readonly written: Array<{ rows: readonly EnvelopeRow[]; context: IngestContext }>;
  readonly calls: URL[];
}

/**
 * THE KEK IS AN ARGUMENT BECAUSE THE FIRST VERSION MADE ITS OWN.
 *
 * A caller building a record sealed under one key, handed to a harness holding another, gets
 * `bad_kek` -- and `bad_kek` is an `IngestError` like every refusal this file asserts. The
 * timezone test below was green on a decryption failure that had nothing to do with timezones:
 * a test passing for the wrong reason, which is the same tell as a mutation that fails fewer
 * assertions than it should. So the key is threaded and every refusal is the one it names.
 */
async function harness(
  options: {
    kek?: Uint8Array;
    record?: ConnectionRecord | null;
    handler?: (url: URL, call: number) => Response;
  } = {},
): Promise<Harness> {
  const kek = options.kek ?? crypto.getRandomValues(new Uint8Array(32));
  const record = options.record === undefined ? await connection(kek) : options.record;
  const written: Array<{ rows: readonly EnvelopeRow[]; context: IngestContext }> = [];
  const calls: URL[] = [];
  let call = 0;

  const handler =
    options.handler ??
    ((url: URL) =>
      url.pathname.includes("/merchant") ? merchantBody() : receiptsBody([receipt("1-1001")]));

  return {
    written,
    calls,
    deps: {
      connections: {
        read: async () => record,
      } as unknown as IngestDeps["connections"],
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
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        calls.push(url);
        call += 1;
        return handler(url, call);
      }) as typeof fetch,
    },
  };
}

describe("a Loyverse connection produces envelope rows", () => {
  it("dispatches to the Loyverse backfill and writes what it reads", async () => {
    // THE ASSERTION THIS FILE EXISTS FOR. Before the dispatch was wired this threw
    // `unsupported_provider` -- a 501 -- for every Loyverse connection that ever existed.
    const { deps, written, calls } = await harness();

    const report = await runIngest(
      { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
      deps,
    );

    expect(report.source).toBe("loyverse");
    expect(report.rowsRead, "the run read no receipts").toBeGreaterThan(0);
    expect(report.rowsWritten).toBe(report.rowsRead);
    expect(written.length, "nothing reached the store").toBeGreaterThan(0);
    expect(written[0]?.context.workspaceId).toBe(WORKSPACE);
    expect(written[0]?.context.connectionId).toBe(CONNECTION);

    // The merchant profile is fetched BEFORE any receipt, because a Loyverse receipt carries no
    // currency and finding that out after walking the span would spend the till's rate budget to
    // produce nothing storable.
    expect(calls[0]?.pathname, "the merchant was not read first").toContain("/merchant");
    expect(calls.some((u) => u.pathname.includes("/receipts"))).toBe(true);
  });

  it("labels every row with the currency the merchant profile reported", async () => {
    // NOT A DEFAULT ANYWHERE. The receipt has no currency field; if `/merchant/` did not report one
    // the client refuses rather than guessing, and this asserts the value travels onto the row.
    const { deps, written } = await harness();
    await runIngest(
      { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
      deps,
    );
    const rows = written.flatMap((w) => w.rows);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(JSON.stringify(row)).toContain("THB");
    }
  });

  it("reports a null split count rather than zero, because there is no bisector", async () => {
    // Loyverse walks a cursor: no probe page is ever fetched and discarded, so there is nothing to
    // count. `0` would say "measured, and none", which is the `?? 0` this repository refuses -- an
    // operator comparing a Loyverse run to a WooCommerce one would read it as cheap to pull.
    const { deps } = await harness();
    const report = await runIngest(
      { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
      deps,
    );
    expect(report.splits).toBeNull();
  });

  it("refuses a connection with no timezone rather than assuming one", async () => {
    // `dimensions.date` is COMPUTED in the merchant's zone, so a guess moves a receipt onto the
    // wrong calendar day rather than mislabelling the right one. A 23:30 sale in Bangkok is the
    // previous day in UTC, and a shop owner reading yesterday's takings would never know.
    const kek = crypto.getRandomValues(new Uint8Array(32));
    const { deps } = await harness({ kek, record: await connection(kek, { timezone: null }) });
    // NAMED, not merely `IngestError`. Every refusal in this file is an `IngestError`, so asserting
    // the class alone is what let this pass on a decryption failure.
    await expect(
      runIngest(
        { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
        deps,
      ),
    ).rejects.toThrow(/timezone/i);
  });

  it("refuses a grant missing RECEIPTS_READ before it spends a request on the till", async () => {
    // THE PROPERTY, NOT THE LINE. `runIngest` calls `assertReadOnlyCredential` and so does
    // `fetchMerchant`, so deleting either leaves this green -- a mutation proved exactly that, and
    // the comment in `ingest.ts` now says so rather than claiming the call is load-bearing. What is
    // worth asserting is the ORDERING a merchant feels: a grant this product cannot read with is
    // refused before a single request reaches their account's shared rate budget.
    const kek = crypto.getRandomValues(new Uint8Array(32));
    const { deps, calls } = await harness({
      kek,
      record: await connection(kek, { grantedScopes: ["RECEIPTS_WRITE"] }),
    });
    await expect(
      runIngest(
        { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
        deps,
      ),
    ).rejects.toThrow();
    expect(calls.length, "the till was called before the grant was checked").toBe(0);
  });

  it("refuses a pasted token, which is the lane Loyverse does not offer", async () => {
    // `PROVIDER_LANES.loyverse` is `["oauth"]` and the single-element array is a refusal: Loyverse's
    // personal access token "gives unlimited access to the targeted account" -- no scopes, and
    // unlimited includes RECEIPTS_WRITE on a till this product only ever reads.
    const kek = crypto.getRandomValues(new Uint8Array(32));
    const sealed = await seal(webcrypto, {
      plaintext: JSON.stringify({ kind: "key_secret", key: "k", secret: "s" }),
      kek,
      keyVersion: 1,
      scope: { workspaceId: WORKSPACE, connectionId: CONNECTION },
    });
    const record = await connection(kek, {
      credentialLane: "key_secret",
      credentialCiphertext: sealed.ciphertext,
      credentialIv: sealed.iv,
      wrappedDek: sealed.wrappedDek,
      keyVersion: sealed.keyVersion,
    });
    const { deps } = await harness({ kek, record });
    await expect(
      runIngest(
        { workspaceId: WORKSPACE, connectionId: CONNECTION, since: "2026-09-10T00:00:00.000Z" },
        deps,
      ),
    ).rejects.toThrow(/needs an? oauth one/);
  });
});
