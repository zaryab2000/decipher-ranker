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
    });

    const res = await POST(makeRequest({ origin: "https://test.com" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.category).toBe("api");
    expect(body.rank_position).toBe(1);
    expect(body.tips).toEqual(["Tip 1"]);
  });

  it("returns 500 on unexpected error", async () => {
    mockGetMerchantByOrigin.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makeRequest({ origin: "https://test.com" }));
    expect(res.status).toBe(500);
  });
});
