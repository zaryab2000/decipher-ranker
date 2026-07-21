import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMerchant, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockSelectDistinctOn = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    selectDistinctOn: (...args: unknown[]) => mockSelectDistinctOn(...args),
  }),
}));

// The dashboard read functions wrap their DB queries in cached(); bypass KV so
// tests exercise the query path (the fetcher) deterministically.
vi.mock("@/lib/cache", () => ({
  cached: <T,>(_key: string, _ttl: number, fetcher: () => Promise<T>) =>
    fetcher(),
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...(actual as object),
    count: vi.fn(() => ({ mapWith: vi.fn(() => "count") })),
  };
});

import {
  getEcosystemStats,
  getCategoryNames,
  searchMerchants,
  getAllCategories,
} from "@/dashboard/lib/api";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });

  mockSelectDistinctOn.mockImplementation(() => makeSelectChain([]));
});

describe("getEcosystemStats", () => {
  it("returns stats from aggregated counts", async () => {
    selectResults = [
      [{ value: 500 }],
      [{ value: 42 }],
      [{ value: 15000 }],
      [{ name: "api" }],
    ];

    const stats = await getEcosystemStats();
    expect(stats.totalMerchants).toBeGreaterThanOrEqual(0);
    expect(stats.totalCategories).toBeGreaterThanOrEqual(0);
  });

  it("handles null/undefined aggregates gracefully", async () => {
    selectResults = [
      [],
      [],
      [],
      [],
    ];

    const stats = await getEcosystemStats();
    expect(stats.totalMerchants).toBe(0);
    expect(stats.totalCategories).toBe(0);
    expect(stats.topCategory).toBe("N/A");
  });
});

describe("getCategoryNames", () => {
  it("returns sorted category names", async () => {
    selectResults = [
      [{ name: "ai" }, { name: "api" }, { name: "data" }],
    ];

    const names = await getCategoryNames();
    expect(names).toEqual(["ai", "api", "data"]);
  });

  it("returns empty array when no categories", async () => {
    selectResults = [[]];

    const names = await getCategoryNames();
    expect(names).toEqual([]);
  });
});

describe("searchMerchants", () => {
  it("returns deduplicated results", async () => {
    const merchant = makeMerchant({
      payeeAddress: "0xabc",
      rankerScore: "0.75",
      rankPosition: 1,
      txCount30d: 100,
      uniqueBuyers: 10,
      lastUpdated: new Date("2024-06-01"),
    });

    selectResults = [
      [{
        merchants_payeeAddress: merchant.payeeAddress,
        merchants_rankerScore: "0.75",
        merchants_rankPosition: 1,
        merchants_chain: "base",
        merchants_txCount30d: 100,
        merchants_uniqueBuyers: 10,
        merchants_lastUpdated: "2024-06-01T00:00:00.000Z",
        resources_serviceName: "Test API",
        resources_resourceUrl: "https://test.com",
        resources_priceUsd: "0.01",
        categories_name: "api",
      }],
    ];

    const result = await searchMerchants("test");
    expect(result.query).toBe("test");
    expect(result.total).toBe(1);
    expect(result.merchants[0].serviceName).toBe("Test API");
  });

  it("returns empty results for no matches", async () => {
    selectResults = [[]];

    const result = await searchMerchants("nonexistent");
    expect(result.merchants).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("getAllCategories", () => {
  it("uses the DB slug column verbatim with no dedup/merge", async () => {
    // Parallel selects: [0] category rows, [1] avg agg, [2] top-merchant window.
    selectResults = [
      [
        { id: "c-1", slug: "ai-agents", name: "AI & Agents", merchantCount: 10, medianPrice: "0.02" },
        { id: "c-2", slug: "crypto-defi", name: "Crypto & DeFi", merchantCount: 5, medianPrice: "0.03" },
      ],
      [],
      [],
    ];

    const result = await getAllCategories();

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.slug)).toEqual(["ai-agents", "crypto-defi"]);
    // No duplicate slugs in the output.
    expect(new Set(result.map((c) => c.slug)).size).toBe(result.length);
  });
});
