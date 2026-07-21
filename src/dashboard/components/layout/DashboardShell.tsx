"use client";

import { useState } from "react";
import { Sidebar } from "@/dashboard/components/layout/Sidebar";
import { Header } from "@/dashboard/components/layout/Header";
import { MobileNav } from "@/dashboard/components/layout/MobileNav";
import type { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:text-sm"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:ml-60">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" className="max-w-[1200px] mx-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
