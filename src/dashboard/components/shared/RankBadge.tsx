function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-amber-500/20 text-amber-400";
    case 2:
      return "bg-gray-300/20 text-gray-300";
    case 3:
      return "bg-orange-500/20 text-orange-400";
    default:
      return "bg-gray-800 text-gray-400";
  }
}

export function RankBadge({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold min-w-[2rem] ${getRankStyle(rank)} ${className ?? ""}`}
    >
      #{rank}
    </span>
  );
}
