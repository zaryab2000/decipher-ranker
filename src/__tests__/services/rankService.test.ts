import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIdCounter } from "../fixtures/factories";
import { makeSelectChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

import { getLeaderboard, getMerchantRank } from "@/lib/services/rankService";

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

describe("getLeaderboard", () => {
  it("returns leaderboard with default params", async () => {
    selectResults = [
      [{ count: 1 }],
      [{
        payeeAddress: "0x1",
        rankerScore: "0.8",
        rankPosition: 1,
        txCount30d: 50,
        uniqueBuyers: 10,
        totalAmountUsd: "500",
        categoryId: null,
      }],
    ];

    const result = await getLeaderboard();
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(50);
    expect(result.merchants).toHaveLength(1);
    expect(result.merchants[0].rankerScore).toBe(0.8);
  });

  it("clamps perPage between 1 and 100", async () => {
    selectResults = [[{ count: 0 }], []];
    const result = await getLeaderboard({ perPage: 200 });
    expect(result.perPage).toBe(100);
  });

  it("clamps perPage to minimum 1", async () => {
    selectResults = [[{ count: 0 }], []];
    const result = await getLeaderboard({ perPage: -5 });
    expect(result.perPage).toBe(1);
  });

  it("filters by category when provided", async () => {
    selectResults = [
      [{ id: "cat-1" }],
      [{ count: 3 }],
      [{
        payeeAddress: "0x1",
        rankerScore: "0.5",
        rankPosition: 1,
        txCount30d: 10,
        uniqueBuyers: 5,
        totalAmountUsd: "100",
        categoryId: "cat-1",
      }],
      [{ name: "api" }],
    ];

    const result = await getLeaderboard({ category: "api" });
    expect(result.merchants).toHaveLength(1);
    expect(result.merchants[0].categoryName).toBe("api");
  });

  it("handles null rankerScore gracefully", async () => {
    selectResults = [
      [{ count: 1 }],
      [{
        payeeAddress: "0x1",
        rankerScore: null,
        rankPosition: null,
        txCount30d: null,
        uniqueBuyers: null,
        totalAmountUsd: null,
        categoryId: null,
      }],
    ];

    const result = await getLeaderboard();
    expect(result.merchants[0].rankerScore).toBe(0);
    expect(result.merchants[0].txCount30d).toBe(0);
    expect(result.merchants[0].uniqueBuyers).toBe(0);
    expect(result.merchants[0].totalAmountUsd).toBe(0);
  });
});

describe("getMerchantRank", () => {
  it("returns rank position when merchant exists", async () => {
    selectResults = [[{ rankPosition: 5 }]];
    const result = await getMerchantRank("merchant-1");
    expect(result).toBe(5);
  });

  it("returns null when merchant not found", async () => {
    selectResults = [[]];
    const result = await getMerchantRank("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when rankPosition is null", async () => {
    selectResults = [[{ rankPosition: null }]];
    const result = await getMerchantRank("merchant-1");
    expect(result).toBeNull();
  });
});
