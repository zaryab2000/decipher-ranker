import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import {
  getMerchantByOrigin,
  computeCompetitiveReport,
} from "@/lib/analytics/ranker";
import { REPORT_COST_USDC } from "@/lib/config";

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
        message:
          "Origin not found in index. Try the free /report/origin endpoint first.",
      });
    }

    const report = await computeCompetitiveReport(data);

    await db.insert(reports).values({
      requesterWallet: body.wallet ?? "anonymous",
      reportType: "competitive",
      inputParams: { origin },
      costUsdc: REPORT_COST_USDC,
    });

    return NextResponse.json({
      found: true,
      origin,
      category: report.category,
      your_rank: report.yourRank,
      total_competitors: report.totalCompetitors,
      competitors: report.topCompetitors.slice(0, 10).map((c) => ({
        origin: c.origin,
        rank: c.rank,
        score: c.score,
        price: c.price,
        unique_buyers: c.uniqueBuyers,
        tool_calls: c.toolCalls,
        description_length: c.descriptionLength,
      })),
      gap_analysis: report.gapAnalysis,
      pricing_benchmark: {
        your_price: report.yourPrice,
        category_median: report.medianPrice,
        category_min: report.minPrice,
        category_max: report.maxPrice,
        percentile: report.pricePercentile,
      },
      recommendations: report.recommendations,
    });
  } catch (error) {
    console.error("Report competitive error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
