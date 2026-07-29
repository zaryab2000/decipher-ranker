import { NextResponse } from "next/server";
import { fetchAllBazaarResources } from "@/lib/data-sources/bazaar";
import { upsertCatalog } from "@/lib/data-sources/catalog-sync";
import { assignAllMerchantCategories } from "@/lib/analytics/categorizer";
import { scoreAllMerchants } from "@/lib/analytics/ranker";
import { refreshCategoryCache } from "@/lib/services/categoryService";
import { writeDailySnapshot } from "@/lib/services/trendService";
import { refreshSupplyGap } from "@/lib/services/supplyGapService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const bazaarResources = await fetchAllBazaarResources();
    const syncResult = await upsertCatalog(bazaarResources);

    const categoriesAssigned = await assignAllMerchantCategories();
    const merchantsScored = await scoreAllMerchants();
    const categoriesCached = await refreshCategoryCache();
    const snapshotsWritten = await writeDailySnapshot();

    // Supply gap probes CDP search; never let it fail the whole cron run.
    let supplyGapRefreshed = 0;
    try {
      supplyGapRefreshed = await refreshSupplyGap();
    } catch (err) {
      console.error("[cron] Supply gap refresh failed:", err);
    }

    return NextResponse.json({
      status: "ok",
      resources_fetched: bazaarResources.length,
      merchants_upserted: syncResult.merchantsUpserted,
      resources_upserted: syncResult.resourcesUpserted,
      categories_updated: syncResult.categoriesUpdated,
      categories_assigned: categoriesAssigned,
      merchants_scored: merchantsScored,
      categories_cached: categoriesCached,
      snapshots_written: snapshotsWritten,
      supply_gap_refreshed: supplyGapRefreshed,
    });
  } catch (error) {
    console.error("Cron refresh-catalog error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
