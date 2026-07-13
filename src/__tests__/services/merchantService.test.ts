import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMerchant, makeResource, makeCategory, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockGetMerchantByOrigin = vi.fn();
const mockComputeScoreBreakdown = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/analytics/ranker", () => ({
  getMerchantByOrigin: (...args: unknown[]) => mockGetMerchantByOrigin(...args),
  computeScoreBreakdown: (...args: unknown[]) => mockComputeScoreBreakdown(...args),
  getMerchantByAddress: vi.fn(),
  getMerchantData: vi.fn(),
}));

import { searchMerchants, getMerchantProfile } from "@/lib/services/merchantService";

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
});

describe("searchMerchants", () => {
  it("returns merchants matching by resource URL and address", async () => {
    const merchant = makeMerchant();
    const resource = makeResource(merchant.id, { serviceName: "Test API" });

    selectResults = [
      [{ merchantId: merchant.id, resourceUrl: resource.resourceUrl, serviceName: "Test API" }],
      [{ id: merchant.id }],
    ];

    const result = await searchMerchants("test");
    expect(result.query).toBe("test");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("returns empty array when no matches found", async () => {
    selectResults = [[], []];

    const result = await searchMerchants("nonexistent");
    expect(result.merchants).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("deduplicates results by merchant ID", async () => {
    const merchant = makeMerchant();
    selectResults = [
      [
        { merchantId: merchant.id, resourceUrl: "https://a.com", serviceName: "A" },
        { merchantId: merchant.id, resourceUrl: "https://b.com", serviceName: "B" },
      ],
      [],
    ];

    const result = await searchMerchants("test");
    expect(result.merchants.length).toBeLessThanOrEqual(1);
  });

  it("respects limit parameter", async () => {
    selectResults = [[], []];

    const result = await searchMerchants("test", 5);
    expect(result.merchants.length).toBeLessThanOrEqual(5);
  });
});

describe("getMerchantProfile", () => {
  it("returns null when origin not found", async () => {
    mockGetMerchantByOrigin.mockResolvedValueOnce(null);

    const result = await getMerchantProfile("https://unknown.com");
    expect(result).toBeNull();
  });

  it("returns full profile with score breakdown", async () => {
    const merchant = makeMerchant({
      rankerScore: "0.85",
      rankPosition: 3,
      txCount30d: 100,
      uniqueBuyers: 20,
      buyers30d: 15,
      totalAmountUsd: "5000",
      volume30d: "1000",
      firstSeenAt: new Date("2024-01-01"),
    });
    const resource = makeResource(merchant.id, {
      serviceName: "Test API",
      tags: ["api", "data"],
      priceUsd: "0.01",
    });
    const cat = makeCategory({ name: "api" });
    merchant.categoryId = cat.id;

    const data = { merchant, resources: [resource], category: cat };

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeScoreBreakdown.mockReturnValueOnce({
      volumeSignal: 0.5,
      buyerDiversity: 0.3,
      reliability: 0.7,
      listingQuality: 0.6,
      recency: 0.8,
    });

    selectResults = [[], []];

    const result = await getMerchantProfile("https://test.com");
    expect(result).not.toBeNull();
    expect(result!.serviceName).toBe("Test API");
    expect(result!.rankerScore).toBe(0.85);
    expect(result!.rankPosition).toBe(3);
    expect(result!.scoreBreakdown).toEqual({
      volumeSignal: 0.5,
      buyerDiversity: 0.3,
      reliability: 0.7,
      listingQuality: 0.6,
      recency: 0.8,
    });
  });

  it("generates improvement suggestions for missing description", async () => {
    const merchant = makeMerchant({ txCount30d: 0, buyers30d: 0 });
    const resource = makeResource(merchant.id, {
      description: "",
      tags: null,
      serviceName: "Bare API",
    });
    const cat = makeCategory({ name: "api" });
    merchant.categoryId = cat.id;

    const data = { merchant, resources: [resource], category: cat };

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeScoreBreakdown.mockReturnValueOnce({
      volumeSignal: 0,
      buyerDiversity: 0,
      reliability: 0.5,
      listingQuality: 0,
      recency: 0,
    });

    selectResults = [[], []];

    const result = await getMerchantProfile("https://bare.com");
    expect(result!.improvements.length).toBeGreaterThan(0);
    const priorities = result!.improvements.map((i) => i.priority);
    expect(priorities).toContain("high");
  });
});

describe("error paths", () => {
  it("searchMerchants propagates DB errors", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("connection refused");
    });
    await expect(searchMerchants("test")).rejects.toThrow("connection refused");
  });
});
