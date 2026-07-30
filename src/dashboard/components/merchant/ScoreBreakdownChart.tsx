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

export function ScoreBreakdownChart({
  breakdown,
}: {
  breakdown: ScoreBreakdown;
}) {
  // Bars are ordered by descending component weight because SCORE_COMPONENTS is.
  // Magnitude is encoded by bar length only — hue carries no meaning here.
  const data = SCORE_COMPONENTS.map((comp) => ({
    name: comp.label,
    value: Math.round(breakdown[comp.key] ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 16 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#6b7280" }}
          itemStyle={{ color: "#111827" }}
          formatter={(value: number) => [`${value}`, "Score"]}
        />
        <Bar dataKey="value" fill="#10b981" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
