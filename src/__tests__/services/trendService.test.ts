import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMerchant, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeInsertChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

import { writeDailySnapshot } from "@/lib/services/trendService";

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

  mockInsert.mockImplementation(() => makeInsertChain());
});

describe("writeDailySnapshot", () => {
  it("writes a snapshot for each merchant", async () => {
    const m1 = makeMerchant({ rankPosition: 1, rankerScore: "0.8", txCount30d: 50, uniqueBuyers: 10, totalAmountUsd: "500" });
    const m2 = makeMerchant({ rankPosition: 2, rankerScore: "0.5", txCount30d: 20, uniqueBuyers: 5, totalAmountUsd: "200" });

    selectResults = [[
      { id: m1.id, rankPosition: 1, rankerScore: "0.8", txCount30d: 50, uniqueBuyers: 10, totalAmountUsd: "500" },
      { id: m2.id, rankPosition: 2, rankerScore: "0.5", txCount30d: 20, uniqueBuyers: 5, totalAmountUsd: "200" },
    ]];

    const result = await writeDailySnapshot();
    expect(result).toBe(2);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no merchants", async () => {
    selectResults = [[]];
    const result = await writeDailySnapshot();
    expect(result).toBe(0);
  });

  it("uses onConflictDoUpdate for upsert", async () => {
    const m = makeMerchant();
    selectResults = [[
      { id: m.id, rankPosition: 1, rankerScore: "0.5", txCount30d: 10, uniqueBuyers: 5, totalAmountUsd: "100" },
    ]];

    await writeDailySnapshot();
    const insertReturn = mockInsert.mock.results[0].value;
    expect(insertReturn.values).toHaveBeenCalled();
  });
});

describe("error paths", () => {
  it("writeDailySnapshot propagates DB errors on select", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("connection refused");
    });
    await expect(writeDailySnapshot()).rejects.toThrow("connection refused");
  });

  it("writeDailySnapshot propagates DB errors on insert", async () => {
    const m = makeMerchant();
    selectResults = [[
      { id: m.id, rankPosition: 1, rankerScore: "0.5", txCount30d: 10, uniqueBuyers: 5, totalAmountUsd: "100" },
    ]];
    mockInsert.mockImplementation(() => {
      throw new Error("insert failed");
    });
    await expect(writeDailySnapshot()).rejects.toThrow("insert failed");
  });
});
