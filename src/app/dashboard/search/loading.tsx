import { Skeleton } from "@/dashboard/components/shared/Skeleton";

export default function SearchLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-10 w-full max-w-md mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
    </div>
  );
}
