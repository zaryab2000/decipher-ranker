import { getDb } from "@/lib/db";
import { categories, merchants, resources, categoryCache } from "@/lib/db/schema";
import { desc, eq, sql, asc } from "drizzle-orm";

export async function getAllCategories() {
  const cats = await getDb().query.categories.findMany({
    orderBy: [desc(categories.merchantCount)],
  });

  const result = [];
  for (const cat of cats) {
    const [topMerchant] = await getDb()
      .select({
        payeeAddress: merchants.payeeAddress,
        rankerScore: merchants.rankerScore,
      })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id))
      .orderBy(desc(merchants.rankerScore))
      .limit(1);

    const [avgResult] = await getDb()
      .select({ avg: sql<number>`avg(${merchants.rankerScore}::numeric)` })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id));

    result.push({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
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
  const [cat] = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!cat) return null;

  const categoryMerchants = await getDb()
    .select()
    .from(merchants)
    .where(eq(merchants.categoryId, cat.id))
    .orderBy(desc(merchants.rankerScore));

  const merchantItems = [];
  for (const m of categoryMerchants) {
    const [firstResource] = await getDb()
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

  const [volumeResult] = await getDb()
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
  const allCats = await getDb().select().from(categories);

  // Aggregate per-category stats in one pass instead of a query per category.
  const statRows = await getDb()
    .select({
      categoryId: merchants.categoryId,
      merchantCount: sql<number>`count(*)`,
      totalVolume: sql<number>`sum(${merchants.volume30d}::numeric)`,
      avgBuyers: sql<number>`avg(${merchants.buyers30d})`,
    })
    .from(merchants)
    .where(sql`${merchants.categoryId} IS NOT NULL`)
    .groupBy(merchants.categoryId);

  const statsByCategory = new Map<string, (typeof statRows)[number]>();
  for (const s of statRows) {
    if (s.categoryId) statsByCategory.set(s.categoryId, s);
  }

  // Top-5 merchants per non-empty category in a single windowed query.
  const rankedRows = await getDb()
    .select({
      categoryId: merchants.categoryId,
      payeeAddress: merchants.payeeAddress,
      rankPosition: merchants.rankPosition,
      rankerScore: merchants.rankerScore,
      txCount30d: merchants.txCount30d,
      rn: sql<number>`row_number() over (partition by ${merchants.categoryId} order by ${merchants.rankerScore} desc)`,
    })
    .from(merchants)
    .where(sql`${merchants.categoryId} IS NOT NULL`);

  const topByCategory = new Map<
    string,
    Array<{ address: string; rank: number | null; score: number; volume: number }>
  >();
  for (const r of rankedRows) {
    if (!r.categoryId || Number(r.rn) > 5) continue;
    const list = topByCategory.get(r.categoryId) ?? [];
    list.push({
      address: r.payeeAddress,
      rank: r.rankPosition,
      score: Number(r.rankerScore ?? 0),
      volume: r.txCount30d ?? 0,
    });
    topByCategory.set(r.categoryId, list);
  }

  const cacheRows = allCats.map((cat) => {
    const stats = statsByCategory.get(cat.id);
    return {
      categoryName: cat.name,
      merchantCount: Number(stats?.merchantCount ?? 0),
      totalVolume30d: (stats?.totalVolume ?? 0).toString(),
      medianPrice: cat.medianPrice,
      avgBuyers: (stats?.avgBuyers ?? 0).toString(),
      topMerchants: topByCategory.get(cat.id) ?? [],
      refreshedAt: new Date(),
    };
  });

  const CHUNK = 500;
  for (let i = 0; i < cacheRows.length; i += CHUNK) {
    const batch = cacheRows.slice(i, i + CHUNK);
    await getDb()
      .insert(categoryCache)
      .values(batch)
      .onConflictDoUpdate({
        target: categoryCache.categoryName,
        set: {
          merchantCount: sql`excluded.merchant_count`,
          totalVolume30d: sql`excluded.total_volume_30d`,
          medianPrice: sql`excluded.median_price`,
          avgBuyers: sql`excluded.avg_buyers`,
          topMerchants: sql`excluded.top_merchants`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      });
  }

  return cacheRows.length;
}
