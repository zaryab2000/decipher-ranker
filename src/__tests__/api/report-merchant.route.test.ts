import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeMerchant, makeResource, resetIdCounter } from "../fixtures/factories";

const mockGetMerchantByAddress = vi.fn();
const mockComputeMerchantDeepDive = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/analytics/ranker", () => ({
  getMerchantByAddress: (...args: unknown[]) => mockGetMerchantByAddress(...args),
  computeMerchantDeepDive: (...args: unknown[]) => mockComputeMerchantDeepDive(...args),
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

import { POST } from "@/app/api/report/merchant/route";

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
  return new NextRequest("http://localhost/api/report/merchant", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/report/merchant", () => {
  it("returns 400 when address is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when address is not a string", async () => {
    const res = await POST(makeRequest({ address: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns found=false when merchant not found", async () => {
    mockGetMerchantByAddress.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ address: "0xUnknown" }));
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("returns found=true with report and inserts report row", async () => {
    const merchant = makeMerchant();
    const resource = makeResource(merchant.id);
    mockGetMerchantByAddress.mockResolvedValueOnce({
      merchant,
      resources: [resource],
      category: null,
    });
    mockComputeMerchantDeepDive.mockResolvedValueOnce({
      serviceName: "Test",
      category: "api",
      rank: 1,
      totalTxns: 100,
      totalVolumeUsd: 500,
      volume30d: 200,
      txCount30d: 50,
      totalUniqueBuyers: 20,
      uniqueBuyers30d: 10,
      buyerConcentration: 0.3,
      diversityScore: 75,
      price: 0.05,
      priceVsCategory: "median",
      trends: [],
      recommendations: [],
    });

    const res = await POST(makeRequest({ address: "0xTest" }));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.service_name).toBe("Test");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("passes custom chain param", async () => {
    mockGetMerchantByAddress.mockResolvedValueOnce(null);
    await POST(makeRequest({ address: "0xTest", chain: "ethereum" }));
    expect(mockGetMerchantByAddress).toHaveBeenCalledWith("0xTest", "ethereum");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetMerchantByAddress.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makeRequest({ address: "0xTest" }));
    expect(res.status).toBe(500);
  });
});
