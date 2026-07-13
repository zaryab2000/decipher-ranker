"use client";

import { useEffect } from "react";

export function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold text-gray-200">
        Something went wrong
      </h2>
      <p className="text-gray-400 text-sm text-center max-w-md">
        {error.message || "Failed to load this page."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
