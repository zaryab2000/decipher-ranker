"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Trophy, Grid3x3, Search } from "lucide-react";
import { NAV_ITEMS } from "@/dashboard/lib/constants";

const iconMap: Record<string, React.ReactNode> = {
  Gauge: <Gauge className="w-5 h-5" />,
  Trophy: <Trophy className="w-5 h-5" />,
  Grid3x3: <Grid3x3 className="w-5 h-5" />,
  Search: <Search className="w-5 h-5" />,
};

export function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            isActive(item.href)
              ? "bg-brand-50 text-brand-700 font-semibold"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          {iconMap[item.icon]}
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  );
}
