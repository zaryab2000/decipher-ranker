import { SCORE_COLORS } from "@/dashboard/lib/constants";

function getColor(score: number): string {
  if (score >= SCORE_COLORS.high.min) return "bg-emerald-500";
  if (score >= SCORE_COLORS.mid.min) return "bg-amber-500";
  return "bg-red-500";
}

export function ScoreBar({
  score,
  className,
  showLabel,
}: {
  score: number;
  className?: string;
  showLabel?: boolean;
}) {
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
      <div className="h-2 rounded-full bg-gray-800 w-full">
        <div
          className={`h-2 rounded-full ${getColor(clampedScore)}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 font-mono min-w-[2rem] text-right">
          {clampedScore.toFixed(0)}
        </span>
      )}
    </div>
  );
}
