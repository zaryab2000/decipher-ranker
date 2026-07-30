import { Skeleton } from "@/dashboard/components/shared/Skeleton";

// Mirrors the cockpit's band layout so the page does not jump when it resolves.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Identity band */}
      <Skeleton className="h-[92px] w-full rounded-xl" />

      {/* Four metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>

      {/* Component breakdown + rank chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <Skeleton className="h-[280px] w-full rounded-xl" />
        <Skeleton className="h-[280px] w-full rounded-xl" />
      </div>

      {/* Fix list */}
      <Skeleton className="h-[160px] w-full rounded-xl" />

      {/* Competitor table */}
      <Skeleton className="h-[240px] w-full rounded-xl" />
    </div>
  );
}
