import { getDb } from "@/lib/db";
import { cached } from "@/lib/cache";
import { merchants, resources, categories, categoryCache } from "@/lib/db/schema";
import { desc, asc, eq, sql, ilike, or, and, count, sum, inArray } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
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

// Dashboard reads are cached for an hour — the same window as page ISR — so
// repeated views and cache-miss regenerations don't re-query Neon. Keys are
// namespaced under `dash:` and include every argument that changes the result.
const DASH_TTL_SECONDS = 3600;

function buildResourceSubquery() {
  return getDb()
    .selectDistinctOn([resources.merchantId], {
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      priceUsd: resources.priceUsd,
    })
    .from(resources)
    .orderBy(resources.merchantId)
    .as("first_resource");
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
    lastUpdated:
      typeof row.merchants_lastUpdated === "string"
        ? row.merchants_lastUpdated
        : row.merchants_lastUpdated.toISOString(),
  };
}

interface ResourceColumns {
  serviceName: PgColumn;
  resourceUrl: PgColumn;
  priceUsd: PgColumn;
}

// The resource columns come from either the base `resources` table (when it's
// joined directly) or the first-resource subquery. Reference whichever source
// is actually part of the query — otherwise Drizzle emits a column for a table
// that was never joined.
function merchantSelect(resourceCols: ResourceColumns) {
  return {
    merchants_payeeAddress: merchants.payeeAddress,
    merchants_rankerScore: merchants.rankerScore,
    merchants_rankPosition: merchants.rankPosition,
    merchants_chain: merchants.chain,
    merchants_txCount30d: merchants.txCount30d,
    merchants_uniqueBuyers: merchants.uniqueBuyers,
    merchants_lastUpdated: merchants.lastUpdated,
    resources_serviceName: resourceCols.serviceName,
    resources_resourceUrl: resourceCols.resourceUrl,
    resources_priceUsd: resourceCols.priceUsd,
    categories_name: categories.name,
  };
}

async function fetchEcosystemStats(): Promise<EcosystemStats> {
  const [[merchantCountRow], [categoryCountRow], [txSumRow], [resourceCountRow], topCategoryRows] =
    await Promise.all([
      getDb().select({ value: count() }).from(merchants),
      // Count curated categories that have at least one merchant — matches the
      // categories-page card count exactly (empty categories are hidden there).
      getDb()
        .select({ value: count() })
        .from(categories)
        .where(sql`${categories.merchantCount} > 0`),
      getDb().select({ value: sum(merchants.txCount30d) }).from(merchants),
      getDb().select({ value: count() }).from(resources),
      getDb()
        .select({ name: categories.name })
        .from(categories)
        .orderBy(desc(categories.merchantCount))
        .limit(1),
    ]);

  return {
    totalMerchants: merchantCountRow?.value ?? 0,
    totalCategories: categoryCountRow?.value ?? 0,
    totalTransactions: Number(txSumRow?.value ?? 0),
    topCategory: topCategoryRows[0]?.name ?? "N/A",
    totalResources: resourceCountRow?.value ?? 0,
  };
}

export function getEcosystemStats(): Promise<EcosystemStats> {
  return cached("dash:ecosystem-stats", DASH_TTL_SECONDS, fetchEcosystemStats);
}

async function fetchTopMerchants(limit: number): Promise<MerchantListItem[]> {
  const resourceSubquery = buildResourceSubquery();

  const rows = await getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .orderBy(desc(merchants.rankerScore))
    .limit(limit);

  return rows.map((row, i) => toMerchantListItem(row, i + 1));
}

export function getTopMerchants(limit = 10): Promise<MerchantListItem[]> {
  return cached(`dash:top-merchants:${limit}`, DASH_TTL_SECONDS, () =>
    fetchTopMerchants(limit),
  );
}

async function fetchRecentlyUpdated(limit: number): Promise<MerchantListItem[]> {
  const resourceSubquery = buildResourceSubquery();

  const rows = await getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .orderBy(desc(merchants.lastUpdated))
    .limit(limit);

  return rows.map((row) => toMerchantListItem(row));
}

export function getRecentlyUpdated(limit = 5): Promise<MerchantListItem[]> {
  return cached(`dash:recently-updated:${limit}`, DASH_TTL_SECONDS, () =>
    fetchRecentlyUpdated(limit),
  );
}

interface LeaderboardParams {
  category?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

async function fetchLeaderboard(
  params: LeaderboardParams,
): Promise<LeaderboardData> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 50;
  const sortBy = params.sortBy ?? "score";
  const sortOrder = params.sortOrder ?? "desc";
  const categoryFilter = params.category;

  const resourceSubquery = buildResourceSubquery();

  const baseQuery = getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .$dynamic();

  const countQuery = getDb()
    .select({ cnt: count() })
    .from(merchants)
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .$dynamic();

  if (categoryFilter) {
    baseQuery.where(eq(categories.name, categoryFilter));
    countQuery.where(eq(categories.name, categoryFilter));
  }

  const sortColumn =
    sortBy === "rank"
      ? merchants.rankPosition
      : sortBy === "txCount"
        ? merchants.txCount30d
        : sortBy === "price"
          ? resourceSubquery.priceUsd
          : merchants.rankerScore;

  const orderFn = sortOrder === "asc" ? asc : desc;
  const offset = (page - 1) * perPage;

  const [{ cnt } = { cnt: 0 }] = await countQuery;
  const total = cnt ?? 0;

  const rows = await baseQuery
    .orderBy(orderFn(sortColumn))
    .limit(perPage)
    .offset(offset);

  const merchants_list = rows.map((row, i) =>
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

export function getLeaderboard(
  params: LeaderboardParams,
): Promise<LeaderboardData> {
  const key = `dash:leaderboard:${params.category ?? "all"}:${params.page ?? 1}:${params.perPage ?? 50}:${params.sortBy ?? "score"}:${params.sortOrder ?? "desc"}`;
  return cached(key, DASH_TTL_SECONDS, () => fetchLeaderboard(params));
}

async function fetchCategoryNames(): Promise<string[]> {
  const rows = await getDb()
    .select({ name: categories.name })
    .from(categories)
    .orderBy(categories.name);

  return rows.map((r) => r.name);
}

export function getCategoryNames(): Promise<string[]> {
  return cached("dash:category-names", DASH_TTL_SECONDS, fetchCategoryNames);
}

async function fetchAllCategories(): Promise<CategoryItem[]> {
  // Three independent set-based queries — category rows, per-category average
  // score, and per-category ranking — run in parallel to cut Neon round-trips.
  // Only categories with at least one merchant are shown (empty curated
  // categories are hidden).
  const [rows, aggRows, topRows] = await Promise.all([
    getDb()
      .select()
      .from(categories)
      .where(sql`${categories.merchantCount} > 0`)
      .orderBy(desc(categories.merchantCount)),
    getDb()
      .select({
        categoryId: merchants.categoryId,
        avg: sql<number>`AVG(${merchants.rankerScore})`.mapWith(Number),
      })
      .from(merchants)
      .where(sql`${merchants.categoryId} IS NOT NULL`)
      .groupBy(merchants.categoryId),
    getDb()
      .select({
        categoryId: merchants.categoryId,
        address: merchants.payeeAddress,
        score: merchants.rankerScore,
        merchantId: merchants.id,
        rn: sql<number>`row_number() over (partition by ${merchants.categoryId} order by ${merchants.rankerScore} desc)`,
      })
      .from(merchants)
      .where(sql`${merchants.categoryId} IS NOT NULL`),
  ]);

  const avgByCategory = new Map<string, number>();
  for (const a of aggRows) {
    if (a.categoryId) avgByCategory.set(a.categoryId, a.avg);
  }

  const topByCategory = new Map<string, { address: string; score: number; merchantId: string }>();
  for (const t of topRows) {
    if (!t.categoryId || Number(t.rn) !== 1) continue;
    topByCategory.set(t.categoryId, {
      address: t.address,
      score: Number(t.score ?? 0),
      merchantId: t.merchantId,
    });
  }

  const topMerchantIds = [...topByCategory.values()]
    .map((t) => t.merchantId)
    .filter((id): id is string => !!id);
  const resourceRows = topMerchantIds.length > 0
    ? await getDb()
        .selectDistinctOn([resources.merchantId], {
          merchantId: resources.merchantId,
          serviceName: resources.serviceName,
        })
        .from(resources)
        .where(inArray(resources.merchantId, topMerchantIds))
        .orderBy(resources.merchantId)
    : [];
  const topResources = new Map(resourceRows.map((r) => [r.merchantId, r.serviceName]));

  // `slug` is a curated, unique DB column (the taxonomy), so one row per card —
  // no dedup/merge needed.
  return rows.map((cat) => {
    const tm = topByCategory.get(cat.id);
    return {
      name: cat.name,
      slug: cat.slug,
      merchantCount: cat.merchantCount ?? 0,
      medianPriceUsd: cat.medianPrice != null ? Number(cat.medianPrice) : null,
      avgScore: avgByCategory.get(cat.id) ?? null,
      topMerchant: tm
        ? {
            address: tm.address,
            score: tm.score,
            serviceName: topResources.get(tm.merchantId) ?? null,
          }
        : null,
      growthIndicator: 0,
    };
  });
}

export function getAllCategories(): Promise<CategoryItem[]> {
  return cached("dash:all-categories", DASH_TTL_SECONDS, fetchAllCategories);
}

async function fetchCategoryBySlug(
  slug: string,
): Promise<CategoryDetail | null> {
  // slug is a unique DB column — one indexed lookup, no JS-side slugify/find.
  const cat = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!cat) return null;

  const resourceSubquery = buildResourceSubquery();

  const merchantRows = await getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(eq(merchants.categoryId, cat.id))
    .orderBy(desc(merchants.rankerScore));

  const merchants_list = merchantRows.map((row, i) =>
    toMerchantListItem(row, i + 1),
  );

  const cacheRow = await getDb()
    .select()
    .from(categoryCache)
    .where(eq(categoryCache.categoryName, cat.name))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const totalVolume30d = cacheRow?.totalVolume30d != null
    ? Number(cacheRow.totalVolume30d)
    : 0;

  const scoreDistribution = buildScoreDistribution(merchants_list.map((m) => m.rankerScore));

  const avgScoreRows = await getDb()
    .select({ avg: sql<number>`AVG(${merchants.rankerScore})`.mapWith(Number) })
    .from(merchants)
    .where(eq(merchants.categoryId, cat.id));

  return {
    name: cat.name,
    slug: cat.slug,
    merchantCount: cat.merchantCount ?? 0,
    medianPriceUsd: cat.medianPrice != null ? Number(cat.medianPrice) : null,
    avgScore: avgScoreRows[0]?.avg ?? null,
    topMerchant: merchants_list[0]
      ? {
          address: merchants_list[0].payeeAddress,
          score: merchants_list[0].rankerScore,
          serviceName: merchants_list[0].serviceName,
        }
      : null,
    growthIndicator: 0,
    merchants: merchants_list,
    totalVolume30d,
    scoreDistribution,
  };
}

export function getCategoryBySlug(
  slug: string,
): Promise<CategoryDetail | null> {
  return cached(`dash:category:${slug}`, DASH_TTL_SECONDS, () =>
    fetchCategoryBySlug(slug),
  );
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

async function fetchMerchantByOrigin(
  origin: string,
): Promise<MerchantProfile | null> {
  const safeOrigin = origin.replace(/[%_]/g, "\\$&");

  const resourceRows = await getDb()
    .select()
    .from(resources)
    .where(ilike(resources.resourceUrl, `%${safeOrigin}%`))
    .limit(1);

  const resource = resourceRows[0];
  if (!resource) return null;

  const merchantRows = await getDb()
    .select()
    .from(merchants)
    .where(eq(merchants.id, resource.merchantId))
    .limit(1);

  const merchant = merchantRows[0];
  if (!merchant) return null;

  const allResources = await getDb()
    .select()
    .from(resources)
    .where(eq(resources.merchantId, merchant.id));

  const firstResource = allResources[0];
  const resourcePriceUsd = firstResource?.priceUsd != null ? Number(firstResource.priceUsd) : null;
  const resourceServiceName = firstResource?.serviceName ?? null;
  const resourceUrl = firstResource?.resourceUrl ?? "";
  const resourceDescription = firstResource?.description ?? null;
  const allTags = allResources.flatMap((r) => r.tags ?? []);

  const categoryRows = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.id, merchant.categoryId ?? ""))
    .limit(1);

  const categoryName = categoryRows[0]?.name ?? null;

  const scoreBreakdown: ScoreBreakdown = {
    volumeSignal: Number(firstResource?.volumeScore ?? 0) * 100,
    buyerDiversity: 0,
    reliability: Number(firstResource?.reliabilityScore ?? 0) * 100,
    listingQuality: Number(firstResource?.performanceScore ?? 0) * 100,
    recency: Number(firstResource?.recencyScore ?? 0) * 100,
  };

  const competitors = await getDb()
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
    hasDescription: resourceDescription != null && resourceDescription.length > 0,
    hasTags: allTags.length > 0,
    txCount: merchant.txCount30d ?? 0,
    priceUsd: resourcePriceUsd,
    medianPrice: Number(categoryRows[0]?.medianPrice ?? 0),
  });

  return {
    payeeAddress: merchant.payeeAddress,
    origin: resourceUrl,
    serviceName: resourceServiceName,
    category: categoryName,
    chain: merchant.chain,
    rankerScore: currentScore,
    rankPosition: merchant.rankPosition ?? null,
    priceUsd: resourcePriceUsd,
    txCount30d: merchant.txCount30d ?? 0,
    uniqueBuyers: merchant.uniqueBuyers ?? 0,
    lastUpdated: merchant.lastUpdated?.toISOString?.() ?? String(merchant.lastUpdated ?? ""),
    description: resourceDescription,
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

export function getMerchantByOrigin(
  origin: string,
): Promise<MerchantProfile | null> {
  return cached(`dash:merchant:${origin}`, DASH_TTL_SECONDS, () =>
    fetchMerchantByOrigin(origin),
  );
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

async function fetchSearchMerchants(query: string): Promise<SearchResult> {
  const safeQuery = query.replace(/[%_\\]/g, "\\$&");
  const resourceSubquery = buildResourceSubquery();

  const rows = await getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(
      or(
        ilike(merchants.payeeAddress, `%${safeQuery}%`),
        ilike(resourceSubquery.resourceUrl, `%${safeQuery}%`),
        ilike(resourceSubquery.serviceName, `%${safeQuery}%`),
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

export function searchMerchants(query: string): Promise<SearchResult> {
  return cached(
    `dash:search:${query.trim().toLowerCase()}`,
    DASH_TTL_SECONDS,
    () => fetchSearchMerchants(query),
  );
}
