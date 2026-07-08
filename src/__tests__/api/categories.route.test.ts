import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: new Proxy({}, {
      get() {
        return {
          findMany: (...args: unknown[]) => mockFindMany(...args),
        };
      },
    }),
  },
}));

import { GET } from "@/app/api/categories/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("GET /api/categories", () => {
  it("returns categories sorted by merchantCount", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: "c1", name: "api", merchantCount: 10, medianPrice: "0.05", createdAt: new Date(), color: null, description: null },
        { id: "c2", name: "ml", merchantCount: 5, medianPrice: null, createdAt: new Date(), color: null, description: null },
      ])
      .mockResolvedValueOnce([
        { payeeAddress: "0x1", rankerScore: "0.8", txCount30d: 50 },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0].name).toBe("api");
    expect(body.categories[0].merchant_count).toBe(10);
    expect(body.categories[0].median_price_usd).toBe(0.05);
    expect(body.categories[1].median_price_usd).toBeNull();
  });

  it("returns empty when no categories", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const res = await GET();
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.categories).toEqual([]);
  });

  it("includes top merchants per category", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: "c1", name: "api", merchantCount: 5, medianPrice: null, createdAt: new Date(), color: null, description: null },
      ])
      .mockResolvedValueOnce([
        { payeeAddress: "0xTop", rankerScore: "0.9", txCount30d: 100 },
        { payeeAddress: "0xSecond", rankerScore: "0.7", txCount30d: 50 },
      ]);

    const res = await GET();
    const body = await res.json();
    expect(body.categories[0].top_merchants).toHaveLength(2);
    expect(body.categories[0].top_merchants[0].address).toBe("0xTop");
    expect(body.categories[0].top_merchants[0].score).toBe(0.9);
  });
});
