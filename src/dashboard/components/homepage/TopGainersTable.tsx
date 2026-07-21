import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, displayName } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

const CATEGORY_COLORS = [
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
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
                    <Badge className="bg-gray-800/50 text-gray-500 border-gray-700/50">Uncategorized</Badge>
                  )}
                </TableCell>
                <TableCell className="w-48">
                  <ScoreBar score={merchant.rankerScore * 100} showLabel />
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
