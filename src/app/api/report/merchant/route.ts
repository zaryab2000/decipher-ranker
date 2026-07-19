import { z } from "zod";
import { router } from "@/lib/router";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import {
  getMerchantByAddress,
  computeMerchantDeepDive,
} from "@/lib/analytics/ranker";
import { REPORT_COST_USDC } from "@/lib/config";

const MerchantRequestSchema = z.object({
  address: z
    .string()
    .min(32)
    .max(48)
    .describe("The payee address (EVM or Solana) of the merchant"),
  chain: z
    .enum(["base", "solana", "polygon"])
    .optional()
    .default("base")
    .describe("Blockchain network (mainnet only)"),
});

const MerchantResponseSchema = z.object({
  found: z.boolean(),
  message: z.string().optional(),
  address: z.string().optional(),
  chain: z.string().optional(),
  service_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  rank: z.number().nullable().optional(),
  all_time_stats_available: z.boolean().optional(),
  volume: z.record(z.string(), z.unknown()).optional(),
  buyers: z.record(z.string(), z.unknown()).optional(),
  pricing: z.record(z.string(), z.unknown()).optional(),
  trends: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendations: z.array(z.string()).optional(),
});

export const POST = router
  .route({ path: "report/merchant", method: "POST" })
  .paid(REPORT_COST_USDC)
  .body(MerchantRequestSchema)
  .output(MerchantResponseSchema)
  .description(
    "Get a detailed merchant deep-dive by wallet address. Returns volume stats, buyer diversity, trend signals, and recommendations.",
  )
  .inputExample({
    address: "0xe9030014f5dae217d0a152f02a043567b16c1abf",
    chain: "base",
  })
  .outputExample({
    found: true,
    address: "0xe9030014f5dae217d0a152f02a043567b16c1abf",
    chain: "base",
    service_name: "Example Service",
    category: "ai",
    rank: 5,
    all_time_stats_available: false,
    volume: { total_transactions: null, volume_30d: 200, tx_count_30d: 50 },
    buyers: { unique_30d: 10, concentration: 0.3, diversity_score: 65 },
    pricing: { price_usd: 0.01, vs_category: "median" },
    trends: [{ date: "2026-07-01", rank: 5, score: 0.55 }],
    recommendations: ["Publish input schemas", "Increase buyer diversity"],
  })
  .handler(async ({ body, wallet }) => {
    const data = await getMerchantByAddress(body.address, body.chain);
    if (!data) {
      return {
        found: false,
        message: "Merchant not found. Try a different address.",
      };
    }

    const report = await computeMerchantDeepDive(data);

    await db.insert(reports).values({
      requesterWallet: wallet ?? "anonymous",
      reportType: "merchant",
      inputParams: { address: body.address, chain: body.chain },
      costUsdc: REPORT_COST_USDC,
    });

    return {
      found: true,
      address: body.address,
      chain: body.chain,
      service_name: report.serviceName,
      category: report.category,
      rank: report.rank,
      all_time_stats_available: report.allTimeStatsAvailable,
      volume: {
        total_transactions: report.totalTxns,
        total_volume_usd: report.totalVolumeUsd,
        volume_30d: report.volume30d,
        tx_count_30d: report.txCount30d,
      },
      buyers: {
        total_unique: report.totalUniqueBuyers,
        unique_30d: report.uniqueBuyers30d,
        unique_sellers: report.uniqueSellers,
        concentration: report.buyerConcentration,
        concentration_is_estimate: report.buyerConcentrationIsEstimate,
        diversity_score: report.diversityScore,
      },
      pricing: {
        price_usd: report.price,
        vs_category: report.priceVsCategory,
      },
      trends: report.trends,
      recommendations: report.recommendations,
    };
  });
