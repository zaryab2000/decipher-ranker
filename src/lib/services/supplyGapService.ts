/**
 * Supply-gap service: probes CDP Bazaar search with category-relevant queries
 * and measures how many merchants in each category are invisible to CDP search
 * results. Caches the results in `supply_gap_cache` for use in merchant reports.
 *
 * This is the productized version of the Pass 3 thesis proof. Cost: $0 — CDP
 * discovery/search is free, unauthenticated, read-only.
 */

import { getDb } from "@/lib/db";
import { merchants, resources, categories, supplyGapCache } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { TAXONOMY, normalizeTag } from "@/lib/analytics/taxonomy";
import type { SupplyGapQueryResult, SupplyGapData } from "@/lib/types";

const CDP_SEARCH_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search";
const PROBE_DELAY_MS = 200;
const PROBE_TIMEOUT_MS = 10_000;
const MAX_QUERIES_PER_CATEGORY = 5;
const CDP_LIMIT = 20;
const MIN_MERCHANT_COUNT = 10;

interface CdpSearchItem {
  resource?: string;
  serviceName?: string | null;
}

interface CdpSearchResponse {
  resources?: CdpSearchItem[];
  searchMethod?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function generateQueries(categorySlug: string): string[] {
  const cat = TAXONOMY.find((c) => c.slug === categorySlug);
  if (!cat) return [];

  const topPatterns = cat.tagPatterns.slice(0, MAX_QUERIES_PER_CATEGORY - 1);

  const singleWordQueries = topPatterns.map((p) => normalizeTag(p).split(" ")[0]);

  const combinedQuery = topPatterns
    .slice(0, 3)
    .map((p) => normalizeTag(p))
    .join(" ");

  const queries = [...singleWordQueries, combinedQuery].filter(
    (q, i, arr) => arr.indexOf(q) === i,
  );

  return queries.slice(0, MAX_QUERIES_PER_CATEGORY);
}

async function probeCdpSearch(query: string): Promise<{
  resourceUrls: string[];
  searchMethod: string | null;
}> {
  const url = `${CDP_SEARCH_URL}?query=${encodeURIComponent(query)}&limit=${CDP_LIMIT}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[supplyGap] CDP search failed: ${res.status} for query "${query}"`);
      return { resourceUrls: [], searchMethod: null };
    }
    const data = (await res.json()) as CdpSearchResponse;
    const urls = (data.resources ?? [])
      .map((r) => r.resource)
      .filter((u): u is string => !!u);
    return {
      resourceUrls: urls,
      searchMethod: data.searchMethod ?? null,
    };
  } catch (err) {
    console.error(`[supplyGap] CDP search error for "${query}":`, err);
    return { resourceUrls: [], searchMethod: null };
  } finally {
    clearTimeout(timeout);
  }
}

interface CategoryMerchant {
  resourceUrl: string;
  serviceName: string | null;
  rankerScore: string;
  merchantId: string;
}

async function getCategoryMerchants(
  categoryId: string,
): Promise<CategoryMerchant[]> {
  const rows = await getDb()
    .select({
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
      rankerScore: merchants.rankerScore,
      merchantId: resources.merchantId,
    })
    .from(resources)
    .innerJoin(merchants, eq(resources.merchantId, merchants.id))
    .where(eq(merchants.categoryId, categoryId));

  const seen = new Set<string>();
  const unique: CategoryMerchant[] = [];
  for (const r of rows) {
    if (!seen.has(r.resourceUrl)) {
      seen.add(r.resourceUrl);
      unique.push({
        resourceUrl: r.resourceUrl,
        serviceName: r.serviceName,
        rankerScore: String(r.rankerScore ?? "0"),
        merchantId: r.merchantId,
      });
    }
  }
  return unique;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "").toLowerCase();
}

export async function refreshSupplyGap(): Promise<number> {
  const allCategories = await getDb()
    .select()
    .from(categories)
    .where(sql`${categories.merchantCount} > ${MIN_MERCHANT_COUNT}`);

  console.log(
    `[supplyGap] Analyzing ${allCategories.length} categories with > ${MIN_MERCHANT_COUNT} merchants`,
  );

  let refreshedCount = 0;

  for (const cat of allCategories) {
    const queries = generateQueries(cat.slug);
    if (queries.length === 0) {
      console.log(`[supplyGap] No queries for ${cat.name} — skipping`);
      continue;
    }

    const categoryMerchants = await getCategoryMerchants(cat.id);
    const categoryMerchantCount = categoryMerchants.length;

    if (categoryMerchantCount === 0) {
      console.log(`[supplyGap] No merchants in ${cat.name} — skipping`);
      continue;
    }

    const perQuery: SupplyGapQueryResult[] = [];
    const allBuriedMerchantIds = new Set<string>();

    for (const query of queries) {
      await sleep(PROBE_DELAY_MS);

      const cdpResult = await probeCdpSearch(query);
      const cdpUrlsSet = new Set(cdpResult.resourceUrls.map(normalizeUrl));

      const buried = categoryMerchants.filter(
        (m) => !cdpUrlsSet.has(normalizeUrl(m.resourceUrl)),
      );

      for (const b of buried) {
        allBuriedMerchantIds.add(b.merchantId);
      }

      const gapRatio = categoryMerchantCount > 0
        ? buried.length / categoryMerchantCount
        : 0;

      perQuery.push({
        query,
        cdpResults: cdpResult.resourceUrls.length,
        cdpResourceUrls: cdpResult.resourceUrls.slice(0, 10),
        categoryMerchantCount,
        buriedCount: buried.length,
        gapRatio: Math.round(gapRatio * 10000) / 10000,
        buriedSample: buried
          .sort((a, b) => Number(b.rankerScore) - Number(a.rankerScore))
          .slice(0, 10)
          .map((b) => ({
            resourceUrl: b.resourceUrl,
            serviceName: b.serviceName,
            rankerScore: Number(b.rankerScore),
          })),
      });
    }

    const averageGapRatio =
      perQuery.reduce((sum, q) => sum + q.gapRatio, 0) /
      Math.max(perQuery.length, 1);

    const buriedMerchantCount = allBuriedMerchantIds.size;

    console.log(
      `[supplyGap] ${cat.name}: ${categoryMerchantCount} merchants, avg gap ${Math.round(averageGapRatio * 100)}%, ${buriedMerchantCount} buried across queries`,
    );

    await getDb()
      .insert(supplyGapCache)
      .values({
        categoryName: cat.name,
        perQuery,
        averageGapRatio: averageGapRatio.toFixed(4),
        buriedMerchantCount,
        totalCategoryMerchants: categoryMerchantCount,
        refreshedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supplyGapCache.categoryName,
        set: {
          perQuery: sql`excluded.per_query`,
          averageGapRatio: sql`excluded.average_gap_ratio`,
          buriedMerchantCount: sql`excluded.buried_merchant_count`,
          totalCategoryMerchants: sql`excluded.total_category_merchants`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      });

    refreshedCount++;
  }

  console.log(`[supplyGap] Refreshed ${refreshedCount} categories`);
  return refreshedCount;
}

export async function getSupplyGapForCategory(
  categoryName: string,
  merchantResourceUrls: string[],
): Promise<SupplyGapData | null> {
  const [row] = await getDb()
    .select()
    .from(supplyGapCache)
    .where(eq(supplyGapCache.categoryName, categoryName))
    .limit(1);

  if (!row) return null;

  const perQuery = (row.perQuery ?? []) as SupplyGapQueryResult[];

  const normalizedMerchantUrls = new Set(merchantResourceUrls.map(normalizeUrl));
  const merchantIsBuried = perQuery.some((q) =>
    q.buriedSample.some((b) =>
      normalizedMerchantUrls.has(normalizeUrl(b.resourceUrl)),
    ),
  );

  return {
    categoryName: row.categoryName,
    perQuery,
    averageGapRatio: Number(row.averageGapRatio ?? 0),
    totalBuriedMerchants: row.buriedMerchantCount ?? 0,
    totalCategoryMerchants: row.totalCategoryMerchants ?? 0,
    refreshedAt: row.refreshedAt.toISOString(),
    merchantIsBuried,
  };
}
