import Link from "next/link";

import { CATEGORIES_VISIBLE } from "@/dashboard/lib/constants";
import { toDisplayScore } from "@/dashboard/lib/formatters";
import { GrowthChip } from "@/dashboard/components/categories/GrowthChip";
import type { CategoryItem } from "@/dashboard/types";

/**
 * One row of the proportional category list.
 *
 * Presentational only — no hooks, no directive. It is rendered by CategoryTable
 * ("use client"), so it compiles into the client bundle either way; keeping it
 * free of side effects keeps that cheap.
 */
export function CategoryRow({
  category,
  rank,
  maxCount,
  classifiedMerchants,
  showGrowth,
}: {
  category: CategoryItem;
  rank: number;
  maxCount: number;
  /**
   * Share denominator: classified merchants only, NOT the whole catalog.
   * `Other` is not a row here, so dividing by the catalog total would make the
   * column sum to 47% and contradict the header. The unclassified strip states
   * the catalog-wide figure separately.
   */
  classifiedMerchants: number;
  /** Threaded from CategoryTable so header and body agree on column count. */
  showGrowth: boolean;
}) {
  // Linear scale against the largest CLASSIFIED category. A log or sqrt scale
  // would flatter the tail by misrepresenting it — these categories really are
  // this small. The 2% floor keeps a 1-merchant category visible.
  const barWidth = Math.max((category.merchantCount / maxCount) * 100, 2);
  const share =
    classifiedMerchants > 0
      ? (category.merchantCount / classifiedMerchants) * 100
      : 0;

  // Past the fold the bars are only a few percent wide; at full strength they
  // read as rendering artifacts. Dimming admits they are small.
  const dimmed = rank > CATEGORIES_VISIBLE;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2.5 px-2 w-8 text-xs font-bold text-gray-500 tabular-nums">
        {rank}
      </td>

      <td className="py-2.5 px-2">
        <Link
          href={`/dashboard/categories/${category.slug}`}
          title={category.name}
          className="block truncate max-w-[180px] text-sm font-semibold text-gray-900 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          {category.name}
        </Link>
      </td>

      <td className="py-2.5 px-2 w-[38%] min-w-[80px]">
        {/* aria-hidden: the count and share cells already state this
            numerically. Not a progressbar — a category size is not progress
            toward a goal. */}
        <div
          className="h-4 rounded bg-gray-100 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`h-4 rounded ${dimmed ? "bg-brand-200" : "bg-brand-500"}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </td>

      <td className="py-2.5 px-2 text-sm font-semibold text-gray-900 tabular-nums text-right">
        {category.merchantCount.toLocaleString()}
      </td>

      <td className="py-2.5 px-2 text-xs text-gray-500 tabular-nums text-right hidden sm:table-cell">
        {share.toFixed(1)}%
      </td>

      <td className="py-2.5 px-2 text-sm text-gray-600 tabular-nums text-right hidden sm:table-cell">
        {/* avgScore is stored 0..1 — rendering it raw prints "0.37". */}
        {category.avgScore != null ? toDisplayScore(category.avgScore) : "—"}
      </td>

      {/* Rightmost, so the responsive ladder degrades from the right inward.
          Tail rows show growth too: hiding it below the fold would imply the
          data stops existing there. */}
      {showGrowth && (
        <td className="py-2.5 px-2 text-right hidden md:table-cell">
          <GrowthChip growth={category.growth} />
        </td>
      )}
    </tr>
  );
}
