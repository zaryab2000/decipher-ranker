import { getLeaderboard, getCategoryNames } from "@/dashboard/lib/api";
import { LeaderboardTable } from "@/dashboard/components/leaderboard/LeaderboardTable";
import { FilterBar } from "@/dashboard/components/leaderboard/FilterBar";
import { Pagination } from "@/dashboard/components/shared/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/dashboard/lib/constants";

export const revalidate = 3600;

interface Props {
  searchParams: Promise<{
    category?: string;
    page?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = params.category;
  const page = Math.max(1, Number(params.page ?? 1));
  const sortBy = params.sortBy ?? "score";
  const sortOrder = (params.sortOrder ?? "desc") as "asc" | "desc";

  const [data, categories] = await Promise.all([
    getLeaderboard({
      category,
      page,
      perPage: DEFAULT_PAGE_SIZE,
      sortBy,
      sortOrder,
    }),
    getCategoryNames(),
  ]);

  const { merchants, total } = data;
  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  // Carry the active filters into pagination links so page navigation preserves
  // category/sort/order.
  const paginationParams: Record<string, string> = {};
  if (category) paginationParams.category = category;
  if (sortBy !== "score") paginationParams.sortBy = sortBy;
  if (sortOrder !== "desc") paginationParams.sortOrder = sortOrder;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-50">Leaderboard</h1>
        <p className="text-gray-400 mt-1">
          Top-ranked x402 merchants across all categories
        </p>
      </div>
      <FilterBar
        categories={categories}
        currentCategory={category ?? undefined}
        currentSort={sortBy}
        currentOrder={sortOrder}
      />
      <LeaderboardTable
        merchants={merchants}
        startRank={(page - 1) * DEFAULT_PAGE_SIZE}
        total={total}
        page={page}
        perPage={DEFAULT_PAGE_SIZE}
      />
      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/dashboard/leaderboard"
        searchParams={paginationParams}
      />
    </div>
  );
}
