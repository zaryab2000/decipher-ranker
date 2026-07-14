import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeBazaarResource, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeInsertChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  },
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
});

describe("upsertCatalog", () => {
  it("returns zeros for empty input", async () => {
    const result = await upsertCatalog([]);
    expect(result.merchantsUpserted).toBe(0);
    expect(result.resourcesUpserted).toBe(0);
    expect(result.categoriesUpdated).toBe(0);
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
    expect(result.categoriesUpdated).toBe(1);
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

  it("creates categories from unique tags", async () => {
    const r1 = makeBazaarResource({
      tags: ["api", "ml"],
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xPayee", scheme: "exact" }],
    });

    selectResults = [[{ id: "m-1", payeeAddress: "0xpayee" }]];
    const result = await upsertCatalog([r1]);
    expect(result.categoriesUpdated).toBe(2);
  });

  it("deduplicates tags across resources", async () => {
    const r1 = makeBazaarResource({
      tags: ["api"],
      resource: "https://a.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xP1", scheme: "exact" }],
    });
    const r2 = makeBazaarResource({
      tags: ["api"],
      resource: "https://b.com",
      accepts: [{ amount: "0.01", asset: "USDC", network: "base", payTo: "0xP2", scheme: "exact" }],
    });

    selectResults = [[
      { id: "m-1", payeeAddress: "0xp1" },
      { id: "m-2", payeeAddress: "0xp2" },
    ]];

    const result = await upsertCatalog([r1, r2]);
    expect(result.categoriesUpdated).toBe(1);
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

  it("runs SQL to update category merchant counts", async () => {
    await upsertCatalog([]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
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
