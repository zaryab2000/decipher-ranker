"use client";

import { useState } from "react";

import { CategoryRow } from "@/dashboard/components/categories/CategoryRow";
import { CATEGORIES_VISIBLE } from "@/dashboard/lib/constants";
import { growthWindowDays } from "@/dashboard/lib/formatters";
import type { CategoryItem } from "@/dashboard/types";

const TH =
  "text-xs uppercase tracking-wide text-gray-400 font-medium text-left pb-2 px-2";

/**
 * Ranked, proportional category list with the long tail behind a toggle.
 *
 * Client only for the toggle — the data is fetched on the server and passed in.
 * The ordering is fixed (merchant count descending) on purpose: adding sort
 * controls would re-introduce the "every category is a peer" framing this
 * layout exists to remove.
 */
export function CategoryTable({
  categories,
  classifiedMerchants,
  maxCount,
}: {
  categories: CategoryItem[];
  /** Share denominator — classified only, matching the header. */
  classifiedMerchants: number;
  maxCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (categories.length === 0) return null;

  // Computed once here and threaded into every row, so the header and the body
  // can never disagree about how many columns exist. Zero means no category has
  // two snapshots yet — omit the column rather than print a stack of dashes.
  const windowDays = growthWindowDays(categories);
  const showGrowth = windowDays > 0;

  const hiddenCount = Math.max(categories.length - CATEGORIES_VISIBLE, 0);
  const visible = expanded
    ? categories
    : categories.slice(0, CATEGORIES_VISIBLE);

  return (
    <div>
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Categories ranked by merchant count. Bar length is proportional to
          size.
          {showGrowth &&
            ` Growth is the change over the last ${windowDays} days.`}
        </caption>
        <thead>
          <tr className="border-b border-gray-200">
            {/* Empty on purpose — a visible "#" adds nothing — but the cell
                must exist so the column count matches the body. */}
            <th scope="col" className="w-8" />
            <th scope="col" className={TH}>
              Category
            </th>
            <th scope="col" className={TH}>
              Size
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Merchants
            </th>
            <th scope="col" className={`${TH} text-right hidden sm:table-cell`}>
              Share
            </th>
            <th scope="col" className={`${TH} text-right hidden sm:table-cell`}>
              Avg score
            </th>
            {/* Label the window we actually have, never a hardcoded 30d. */}
            {showGrowth && (
              <th scope="col" className={`${TH} text-right hidden md:table-cell`}>
                {windowDays}d
              </th>
            )}
          </tr>
        </thead>
        <tbody id="category-tail">
          {visible.map((category, i) => (
            <CategoryRow
              key={category.slug}
              category={category}
              rank={i + 1}
              maxCount={maxCount}
              classifiedMerchants={classifiedMerchants}
              showGrowth={showGrowth}
            />
          ))}
        </tbody>
      </table>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="category-tail"
          className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {expanded
            ? "Hide the tail"
            : `Show ${hiddenCount} more ${hiddenCount === 1 ? "category" : "categories"}`}
        </button>
      )}
    </div>
  );
}
