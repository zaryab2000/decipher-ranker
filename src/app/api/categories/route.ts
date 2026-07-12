import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, merchants } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  const cats = await db
    .select()
    .from(categories)
    .orderBy(desc(categories.merchantCount));

  // Top-3 merchants for every category in a single windowed query instead of
  // one query per category.
  const rankedRows = await db
    .select({
      categoryId: merchants.categoryId,
      payeeAddress: merchants.payeeAddress,
      rankerScore: merchants.rankerScore,
      txCount30d: merchants.txCount30d,
      rn: sql<number>`row_number() over (partition by ${merchants.categoryId} order by ${merchants.rankerScore} desc)`,
    })
    .from(merchants)
    .where(sql`${merchants.categoryId} IS NOT NULL`);

  const topByCategory = new Map<
    string,
    Array<{ address: string; score: number; volume_30d: number | null }>
  >();
  for (const r of rankedRows) {
    if (!r.categoryId || Number(r.rn) > 3) continue;
    const list = topByCategory.get(r.categoryId) ?? [];
    list.push({
      address: r.payeeAddress,
      score: r.rankerScore ? Number(r.rankerScore) : 0,
      volume_30d: r.txCount30d,
    });
    topByCategory.set(r.categoryId, list);
  }

  const transformed = cats.map((cat) => ({
    name: cat.name,
    merchant_count: cat.merchantCount,
    median_price_usd: cat.medianPrice ? Number(cat.medianPrice) : null,
    top_merchants: topByCategory.get(cat.id) ?? [],
  }));

  return NextResponse.json({ categories: transformed, total: transformed.length });
}
