import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeMerchant, makeResource, resetIdCounter } from "../fixtures/factories";

const mockGetMerchantByOrigin = vi.fn();
const mockComputeCompetitiveReport = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/analytics/ranker", () => ({
  getMerchantByOrigin: (...args: unknown[]) => mockGetMerchantByOrigin(...args),
  computeCompetitiveReport: (...args: unknown[]) => mockComputeCompetitiveReport(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  reports: {},
}));

vi.mock("@/lib/config", () => ({
  REPORT_COST_USDC: "0.03",
}));

import { POST } from "@/app/api/report/competitive/route";

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  const insertChain: Record<string, unknown> = {};
  insertChain.values = vi.fn(() => insertChain);
  insertChain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);
  mockInsert.mockReturnValue(insertChain);
});

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/report/competitive", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/report/competitive", () => {
  it("returns 400 when origin is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns found=false when origin not in DB", async () => {
    mockGetMerchantByOrigin.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ origin: "https://unknown.com" }));
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("returns found=true with competitive report", async () => {
    const merchant = makeMerchant();
    const resource = makeResource(merchant.id);
    mockGetMerchantByOrigin.mockResolvedValueOnce({
      merchant,
      resources: [resource],
      category: null,
    });
    mockComputeCompetitiveReport.mockResolvedValueOnce({
      category: "api",
      yourRank: 1,
      totalCompetitors: 5,
      topCompetitors: [
        {
          origin: "https://comp.com",
          rank: 2,
          score: 0.8,
          price: 0.05,
          uniqueBuyers: 10,
          toolCalls: 5,
          descriptionLength: 200,
        },
      ],
      gapAnalysis: { missingTags: ["ml"], missingKeywords: [], competitorCount: 1 },
      yourPrice: 0.01,
      medianPrice: 0.03,
      minPrice: 0.01,
      maxPrice: 0.05,
      pricePercentile: 25,
      recommendations: ["Add tags"],
    });

    const res = await POST(makeRequest({ origin: "https://test.com" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.category).toBe("api");
    expect(body.competitors).toHaveLength(1);
    expect(body.gap_analysis).toBeDefined();
    expect(body.pricing_benchmark).toBeDefined();
    expect(body.pricing_benchmark.your_price).toBe(0.01);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("limits competitors to 10 in response", async () => {
    const merchant = makeMerchant();
    mockGetMerchantByOrigin.mockResolvedValueOnce({
      merchant,
      resources: [],
      category: null,
    });

    const topCompetitors = Array.from({ length: 15 }, (_, i) => ({
      origin: `https://comp${i}.com`,
      rank: i + 1,
      score: 0.5,
      price: 0.01,
      uniqueBuyers: 5,
      toolCalls: 1,
      descriptionLength: 100,
    }));

    mockComputeCompetitiveReport.mockResolvedValueOnce({
      category: null,
      yourRank: null,
      totalCompetitors: 0,
      topCompetitors,
      gapAnalysis: { missingTags: [], missingKeywords: [], competitorCount: 0 },
      yourPrice: null,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      pricePercentile: null,
      recommendations: [],
    });

    const res = await POST(makeRequest({ origin: "https://test.com" }));
    const body = await res.json();
    expect(body.competitors.length).toBeLessThanOrEqual(10);
  });

  it("returns 500 on unexpected error", async () => {
    mockGetMerchantByOrigin.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makeRequest({ origin: "https://test.com" }));
    expect(res.status).toBe(500);
  });
});
