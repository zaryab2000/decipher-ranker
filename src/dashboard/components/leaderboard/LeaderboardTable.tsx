import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import {
  truncate,
  displayName,
  formatNumber,
  formatPrice,
  toDisplayScore,
} from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

const CATEGORY_COLORS = [
  "bg-emerald-50 text-emerald-700 border-emerald-200",
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

export function LeaderboardTable({
  merchants,
  startRank = 0,
  total,
  page,
  perPage,
  sortBy,
  sortOrder,
}: {
  merchants: MerchantListItem[];
  startRank?: number;
  total?: number;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  if (merchants.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-12 text-center">
        No merchants found matching the current filters
      </p>
    );
  }

  return (
    <>
      {total != null && (
        <p className="text-sm text-gray-500 mb-3">
          {total} merchant{total !== 1 ? "s" : ""}
          {page != null && perPage != null && total > perPage
            ? ` (page ${page} of ${Math.ceil(total / perPage)})`
            : ""}
        </p>
      )}
    <Table
      headers={[
        { key: "rank", label: "Rank" },
        { key: "service", label: "Service" },
        { key: "category", label: "Category" },
        { key: "score", label: "Score" },
        { key: "price", label: "Price" },
        { key: "volume", label: "Volume" },
      ]}
    >
      {merchants.map((merchant, i) => (
        <TableRow key={merchant.payeeAddress}>
          <TableCell>
            <RankBadge rank={startRank + i + 1} muted={sortBy !== "score" || sortOrder === "asc"} />
          </TableCell>
          <TableCell>
            <Link
              href={`/dashboard/merchant/${encodeURIComponent(merchant.origin)}`}
              className="text-gray-900 hover:text-emerald-700 transition-colors"
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
          <TableCell className="text-gray-400 font-mono">
            {merchant.priceUsd != null ? formatPrice(merchant.priceUsd) : "—"}
          </TableCell>
          <TableCell className="text-gray-400 font-mono">
            {formatNumber(merchant.txCount30d)} txns
          </TableCell>
        </TableRow>
      ))}
    </Table>
    </>
  );
}
