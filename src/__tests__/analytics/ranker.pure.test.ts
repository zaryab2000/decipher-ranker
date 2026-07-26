import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getDb: () => ({}),
}));

import {
  computeRankerScore,
  computeScoreBreakdown,
  RANKER_WEIGHTS,
} from "@/lib/analytics/ranker";
import { makeMerchantData, resetIdCounter } from "../fixtures/factories";

beforeEach(() => resetIdCounter());

describe("computeRankerScore", () => {
  describe("volume signal (weight 0.30)", () => {
    it("returns 0 volume signal when txCount30d and volume30d are 0", () => {
      const data = makeMerchantData({
        merchant: { txCount30d: 0, volume30d: "0" },
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.volumeSignal).toBe(0);
    });

    it("increases with higher txCount30d", () => {
      const low = makeMerchantData({ merchant: { txCount30d: 5, volume30d: "0" } });
      const high = makeMerchantData({ merchant: { txCount30d: 500, volume30d: "0" } });
      const bLow = computeScoreBreakdown(low);
      const bHigh = computeScoreBreakdown(high);
      expect(bHigh.volumeSignal).toBeGreaterThan(bLow.volumeSignal);
    });

    it("increases with higher volume30d", () => {
      const low = makeMerchantData({ merchant: { txCount30d: 0, volume30d: "10" } });
      const high = makeMerchantData({ merchant: { txCount30d: 0, volume30d: "10000" } });
      const bLow = computeScoreBreakdown(low);
      const bHigh = computeScoreBreakdown(high);
      expect(bHigh.volumeSignal).toBeGreaterThan(bLow.volumeSignal);
    });

    it("caps at 1.0 for values at or above the cap", () => {
      const data = makeMerchantData({
        merchant: { txCount30d: 2_000_000, volume30d: "2000000" },
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.volumeSignal).toBeLessThanOrEqual(1.0);
    });

    it("combines txCount and volume equally (50/50)", () => {
      const txOnly = makeMerchantData({ merchant: { txCount30d: 100, volume30d: "0" } });
      const volOnly = makeMerchantData({ merchant: { txCount30d: 0, volume30d: "100" } });
      const both = makeMerchantData({ merchant: { txCount30d: 100, volume30d: "100" } });
      const bTx = computeScoreBreakdown(txOnly);
      const bVol = computeScoreBreakdown(volOnly);
      const bBoth = computeScoreBreakdown(both);
      expect(bBoth.volumeSignal).toBeCloseTo(bTx.volumeSignal + bVol.volumeSignal, 4);
    });
  });

  describe("buyer diversity (weight 0.25)", () => {
    it("returns 0 when buyers30d is 0", () => {
      const data = makeMerchantData({ merchant: { buyers30d: 0 } });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.buyerDiversity).toBe(0);
    });

    it("increases with more buyers", () => {
      const low = makeMerchantData({ merchant: { buyers30d: 2 } });
      const high = makeMerchantData({ merchant: { buyers30d: 200 } });
      expect(computeScoreBreakdown(high).buyerDiversity).toBeGreaterThan(
        computeScoreBreakdown(low).buyerDiversity,
      );
    });

    it("approaches 1.0 for very high buyer counts", () => {
      const data = makeMerchantData({ merchant: { buyers30d: 50000 } });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.buyerDiversity).toBeGreaterThan(0.9);
      expect(breakdown.buyerDiversity).toBeLessThanOrEqual(1.0);
    });

    it("uses logNorm with cap=10000", () => {
      const data = makeMerchantData({ merchant: { buyers30d: 10000 } });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.buyerDiversity).toBeCloseTo(1.0, 1);
    });
  });

  describe("reliability (weight 0.15)", () => {
    it("defaults to 0.5 when no resources", () => {
      const data = makeMerchantData({ resources: [] });
      data.resources = [];
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBe(0.5);
    });

    it("defaults to 0.5 when resources have no scores", () => {
      const data = makeMerchantData({
        resources: [
          { reliabilityScore: null, apiSuccessRate: null },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBe(0.5);
    });

    it("uses reliabilityScore when available", () => {
      const data = makeMerchantData({
        resources: [{ reliabilityScore: "0.95", apiSuccessRate: "0.5" }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBe(0.95);
    });

    it("falls back to apiSuccessRate when reliabilityScore is null", () => {
      const data = makeMerchantData({
        resources: [{ reliabilityScore: null, apiSuccessRate: "0.88" }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBe(0.88);
    });

    it("averages across multiple resources", () => {
      const data = makeMerchantData({
        resources: [
          { reliabilityScore: "0.90" },
          { reliabilityScore: "0.80" },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBeCloseTo(0.85, 10);
    });

    it("filters out zero scores", () => {
      const data = makeMerchantData({
        resources: [
          { reliabilityScore: "0.90", apiSuccessRate: null },
          { reliabilityScore: null, apiSuccessRate: null },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.reliability).toBe(0.90);
    });
  });

  describe("listing quality (weight 0.15, structural signals, max divisor 3.6)", () => {
    // Bare resource: no schemas, no serviceName, no tags, empty description.
    const bare = {
      hasInputSchema: false,
      hasOutputExample: false,
      serviceName: null,
      description: "",
      tags: [],
    };

    // A realistic, keyword-dense, structurally-specific API description. Used in
    // place of "A".repeat(N) so the quality-aware description scoring produces a
    // meaningful (near-max) contribution.
    const REALISTIC_DESC =
      "Extract clean markdown text, links, and metadata from whitepapers, research PDFs, and technical reports — single-page web scraping and structured summarization. Accepts a URL, returns JSON with title, body, and links.";

    it("returns 0 for no resources", () => {
      const data = makeMerchantData({ resources: [] });
      data.resources = [];
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBe(0);
    });

    it("gives 0 for a fully-bare resource", () => {
      const data = makeMerchantData({ resources: [{ ...bare }] });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBe(0);
    });

    it("scores input schema at 1.0/3.6", () => {
      const data = makeMerchantData({
        resources: [{ ...bare, hasInputSchema: true }],
      });
      expect(computeScoreBreakdown(data).listingQuality).toBeCloseTo(1.0 / 3.6, 4);
    });

    it("scores output example at 1.0/3.6", () => {
      const data = makeMerchantData({
        resources: [{ ...bare, hasOutputExample: true }],
      });
      expect(computeScoreBreakdown(data).listingQuality).toBeCloseTo(1.0 / 3.6, 4);
    });

    it("scores description by quality, not raw length", () => {
      // A dense, keyword-rich 150+ char description contributes near the 0.8 max
      // (gated by its quality score ~0.78 → 0.8*0.78/3.6). A shorter slice of the
      // same text contributes less; a tiny fluff string contributes little.
      const long = makeMerchantData({
        resources: [{ ...bare, description: REALISTIC_DESC }],
      });
      const medium = makeMerchantData({
        resources: [{ ...bare, description: REALISTIC_DESC.slice(0, 80) }],
      });
      const short = makeMerchantData({
        resources: [{ ...bare, description: "short" }],
      });
      const longLq = computeScoreBreakdown(long).listingQuality;
      const mediumLq = computeScoreBreakdown(medium).listingQuality;
      const shortLq = computeScoreBreakdown(short).listingQuality;
      // A full, keyword-dense description contributes ~0.8*quality; a truncated
      // or tiny one contributes strictly less.
      expect(longLq).toBeCloseTo((0.8 * 0.82) / 3.6, 3);
      expect(longLq).toBeGreaterThan(mediumLq);
      expect(longLq).toBeGreaterThan(shortLq);
    });

    it("scores service name at 0.5/3.6", () => {
      const data = makeMerchantData({
        resources: [{ ...bare, serviceName: "My API" }],
      });
      expect(computeScoreBreakdown(data).listingQuality).toBeCloseTo(0.5 / 3.6, 4);
    });

    it("rewards 3-5 category-relevant tags over spam (>5) or a lone tag", () => {
      // crypto-defi category so tag relevance/specificity are meaningful.
      const cat = { slug: "crypto-defi" as const };
      const four = makeMerchantData({
        category: cat,
        resources: [{ ...bare, tags: ["crypto", "defi", "bitcoin", "onchain"] }],
      });
      const many = makeMerchantData({
        category: cat,
        resources: [{ ...bare, tags: ["crypto", "defi", "bitcoin", "onchain", "solana", "dex", "wallet"] }],
      });
      const one = makeMerchantData({
        category: cat,
        resources: [{ ...bare, tags: ["crypto"] }],
      });
      const fourLq = computeScoreBreakdown(four).listingQuality;
      const manyLq = computeScoreBreakdown(many).listingQuality;
      const oneLq = computeScoreBreakdown(one).listingQuality;
      // 3-5 relevant tags hit the full count-score bonus; >5 and lone drop it.
      expect(fourLq).toBeGreaterThan(manyLq);
      expect(fourLq).toBeGreaterThan(oneLq);
    });

    it("caps a fully-maxed resource (quality desc + relevant tags) near 1.0", () => {
      // Quality gating means the max is only reached with a keyword-rich, fluff-
      // free description AND category-relevant tags. Structural signals here are
      // exact (schemas, service name); desc + tags approach but rarely hit 1.0.
      const data = makeMerchantData({
        category: { slug: "crypto-defi" },
        resources: [
          {
            hasInputSchema: true,
            hasOutputExample: true,
            description:
              "Returns on-chain DeFi token balances and wallet holdings from Base blockchain. GET /api/v1/ endpoint accepts an address query parameter, returns JSON response with token, crypto price, and holdings.",
            serviceName: "My API",
            tags: ["crypto", "defi", "onchain", "wallet"],
          },
        ],
      });
      const lq = computeScoreBreakdown(data).listingQuality;
      // Structural 2.0/3.6 alone is 0.556; a strong desc+tags push it high.
      expect(lq).toBeGreaterThan(0.85);
      expect(lq).toBeLessThanOrEqual(1.0);
    });

    it("rewards documentation effort over verbosity", () => {
      // Schemas + short description beats a long description with nothing else.
      const documented = makeMerchantData({
        resources: [
          { ...bare, hasInputSchema: true, hasOutputExample: true, description: "short" },
        ],
      });
      const verbose = makeMerchantData({
        resources: [{ ...bare, description: "A".repeat(500) }],
      });
      expect(computeScoreBreakdown(documented).listingQuality).toBeGreaterThan(
        computeScoreBreakdown(verbose).listingQuality,
      );
    });

    it("averages across multiple resources", () => {
      const good = { hasInputSchema: true, hasOutputExample: true, description: REALISTIC_DESC, serviceName: "X", tags: ["a", "b", "c"] };
      const data = makeMerchantData({ resources: [{ ...good }, { ...bare }] });
      const singleGood = computeScoreBreakdown(
        makeMerchantData({ resources: [{ ...good }] }),
      ).listingQuality;
      const singleBad = computeScoreBreakdown(
        makeMerchantData({ resources: [{ ...bare }] }),
      ).listingQuality;
      expect(computeScoreBreakdown(data).listingQuality).toBeCloseTo(
        (singleGood + singleBad) / 2,
        4,
      );
    });
  });

  describe("recency (weight 0.15)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("returns 0 when no timestamps", () => {
      vi.setSystemTime(new Date("2024-06-15"));
      const data = makeMerchantData({
        resources: [{ lastCalledAt: null, lastUpdated: new Date("2024-01-01") }],
      });
      data.resources[0].lastCalledAt = null;
      data.resources[0].lastUpdated = null as unknown as Date;
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0);
    });

    it("returns 1.0 for activity less than 1 day ago", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);
      const data = makeMerchantData({
        resources: [{ lastCalledAt: new Date("2024-06-15T06:00:00Z") }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(1.0);
    });

    it("returns 0.8 for activity 1-7 days ago", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [{ lastCalledAt: new Date("2024-06-12T12:00:00Z") }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0.8);
    });

    it("returns 0.5 for activity 7-30 days ago", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [{ lastCalledAt: new Date("2024-06-01T12:00:00Z") }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0.5);
    });

    it("returns 0.2 for activity 30-90 days ago", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [{ lastCalledAt: new Date("2024-04-15T12:00:00Z"), lastUpdated: new Date("2024-01-01T00:00:00Z") }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0.2);
    });

    it("returns 0 for activity >90 days ago", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [{ lastCalledAt: new Date("2024-01-01T12:00:00Z"), lastUpdated: new Date("2024-01-01T00:00:00Z") }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0);
    });

    it("picks the most recent timestamp across resources", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [
          { lastCalledAt: new Date("2024-01-01T12:00:00Z") },
          { lastCalledAt: new Date("2024-06-15T06:00:00Z") },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(1.0);
    });

    it("uses lastUpdated when lastCalledAt is null", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        resources: [
          { lastCalledAt: null, lastUpdated: new Date("2024-06-14T12:00:00Z") },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.recency).toBe(0.8);
    });
  });

  describe("weighted sum", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("weights sum to exactly 1.0", () => {
      const sum =
        RANKER_WEIGHTS.volume +
        RANKER_WEIGHTS.buyerDiversity +
        RANKER_WEIGHTS.reliability +
        RANKER_WEIGHTS.listingQuality +
        RANKER_WEIGHTS.recency;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("uses correct weights: 0.40/0.25/0.05/0.15/0.15", () => {
      expect(RANKER_WEIGHTS.volume).toBe(0.4);
      expect(RANKER_WEIGHTS.buyerDiversity).toBe(0.25);
      expect(RANKER_WEIGHTS.reliability).toBe(0.05);
      expect(RANKER_WEIGHTS.listingQuality).toBe(0.15);
      expect(RANKER_WEIGHTS.recency).toBe(0.15);
    });

    it("combines components using RANKER_WEIGHTS", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        merchant: { txCount30d: 100, volume30d: "100", buyers30d: 50 },
        resources: [
          {
            description: "A".repeat(200),
            tags: ["api"],
            hasInputSchema: true,
            reliabilityScore: "0.95",
            lastCalledAt: new Date("2024-06-15T06:00:00Z"),
          },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      const expected =
        RANKER_WEIGHTS.volume * breakdown.volumeSignal +
        RANKER_WEIGHTS.buyerDiversity * breakdown.buyerDiversity +
        RANKER_WEIGHTS.reliability * breakdown.reliability +
        RANKER_WEIGHTS.listingQuality * breakdown.listingQuality +
        RANKER_WEIGHTS.recency * breakdown.recency;
      const score = computeRankerScore(data);
      expect(score).toBeCloseTo(Math.round(expected * 10000) / 10000, 4);
    });

    it("rounds to 4 decimal places", () => {
      const data = makeMerchantData({
        merchant: { txCount30d: 7, volume30d: "3.14159", buyers30d: 2 },
      });
      const score = computeRankerScore(data);
      const parts = score.toString().split(".");
      if (parts[1]) {
        expect(parts[1].length).toBeLessThanOrEqual(4);
      }
    });
  });

  describe("edge cases", () => {
    it("zero-activity merchant produces a low score", () => {
      const data = makeMerchantData({
        merchant: {
          txCount30d: 0,
          volume30d: "0",
          buyers30d: 0,
        },
        resources: [],
      });
      data.resources = [];
      const score = computeRankerScore(data);
      expect(score).toBeLessThan(0.15);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("high-activity merchant produces a high score", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        merchant: {
          txCount30d: 100000,
          volume30d: "500000",
          buyers30d: 5000,
        },
        resources: [
          {
            description: "A".repeat(300),
            tags: ["api", "ml", "data"],
            reliabilityScore: "0.99",
            lastCalledAt: new Date("2024-06-15T11:00:00Z"),
          },
        ],
      });
      const score = computeRankerScore(data);
      expect(score).toBeGreaterThan(0.7);
      vi.useRealTimers();
    });

    it("handles null merchant fields gracefully", () => {
      const data = makeMerchantData({
        merchant: {
          txCount30d: null as unknown as number,
          volume30d: null,
          buyers30d: null as unknown as number,
        },
      });
      const score = computeRankerScore(data);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(score)).toBe(true);
    });
  });
});
