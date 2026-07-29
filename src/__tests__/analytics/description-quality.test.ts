import { describe, it, expect } from "vitest";
import {
  computeKeywordDensity,
  computeCategoryKeywordPresence,
  computeStructuralSpecificity,
  computeFluffScore,
  computeDescriptionQualityScore,
} from "@/lib/analytics/description-quality";
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

describe("computeKeywordDensity", () => {
  it("returns 0 for empty string", () => {
    expect(computeKeywordDensity("")).toBe(0);
  });

  it("scores fluff text below signal-rich text", () => {
    // Density counts content words (>3 chars, not stop words). Fluff still has
    // multi-syllable words, so its density is nonzero but lower than dense signal.
    const fluff = "Our revolutionary platform seamlessly integrates with your workflow";
    const signal = "Extract markdown text from whitepapers research PDFs technical reports with structured metadata output";
    expect(computeKeywordDensity(fluff)).toBeLessThan(computeKeywordDensity(signal));
  });

  it("returns high density for signal-rich text", () => {
    const signal = "Extract markdown text from whitepapers research PDFs technical reports with structured metadata output";
    expect(computeKeywordDensity(signal)).toBeGreaterThan(0.6);
  });

  it("counts 3-char domain terms as content, not noise", () => {
    // api, eth, nft, sol, dex, dai are content-rich; a description built from
    // them should read as high density, not get filtered out.
    const domain = "api eth nft sol dex dai";
    expect(computeKeywordDensity(domain)).toBe(1);
  });
});

describe("computeCategoryKeywordPresence", () => {
  it("returns 0 when category is null", () => {
    expect(computeCategoryKeywordPresence("crypto blockchain defi", null)).toBe(0);
  });

  it("returns >0 when description contains category tag patterns", () => {
    const cryptoCat = makeCategory("crypto-defi");
    const desc = "Returns on-chain DeFi token data from Base blockchain wallets";
    expect(computeCategoryKeywordPresence(desc, cryptoCat)).toBeGreaterThan(0);
  });

  it("returns ~0 when keywords are absent", () => {
    const cryptoCat = makeCategory("crypto-defi");
    const desc = "Weather forecast API for temperature and climate data";
    expect(computeCategoryKeywordPresence(desc, cryptoCat)).toBeLessThan(0.1);
  });
});

describe("computeStructuralSpecificity", () => {
  it("returns 0 for description with no API terms", () => {
    expect(computeStructuralSpecificity("A great way to find things online")).toBe(0);
  });

  it("returns >=1.0 for a description with 5+ structural terms", () => {
    const desc = "GET endpoint at /api/v1/ returns JSON response with query parameter support";
    expect(computeStructuralSpecificity(desc)).toBeGreaterThanOrEqual(1.0);
  });
});

describe("computeFluffScore", () => {
  it("returns 1.0 for clean API text", () => {
    const clean = "Return wallet balance and holdings for any EVM address across Base, Ethereum, and Polygon";
    const result = computeFluffScore(clean);
    expect(result.fluffScore).toBe(1);
    expect(result.buzzwordHits).toEqual([]);
  });

  it("detects marketing buzzwords and penalizes", () => {
    const fluff = "Our revolutionary seamless platform leverages cutting-edge AI for transformative results";
    const result = computeFluffScore(fluff);
    expect(result.buzzwordHits).toContain("revolutionary");
    expect(result.buzzwordHits).toContain("seamless");
    expect(result.fluffScore).toBeLessThan(0.7);
  });

  it("detects first-person pronouns as marketing voice", () => {
    const marketing = "We provide the best solution for your weather data needs with our powerful API";
    const result = computeFluffScore(marketing);
    expect(result.pronounRatio).toBeGreaterThan(0.05);
    expect(result.fluffScore).toBeLessThan(1.0);
  });

  it("does not penalize a clean, grammatical description for stop words alone", () => {
    // Correct API docs are full grammar and routinely exceed 40% stop words.
    // Without buzzwords or first-person voice, that must NOT reduce the score.
    const clean =
      "Returns the price of a token for the address that was in the request and has been over the limit";
    const result = computeFluffScore(clean);
    expect(result.stopWordRatio).toBeGreaterThan(0.4);
    expect(result.buzzwordHits).toEqual([]);
    expect(result.fluffScore).toBe(1);
  });

  it("applies the stop-word penalty only alongside another fluff signal", () => {
    // Same high stop-word ratio, but now with a buzzword + first-person voice.
    const fluffy =
      "We built a powerful platform that returns the price of a token for any of your given addresses";
    const result = computeFluffScore(fluffy);
    expect(result.fluffScore).toBeLessThan(1);
  });
});

describe("computeDescriptionQualityScore", () => {
  it("returns high score for well-written API description", () => {
    const desc = "Extract clean markdown text, links, and metadata from whitepapers, research PDFs, and technical reports — single-page web scraping and structured summarization for AI agents. Accepts a URL or file path, returns JSON with title, body text, and extracted links.";
    const webCat = makeCategory("web-search");
    const result = computeDescriptionQualityScore(desc, webCat);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.lengthScore).toBe(1);
    expect(result.keywordDensity).toBeGreaterThan(0.4);
    expect(result.structuralSpecificity).toBeGreaterThan(0.5);
    expect(result.fluffScore).toBe(1);
    expect(result.verdict).toContain("Good");
  });

  it("returns low score for fluff-heavy description", () => {
    const fluff = "Our revolutionary platform seamlessly integrates cutting-edge solutions to empower your workflow with next-generation capabilities that transform your business";
    const result = computeDescriptionQualityScore(fluff, null);
    expect(result.score).toBeLessThan(0.4);
    expect(result.buzzwords.length).toBeGreaterThan(3);
    // 4 buzzwords cap the penalty at 0.3, so fluffScore bottoms at 0.5 here.
    expect(result.fluffScore).toBeLessThanOrEqual(0.5);
    expect(result.verdict).toContain("Poor");
  });

  it("returns 0 score for empty description", () => {
    const result = computeDescriptionQualityScore("", null);
    expect(result.score).toBe(0);
    expect(result.verdict).toContain("Missing");
  });

  it("labels a non-empty low-scoring description Poor, not Missing", () => {
    // A tiny, keyword-less string is Poor — only length 0 is "Missing".
    const result = computeDescriptionQualityScore("a b c", null);
    expect(result.length).toBeGreaterThan(0);
    expect(result.verdict).toContain("Poor");
    expect(result.verdict).not.toContain("Missing");
  });
});
