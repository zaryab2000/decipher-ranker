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
          {/* bg-white is load-bearing: the header is sticky, so without an
              opaque background the rows scroll visibly underneath it. */}
          <tr className="bg-white sticky top-0 border-b border-gray-200">
            {headers.map((h) => (
              <th
                key={h.key}
                className="py-2 px-4 text-xs text-gray-400 uppercase tracking-wide text-left font-medium"
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
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
    <tr className={`hover:bg-gray-50 transition-colors ${className ?? ""}`}>
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
