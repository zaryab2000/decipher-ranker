import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import {
  getMerchantByAddress,
  computeMerchantDeepDive,
} from "@/lib/analytics/ranker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = body.address;
    const chain = body.chain ?? "base";

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Missing required field: address (wallet address string)" },
        { status: 400 },
      );
    }

    const data = await getMerchantByAddress(address, chain);
    if (!data) {
      return NextResponse.json({
        found: false,
        message: "Merchant not found. Try a different address.",
      });
    }

    const report = await computeMerchantDeepDive(data);

    await db.insert(reports).values({
      requesterWallet: body.wallet ?? "anonymous",
      reportType: "merchant",
      inputParams: { address, chain },
      costUsdc: "0.03",
    });

    return NextResponse.json({
      found: true,
      address,
      chain,
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 },
    );
  }
}
