import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCheckCache = vi.fn();
const mockSetCache = vi.fn();

vi.mock("@/lib/cache", () => ({
  checkCache: (...args: unknown[]) => mockCheckCache(...args),
  setCache: (...args: unknown[]) => mockSetCache(...args),
}));

import { fetchMerchantStats, fetchMerchantTransactions } from "@/lib/data-sources/x402scan";
import type { X402MerchantStats, X402Transaction } from "@/lib/data-sources/x402scan";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.clearAllMocks();
  mockCheckCache.mockResolvedValue(null);
  mockSetCache.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  });
}

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

  it("returns cached data when available", async () => {
    mockCheckCache.mockResolvedValueOnce(mockStats);
    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toEqual(mockStats);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches from API when cache miss", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockStats),
    );

    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toEqual(mockStats);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sets cache after successful fetch", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockStats),
    );

    await fetchMerchantStats("0xTest", "base");
    expect(mockSetCache).toHaveBeenCalledWith(
      "x402scan:stats:0xTest:base",
      mockStats,
      3600,
    );
  });

  it("returns null when API returns non-OK response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(null, false),
    );

    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchMerchantStats("0xTest", "base");
    expect(result).toBeNull();
  });

  it("uses correct cache key", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockStats),
    );

    await fetchMerchantStats("0xABC", "ethereum");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:stats:0xABC:ethereum");
  });

  it("defaults chain to base", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockStats),
    );

    await fetchMerchantStats("0xTest");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:stats:0xTest:base");
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("chain=base");
  });
});

describe("fetchMerchantTransactions", () => {
  const mockTxns: X402Transaction[] = [
    { hash: "0x1", from: "0xA", to: "0xB", amountUsd: 10, timestamp: "2024-06-01", chain: "base" },
  ];

  it("returns cached data when available", async () => {
    mockCheckCache.mockResolvedValueOnce(mockTxns);
    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual(mockTxns);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches from API when cache miss", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockTxns),
    );

    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual(mockTxns);
  });

  it("returns empty array on API error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(null, false),
    );

    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchMerchantTransactions("0xTest", "base", 5);
    expect(result).toEqual([]);
  });

  it("includes limit in cache key", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(mockTxns),
    );

    await fetchMerchantTransactions("0xTest", "base", 10);
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:10");
  });

  it("uses different cache keys for different limits", async () => {
    mockCheckCache.mockResolvedValue(null);
    (fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockFetchResponse(mockTxns))
      .mockReturnValueOnce(mockFetchResponse(mockTxns));

    await fetchMerchantTransactions("0xTest", "base", 5);
    await fetchMerchantTransactions("0xTest", "base", 10);

    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:5");
    expect(mockCheckCache).toHaveBeenCalledWith("x402scan:txns:0xTest:base:10");
  });
});
