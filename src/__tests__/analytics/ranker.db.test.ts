import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMerchant, makeResource, makeCategory, makeTrend, resetIdCounter } from "../fixtures/factories";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfill);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.onConflictDoUpdate = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

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

  it("finds merchant via resource URL", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id, {
      resourceUrl: "https://api.test.com/endpoint",
    });
    setSelectResults([resource], [merchant], [resource]);

    const result = await getMerchantByOrigin("https://api.test.com/endpoint");
    expect(result).not.toBeNull();
    expect(result!.merchant.id).toBe(merchant.id);
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
      payeeAddress: "0xTest",
      chain: "base",
      categoryId: null,
    });
    const resource = makeResource(merchant.id);
    setSelectResults([merchant], [merchant], [resource]);

    const result = await getMerchantByAddress("0xTest", "base");
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
    const merchant = makeMerchant({
      categoryId: null,
      txCount30d: 100,
      buyers30d: 50,
    });
    const resource = makeResource(merchant.id, {
      description: "A".repeat(200),
      tags: ["api", "ml"],
      serviceName: "Great Service",
      priceUsd: "0.01",
    });
    const data = { merchant, resources: [resource], category: null };

    const report = await computeBasicReport(data);
    expect(report.tips.length).toBe(0);
  });
});

describe("computeCompetitiveReport", () => {
  it("returns empty competitors when no category", async () => {
    const merchant = makeMerchant({ categoryId: null });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    const report = await computeCompetitiveReport(data);
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

    setSelectResults(
      [{ count: 5 }],
      [merchant, comp],
      [compResource],
    );

    const report = await computeCompetitiveReport(data);
    expect(report.category).toBe("api");
    expect(report.totalCompetitors).toBe(5);
    expect(report.topCompetitors.length).toBeGreaterThan(0);
    expect(report.gapAnalysis).toBeDefined();
    expect(report.gapAnalysis.missingTags).toContain("ml");
  });
});

describe("computeMerchantDeepDive", () => {
  it("returns full deep dive report", async () => {
    const cat = makeCategory();
    const merchant = makeMerchant({
      categoryId: cat.id,
      rankPosition: 1,
      txCount: 100,
      totalAmountUsd: "500",
      volume30d: "200",
      txCount30d: 50,
      uniqueBuyers: 20,
      buyers30d: 10,
    });
    const resource = makeResource(merchant.id, {
      serviceName: "TestService",
      priceUsd: "0.05",
    });
    const data = { merchant, resources: [resource], category: cat };
    const trend = makeTrend(merchant.id);

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
    expect(report.uniqueBuyers30d).toBe(10);
    expect(report.trends).toHaveLength(1);
    expect(report.price).toBe(0.05);
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
    expect(mockUpdate).toHaveBeenCalledTimes(2);
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

  it("runs rank assignment SQL per category plus global", async () => {
    const cat1 = makeCategory({ id: "c1" });
    const cat2 = makeCategory({ id: "c2" });
    setSelectResults([], [], [cat1, cat2]);

    await scoreAllMerchants();
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});
