import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/dashboard/lib/api";
import { Card } from "@/dashboard/components/shared/Card";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { LeaderboardTable } from "@/dashboard/components/leaderboard/LeaderboardTable";
import { ScoreDistributionChart } from "@/dashboard/components/categories/ScoreDistributionChart";
import { formatNumber, formatPrice } from "@/dashboard/lib/formatters";

// Data changes at most once/day via the refresh pipeline; regenerate hourly
// instead of per-request to keep Neon egress off the hot path.
export const revalidate = 3600;

const getCachedCategory = cache(getCategoryBySlug);

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getCachedCategory(slug);
  if (!category) return { title: "Category not found — decipher-ranker" };
  const priceStr = category.medianPriceUsd != null
    ? `Median price: $${category.medianPriceUsd.toFixed(2)}`
    : "";
  return {
    title: `${category.name} — decipher-ranker`,
    description: `Top ${category.merchantCount} merchants in ${category.name}. ${priceStr}`.trim(),
    openGraph: {
      title: `${category.name} — decipher-ranker`,
      description: `Merchant rankings for the ${category.name} category.`,
    },
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCachedCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-50">{category.name}</h1>
        <p className="text-gray-400 mt-1">
          {category.merchantCount} merchant{category.merchantCount !== 1 ? "s" : ""} in this category
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Merchants</p>
          <p className="text-2xl font-semibold text-gray-50">{category.merchantCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Score</p>
          {category.avgScore != null ? (
            <div className="mt-1">
              <ScoreBar score={category.avgScore * 100} showLabel />
            </div>
          ) : (
            <p className="text-2xl font-semibold text-gray-50">—</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Median Price</p>
          <p className="text-2xl font-semibold text-gray-50">
            {category.medianPriceUsd != null ? formatPrice(category.medianPriceUsd) : "N/A"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">30d Volume</p>
          <p className="text-2xl font-semibold text-gray-50">{formatNumber(category.totalVolume30d)}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-50 mb-3">Score Distribution</h2>
        <Card>
          <ScoreDistributionChart data={category.scoreDistribution} />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-50 mb-3">Merchants in {category.name}</h2>
        <LeaderboardTable merchants={category.merchants} startRank={0} total={category.merchantCount} />
      </div>
    </div>
  );
}
