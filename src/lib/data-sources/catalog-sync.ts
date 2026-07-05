import { db } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BazaarResource } from "@/lib/types";
import {
  extractPayeeAddress,
  extractPriceUsd,
  extractChain,
} from "./bazaar";

interface SyncResult {
  merchantsUpserted: number;
  resourcesUpserted: number;
  categoriesUpdated: number;
}

export async function upsertCatalog(
  bazaarResources: BazaarResource[],
): Promise<SyncResult> {
  const merchantMap = new Map<string, BazaarResource[]>();
  const tagSet = new Set<string>();

  for (const resource of bazaarResources) {
    const payee = extractPayeeAddress(resource);
    if (!payee) continue;

    if (!merchantMap.has(payee)) {
      merchantMap.set(payee, []);
    }
    merchantMap.get(payee)!.push(resource);

    for (const tag of resource.tags ?? []) {
      tagSet.add(tag);
    }
  }

  // Upsert categories from unique tags
  let categoriesUpdated = 0;
  for (const tag of tagSet) {
    await db
      .insert(categories)
      .values({ name: tag })
      .onConflictDoUpdate({
        target: categories.name,
        set: { merchantCount: 0 },
      });
    categoriesUpdated++;
  }

  // Upsert merchants
  let merchantsUpserted = 0;
  for (const [payee, payeeResources] of merchantMap) {
    const chain = extractChain(payeeResources[0]);

    const totalL30dCalls = payeeResources.reduce(
      (sum, r) => sum + (r.quality?.l30DaysTotalCalls ?? 0),
      0,
    );
    const totalL30dPayers = payeeResources.reduce(
      (sum, r) => sum + (r.quality?.l30DaysUniquePayers ?? 0),
      0,
    );

    await db
      .insert(merchants)
      .values({
        payeeAddress: payee,
        chain,
        facilitator: null,
        txCount30d: totalL30dCalls,
        buyers30d: totalL30dPayers,
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: merchants.payeeAddress,
        set: {
          chain,
          txCount30d: totalL30dCalls,
          buyers30d: totalL30dPayers,
          lastUpdated: new Date(),
        },
      });

    merchantsUpserted++;
  }

  // Upsert resources
  let resourcesUpserted = 0;
  for (const resource of bazaarResources) {
    const payee = extractPayeeAddress(resource);
    if (!payee) continue;

    const [merchant] = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.payeeAddress, payee))
      .limit(1);

    if (!merchant) continue;

    const priceUsd = extractPriceUsd(resource);
    const chain = extractChain(resource);

    await db
      .insert(resources)
      .values({
        resourceUrl: resource.resource,
        merchantId: merchant.id,
        serviceName: resource.serviceName,
        description: resource.description,
        tags: resource.tags,
        priceUsd: priceUsd?.toString(),
        chain,
        l30dCalls: resource.quality?.l30DaysTotalCalls,
        l30dUniquePayers: resource.quality?.l30DaysUniquePayers,
        lastCalledAt: resource.quality?.lastCalledAt
          ? new Date(resource.quality.lastCalledAt)
          : null,
        lastUpdated: new Date(),
      })
      .onConflictDoNothing();

    resourcesUpserted++;
  }

  // Update category merchant counts
  await db.execute(sql`
    UPDATE categories c
    SET merchant_count = (
      SELECT COUNT(DISTINCT m.id)
      FROM merchants m
      JOIN resources r ON r.merchant_id = m.id
      WHERE c.name = ANY(r.tags)
    )
  `);

  return { merchantsUpserted, resourcesUpserted, categoriesUpdated };
}
