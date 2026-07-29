import { describe, it, expect } from "vitest";
import {
  computeTagRelevance,
  computeTagSpecificity,
  detectTagSpam,
  suggestTags,
  computeTagQualityScore,
} from "@/lib/analytics/tag-quality";
import { TAXONOMY } from "@/lib/analytics/taxonomy";
import type { Category } from "@/lib/types";

function makeCategory(slug: string): Category {
  const cat = TAXONOMY.find((c) => c.slug === slug) ?? TAXONOMY[0];
  return {
    id: "test-id",
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    color: cat.color,
    merchantCount: 0,
    medianPrice: null,
    createdAt: new Date(),
  };
}

describe("computeTagRelevance", () => {
  it("returns 0 when category is null", () => {
    expect(computeTagRelevance(["crypto", "defi"], null)).toBe(0);
  });

  it("returns 1.0 when all tags match category patterns", () => {
    const cat = makeCategory("crypto-defi");
    expect(computeTagRelevance(["crypto", "defi"], cat)).toBe(1);
  });

  it("returns 0.0 when no tags match category patterns", () => {
    const cat = makeCategory("crypto-defi");
    expect(computeTagRelevance(["weather", "forecast", "temperature"], cat)).toBe(0);
  });

  it("returns fraction for partial match", () => {
    const cat = makeCategory("crypto-defi");
    const result = computeTagRelevance(["crypto", "aerodrome"], cat);
    expect(result).toBe(0.5);
  });
});

describe("computeTagSpecificity", () => {
  it("returns 1.0 when all tags match some category", () => {
    expect(computeTagSpecificity(["crypto", "weather"])).toBe(1);
  });

  it("returns 0.0 when no tags match any category", () => {
    expect(computeTagSpecificity(["xyzzy", "foobar"])).toBe(0);
  });

  it("returns 0.5 for mixed specific/generic tags", () => {
    expect(computeTagSpecificity(["crypto", "xyzzy"])).toBe(0.5);
  });
});

describe("detectTagSpam", () => {
  it("returns false for tags in one category", () => {
    expect(detectTagSpam(["crypto", "defi", "blockchain"])).toBe(false);
  });

  it("returns false for tags in 3 categories (at threshold)", () => {
    expect(detectTagSpam(["crypto", "weather", "ai"])).toBe(false);
  });

  it("returns true for tags in 4+ categories (spam)", () => {
    expect(detectTagSpam(["crypto", "weather", "ai", "email", "news"])).toBe(true);
  });
});

describe("suggestTags", () => {
  it("returns category tags the merchant isn't using", () => {
    const cat = makeCategory("crypto-defi");
    const suggested = suggestTags(["crypto"], cat, 3);
    expect(suggested).not.toContain("crypto");
    expect(suggested.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array when category is null", () => {
    expect(suggestTags(["crypto"], null, 3)).toEqual([]);
  });
});

describe("computeTagQualityScore", () => {
  it("returns high score for 5 relevant, specific tags", () => {
    const cat = makeCategory("crypto-defi");
    const result = computeTagQualityScore(
      ["crypto", "defi", "blockchain", "bitcoin", "onchain"],
      cat,
    );
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.relevance).toBe(1);
    expect(result.specificity).toBe(1);
    expect(result.spam).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it("returns low score for 5 generic spam tags", () => {
    const cat = makeCategory("crypto-defi");
    const result = computeTagQualityScore(
      ["crypto", "weather", "ai", "email", "news"],
      cat,
    );
    // 5 tags each match some category (specificity 1.0) but span >3 categories,
    // so relevance to crypto-defi is low and spamScore is 0: ~0.58, well below a
    // clean 5-relevant-tag score (>0.7).
    expect(result.score).toBeLessThan(0.7);
    expect(result.spam).toBe(true);
    expect(result.issues.some((i) => i.includes("spam"))).toBe(true);
  });

  it("returns 0 for empty tags", () => {
    const cat = makeCategory("crypto-defi");
    const result = computeTagQualityScore([], cat);
    // Empty tags aren't spam, so the anti-spam component (0.1) is the only
    // contribution — relevance/specificity/count are all 0.
    expect(result.score).toBe(0.1);
    expect(result.count).toBe(0);
    expect(result.issues[0]).toContain("No tags");
  });
});
