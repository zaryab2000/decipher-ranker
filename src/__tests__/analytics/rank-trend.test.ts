import { describe, it, expect, vi, beforeEach } from "vitest";

let snapshotResult: unknown[] = [];

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(snapshotResult),
          }),
        }),
      }),
    }),
  }),
}));

import { computeRankTrend } from "@/lib/analytics/rank-trend";

function snap(overrides: {
  snapshotDate: string;
  rankerScore?: string;
  rankPosition?: number | null;
  txCount30d?: number | null;
  uniqueBuyers?: number | null;
}) {
  return {
    snapshotDate: overrides.snapshotDate,
    rankerScore: overrides.rankerScore ?? "0",
    rankPosition: overrides.rankPosition ?? null,
    txCount30d: overrides.txCount30d ?? null,
    uniqueBuyers: overrides.uniqueBuyers ?? null,
  };
}

beforeEach(() => {
  snapshotResult = [];
});

describe("computeRankTrend", () => {
  it("returns insufficient_data when no snapshots exist", async () => {
    snapshotResult = [];
    const result = await computeRankTrend("m-1");
    expect(result.trendDirection).toBe("insufficient_data");
    expect(result.scoreChange30d).toBeNull();
    expect(result.snapshotsAvailable).toBe(0);
  });

  it("returns insufficient_data when only one snapshot exists", async () => {
    snapshotResult = [snap({ snapshotDate: "2026-07-26", rankerScore: "0.5" })];
    const result = await computeRankTrend("m-1");
    expect(result.trendDirection).toBe("insufficient_data");
    expect(result.snapshotsAvailable).toBe(1);
  });

  it("detects an improving trend when score rises > 0.02", async () => {
    // Snapshots are ordered desc by date (most recent first).
    snapshotResult = [
      snap({ snapshotDate: "2026-07-26", rankerScore: "0.30", rankPosition: 5, txCount30d: 100, uniqueBuyers: 20 }),
      snap({ snapshotDate: "2026-06-26", rankerScore: "0.20", rankPosition: 12, txCount30d: 40, uniqueBuyers: 8 }),
    ];
    const result = await computeRankTrend("m-1");
    expect(result.trendDirection).toBe("improving");
    expect(result.scoreChange30d).toBeCloseTo(0.1, 4);
    expect(result.rankChange30d).toBe(7); // 12 → 5 = +7
    expect(result.volumeChange30d).toBe(60);
    expect(result.buyerChange30d).toBe(12);
    expect(result.interpretation).toContain("improved");
  });

  it("detects a declining trend when score drops > 0.02", async () => {
    snapshotResult = [
      snap({ snapshotDate: "2026-07-26", rankerScore: "0.20", rankPosition: 12 }),
      snap({ snapshotDate: "2026-06-26", rankerScore: "0.30", rankPosition: 5 }),
    ];
    const result = await computeRankTrend("m-1");
    expect(result.trendDirection).toBe("declining");
    expect(result.scoreChange30d).toBeCloseTo(-0.1, 4);
    expect(result.rankChange30d).toBe(-7);
    expect(result.interpretation).toContain("declined");
  });

  it("detects a stable trend when score change is within ±0.02", async () => {
    snapshotResult = [
      snap({ snapshotDate: "2026-07-26", rankerScore: "0.201" }),
      snap({ snapshotDate: "2026-06-26", rankerScore: "0.200" }),
    ];
    const result = await computeRankTrend("m-1");
    expect(result.trendDirection).toBe("stable");
    expect(result.interpretation).toContain("stable");
  });
});
