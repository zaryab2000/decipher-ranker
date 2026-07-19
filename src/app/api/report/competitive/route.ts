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

const CompetitiveResponseSchema = z.object({
  found: z.boolean(),
  message: z.string().optional(),
  origin: z.string().optional(),
  category: z.string().nullable().optional(),
  your_rank: z.number().nullable().optional(),
  total_competitors: z.number().optional(),
  competitors: z.array(z.record(z.string(), z.unknown())).optional(),
  gap_analysis: z.record(z.string(), z.unknown()).optional(),
  pricing_benchmark: z.record(z.string(), z.unknown()).optional(),
  recommendations: z.array(z.string()).optional(),
  ai_insights: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const POST = router
  .route({ path: "report/competitive", method: "POST" })
  .paid(REPORT_COST_USDC)
  .body(CompetitiveRequestSchema)
  .output(CompetitiveResponseSchema)
  .description(
    "Get a detailed competitive analysis. Returns top 10 competitors in your category with gap analysis, pricing benchmarks, and recommendations.",
  )
  .inputExample({ origin: "https://mesh.heurist.xyz" })
  .outputExample({
    found: true,
    origin: "https://mesh.heurist.xyz",
    category: "scraping",
    your_rank: 3,
    total_competitors: 42,
    competitors: [
      { origin: "https://comp.example.com", rank: 1, score: 0.9, price: 0.002 },
    ],
    gap_analysis: { missingTags: ["analytics"], missingKeywords: ["portfolio"] },
    pricing_benchmark: {
      your_price: 0.005,
      category_median: 0.002,
      percentile: 80,
    },
    recommendations: ["Add competitor tags", "Lower your price toward the median"],
    ai_insights: null,
  })
  .handler(async ({ body, wallet }) => {
    const data = await getMerchantByOrigin(body.origin);
    if (!data) {
      return {
        found: false,
        message:
          "Origin not found in index. Try the free /report/origin endpoint first.",
      };
    }

    const report = await computeCompetitiveReport(data, body.origin);

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
