import { NextResponse } from "next/server";
import { fetchAllBazaarResources } from "@/lib/data-sources/bazaar";
import { upsertCatalog } from "@/lib/data-sources/catalog-sync";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const resources = await fetchAllBazaarResources();
    const result = await upsertCatalog(resources);

    return NextResponse.json({
      status: "ok",
      resources_fetched: resources.length,
      merchants_upserted: result.merchantsUpserted,
      resources_upserted: result.resourcesUpserted,
      categories_updated: result.categoriesUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 },
    );
  }
}
