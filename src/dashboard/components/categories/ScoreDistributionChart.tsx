"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

/**
 * The bucket label a score falls into.
 *
 * Two constraints, both easy to get wrong:
 *
 * 1. The score must be on the 0..100 scale. A raw 0..1 value pins every
 *    merchant to "0-10".
 * 2. It must be UNROUNDED, matching how buildScoreDistribution bins the
 *    histogram. Both floor into ten-point buckets, so rounding first shifts
 *    scores across a boundary — 39.98 belongs in "30-40", but rounds to 40 and
 *    would be marked in "40-50", pointing at a bar it never contributed to.
 */
export function bucketFor(score: number): string {
  const b = Math.min(Math.floor(score / 10), 9);
  return `${b * 10}-${(b + 1) * 10}`;
}

export function ScoreDistributionChart({
  data,
  highlightScore,
}: {
  data: { range: string; count: number }[];
  /** Display-scale score of the active merchant, if one is known. */
  highlightScore?: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="range"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "#f9fafb" }}
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#6b7280" }}
          itemStyle={{ color: "#111827" }}
          formatter={(value: number) => [`${value}`, "Merchants"]}
        />
        <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        {highlightScore != null && (
          <ReferenceLine
            x={bucketFor(highlightScore)}
            stroke="#059669"
            strokeDasharray="3 3"
            label={{
              value: "YOU",
              position: "top",
              fill: "#059669",
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
