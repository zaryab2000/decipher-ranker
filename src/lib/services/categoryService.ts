import { db } from "@/lib/db";
import { categories, merchants, resources, categoryCache } from "@/lib/db/schema";
import { desc, eq, sql, asc } from "drizzle-orm";

export async function getAllCategories() {
  const cats = await db.query.categories.findMany({
    orderBy: [desc(categories.merchantCount)],
  });

  const result = [];
  for (const cat of cats) {
    const [topMerchant] = await db
      .select({
        payeeAddress: merchants.payeeAddress,
        rankerScore: merchants.rankerScore,
      })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id))
      .orderBy(desc(merchants.rankerScore))
      .limit(1);

    const [avgResult] = await db
      .select({ avg: sql<number>`avg(${merchants.rankerScore}::numeric)` })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id));

    result.push({
      id: cat.id,
      name: cat.name,
      slug: cat.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
      merchantCount: cat.merchantCount ?? 0,
      medianPriceUsd: cat.medianPrice ? Number(cat.medianPrice) : null,
      avgScore: avgResult?.avg ? Number(avgResult.avg) : null,
      topMerchant: topMerchant
        ? {
            address: topMerchant.payeeAddress,
            score: Number(topMerchant.rankerScore ?? 0),
          }
        : null,
      growthIndicator: 0,
    });
  }

  return result;
}

export async function getCategoryBySlug(slug: string) {
  const allCats = await db.select().from(categories);
  const cat = allCats.find(
    (c) =>
      c.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") === slug,
  );

  if (!cat) return null;

  const categoryMerchants = await db
    .select()
    .from(merchants)
    .where(eq(merchants.categoryId, cat.id))
    .orderBy(desc(merchants.rankerScore));

  const merchantItems = [];
  for (const m of categoryMerchants) {
    const [firstResource] = await db
      .select()
      .from(resources)
      .where(eq(resources.merchantId, m.id))
      .limit(1);

    merchantItems.push({
      payeeAddress: m.payeeAddress,
      origin: firstResource?.resourceUrl ?? m.payeeAddress,
      serviceName: firstResource?.serviceName ?? null,
      category: cat.name,
      chain: m.chain,
      rankerScore: Number(m.rankerScore ?? 0),
      rankPosition: m.rankPosition,
      priceUsd: firstResource ? Number(firstResource.priceUsd ?? 0) || null : null,
      txCount30d: m.txCount30d ?? 0,
      uniqueBuyers: m.uniqueBuyers ?? 0,
    });
  }

  const scores = categoryMerchants
    .map((m) => Number(m.rankerScore ?? 0))
    .filter((s) => s > 0);

  const scoreDistribution = buildScoreDistribution(scores);

  const [volumeResult] = await db
    .select({ total: sql<number>`sum(${merchants.volume30d}::numeric)` })
    .from(merchants)
    .where(eq(merchants.categoryId, cat.id));

  return {
    name: cat.name,
    slug,
    merchantCount: cat.merchantCount ?? 0,
    medianPriceUsd: cat.medianPrice ? Number(cat.medianPrice) : null,
    avgScore:
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null,
    topMerchant: merchantItems[0]
      ? { address: merchantItems[0].payeeAddress, score: merchantItems[0].rankerScore }
      : null,
    growthIndicator: 0,
    merchants: merchantItems,
    totalVolume30d: Number(volumeResult?.total ?? 0),
    scoreDistribution,
  };
}

function buildScoreDistribution(
  scores: number[],
): Array<{ range: string; count: number }> {
  const ranges = [
    "0-10", "10-20", "20-30", "30-40", "40-50",
    "50-60", "60-70", "70-80", "80-90", "90-100",
  ];

  const counts = new Array(10).fill(0);
  for (const score of scores) {
    const scaled = score * 100;
    const bucket = Math.min(Math.floor(scaled / 10), 9);
    counts[bucket]++;
  }

  return ranges.map((range, i) => ({ range, count: counts[i] }));
}

export async function refreshCategoryCache(): Promise<number> {
  const allCats = await db.select().from(categories);
  let refreshed = 0;

  for (const cat of allCats) {
    const [stats] = await db
      .select({
        merchantCount: sql<number>`count(*)`,
        totalVolume: sql<number>`sum(${merchants.volume30d}::numeric)`,
        avgBuyers: sql<number>`avg(${merchants.buyers30d})`,
      })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id));

    const topMerchants = await db
      .select({
        payeeAddress: merchants.payeeAddress,
        rankPosition: merchants.rankPosition,
        rankerScore: merchants.rankerScore,
        txCount30d: merchants.txCount30d,
      })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id))
      .orderBy(desc(merchants.rankerScore))
      .limit(5);

    await db
      .insert(categoryCache)
      .values({
        categoryName: cat.name,
        merchantCount: Number(stats?.merchantCount ?? 0),
        totalVolume30d: (stats?.totalVolume ?? 0).toString(),
        medianPrice: cat.medianPrice,
        avgBuyers: (stats?.avgBuyers ?? 0).toString(),
        topMerchants: topMerchants.map((m) => ({
          address: m.payeeAddress,
          rank: m.rankPosition,
          score: Number(m.rankerScore ?? 0),
          volume: m.txCount30d ?? 0,
        })),
        refreshedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: categoryCache.categoryName,
        set: {
          merchantCount: Number(stats?.merchantCount ?? 0),
          totalVolume30d: (stats?.totalVolume ?? 0).toString(),
          medianPrice: cat.medianPrice,
          avgBuyers: (stats?.avgBuyers ?? 0).toString(),
          topMerchants: topMerchants.map((m) => ({
            address: m.payeeAddress,
            rank: m.rankPosition,
            score: Number(m.rankerScore ?? 0),
            volume: m.txCount30d ?? 0,
          })),
          refreshedAt: new Date(),
        },
      });

    refreshed++;
  }

  return refreshed;
}
