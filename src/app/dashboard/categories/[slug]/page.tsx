import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getMerchantByOrigin } from "@/dashboard/lib/api";
import { Card } from "@/dashboard/components/shared/Card";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { LeaderboardTable } from "@/dashboard/components/leaderboard/LeaderboardTable";
import { ScoreDistributionChart } from "@/dashboard/components/categories/ScoreDistributionChart";
import { Pagination } from "@/dashboard/components/shared/Pagination";
import { formatNumber, formatPrice, toDisplayScore } from "@/dashboard/lib/formatters";

// Data changes at most once/day via the refresh pipeline; regenerate hourly
// instead of per-request to keep Neon egress off the hot path.
export const revalidate = 3600;

const CATEGORY_PAGE_SIZE = 20;

const getCachedCategory = cache(getCategoryBySlug);

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getCachedCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: `Top ${category.merchantCount} merchants in ${category.name}.`.trim(),
    openGraph: {
      title: category.name,
      description: `Merchant rankings for the ${category.name} category.`,
    },
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; origin?: string }>;
}) {
  const { slug } = await params;
  const { page: pageStr, origin } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? 1));
  const category = await getCachedCategory(slug, { page, perPage: CATEGORY_PAGE_SIZE });

  if (!category) {
    notFound();
  }

  // When the visitor arrived with a merchant in context, mark where they sit in
  // the distribution. Absent an origin the chart is just the category shape.
  const trimmedOrigin = origin?.trim();
  const you = trimmedOrigin ? await getMerchantByOrigin(trimmedOrigin) : null;
  const yourScore = you ? toDisplayScore(you.rankerScore) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{category.name}</h1>
        <p className="text-gray-600 mt-1">
          {category.merchantCount} merchant{category.merchantCount !== 1 ? "s" : ""} in this category
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Merchants</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{category.merchantCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Score</p>
          {category.avgScore != null ? (
            <div className="mt-1">
              <ScoreBar score={toDisplayScore(category.avgScore)} showLabel />
            </div>
          ) : (
            <p className="text-2xl font-bold tabular-nums text-gray-900">—</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Median Price</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {category.medianPriceUsd != null ? formatPrice(category.medianPriceUsd) : "—"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wide">30d Volume</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {category.totalVolume30d != null ? formatNumber(category.totalVolume30d) : "—"}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Score distribution</h2>
        <Card>
          <ScoreDistributionChart data={category.scoreDistribution} highlightScore={yourScore} />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Merchants in {category.name}</h2>
        <LeaderboardTable merchants={category.merchants} startRank={0} total={category.merchantCount} />
        <Pagination
          page={page}
          totalPages={Math.ceil(category.merchantCount / CATEGORY_PAGE_SIZE)}
          basePath={`/dashboard/categories/${category.slug}`}
        />
      </div>
    </div>
  );
}
