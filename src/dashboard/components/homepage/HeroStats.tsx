import { Users, Grid3x3, Globe, Trophy, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@/dashboard/lib/formatters";
import type { EcosystemStats } from "@/dashboard/types";

export function HeroStats({ stats }: { stats: EcosystemStats }) {
  const items = [
    { label: "Total Merchants", value: formatNumber(stats.totalMerchants), icon: <Users className="w-5 h-5" /> },
    { label: "Categories", value: formatNumber(stats.totalCategories), icon: <Grid3x3 className="w-5 h-5" /> },
    { label: "Total Resources", value: formatNumber(stats.totalResources), icon: <Globe className="w-5 h-5" /> },
    { label: "Top Category", value: stats.topCategory, icon: <Trophy className="w-5 h-5" /> },
    ...(stats.totalTransactions > 0
      ? [{ label: "Transactions 30d", value: formatNumber(stats.totalTransactions), icon: <ArrowUpDown className="w-5 h-5" /> }]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg bg-white border border-gray-200 p-4"
        >
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            {item.icon}
            <p className="text-xs uppercase tracking-wider">{item.label}</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 truncate">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
