import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { computeRankerScore, computeScoreBreakdown } from "@/lib/analytics/ranker";
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

  describe("listing quality (weight 0.15)", () => {
    it("returns 0 for no resources", () => {
      const data = makeMerchantData({ resources: [] });
      data.resources = [];
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBe(0);
    });

    it("gives 0.3/1.2 for short description (1-50 chars)", () => {
      const data = makeMerchantData({
        resources: [{ description: "short", tags: [] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBeCloseTo(0.3 / 1.2, 4);
    });

    it("gives 0.6/1.2 for medium description (51-150 chars)", () => {
      const data = makeMerchantData({
        resources: [{ description: "A".repeat(100), tags: [] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBeCloseTo(0.6 / 1.2, 4);
    });

    it("gives 1.0/1.2 for long description (>150 chars)", () => {
      const data = makeMerchantData({
        resources: [{ description: "A".repeat(200), tags: [] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBeCloseTo(1.0 / 1.2, 4);
    });

    it("adds 0.2 tag bonus when tags exist", () => {
      const noTags = makeMerchantData({
        resources: [{ description: "A".repeat(200), tags: [] }],
      });
      const withTags = makeMerchantData({
        resources: [{ description: "A".repeat(200), tags: ["api"] }],
      });
      const bNoTags = computeScoreBreakdown(noTags);
      const bWithTags = computeScoreBreakdown(withTags);
      expect(bWithTags.listingQuality).toBeGreaterThan(bNoTags.listingQuality);
    });

    it("caps individual resource score at 1.0 (via /1.2 normalization)", () => {
      const data = makeMerchantData({
        resources: [{ description: "A".repeat(200), tags: ["api", "test"] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBeLessThanOrEqual(1.0);
    });

    it("averages across multiple resources", () => {
      const data = makeMerchantData({
        resources: [
          { description: "A".repeat(200), tags: ["api"] },
          { description: "", tags: [] },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      const singleGood = makeMerchantData({
        resources: [{ description: "A".repeat(200), tags: ["api"] }],
      });
      const singleBad = makeMerchantData({
        resources: [{ description: "", tags: [] }],
      });
      const bGood = computeScoreBreakdown(singleGood).listingQuality;
      const bBad = computeScoreBreakdown(singleBad).listingQuality;
      expect(breakdown.listingQuality).toBeCloseTo((bGood + bBad) / 2, 4);
    });

    it("gives 0 for empty description with no tags", () => {
      const data = makeMerchantData({
        resources: [{ description: "", tags: [] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBe(0);
    });

    it("gives 0 for null description with no tags", () => {
      const data = makeMerchantData({
        resources: [{ description: null, tags: [] }],
      });
      const breakdown = computeScoreBreakdown(data);
      expect(breakdown.listingQuality).toBe(0);
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

    it("uses correct weights: 0.30/0.25/0.15/0.15/0.15", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
      const data = makeMerchantData({
        merchant: { txCount30d: 100, volume30d: "100", buyers30d: 50 },
        resources: [
          {
            description: "A".repeat(200),
            tags: ["api"],
            reliabilityScore: "0.95",
            lastCalledAt: new Date("2024-06-15T06:00:00Z"),
          },
        ],
      });
      const breakdown = computeScoreBreakdown(data);
      const expected =
        0.3 * breakdown.volumeSignal +
        0.25 * breakdown.buyerDiversity +
        0.15 * breakdown.reliability +
        0.15 * breakdown.listingQuality +
        0.15 * breakdown.recency;
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
