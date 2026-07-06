import { Users, Grid3x3, ArrowUpDown, Trophy } from "lucide-react";
import { formatNumber } from "@/dashboard/lib/formatters";
import type { EcosystemStats } from "@/dashboard/types";

export function HeroStats({ stats }: { stats: EcosystemStats }) {
  const items = [
    { label: "Total Merchants", value: formatNumber(stats.totalMerchants), icon: <Users className="w-5 h-5" /> },
    { label: "Total Categories", value: formatNumber(stats.totalCategories), icon: <Grid3x3 className="w-5 h-5" /> },
    { label: "Total Transactions", value: formatNumber(stats.totalTransactions), icon: <ArrowUpDown className="w-5 h-5" /> },
    { label: "Top Category", value: stats.topCategory, icon: <Trophy className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg bg-gray-900 border border-gray-800 p-4"
        >
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            {item.icon}
            <p className="text-xs uppercase tracking-wider">{item.label}</p>
          </div>
          <p className="text-2xl font-semibold text-gray-50">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
