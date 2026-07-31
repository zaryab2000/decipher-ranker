import { describe, it, expect } from "vitest";
import { computeRankDelta, computeRankGap } from "@/dashboard/lib/api";
import {
  toWeightedComponents,
  toDisplayScore,
  biggestLever,
  isMeaningfulCategory,
} from "@/dashboard/lib/formatters";
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
  it("measures the gap against the merchant one rank above", () => {
    const gap = computeRankGap(60, competitor(0.64, "justAhead"), competitor(0.72, "leader"));
    expect(gap.toNextRank).toBe(4);
    expect(gap.toFirst).toBe(12);
    expect(gap.nextRankName).toBe("justAhead");
  });

  it("reports a 0-point gap when tied with the rank above", () => {
    // Ties are common. "0 pts from #19" is a real, useful answer — it must not
    // be swallowed as if no neighbour existed.
    const gap = computeRankGap(52, competitor(0.52, "tied"), competitor(0.71, "leader"));
    expect(gap.toNextRank).toBe(0);
    expect(gap.nextRankName).toBe("tied");
  });

  it("returns all null when the merchant leads the category", () => {
    expect(computeRankGap(80, null, null)).toEqual({
      toNextRank: null,
      toFirst: null,
      nextRankName: null,
    });
  });

  it("still reports toNextRank when the leader is unknown", () => {
    const gap = computeRankGap(60, competitor(0.64, "justAhead"), null);
    expect(gap.toNextRank).toBe(4);
    expect(gap.toFirst).toBeNull();
  });

  it("clamps a negative gap to 0 when rank and score briefly disagree", () => {
    // rank_position and ranker_score are written by different pipeline stages,
    // so a merchant can momentarily outscore the rank above it.
    const gap = computeRankGap(70, competitor(0.64, "staleAbove"), null);
    expect(gap.toNextRank).toBe(0);
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

describe("isMeaningfulCategory", () => {
  it("treats Other as no category at all", () => {
    // "Other" is the categorizer's catch-all and holds 714 of 1,343 merchants.
    // "#1 of 714 in Other" is the absence of positioning, so the cockpit falls
    // back to an overall rank instead.
    expect(isMeaningfulCategory("Other")).toBe(false);
  });

  it("accepts a real category", () => {
    expect(isMeaningfulCategory("Crypto & DeFi")).toBe(true);
    expect(isMeaningfulCategory("AI & Agents")).toBe(true);
  });

  it("rejects null, undefined and empty", () => {
    expect(isMeaningfulCategory(null)).toBe(false);
    expect(isMeaningfulCategory(undefined)).toBe(false);
    expect(isMeaningfulCategory("")).toBe(false);
  });
});

describe("biggestLever", () => {
  const breakdown: ScoreBreakdown = {
    volumeSignal: 56,
    buyerDiversity: 49,
    reliability: 50,
    listingQuality: 80,
    recency: 100,
  };

  it("returns null when nothing is zero", () => {
    expect(biggestLever(breakdown)).toBeNull();
  });

  it("picks the most valuable zero when several components are zero", () => {
    // A real case: lowpaymentfee.com has both volume (40 pts) and buyer
    // diversity (25 pts) at zero. Only volume is the biggest lever — labelling
    // both makes the superlative meaningless.
    const lever = biggestLever({ ...breakdown, volumeSignal: 0, buyerDiversity: 0 });
    expect(lever?.key).toBe("volumeSignal");
    expect(lever?.available).toBe(40);
  });

  it("picks buyer diversity when it is the only zero", () => {
    const lever = biggestLever({ ...breakdown, buyerDiversity: 0 });
    expect(lever?.key).toBe("buyerDiversity");
    expect(lever?.available).toBe(25);
  });

  it("prefers a higher-weighted zero over a lower-weighted one", () => {
    const lever = biggestLever({ ...breakdown, recency: 0, buyerDiversity: 0 });
    expect(lever?.key).toBe("buyerDiversity"); // 25 pts beats recency's 15
  });
});
