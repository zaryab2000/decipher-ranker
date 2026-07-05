import { Sidebar } from "@/dashboard/components/layout/Sidebar";
import { Header } from "@/dashboard/components/layout/Header";
import type { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />

      <div className="lg:ml-60">
        <Header />
        <main className="max-w-[1200px] mx-auto p-6">{children}</main>
      </div>
    </div>
  );
}
