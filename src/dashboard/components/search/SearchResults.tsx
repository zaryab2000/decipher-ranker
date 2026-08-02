import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card } from "@/dashboard/components/shared/Card";
import { Badge } from "@/dashboard/components/shared/Badge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { displayName, formatPrice, toDisplayScore } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

interface SearchResultsProps {
  results: MerchantListItem[];
  query: string;
  total: number;
}

export function SearchResults({ results, query, total }: SearchResultsProps) {
  if (results.length === 0) {
    // Same shape as the cockpit and landing-page not-found cards, so a merchant
    // who fails to find themselves gets the same answer everywhere.
    return (
      <div className="rounded-lg border border-gray-200 border-l-4 border-l-amber-400 bg-white p-4 text-sm text-gray-600">
        <AlertCircle className="inline w-4 h-4 text-amber-500 mr-1.5 -mt-0.5" />
        Nothing matches &quot;{query}&quot; in the x402 catalog. It can take up to 24 hours
        after a Coinbase Bazaar listing to appear here.{" "}
        <a
          href="https://bazaar.coinbase.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-600/30"
        >
          Register on Coinbase Bazaar
        </a>
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
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {/* Shadow raised from /5, which was invisible and left the border
                carrying the whole hover affordance. */}
            <Card className="hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium truncate">
                    {displayName(merchant)}
                  </p>
                  <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
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
                  <div className="w-32">
                    <ScoreBar score={toDisplayScore(merchant.rankerScore)} showLabel />
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
      <p className="text-sm text-gray-600 mt-4">
        Is one of these yours? Open it to see your full score breakdown.
      </p>
    </div>
  );
}
