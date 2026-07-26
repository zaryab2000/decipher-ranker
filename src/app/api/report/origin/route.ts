import { z } from "zod";
import { router } from "@/lib/router";
import { getMerchantByOrigin, computeBasicReport } from "@/lib/analytics/ranker";
import { withRateLimit } from "@/lib/rate-limit";

const OriginRequestSchema = z.object({
  origin: z
    .string()
    .url()
    .describe("The origin URL of the merchant (e.g. https://mesh.heurist.xyz)"),
});

const OriginResponseSchema = z.object({
  found: z.boolean(),
  origin: z.string().optional(),
  message: z.string().optional(),
  category: z.string().nullable().optional(),
  rank_position: z.number().nullable().optional(),
  total_competitors: z.number().optional(),
  price_position: z.string().optional(),
  description_quality: z.number().optional(),
  description_quality_breakdown: z
    .object({
      score: z.number(),
      lengthScore: z.number(),
      keywordDensity: z.number(),
      categoryKeywordPresence: z.number(),
      structuralSpecificity: z.number(),
      length: z.number(),
      fluffScore: z.number(),
      buzzwords: z.array(z.string()),
      verdict: z.string(),
    })
    .nullable()
    .optional(),
  tag_quality: z
    .object({
      score: z.number(),
      relevance: z.number(),
      specificity: z.number(),
      count_score: z.number(),
      spam: z.boolean(),
      count: z.number(),
      issues: z.array(z.string()),
      suggested_tags: z.array(z.string()),
    })
    .nullable()
    .optional(),
  listing_completeness: z.number().optional(),
  tips: z.array(z.string()).optional(),
  last_updated: z.string().optional(),
  discovery_layers: z
    .object({
      cdp_bazaar: z.object({ indexed: z.boolean(), note: z.string() }),
      x402scan: z.object({ indexed: z.boolean(), note: z.string() }),
      agent_cash: z.object({ indexed: z.boolean(), note: z.string() }),
      layer_alignment_score: z.number(),
    })
    .nullable()
    .optional(),
  supply_gap: z
    .object({
      category_name: z.string(),
      average_gap_ratio: z.number(),
      total_buried_merchants: z.number(),
      total_category_merchants: z.number(),
      refreshed_at: z.string(),
      merchant_is_buried: z.boolean(),
      per_query: z.array(
        z.object({
          query: z.string(),
          cdp_results: z.number(),
          category_merchant_count: z.number(),
          buried_count: z.number(),
          gap_ratio: z.number(),
        }),
      ),
    })
    .nullable()
    .optional(),
  completeness_grade: z.enum(["A", "B", "C", "D", "F"]).nullable().optional(),
  action_roadmap: z
    .array(
      z.object({
        action: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        component: z.string(),
        issue: z.string(),
        expected_impact: z.string(),
      }),
    )
    .optional(),
  chain_count: z.number().optional(),
  weight_rationale: z
    .record(
      z.string(),
      z.object({
        weight: z.number(),
        reason: z.string(),
        what_moves_it: z.string(),
        merchant_can_control: z.boolean(),
      }),
    )
    .nullable()
    .optional(),
  rank_trend: z
    .object({
      trend_direction: z.enum([
        "improving",
        "declining",
        "stable",
        "insufficient_data",
      ]),
      score_change_30d: z.number().nullable(),
      rank_change_30d: z.number().nullable(),
      volume_change_30d: z.number().nullable(),
      buyer_change_30d: z.number().nullable(),
      snapshots_available: z.number(),
      first_snapshot_date: z.string().nullable(),
      last_snapshot_date: z.string().nullable(),
      interpretation: z.string(),
    })
    .nullable()
    .optional(),
});

const handler = router
  .route({ path: "report/origin", method: "POST" })
  .siwx()
  .body(OriginRequestSchema)
  .output(OriginResponseSchema)
  .description(
    "Get a free basic ranking report for your API origin. Returns category, competitor count, price position, and improvement tips.",
  )
  .inputExample({ origin: "https://mesh.heurist.xyz" })
  .outputExample({
    found: true,
    origin: "https://mesh.heurist.xyz",
    category: "scraping",
    rank_position: 3,
    total_competitors: 42,
    price_position: "above_median",
    description_quality: 80,
    listing_completeness: 75,
    tips: ["Publish input schemas and output examples", "Add 3-5 relevant tags"],
    last_updated: "2026-07-19T00:00:00.000Z",
  })
  .handler(async ({ body }) => {
    const data = await getMerchantByOrigin(body.origin);
    if (!data) {
      return {
        found: false,
        origin: body.origin,
        message:
          "This origin is not yet indexed. It may take up to 24 hours after registration on x402scan to appear.",
      };
    }

    const report = await computeBasicReport(data);

    return {
      found: true,
      origin: body.origin,
      category: report.category,
      rank_position: report.rankPosition,
      total_competitors: report.totalCompetitors,
      price_position: report.pricePosition,
      description_quality: report.descriptionQuality,
      description_quality_breakdown: report.descriptionQualityBreakdown ?? null,
      tag_quality: report.tagQualityBreakdown
        ? {
            score: report.tagQualityBreakdown.score,
            relevance: report.tagQualityBreakdown.relevance,
            specificity: report.tagQualityBreakdown.specificity,
            count_score: report.tagQualityBreakdown.countScore,
            spam: report.tagQualityBreakdown.spam,
            count: report.tagQualityBreakdown.count,
            issues: report.tagQualityBreakdown.issues,
            suggested_tags: report.tagQualityBreakdown.suggestedTags,
          }
        : null,
      listing_completeness: report.listingCompleteness,
      tips: report.tips,
      last_updated: data.merchant.lastUpdated.toISOString(),
      discovery_layers: report.discoveryLayers
        ? {
            cdp_bazaar: report.discoveryLayers.cdpBazaar,
            x402scan: report.discoveryLayers.x402scan,
            agent_cash: report.discoveryLayers.agentCash,
            layer_alignment_score: report.discoveryLayers.layerAlignmentScore,
          }
        : null,
      supply_gap: report.supplyGap
        ? {
            category_name: report.supplyGap.categoryName,
            average_gap_ratio: report.supplyGap.averageGapRatio,
            total_buried_merchants: report.supplyGap.totalBuriedMerchants,
            total_category_merchants: report.supplyGap.totalCategoryMerchants,
            refreshed_at: report.supplyGap.refreshedAt,
            merchant_is_buried: report.supplyGap.merchantIsBuried,
            per_query: report.supplyGap.perQuery.map((q) => ({
              query: q.query,
              cdp_results: q.cdpResults,
              category_merchant_count: q.categoryMerchantCount,
              buried_count: q.buriedCount,
              gap_ratio: q.gapRatio,
            })),
          }
        : null,
      completeness_grade: report.completenessGrade ?? null,
      action_roadmap: (report.actionRoadmap ?? []).map((a) => ({
        action: a.action,
        priority: a.priority,
        component: a.component,
        issue: a.issue,
        expected_impact: a.expectedImpact,
      })),
      chain_count: report.chainCount,
      weight_rationale: report.weightRationale
        ? Object.fromEntries(
            Object.entries(report.weightRationale).map(([k, v]) => [
              k,
              {
                weight: v.weight,
                reason: v.reason,
                what_moves_it: v.whatMovesIt,
                merchant_can_control: v.merchantCanControl,
              },
            ]),
          )
        : null,
      rank_trend: report.rankTrend
        ? {
            trend_direction: report.rankTrend.trendDirection,
            score_change_30d: report.rankTrend.scoreChange30d,
            rank_change_30d: report.rankTrend.rankChange30d,
            volume_change_30d: report.rankTrend.volumeChange30d,
            buyer_change_30d: report.rankTrend.buyerChange30d,
            snapshots_available: report.rankTrend.snapshotsAvailable,
            first_snapshot_date: report.rankTrend.firstSnapshotDate,
            last_snapshot_date: report.rankTrend.lastSnapshotDate,
            interpretation: report.rankTrend.interpretation,
          }
        : null,
    };
  });

// Free but does real DB work per call (origin lookup + report) — tighter limit.
export const POST = withRateLimit(handler, { limit: 15 });
