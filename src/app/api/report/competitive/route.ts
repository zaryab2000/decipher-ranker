import { z } from "zod";
import { router } from "@/lib/router";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import {
  getMerchantByOrigin,
  computeCompetitiveReport,
} from "@/lib/analytics/ranker";
import { REPORT_COST_USDC } from "@/lib/config";

const CompetitiveRequestSchema = z.object({
  origin: z.string().url().describe("Your API origin URL"),
});

export const POST = router
  .route({ path: "report/competitive", method: "POST" })
  .paid(REPORT_COST_USDC)
  .body(CompetitiveRequestSchema)
  .description(
    "Get a detailed competitive analysis. Returns top 10 competitors in your category with gap analysis, pricing benchmarks, and recommendations.",
  )
  .inputExample({ origin: "https://mesh.heurist.xyz" })
  .handler(async ({ body, wallet }) => {
    const data = await getMerchantByOrigin(body.origin);
    if (!data) {
      return {
        found: false,
        message:
          "Origin not found in index. Try the free /report/origin endpoint first.",
      };
    }

    const report = await computeCompetitiveReport(data);

    await db.insert(reports).values({
      requesterWallet: wallet ?? "anonymous",
      reportType: "competitive",
      inputParams: { origin: body.origin },
      costUsdc: REPORT_COST_USDC,
    });

    return {
      found: true,
      origin: body.origin,
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
      ai_insights: report.aiInsights
        ? {
            summary: report.aiInsights.summary,
            top_action: report.aiInsights.topAction,
            insights: report.aiInsights.insights,
            model: report.aiInsights.model,
          }
        : null,
    };
  });
