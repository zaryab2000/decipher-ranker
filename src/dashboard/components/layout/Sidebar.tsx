"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { NavLinks } from "@/dashboard/components/layout/NavLinks";

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-50 border-r border-gray-200 flex flex-col z-40 lg:block hidden">
      <div className="p-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-900">Decipher Ranker</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <NavLinks />
      </nav>

      <div className="p-4 border-t border-gray-200">
        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Powered by x402
        </a>
      </div>
    </aside>
  );
}
