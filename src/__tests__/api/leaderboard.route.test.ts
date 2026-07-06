import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSelect = vi.fn();
const mockFindMany = vi.fn();

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfill);
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    query: new Proxy({}, {
      get() {
        return {
          findMany: (...args: unknown[]) => mockFindMany(...args),
        };
      },
    }),
  },
}));

import { GET } from "@/app/api/leaderboard/route";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length
      ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });

  mockFindMany.mockResolvedValue([]);
});

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/leaderboard");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/leaderboard", () => {
  it("returns leaderboard with default params", async () => {
    mockFindMany.mockResolvedValueOnce([
      { payeeAddress: "0x1", rankerScore: "0.8", rankPosition: 1, txCount30d: 50, uniqueBuyers: 10, totalAmountUsd: "500" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.category).toBe("all");
    expect(body.leaderboard).toHaveLength(1);
    expect(body.leaderboard[0].rank).toBe(1);
    expect(body.leaderboard[0].score).toBe(0.8);
  });

  it("respects category filter", async () => {
    selectResults = [[{ id: "cat-1" }]];
    mockFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeRequest({ category: "api" }));
    const body = await res.json();
    expect(body.category).toBe("api");
  });

  it("clamps limit to 100 max", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await GET(makeRequest({ limit: "200" }));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("falls back to 50 for limit=0 (falsy parseInt)", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await GET(makeRequest({ limit: "0" }));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("handles null scores in response", async () => {
    mockFindMany.mockResolvedValueOnce([
      { payeeAddress: "0x1", rankerScore: null, rankPosition: null, txCount30d: null, uniqueBuyers: null, totalAmountUsd: null },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.leaderboard[0].score).toBe(0);
    expect(body.leaderboard[0].volume_usd_30d).toBeNull();
  });
});
