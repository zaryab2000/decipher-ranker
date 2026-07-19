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
  listing_completeness: z.number().optional(),
  tips: z.array(z.string()).optional(),
  last_updated: z.string().optional(),
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
      listing_completeness: report.listingCompleteness,
      tips: report.tips,
      last_updated: data.merchant.lastUpdated.toISOString(),
    };
  });

// Free but does real DB work per call (origin lookup + report) — tighter limit.
export const POST = withRateLimit(handler, { limit: 15 });
