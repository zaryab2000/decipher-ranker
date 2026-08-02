import type { ImprovementSuggestion } from "@/dashboard/types";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

// No red: an improvement is an opportunity, not an error.
const PRIORITY_STYLE = {
  high: "text-amber-600",
  medium: "text-gray-500",
  low: "text-gray-500",
} as const;

/**
 * Improvements ranked by priority.
 *
 * Deliberately unnumbered: these are not steps to perform in order, they are
 * independent fixes ranked by impact. Numbering them would assert a sequence
 * the data does not have — the priority label already carries the ordering.
 */
export function FixList({ improvements }: { improvements: ImprovementSuggestion[] }) {
  const sorted = [...improvements].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">What to fix</h2>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">
          Your listing is complete. Rank movement now depends on transaction volume and
          buyer diversity.
        </p>
      ) : (
        <ul className="mt-2">
          {sorted.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0"
            >
              <span
                className={`text-[10px] uppercase tracking-wide font-semibold pt-1 w-14 shrink-0 ${PRIORITY_STYLE[item.priority]}`}
              >
                {item.priority}
              </span>
              <span className="text-sm text-gray-900">{item.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
