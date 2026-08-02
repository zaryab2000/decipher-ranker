import { Skeleton } from "@/dashboard/components/shared/Skeleton";

/**
 * Deliberately neutral, because this file cannot know which page it precedes.
 *
 * `/dashboard` resolves to two different layouts depending on `?origin=`: the
 * cockpit when a merchant is found, the claim form otherwise. `loading.tsx`
 * has no access to searchParams, so a cockpit-shaped skeleton would show a
 * five-band layout to every first-time visitor and then collapse into a
 * heading and a form — a worse jump than the one a skeleton exists to prevent.
 *
 * A heading block over a four-card grid is the honest floor: both states open
 * with a heading, and both render a four-card row (metric cards on the
 * cockpit, HeroStats on the claim panel).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>

      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}
