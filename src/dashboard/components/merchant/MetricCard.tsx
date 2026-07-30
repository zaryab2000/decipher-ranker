import { Card } from "@/dashboard/components/shared/Card";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  icon,
  subtitle,
  /** Overrides the value colour — used to flag a zero that is not neutral. */
  valueClassName,
  /** Matches valueClassName so the note reads as part of the same signal. */
  subtitleClassName,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  valueClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueClassName ?? "text-gray-900"}`}>
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-1 ${subtitleClassName ?? "text-gray-500"}`}>{subtitle}</p>
      )}
    </Card>
  );
}
