import type { ReactNode } from "react";

interface TableProps {
  headers: { key: string; label: string }[];
  children: ReactNode;
  className?: string;
}

export function Table({ headers, children, className }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className ?? ""}`}>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-950 sticky top-0">
            {headers.map((h) => (
              <th
                key={h.key}
                className="py-2 px-4 text-xs text-gray-500 uppercase tracking-wider text-left font-medium"
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={`hover:bg-gray-800/50 transition-colors ${className ?? ""}`}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`py-2 px-4 text-sm ${className ?? ""}`}>{children}</td>;
}
