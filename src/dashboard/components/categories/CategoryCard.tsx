import Link from "next/link";
import { Card } from "@/dashboard/components/shared/Card";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, displayName, toDisplayScore } from "@/dashboard/lib/formatters";
import type { CategoryItem } from "@/dashboard/types";

export function CategoryCard({ category }: { category: CategoryItem }) {
  return (
    <Link href={`/dashboard/categories/${category.slug}`}>
      <Card className="hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-500/30 transition-all cursor-pointer h-full">
        <h3 className="text-gray-900 font-semibold text-lg capitalize">{category.name}</h3>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Merchants</span>
            <span className="text-sm text-gray-600 font-medium">{category.merchantCount}</span>
          </div>
          {category.avgScore != null && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Avg Score</span>
              <ScoreBar score={toDisplayScore(category.avgScore)} showLabel />
            </div>
          )}
          {category.topMerchant && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Top Merchant</span>
              <span className="text-xs text-gray-400 truncate max-w-[140px] text-right">
                {category.topMerchant.serviceName
                  ? truncate(category.topMerchant.serviceName, 20)
                  : category.topMerchant.resourceUrl
                    ? truncate(displayName(category.topMerchant.resourceUrl), 20)
                    : truncate(category.topMerchant.address, 12)}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
