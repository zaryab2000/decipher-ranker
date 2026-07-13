"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SCORE_COMPONENTS } from "@/dashboard/lib/constants";
import type { ScoreBreakdown } from "@/dashboard/types";

function barColor(value: number): string {
  if (value >= 70) return "#34d399";
  if (value >= 40) return "#fbbf24";
  return "#f87171";
}

export function ScoreBreakdownChart({
  breakdown,
}: {
  breakdown: ScoreBreakdown;
}) {
  const data = SCORE_COMPONENTS.map((comp) => ({
    name: comp.label,
    value: Math.round(breakdown[comp.key] ?? 0),
    fill: barColor(breakdown[comp.key] ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#1f2937" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          itemStyle={{ color: "#d1d5db" }}
          formatter={(value: number) => [`${value}`, "Score"]}
        />
        <Bar dataKey="value" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
