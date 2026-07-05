import { getLeaderboard, getAllCategories } from "@/dashboard/lib/api";
import { FilterBar } from "@/dashboard/components/leaderboard/FilterBar";
import { LeaderboardTable } from "@/dashboard/components/leaderboard/LeaderboardTable";
import { Pagination } from "@/dashboard/components/shared/Pagination";
import type { PaginationMeta } from "@/dashboard/types";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; order?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const sortBy = params.sort ?? "score";
  const sortOrder = (params.order === "asc" ? "asc" : "desc") as "asc" | "desc";
  const page = parseInt(params.page ?? "1", 10) || 1;
  const perPage = 50;

  const [data, categories] = await Promise.all([
    getLeaderboard({ category, page, perPage, sortBy, sortOrder }),
    getAllCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(data.total / perPage));
  const paginationMeta: PaginationMeta = { page, perPage, total: data.total, totalPages };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-50">Leaderboard</h1>
        <p className="text-gray-400 mt-1">All merchants ranked by performance</p>
      </div>

      <FilterBar
        categories={categories.map((c) => c.name)}
        currentCategory={category}
        currentSort={sortBy}
        currentOrder={sortOrder}
      />

      <LeaderboardTable
        merchants={data.merchants}
        startRank={(page - 1) * perPage}
      />

      <Pagination
        page={paginationMeta.page}
        totalPages={paginationMeta.totalPages}
        basePath="/dashboard/leaderboard"
        searchParams={
          Object.fromEntries(
            Object.entries({
              category: category ?? "",
              sort: sortBy !== "score" ? sortBy : "",
              order: sortOrder !== "desc" ? sortOrder : "",
            }).filter(([, v]) => v),
          )
        }
      />
    </div>
  );
}
