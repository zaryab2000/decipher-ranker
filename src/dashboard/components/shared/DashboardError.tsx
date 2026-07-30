"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  function handleRetry() {
    setLoading(true);
    setRetryCount((c) => c + 1);
    reset();
  }

  if (retryCount >= 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          This page is temporarily unavailable
        </h2>
        <p className="text-gray-600 text-sm text-center max-w-md">
          We couldn&apos;t load this page after multiple attempts. Please try
          again later or go back to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="text-gray-600 text-sm text-center max-w-md">
        We couldn&apos;t load this page. Please try again or go back to the
        dashboard.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleRetry}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {loading ? "Retrying..." : "Try again"}
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
