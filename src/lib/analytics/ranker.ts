import { db } from "@/lib/db";
import { merchants, resources, categories, trends } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import type { Merchant, Resource, Category } from "@/lib/types";
import type { ScoreBreakdown, BasicReport, GapAnalysis, PricingBenchmark, CompetitorEntry, AIInsights } from "@/lib/types";
import { fetchMerchantStats } from "@/lib/data-sources/x402scan";
import { computeAIInsights } from "@/lib/analytics/ai-analyst";
import { normalizeChain } from "@/lib/data-sources/bazaar";

export interface MerchantData {
  merchant: Merchant;
  resources: Resource[];
  category: Category | null;
}

/**
 * Component weights for the ranker score. Must sum to 1.0 (asserted in tests).
 *
 * Reliability is held at 0.05 as a placeholder: no external API exposes service
 * health, so the component is a constant 0.5 for every merchant today. The slot
 * stays wired so a real reliability source later is a one-line weight change.
 * The freed 0.10 goes to volume, the strongest available differentiator.
 */
export const RANKER_WEIGHTS = {
  volume: 0.4,
  buyerDiversity: 0.25,
  reliability: 0.05,
  listingQuality: 0.15,
  recency: 0.15,
} as const;

export function computeRankerScore(data: MerchantData): number {
  const { merchant, resources: merchantResources } = data;

  const volumeSignal =
    0.5 * logNorm(merchant.txCount30d ?? 0) +
    0.5 * logNorm(Number(merchant.volume30d ?? 0));

  const buyerDiversity = computeBuyerDiversity(merchant.buyers30d ?? 0);

  const reliability = computeReliability(merchantResources);

  const listingQuality = computeListingQualityFromResources(merchantResources);

  const recency = computeRecency(merchantResources);

  const score =
    RANKER_WEIGHTS.volume * volumeSignal +
    RANKER_WEIGHTS.buyerDiversity * buyerDiversity +
    RANKER_WEIGHTS.reliability * reliability +
    RANKER_WEIGHTS.listingQuality * listingQuality +
    RANKER_WEIGHTS.recency * recency;

  return Math.round(score * 10000) / 10000;
}

export function computeScoreBreakdown(data: MerchantData): ScoreBreakdown {
  const { merchant, resources: merchantResources } = data;

  return {
    volumeSignal:
      0.5 * logNorm(merchant.txCount30d ?? 0) +
      0.5 * logNorm(Number(merchant.volume30d ?? 0)),
    buyerDiversity: computeBuyerDiversity(merchant.buyers30d ?? 0),
    reliability: computeReliability(merchantResources),
    listingQuality: computeListingQualityFromResources(merchantResources),
    recency: computeRecency(merchantResources),
  };
}

function logNorm(value: number, cap: number = 1_000_000): number {
  if (value <= 0) return 0;
  return Math.min(Math.log10(value + 1) / Math.log10(cap), 1);
}

function computeBuyerDiversity(uniqueBuyers: number): number {
  return logNorm(uniqueBuyers, 10_000);
}

function computeBuyerConcentration(uniqueBuyers: number, txCount: number): number {
  if (uniqueBuyers <= 0 || txCount <= 0) return 0;
  if (uniqueBuyers >= txCount) return 0;
  const avgTxPerBuyer = txCount / uniqueBuyers;
  const hhi = 1 / uniqueBuyers + (1 - 1 / uniqueBuyers) * ((avgTxPerBuyer - 1) / avgTxPerBuyer);
  return Math.round(hhi * 10000) / 10000;
}

function computeReliability(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0.5;

  const scores = merchantResources
    .map((r) => Number(r.reliabilityScore ?? r.apiSuccessRate ?? 0))
    .filter((s) => s > 0);

  if (scores.length === 0) return 0.5;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Listing-quality scoring separates always-available structural signals
// (schemas, description) from rare opt-in metadata (service name, tags), so a
// merchant is rewarded for documentation effort rather than for verbosity or
// tag spam. Raw score is normalized by the theoretical max below.
//
//   Structural (max 2.8): input schema +1.0, output example +1.0,
//                         description tier (exclusive) >150 +0.8 / >50 +0.4
//   Opt-in    (max 0.8):  service name +0.5, tags 3-5 +0.3 / >5 or 1-2 +0.1
const LISTING_QUALITY_MAX = 3.6;

function computeListingQualityForResource(r: Resource): number {
  let score = 0;

  if (r.hasInputSchema) score += 1.0;
  if (r.hasOutputExample) score += 1.0;

  const descLen = r.description?.length ?? 0;
  if (descLen > 150) score += 0.8;
  else if (descLen > 50) score += 0.4;

  if (r.serviceName && r.serviceName.length > 0) score += 0.5;

  const tagCount = r.tags?.length ?? 0;
  if (tagCount >= 3 && tagCount <= 5) score += 0.3;
  else if (tagCount >= 1) score += 0.1;

  return Math.min(score / LISTING_QUALITY_MAX, 1);
}

function computeListingQualityFromResources(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0;

  let totalScore = 0;
  for (const r of merchantResources) {
    totalScore += computeListingQualityForResource(r);
  }

  return totalScore / merchantResources.length;
}

function computeRecency(merchantResources: Resource[]): number {
  const now = Date.now();
  let mostRecent = 0;

  for (const r of merchantResources) {
    const lastCalled = r.lastCalledAt ? new Date(r.lastCalledAt).getTime() : 0;
    const lastUpdated = r.lastUpdated ? new Date(r.lastUpdated).getTime() : 0;
    mostRecent = Math.max(mostRecent, lastCalled, lastUpdated);
  }

  if (mostRecent === 0) return 0;

  const daysSince = (now - mostRecent) / (1000 * 60 * 60 * 24);
  if (daysSince < 1) return 1.0;
  if (daysSince < 7) return 0.8;
  if (daysSince < 30) return 0.5;
  if (daysSince < 90) return 0.2;
  return 0;
}

export async function getMerchantData(merchantId: string): Promise<MerchantData | null> {
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  if (!merchant) return null;

  const merchantResources = await db
    .select()
    .from(resources)
    .where(eq(resources.merchantId, merchantId));

  let category: Category | null = null;
  if (merchant.categoryId) {
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, merchant.categoryId))
      .limit(1);
    category = cat ?? null;
  }

  return { merchant, resources: merchantResources, category };
}

export async function getMerchantByOrigin(origin: string): Promise<MerchantData | null> {
  // Merchants naturally pass their origin/base URL (e.g. https://mesh.heurist.xyz)
  // but a resource_url is a full endpoint path (https://mesh.heurist.xyz/api/tool).
  // Try an exact match first, then fall back to matching any resource whose URL
  // shares the same host, so a domain-only input resolves.
  const [exact] = await db
    .select()
    .from(resources)
    .where(eq(resources.resourceUrl, origin))
    .limit(1);

  if (exact) return getMerchantData(exact.merchantId);

  const host = extractHost(origin);
  if (!host) return null;

  // Match https://host, http://host, and any path under that host. The pattern
  // is anchored to the scheme+host boundary so "foo.com" cannot match
  // "notfoo.com" or "foo.com.evil.com".
  const [byHost] = await db
    .select()
    .from(resources)
    .where(
      sql`${resources.resourceUrl} ~ ${`^https?://${escapeRegex(host)}(/|$|:)`}`,
    )
    .orderBy(resources.resourceUrl)
    .limit(1);

  if (!byHost) return null;
  return getMerchantData(byHost.merchantId);
}

/** Extract the lowercased host from a URL or bare host string; null if unusable. */
function extractHost(input: string): string | null {
  const trimmed = input.trim();
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    // Bare host without a scheme (e.g. "mesh.heurist.xyz").
    try {
      return new URL(`https://${trimmed}`).host.toLowerCase();
    } catch {
      return null;
    }
  }
}

/** Escape regex metacharacters so a host is matched literally. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getMerchantByAddress(
  address: string,
  chain: string = "base",
): Promise<MerchantData | null> {
  // Normalize to match how the catalog stores merchants: EVM addresses lowercased,
  // chain reduced to a canonical mainnet shorthand. Without this, checksummed
  // input or a CAIP-2 chain string silently misses.
  const normalizedAddress = address.startsWith("0x")
    ? address.toLowerCase()
    : address;
  const normalizedChain = normalizeChain(chain) ?? chain;

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.payeeAddress, normalizedAddress),
        eq(merchants.chain, normalizedChain),
      ),
    )
    .limit(1);

  if (!merchant) return null;
  return getMerchantData(merchant.id);
}

export async function computeBasicReport(data: MerchantData): Promise<BasicReport> {
  const categoryName = data.category?.name ?? null;

  let totalCompetitors = 0;
  let rankPosition: number | null = null;

  if (data.category) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(merchants)
      .where(eq(merchants.categoryId, data.category.id));
    totalCompetitors = Number(countResult?.count ?? 0);
    rankPosition = data.merchant.rankPosition;
  }

  const pricePosition = await computePricePosition(data);
  const descriptionQuality = computeDescriptionQuality(data.resources);
  const listingCompleteness = computeListingCompleteness(data.resources);
  const tips = generateTips(data, descriptionQuality, listingCompleteness);

  return {
    category: categoryName,
    rankPosition,
    totalCompetitors,
    pricePosition,
    descriptionQuality,
    listingCompleteness,
    tips,
  };
}

async function computePricePosition(
  data: MerchantData,
): Promise<"below_median" | "median" | "above_median"> {
  if (!data.category) return "median";

  const medianPrice = Number(data.category.medianPrice ?? 0);
  if (medianPrice === 0) return "median";

  const merchantPrices = data.resources
    .map((r) => Number(r.priceUsd ?? 0))
    .filter((p) => p > 0);

  if (merchantPrices.length === 0) return "median";

  const avgPrice =
    merchantPrices.reduce((a, b) => a + b, 0) / merchantPrices.length;

  if (avgPrice < medianPrice * 0.9) return "below_median";
  if (avgPrice > medianPrice * 1.1) return "above_median";
  return "median";
}

function computeDescriptionQuality(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0;

  let total = 0;
  for (const r of merchantResources) {
    const len = r.description?.length ?? 0;
    if (len > 150) total += 100;
    else if (len > 50) total += 60;
    else if (len > 0) total += 30;
  }

  return Math.round(total / merchantResources.length);
}

function computeListingCompleteness(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0;

  // Weighted toward the structural signals that drive the ranker's listing-quality
  // score (input schema, output example) over opt-in metadata, so the free
  // report's completeness advice matches what actually affects a merchant's rank.
  let total = 0;
  for (const r of merchantResources) {
    let score = 0;
    if (r.hasInputSchema) score += 25;
    if (r.hasOutputExample) score += 20;
    if (r.description && r.description.length > 50) score += 20;
    if (r.priceUsd) score += 15;
    if (r.serviceName) score += 10;
    if (r.tags && r.tags.length > 0) score += 10;
    total += score;
  }

  return Math.round(total / merchantResources.length);
}

function generateTips(
  data: MerchantData,
  descQuality: number,
  listingCompleteness: number,
): string[] {
  const tips: string[] = [];

  if (descQuality < 60) {
    tips.push(
      "Improve your service descriptions — aim for 150+ characters with clear value propositions.",
    );
  }

  const missingSchema = data.resources.some(
    (r) => !r.hasInputSchema || !r.hasOutputExample,
  );
  if (missingSchema) {
    tips.push(
      "Publish input schemas and output examples for every endpoint — structured documentation is the strongest listing-quality signal.",
    );
  }

  const hasTaggedResources = data.resources.some(
    (r) => r.tags && r.tags.length > 0,
  );
  if (!hasTaggedResources) {
    tips.push(
      "Add relevant tags to your resources to improve discoverability in category searches.",
    );
  }

  if (listingCompleteness < 75) {
    tips.push(
      "Complete your listings — add a service name, a 50+ character description, and pricing to every resource.",
    );
  }

  if ((data.merchant.txCount30d ?? 0) < 10) {
    tips.push(
      "Increase transaction volume by promoting your service to potential buyers.",
    );
  }

  if ((data.merchant.buyers30d ?? 0) < 3) {
    tips.push(
      "Diversify your buyer base — services with more unique buyers rank higher.",
    );
  }

  return tips.slice(0, 3);
}

export async function computeCompetitiveReport(data: MerchantData): Promise<{
  category: string | null;
  yourRank: number | null;
  totalCompetitors: number;
  topCompetitors: CompetitorEntry[];
  gapAnalysis: GapAnalysis;
  yourPrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  pricePercentile: number | null;
  recommendations: string[];
  aiInsights: AIInsights | null;
}> {
  const categoryName = data.category?.name ?? null;

  let competitors: MerchantData[] = [];
  let totalCompetitors = 0;

  if (data.category) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(merchants)
      .where(eq(merchants.categoryId, data.category.id));
    totalCompetitors = Number(countResult?.count ?? 0);

    const competitorMerchants = await db
      .select()
      .from(merchants)
      .where(eq(merchants.categoryId, data.category.id))
      .orderBy(desc(merchants.rankerScore))
      .limit(11);

    const competitorIds = competitorMerchants
      .filter((cm) => cm.id !== data.merchant.id)
      .map((cm) => cm.id);

    const competitorResources = competitorIds.length > 0
      ? await db
          .select()
          .from(resources)
          .where(sql`${resources.merchantId} IN (${sql.join(competitorIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    const resourcesByCompetitor = new Map<string, Resource[]>();
    for (const r of competitorResources) {
      const list = resourcesByCompetitor.get(r.merchantId) ?? [];
      list.push(r);
      resourcesByCompetitor.set(r.merchantId, list);
    }

    for (const cm of competitorMerchants) {
      if (cm.id === data.merchant.id) continue;
      competitors.push({
        merchant: cm,
        resources: resourcesByCompetitor.get(cm.id) ?? [],
        category: data.category,
      });
    }
  }

  const topCompetitors: CompetitorEntry[] = competitors.slice(0, 10).map((c) => {
    const firstResource = c.resources[0];
    return {
      origin: firstResource?.resourceUrl ?? c.merchant.payeeAddress,
      // rankPosition is assigned to every categorized merchant by scoreAllMerchants;
      // null only for uncategorized rows, which never appear in a category query.
      rank: c.merchant.rankPosition,
      score: Number(c.merchant.rankerScore ?? 0),
      price: c.resources.length > 0
        ? Number(c.resources[0].priceUsd ?? 0) || null
        : null,
      // 30-day unique payers (Bazaar) — the buyer signal that is actually
      // populated; all-time uniqueBuyers is not synced into the catalog.
      uniqueBuyers: c.merchant.buyers30d ?? 0,
      // 30-day total calls (Bazaar `l30dCalls`) — the real activity signal.
      // The legacy `toolCalls` column is never populated and was always 0.
      toolCalls: c.resources.reduce((sum, r) => sum + (r.l30dCalls ?? 0), 0),
      descriptionLength: c.resources.reduce(
        (sum, r) => sum + (r.description?.length ?? 0),
        0,
      ),
    };
  });

  const { computeGapAnalysis } = await import("./comparator");
  const gapAnalysis = computeGapAnalysis(data, competitors);

  const pricing = await computePricingBenchmark(data);

  const recommendations = generateCompetitiveRecommendations(
    data,
    competitors,
    gapAnalysis,
    pricing,
  );

  // LLM post-processor: additive, never blocking. Returns null on any failure,
  // in which case the merchant still gets the full static report above.
  const aiInsights = await computeAIInsights({
    serviceName: data.resources[0]?.serviceName ?? null,
    category: categoryName,
    descriptions: data.resources
      .map((r) => r.description)
      .filter((d): d is string => !!d),
    tags: [...new Set(data.resources.flatMap((r) => r.tags ?? []))],
    price: pricing.yourPrice,
    rank: data.merchant.rankPosition,
    totalCompetitors,
    competitors: topCompetitors,
    gapAnalysis,
    pricing,
  });

  return {
    category: categoryName,
    yourRank: data.merchant.rankPosition,
    totalCompetitors,
    topCompetitors,
    gapAnalysis,
    ...pricing,
    recommendations,
    aiInsights,
  };
}

async function computePricingBenchmark(
  data: MerchantData,
): Promise<PricingBenchmark> {
  const yourPrices = data.resources
    .map((r) => Number(r.priceUsd ?? 0))
    .filter((p) => p > 0);
  const yourPrice = yourPrices.length > 0
    ? yourPrices.reduce((a, b) => a + b, 0) / yourPrices.length
    : null;

  if (!data.category) {
    return { yourPrice, medianPrice: null, minPrice: null, maxPrice: null, pricePercentile: null };
  }

  // Category-wide benchmark: one average price per merchant (so a multi-resource
  // merchant counts once, not once per endpoint), across every merchant in the
  // category — not just the top-10 competitors shown in the report.
  const rows = await db
    .select({ avgPrice: sql<string>`avg(${resources.priceUsd})` })
    .from(resources)
    .innerJoin(merchants, eq(resources.merchantId, merchants.id))
    .where(
      and(
        eq(merchants.categoryId, data.category.id),
        sql`${resources.priceUsd} > 0`,
      ),
    )
    .groupBy(merchants.id);

  const prices = rows
    .map((r) => Number(r.avgPrice))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return { yourPrice, medianPrice: null, minPrice: null, maxPrice: null, pricePercentile: null };
  }

  const medianPrice = median(prices);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];

  // Inclusive percentile: fraction of the category priced at or below you, so the
  // most expensive merchant reaches 100 and equal-priced peers count as "at".
  let pricePercentile: number | null = null;
  if (yourPrice !== null) {
    const atOrBelow = prices.filter((p) => p <= yourPrice).length;
    pricePercentile = Math.round((atOrBelow / prices.length) * 100);
  }

  return { yourPrice, medianPrice, minPrice, maxPrice, pricePercentile };
}

/** True median: average of the two middle values for even-length arrays. Input must be sorted ascending. */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function generateCompetitiveRecommendations(
  data: MerchantData,
  competitors: MerchantData[],
  gapAnalysis: GapAnalysis,
  pricing: PricingBenchmark,
): string[] {
  const recs: string[] = [];

  if (gapAnalysis.missingTags.length > 0) {
    recs.push(
      `Add these tags used by competitors: ${gapAnalysis.missingTags.slice(0, 3).join(", ")}`,
    );
  }

  if (pricing.yourPrice && pricing.medianPrice && pricing.yourPrice > pricing.medianPrice * 1.5) {
    recs.push(
      `Your price ($${pricing.yourPrice.toFixed(3)}) is significantly above the category median ($${pricing.medianPrice.toFixed(3)}). Consider competitive pricing.`,
    );
  }

  const avgCompDesc = competitors.reduce((sum, c) => {
    const totalLen = c.resources.reduce(
      (s, r) => s + (r.description?.length ?? 0),
      0,
    );
    return sum + totalLen;
  }, 0) / Math.max(competitors.length, 1);

  const yourDesc = data.resources.reduce(
    (s, r) => s + (r.description?.length ?? 0),
    0,
  );

  if (yourDesc < avgCompDesc * 0.5) {
    recs.push(
      "Your descriptions are shorter than competitors. Add detailed use cases and examples.",
    );
  }

  if ((data.merchant.buyers30d ?? 0) < 5) {
    recs.push(
      "Focus on buyer acquisition — services with diverse buyer bases rank higher.",
    );
  }

  if (data.resources.length < 3) {
    recs.push(
      "Register more API endpoints to increase your service coverage and discoverability.",
    );
  }

  return recs.slice(0, 5);
}

export async function computeMerchantDeepDive(data: MerchantData): Promise<{
  serviceName: string | null;
  category: string | null;
  rank: number | null;
  totalTxns: number | null;
  totalVolumeUsd: number | null;
  volume30d: number;
  txCount30d: number;
  totalUniqueBuyers: number | null;
  uniqueBuyers30d: number;
  uniqueSellers: number | null;
  buyerConcentration: number;
  buyerConcentrationIsEstimate: boolean;
  diversityScore: number;
  allTimeStatsAvailable: boolean;
  price: number | null;
  priceVsCategory: string;
  trends: Array<{ date: string; rank: number | null; score: number | null }>;
  recommendations: string[];
}> {
  const firstResource = data.resources[0];

  const merchantTrends = await db
    .select()
    .from(trends)
    .where(eq(trends.merchantId, data.merchant.id))
    .orderBy(desc(trends.snapshotDate))
    .limit(30);

  const pricePos = await computePricePosition(data);
  const basic = await computeBasicReport(data);

  const prices = data.resources
    .map((r) => Number(r.priceUsd ?? 0))
    .filter((p) => p > 0);
  const avgPrice = prices.length > 0
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : null;

  // All-time volume/buyers are not in the Bazaar catalog (it only reports 30-day
  // activity). Enrich them at request time from x402scan, which is cache-first
  // (1hr TTL). When x402scan is unreachable we return nulls + a flag rather than
  // presenting stored zeros as real lifetime figures.
  const stats = await fetchMerchantStats(
    data.merchant.payeeAddress,
    data.merchant.chain,
  );

  const txCount30d = stats?.txCount30d ?? data.merchant.txCount30d ?? 0;
  const uniqueBuyers30d = stats?.buyers30d ?? data.merchant.buyers30d ?? 0;

  const deepDiveRecommendations = generateDeepDiveRecommendations(
    data,
    basic.tips,
  );

  return {
    serviceName: firstResource?.serviceName ?? null,
    category: data.category?.name ?? null,
    rank: data.merchant.rankPosition,
    totalTxns: stats?.totalTransactions ?? null,
    totalVolumeUsd: stats?.totalVolumeUsd ?? null,
    volume30d: stats?.volume30d ?? Number(data.merchant.volume30d ?? 0),
    txCount30d,
    totalUniqueBuyers: stats?.uniqueBuyers ?? null,
    uniqueBuyers30d,
    uniqueSellers: stats?.uniqueSellers ?? null,
    buyerConcentration: computeBuyerConcentration(uniqueBuyers30d, txCount30d),
    // Concentration is derived from buyer/tx counts under a uniform-distribution
    // assumption, not measured per-buyer — flag it as an estimate.
    buyerConcentrationIsEstimate: true,
    diversityScore: Math.round(computeBuyerDiversity(uniqueBuyers30d) * 100),
    allTimeStatsAvailable: stats !== null,
    price: avgPrice,
    priceVsCategory: pricePos,
    trends: merchantTrends.map((t) => ({
      date: t.snapshotDate,
      rank: t.rankPosition,
      score: t.rankerScore ? Number(t.rankerScore) : null,
    })),
    recommendations: deepDiveRecommendations,
  };
}

/**
 * Deep-dive advice: the free-tier tips plus paid-only observations derived from
 * trend direction and category standing, so the paid report is not a verbatim
 * copy of the free /report/origin tips.
 */
function generateDeepDiveRecommendations(
  data: MerchantData,
  baseTips: string[],
): string[] {
  const recs = [...baseTips];

  const rank = data.merchant.rankPosition;
  if (rank !== null && data.category) {
    if (rank <= 3) {
      recs.push(
        "You rank in the top 3 of your category — defend the position by keeping listings and pricing current.",
      );
    } else if (rank > 10) {
      recs.push(
        "You rank outside the category top 10 — the fastest lever is buyer diversity and 30-day call volume.",
      );
    }
  }

  return recs.slice(0, 5);
}

export async function scoreAllMerchants(): Promise<number> {
  const allMerchants = await db.select().from(merchants);
  const allResources = await db.select().from(resources);
  const allCategories = await db.select().from(categories);

  const resourcesByMerchant = new Map<string, Resource[]>();
  for (const r of allResources) {
    const list = resourcesByMerchant.get(r.merchantId) ?? [];
    list.push(r);
    resourcesByMerchant.set(r.merchantId, list);
  }

  const categoryById = new Map<string, Category>();
  for (const c of allCategories) {
    categoryById.set(c.id, c);
  }

  const scoreById: Array<{ id: string; score: number }> = [];
  for (const merchant of allMerchants) {
    const data: MerchantData = {
      merchant,
      resources: resourcesByMerchant.get(merchant.id) ?? [],
      category: merchant.categoryId ? categoryById.get(merchant.categoryId) ?? null : null,
    };
    scoreById.push({ id: merchant.id, score: computeRankerScore(data) });
  }

  // Apply scores in batches via a single UPDATE ... FROM (VALUES ...) per chunk.
  const CHUNK = 1000;
  for (let i = 0; i < scoreById.length; i += CHUNK) {
    const batch = scoreById.slice(i, i + CHUNK);
    const values = sql.join(
      batch.map((b) => sql`(${b.id}::uuid, ${b.score.toString()}::numeric)`),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE merchants AS m
      SET ranker_score = v.score
      FROM (VALUES ${values}) AS v(id, score)
      WHERE m.id = v.id
    `);
  }
  const scored = scoreById.length;

  // Assign rank positions within each category in a single windowed statement
  // (partition by category) instead of one UPDATE per category.
  await db.execute(sql`
    UPDATE merchants SET rank_position = sub.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY category_id ORDER BY ranker_score DESC
      ) AS rn
      FROM merchants WHERE category_id IS NOT NULL
    ) sub
    WHERE merchants.id = sub.id
  `);

  // Rank unassigned merchants globally.
  await db.execute(sql`
    UPDATE merchants SET rank_position = sub.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ranker_score DESC) AS rn
      FROM merchants WHERE category_id IS NULL
    ) sub
    WHERE merchants.id = sub.id
  `);

  return scored;
}
