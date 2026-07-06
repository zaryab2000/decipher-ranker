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

  let written = 0;
  for (const m of allMerchants) {
    await db
      .insert(trends)
      .values({
        merchantId: m.id,
        snapshotDate: today,
        rankPosition: m.rankPosition,
        rankerScore: m.rankerScore,
        txCount30d: m.txCount30d,
        uniqueBuyers: m.uniqueBuyers,
        totalAmount: m.totalAmountUsd,
      })
      .onConflictDoUpdate({
        target: [trends.merchantId, trends.snapshotDate],
        set: {
          rankPosition: m.rankPosition,
          rankerScore: m.rankerScore,
          txCount30d: m.txCount30d,
          uniqueBuyers: m.uniqueBuyers,
          totalAmount: m.totalAmountUsd,
        },
      });
    written++;
  }

  return written;
}
