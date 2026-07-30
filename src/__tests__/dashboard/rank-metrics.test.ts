import { describe, it, expect } from "vitest";
import { computeRankDelta, computeRankGap } from "@/dashboard/lib/api";
import { toWeightedComponents, toDisplayScore } from "@/dashboard/lib/formatters";
import type { RankHistoryPoint, MerchantListItem, ScoreBreakdown } from "@/dashboard/types";

function point(date: string, rankPosition: number | null, rankerScore = 50): RankHistoryPoint {
  return { date, rankPosition, rankerScore };
}

function competitor(rankerScore: number, serviceName: string): MerchantListItem {
  return {
    payeeAddress: `0x${serviceName}`,
    origin: `https://${serviceName}.com`,
    serviceName,
    category: "Test",
    chain: "base",
    rankerScore,
    rankPosition: null,
    priceUsd: null,
    txCount30d: 0,
    uniqueBuyers: null,
    lastUpdated: "2026-07-30",
  } as MerchantListItem;
}

describe("computeRankDelta", () => {
  // The PRD calls getting this backwards "the single easiest mistake in this spec":
  // a LOWER rankPosition is better.
  it("treats rank 6 -> rank 4 as up by 2 places", () => {
    const delta = computeRankDelta([point("2026-07-01", 6), point("2026-07-30", 4)]);
    expect(delta).toEqual({ direction: "up", places: 2, known: true });
  });

  it("treats rank 4 -> rank 9 as down by 5 places", () => {
    const delta = computeRankDelta([point("2026-07-01", 4), point("2026-07-30", 9)]);
    expect(delta).toEqual({ direction: "down", places: 5, known: true });
  });

  it("reports flat but known when the rank did not move", () => {
    const delta = computeRankDelta([point("2026-07-01", 3), point("2026-07-30", 3)]);
    expect(delta).toEqual({ direction: "flat", places: 0, known: true });
  });

  it("reports unknown for empty history", () => {
    expect(computeRankDelta([])).toEqual({ direction: "flat", places: 0, known: false });
  });

  it("reports unknown for a single snapshot", () => {
    // With one point there is no prior state — claiming "holding steady" would
    // assert something the data does not support.
    expect(computeRankDelta([point("2026-07-30", 5)])).toEqual({
      direction: "flat",
      places: 0,
      known: false,
    });
  });

  it("ignores snapshots where the merchant was unranked", () => {
    const delta = computeRankDelta([
      point("2026-07-01", null),
      point("2026-07-15", 8),
      point("2026-07-30", 5),
    ]);
    expect(delta).toEqual({ direction: "up", places: 3, known: true });
  });

  it("uses first and last ranked points, not intermediate swings", () => {
    const delta = computeRankDelta([
      point("2026-07-01", 10),
      point("2026-07-10", 2),
      point("2026-07-30", 7),
    ]);
    expect(delta).toEqual({ direction: "up", places: 3, known: true });
  });
});

describe("computeRankGap", () => {
  it("returns the points needed to pass the next merchant up and the leader", () => {
    const gap = computeRankGap(60, [
      competitor(0.72, "leader"),
      competitor(0.64, "justAhead"),
      competitor(0.4, "below"),
    ]);
    expect(gap.toNextRank).toBe(4);
    expect(gap.toFirst).toBe(12);
    expect(gap.nextRankName).toBe("justAhead");
  });

  it("returns all null when the merchant leads the category", () => {
    const gap = computeRankGap(80, [competitor(0.6, "a"), competitor(0.5, "b")]);
    expect(gap).toEqual({ toNextRank: null, toFirst: null, nextRankName: null });
  });

  it("returns all null with no competitors", () => {
    expect(computeRankGap(50, [])).toEqual({
      toNextRank: null,
      toFirst: null,
      nextRankName: null,
    });
  });
});

describe("toWeightedComponents", () => {
  const breakdown: ScoreBreakdown = {
    volumeSignal: 56.157321384863224,
    buyerDiversity: 48.97603480802734,
    reliability: 50,
    listingQuality: 80.80333333333333,
    recency: 100,
  };

  it("earned values sum to the display score, not the raw 0..1 value", () => {
    // These are the real values for api.bitrefill.com, whose stored
    // rankerScore is 0.6433 -> display 64.
    const total = toWeightedComponents(breakdown).reduce((s, c) => s + c.earned, 0);
    expect(total).toBeCloseTo(toDisplayScore(0.6433), 0);
  });

  it("available points equal weight * 100 and sum to 100", () => {
    const components = toWeightedComponents(breakdown);
    const total = components.reduce((s, c) => s + c.available, 0);
    expect(total).toBeCloseTo(100, 10);
    expect(components.find((c) => c.key === "volumeSignal")?.available).toBe(40);
    expect(components.find((c) => c.key === "reliability")?.available).toBe(5);
  });

  it("is ordered by descending weight so the biggest lever reads first", () => {
    const available = toWeightedComponents(breakdown).map((c) => c.available);
    expect(available).toEqual([...available].sort((a, b) => b - a));
  });

  it("flags a zero component as the biggest lever", () => {
    const withZero = toWeightedComponents({ ...breakdown, buyerDiversity: 0 });
    const bd = withZero.find((c) => c.key === "buyerDiversity");
    expect(bd?.isZero).toBe(true);
    expect(bd?.earned).toBe(0);
    expect(bd?.pctOfMax).toBe(0);
  });

  it("does not flag a non-zero component as zero", () => {
    const components = toWeightedComponents(breakdown);
    expect(components.every((c) => !c.isZero)).toBe(true);
  });
});
