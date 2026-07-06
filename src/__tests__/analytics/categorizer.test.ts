import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetIdCounter, makeCategory } from "../fixtures/factories";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockExecute = vi.fn();

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfill);
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

import { assignCategory, assignAllMerchantCategories } from "@/lib/analytics/categorizer";

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectResults = [];

  mockSelect.mockImplementation(() => {
    const result = selectCallIndex < selectResults.length
      ? selectResults[selectCallIndex]
      : [];
    selectCallIndex++;
    return makeChain(result);
  });

  mockUpdate.mockImplementation(() => makeChain(undefined));
  mockExecute.mockResolvedValue(undefined);
});

function setSelectResults(...results: unknown[][]) {
  selectResults = results;
}

describe("assignCategory (pure)", () => {
  const categories = [
    makeCategory({ id: "cat-1", name: "api" }),
    makeCategory({ id: "cat-2", name: "ml" }),
    makeCategory({ id: "cat-3", name: "data" }),
  ];

  it("returns null for empty tags", () => {
    expect(assignCategory([], categories)).toBeNull();
  });

  it("returns null for null tags", () => {
    expect(assignCategory(null as unknown as string[], categories)).toBeNull();
  });

  it("returns category id when tag matches", () => {
    expect(assignCategory(["api"], categories)).toBe("cat-1");
  });

  it("matches case-insensitively", () => {
    expect(assignCategory(["API"], categories)).toBe("cat-1");
    expect(assignCategory(["Ml"], categories)).toBe("cat-2");
  });

  it("returns first match when multiple tags match", () => {
    expect(assignCategory(["ml", "api"], categories)).toBe("cat-2");
  });

  it("returns null when no tags match", () => {
    expect(assignCategory(["blockchain", "defi"], categories)).toBeNull();
  });
});

describe("assignAllMerchantCategories (DB-dependent)", () => {
  it("assigns categories based on resource tags", async () => {
    const cat = makeCategory({ id: "cat-1", name: "api" });
    setSelectResults(
      [cat],
      [{ id: "m-1" }],
      [{ merchantId: "m-1", tags: ["api"] }],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(1);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 0 when no merchants match any category", async () => {
    const cat = makeCategory({ id: "cat-1", name: "api" });
    setSelectResults(
      [cat],
      [{ id: "m-1" }],
      [{ merchantId: "m-1", tags: ["blockchain"] }],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(0);
  });

  it("handles merchants with no resources", async () => {
    const cat = makeCategory({ id: "cat-1", name: "api" });
    setSelectResults([cat], [{ id: "m-1" }], []);

    const result = await assignAllMerchantCategories();
    expect(result).toBe(0);
  });

  it("handles resources with null tags", async () => {
    setSelectResults(
      [makeCategory({ id: "cat-1", name: "api" })],
      [{ id: "m-1" }],
      [{ merchantId: "m-1", tags: null }],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(0);
  });

  it("processes multiple merchants", async () => {
    setSelectResults(
      [makeCategory({ id: "cat-1", name: "api" })],
      [{ id: "m-1" }, { id: "m-2" }],
      [
        { merchantId: "m-1", tags: ["api"] },
        { merchantId: "m-2", tags: ["api"] },
      ],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(2);
  });

  it("aggregates tags across multiple resources per merchant", async () => {
    setSelectResults(
      [makeCategory({ id: "cat-1", name: "ml" })],
      [{ id: "m-1" }],
      [
        { merchantId: "m-1", tags: ["api"] },
        { merchantId: "m-1", tags: ["ml"] },
      ],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(1);
  });

  it("runs SQL updates for merchant_count and median_price", async () => {
    setSelectResults([], [], []);
    await assignAllMerchantCategories();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
