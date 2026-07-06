import { NextRequest, NextResponse } from "next/server";
import { getMerchantByOrigin, computeBasicReport } from "@/lib/analytics/ranker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const origin = body.origin;

    if (!origin || typeof origin !== "string") {
      return NextResponse.json(
        { error: "Missing required field: origin (URL string)" },
        { status: 400 },
      );
    }

    const data = await getMerchantByOrigin(origin);
    if (!data) {
      return NextResponse.json({
        found: false,
        origin,
        message:
          "This origin is not yet indexed. It may take up to 24 hours after registration on x402scan to appear.",
      });
    }

    const report = await computeBasicReport(data);

    return NextResponse.json({
      found: true,
      origin,
      category: report.category,
      rank_position: report.rankPosition,
      total_competitors: report.totalCompetitors,
      price_position: report.pricePosition,
      description_quality: report.descriptionQuality,
      listing_completeness: report.listingCompleteness,
      tips: report.tips,
      last_updated: data.merchant.lastUpdated.toISOString(),
    });
  } catch (error) {
    console.error("Report origin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
