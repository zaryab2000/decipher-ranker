import { getDb } from "@/lib/db";
import { merchants, categories } from "@/lib/db/schema";
import { desc, asc, eq, sql } from "drizzle-orm";

export interface LeaderboardParams {
  category?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface LeaderboardResult {
  merchants: Array<{
    payeeAddress: string;
    rankerScore: number;
    rankPosition: number | null;
    txCount30d: number;
    uniqueBuyers: number;
    totalAmountUsd: number;
    categoryName: string | null;
  }>;
  total: number;
  page: number;
  perPage: number;
}

export async function getLeaderboard(
  params: LeaderboardParams = {},
): Promise<LeaderboardResult> {
  const page = params.page ?? 1;
  const perPage = Math.min(Math.max(params.perPage ?? 50, 1), 100);
  const offset = (page - 1) * perPage;

  let categoryId: string | null = null;
  if (params.category) {
    const [cat] = await getDb()
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, params.category))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  const whereClause = categoryId
    ? eq(merchants.categoryId, categoryId)
    : undefined;

  const sortColumn = (() => {
    switch (params.sortBy) {
      case "txCount":
        return merchants.txCount30d;
      case "buyers":
        return merchants.uniqueBuyers;
      case "volume":
        return merchants.totalAmountUsd;
      default:
        return merchants.rankerScore;
    }
  })();

  const orderFn = params.sortOrder === "asc" ? asc : desc;

  const [countResult] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(merchants)
    .where(whereClause);

  const results = await getDb()
    .select({
      payeeAddress: merchants.payeeAddress,
      rankerScore: merchants.rankerScore,
      rankPosition: merchants.rankPosition,
      txCount30d: merchants.txCount30d,
      uniqueBuyers: merchants.uniqueBuyers,
      totalAmountUsd: merchants.totalAmountUsd,
      categoryId: merchants.categoryId,
    })
    .from(merchants)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(perPage)
    .offset(offset);

  const categoryIds = [
    ...new Set(results.map((r) => r.categoryId).filter(Boolean)),
  ] as string[];
  const categoryMap = new Map<string, string>();
  for (const cid of categoryIds) {
    const [cat] = await getDb()
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, cid))
      .limit(1);
    if (cat) categoryMap.set(cid, cat.name);
  }

  return {
    merchants: results.map((r) => ({
      payeeAddress: r.payeeAddress,
      rankerScore: Number(r.rankerScore ?? 0),
      rankPosition: r.rankPosition,
      txCount30d: r.txCount30d ?? 0,
      uniqueBuyers: r.uniqueBuyers ?? 0,
      totalAmountUsd: Number(r.totalAmountUsd ?? 0),
      categoryName: r.categoryId ? (categoryMap.get(r.categoryId) ?? null) : null,
    })),
    total: Number(countResult?.count ?? 0),
    page,
    perPage,
  };
}

export async function getMerchantRank(
  merchantId: string,
): Promise<number | null> {
  const [merchant] = await getDb()
    .select({ rankPosition: merchants.rankPosition })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  return merchant?.rankPosition ?? null;
}
