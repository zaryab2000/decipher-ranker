import { Users, Grid3x3, Globe, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@/dashboard/lib/formatters";
import type { EcosystemStats } from "@/dashboard/types";

export function HeroStats({ stats }: { stats: EcosystemStats }) {
  // Exactly four, always — a conditional fifth card orphans onto a second row
  // in a four-column grid. "Top category" is dropped rather than made
  // conditional: with 698 of 1,321 merchants uncategorized it renders "Other",
  // which is not a fact worth featuring.
  const items = [
    { label: "Merchants", value: formatNumber(stats.totalMerchants), icon: <Users className="w-5 h-5" /> },
    { label: "Categories", value: formatNumber(stats.totalCategories), icon: <Grid3x3 className="w-5 h-5" /> },
    { label: "Resources", value: formatNumber(stats.totalResources), icon: <Globe className="w-5 h-5" /> },
    { label: "Calls 30d", value: formatNumber(stats.totalTransactions), icon: <ArrowUpDown className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-white border border-gray-200 p-5"
        >
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <span aria-hidden="true" className="flex-shrink-0">
              {item.icon}
            </span>
            <p className="text-xs uppercase tracking-wide">{item.label}</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 truncate">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
