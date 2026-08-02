import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import {
  displayName,
  formatNumber,
  formatPrice,
  toDisplayScore,
  truncate,
} from "@/dashboard/lib/formatters";
import type { MerchantListItem, MerchantProfile } from "@/dashboard/types";

/**
 * The merchant's peers, with their own row merged in and marked.
 *
 * The active merchant is always present: seeing where you sit among rivals is
 * the point of the table, so their row is inserted in score order rather than
 * relying on them appearing in the competitor query.
 */
export function CompetitorTable({ merchant }: { merchant: MerchantProfile }) {
  const you: MerchantListItem = merchant;
  const rows = [...merchant.competitors, you].sort(
    (a, b) => toDisplayScore(b.rankerScore) - toDisplayScore(a.rankerScore),
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {merchant.category ? `Others in ${merchant.category}` : "Comparable merchants"}
      </h2>
      <Table
        headers={[
          { key: "rank", label: "Rank" },
          { key: "service", label: "Service" },
          { key: "score", label: "Score" },
          { key: "calls", label: "Calls · 30d" },
          { key: "price", label: "Price" },
        ]}
      >
        {rows.map((row, i) => {
          const isYou = row.payeeAddress === merchant.payeeAddress;
          return (
            <TableRow
              key={`${row.payeeAddress}-${i}`}
              className={isYou ? "bg-emerald-50" : ""}
            >
              <TableCell
                className={`tabular-nums ${isYou ? "text-emerald-900 font-semibold" : "text-gray-500"}`}
              >
                {/* The merchant's true category rank, not this table's row
                    number — showing "5" beside a headline that says "#4" reads
                    as a contradiction. */}
                {row.rankPosition != null ? `#${row.rankPosition}` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  {isYou ? (
                    <span className="text-emerald-900 font-semibold">
                      {truncate(displayName(row), 28)}
                    </span>
                  ) : (
                    <Link
                      href={`/dashboard/merchant/${encodeURIComponent(row.origin)}`}
                      className="text-gray-900 hover:text-emerald-700 transition-colors"
                    >
                      {truncate(displayName(row), 28)}
                    </Link>
                  )}
                  {isYou && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-600 text-white">
                      YOU
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-40">
                <ScoreBar score={toDisplayScore(row.rankerScore)} showLabel />
              </TableCell>
              <TableCell
                className={`font-mono tabular-nums text-right ${isYou ? "text-emerald-900 font-semibold" : "text-gray-600"}`}
              >
                {formatNumber(row.txCount30d)}
              </TableCell>
              <TableCell
                className={`font-mono tabular-nums text-right ${isYou ? "text-emerald-900 font-semibold" : "text-gray-600"}`}
              >
                {row.priceUsd != null ? formatPrice(row.priceUsd) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
    </div>
  );
}
