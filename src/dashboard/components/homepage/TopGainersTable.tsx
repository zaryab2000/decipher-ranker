import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, displayName, toDisplayScore } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

const CATEGORY_COLORS = [
  "bg-brand-50 text-brand-700 border-brand-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-pink-50 text-pink-700 border-pink-200",
];

function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export function TopGainersTable({ merchants }: { merchants: MerchantListItem[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Merchants</h2>
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
                    className="text-gray-900 hover:text-brand-700 transition-colors"
                  >
                    {truncate(displayName(merchant), 30)}
                  </Link>
                  {merchant.origin && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {truncate(merchant.origin, 40)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {merchant.category ? (
                    <Badge className={categoryColor(merchant.category)}>{merchant.category}</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 border-gray-200">Uncategorized</Badge>
                  )}
                </TableCell>
                <TableCell className="w-48">
                  <ScoreBar score={toDisplayScore(merchant.rankerScore)} showLabel />
                </TableCell>
              </TableRow>
            ))}
          </Table>
          <div className="mt-3 text-right">
            <Link
              href="/dashboard/leaderboard"
              className="text-sm text-brand-600 hover:text-brand-700 transition-colors"
            >
              View Full Leaderboard &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
