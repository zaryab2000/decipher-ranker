import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

export function TopGainersTable({ merchants }: { merchants: MerchantListItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-50 mb-3">Top Merchants</h2>
      {merchants.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No merchant data available</p>
      ) : (
        <>
          <Table
            headers={[
              { key: "rank", label: "Rank" },
              { key: "service", label: "Service" },
              { key: "category", label: "Category" },
              { key: "score", label: "Score" },
            ]}
          >
            {merchants.map((merchant) => (
              <TableRow key={merchant.payeeAddress}>
                <TableCell>
                  <RankBadge rank={merchant.rankPosition ?? 0} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/merchant/${encodeURIComponent(merchant.origin)}`}
                    className="text-gray-50 hover:text-emerald-400 transition-colors"
                  >
                    {truncate(merchant.serviceName ?? merchant.origin, 30)}
                  </Link>
                  {merchant.origin && (
                    <p className="text-xs text-gray-600 font-mono mt-0.5">
                      {truncate(merchant.origin, 40)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {merchant.category ? (
                    <Badge variant="accent">{merchant.category}</Badge>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="w-32">
                  <ScoreBar score={merchant.rankerScore} showLabel />
                </TableCell>
              </TableRow>
            ))}
          </Table>
          <div className="mt-3 text-right">
            <Link
              href="/dashboard/leaderboard"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View Full Leaderboard &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
