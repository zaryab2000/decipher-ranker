import { CategoriesEmptyState } from "@/dashboard/components/categories/CategoriesEmptyState";
import { CategoryTable } from "@/dashboard/components/categories/CategoryTable";
import { UnclassifiedStrip } from "@/dashboard/components/categories/UnclassifiedStrip";
import { getAllCategories } from "@/dashboard/lib/api";
import { fastestRiser, splitCategories } from "@/dashboard/lib/formatters";

export const metadata = { title: "Categories" };

/** Indexed by leadCount, which slice(0, 3) bounds to 0..3. */
const COUNT_WORDS = ["No", "One", "Two", "Three"] as const;

// Data changes at most once/day via the refresh pipeline; regenerate hourly
// instead of per-request to keep Neon egress off the hot path.
export const revalidate = 3600;

export default async function CategoriesPage() {
  const categories = await getAllCategories();
  const {
    classified,
    other,
    totalMerchants,
    classifiedMerchants,
    maxClassifiedCount,
    topThreeClassifiedShare,
  } = splitCategories(categories);

  // Excludes Other and suppresses on a flat or shrinking leader, so the
  // sentence never announces a riser that did not rise. Labelled with that
  // category's own window, not the column header's max.
  const riser = fastestRiser(classified);

  // topThreeClassifiedShare is computed with slice(0, 3), so with fewer than
  // three classified categories it covers all of them — the sentence has to say
  // how many it actually describes.
  const leadCount = Math.min(3, classified.length);

  return (
    // max-w-5xl, narrower than the shell's max-w-7xl: a six-column ranked list
    // gains nothing from 1280px, and over-wide rows make the eye travel too far
    // from the category name to its number.
    <div className="space-y-5 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Categories
        </h1>
        {/* Gated on `classified`, not `categories`: a catalog holding only
            Other has categories.length === 1 but nothing to rank, and the
            sentence would sit above a table that renders nothing. */}
        {classified.length > 0 && (
          // Computed, never hardcoded — both the count word and the number move
          // with the catalog.
          <p className="mt-1 text-base text-gray-600">
            {/* "classified" is load-bearing, not padding: 53% of the catalog is
                unclassified, and a bare "of the N merchants" would imply this
                percentage covers the whole catalog. This is the same
                denominator the Share column divides by, so the first three
                Share cells sum to this percentage directly. */}
            {leadCount === 1
              ? "One category holds"
              : `${COUNT_WORDS[leadCount]} categories hold`}{" "}
            {Math.round(topThreeClassifiedShare)}% of the{" "}
            {classifiedMerchants.toLocaleString()} classified merchants.
            {riser && (
              <>
                {" "}
                {riser.name} grew fastest — up{" "}
                {riser.growth!.growthPct.toFixed(1)}% in{" "}
                {riser.growth!.daysCovered} days.
              </>
            )}
          </p>
        )}
      </header>

      {categories.length === 0 ? (
        <CategoriesEmptyState />
      ) : (
        <>
          {other && (
            <UnclassifiedStrip other={other} totalMerchants={totalMerchants} />
          )}

          <CategoryTable
            categories={classified}
            classifiedMerchants={classifiedMerchants}
            maxCount={maxClassifiedCount}
          />
        </>
      )}
    </div>
  );
}
