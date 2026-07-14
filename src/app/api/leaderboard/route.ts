import { z } from "zod";
import { router } from "@/lib/router";
import { db } from "@/lib/db";
import { merchants, categories } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { withRateLimit } from "@/lib/rate-limit";

const LeaderboardQuerySchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Filter to a single category by name; omit for all categories"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Number of merchants to return (1-100)"),
});

const handler = router
  .route({ path: "leaderboard", method: "GET" })
  .unprotected()
  .query(LeaderboardQuerySchema)
  .description(
    "Top x402 merchants ranked by decipher score, optionally filtered to a single category.",
  )
  .handler(async ({ query }) => {
    const categoryFilter = query.category ?? null;
    const limit = query.limit;

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

    return {
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
    };
  });

export const GET = withRateLimit(handler);
