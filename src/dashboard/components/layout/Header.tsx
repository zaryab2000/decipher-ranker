"use client";

import { Search } from "lucide-react";
import { useSearchSubmit } from "@/dashboard/lib/useSearchSubmit";

export function Header() {
  const { handleSubmit } = useSearchSubmit();

  return (
    <header className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="text-gray-600">/</span>
        <span className="text-gray-50 font-medium">Dashboard</span>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            name="q"
            type="text"
            placeholder="Search merchants..."
            className="w-64 pl-9 pr-3 py-1.5 text-sm bg-gray-900 border border-gray-800 rounded-lg text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>
      </form>
    </header>
  );
}
