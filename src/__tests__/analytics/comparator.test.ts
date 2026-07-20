import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

import { computeGapAnalysis } from "@/lib/analytics/comparator";
import { makeMerchantData, resetIdCounter } from "../fixtures/factories";

beforeEach(() => resetIdCounter());

describe("computeGapAnalysis", () => {
  it("returns empty arrays when no competitors", () => {
    const merchant = makeMerchantData();
    const result = computeGapAnalysis(merchant, []);
    expect(result.missingTags).toEqual([]);
    expect(result.missingKeywords).toEqual([]);
    expect(result.competitorCount).toBe(0);
  });

  it("finds tags competitors have that merchant does not", () => {
    const merchant = makeMerchantData({
      resources: [{ tags: ["api"] }],
    });
    const competitor = makeMerchantData({
      resources: [{ tags: ["api", "ml", "data"] }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingTags).toContain("ml");
    expect(result.missingTags).toContain("data");
    expect(result.missingTags).not.toContain("api");
  });

  it("performs case-insensitive tag matching", () => {
    const merchant = makeMerchantData({
      resources: [{ tags: ["API"] }],
    });
    const competitor = makeMerchantData({
      resources: [{ tags: ["api", "ML"] }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingTags).not.toContain("api");
    expect(result.missingTags).toContain("ml");
  });

  it("deduplicates tags across competitors", () => {
    const merchant = makeMerchantData({
      resources: [{ tags: [] }],
    });
    const comp1 = makeMerchantData({ resources: [{ tags: ["ml"] }] });
    const comp2 = makeMerchantData({ resources: [{ tags: ["ml"] }] });
    const result = computeGapAnalysis(merchant, [comp1, comp2]);
    expect(result.missingTags.filter((t) => t === "ml")).toHaveLength(1);
  });

  it("caps missing tags at 10", () => {
    const merchant = makeMerchantData({ resources: [{ tags: [] }] });
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const competitor = makeMerchantData({ resources: [{ tags }] });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingTags.length).toBeLessThanOrEqual(10);
  });

  it("finds keywords in competitor descriptions not in merchant descriptions", () => {
    const merchant = makeMerchantData({
      resources: [{ description: "Simple payment processing service" }],
    });
    const competitor = makeMerchantData({
      resources: [{ description: "Advanced machine learning inference endpoint" }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).toContain("machine");
    expect(result.missingKeywords).toContain("learning");
    expect(result.missingKeywords).toContain("inference");
    expect(result.missingKeywords).toContain("endpoint");
    expect(result.missingKeywords).toContain("advanced");
  });

  it("filters out stop words from keywords", () => {
    const merchant = makeMerchantData({
      resources: [{ description: "" }],
    });
    const competitor = makeMerchantData({
      resources: [{ description: "the quick brown fox and also more very" }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).not.toContain("the");
    expect(result.missingKeywords).not.toContain("and");
    expect(result.missingKeywords).not.toContain("also");
    expect(result.missingKeywords).not.toContain("more");
    expect(result.missingKeywords).not.toContain("very");
  });

  it("filters out short words (<=3 chars)", () => {
    const merchant = makeMerchantData({ resources: [{ description: "" }] });
    const competitor = makeMerchantData({
      resources: [{ description: "api for the ml model run now" }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).not.toContain("api");
    expect(result.missingKeywords).not.toContain("for");
    expect(result.missingKeywords).not.toContain("run");
    expect(result.missingKeywords).not.toContain("now");
    expect(result.missingKeywords).toContain("model");
  });

  it("strips non-alpha characters from keywords", () => {
    const merchant = makeMerchantData({ resources: [{ description: "" }] });
    const competitor = makeMerchantData({
      resources: [{ description: "advanced! machine-learning, inference." }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).toContain("advanced");
    expect(result.missingKeywords).toContain("inference");
  });

  it("caps missing keywords at 10", () => {
    const merchant = makeMerchantData({ resources: [{ description: "" }] });
    const words = Array.from({ length: 15 }, (_, i) => `keyword${i}`);
    const competitor = makeMerchantData({
      resources: [{ description: words.join(" ") }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords.length).toBeLessThanOrEqual(10);
  });

  it("returns correct competitor count", () => {
    const merchant = makeMerchantData();
    const comps = [makeMerchantData(), makeMerchantData(), makeMerchantData()];
    const result = computeGapAnalysis(merchant, comps);
    expect(result.competitorCount).toBe(3);
  });

  it("handles null tags gracefully", () => {
    const merchant = makeMerchantData({
      resources: [{ tags: null as unknown as string[] }],
    });
    const competitor = makeMerchantData({
      resources: [{ tags: null as unknown as string[] }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingTags).toEqual([]);
  });

  it("handles null descriptions gracefully", () => {
    const merchant = makeMerchantData({
      resources: [{ description: null }],
    });
    const competitor = makeMerchantData({
      resources: [{ description: null }],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).toEqual([]);
  });

  it("aggregates tags across multiple competitor resources", () => {
    const merchant = makeMerchantData({ resources: [{ tags: [] }] });
    const competitor = makeMerchantData({
      resources: [
        { tags: ["alpha"] },
        { tags: ["beta"] },
      ],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingTags).toContain("alpha");
    expect(result.missingTags).toContain("beta");
  });

  it("aggregates keywords across multiple competitor resources", () => {
    const merchant = makeMerchantData({ resources: [{ description: "" }] });
    const competitor = makeMerchantData({
      resources: [
        { description: "payment processing" },
        { description: "invoice generation" },
      ],
    });
    const result = computeGapAnalysis(merchant, [competitor]);
    expect(result.missingKeywords).toContain("payment");
    expect(result.missingKeywords).toContain("processing");
    expect(result.missingKeywords).toContain("invoice");
    expect(result.missingKeywords).toContain("generation");
  });
});
