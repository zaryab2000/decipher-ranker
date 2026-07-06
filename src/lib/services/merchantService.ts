import { db } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import {
  getMerchantByOrigin,
  getMerchantByAddress,
  getMerchantData,
  computeScoreBreakdown,
} from "@/lib/analytics/ranker";

export async function searchMerchants(query: string, limit: number = 20) {
  const pattern = `%${query}%`;

  const matchingResources = await db
    .select({
      merchantId: resources.merchantId,
      resourceUrl: resources.resourceUrl,
      serviceName: resources.serviceName,
    })
    .from(resources)
    .where(
      or(
        ilike(resources.resourceUrl, pattern),
        ilike(resources.serviceName, pattern),
        ilike(resources.description, pattern),
      ),
    )
    .limit(limit * 2);

  const matchingMerchantsByAddress = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(ilike(merchants.payeeAddress, pattern))
    .limit(limit);

  const merchantIds = new Set<string>();
  for (const r of matchingResources) merchantIds.add(r.merchantId);
  for (const m of matchingMerchantsByAddress) merchantIds.add(m.id);

  const results = [];
  for (const id of [...merchantIds].slice(0, limit)) {
    const data = await getMerchantData(id);
    if (!data) continue;

    const firstResource = data.resources[0];
    results.push({
      payeeAddress: data.merchant.payeeAddress,
      origin: firstResource?.resourceUrl ?? data.merchant.payeeAddress,
      serviceName: firstResource?.serviceName ?? null,
      category: data.category?.name ?? null,
      chain: data.merchant.chain,
      rankerScore: Number(data.merchant.rankerScore ?? 0),
      rankPosition: data.merchant.rankPosition,
      priceUsd: firstResource ? Number(firstResource.priceUsd ?? 0) || null : null,
      txCount30d: data.merchant.txCount30d ?? 0,
      uniqueBuyers: data.merchant.uniqueBuyers ?? 0,
    });
  }

  return { merchants: results, total: results.length, query };
}

export async function getMerchantProfile(origin: string) {
  const data = await getMerchantByOrigin(origin);
  if (!data) return null;

  const breakdown = computeScoreBreakdown(data);

  const competitors = data.category
    ? await db
        .select()
        .from(merchants)
        .where(eq(merchants.categoryId, data.category.id))
        .orderBy(desc(merchants.rankerScore))
        .limit(6)
    : [];

  const competitorItems = [];
  for (const cm of competitors) {
    if (cm.id === data.merchant.id) continue;
    const cmResources = await db
      .select()
      .from(resources)
      .where(eq(resources.merchantId, cm.id))
      .limit(1);
    const firstRes = cmResources[0];
    competitorItems.push({
      payeeAddress: cm.payeeAddress,
      origin: firstRes?.resourceUrl ?? cm.payeeAddress,
      serviceName: firstRes?.serviceName ?? null,
      category: data.category?.name ?? null,
      chain: cm.chain,
      rankerScore: Number(cm.rankerScore ?? 0),
      rankPosition: cm.rankPosition,
      priceUsd: firstRes ? Number(firstRes.priceUsd ?? 0) || null : null,
      txCount30d: cm.txCount30d ?? 0,
      uniqueBuyers: cm.uniqueBuyers ?? 0,
    });
  }

  const firstResource = data.resources[0];

  const improvements = [];
  const descLen = data.resources.reduce(
    (sum, r) => sum + (r.description?.length ?? 0),
    0,
  );
  if (descLen === 0) {
    improvements.push({ priority: "high" as const, message: "Add a description to your service listing" });
  }
  const hasTags = data.resources.some((r) => r.tags && r.tags.length > 0);
  if (!hasTags) {
    improvements.push({ priority: "high" as const, message: "Add relevant tags to improve discoverability" });
  }
  if ((data.merchant.txCount30d ?? 0) < 10) {
    improvements.push({ priority: "medium" as const, message: "Increase transaction volume to improve your ranking" });
  }
  if ((data.merchant.buyers30d ?? 0) < 3) {
    improvements.push({ priority: "low" as const, message: "Diversify your buyer base for a higher diversity score" });
  }

  const allTags: string[] = [];
  for (const r of data.resources) {
    if (r.tags) allTags.push(...r.tags);
  }

  return {
    payeeAddress: data.merchant.payeeAddress,
    origin: firstResource?.resourceUrl ?? data.merchant.payeeAddress,
    serviceName: firstResource?.serviceName ?? null,
    category: data.category?.name ?? null,
    chain: data.merchant.chain,
    rankerScore: Number(data.merchant.rankerScore ?? 0),
    rankPosition: data.merchant.rankPosition,
    priceUsd: firstResource ? Number(firstResource.priceUsd ?? 0) || null : null,
    txCount30d: data.merchant.txCount30d ?? 0,
    uniqueBuyers: data.merchant.uniqueBuyers ?? 0,
    description: firstResource?.description ?? null,
    tags: [...new Set(allTags)],
    facilitator: data.merchant.facilitator,
    firstSeenAt: data.merchant.firstSeenAt.toISOString(),
    totalAmountUsd: Number(data.merchant.totalAmountUsd ?? 0),
    volume30d: Number(data.merchant.volume30d ?? 0),
    buyers30d: data.merchant.buyers30d ?? 0,
    scoreBreakdown: breakdown,
    competitors: competitorItems,
    improvements,
  };
}
