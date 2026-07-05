import type { ReactNode } from "react";

const variants = {
  default: "bg-gray-800 text-gray-300",
  accent: "bg-emerald-500/20 text-emerald-400",
  muted: "bg-gray-800 text-gray-500",
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
