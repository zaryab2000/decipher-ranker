import { getDb } from "@/lib/db";
import { cached } from "@/lib/cache";
import { computeScoreBreakdown } from "@/lib/analytics/ranker";
import { scoreToGrade } from "@/lib/analytics/grade";
import { toDisplayScore } from "@/dashboard/lib/formatters";
import { merchants, resources, categories, categoryCache, trends } from "@/lib/db/schema";
import { desc, asc, eq, sql, ilike, or, and, count, sum, inArray, gte } from "drizzle-orm";
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
  RankHistoryPoint,
  RankDelta,
  RankGap,
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
      .orderBy(
        sql`CASE WHEN ${categories.name} = 'Other' THEN 1 ELSE 0 END`,
        desc(categories.merchantCount),
      ),
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
      resourceUrl: resources.resourceUrl,
    })
        .from(resources)
        .where(inArray(resources.merchantId, topMerchantIds))
        .orderBy(resources.merchantId)
    : [];
  const topResources = new Map(
    resourceRows.map((r) => [
      r.merchantId,
      { serviceName: r.serviceName, resourceUrl: r.resourceUrl },
    ]),
  );

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
            serviceName: topResources.get(tm.merchantId)?.serviceName ?? null,
            resourceUrl: topResources.get(tm.merchantId)?.resourceUrl ?? null,
          }
        : null,
      growthIndicator: 0,
    };
  });
}

export function getAllCategories(): Promise<CategoryItem[]> {
  return cached("dash:all-categories", DASH_TTL_SECONDS, fetchAllCategories);
}

interface CategoryPageParams {
  page?: number;
  perPage?: number;
}

async function fetchCategoryBySlug(
  slug: string,
  pagination?: CategoryPageParams,
): Promise<CategoryDetail | null> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.perPage ?? 20;
  const offset = (page - 1) * perPage;

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
    .orderBy(desc(merchants.rankerScore))
    .limit(perPage)
    .offset(offset);

  const merchants_list = merchantRows.map((row, i) =>
    toMerchantListItem(row, offset + i + 1),
  );

  const cacheRow = await getDb()
    .select()
    .from(categoryCache)
    .where(eq(categoryCache.categoryName, cat.name))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const totalVolume30d = cacheRow?.totalVolume30d != null
    ? Number(cacheRow.totalVolume30d)
    : null;

  const [scoreRows, avgScoreRows] = await Promise.all([
    getDb()
      .select({ rankerScore: merchants.rankerScore })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id)),
    getDb()
      .select({ avg: sql<number>`AVG(${merchants.rankerScore})`.mapWith(Number) })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id)),
  ]);

  // NOT toDisplayScore(): that rounds, and buildScoreDistribution floors into
  // 10-point buckets. Rounding first moves scores like 0.3996 from the 30-40
  // bucket into 40-50 — it reclassifies 68 of 1321 merchants against the real
  // catalog. Bucketing uses the unrounded value; only the axis labels are
  // display values.
  const scoreDistribution = buildScoreDistribution(
    scoreRows.map((r) => Math.max(0, Math.min(1, Number(r.rankerScore ?? 0))) * 100),
  );

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
  pagination?: CategoryPageParams,
): Promise<CategoryDetail | null> {
  const p = pagination?.page ?? 1;
  const pp = pagination?.perPage ?? 20;
  return cached(`dash:category:${slug}:p${p}:pp${pp}`, DASH_TTL_SECONDS, () =>
    fetchCategoryBySlug(slug, { page: p, perPage: pp }),
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
  const hostname = extractHostname(origin);
  const likeSafe = (s: string) => s.replace(/[%_\\]/g, "\\$&");

  const resourceRows = await getDb()
    .select()
    .from(resources)
    .where(
      hostname
        ? ilike(resources.resourceUrl, `%${likeSafe(hostname)}%`)
        : ilike(resources.resourceUrl, `%${likeSafe(origin)}%`),
    )
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

  const [allResources, categoryRows] = await Promise.all([
    getDb().select().from(resources).where(eq(resources.merchantId, merchant.id)),
    getDb()
      .select()
      .from(categories)
      .where(eq(categories.id, merchant.categoryId ?? ""))
      .limit(1),
  ]);

  const matchedResource = resource;
  const resourcePriceUsd = matchedResource.priceUsd != null ? Number(matchedResource.priceUsd) : null;
  const resourceServiceName = matchedResource.serviceName ?? null;
  const resourceUrl = matchedResource.resourceUrl ?? "";
  const resourceDescription = matchedResource.description ?? null;
  const allTags = [...new Set(allResources.flatMap((r) => r.tags ?? []))];

  const categoryName = categoryRows[0]?.name ?? null;

  // computeScoreBreakdown is the canonical source (also used by
  // services/merchantService.ts). It returns every component in the 0..1 range,
  // so each is scaled to 0..100 here for display. The previous implementation
  // read resources.volumeScore/recencyScore/performanceScore/reliabilityScore,
  // which the pipeline never writes — every bar rendered at zero width.
  const rawBreakdown = computeScoreBreakdown({
    merchant,
    resources: allResources,
    category: categoryRows[0] ?? null,
  });

  const scoreBreakdown: ScoreBreakdown = {
    volumeSignal: rawBreakdown.volumeSignal * 100,
    buyerDiversity: rawBreakdown.buyerDiversity * 100,
    reliability: rawBreakdown.reliability * 100,
    listingQuality: rawBreakdown.listingQuality * 100,
    recency: rawBreakdown.recency * 100,
  };

  const resourceSubquery = buildResourceSubquery();
  const competitorRows = await getDb()
    .select(merchantSelect(resourceSubquery))
    .from(merchants)
    .leftJoin(resourceSubquery, eq(merchants.id, resourceSubquery.merchantId))
    .leftJoin(categories, eq(merchants.categoryId, categories.id))
    .where(
      and(
        eq(merchants.categoryId, merchant.categoryId ?? ""),
        sql`${merchants.id} != ${merchant.id}`,
      ),
    )
    .orderBy(desc(merchants.rankerScore))
    .limit(5);

  const competitorList = competitorRows
    .filter(
      (c, idx, self) =>
        self.findIndex((s) => s.merchants_payeeAddress === c.merchants_payeeAddress) === idx,
    )
    .slice(0, 5)
    .map((row, i) => toMerchantListItem(row, i + 1));

  const currentScore = Number(merchant.rankerScore ?? 0);
  const rankHistory = await getRankHistory(merchant.id);
  const rankDelta = computeRankDelta(rankHistory);
  const rankGap = computeRankGap(toDisplayScore(currentScore), competitorList);

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
    uniqueBuyers: merchant.uniqueBuyers ?? null,
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
    merchantId: merchant.id,
    grade: scoreToGrade(toDisplayScore(currentScore)),
    rankHistory,
    rankDelta,
    rankGap,
  };
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Daily rank/score snapshots for one merchant, oldest first.
 *
 * Source: `trends`, written by writeDailySnapshot() on every pipeline run.
 * Returns [] when the merchant has no snapshots yet — the table only began
 * accumulating at deploy, so early merchants legitimately have 0 or 1 points.
 */
export function getRankHistory(
  merchantId: string,
  days = 30,
): Promise<RankHistoryPoint[]> {
  return cached(`dash:rankhistory:${merchantId}:${days}`, DASH_TTL_SECONDS, () =>
    fetchRankHistory(merchantId, days),
  );
}

async function fetchRankHistory(
  merchantId: string,
  days: number,
): Promise<RankHistoryPoint[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const rows = await getDb()
    .select({
      snapshotDate: trends.snapshotDate,
      rankPosition: trends.rankPosition,
      rankerScore: trends.rankerScore,
    })
    .from(trends)
    .where(and(eq(trends.merchantId, merchantId), gte(trends.snapshotDate, cutoffDate)))
    .orderBy(asc(trends.snapshotDate));

  return rows.map((r) => ({
    date: String(r.snapshotDate),
    rankPosition: r.rankPosition ?? null,
    // trends.rankerScore is stored 0..1 like merchants.rankerScore.
    rankerScore: toDisplayScore(r.rankerScore),
  }));
}

/**
 * Direction and size of the rank move across the available history.
 *
 * A LOWER rankPosition is better, so moving from #6 to #4 is 'up' by 2 places.
 * Points with a null rankPosition are skipped — an unranked snapshot says
 * nothing about direction.
 */
export function computeRankDelta(history: RankHistoryPoint[]): RankDelta {
  const ranked = history.filter(
    (p): p is RankHistoryPoint & { rankPosition: number } => p.rankPosition != null,
  );

  if (ranked.length < 2) return { direction: 'flat', places: 0, known: false };

  const first = ranked[0]!.rankPosition;
  const last = ranked[ranked.length - 1]!.rankPosition;

  if (first === last) return { direction: 'flat', places: 0, known: true };

  return {
    direction: last < first ? 'up' : 'down',
    places: Math.abs(first - last),
    known: true,
  };
}

/**
 * Points needed to reach the next rank up and the category leader.
 *
 * Computed from the already-fetched competitor list — no extra query. Returns
 * all-null when the merchant leads or has no ranked peers to compare against.
 */
export function computeRankGap(
  currentDisplayScore: number,
  competitors: MerchantListItem[],
): RankGap {
  const ahead = competitors
    .filter((c) => toDisplayScore(c.rankerScore) > currentDisplayScore)
    .sort((a, b) => toDisplayScore(a.rankerScore) - toDisplayScore(b.rankerScore));

  if (ahead.length === 0) {
    return { toNextRank: null, toFirst: null, nextRankName: null };
  }

  const next = ahead[0]!;
  const leader = ahead[ahead.length - 1]!;

  return {
    toNextRank: toDisplayScore(next.rankerScore) - currentDisplayScore,
    toFirst: toDisplayScore(leader.rankerScore) - currentDisplayScore,
    nextRankName: next.serviceName ?? extractHostname(next.origin) ?? next.payeeAddress,
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
