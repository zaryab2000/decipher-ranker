"use client";

import { Search } from "lucide-react";
import { useSearchSubmit } from "@/dashboard/lib/useSearchSubmit";

export function SearchBar({ initialQuery }: { initialQuery?: string }) {
  const { handleSubmit } = useSearchSubmit();

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          name="q"
          type="text"
          defaultValue={initialQuery}
          placeholder="Search merchants by name, origin, or address..."
          className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 hover:border-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
        />
      </div>
    </form>
  );
}
