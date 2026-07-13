import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeSelectChain } from "../fixtures/mock-chains";
import { installRouterMock } from "../fixtures/mock-router";

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

installRouterMock();

import { GET } from "@/app/api/categories/route";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;
  mockSelect.mockImplementation(() => {
    const result =
      selectIndex < selectResults.length ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/categories");
}

describe("GET /api/categories", () => {
  it("returns categories sorted by merchantCount", async () => {
    // 1st select: categories. 2nd select: ranked merchants (windowed).
    selectResults = [
      [
        { id: "c1", name: "api", merchantCount: 10, medianPrice: "0.05", createdAt: new Date(), color: null, description: null },
        { id: "c2", name: "ml", merchantCount: 5, medianPrice: null, createdAt: new Date(), color: null, description: null },
      ],
      [
        { categoryId: "c1", payeeAddress: "0x1", rankerScore: "0.8", txCount30d: 50, rn: 1 },
      ],
    ];

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0].name).toBe("api");
    expect(body.categories[0].merchant_count).toBe(10);
    expect(body.categories[0].median_price_usd).toBe(0.05);
    expect(body.categories[1].median_price_usd).toBeNull();
  });

  it("returns empty when no categories", async () => {
    selectResults = [[], []];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.categories).toEqual([]);
  });

  it("includes top merchants per category, capped at 3", async () => {
    selectResults = [
      [
        { id: "c1", name: "api", merchantCount: 5, medianPrice: null, createdAt: new Date(), color: null, description: null },
      ],
      [
        { categoryId: "c1", payeeAddress: "0xTop", rankerScore: "0.9", txCount30d: 100, rn: 1 },
        { categoryId: "c1", payeeAddress: "0xSecond", rankerScore: "0.7", txCount30d: 50, rn: 2 },
        { categoryId: "c1", payeeAddress: "0xThird", rankerScore: "0.6", txCount30d: 20, rn: 3 },
        { categoryId: "c1", payeeAddress: "0xFourth", rankerScore: "0.5", txCount30d: 10, rn: 4 },
      ],
    ];

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.categories[0].top_merchants).toHaveLength(3);
    expect(body.categories[0].top_merchants[0].address).toBe("0xTop");
    expect(body.categories[0].top_merchants[0].score).toBe(0.9);
  });
});
