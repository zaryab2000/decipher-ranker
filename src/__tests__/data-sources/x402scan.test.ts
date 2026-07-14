import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckCache = vi.fn();
const mockSetCache = vi.fn();
const mockPayAndFetch = vi.fn();

vi.mock("@/lib/cache", () => ({
  checkCache: (...args: unknown[]) => mockCheckCache(...args),
  setCache: (...args: unknown[]) => mockSetCache(...args),
}));

vi.mock("@/lib/data-sources/x402scan-client", () => ({
  payAndFetch: (...args: unknown[]) => mockPayAndFetch(...args),
}));

import { fetchMerchantStats, fetchMerchantTransactions } from "@/lib/data-sources/x402scan";
import type { X402MerchantStats, X402Transaction } from "@/lib/data-sources/x402scan";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCache.mockResolvedValue(null);
  mockSetCache.mockResolvedValue(undefined);
});

describe("fetchMerchantStats", () => {
  const mockStats: X402MerchantStats = {
    address: "0xTest",
    chain: "base",
    totalTransactions: 100,
    totalVolumeUsd: 500,
    uniqueBuyers: 20,
    uniqueSellers: 5,
    volume30d: 200,
    txCount30d: 50,
    buyers30d: 10,
  };

  it("returns cached data when available without paying", async () => {
    mockCheckCache.mockResolvedValueOnce(mockStats);
    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toEqual(mockStats);
    expect(mockPayAndFetch).not.toHaveBeenCalled();
  });

  it("pays x402scan on cache miss and returns the stats", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockStats);
    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toEqual(mockStats);
    expect(mockPayAndFetch).toHaveBeenCalledTimes(1);
    const url = mockPayAndFetch.mock.calls[0][0] as string;
    expect(url).toContain("/merchants/0xTest/stats");
    expect(url).toContain("chain=base");
  });

  it("sets cache after a successful paid fetch", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockStats);
    await fetchMerchantStats("0xTest", "base");
    expect(mockSetCache).toHaveBeenCalledWith(
      "x402scan:stats:0xTest:base",
      mockStats,
      3600,
    );
  });

  it("returns null and does not cache when payAndFetch returns null", async () => {
    mockPayAndFetch.mockResolvedValueOnce(null);
    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toBeNull();
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it("uses the correct cache key", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockStats);
    await fetchMerchantStats("0xABC", "ethereum");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:stats:0xABC:ethereum");
  });

  it("defaults chain to base", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockStats);
    await fetchMerchantStats("0xTest");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:stats:0xTest:base");
    const url = mockPayAndFetch.mock.calls[0][0] as string;
    expect(url).toContain("chain=base");
  });
});

describe("fetchMerchantTransactions", () => {
  const mockTxns: X402Transaction[] = [
    { hash: "0x1", from: "0xA", to: "0xB", amountUsd: 10, timestamp: "2024-06-01", chain: "base" },
  ];

  it("returns cached data when available without paying", async () => {
    mockCheckCache.mockResolvedValueOnce(mockTxns);
    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual(mockTxns);
    expect(mockPayAndFetch).not.toHaveBeenCalled();
  });

  it("pays x402scan on cache miss and returns the txns", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockTxns);
    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual(mockTxns);
  });

  it("returns empty array when payAndFetch returns null", async () => {
    mockPayAndFetch.mockResolvedValueOnce(null);
    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual([]);
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it("includes limit in cache key", async () => {
    mockPayAndFetch.mockResolvedValueOnce(mockTxns);
    await fetchMerchantTransactions("0xTest", "base", 10);
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:10");
  });

  it("uses different cache keys for different limits", async () => {
    mockPayAndFetch.mockResolvedValue(mockTxns);
    await fetchMerchantTransactions("0xTest", "base", 5);
    await fetchMerchantTransactions("0xTest", "base", 10);
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:5");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:10");
  });
});
