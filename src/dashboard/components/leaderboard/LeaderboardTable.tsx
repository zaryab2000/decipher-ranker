import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, formatNumber, formatPrice } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

export function LeaderboardTable({
  merchants,
  startRank,
}: {
  merchants: MerchantListItem[];
  startRank: number;
}) {
  if (merchants.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-12 text-center">
        No merchants found matching the current filters
      </p>
    );
  }

  return (
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
            <RankBadge rank={startRank + i} />
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
          <TableCell className="text-gray-400 font-mono">
            {merchant.priceUsd != null ? formatPrice(merchant.priceUsd) : "N/A"}
          </TableCell>
          <TableCell className="text-gray-400 font-mono">
            {formatNumber(merchant.txCount30d)} txns
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
