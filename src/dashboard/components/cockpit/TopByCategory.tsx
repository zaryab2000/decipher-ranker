import Link from "next/link";
import { OTHER_SLUG } from "@/dashboard/lib/constants";
import { displayName, toDisplayScore } from "@/dashboard/lib/formatters";
import type { CategoryItem } from "@/dashboard/types";

/** Largest categories shown in the empty state. */
const CATEGORY_COLUMNS = 3;

/**
 * Who is winning, per category — the orientation a visitor gets before they
 * have claimed anything of their own.
 *
 * `Other` is excluded by slug: it is a catch-all of unclassified merchants
 * (53% of the catalog), so "top 3 in Other" ranks merchants against a bucket
 * that means nothing. Do not "fix" this back by including it.
 */
export function TopByCategory({ categories }: { categories: CategoryItem[] }) {
  const columns = categories
    .filter((c) => c.slug !== OTHER_SLUG && (c.topMerchants?.length ?? 0) > 0)
    .sort((a, b) => b.merchantCount - a.merchantCount || a.name.localeCompare(b.name))
    .slice(0, CATEGORY_COLUMNS);

  if (columns.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-gray-900">Who&apos;s leading right now</h2>
      <p className="text-xs text-gray-400 mt-0.5">
        Top-scoring merchants in the three largest categories.
      </p>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {columns.map((category) => (
          <div
            key={category.slug}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/dashboard/categories/${category.slug}`}
                className="text-sm font-semibold text-gray-900 hover:text-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded truncate"
              >
                {category.name}
              </Link>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">
                {category.merchantCount.toLocaleString()}
              </span>
            </div>

            <ol className="mt-3 space-y-2">
              {(category.topMerchants ?? []).map((merchant, i) => {
                const name = merchant.serviceName
                  ? merchant.serviceName
                  : merchant.resourceUrl
                    ? displayName(merchant.resourceUrl)
                    : merchant.address;

                return (
                  <li key={merchant.address} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 tabular-nums w-3 shrink-0">
                      {i + 1}
                    </span>
                    {merchant.resourceUrl ? (
                      <Link
                        href={`/dashboard/merchant/${encodeURIComponent(merchant.resourceUrl)}`}
                        className="text-sm text-gray-900 hover:text-emerald-700 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                        title={name}
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-900 truncate" title={name}>
                        {name}
                      </span>
                    )}
                    <span className="ml-auto text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                      {/* Stored 0..1 — /api/categories does not scale these. */}
                      {toDisplayScore(merchant.score)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
