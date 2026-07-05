import { db } from "@/lib/db";
import { merchants, resources, categories, trends } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import type { Merchant, Resource, Category } from "@/lib/types";
import type { ScoreBreakdown, BasicReport, GapAnalysis, PricingBenchmark, CompetitorEntry } from "@/lib/types";

export interface MerchantData {
  merchant: Merchant;
  resources: Resource[];
  category: Category | null;
}

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
    0.3 * volumeSignal +
    0.25 * buyerDiversity +
    0.15 * reliability +
    0.15 * listingQuality +
    0.15 * recency;

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

function computeReliability(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0.5;

  const scores = merchantResources
    .map((r) => Number(r.reliabilityScore ?? r.apiSuccessRate ?? 0))
    .filter((s) => s > 0);

  if (scores.length === 0) return 0.5;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function computeListingQualityFromResources(merchantResources: Resource[]): number {
  if (merchantResources.length === 0) return 0;

  let totalScore = 0;
  for (const r of merchantResources) {
    let score = 0;
    const descLen = r.description?.length ?? 0;
    if (descLen > 150) score += 1.0;
    else if (descLen > 50) score += 0.6;
    else if (descLen > 0) score += 0.3;

    if (r.tags && r.tags.length > 0) score += 0.2;

    totalScore += Math.min(score / 1.2, 1);
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
  const [resource] = await db
    .select()
    .from(resources)
    .where(eq(resources.resourceUrl, origin))
    .limit(1);

  if (!resource) return null;
  return getMerchantData(resource.merchantId);
}

export async function getMerchantByAddress(
  address: string,
  chain: string = "base",
): Promise<MerchantData | null> {
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(
      and(eq(merchants.payeeAddress, address), eq(merchants.chain, chain)),
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

  let total = 0;
  for (const r of merchantResources) {
    let score = 0;
    if (r.description && r.description.length > 0) score += 25;
    if (r.serviceName) score += 25;
    if (r.tags && r.tags.length > 0) score += 25;
    if (r.priceUsd) score += 25;
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
      "Complete your listings — add service names, descriptions, and pricing to all resources.",
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

    for (const cm of competitorMerchants) {
      if (cm.id === data.merchant.id) continue;
      const cmResources = await db
        .select()
        .from(resources)
        .where(eq(resources.merchantId, cm.id));
      competitors.push({
        merchant: cm,
        resources: cmResources,
        category: data.category,
      });
    }
  }

  const topCompetitors: CompetitorEntry[] = competitors.slice(0, 10).map((c, i) => {
    const firstResource = c.resources[0];
    return {
      origin: firstResource?.resourceUrl ?? c.merchant.payeeAddress,
      rank: c.merchant.rankPosition ?? i + 1,
      score: Number(c.merchant.rankerScore ?? 0),
      price: c.resources.length > 0
        ? Number(c.resources[0].priceUsd ?? 0) || null
        : null,
      uniqueBuyers: c.merchant.uniqueBuyers ?? 0,
      toolCalls: c.resources.reduce((sum, r) => sum + (r.toolCalls ?? 0), 0),
      descriptionLength: c.resources.reduce(
        (sum, r) => sum + (r.description?.length ?? 0),
        0,
      ),
    };
  });

  const { computeGapAnalysis } = await import("./comparator");
  const gapAnalysis = computeGapAnalysis(data, competitors);

  const pricing = await computePricingBenchmark(data, competitors);

  const recommendations = generateCompetitiveRecommendations(
    data,
    competitors,
    gapAnalysis,
    pricing,
  );

  return {
    category: categoryName,
    yourRank: data.merchant.rankPosition,
    totalCompetitors,
    topCompetitors,
    gapAnalysis,
    ...pricing,
    recommendations,
  };
}

async function computePricingBenchmark(
  data: MerchantData,
  competitors: MerchantData[],
): Promise<PricingBenchmark> {
  const yourPrices = data.resources
    .map((r) => Number(r.priceUsd ?? 0))
    .filter((p) => p > 0);
  const yourPrice = yourPrices.length > 0
    ? yourPrices.reduce((a, b) => a + b, 0) / yourPrices.length
    : null;

  const allPrices: number[] = [];
  for (const c of competitors) {
    for (const r of c.resources) {
      const p = Number(r.priceUsd ?? 0);
      if (p > 0) allPrices.push(p);
    }
  }

  if (allPrices.length === 0) {
    return {
      yourPrice,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      pricePercentile: null,
    };
  }

  allPrices.sort((a, b) => a - b);
  const medianPrice = allPrices[Math.floor(allPrices.length / 2)];
  const minPrice = allPrices[0];
  const maxPrice = allPrices[allPrices.length - 1];

  let pricePercentile: number | null = null;
  if (yourPrice !== null) {
    const belowCount = allPrices.filter((p) => p < yourPrice).length;
    pricePercentile = Math.round((belowCount / allPrices.length) * 100);
  }

  return { yourPrice, medianPrice, minPrice, maxPrice, pricePercentile };
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
  totalTxns: number;
  totalVolumeUsd: number;
  volume30d: number;
  txCount30d: number;
  totalUniqueBuyers: number;
  uniqueBuyers30d: number;
  buyerConcentration: number;
  diversityScore: number;
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

  return {
    serviceName: firstResource?.serviceName ?? null,
    category: data.category?.name ?? null,
    rank: data.merchant.rankPosition,
    totalTxns: data.merchant.txCount ?? 0,
    totalVolumeUsd: Number(data.merchant.totalAmountUsd ?? 0),
    volume30d: Number(data.merchant.volume30d ?? 0),
    txCount30d: data.merchant.txCount30d ?? 0,
    totalUniqueBuyers: data.merchant.uniqueBuyers ?? 0,
    uniqueBuyers30d: data.merchant.buyers30d ?? 0,
    buyerConcentration: 0,
    diversityScore: Math.round(computeBuyerDiversity(data.merchant.buyers30d ?? 0) * 100),
    price: avgPrice,
    priceVsCategory: pricePos,
    trends: merchantTrends.map((t) => ({
      date: t.snapshotDate,
      rank: t.rankPosition,
      score: t.rankerScore ? Number(t.rankerScore) : null,
    })),
    recommendations: basic.tips,
  };
}

export async function scoreAllMerchants(): Promise<number> {
  const allMerchants = await db.select().from(merchants);
  let scored = 0;

  for (const merchant of allMerchants) {
    const data = await getMerchantData(merchant.id);
    if (!data) continue;

    const score = computeRankerScore(data);

    await db
      .update(merchants)
      .set({ rankerScore: score.toString() })
      .where(eq(merchants.id, merchant.id));

    scored++;
  }

  // Assign rank positions per category
  const allCategories = await db.select().from(categories);
  for (const cat of allCategories) {
    const categoryMerchants = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.categoryId, cat.id))
      .orderBy(desc(merchants.rankerScore));

    for (let i = 0; i < categoryMerchants.length; i++) {
      await db
        .update(merchants)
        .set({ rankPosition: i + 1 })
        .where(eq(merchants.id, categoryMerchants[i].id));
    }
  }

  // Also rank unassigned merchants globally
  const unranked = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(sql`${merchants.categoryId} IS NULL`)
    .orderBy(desc(merchants.rankerScore));

  for (let i = 0; i < unranked.length; i++) {
    await db
      .update(merchants)
      .set({ rankPosition: i + 1 })
      .where(eq(merchants.id, unranked[i].id));
  }

  return scored;
}
