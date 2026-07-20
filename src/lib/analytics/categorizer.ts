import { getDb } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import type { Category } from "@/lib/types";

const UPDATE_CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

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
  const allCategories = await getDb().select().from(categories);
  const allMerchants = await getDb().select({ id: merchants.id }).from(merchants);
  const allResources = await getDb()
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

  // Group merchant ids by their assigned category, then issue one batched
  // UPDATE per category instead of one UPDATE per merchant.
  const merchantIdsByCategory = new Map<string, string[]>();
  let assigned = 0;
  for (const merchant of allMerchants) {
    const allTags = tagsByMerchant.get(merchant.id) ?? [];
    const categoryId = assignCategory(allTags, allCategories);
    if (categoryId) {
      const list = merchantIdsByCategory.get(categoryId) ?? [];
      list.push(merchant.id);
      merchantIdsByCategory.set(categoryId, list);
      assigned++;
    }
  }

  for (const [categoryId, merchantIds] of merchantIdsByCategory) {
    for (const batch of chunk(merchantIds, UPDATE_CHUNK_SIZE)) {
      await getDb()
        .update(merchants)
        .set({ categoryId })
        .where(inArray(merchants.id, batch));
    }
  }

  await getDb().execute(sql`
    UPDATE categories c
    SET merchant_count = (
      SELECT COUNT(*)
      FROM merchants m
      WHERE m.category_id = c.id
    )
  `);

  await getDb().execute(sql`
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
