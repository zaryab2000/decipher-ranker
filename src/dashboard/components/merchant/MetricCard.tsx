import { Card } from "@/dashboard/components/shared/Card";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-50">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </Card>
  );
}
