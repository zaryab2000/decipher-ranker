/**
 * Rank trend analysis — reads the `trends` table to compute
 * 30-day deltas and direction (improving/declining/stable).
 *
 * The trends table is written daily by `writeDailySnapshot`
 * (trendService.ts) as part of the pipeline. Each row is one
 * merchant-day with score, rank, volume, and buyer counts.
 *
 * For a merchant with N snapshots, we compare the most recent
 * against the snapshot 30 days ago (or the earliest available if
 * fewer than 30 days of data exist).
 */

import { getDb } from "@/lib/db";
import { trends } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const TREND_SIGNIFICANT_CHANGE = 0.02;

export interface RankTrendData {
  trendDirection: "improving" | "declining" | "stable" | "insufficient_data";
  scoreChange30d: number | null;
  rankChange30d: number | null;
  volumeChange30d: number | null;
  buyerChange30d: number | null;
  snapshotsAvailable: number;
  firstSnapshotDate: string | null;
  lastSnapshotDate: string | null;
  interpretation: string;
}

export async function computeRankTrend(
  merchantId: string,
): Promise<RankTrendData> {
  const snapshots = await getDb()
    .select()
    .from(trends)
    .where(eq(trends.merchantId, merchantId))
    .orderBy(desc(trends.snapshotDate))
    .limit(60); // up to 60 days of history

  if (snapshots.length < 2) {
    return {
      trendDirection: "insufficient_data",
      scoreChange30d: null,
      rankChange30d: null,
      volumeChange30d: null,
      buyerChange30d: null,
      snapshotsAvailable: snapshots.length,
      firstSnapshotDate: snapshots[snapshots.length - 1]?.snapshotDate ?? null,
      lastSnapshotDate: snapshots[0]?.snapshotDate ?? null,
      interpretation:
        snapshots.length === 0
          ? "No trend data yet — the daily snapshot pipeline hasn't recorded any data points for this merchant."
          : "Only one snapshot available — need at least two to compute a trend. Check back tomorrow.",
    };
  }

  const latest = snapshots[0]!;
  const earliest = snapshots[snapshots.length - 1]!;
  const latestDate = new Date(latest.snapshotDate);
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - 30);
  const targetIso = targetDate.toISOString().split("T")[0]!;

  // Find the snapshot closest to 30 days ago (or the earliest if we don't have
  // that far back).
  let baseline = earliest;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i]!.snapshotDate >= targetIso) {
      baseline = snapshots[i]!;
      break;
    }
  }

  const latestScore = Number(latest.rankerScore ?? "0");
  const baselineScore = Number(baseline.rankerScore ?? "0");
  const scoreChange = Math.round((latestScore - baselineScore) * 10000) / 10000;

  const latestRank = latest.rankPosition;
  const baselineRank = baseline.rankPosition;
  const rankChange =
    latestRank != null && baselineRank != null
      ? baselineRank - latestRank
      : null; // positive = improving (rank 50 → 45 = +5)

  const latestVolume = latest.txCount30d ?? 0;
  const baselineVolume = baseline.txCount30d ?? 0;
  const volumeChange = latestVolume - baselineVolume;

  const latestBuyers = latest.uniqueBuyers ?? 0;
  const baselineBuyers = baseline.uniqueBuyers ?? 0;
  const buyerChange = latestBuyers - baselineBuyers;

  let trendDirection: RankTrendData["trendDirection"];
  if (scoreChange > TREND_SIGNIFICANT_CHANGE) {
    trendDirection = "improving";
  } else if (scoreChange < -TREND_SIGNIFICANT_CHANGE) {
    trendDirection = "declining";
  } else {
    trendDirection = "stable";
  }

  const interpretation = buildInterpretation({
    trendDirection,
    scoreChange,
    rankChange,
    volumeChange,
    buyerChange,
    daysCovered: snapshots.length,
  });

  return {
    trendDirection,
    scoreChange30d: scoreChange,
    rankChange30d: rankChange,
    volumeChange30d: volumeChange,
    buyerChange30d: buyerChange,
    snapshotsAvailable: snapshots.length,
    firstSnapshotDate: earliest.snapshotDate,
    lastSnapshotDate: latest.snapshotDate,
    interpretation,
  };
}

function buildInterpretation(params: {
  trendDirection: string;
  scoreChange: number;
  rankChange: number | null;
  volumeChange: number | null;
  buyerChange: number | null;
  daysCovered: number;
}): string {
  const {
    trendDirection,
    scoreChange,
    rankChange,
    volumeChange,
    buyerChange,
    daysCovered,
  } = params;

  const rankNote =
    rankChange != null
      ? rankChange > 0
        ? ` Rank improved by ${rankChange} position${rankChange === 1 ? "" : "s"}.`
        : rankChange < 0
          ? ` Rank dropped ${Math.abs(rankChange)} position${Math.abs(rankChange) === 1 ? "" : "s"}.`
          : " Rank unchanged."
      : "";

  const volumeNote =
    volumeChange != null && volumeChange > 0
      ? ` 30-day volume up by ${volumeChange} transactions.`
      : volumeChange != null && volumeChange < 0
        ? ` 30-day volume down by ${Math.abs(volumeChange)} transactions.`
        : "";

  const buyerNote =
    buyerChange != null && buyerChange > 0
      ? ` Added ${buyerChange} new unique buyer${buyerChange === 1 ? "" : "s"}.`
      : "";

  const basisNote = ` Based on ${daysCovered} daily snapshot${daysCovered === 1 ? "" : "s"}.`;

  if (trendDirection === "improving") {
    return `Your score improved by ${scoreChange.toFixed(4)} over the last 30 days.${rankNote}${volumeNote}${buyerNote}${basisNote}`;
  }
  if (trendDirection === "declining") {
    return `Your score declined by ${Math.abs(scoreChange).toFixed(4)} over the last 30 days.${rankNote}${volumeNote}${basisNote}`;
  }
  return `Your score is stable (change: ${scoreChange >= 0 ? "+" : ""}${scoreChange.toFixed(4)}).${rankNote}${basisNote}`;
}
