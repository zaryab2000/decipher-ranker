"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Grid3x3, Search } from "lucide-react";
import { NAV_ITEMS } from "@/dashboard/lib/constants";

const iconMap: Record<string, React.ReactNode> = {
  Home: <Home className="w-5 h-5" />,
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
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive(item.href)
              ? "bg-gray-800 text-gray-50"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
          }`}
        >
          {iconMap[item.icon]}
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  );
}
