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
    .enum(["base", "solana"])
    .optional()
    .default("base")
    .describe("Blockchain network"),
});

export const POST = router
  .route({ path: "report/merchant" })
  .paid(REPORT_COST_USDC)
  .body(MerchantRequestSchema)
  .description(
    "Get a detailed merchant deep-dive by wallet address. Returns volume stats, buyer diversity, trend signals, and recommendations.",
  )
  .inputExample({
    address: "0xe9030014f5dae217d0a152f02a043567b16c1abf",
    chain: "base",
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
      volume: {
        total_transactions: report.totalTxns,
        total_volume_usd: report.totalVolumeUsd,
        volume_30d: report.volume30d,
        tx_count_30d: report.txCount30d,
      },
      buyers: {
        total_unique: report.totalUniqueBuyers,
        unique_30d: report.uniqueBuyers30d,
        concentration: report.buyerConcentration,
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
