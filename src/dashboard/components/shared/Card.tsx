import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-white border border-gray-200 p-5 ${className ?? ""}`}>
      {children}
    </div>
  );
}
