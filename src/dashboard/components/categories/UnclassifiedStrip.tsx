import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { OTHER_SLUG } from "@/dashboard/lib/constants";
import type { CategoryItem } from "@/dashboard/types";

/**
 * `Other` is lifted out of the ranked list so it cannot dominate the bar scale
 * (see docs-internal/prd/categories-proportional-list-spec.md §3). It is
 * rendered here instead — stated in plain language, never hidden.
 *
 * `rounded-lg` and the amber left border deliberately match the not-found cards
 * on /dashboard and /dashboard/search so "something needs attention" reads the
 * same everywhere. Amber is text and border only, never a bar fill.
 */
export function UnclassifiedStrip({
  other,
  totalMerchants,
}: {
  other: CategoryItem;
  totalMerchants: number;
}) {
  if (other.merchantCount <= 0) return null;

  const pct =
    totalMerchants > 0
      ? Math.round((other.merchantCount / totalMerchants) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 border-l-4 border-l-amber-400 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm text-gray-600">
        <AlertCircle className="inline w-4 h-4 text-amber-500 mr-1.5 -mt-0.5" />
        <span className="font-semibold text-gray-900">
          {other.merchantCount.toLocaleString()} merchants
        </span>{" "}
        ({pct}% of the catalog) are still unclassified.
      </p>
      <Link
        href={`/dashboard/categories/${OTHER_SLUG}`}
        className="text-sm text-emerald-600 hover:text-emerald-700 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
      >
        View &ldquo;{other.name}&rdquo; &rarr;
      </Link>
    </div>
  );
}
