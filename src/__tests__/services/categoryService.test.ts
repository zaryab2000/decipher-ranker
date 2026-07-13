import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMerchant, makeCategory, resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeInsertChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
    query: {
      categories: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
  },
}));

import { getAllCategories, getCategoryBySlug } from "@/lib/services/categoryService";

let selectResults: unknown[][] = [];
let selectIndex = 0;

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectResults = [];
  selectIndex = 0;

  mockSelect.mockImplementation(() => {
    const result = selectIndex < selectResults.length ? selectResults[selectIndex] : [];
    selectIndex++;
    return makeSelectChain(result);
  });

  mockFindMany.mockImplementation((...args: unknown[]) => {
    const result = selectIndex < selectResults.length ? selectResults[selectIndex] : [];
    selectIndex++;
    return Promise.resolve(result);
  });

  mockInsert.mockImplementation(() => makeInsertChain());
  mockExecute.mockResolvedValue(undefined);
});

describe("getAllCategories", () => {
  it("returns all categories sorted by merchant count", async () => {
    const cat = makeCategory({ name: "api", merchantCount: 10 });

    selectResults = [
      [cat],
      [{ payeeAddress: "0xabc", rankerScore: "0.8" }],
      [{ avg: 0.8 }],
    ];

    const result = await getAllCategories();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("api");
    expect(result[0].merchantCount).toBe(10);
  });

  it("returns empty array when no categories exist", async () => {
    selectResults = [];

    const result = await getAllCategories();
    expect(result).toHaveLength(0);
  });

  it("includes top merchant and avg score", async () => {
    const cat = makeCategory({ name: "ai" });
    const merchant = makeMerchant({ rankerScore: "0.85", categoryId: cat.id });

    selectResults = [
      [cat],
      [{ payeeAddress: merchant.payeeAddress, rankerScore: "0.85" }],
      [{ avg: 0.85 }],
    ];

    const result = await getAllCategories();
    expect(result[0].topMerchant).not.toBeNull();
    expect(result[0].topMerchant!.score).toBe(0.85);
  });
});

describe("getCategoryBySlug", () => {
  it("returns category detail for valid slug", async () => {
    const cat = makeCategory({ name: "AI Models" });
    const merchant = makeMerchant({ rankerScore: "0.8", rankPosition: 1, categoryId: cat.id });

    selectResults = [
      [cat],
      [merchant],
      [{ resourceUrl: "https://test.com", serviceName: "Test", priceUsd: "0.01" }],
      [{ total: 100 }],
    ];

    const result = await getCategoryBySlug("ai-models");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("AI Models");
    expect(result!.merchants).toHaveLength(1);
    expect(result!.merchants[0].rankerScore).toBe(0.8);
  });

  it("returns null for invalid slug", async () => {
    selectResults = [[]];

    const result = await getCategoryBySlug("nonexistent");
    expect(result).toBeNull();
  });
});

describe("error paths", () => {
  it("getAllCategories propagates DB errors", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("connection refused"));
    await expect(getAllCategories()).rejects.toThrow("connection refused");
  });
});
