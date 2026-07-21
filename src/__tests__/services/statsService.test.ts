import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIdCounter } from "../fixtures/factories";
import { makeSelectChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

import { getEcosystemStats, getRecentlyUpdatedMerchants } from "@/lib/services/statsService";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length
      ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });
});

describe("getEcosystemStats", () => {
  it("returns stats with valid data", async () => {
    selectResults = [
      [{ count: 50 }],
      [{ count: 10 }],
      [{ total: 5000 }],
      [{ name: "api" }],
    ];

    const result = await getEcosystemStats();
    expect(result.totalMerchants).toBe(50);
    expect(result.totalCategories).toBe(10);
    expect(result.totalTransactions).toBe(5000);
    expect(result.topCategory).toBe("api");
  });

  it("returns 'N/A' for topCategory when no categories", async () => {
    selectResults = [
      [{ count: 0 }],
      [{ count: 0 }],
      [{ total: 0 }],
      [],
    ];

    const result = await getEcosystemStats();
    expect(result.topCategory).toBe("N/A");
  });

  it("handles null counts gracefully", async () => {
    selectResults = [
      [{}],
      [{}],
      [{}],
      [],
    ];

    const result = await getEcosystemStats();
    expect(result.totalMerchants).toBe(0);
    expect(result.totalCategories).toBe(0);
    expect(result.totalTransactions).toBe(0);
  });
});

describe("getRecentlyUpdatedMerchants", () => {
  it("returns merchants ordered by lastUpdated", async () => {
    selectResults = [[
      { id: "1", payeeAddress: "0x1", rankerScore: "0.8", rankPosition: 1, txCount30d: 50, uniqueBuyers: 10, lastUpdated: new Date() },
    ]];

    const result = await getRecentlyUpdatedMerchants(5);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no merchants", async () => {
    selectResults = [[]];
    const result = await getRecentlyUpdatedMerchants(5);
    expect(result).toEqual([]);
  });
});

describe("error paths", () => {
  it("getEcosystemStats propagates DB errors", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("connection refused");
    });
    await expect(getEcosystemStats()).rejects.toThrow("connection refused");
  });

  it("getRecentlyUpdatedMerchants propagates DB errors", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("connection refused");
    });
    await expect(getRecentlyUpdatedMerchants(5)).rejects.toThrow("connection refused");
  });
});
