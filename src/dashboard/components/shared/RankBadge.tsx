// Medal colours (gold/silver/bronze) are gone: they fight the emerald palette
// and encode nothing a merchant can act on. The top three keep emphasis, but
// through weight and the accent tint rather than three separate hues.
function getRankStyle(rank: number): string {
  if (rank <= 3) return "bg-emerald-50 text-emerald-700 font-bold";
  return "bg-gray-100 text-gray-600";
}

export function RankBadge({
  rank,
  muted,
  className,
}: {
  rank: number;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums min-w-[2rem] ${muted ? "bg-gray-100 text-gray-600" : getRankStyle(rank)} ${className ?? ""}`}
    >
      #{rank}
    </span>
  );
}
