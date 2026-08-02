import { SCORE_FILL, SCORE_TRACK } from "@/dashboard/lib/constants";
import { toWeightedComponents } from "@/dashboard/lib/formatters";
import type { ScoreBreakdown } from "@/dashboard/types";

/**
 * The page's central idea: a merchant does not have "49% buyer diversity", they
 * have 12 of the 25 points buyer diversity is worth. Every row is points earned
 * against points available, ordered by how much each is worth.
 */
export function ComponentBreakdown({
  breakdown,
  // Omitted on the merchant profile route, which shows any merchant rather than
  // the visitor's own — "close the gap" is not addressed to that reader.
  fixCount = 0,
  nextRank = null,
}: {
  breakdown: ScoreBreakdown;
  fixCount?: number;
  nextRank?: number | null;
}) {
  const components = toWeightedComponents(breakdown);
  // Only the most valuable zero component earns the label — a superlative
  // cannot apply to several rows at once. Components are weight-ordered, so the
  // first zero is the biggest lever.
  const leverKey = components.find((c) => c.isZero)?.key ?? null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">What&apos;s costing you points</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        Points earned against points available, biggest lever first.
      </p>

      <div className="mt-4 space-y-4">
        {components.map((c) => (
          <div key={c.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-gray-600">
                {c.label}
                {c.key === leverKey && (
                  <span className="text-xs text-amber-600"> — biggest lever</span>
                )}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  c.isZero ? "text-amber-600" : "text-gray-900"
                }`}
              >
                {c.earned} / {c.available}
              </span>
            </div>
            <div
              className={`h-2 rounded-full ${SCORE_TRACK} overflow-hidden`}
              role="progressbar"
              aria-valuenow={Math.round(c.pctOfMax)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${c.label}: ${c.earned} of ${c.available} points`}
            >
              <div
                className={`h-2 rounded-full ${SCORE_FILL} transition-[width] duration-700 ease-out`}
                // 2% floor keeps a zero component visible as a sliver.
                style={{ width: `${Math.max(c.pctOfMax, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {fixCount > 0 && nextRank != null && (
        <p className="mt-4 text-sm font-semibold text-emerald-600">
          → {fixCount} fix{fixCount === 1 ? "" : "es"} below could close the gap to #{nextRank}
        </p>
      )}
    </div>
  );
}
