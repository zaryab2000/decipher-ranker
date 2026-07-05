import { db } from "@/lib/db";
import { merchants, categories, resources } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function getEcosystemStats() {
  const [merchantCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(merchants);

  const [categoryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(categories);

  const [txSum] = await db
    .select({ total: sql<number>`coalesce(sum(${merchants.txCount}), 0)` })
    .from(merchants);

  const [topCat] = await db
    .select({ name: categories.name })
    .from(categories)
    .orderBy(desc(categories.merchantCount))
    .limit(1);

  return {
    totalMerchants: Number(merchantCount?.count ?? 0),
    totalCategories: Number(categoryCount?.count ?? 0),
    totalTransactions: Number(txSum?.total ?? 0),
    topCategory: topCat?.name ?? "N/A",
  };
}

export async function getRecentlyUpdatedMerchants(limit: number = 5) {
  return db
    .select({
      id: merchants.id,
      payeeAddress: merchants.payeeAddress,
      rankerScore: merchants.rankerScore,
      rankPosition: merchants.rankPosition,
      txCount30d: merchants.txCount30d,
      uniqueBuyers: merchants.uniqueBuyers,
      lastUpdated: merchants.lastUpdated,
    })
    .from(merchants)
    .orderBy(desc(merchants.lastUpdated))
    .limit(limit);
}
