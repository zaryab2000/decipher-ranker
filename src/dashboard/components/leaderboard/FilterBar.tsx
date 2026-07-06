"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS } from "@/dashboard/lib/constants";

export function FilterBar({
  categories,
  currentCategory,
  currentSort,
  currentOrder,
}: {
  categories: string[];
  currentCategory?: string;
  currentSort?: string;
  currentOrder?: string;
}) {
  const router = useRouter();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    if (params.has("page")) params.delete("page");
    router.push(`/dashboard/leaderboard?${params.toString()}`);
  }

  const order = currentOrder ?? "desc";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Category</label>
        <select
          value={currentCategory ?? ""}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 px-3 py-1.5 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Sort</label>
        <select
          value={currentSort ?? "score"}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 px-3 py-1.5 focus:outline-none focus:border-emerald-500/50"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => updateParams({ order: order === "desc" ? "asc" : "desc" })}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
      >
        {order === "desc" ? "\u2193 Desc" : "\u2191 Asc"}
      </button>
    </div>
  );
}
