import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
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

export function CompetitorList({
  competitors,
  currentScore,
  categoryName,
}: {
  competitors: MerchantListItem[];
  currentScore: number;
  categoryName?: string | null;
}) {
  const heading = `Competitors${categoryName ? ` in ${categoryName}` : ""}`;

  if (competitors.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">{heading}</h2>
        <p className="text-gray-500 text-sm py-4">No competitors in this category</p>
      </div>
    );
  }

  const currentScaled = toDisplayScore(currentScore);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{heading}</h2>
      <Table
        headers={[
          { key: "rank", label: "Rank" },
          { key: "service", label: "Service" },
          { key: "score", label: "Score" },
          { key: "volume", label: "Volume" },
          { key: "price", label: "Price" },
        ]}
      >
        {competitors.map((comp, i) => {
          const compScaled = toDisplayScore(comp.rankerScore);
          const scoreDiff = currentScaled - compScaled;
          return (
            <TableRow key={comp.payeeAddress}>
              <TableCell>
                {/* The competitor's real rank, not the row's position — these
                    are the merchants adjacent to you in the category, so row 1
                    is rarely rank 1. */}
                {comp.rankPosition != null ? (
                  <RankBadge rank={comp.rankPosition} />
                ) : (
                  <span className="text-xs text-gray-500 tabular-nums">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/merchant/${encodeURIComponent(comp.origin)}`}
                    className="text-gray-900 hover:text-brand-700 transition-colors"
                  >
                    {truncate(displayName(comp), 25)}
                  </Link>
                  {/* Neutral on purpose. Hue encodes direction of change over
                      time, and this is a static gap against a peer — the same
                      score-as-severity framing that was removed elsewhere. A
                      merchant on 34 next to a peer on 41 is normal, not in the
                      red. The sign alone carries the comparison. */}
                  {scoreDiff !== 0 && (
                    <span className="text-gray-500 text-xs tabular-nums">
                      {scoreDiff > 0 ? "+" : "−"}
                      {Math.abs(Math.round(scoreDiff))}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-36">
                <ScoreBar score={compScaled} showLabel />
              </TableCell>
              <TableCell className="text-gray-500 font-mono text-xs">
                {formatNumber(comp.txCount30d)} txns
              </TableCell>
              <TableCell className="text-gray-500 font-mono text-xs">
                {comp.priceUsd != null ? formatPrice(comp.priceUsd) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
    </div>
  );
}
