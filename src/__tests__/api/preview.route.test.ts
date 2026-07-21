import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeMerchant, makeResource, makeCategory, makeMerchantData, resetIdCounter } from "../fixtures/factories";
import { installRouterMock } from "../fixtures/mock-router";
import type { MerchantData } from "@/lib/analytics/ranker";

const mockGetMerchantByOrigin = vi.fn<(...args: unknown[]) => unknown>();
const mockComputeDescriptionQuality = vi.fn<(...args: unknown[]) => unknown>();
const mockComputeListingCompleteness = vi.fn<(...args: unknown[]) => unknown>();
const mockGenerateTips = vi.fn<(...args: unknown[]) => unknown>();

const mockWithRateLimit = vi.hoisted(() =>
  vi.fn(<T>(handler: T, _opts?: unknown) => handler),
);

vi.mock("@/lib/analytics/ranker", () => ({
  getMerchantByOrigin: (...args: unknown[]) => mockGetMerchantByOrigin(...args),
  computeDescriptionQuality: (...args: unknown[]) =>
    mockComputeDescriptionQuality(...args),
  computeListingCompleteness: (...args: unknown[]) =>
    mockComputeListingCompleteness(...args),
  generateTips: (...args: unknown[]) => mockGenerateTips(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: <T>(handler: T, opts?: unknown) =>
    mockWithRateLimit(handler, opts),
}));

installRouterMock();

import { GET } from "@/app/api/preview/route";

// Capture the withRateLimit call made at module import time, before beforeEach
// clears all mocks before each test.
let rateLimitArgs: [unknown, unknown] | null = null;

beforeEach(() => {
  if (mockWithRateLimit.mock.calls.length > 0) {
    rateLimitArgs = mockWithRateLimit.mock.calls[0] as [unknown, unknown];
  }
  resetIdCounter();
  vi.clearAllMocks();
});

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/preview", () => {
  it("1: returns merchant data for known origin", async () => {
    const data = makeMerchantData({
      merchant: {
        rankerScore: "0.7623",
        rankPosition: 3,
        chain: "base",
      },
      category: { name: "Crypto & DeFi", merchantCount: 151 },
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(75);
    mockComputeListingCompleteness.mockReturnValueOnce(80);
    mockGenerateTips.mockReturnValueOnce(["Tip 1", "Tip 2", "Tip 3"]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://bitrefill.com"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.origin).toBe("https://bitrefill.com");
    expect(body.merchant).toBeDefined();
    expect(body.merchant.name).toBe("Test Service");
    expect(body.merchant.category).toBe("Crypto & DeFi");
    expect(body.merchant.score).toBe(76);
    expect(body.merchant.grade).toBe("B+");
    expect(body.merchant.rank).toBe(3);
    expect(body.merchant.total_in_category).toBe(151);
    expect(body.merchant.resource_count).toBe(1);
    expect(body.merchant.chain).toBe("base");
    expect(body.teaser.has_tips).toBe(true);
    expect(body.teaser.tip_count).toBe(3);
    expect(body.teaser.available_reports).toEqual(["origin", "competitive", "merchant"]);
    expect(body.links.full_report).toBe("/api/report/origin");
    expect(body.links.competitive).toBe("/api/report/competitive");
    expect(body.links.dashboard).toContain(encodeURIComponent(data.resources[0].resourceUrl));
  });

  it("2: returns not-found for unknown origin", async () => {
    mockGetMerchantByOrigin.mockResolvedValueOnce(null);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://unknown-service.com"));
    const body = await res.json();

    expect(body.found).toBe(false);
    expect(body.origin).toBe("https://unknown-service.com");
    expect(body.message).toBeDefined();
    expect(body.message).toContain("not yet indexed");
    expect(body.links.register).toBe("https://bazaar.coinbase.com");
    expect(body.merchant).toBeUndefined();
    expect(body.teaser).toBeUndefined();
  });

  it("3: score is 0-100 integer, not 0-1 float", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.7623", rankPosition: 1, chain: "base" },
      category: { name: "Test", merchantCount: 10 },
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(75);
    mockComputeListingCompleteness.mockReturnValueOnce(80);
    mockGenerateTips.mockReturnValueOnce(["Tip"]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://test.com"));
    const body = await res.json();

    expect(body.merchant.score).toBe(76);
    expect(Number.isInteger(body.merchant.score)).toBe(true);
  });

  it("4: grade mapping is correct at boundary values", async () => {
    const boundaries = [
      { score: "0.90", expected: "A+" },
      { score: "0.89", expected: "A" },
      { score: "0.80", expected: "A" },
      { score: "0.79", expected: "B+" },
      { score: "0.70", expected: "B+" },
      { score: "0.69", expected: "B" },
      { score: "0.60", expected: "B" },
      { score: "0.59", expected: "C+" },
      { score: "0.50", expected: "C+" },
      { score: "0.49", expected: "C" },
      { score: "0.40", expected: "C" },
      { score: "0.39", expected: "D" },
      { score: "0.30", expected: "D" },
      { score: "0.29", expected: "F" },
      { score: "0.00", expected: "F" },
    ];

    for (const { score, expected } of boundaries) {
      resetIdCounter();
      vi.clearAllMocks();

      const data = makeMerchantData({
        merchant: { rankerScore: score, rankPosition: 1, chain: "base" },
        category: { name: "Test", merchantCount: 5 },
      });

      mockGetMerchantByOrigin.mockResolvedValueOnce(data);
      mockComputeDescriptionQuality.mockReturnValueOnce(50);
      mockComputeListingCompleteness.mockReturnValueOnce(50);
      mockGenerateTips.mockReturnValueOnce([]);

      const res = await GET(makeRequest("http://localhost/api/preview?origin=https://test.com"));
      const body = await res.json();

      expect(body.merchant.score).toBe(Math.round(Number(score) * 100));
      expect(body.merchant.grade).toBe(expected);
    }
  });

  it("5: tip count matches but tips are not revealed", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.5", rankPosition: 1, chain: "base" },
      category: { name: "Test", merchantCount: 5 },
      resources: [{}],
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(30);
    mockComputeListingCompleteness.mockReturnValueOnce(40);
    mockGenerateTips.mockReturnValueOnce(["Improve descriptions", "Add schemas", "Add tags"]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://test.com"));
    const body = await res.json();

    expect(body.teaser.has_tips).toBe(true);
    expect(body.teaser.tip_count).toBe(3);
    expect(body.teaser.tip_text).toBeUndefined();
    expect(body.teaser.tips).toBeUndefined();
    expect(body.merchant).not.toHaveProperty("tips");

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("Improve descriptions");
    expect(bodyStr).not.toContain("Add schemas");
    expect(bodyStr).not.toContain("Add tags");
  });

  it("6: handles bare domain input", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.7", rankPosition: 2, chain: "solana" },
      category: { name: "Test", merchantCount: 20 },
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(80);
    mockComputeListingCompleteness.mockReturnValueOnce(85);
    mockGenerateTips.mockReturnValueOnce(["Tip"]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=bitrefill.com"));
    const body = await res.json();

    expect(body.found).toBe(true);
    expect(mockGetMerchantByOrigin).toHaveBeenCalledWith("bitrefill.com");
  });

  it("7: dashboard link is properly encoded", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.5", rankPosition: 1, chain: "base" },
      category: { name: "Test", merchantCount: 5 },
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(50);
    mockComputeListingCompleteness.mockReturnValueOnce(50);
    mockGenerateTips.mockReturnValueOnce([]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://api.example.com"));
    const body = await res.json();

    expect(body.links.dashboard).toContain(encodeURIComponent("https://api.example.com"));
  });

  it("8: merchant name falls back gracefully when no serviceName", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.5", rankPosition: 1, chain: "base" },
      category: { name: "Test", merchantCount: 5 },
      resources: [{ serviceName: null }],
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(50);
    mockComputeListingCompleteness.mockReturnValueOnce(50);
    mockGenerateTips.mockReturnValueOnce([]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://test.com"));
    const body = await res.json();

    expect(body.merchant.name).toBeNull();
  });

  it("9: category-less merchant returns null category but valid rank", async () => {
    const data = makeMerchantData({
      merchant: { rankerScore: "0.5", rankPosition: 10, chain: "base", categoryId: null },
      category: null,
    });

    mockGetMerchantByOrigin.mockResolvedValueOnce(data);
    mockComputeDescriptionQuality.mockReturnValueOnce(50);
    mockComputeListingCompleteness.mockReturnValueOnce(50);
    mockGenerateTips.mockReturnValueOnce([]);

    const res = await GET(makeRequest("http://localhost/api/preview?origin=https://test.com"));
    const body = await res.json();

    expect(body.merchant.category).toBeNull();
    expect(body.merchant.rank).toBe(10);
    expect(body.merchant.total_in_category).toBe(0);
  });

  it("10: route is wrapped with rate limit (limit: 20)", async () => {
    expect(rateLimitArgs).not.toBeNull();
    expect(typeof rateLimitArgs![0]).toBe("function");
    expect(rateLimitArgs![1]).toEqual({ limit: 20 });
  });
});
