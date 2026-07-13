import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeSelectChain } from "../fixtures/mock-chains";
import { installRouterMock } from "../fixtures/mock-router";

const mockSelect = vi.fn();
const mockFindMany = vi.fn();

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

installRouterMock();

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

  it("uses default limit of 50 when omitted", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await GET(makeRequest());
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("respects category filter", async () => {
    selectResults = [[{ id: "cat-1" }]];
    mockFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeRequest({ category: "api" }));
    const body = await res.json();
    expect(body.category).toBe("api");
  });

  it("rejects limit above 100 with 400", async () => {
    const res = await GET(makeRequest({ limit: "200" }));
    expect(res.status).toBe(400);
  });

  it("rejects limit below 1 with 400", async () => {
    const res = await GET(makeRequest({ limit: "0" }));
    expect(res.status).toBe(400);
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
