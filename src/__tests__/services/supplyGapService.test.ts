import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeSelectChain, makeInsertChain, makeDeleteChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}));

import { refreshSupplyGap, getSupplyGapForCategory } from "@/lib/services/supplyGapService";

const mockFetch = vi.fn();

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });
  mockInsert.mockImplementation(() => makeInsertChain());
  mockDelete.mockImplementation(() => makeDeleteChain());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshSupplyGap", () => {
  it("returns 0 and probes nothing when no category exceeds the merchant threshold", async () => {
    // First select (categories WHERE merchant_count > 10) returns empty.
    selectResults = [[]];

    const count = await refreshSupplyGap();

    expect(count).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("probes CDP per query, computes the gap, and upserts one row per category", async () => {
    // 1) categories, 2) category merchants (joined resources+merchants).
    selectResults = [
      [{ id: "cat-1", slug: "crypto-defi", name: "Crypto & DeFi", merchantCount: 30 }],
      [
        { resourceUrl: "https://a.com/x", serviceName: "A", rankerScore: "0.9", merchantId: "m-1" },
        { resourceUrl: "https://b.com/y", serviceName: "B", rankerScore: "0.8", merchantId: "m-2" },
        { resourceUrl: "https://c.com/z", serviceName: "C", rankerScore: "0.7", merchantId: "m-3" },
      ],
    ];

    // CDP returns only a.com — b and c are buried. A fresh Response per call
    // (a Response body can only be read once).
    mockFetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ resources: [{ resource: "https://a.com/x" }], searchMethod: "vector" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const count = await refreshSupplyGap();

    expect(count).toBe(1);
    expect(mockFetch).toHaveBeenCalled();
    // Inspect the upserted values.
    const insertCall = mockInsert.mock.results[0]?.value;
    const values = insertCall?.values?.mock?.calls?.[0]?.[0];
    expect(values.categoryName).toBe("Crypto & DeFi");
    expect(values.totalCategoryMerchants).toBe(3);
    // 2 of 3 buried on every query -> gap ratio 0.6667.
    expect(Number(values.averageGapRatio)).toBeCloseTo(0.6667, 3);
    expect(values.buriedMerchantCount).toBe(2);
  });

  it("treats a CDP search failure as everything buried (100% gap)", async () => {
    selectResults = [
      [{ id: "cat-1", slug: "crypto-defi", name: "Crypto & DeFi", merchantCount: 30 }],
      [
        { resourceUrl: "https://a.com/x", serviceName: "A", rankerScore: "0.9", merchantId: "m-1" },
        { resourceUrl: "https://b.com/y", serviceName: "B", rankerScore: "0.8", merchantId: "m-2" },
      ],
    ];
    mockFetch.mockResolvedValue(new Response("err", { status: 500 }));

    const count = await refreshSupplyGap();

    expect(count).toBe(1);
    const values = mockInsert.mock.results[0]?.value?.values?.mock?.calls?.[0]?.[0];
    // No CDP results -> all merchants buried -> gap 1.0.
    expect(Number(values.averageGapRatio)).toBeCloseTo(1.0, 3);
    expect(values.buriedMerchantCount).toBe(2);
  });
});

describe("getSupplyGapForCategory", () => {
  it("returns null when no cache row exists", async () => {
    selectResults = [[]];
    const result = await getSupplyGapForCategory("Crypto & DeFi", ["https://a.com"]);
    expect(result).toBeNull();
  });

  it("flags the merchant as buried when its URL appears in a buried sample", async () => {
    selectResults = [
      [
        {
          categoryName: "Crypto & DeFi",
          perQuery: [
            {
              query: "crypto",
              cdpResults: 5,
              cdpResourceUrls: [],
              categoryMerchantCount: 30,
              buriedCount: 25,
              gapRatio: 0.83,
              buriedSample: [
                { resourceUrl: "https://mine.com/api", serviceName: "Mine", rankerScore: 0.9 },
              ],
            },
          ],
          averageGapRatio: "0.8300",
          buriedMerchantCount: 25,
          totalCategoryMerchants: 30,
          refreshedAt: new Date("2026-07-26T00:00:00Z"),
        },
      ],
    ];

    const result = await getSupplyGapForCategory("Crypto & DeFi", [
      "https://mine.com/api/",
    ]);

    expect(result).not.toBeNull();
    expect(result?.merchantIsBuried).toBe(true);
    expect(result?.totalBuriedMerchants).toBe(25);
  });

  it("does not flag a merchant absent from every buried sample", async () => {
    selectResults = [
      [
        {
          categoryName: "Crypto & DeFi",
          perQuery: [
            {
              query: "crypto",
              cdpResults: 5,
              cdpResourceUrls: [],
              categoryMerchantCount: 30,
              buriedCount: 25,
              gapRatio: 0.83,
              buriedSample: [
                { resourceUrl: "https://other.com/api", serviceName: "Other", rankerScore: 0.9 },
              ],
            },
          ],
          averageGapRatio: "0.8300",
          buriedMerchantCount: 25,
          totalCategoryMerchants: 30,
          refreshedAt: new Date("2026-07-26T00:00:00Z"),
        },
      ],
    ];

    const result = await getSupplyGapForCategory("Crypto & DeFi", [
      "https://mine.com/api",
    ]);

    expect(result?.merchantIsBuried).toBe(false);
  });
});
