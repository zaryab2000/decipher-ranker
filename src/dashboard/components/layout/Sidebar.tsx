"use client";

import Link from "next/link";
import { NavLinks } from "@/dashboard/components/layout/NavLinks";

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-950/80 border-r border-gray-800 flex flex-col z-40 lg:block hidden">
      <div className="p-4 border-b border-gray-800">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-50">
          decipher-ranker
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <NavLinks />
      </nav>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">Powered by x402</p>
      </div>
    </aside>
  );
}
