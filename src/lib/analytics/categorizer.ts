import { getDb } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { inArray, notInArray, sql } from "drizzle-orm";
import { TAXONOMY, OTHER, normalizeTag } from "@/lib/analytics/taxonomy";

const UPDATE_CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function tokens(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter(Boolean));
}

/**
 * Map a merchant's tags onto the curated taxonomy and return the winning
 * category slug. Never returns null: an unmatched merchant lands in OTHER.
 *
 * Match is hybrid token-based (see taxonomy PRD §3.2): a tag matches a pattern
 * when it equals the pattern exactly, or when every token of the pattern appears
 * in the tag's token set (so "real estate" matches "real-estate", and "ai"
 * matches "ai agent" but not "chain"). TAXONOMY order is the tie-breaker —
 * earlier categories win.
 */
export function assignCategory(tags: string[]): string {
  const normTags = (tags ?? []).map(normalizeTag).filter(Boolean);
  const tagTokenSets = normTags.map(tokens);

  for (const cat of TAXONOMY) {
    for (const pattern of cat.tagPatterns) {
      // Normalize the pattern here too, so matching is correct even if a future
      // pattern carries punctuation — rather than relying solely on the taxonomy
      // test's "patterns are pre-normalized" invariant.
      const patternTokens = tokens(normalizeTag(pattern));
      // An empty pattern would vacuously match every tag; skip it.
      if (patternTokens.size === 0) continue;
      // A tag matches when every pattern token is present in the tag's token set
      // (exact equality is just the case where the sets are identical).
      const hit = tagTokenSets.some((tagTokens) => {
        for (const pt of patternTokens) {
          if (!tagTokens.has(pt)) return false;
        }
        return true;
      });
      if (hit) return cat.slug;
    }
  }

  return OTHER.slug;
}

/**
 * Assign every merchant to exactly one taxonomy category and recompute
 * per-category aggregates. Reads the categorization rules from the in-memory
 * TAXONOMY constant; the `categories` table is only read to resolve slug → id
 * (it must already hold the taxonomy rows — seeded by upsertCatalog earlier in
 * the pipeline). Returns the number of merchants assigned (all of them).
 */
export async function assignAllMerchantCategories(): Promise<number> {
  const categoryRows = await getDb()
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const slugToId = new Map<string, string>();
  for (const c of categoryRows) {
    slugToId.set(c.slug, c.id);
  }

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
    const slug = assignCategory(allTags);
    const categoryId = slugToId.get(slug);
    if (!categoryId) {
      throw new Error(
        `Taxonomy category "${slug}" is not in the categories table. ` +
          `Seed the taxonomy (upsertCatalog) before categorizing.`,
      );
    }
    const list = merchantIdsByCategory.get(categoryId) ?? [];
    list.push(merchant.id);
    merchantIdsByCategory.set(categoryId, list);
    assigned++;
  }

  for (const [categoryId, merchantIds] of merchantIdsByCategory) {
    for (const batch of chunk(merchantIds, UPDATE_CHUNK_SIZE)) {
      await getDb()
        .update(merchants)
        .set({ categoryId })
        .where(inArray(merchants.id, batch));
    }
  }

  // Reconcile: now that every merchant points at a taxonomy category, delete any
  // leftover non-taxonomy rows (the old one-row-per-tag categories). Safe here —
  // no merchant references them anymore — where it would have hit the category_id
  // FK if run during catalog sync. Idempotent on a clean seed (nothing to delete).
  const keepSlugs = [...TAXONOMY, OTHER].map((c) => c.slug);
  await getDb().delete(categories).where(notInArray(categories.slug, keepSlugs));

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
