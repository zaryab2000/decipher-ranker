import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fetchAllBazaarResources } from "@/lib/data-sources/bazaar";
import { upsertCatalog } from "@/lib/data-sources/catalog-sync";
import { assignAllMerchantCategories } from "@/lib/analytics/categorizer";
import { scoreAllMerchants } from "@/lib/analytics/ranker";
import { refreshCategoryCache } from "@/lib/services/categoryService";
import { writeDailySnapshot } from "@/lib/services/trendService";

function log(message: string): void {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${message}`);
}

let startedAt = Date.now();

/**
 * Delete all catalog data so the pipeline rebuilds from scratch. Order respects
 * foreign keys; RESTART IDENTITY is harmless (all PKs are UUIDs).
 */
async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE trends, category_cache, reports, resources, merchants, categories RESTART IDENTITY CASCADE`,
  );
  log("Truncated all tables (fresh seed).");
}

/**
 * Run the full data pipeline the cron endpoint runs, but as a standalone
 * long-lived process that is not bound by an HTTP request timeout.
 *
 * @param fresh - When true, truncate every table first so the seed is a clean
 *   rebuild. When false, rely on the pipeline's upserts for an idempotent
 *   incremental refresh.
 */
export async function runPipeline(fresh: boolean): Promise<void> {
  startedAt = Date.now();
  log(fresh ? "Starting fresh seed…" : "Starting incremental refresh…");

  if (fresh) {
    await truncateAll();
  }

  log("Fetching catalog from Coinbase Bazaar API (this is the slow part, ~4 min)…");
  const bazaarResources = await fetchAllBazaarResources();
  log(`Fetched ${bazaarResources.length} resources from Bazaar.`);

  const syncResult = await upsertCatalog(bazaarResources);
  log(
    `Upserted ${syncResult.merchantsUpserted} merchants, ` +
      `${syncResult.resourcesUpserted} resources, ` +
      `${syncResult.categoriesUpdated} categories.`,
  );

  const categoriesAssigned = await assignAllMerchantCategories();
  log(`Assigned categories to ${categoriesAssigned} merchants.`);

  const merchantsScored = await scoreAllMerchants();
  log(`Scored ${merchantsScored} merchants and assigned rank positions.`);

  const categoriesCached = await refreshCategoryCache();
  log(`Refreshed cache for ${categoriesCached} categories.`);

  const snapshotsWritten = await writeDailySnapshot();
  log(`Wrote ${snapshotsWritten} daily trend snapshots.`);

  log("Pipeline complete.");
}

/**
 * Entry-point wrapper shared by seed-from-bazaar.ts and refresh-catalog.ts.
 * Exits non-zero on any failure so CI/cron can detect it.
 */
export async function main(fresh: boolean): Promise<void> {
  try {
    await runPipeline(fresh);
    process.exit(0);
  } catch (error) {
    console.error("Pipeline failed:", error);
    process.exit(1);
  }
}
