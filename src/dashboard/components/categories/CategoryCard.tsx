import Link from "next/link";
import { Card } from "@/dashboard/components/shared/Card";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, formatAddress } from "@/dashboard/lib/formatters";
import type { CategoryItem } from "@/dashboard/types";

export function CategoryCard({ category }: { category: CategoryItem }) {
  return (
    <Link href={`/dashboard/categories/${category.slug}`}>
      <Card className="hover:border-gray-700 transition-colors cursor-pointer">
        <h3 className="text-gray-50 font-semibold text-lg">{category.name}</h3>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Merchants</span>
            <span className="text-sm text-gray-300 font-medium">{category.merchantCount}</span>
          </div>
          {category.avgScore != null && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Avg Score</span>
              <ScoreBar score={category.avgScore} showLabel />
            </div>
          )}
          {category.topMerchant && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Top Merchant</span>
              <span className="text-xs text-gray-400 font-mono">
                {formatAddress(category.topMerchant.address)}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
