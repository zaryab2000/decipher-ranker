import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants, categories } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryFilter = searchParams.get("category");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 100);

  let categoryId: string | null = null;
  if (categoryFilter) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, categoryFilter))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  const results = await db.query.merchants.findMany({
    where: categoryId ? eq(merchants.categoryId, categoryId) : undefined,
    orderBy: [desc(merchants.rankerScore)],
    limit,
    columns: {
      payeeAddress: true,
      rankerScore: true,
      rankPosition: true,
      txCount30d: true,
      uniqueBuyers: true,
      totalAmountUsd: true,
    },
  });

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    category: categoryFilter ?? "all",
    count: results.length,
    leaderboard: results.map((m, i) => ({
      rank: i + 1,
      address: m.payeeAddress,
      score: m.rankerScore ? Number(m.rankerScore) : 0,
      tx_count_30d: m.txCount30d,
      unique_buyers_30d: m.uniqueBuyers,
      volume_usd_30d: m.totalAmountUsd ? Number(m.totalAmountUsd) : null,
    })),
  });
}
