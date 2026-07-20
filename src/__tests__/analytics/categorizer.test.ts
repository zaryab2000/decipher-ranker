import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetIdCounter } from "../fixtures/factories";
import { makeSelectChain, makeUpdateChain, makeDeleteChain } from "../fixtures/mock-chains";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockExecute = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
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
    return makeSelectChain(result);
  });

  mockUpdate.mockImplementation(() => makeUpdateChain());
  mockExecute.mockResolvedValue(undefined);
  mockDelete.mockImplementation(() => makeDeleteChain());
});

function setSelectResults(...results: unknown[][]) {
  selectResults = results;
}

describe("assignCategory (pure, taxonomy-based)", () => {
  it("maps ai tags to ai-agents", () => {
    expect(assignCategory(["ai"])).toBe("ai-agents");
    expect(assignCategory(["inference"])).toBe("ai-agents");
  });

  it("resolves ties by taxonomy order (crypto before ai)", () => {
    expect(assignCategory(["defi", "ai"])).toBe("crypto-defi");
    expect(assignCategory(["ai", "defi"])).toBe("crypto-defi");
  });

  it("matches across casing and spacing via token normalization", () => {
    expect(assignCategory(["real-estate"])).toBe("real-world-data");
    expect(assignCategory(["real estate"])).toBe("real-world-data");
    expect(assignCategory(["Web Content"])).toBe("web-search");
  });

  it("maps novelty tags to fun-games", () => {
    expect(assignCategory(["dice"])).toBe("fun-games");
    expect(assignCategory(["jokes"])).toBe("fun-games");
  });

  it("falls back to other for unmatched tags", () => {
    expect(assignCategory(["totallyunknowntag"])).toBe("other");
  });

  it("falls back to other for empty and nullish tags", () => {
    expect(assignCategory([])).toBe("other");
    expect(assignCategory(null as unknown as string[])).toBe("other");
  });

  it("does not match a pattern token inside an unrelated word (no naive substring)", () => {
    // "chain" must not match the "ai" pattern (it has no "ai" token).
    expect(assignCategory(["chain"])).toBe("other");
  });
});

describe("assignAllMerchantCategories (DB-dependent)", () => {
  // Select order: (1) categories {id,slug}, (2) merchants {id}, (3) resources {merchantId,tags}.
  const taxonomyRows = [
    { id: "cat-ai", slug: "ai-agents" },
    { id: "cat-crypto", slug: "crypto-defi" },
    { id: "cat-other", slug: "other" },
  ];

  it("assigns every merchant a category (matched or other)", async () => {
    setSelectResults(
      taxonomyRows,
      [{ id: "m-1" }, { id: "m-2" }],
      [
        { merchantId: "m-1", tags: ["ai"] },
        { merchantId: "m-2", tags: ["nonsense"] },
      ],
    );

    const result = await assignAllMerchantCategories();
    expect(result).toBe(2); // both assigned — m-2 lands in other
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("assigns merchants with no resources to other", async () => {
    setSelectResults(taxonomyRows, [{ id: "m-1" }], []);
    const result = await assignAllMerchantCategories();
    expect(result).toBe(1);
  });

  it("assigns merchants with null tags to other", async () => {
    setSelectResults(
      taxonomyRows,
      [{ id: "m-1" }],
      [{ merchantId: "m-1", tags: null }],
    );
    const result = await assignAllMerchantCategories();
    expect(result).toBe(1);
  });

  it("aggregates tags across multiple resources per merchant", async () => {
    setSelectResults(
      taxonomyRows,
      [{ id: "m-1" }],
      [
        { merchantId: "m-1", tags: ["unmatched"] },
        { merchantId: "m-1", tags: ["ai"] },
      ],
    );
    const result = await assignAllMerchantCategories();
    expect(result).toBe(1);
  });

  it("throws when the assigned taxonomy slug is not seeded", async () => {
    // Missing the "other" row — an unmatched merchant cannot resolve.
    setSelectResults(
      [{ id: "cat-ai", slug: "ai-agents" }],
      [{ id: "m-1" }],
      [{ merchantId: "m-1", tags: ["nonsense"] }],
    );
    await expect(assignAllMerchantCategories()).rejects.toThrow(/not in the categories table/);
  });

  it("runs SQL updates for merchant_count and median_price", async () => {
    setSelectResults(taxonomyRows, [], []);
    await assignAllMerchantCategories();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("reconciles by deleting non-taxonomy category rows after re-pointing merchants", async () => {
    setSelectResults(taxonomyRows, [{ id: "m-1" }], [{ merchantId: "m-1", tags: ["ai"] }]);
    await assignAllMerchantCategories();
    expect(mockDelete).toHaveBeenCalled();
  });
});
