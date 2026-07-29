import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMerchant, makeResource, makeCategory, makeTrend, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeInsertChain, makeUpdateChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  }),
}));

const mockFetchMerchantStats = vi.fn();

vi.mock("@/lib/data-sources/x402scan", () => ({
  fetchMerchantStats: (...args: unknown[]) => mockFetchMerchantStats(...args),
}));

// Stub the AI analyst so the competitive report never makes a real LLM HTTP
// call (which would hang past the test timeout when OPENCODE_API_KEY is set).
vi.mock("@/lib/analytics/ai-analyst", () => ({
  computeAIInsights: vi.fn(async () => null),
}));

// computeBasicReport now probes discovery layers + reads the supply-gap cache.
// Stub both so tests don't make real HTTP/DB calls; individual tests override.
vi.mock("@/lib/analytics/origin-probe", () => ({
  checkDiscoveryLayersCached: vi.fn(),
}));
vi.mock("@/lib/services/supplyGapService", () => ({
  getSupplyGapForCategory: vi.fn(),
}));
// computeBasicReport also reads the trends table via computeRankTrend; stub it
// so tests don't consume the sequential select-mock queue.
vi.mock("@/lib/analytics/rank-trend", () => ({
  computeRankTrend: vi.fn().mockResolvedValue({
    trendDirection: "insufficient_data",
    scoreChange30d: null,
    rankChange30d: null,
    volumeChange30d: null,
    buyerChange30d: null,
    snapshotsAvailable: 0,
    firstSnapshotDate: null,
    lastSnapshotDate: null,
    interpretation: "No trend data yet.",
  }),
}));

import { checkDiscoveryLayersCached as mockCheckDiscoveryLayers } from "@/lib/analytics/origin-probe";
import { getSupplyGapForCategory as mockGetSupplyGapForCategory } from "@/lib/services/supplyGapService";

import {
  getMerchantData,
  getMerchantByOrigin,
  getMerchantByAddress,
  computeBasicReport,
  computeCompetitiveReport,
  computeMerchantDeepDive,
  scoreAllMerchants,
} from "@/lib/analytics/ranker";

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

function setSelectResults(...results: unknown[][]) {
  selectResults = results;
  selectCallIndex = 0;
}

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectResults = [];

  mockSelect.mockImplementation(() => {
    const result = selectCallIndex < selectResults.length
      ? selectResults[selectCallIndex]
      : [];
    selectCallIndex++;
    return makeSelectChain(result);
  });

  mockUpdate.mockImplementation(() => makeUpdateChain());
  mockInsert.mockImplementation(() => makeInsertChain());
  mockExecute.mockResolvedValue(undefined);
  // Default: x402scan unavailable — deep-dive falls back to nulls for all-time
  // stats. Tests that assert real all-time figures set a resolved value.
  mockFetchMerchantStats.mockResolvedValue(null);

  // Default discovery-layer probe result (all layers except CDP absent) and no
  // supply-gap cache. Tests that assert layer/gap tips override these.
  vi.mocked(mockCheckDiscoveryLayers).mockResolvedValue({
    cdpBazaar: { indexed: true, note: "Indexed via CDP" },
    x402scan: { indexed: false, note: "Not found" },
    agentCash: { indexed: false, note: "No openapi.json" },
    layerAlignmentScore: 1,
  });
  vi.mocked(mockGetSupplyGapForCategory).mockResolvedValue(null);
});

describe("getMerchantData", () => {
  it("returns null when merchant not found", async () => {
    setSelectResults([]);
    const result = await getMerchantData("nonexistent");
    expect(result).toBeNull();
  });

  it("returns merchant with resources and no category", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [resource]);

    const result = await getMerchantData(merchant.id);
    expect(result).not.toBeNull();
    expect(result!.merchant.id).toBe(merchant.id);
    expect(result!.resources).toHaveLength(1);
    expect(result!.category).toBeNull();
  });

  it("returns merchant with category when categoryId exists", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({ categoryId: cat.id });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [resource], [cat]);

    const result = await getMerchantData(merchant.id);
    expect(result!.category).not.toBeNull();
    expect(result!.category!.id).toBe(cat.id);
  });

  it("returns empty resources array when merchant has none", async () => {
    const merchant = makeMerchant({ categoryId: null });
    setSelectResults([merchant], []);

    const result = await getMerchantData(merchant.id);
    expect(result!.resources).toEqual([]);
  });
});

describe("getMerchantByOrigin", () => {
  it("returns null when resource not found", async () => {
    setSelectResults([]);
    const result = await getMerchantByOrigin("https://unknown.com");
    expect(result).toBeNull();
  });

  it("finds merchant via exact resource URL", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      resourceUrl: "https://api.test.com/endpoint",
    });
    setSelectResults([resource], [merchant], [resource]);

    const result = await getMerchantByOrigin("https://api.test.com/endpoint");
    expect(result).not.toBeNull();
    expect(result!.merchant.id).toBe(merchant.id);
  });

  it("falls back to host match when the domain-only origin has no exact row", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      resourceUrl: "https://mesh.heurist.xyz/api/v1/tool",
    });
    // 1st select (exact) empty, 2nd select (host) hits, then getMerchantData.
    setSelectResults([], [resource], [merchant], [resource]);

    const result = await getMerchantByOrigin("https://mesh.heurist.xyz");
    expect(result).not.toBeNull();
    expect(result!.merchant.id).toBe(merchant.id);
  });

  it("accepts a bare host with no scheme", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      resourceUrl: "https://mesh.heurist.xyz/api/v1/tool",
    });
    setSelectResults([], [resource], [merchant], [resource]);

    const result = await getMerchantByOrigin("mesh.heurist.xyz");
    expect(result).not.toBeNull();
  });

  it("falls back to a subdomain when the bare registrable domain has no exact or host row", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      resourceUrl: "https://api.bitrefill.com/x402/checkout",
    });
    // exact empty, host (bitrefill.com) empty, subdomain (*.bitrefill.com) hits,
    // then getMerchantData.
    setSelectResults([], [], [resource], [merchant], [resource]);

    const result = await getMerchantByOrigin("bitrefill.com");
    expect(result).not.toBeNull();
    expect(result!.merchant.id).toBe(merchant.id);
  });

  it("returns null for an unparseable origin", async () => {
    setSelectResults([]);
    const result = await getMerchantByOrigin("://::not-a-url");
    expect(result).toBeNull();
  });
});

describe("getMerchantByAddress", () => {
  it("returns null when merchant not found", async () => {
    setSelectResults([]);
    const result = await getMerchantByAddress("0xUnknown", "base");
    expect(result).toBeNull();
  });

  it("finds merchant by address and chain", async () => {
    const merchant = makeMerchant({
      payeeAddress: "0xtest",
      chain: "base",
      categoryId: null,
    });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [merchant], [resource]);

    const result = await getMerchantByAddress("0xtest", "base");
    expect(result).not.toBeNull();
  });

  it("resolves a checksummed (mixed-case) address by lowercasing it", async () => {
    const merchant = makeMerchant({ payeeAddress: "0xabc", chain: "base", categoryId: null });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [merchant], [resource]);

    // Client sends the checksummed (mixed-case) form; lookup lowercases to match.
    const result = await getMerchantByAddress("0xABC", "base");
    expect(result).not.toBeNull();
    expect(result!.merchant.payeeAddress).toBe("0xabc");
  });

  it("resolves a CAIP-2 chain string by normalizing it to shorthand", async () => {
    const merchant = makeMerchant({ payeeAddress: "0xabc", chain: "base", categoryId: null });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [merchant], [resource]);

    // Client passes the raw CAIP-2 form; the lookup normalizes to "base".
    const result = await getMerchantByAddress("0xABC", "eip155:8453");
    expect(result).not.toBeNull();
  });
});

describe("computeBasicReport", () => {
  it("returns report with no category", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      description: "A".repeat(200),
      tags: ["api"],
      priceUsd: "0.01",
      serviceName: "Test",
    });
    const data = { merchant, resources: [resource], category: null };

    const report = await computeBasicReport(data);
    expect(report.category).toBeNull();
    expect(report.totalCompetitors).toBe(0);
    expect(report.rankPosition).toBeNull();
    expect(report.pricePosition).toBe("median");
  });

  it("returns report with category and competitor count", async () => {
    const cat = makeCategory({ medianPrice: "0.05" });
    const merchant = makeMerchant({ categoryId: cat.id, rankPosition: 3 });
    const resource = makeResource(merchant.id, {
      description: "A".repeat(200),
      tags: ["api"],
      priceUsd: "0.01",
      serviceName: "Test",
    });
    const data = { merchant, resources: [resource], category: cat };

    setSelectResults([{ count: 10 }]);

    const report = await computeBasicReport(data);
    expect(report.category).toBe("api");
    expect(report.totalCompetitors).toBe(10);
    expect(report.rankPosition).toBe(3);
  });

  it("computes below_median price position", async () => {
    const cat = makeCategory({ medianPrice: "1.00" });
    const merchant = makeMerchant({ categoryId: cat.id });
    const resource = makeResource(merchant.id, { priceUsd: "0.05" });
    const data = { merchant, resources: [resource], category: cat };

    setSelectResults([{ count: 5 }]);

    const report = await computeBasicReport(data);
    expect(report.pricePosition).toBe("below_median");
  });

  it("computes above_median price position", async () => {
    const cat = makeCategory({ medianPrice: "0.01" });
    const merchant = makeMerchant({ categoryId: cat.id });
    const resource = makeResource(merchant.id, { priceUsd: "1.00" });
    const data = { merchant, resources: [resource], category: cat };

    setSelectResults([{ count: 5 }]);

    const report = await computeBasicReport(data);
    expect(report.pricePosition).toBe("above_median");
  });

  it("generates tips for low quality listings", async () => {
    const merchant = makeMerchant({
      categoryId: null,
      txCount30d: 2,
      buyers30d: 1,
    });
    const resource = makeResource(merchant.id, {
      description: "short",
      tags: [],
      serviceName: null,
      priceUsd: null,
    });
    const data = { merchant, resources: [resource], category: null };

    const report = await computeBasicReport(data);
    expect(report.tips.length).toBeGreaterThan(0);
    expect(report.tips.length).toBeLessThanOrEqual(3);
  });

  it("generates no tips for high quality merchant", async () => {
    // High quality now means a keyword-dense, fluff-free description AND
    // category-relevant tags (plus schemas, volume, buyers) — not just length.
    // Also present on all 3 discovery layers so no discovery-layer tip fires.
    vi.mocked(mockCheckDiscoveryLayers).mockResolvedValueOnce({
      cdpBazaar: { indexed: true, note: "ok" },
      x402scan: { indexed: true, note: "ok" },
      agentCash: { indexed: true, note: "ok" },
      layerAlignmentScore: 3,
    });
    const cat = makeCategory({ slug: "crypto-defi", name: "Crypto & DeFi" });
    const merchant = makeMerchant({
      categoryId: cat.id,
      rankPosition: 2,
      txCount30d: 100,
      buyers30d: 50,
    });
    const resource = makeResource(merchant.id, {
      description:
        "Returns on-chain DeFi token balances and wallet holdings from Base blockchain. GET /api/v1/ endpoint accepts an address query parameter, returns JSON response with token, crypto price, and holdings.",
      tags: ["crypto", "defi", "onchain", "wallet"],
      serviceName: "Great Service",
      priceUsd: "0.01",
      hasInputSchema: true,
      hasOutputExample: true,
    });
    const data = { merchant, resources: [resource], category: cat };

    setSelectResults([{ count: 5 }]);

    const report = await computeBasicReport(data);
    expect(report.tips.length).toBe(0);
  });

  it("surfaces the discovery-layer status and a registration tip", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    // Default mock: on CDP only (score 1), x402scan + agentCash absent.
    const report = await computeBasicReport(data);
    expect(report.discoveryLayers?.layerAlignmentScore).toBe(1);
    expect(
      report.tips.some((t) => t.includes("of 3 discovery layers")),
    ).toBe(true);
  });

  it("prepends a supply-gap tip when the merchant is buried", async () => {
    const cat = makeCategory({ slug: "crypto-defi", name: "Crypto & DeFi" });
    const merchant = makeMerchant({ categoryId: cat.id });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: cat };

    vi.mocked(mockGetSupplyGapForCategory).mockResolvedValueOnce({
      categoryName: "Crypto & DeFi",
      perQuery: [
        {
          query: "crypto",
          cdpResults: 15,
          cdpResourceUrls: [],
          categoryMerchantCount: 303,
          buriedCount: 288,
          gapRatio: 0.95,
          buriedSample: [],
        },
      ],
      averageGapRatio: 0.85,
      totalBuriedMerchants: 200,
      totalCategoryMerchants: 303,
      refreshedAt: "2026-07-26T00:00:00Z",
      merchantIsBuried: true,
    });

    setSelectResults([{ count: 303 }]);

    const report = await computeBasicReport(data);
    expect(report.supplyGap?.merchantIsBuried).toBe(true);
    expect(report.tips[0]).toContain("invisible to CDP search");
  });
});

describe("computeCompetitiveReport", () => {
  it("returns empty competitors when no category", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    const report = await computeCompetitiveReport(data, "https://merchant.example.com");
    expect(report.category).toBeNull();
    expect(report.topCompetitors).toEqual([]);
    expect(report.totalCompetitors).toBe(0);
  });

  it("loads competitors and computes gap analysis with category", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({ id: "self", categoryId: cat.id, rankPosition: 1 });
    const resource = makeResource(merchant.id, { tags: ["api"] });
    const data = { merchant, resources: [resource], category: cat };

    const comp = makeMerchant({
      id: "comp-1",
      categoryId: cat.id,
      rankerScore: "0.8",
      rankPosition: 2,
    });
    const compResource = makeResource(comp.id, {
      tags: ["api", "ml"],
      priceUsd: "0.05",
      resourceUrl: "https://comp.com/api",
    });

    // Query order: category count, competitor merchants, competitor resources,
    // then the category-wide per-merchant price aggregate.
    setSelectResults(
      [{ count: 5 }],
      [merchant, comp],
      [compResource],
      [{ avgPrice: "0.02" }, { avgPrice: "0.04" }, { avgPrice: "0.06" }],
    );

    const report = await computeCompetitiveReport(data, "https://merchant.example.com");
    expect(report.category).toBe("api");
    expect(report.totalCompetitors).toBe(5);
    expect(report.topCompetitors.length).toBeGreaterThan(0);
    expect(report.gapAnalysis).toBeDefined();
    expect(report.gapAnalysis.missingTags).toContain("ml");
    // Median of [0.02, 0.04, 0.06] = 0.04, computed category-wide.
    expect(report.medianPrice).toBeCloseTo(0.04, 6);
    expect(report.minPrice).toBeCloseTo(0.02, 6);
    expect(report.maxPrice).toBeCloseTo(0.06, 6);
    // AI insights fall back to null when OPENCODE_API_KEY is unset (test env);
    // the static report is returned regardless.
    expect(report.aiInsights).toBeNull();
  });

  it("uses 30-day call counts (l30dCalls) for competitor toolCalls, not the dead toolCalls column", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({ id: "self", categoryId: cat.id, rankPosition: 1 });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: cat };

    const comp = makeMerchant({ id: "comp-1", categoryId: cat.id, rankerScore: "0.8", rankPosition: 2, buyers30d: 7 });
    const compResource = makeResource(comp.id, {
      resourceUrl: "https://comp.com/api",
      l30dCalls: 1234,
      toolCalls: 0,
    });

    setSelectResults(
      [{ count: 2 }],
      [merchant, comp],
      [compResource],
      [{ avgPrice: "0.01" }],
    );

    const report = await computeCompetitiveReport(data, "https://merchant.example.com");
    const entry = report.topCompetitors[0];
    expect(entry.toolCalls).toBe(1234);
    expect(entry.uniqueBuyers).toBe(7);
    expect(entry.rank).toBe(2);
  });

  it("computes an even-length category median as the average of the two middle values", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({ id: "self", categoryId: cat.id, rankPosition: 1 });
    const resource = makeResource(merchant.id, { priceUsd: "0.03" });
    const data = { merchant, resources: [resource], category: cat };

    // Only self in the competitor list → the competitor-resources query is
    // skipped, so the pricing aggregate is the 3rd select, not the 4th.
    setSelectResults(
      [{ count: 4 }],
      [merchant],
      [{ avgPrice: "0.01" }, { avgPrice: "0.02" }, { avgPrice: "0.04" }, { avgPrice: "0.08" }],
    );

    const report = await computeCompetitiveReport(data, "https://merchant.example.com");
    // median of [0.01, 0.02, 0.04, 0.08] = (0.02 + 0.04) / 2 = 0.03
    expect(report.medianPrice).toBeCloseTo(0.03, 6);
    // yourPrice 0.03; atOrBelow = {0.01,0.02} + ... yourPrice not in set → 2/4 = 50
    expect(report.pricePercentile).toBe(50);
  });
});

describe("computeMerchantDeepDive", () => {
  it("returns full deep dive report enriched from x402scan", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({
      categoryId: cat.id,
      rankPosition: 1,
      volume30d: "200",
      txCount30d: 50,
      buyers30d: 10,
    });
    const resource = makeResource(merchant.id, {
      serviceName: "TestService",
      priceUsd: "0.05",
    });
    const data = { merchant, resources: [resource], category: cat };
    const trend = makeTrend(merchant.id);

    // All-time figures come from x402scan, not the Bazaar catalog.
    mockFetchMerchantStats.mockResolvedValueOnce({
      address: merchant.payeeAddress,
      chain: "base",
      totalTransactions: 100,
      totalVolumeUsd: 500,
      uniqueBuyers: 20,
      uniqueSellers: 3,
      volume30d: 200,
      txCount30d: 50,
      buyers30d: 10,
    });

    setSelectResults(
      [trend],
      [{ count: 5 }],
    );

    const report = await computeMerchantDeepDive(data);
    expect(report.serviceName).toBe("TestService");
    expect(report.category).toBe("api");
    expect(report.rank).toBe(1);
    expect(report.totalTxns).toBe(100);
    expect(report.totalVolumeUsd).toBe(500);
    expect(report.volume30d).toBe(200);
    expect(report.txCount30d).toBe(50);
    expect(report.totalUniqueBuyers).toBe(20);
    expect(report.uniqueSellers).toBe(3);
    expect(report.uniqueBuyers30d).toBe(10);
    expect(report.allTimeStatsAvailable).toBe(true);
    expect(report.trends).toHaveLength(1);
    expect(report.price).toBe(0.05);
  });

  it("returns null all-time stats and a flag when x402scan is unavailable", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({
      categoryId: cat.id,
      rankPosition: 1,
      volume30d: "200",
      txCount30d: 50,
      buyers30d: 10,
    });
    const resource = makeResource(merchant.id, { priceUsd: "0.05" });
    const data = { merchant, resources: [resource], category: cat };

    mockFetchMerchantStats.mockResolvedValueOnce(null);
    setSelectResults([makeTrend(merchant.id)], [{ count: 5 }]);

    const report = await computeMerchantDeepDive(data);
    expect(report.totalTxns).toBeNull();
    expect(report.totalVolumeUsd).toBeNull();
    expect(report.totalUniqueBuyers).toBeNull();
    expect(report.allTimeStatsAvailable).toBe(false);
    // 30-day figures still come from the catalog.
    expect(report.volume30d).toBe(200);
    expect(report.txCount30d).toBe(50);
    expect(report.uniqueBuyers30d).toBe(10);
  });

  it("computes buyer concentration correctly", async () => {
    const merchant = makeMerchant({
      categoryId: null,
      buyers30d: 5,
      txCount30d: 20,
    });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    setSelectResults(
      [],
    );

    const report = await computeMerchantDeepDive(data);
    expect(report.buyerConcentration).toBeGreaterThan(0);
    expect(report.buyerConcentration).toBeLessThanOrEqual(1);
  });

  it("returns 0 buyer concentration when buyers >= txCount", async () => {
    const merchant = makeMerchant({
      categoryId: null,
      buyers30d: 10,
      txCount30d: 10,
    });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    setSelectResults([]);

    const report = await computeMerchantDeepDive(data);
    expect(report.buyerConcentration).toBe(0);
  });

  it("returns 0 buyer concentration when no buyers", async () => {
    const merchant = makeMerchant({
      categoryId: null,
      buyers30d: 0,
      txCount30d: 0,
    });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    setSelectResults([]);

    const report = await computeMerchantDeepDive(data);
    expect(report.buyerConcentration).toBe(0);
  });

  it("returns null price when no resources have priceUsd", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, { priceUsd: null });
    const data = { merchant, resources: [resource], category: null };

    setSelectResults([]);

    const report = await computeMerchantDeepDive(data);
    expect(report.price).toBeNull();
  });

  it("returns null serviceName when no resources", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const data = { merchant, resources: [], category: null };

    setSelectResults([]);

    const report = await computeMerchantDeepDive(data);
    expect(report.serviceName).toBeNull();
  });
});

describe("scoreAllMerchants", () => {
  it("scores all merchants and assigns rank positions", async () => {
    const cat = makeCategory();
    const m1 = makeMerchant({ categoryId: cat.id, txCount30d: 100 });
    const m2 = makeMerchant({ categoryId: cat.id, txCount30d: 10 });
    const r1 = makeResource(m1.id);
    const r2 = makeResource(m2.id);

    setSelectResults(
      [m1, m2],
      [r1, r2],
      [cat],
    );

    const result = await scoreAllMerchants();
    expect(result).toBe(2);
    // Scores are applied via batched UPDATE ... FROM (VALUES ...) statements
    // and rank assignment runs via SQL, so all writes go through db.execute.
    expect(mockExecute).toHaveBeenCalled();
  });

  it("returns 0 when no merchants exist", async () => {
    setSelectResults([], [], []);
    const result = await scoreAllMerchants();
    expect(result).toBe(0);
  });

  it("handles merchants with no resources", async () => {
    const m = makeMerchant({ categoryId: null });
    setSelectResults([m], [], []);

    const result = await scoreAllMerchants();
    expect(result).toBe(1);
  });

  it("runs set-based rank assignment (partitioned + global) via SQL", async () => {
    const cat1 = makeCategory({ id: "c1" });
    const cat2 = makeCategory({ id: "c2" });
    setSelectResults([], [], [cat1, cat2]);

    await scoreAllMerchants();
    // With no merchants there is no score-batch UPDATE, leaving exactly two
    // rank statements: one partitioned per-category, one global. This count is
    // independent of category count.
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
