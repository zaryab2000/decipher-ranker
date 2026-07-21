import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBazaarResource, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeInsertChain, makeDeleteChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}));

import { upsertCatalog } from "@/lib/data-sources/catalog-sync";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length
      ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });

  mockInsert.mockImplementation(() => makeInsertChain());
  mockExecute.mockResolvedValue(undefined);
  mockDelete.mockImplementation(() => makeDeleteChain());
});

// Number of taxonomy rows seeded by upsertTaxonomyCategories (TAXONOMY + OTHER).
const TAXONOMY_ROW_COUNT = 13;

describe("upsertCatalog", () => {
  it("seeds the taxonomy even for empty input", async () => {
    const result = await upsertCatalog([]);
    expect(result.merchantsUpserted).toBe(0);
    expect(result.resourcesUpserted).toBe(0);
    // Categories are the fixed taxonomy, not derived from input tags.
    expect(result.categoriesUpdated).toBe(TAXONOMY_ROW_COUNT);
  });

  it("upserts a single resource with its merchant", async () => {
    const resource = makeBazaarResource({
      tags: ["api"],
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "merchant-1", payeeAddress: "0xpayee" }]];

    const result = await upsertCatalog([resource]);
    expect(result.merchantsUpserted).toBe(1);
    expect(result.resourcesUpserted).toBe(1);
    expect(result.categoriesUpdated).toBe(TAXONOMY_ROW_COUNT);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("groups resources by payee address", async () => {
    const r1 = makeBazaarResource({
      resource: "https://api.test.com/a",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xSame", scheme: "exact" }],
    });
    const r2 = makeBazaarResource({
      resource: "https://api.test.com/b",
      accepts: [{ amount: "0.02", asset: "USDC", network: "base", payTo: "0xSame", scheme: "exact" }],
    });

    selectResults = [[{ id: "merchant-1", payeeAddress: "0xsame" }]];

    const result = await upsertCatalog([r1, r2]);
    expect(result.merchantsUpserted).toBe(1);
    expect(result.resourcesUpserted).toBe(2);
  });

  it("skips resources without payee", async () => {
    const resource = makeBazaarResource({ accepts: [] });
    const result = await upsertCatalog([resource]);
    expect(result.merchantsUpserted).toBe(0);
    expect(result.resourcesUpserted).toBe(0);
  });

  it("drops testnet / unsupported-chain resources before writing", async () => {
    const testnet = makeBazaarResource({
      accepts: [{ amount: "0.01", asset: "USDC", network: "base-sepolia", payTo: "0xTest", scheme: "exact" }],
    });
    const unsupported = makeBazaarResource({
      resource: "https://b.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "polkadot:2f0555cc", payTo: "0xOther", scheme: "exact" }],
    });

    const result = await upsertCatalog([testnet, unsupported]);
    expect(result.merchantsUpserted).toBe(0);
    expect(result.resourcesUpserted).toBe(0);
  });

  it("indexes a CAIP-2 mainnet resource (eip155:8453 → base)", async () => {
    const resource = makeBazaarResource({
      accepts: [{ amount: "0.01", asset: "USDC", network: "eip155:8453", payTo: "0xPayee", scheme: "exact" }],
    });
    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];

    const result = await upsertCatalog([resource]);
    expect(result.merchantsUpserted).toBe(1);
    expect(result.resourcesUpserted).toBe(1);
  });

  it("seeds a fixed taxonomy regardless of input tags", async () => {
    const r1 = makeBazaarResource({
      tags: ["api", "ml", "some-novel-tag"],
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];
    const result = await upsertCatalog([r1]);
    // Always the taxonomy size — tags no longer create categories.
    expect(result.categoriesUpdated).toBe(TAXONOMY_ROW_COUNT);
  });

  it("does not delete categories during catalog sync (reconcile happens post-categorization)", async () => {
    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];
    await upsertCatalog([]);
    // Deleting stale rows here would violate the merchants.category_id FK, so the
    // reconcile-delete lives in assignAllMerchantCategories instead.
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("aggregates l30d stats per merchant", async () => {
    const r1 = makeBazaarResource({
      resource: "https://a.com",
      quality: { l30DaysTotalCalls: 10, l30DaysUniquePayers: 3, lastCalledAt: "2024-06-01" },
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });
    const r2 = makeBazaarResource({
      resource: "https://b.com",
      quality: { l30DaysTotalCalls: 20, l30DaysUniquePayers: 5, lastCalledAt: "2024-06-01" },
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];

    await upsertCatalog([r1, r2]);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("no longer derives category counts from tags (done post-categorization)", async () => {
    await upsertCatalog([]);
    // The old `c.name = ANY(r.tags)` UPDATE is gone; counts are recomputed by
    // assignAllMerchantCategories over category_id instead.
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("handles resources with null quality", async () => {
    const resource = makeBazaarResource({
      quality: null,
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];
    const result = await upsertCatalog([resource]);
    expect(result.resourcesUpserted).toBe(1);
  });

  it("persists schema-presence flags on resources", async () => {
    const withSchemas = makeBazaarResource({
      resource: "https://a.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
      extensions: {
        bazaar: {
          info: {
            input: { type: "http", method: "POST" },
            output: { type: "json", example: { ok: true } },
          },
        },
      },
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];

    // Capture the row handed to the resources insert.
    let insertedRow: Record<string, unknown> | undefined;
    mockInsert.mockImplementation(() => {
      const chain = makeInsertChain();
      const originalValues = chain.values as (rows: unknown) => unknown;
      chain.values = vi.fn((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const candidate = arr[0] as Record<string, unknown>;
        if (candidate && "resourceUrl" in candidate) insertedRow = candidate;
        return originalValues(rows);
      });
      return chain;
    });

    await upsertCatalog([withSchemas]);
    expect(insertedRow?.hasInputSchema).toBe(true);
    expect(insertedRow?.hasOutputExample).toBe(true);
  });

  it("defaults schema-presence flags to false when absent", async () => {
    const noSchemas = makeBazaarResource({
      resource: "https://a.com",
      extensions: undefined,
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];

    let insertedRow: Record<string, unknown> | undefined;
    mockInsert.mockImplementation(() => {
      const chain = makeInsertChain();
      const originalValues = chain.values as (rows: unknown) => unknown;
      chain.values = vi.fn((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const candidate = arr[0] as Record<string, unknown>;
        if (candidate && "resourceUrl" in candidate) insertedRow = candidate;
        return originalValues(rows);
      });
      return chain;
    });

    await upsertCatalog([noSchemas]);
    expect(insertedRow?.hasInputSchema).toBe(false);
    expect(insertedRow?.hasOutputExample).toBe(false);
  });

  it("aggregates volume30d as calls × price per merchant", async () => {
    const r1 = makeBazaarResource({
      resource: "https://a.com",
      quality: { l30DaysTotalCalls: 100, l30DaysUniquePayers: 3, lastCalledAt: "2024-06-01" },
      accepts: [{ amount: "1000000", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });
    const r2 = makeBazaarResource({
      resource: "https://b.com",
      quality: { l30DaysTotalCalls: 50, l30DaysUniquePayers: 2, lastCalledAt: "2024-06-01" },
      accepts: [{ amount: "2000000", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];

    let merchantRow: Record<string, unknown> | undefined;
    mockInsert.mockImplementation(() => {
      const chain = makeInsertChain();
      const originalValues = chain.values as (rows: unknown) => unknown;
      chain.values = vi.fn((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const candidate = arr[0] as Record<string, unknown>;
        if (candidate && "payeeAddress" in candidate) merchantRow = candidate;
        return originalValues(rows);
      });
      return chain;
    });

    await upsertCatalog([r1, r2]);
    // $1 amount is 1000000 atomic units (6 decimals) -> $1; $2 -> $2.
    // 100×$1 + 50×$2 = $200.
    expect(Number(merchantRow?.volume30d)).toBeCloseTo(200, 6);
  });

  it("handles multiple payees creating multiple merchants", async () => {
    const r1 = makeBazaarResource({
      resource: "https://a.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee1", scheme: "exact" }],
    });
    const r2 = makeBazaarResource({
      resource: "https://b.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee2", scheme: "exact" }],
    });

    selectResults = [[
      { id: "m-1", payeeAddress: "0xpayee1" },
      { id: "m-2", payeeAddress: "0xpayee2" },
    ]];

    const result = await upsertCatalog([r1, r2]);
    expect(result.merchantsUpserted).toBe(2);
  });
});
