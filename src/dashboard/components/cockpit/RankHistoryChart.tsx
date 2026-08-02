"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RankHistoryPoint } from "@/dashboard/types";

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function RankHistoryChart({
  points,
  summary,
}: {
  points: RankHistoryPoint[];
  /** Plain-language equivalent of the chart, built server-side. */
  summary: string;
}) {
  const ranked = points.filter((p) => p.rankPosition != null);

  if (ranked.length === 0) {
    return (
      <Frame>
        <p className="text-sm text-gray-600">
          Rank history starts building from your first daily snapshot. Check back tomorrow.
        </p>
      </Frame>
    );
  }

  if (ranked.length === 1) {
    // A single point is a position, not a trend. Show the number, not a line.
    return (
      <Frame>
        <p className="text-sm text-gray-600">
          Rank history starts building from your first daily snapshot. Check back tomorrow.
        </p>
        <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900">
          #{ranked[0]!.rankPosition}
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <p className="sr-only">{summary}</p>
      <div role="img" aria-label={summary}>
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDay}
                minTickGap={24}
              />
              {/* `reversed` is load-bearing: rank 1 is the best outcome and
                  belongs at the top. Without it, improving rank appears to fall. */}
              <YAxis
                reversed
                domain={["dataMin - 1", "dataMax + 1"]}
                allowDecimals={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => `#${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(label: string) => formatDay(label)}
                formatter={(value: number) => [`#${value}`, "Rank"]}
              />
              <Line
                type="monotone"
                dataKey="rankPosition"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#059669" }}
                // A gap in snapshots is real information — do not smooth it away.
                connectNulls={false}
                // Recharts draws the line by animating stroke-dasharray from
                // zero. The reveal adds nothing to a rank trend, it ignores
                // prefers-reduced-motion, and it leaves the chart blank if the
                // frame is captured before it finishes.
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {ranked.length < 7 && (
        <p className="text-xs text-gray-500 mt-1">{ranked.length} days of history so far.</p>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Rank over time</h2>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
