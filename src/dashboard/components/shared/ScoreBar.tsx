import { SCORE_FILL, SCORE_TRACK } from "@/dashboard/lib/constants";

export function ScoreBar({
  score,
  className,
  showLabel,
}: {
  score: number;
  className?: string;
  showLabel?: boolean;
}) {
  // Callers pass an already-scaled 0-100 value (via toDisplayScore). Do not
  // convert here — a second conversion would collapse every bar to zero width.
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div
      className={`flex items-center gap-2 ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Score: ${clampedScore.toFixed(0)}`}
    >
      <div className={`h-2 rounded-full ${SCORE_TRACK} w-full overflow-hidden`}>
        <div
          className={`h-2 rounded-full ${SCORE_FILL}`}
          // 2% floor so a zero score reads as an empty-but-present bar rather
          // than a missing one.
          style={{ width: `${Math.max(clampedScore, 2)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 font-mono tabular-nums min-w-[2rem] text-right">
          {clampedScore.toFixed(0)}
        </span>
      )}
    </div>
  );
}
