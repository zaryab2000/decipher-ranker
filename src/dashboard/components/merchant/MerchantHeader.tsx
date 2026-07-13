import { ExternalLink } from "lucide-react";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { truncate } from "@/dashboard/lib/formatters";
import type { MerchantProfile } from "@/dashboard/types";

export function MerchantHeader({ merchant }: { merchant: MerchantProfile }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-50 truncate">
              {merchant.serviceName ?? merchant.origin}
            </h1>
            {merchant.origin && (
              <a
                href={merchant.origin.startsWith("http") ? merchant.origin : `https://${merchant.origin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          {merchant.origin && (
            <p className="text-sm text-gray-500 font-mono mt-1">
              {truncate(merchant.origin, 60)}
            </p>
          )}
          {merchant.description && (
            <p className="text-sm text-gray-400 mt-2">{merchant.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {merchant.category && <Badge variant="accent">{merchant.category}</Badge>}
        <Badge>{merchant.chain}</Badge>
        {merchant.rankPosition != null && <RankBadge rank={merchant.rankPosition} />}
        {merchant.tags.map((tag) => (
          <Badge key={tag} variant="muted">{tag}</Badge>
        ))}
      </div>
    </div>
  );
}
