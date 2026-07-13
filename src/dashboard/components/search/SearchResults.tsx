import Link from "next/link";
import { Card } from "@/dashboard/components/shared/Card";
import { Badge } from "@/dashboard/components/shared/Badge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { formatPrice } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

interface SearchResultsProps {
  results: MerchantListItem[];
  query: string;
  total: number;
}

export function SearchResults({ results, query, total }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-2">
          No results found for &apos;{query}&apos;
        </p>
        <p className="text-gray-600 text-sm">
          Try a different search term or browse the leaderboard
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {total} result{total !== 1 ? "s" : ""} for &quot;{query}&quot;
      </p>
      <div className="space-y-3">
        {results.map((merchant) => (
          <Link
            key={merchant.payeeAddress}
            href={`/dashboard/merchant/${encodeURIComponent(merchant.origin)}`}
          >
            <Card className="hover:border-gray-700 transition-colors cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-50 font-medium truncate">
                    {merchant.serviceName ?? merchant.origin}
                  </p>
                  <p className="text-xs text-gray-600 font-mono truncate mt-0.5">
                    {merchant.origin}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {merchant.category && (
                      <Badge variant="accent">{merchant.category}</Badge>
                    )}
                    <Badge variant="muted">{merchant.chain}</Badge>
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="w-24">
                    <ScoreBar score={merchant.rankerScore} showLabel />
                  </div>
                  {merchant.priceUsd !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatPrice(merchant.priceUsd)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
