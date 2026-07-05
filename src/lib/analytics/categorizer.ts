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
  let assigned = 0;

  for (const merchant of allMerchants) {
    const merchantResources = await db
      .select({ tags: resources.tags })
      .from(resources)
      .where(eq(resources.merchantId, merchant.id));

    const allTags: string[] = [];
    for (const r of merchantResources) {
      if (r.tags) allTags.push(...r.tags);
    }

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
