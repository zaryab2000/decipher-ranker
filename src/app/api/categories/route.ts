import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, merchants } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const cats = await db.query.categories.findMany({
    orderBy: [desc(categories.merchantCount)],
  });

  const transformed = await Promise.all(
    cats.map(async (cat) => {
      const topMerchants = await db.query.merchants.findMany({
        where: eq(merchants.categoryId, cat.id),
        orderBy: [desc(merchants.rankerScore)],
        limit: 3,
        columns: {
          payeeAddress: true,
          rankerScore: true,
          txCount30d: true,
        },
      });

      return {
        name: cat.name,
        merchant_count: cat.merchantCount,
        median_price_usd: cat.medianPrice ? Number(cat.medianPrice) : null,
        top_merchants: topMerchants.map((m) => ({
          address: m.payeeAddress,
          score: m.rankerScore ? Number(m.rankerScore) : 0,
          volume_30d: m.txCount30d,
        })),
      };
    }),
  );

  return NextResponse.json({ categories: transformed, total: transformed.length });
}
