import { db } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { Category } from "@/lib/types";

export function assignCategory(
  tags: string[],
  allCategories: Category[],
): string | null {
  if (!tags || tags.length === 0) return null;

  for (const tag of tags) {
    const match = allCategories.find(
      (c) => c.name.toLowerCase() === tag.toLowerCase(),
    );
    if (match) return match.id;
  }

  return null;
}

export async function assignAllMerchantCategories(): Promise<number> {
  const allCategories = await db.select().from(categories);
  const allMerchants = await db.select({ id: merchants.id }).from(merchants);
  const allResources = await db
    .select({ merchantId: resources.merchantId, tags: resources.tags })
    .from(resources);

  const tagsByMerchant = new Map<string, string[]>();
  for (const r of allResources) {
    if (r.tags) {
      const existing = tagsByMerchant.get(r.merchantId) ?? [];
      existing.push(...r.tags);
      tagsByMerchant.set(r.merchantId, existing);
    }
  }

  let assigned = 0;
  for (const merchant of allMerchants) {
    const allTags = tagsByMerchant.get(merchant.id) ?? [];
    const categoryId = assignCategory(allTags, allCategories);
    if (categoryId) {
      await db
        .update(merchants)
        .set({ categoryId })
        .where(eq(merchants.id, merchant.id));
      assigned++;
    }
  }

  await db.execute(sql`
    UPDATE categories c
    SET merchant_count = (
      SELECT COUNT(*)
      FROM merchants m
      WHERE m.category_id = c.id
    )
  `);

  await db.execute(sql`
    UPDATE categories c
    SET median_price = (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.price_usd::numeric)
      FROM resources r
      JOIN merchants m ON r.merchant_id = m.id
      WHERE m.category_id = c.id AND r.price_usd IS NOT NULL
    )
  `);

  return assigned;
}
