import { GROWTH_FLAT_THRESHOLD } from "@/dashboard/lib/constants";
import type { CategoryGrowth } from "@/dashboard/types";

const MUTED = "text-gray-400 text-xs";

/**
 * Change in merchant count over the available snapshot window.
 *
 * Presentational, no hooks. Red appears here and nowhere else on this page, and
 * it means exactly one thing: the category shrank. It is a direction indicator,
 * not a severity one — a shrinking category is not an error.
 */
export function GrowthChip({ growth }: { growth: CategoryGrowth | null }) {
  // "No data" and "genuinely flat" render the same glyph but are different
  // facts, so the tooltip distinguishes them. This is why CategoryItem carries
  // the whole record rather than a flattened number.
  if (!growth?.known) {
    return (
      <span className={MUTED} title="Not enough history yet">
        —
      </span>
    );
  }

  if (Math.abs(growth.growthPct) < GROWTH_FLAT_THRESHOLD) {
    return (
      <span className={MUTED} title="No change">
        —
      </span>
    );
  }

  const up = growth.growthPct > 0;

  // The glyph is aria-hidden because screen readers announce it as "black
  // up-pointing triangle"; the sr-only word carries the meaning instead.
  return (
    <span
      className={`${up ? "text-emerald-600" : "text-red-600"} font-bold text-xs tabular-nums`}
    >
      <span aria-hidden="true">{up ? "▲ " : "▼ "}</span>
      <span className="sr-only">{up ? "up " : "down "}</span>
      {Math.abs(growth.growthPct).toFixed(1)}%
    </span>
  );
}
