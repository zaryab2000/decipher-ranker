import Link from "next/link";
import { Table, TableRow, TableCell } from "@/dashboard/components/shared/Table";
import { RankBadge } from "@/dashboard/components/shared/RankBadge";
import { ScoreBar } from "@/dashboard/components/shared/ScoreBar";
import { truncate, displayName, formatNumber, formatPrice } from "@/dashboard/lib/formatters";
import type { MerchantListItem } from "@/dashboard/types";

export function CompetitorList({
  competitors,
  currentScore,
}: {
  competitors: MerchantListItem[];
  currentScore: number;
}) {
  if (competitors.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-50 mb-3">Competitors</h2>
        <p className="text-gray-500 text-sm py-4">No competitors in this category</p>
      </div>
    );
  }

  const currentScaled = currentScore * 100;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-50 mb-3">Competitors</h2>
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
          const compScaled = comp.rankerScore * 100;
          const scoreDiff = currentScaled - compScaled;
          return (
            <TableRow key={comp.payeeAddress} className="cursor-pointer">
              <TableCell>
                <RankBadge rank={i + 1} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/merchant/${encodeURIComponent(comp.origin)}`}
                    className="text-gray-50 hover:text-emerald-400 transition-colors"
                  >
                    {truncate(displayName(comp), 25)}
                  </Link>
                  {scoreDiff > 0 && (
                    <span className="text-emerald-400 text-xs">+{Math.round(scoreDiff)}</span>
                  )}
                  {scoreDiff < 0 && (
                    <span className="text-red-400 text-xs">{Math.round(scoreDiff)}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-36">
                <ScoreBar score={compScaled} showLabel />
              </TableCell>
              <TableCell className="text-gray-400 font-mono text-xs">
                {formatNumber(comp.txCount30d)} txns
              </TableCell>
              <TableCell className="text-gray-400 font-mono text-xs">
                {comp.priceUsd != null ? formatPrice(comp.priceUsd) : "N/A"}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
    </div>
  );
}
