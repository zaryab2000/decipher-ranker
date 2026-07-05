const variants = {
  text: "h-4 w-full rounded",
  card: "h-32 w-full rounded-lg",
  "table-row": "h-10 w-full rounded",
} as const;

export function Skeleton({
  className,
  variant = "text",
}: {
  className?: string;
  variant?: "text" | "card" | "table-row";
}) {
  return (
    <div
      className={`bg-gray-800 rounded animate-pulse ${variants[variant]} ${className ?? ""}`}
    />
  );
}
