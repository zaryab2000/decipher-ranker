import type { RankHistoryPoint } from "@/dashboard/types";

/**
 * A 108x34 rank trace. Inline SVG rather than Recharts: a sparkline this small
 * does not justify a chart runtime, and this renders inside a server component.
 *
 * Lower rankPosition is better, so the Y scale is inverted — the best rank sits
 * at the top. Decorative: the delta it illustrates is already stated in words
 * in the subline, so it is hidden from assistive tech.
 */
export function RankSparkline({ points }: { points: RankHistoryPoint[] }) {
  const ranked = points.filter(
    (p): p is RankHistoryPoint & { rankPosition: number } => p.rankPosition != null,
  );

  // One point is not a trend. Render nothing rather than an empty box.
  if (ranked.length < 2) return null;

  const width = 108;
  const height = 34;
  const top = 4;
  const bottom = 30;

  const ranks = ranked.map((p) => p.rankPosition);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks);
  const span = worst - best;

  const coords = ranked.map((p, i) => {
    const x = (i / (ranked.length - 1)) * width;
    // A flat history has no span to scale against — draw it down the middle.
    const y = span === 0 ? (top + bottom) / 2 : top + ((p.rankPosition - best) / span) * (bottom - top);
    return { x, y };
  });

  const last = coords[coords.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline
        points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--color-brand-600)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2.8} fill="var(--color-brand-600)" />
    </svg>
  );
}
