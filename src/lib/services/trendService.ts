import { getDb } from "@/lib/db";
import { merchants, trends } from "@/lib/db/schema";
import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";

export async function writeDailySnapshot(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const allMerchants = await getDb()
    .select({
      id: merchants.id,
      rankPosition: merchants.rankPosition,
      rankerScore: merchants.rankerScore,
      txCount30d: merchants.txCount30d,
      uniqueBuyers: merchants.uniqueBuyers,
      totalAmountUsd: merchants.totalAmountUsd,
    })
    .from(merchants);

  if (allMerchants.length === 0) return 0;

  const rows = allMerchants.map((m) => ({
    merchantId: m.id,
    snapshotDate: today,
    rankPosition: m.rankPosition,
    rankerScore: m.rankerScore,
    txCount30d: m.txCount30d,
    uniqueBuyers: m.uniqueBuyers,
    totalAmount: m.totalAmountUsd,
  }));

  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    await getDb()
      .insert(trends)
      .values(batch)
      .onConflictDoUpdate({
        target: [trends.merchantId, trends.snapshotDate],
        set: {
          rankPosition: sql`excluded.rank_position`,
          rankerScore: sql`excluded.ranker_score`,
          txCount30d: sql`excluded.tx_count_30d`,
          uniqueBuyers: sql`excluded.unique_buyers`,
          totalAmount: sql`excluded.total_amount`,
        },
      });
    written += batch.length;
  }

  return written;
}

export interface CategoryTrendPoint {
  /** ISO date, e.g. "2026-07-31". */
  date: string;
  categoryId: string;
  merchantCount: number;
  /** Stored 0..1 like merchants.rankerScore — convert before display. */
  avgScore: number;
  totalTx30d: number;
}

/**
 * Daily per-category aggregates, oldest first.
 *
 * Three properties of this data that each look like bugs later:
 *
 * 1. Recategorisation rewrites history. The join uses `merchants.categoryId` as
 *    it is TODAY, so a merchant moved from Other to AI & Agents retroactively
 *    appears to have always been in AI & Agents. This measures "merchants now
 *    in this category that existed on date X", not historical membership.
 * 2. History is shallow. `trends` began accumulating on 2026-07-20, so a
 *    30-day window is mostly empty. Callers must label the window they actually
 *    got, not the window they asked for — see categoryGrowth().
 * 3. A merchant with no snapshot on a date is absent, not zero. There is no
 *    COALESCE here on purpose: filling gaps with 0 manufactures a
 *    crash-and-recover shape that never happened.
 */
export async function getCategoryTrends(days = 30): Promise<CategoryTrendPoint[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const rows = await getDb()
    .select({
      date: trends.snapshotDate,
      categoryId: merchants.categoryId,
      merchantCount: sql<number>`count(distinct ${trends.merchantId})`,
      avgScore: sql<string>`avg(${trends.rankerScore})`,
      totalTx30d: sql<string>`coalesce(sum(${trends.txCount30d}), 0)`,
    })
    .from(trends)
    .innerJoin(merchants, eq(trends.merchantId, merchants.id))
    .where(and(isNotNull(merchants.categoryId), gte(trends.snapshotDate, cutoffDate)))
    .groupBy(trends.snapshotDate, merchants.categoryId)
    .orderBy(asc(trends.snapshotDate));

  return rows.map((r) => ({
    date: String(r.date),
    categoryId: String(r.categoryId),
    merchantCount: Number(r.merchantCount ?? 0),
    avgScore: Number(r.avgScore ?? 0),
    totalTx30d: Number(r.totalTx30d ?? 0),
  }));
}

export interface CategoryGrowth {
  /** Percentage change in merchant count across the available window. */
  growthPct: number;
  /**
   * Span in days between the first and last snapshot — label this, not the
   * requested window. Always a day span, never a count of snapshots: a single
   * snapshot spans 1 day. Both the known and unknown paths use the same unit
   * so callers can compare them.
   */
  daysCovered: number;
  /** False when fewer than two snapshots exist, so growth is unknowable. */
  known: boolean;
}

/**
 * Percentage change in merchant count per category, keyed by categoryId.
 *
 * Categories with fewer than two distinct snapshot dates report
 * `known: false` rather than 0 — "no change" and "no data" are different facts
 * and must not render identically.
 */
export function computeCategoryGrowth(
  points: CategoryTrendPoint[],
): Map<string, CategoryGrowth> {
  const byCategory = new Map<string, CategoryTrendPoint[]>();
  for (const p of points) {
    const list = byCategory.get(p.categoryId);
    if (list) list.push(p);
    else byCategory.set(p.categoryId, [p]);
  }

  const out = new Map<string, CategoryGrowth>();
  for (const [categoryId, series] of byCategory) {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;

    // A day span on every path, so `daysCovered` never mixes units. One
    // snapshot (or several on the same date) spans a single day.
    const daysCovered = first.date === last.date ? 1 : daysBetween(first.date, last.date);

    if (sorted.length < 2 || first.date === last.date) {
      out.set(categoryId, { growthPct: 0, daysCovered, known: false });
      continue;
    }

    // Percentage change from zero is undefined, not zero. A category that went
    // 0 -> 36 across the window is not "flat", so report it as unknown rather
    // than rendering it identically to one that genuinely did not move.
    if (first.merchantCount === 0) {
      out.set(categoryId, { growthPct: 0, daysCovered, known: false });
      continue;
    }

    const growthPct =
      ((last.merchantCount - first.merchantCount) / first.merchantCount) * 100;

    out.set(categoryId, { growthPct, daysCovered, known: true });
  }

  return out;
}

/** Inclusive day count between two ISO dates. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}
