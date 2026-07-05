import { db } from "@/lib/db";
import { merchants, resources, categories, categoryCache } from "@/lib/db/schema";
import { desc, asc, eq, sql, ilike, or, and, count, sum, inArray } from "drizzle-orm";
import type {
  MerchantListItem,
  MerchantProfile,
  CategoryItem,
  CategoryDetail,
  EcosystemStats,
  LeaderboardData,
  SearchResult,
  ScoreBreakdown,
} from "@/dashboard/types";

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toMerchantListItem(
  row: {
    merchants_payeeAddress: string;
    merchants_rankerScore: string | number | null;
    merchants_rankPosition: number | null;
    merchants_chain: string;
    merchants_txCount30d: number | null;
    merchants_uniqueBuyers: number | null;
    merchants_lastUpdated: string | Date;
    resources_serviceName: string | null;
    resources_resourceUrl: string | null;
    resources_priceUsd: string | number | null;
    categories_name: string | null;
  },
  rankOverride?: number,
): MerchantListItem {
  return {
    payeeAddress: row.merchants_payeeAddress,
    origin: row.resources_resourceUrl ?? "",
    serviceName: row.resources_serviceName,
    category: row.categories_name,
    chain: row.merchants_chain,
    rankerScore: Number(row.merchants_rankerScore ?? 0),
    rankPosition: rankOverride ?? row.merchants_rankPosition,
    priceUsd: row.resources_priceUsd != null ? Number(row.resources_priceUsd) : null,
    txCount30d: row.merchants_txCount30d ?? 0,
    uniqueBuyers: row.merchants_uniqueBuyers ?? 0,
  };
}

function merchantSelect() {
  return {
    merchants_payeeAddress: merchants.payeeAddress,
    merchants_rankerScore: merchants.rankerScore,
    merchants_rankPosition: merchants.rankPosition,
    merchants_chain: merchants.chain,
    merchants_txCount30d: merchants.txCount30d,
    merchants_uniqueBuyers: merchants.uniqueBuyers,
    merchants_lastUpdated: merchants.lastUpdated,
    resources_serviceName: resources.serviceName,
    resources_resourceUrl: resources.resourceUrl,
    resources_priceUsd: resources.priceUsd,
    categories_name: categories.name,
  };
}

export async function getEcosystemStats(): Promise<EcosystemStats> {
  const [[merchantCountRow], [categoryCountRow], [txSumRow]] = await Promise.all([
    db.select({ value: count() }).from(merchants),
    db.select({ value: count() }).from(categories),
    db
      .select({ value: sum(merchants.txCount) })
      .from(merchants),
  ]);

  const topCategoryRows = await db
    .select({ name: categories.name })
    .from(categories)
    .orderBy(desc(categories.merchantCount))
    .limit(1);

  return {
    totalMerchants: merchantCountRow?.value ?? 0,
    totalCategories: categoryCountRow?.value ?? 0,
    totalTransactions: Number(txSumRow?.value ?? 0),
    topCategory: topCategoryRows[0]?.name ?? "N/A",
  };
}

export async function getTopMerchants(limit = 10): Promise<MerchantListItem[]> {
  const resourceSubquery = db
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");

  const rows = await db
    .select(merchantSelect())
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .orderBy(desc(merchants.rankerScore))
    .limit(limit);

  return rows.map((row, i) => toMerchantListItem(row, i + 1));
}

export async function getRecentlyUpdated(limit = 5): Promise<MerchantListItem[]> {
  const resourceSubquery = db
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");

  const rows = await db
    .select(merchantSelect())
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .orderBy(desc(merchants.lastUpdated))
    .limit(limit);

  return rows.map((row) => toMerchantListItem(row));
}

export async function getLeaderboard(params: {
  category?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<LeaderboardData> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 50;
  const sortBy = params.sortBy ?? "rank";
  const sortOrder = params.sortOrder ?? "asc";
  const categoryFilter = params.category;

  const resourceSubquery = db
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");

  const baseQuery = db
    .select(merchantSelect())
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id));

  if (categoryFilter) {
    baseQuery.where(eq(categories.name, categoryFilter));
  }

  const sortColumn = sortBy === "txCount"
    ? merchants.txCount30d
    : sortBy === "price"
      ? resourceSubquery.priceUsd
      : merchants.rankerScore;

  const countResult = await baseQuery;
  const total = countResult.length;

  const ordered = [...countResult].sort((a, b) => {
    const aVal = sortBy === "txCount"
      ? (a.merchants_txCount30d ?? 0)
      : sortBy === "price"
        ? Number(a.resources_priceUsd ?? 0)
        : Number(a.merchants_rankerScore ?? 0);
    const bVal = sortBy === "txCount"
      ? (b.merchants_txCount30d ?? 0)
      : sortBy === "price"
        ? Number(b.resources_priceUsd ?? 0)
        : Number(b.merchants_rankerScore ?? 0);

    if (sortOrder === "asc") {
      return aVal - bVal;
    }
    return bVal - aVal;
  });

  const offset = (page - 1) * perPage;
  const paginated = ordered.slice(offset, offset + perPage);

  const merchants_list = paginated.map((row, i) =>
    toMerchantListItem(row, offset + i + 1),
  );

  return {
    merchants: merchants_list,
    total,
    page,
    perPage,
    category: categoryFilter ?? null,
    sortBy,
    sortOrder,
  };
}

export async function getAllCategories(): Promise<CategoryItem[]> {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(desc(categories.merchantCount));

  const result: CategoryItem[] = [];

  for (const cat of rows) {
    const topMerchantRows = await db
      .select({
        address: merchants.payeeAddress,
        score: merchants.rankerScore,
      })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id))
      .orderBy(desc(merchants.rankerScore))
      .limit(1);

    const avgScoreRows = await db
      .select({ avg: sql<number>`AVG(${merchants.rankerScore})`.mapWith(Number) })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id));

    result.push({
      name: cat.name,
      slug: toSlug(cat.name),
      merchantCount: cat.merchantCount ?? 0,
      medianPriceUsd: cat.medianPrice != null ? Number(cat.medianPrice) : null,
      avgScore: avgScoreRows[0]?.avg ?? null,
      topMerchant: topMerchantRows[0]
        ? {
            address: topMerchantRows[0].address,
            score: Number(topMerchantRows[0].score ?? 0),
          }
        : null,
      growthIndicator: 0,
    });
  }

  return result;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
  const name = nameFromSlug(slug);

  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1);

  const cat = categoryRows[0];
  if (!cat) return null;

  const resourceSubquery = db
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");

  const merchantRows = await db
    .select(merchantSelect())
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(eq(merchants.categoryId, cat.id))
    .orderBy(desc(merchants.rankerScore));

  const merchants_list = merchantRows.map((row, i) =>
    toMerchantListItem(row, i + 1),
  );

  const cacheRows = await db
    .select()
    .from(categoryCache)
    .where(eq(categoryCache.categoryName, name))
    .limit(1);

  const totalVolume30d = cacheRows[0]?.totalVolume30d != null
    ? Number(cacheRows[0].totalVolume30d)
    : 0;

  const scoreDistribution = buildScoreDistribution(merchants_list.map((m) => m.rankerScore));

  const avgScoreRows = await db
    .select({ avg: sql<number>`AVG(${merchants.rankerScore})`.mapWith(Number) })
    .from(merchants)
    .where(eq(merchants.categoryId, cat.id));

  return {
    name: cat.name,
    slug: toSlug(cat.name),
    merchantCount: cat.merchantCount ?? 0,
    medianPriceUsd: cat.medianPrice != null ? Number(cat.medianPrice) : null,
    avgScore: avgScoreRows[0]?.avg ?? null,
    topMerchant: null,
    growthIndicator: 0,
    merchants: merchants_list,
    totalVolume30d,
    scoreDistribution,
  };
}

function buildScoreDistribution(scores: number[]): { range: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const low = i * 10;
    const high = low + 10;
    buckets[`${low}-${high}`] = 0;
  }

  for (const score of scores) {
    const bucket = Math.min(Math.floor(score / 10), 9);
    const key = `${bucket * 10}-${(bucket + 1) * 10}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
}

export async function getMerchantByOrigin(origin: string): Promise<MerchantProfile | null> {
  const resourceRows = await db
    .select()
    .from(resources)
    .where(ilike(resources.resourceUrl, `%${origin}%`))
    .limit(1);

  const resource = resourceRows[0];
  if (!resource) return null;

  const merchantRows = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, resource.merchantId))
    .limit(1);

  const merchant = merchantRows[0];
  if (!merchant) return null;

  const allResources = await db
    .select()
    .from(resources)
    .where(eq(resources.merchantId, merchant.id));

  const firstResource = allResources[0];
  const totalPriceUsd = firstResource?.priceUsd != null ? Number(firstResource.priceUsd) : null;
  const totalServiceName = firstResource?.serviceName ?? null;
  const totalResourceUrl = firstResource?.resourceUrl ?? "";
  const totalDescription = firstResource?.description ?? null;
  const allTags = allResources.flatMap((r) => r.tags ?? []);

  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.id, merchant.categoryId ?? ""))
    .limit(1);

  const categoryName = categoryRows[0]?.name ?? null;

  const scoreBreakdown: ScoreBreakdown = (() => {
    if (firstResource) {
      return {
        volumeSignal: Number(firstResource.volumeScore ?? 0) * 100,
        buyerDiversity: 0,
        reliability: Number(firstResource.reliabilityScore ?? 0) * 100,
        listingQuality: Number(firstResource.performanceScore ?? 0) * 100,
        recency: Number(firstResource.recencyScore ?? 0) * 100,
      };
    }
    return {
      volumeSignal: 0,
      buyerDiversity: 0,
      reliability: 0,
      listingQuality: 0,
      recency: 0,
    };
  })();

  const competitors = await db
    .select({
      merchants_payeeAddress: merchants.payeeAddress,
      merchants_rankerScore: merchants.rankerScore,
      merchants_rankPosition: merchants.rankPosition,
      merchants_chain: merchants.chain,
      merchants_txCount30d: merchants.txCount30d,
      merchants_uniqueBuyers: merchants.uniqueBuyers,
      merchants_lastUpdated: merchants.lastUpdated,
      resources_serviceName: resources.serviceName,
      resources_resourceUrl: resources.resourceUrl,
      resources_priceUsd: resources.priceUsd,
      categories_name: categories.name,
    })
    .from(merchants)
    .leftJoin(resources, eq(merchants.id, resources.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(
      and(
        eq(merchants.categoryId, merchant.categoryId ?? ""),
        sql`${merchants.id} != ${merchant.id}`,
      ),
    )
    .orderBy(desc(merchants.rankerScore))
    .limit(5);

  const competitorList = competitors
    .filter(
      (c, idx, self) =>
        self.findIndex((s) => s.merchants_payeeAddress === c.merchants_payeeAddress) === idx,
    )
    .slice(0, 5)
    .map((row, i) => toMerchantListItem(row, i + 1));

  const currentScore = Number(merchant.rankerScore ?? 0);
  const improvements = buildImprovements({
    hasDescription: totalDescription != null && totalDescription.length > 0,
    hasTags: allTags.length > 0,
    txCount: merchant.txCount30d ?? 0,
    priceUsd: totalPriceUsd,
    medianPrice: Number(categoryRows[0]?.medianPrice ?? 0),
  });

  return {
    payeeAddress: merchant.payeeAddress,
    origin: totalResourceUrl,
    serviceName: totalServiceName,
    category: categoryName,
    chain: merchant.chain,
    rankerScore: currentScore,
    rankPosition: merchant.rankPosition ?? null,
    priceUsd: totalPriceUsd,
    txCount30d: merchant.txCount30d ?? 0,
    uniqueBuyers: merchant.uniqueBuyers ?? 0,
    description: totalDescription,
    tags: allTags,
    facilitator: merchant.facilitator ?? null,
    firstSeenAt: merchant.firstSeenAt.toISOString(),
    totalAmountUsd: Number(merchant.totalAmountUsd ?? 0),
    volume30d: Number(merchant.volume30d ?? 0),
    buyers30d: merchant.buyers30d ?? 0,
    scoreBreakdown,
    competitors: competitorList,
    improvements,
  };
}

function buildImprovements(metrics: {
  hasDescription: boolean;
  hasTags: boolean;
  txCount: number;
  priceUsd: number | null;
  medianPrice: number;
}): { priority: "high" | "medium" | "low"; message: string }[] {
  const improvements: { priority: "high" | "medium" | "low"; message: string }[] = [];

  if (!metrics.hasDescription) {
    improvements.push({
      priority: "high",
      message: "Add a description to your service listing",
    });
  }

  if (!metrics.hasTags) {
    improvements.push({
      priority: "high",
      message: "Add relevant tags to improve discoverability",
    });
  }

  if (metrics.txCount < 10) {
    improvements.push({
      priority: "medium",
      message: "Increase transaction volume to improve your ranking signals",
    });
  }

  if (metrics.priceUsd != null && metrics.medianPrice > 0 && metrics.priceUsd > metrics.medianPrice) {
    improvements.push({
      priority: "low",
      message: "Consider competitive pricing — your price is above the category median",
    });
  }

  return improvements;
}

export async function searchMerchants(query: string): Promise<SearchResult> {
  const resourceSubquery = db
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");

  const rows = await db
    .select(merchantSelect())
    .from(merchants)
    .leftJoin(resources, eq(merchants.id, resources.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(
      or(
        ilike(merchants.payeeAddress, `%${query}%`),
        ilike(resources.resourceUrl, `%${query}%`),
        ilike(resources.serviceName, `%${query}%`),
        ilike(resources.description, `%${query}%`),
      ),
    )
    .orderBy(desc(merchants.rankerScore));

  const seen = new Set<string>();
  const unique: typeof rows = [];

  for (const row of rows) {
    if (!seen.has(row.merchants_payeeAddress)) {
      seen.add(row.merchants_payeeAddress);
      unique.push(row);
    }
  }

  const result = unique.map((row, i) => toMerchantListItem(row, i + 1));

  return {
    merchants: result,
    total: result.length,
    query,
  };
}
