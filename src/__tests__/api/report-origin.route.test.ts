import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeMerchant, makeResource, resetIdCounter } from "../fixtures/factories";
import { installRouterMock } from "../fixtures/mock-router";

const mockGetMerchantByOrigin = vi.fn();
const mockComputeBasicReport = vi.fn();

vi.mock("@/lib/analytics/ranker", () => ({
  getMerchantByOrigin: (...args: unknown[]) => mockGetMerchantByOrigin(...args),
  computeBasicReport: (...args: unknown[]) => mockComputeBasicReport(...args),
}));

// Rate limiting is exercised in rate-limit.test.ts; here it's a passthrough so
// these tests don't transitively depend on the @upstash packages.
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: (handler: unknown) => handler,
}));

installRouterMock();

import { POST } from "@/app/api/report/origin/route";

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/report/origin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/report/origin", () => {
  it("returns 400 when origin is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when origin is not a valid url", async () => {
    const res = await POST(makeRequest({ origin: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("returns found=false when origin not in DB", async () => {
    mockGetMerchantByOrigin.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ origin: "https://unknown.com" }));
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("returns found=true with report for valid origin", async () => {
    const merchant = makeMerchant({ lastUpdated: new Date("2024-06-01") });
    const resource = makeResource(merchant.id);
    const data = { merchant, resources: [resource], category: null };

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeBasicReport.mockResolvedValueOnce({
      category: "api",
      rankPosition: 1,
      totalCompetitors: 5,
      pricePosition: "median",
      descriptionQuality: 80,
      listingCompleteness: 75,
      tips: ["Tip 1"],
      descriptionQualityBreakdown: {
        score: 0.72,
        lengthScore: 1.0,
        keywordDensity: 0.57,
        categoryKeywordPresence: 0.6,
        structuralSpecificity: 0.8,
        length: 234,
        fluffScore: 0.9,
        buzzwords: [],
        verdict:
          "Good — description has strong keyword grounding and structural specificity",
      },
      tagQualityBreakdown: {
        score: 0.85,
        relevance: 1,
        specificity: 1,
        countScore: 1,
        spam: false,
        count: 4,
        issues: [],
        suggestedTags: ["onchain", "wallet"],
      },
      discoveryLayers: {
        cdpBazaar: { indexed: true, note: "Indexed via CDP" },
        x402scan: { indexed: false, note: "Not found" },
        agentCash: { indexed: false, note: "No openapi.json" },
        layerAlignmentScore: 1,
      },
      supplyGap: {
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
      },
      completenessGrade: "C",
      actionRoadmap: [
        {
          action: "Publish input schemas for every endpoint",
          priority: "high",
          component: "listingQuality",
          issue: "Missing Bazaar input schema",
          expectedImpact: "+0.04 score",
        },
      ],
      chainCount: 2,
      weightRationale: {
        volume: { weight: 0.4, reason: "r", whatMovesIt: "w", merchantCanControl: false },
        buyerDiversity: { weight: 0.25, reason: "r", whatMovesIt: "w", merchantCanControl: false },
        reliability: { weight: 0.05, reason: "r", whatMovesIt: "w", merchantCanControl: false },
        listingQuality: { weight: 0.15, reason: "r", whatMovesIt: "w", merchantCanControl: true },
        recency: { weight: 0.15, reason: "r", whatMovesIt: "w", merchantCanControl: false },
      },
      rankTrend: {
        trendDirection: "improving",
        scoreChange30d: 0.1,
        rankChange30d: 7,
        volumeChange30d: 60,
        buyerChange30d: 12,
        snapshotsAvailable: 30,
        firstSnapshotDate: "2026-06-26",
        lastSnapshotDate: "2026-07-26",
        interpretation: "Your score improved.",
      },
    });

    const res = await POST(makeRequest({ origin: "https://test.com" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.category).toBe("api");
    expect(body.rank_position).toBe(1);
    expect(body.tips).toEqual(["Tip 1"]);
    expect(body.description_quality_breakdown).toMatchObject({
      score: expect.any(Number),
      verdict: expect.any(String),
    });
    expect(body.tag_quality).toMatchObject({
      score: expect.any(Number),
      count: expect.any(Number),
      suggested_tags: expect.any(Array),
    });
    expect(body.discovery_layers).toEqual({
      cdp_bazaar: { indexed: true, note: "Indexed via CDP" },
      x402scan: { indexed: false, note: "Not found" },
      agent_cash: { indexed: false, note: "No openapi.json" },
      layer_alignment_score: 1,
    });
    expect(body.supply_gap).toMatchObject({
      category_name: "Crypto & DeFi",
      merchant_is_buried: true,
    });
    expect(body.supply_gap.per_query[0]).toMatchObject({
      query: "crypto",
      cdp_results: 15,
    });
    expect(body.completeness_grade).toBe("C");
    expect(body.action_roadmap[0]).toMatchObject({
      action: expect.any(String),
      priority: "high",
      expected_impact: expect.any(String),
    });
    expect(body.chain_count).toBe(2);
    expect(body.weight_rationale.volume).toMatchObject({
      weight: 0.4,
      merchant_can_control: false,
    });
    expect(body.weight_rationale.listingQuality.merchant_can_control).toBe(true);
    expect(body.rank_trend).toMatchObject({
      trend_direction: "improving",
      score_change_30d: 0.1,
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockGetMerchantByOrigin.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makeRequest({ origin: "https://test.com" }));
    expect(res.status).toBe(500);
  });
});
