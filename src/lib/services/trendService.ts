import { db } from "@/lib/db";
import { merchants, trends } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function writeDailySnapshot(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const allMerchants = await db
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
    await db
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
