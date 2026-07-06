import Link from "next/link";
import { Card } from "@/dashboard/components/shared/Card";
import { Badge } from "@/dashboard/components/shared/Badge";

import { formatRelativeDate } from "@/dashboard/lib/formatters";

import type { MerchantListItem } from "@/dashboard/types";

export function RecentUpdates({ merchants }: { merchants: MerchantListItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-50 mb-3">Recent Updates</h2>
      <Card>
        {merchants.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No recent updates</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {merchants.map((merchant) => (
              <Link
                key={merchant.payeeAddress}
                href={`/dashboard/merchant/${encodeURIComponent(merchant.origin)}`}
                className="block py-3 first:pt-0 last:pb-0 hover:bg-gray-800/30 rounded transition-colors -mx-2 px-2"
              >
                <p className="text-sm text-gray-50 font-medium">
                  {merchant.serviceName ?? merchant.origin}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {merchant.category && (
                    <Badge variant="accent">{merchant.category}</Badge>
                  )}
                  <span className="text-xs text-gray-600">
                    {formatRelativeDate(merchant.lastUpdated)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
