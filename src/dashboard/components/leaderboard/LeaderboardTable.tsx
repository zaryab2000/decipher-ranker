import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { Badge } from "@/dashboard/components/shared/Badge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import {
  truncate,
  displayName,
  formatNumber,
  formatPrice,
  toDisplayScore,
} from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

// Category badges are neutral. A hash-to-hue map used to assign one of eight
// colours per category, which collided with the palette's one meaning per hue:
// amber reads as "needs attention" on the unclassified strip, the fix list and
// the zero-buyers metric card, while rose reads as the red this dashboard
// deliberately avoids. Hue also encoded nothing useful here — the label already
// says the category name, and a hash reassigns colours as the catalog changes.

export function LeaderboardTable({
  merchants,
  startRank = 0,
  total,
  page,
  perPage,
}: {
  merchants: MerchantListItem[];
  /** Row offset for the current page, so ordinals continue across pages. */
  startRank?: number;
  total?: number;
  page?: number;
  perPage?: number;
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
        { key: "rank", label: "#" },
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
            {/* A plain ordinal, not a rank badge. `rankPosition` is scoped to
                the merchant's category (ROW_NUMBER partitioned by category_id),
                so on a cross-category list it repeats — three separate #1s in
                the first five rows. The old code instead relabelled the ordinal
                as a rank, which put a "#1" badge on the cheapest merchant under
                a price sort. Neither is a leaderboard-wide rank, so this states
                row position and claims nothing more. Category rank is shown on
                the merchant's own page, where it means something. */}
            <span className="text-xs text-gray-500 tabular-nums">
              {startRank + i + 1}
            </span>
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
              <Badge>{merchant.category}</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-500 border-gray-200">Uncategorized</Badge>
            )}
          </TableCell>
          <TableCell className="w-48">
            <ScoreBar score={toDisplayScore(merchant.rankerScore)} showLabel />
          </TableCell>
          <TableCell className="text-gray-500 font-mono">
            {merchant.priceUsd != null ? formatPrice(merchant.priceUsd) : "—"}
          </TableCell>
          <TableCell className="text-gray-500 font-mono">
            {formatNumber(merchant.txCount30d)} txns
          </TableCell>
        </TableRow>
      ))}
    </Table>
    </>
  );
}
