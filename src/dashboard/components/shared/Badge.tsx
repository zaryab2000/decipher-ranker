import type { ReactNode } from "react";

const variants = {
  default: "bg-gray-100 text-gray-600",
  accent: "bg-emerald-50 text-emerald-700",
  muted: "bg-gray-100 text-gray-600",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "accent" | "muted";
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
