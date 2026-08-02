import { Skeleton } from "@/dashboard/components/shared/Skeleton";

/**
 * Mirrors the proportional list: heading, unclassified strip, then the five
 * rows open by default. It previously rendered an eight-card grid, which was
 * the uniform card layout the redesign deleted — it flashed a shape the page
 * can no longer produce.
 */
export default function CategoriesLoading() {
  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />
      </div>

      {/* Unclassified strip */}
      <Skeleton className="h-[68px] w-full rounded-lg" />

      {/* Column headers plus the five rows visible before expanding. */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      {/* Toggle */}
      <Skeleton className="h-9 w-48 rounded-lg" />
    </div>
  );
}
