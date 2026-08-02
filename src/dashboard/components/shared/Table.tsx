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
          {/* Not sticky. The wrapper is overflow-x-auto, which establishes a
              scroll container on the x axis only, so `sticky top-0` pinned to
              the viewport instead of the table — and the app header is not
              sticky either, so it pinned underneath it. At 50 rows per page
              there is nothing long enough to need it. */}
          <tr className="bg-white border-b border-gray-200">
            {headers.map((h) => (
              <th
                key={h.key}
                className="py-2 px-4 text-xs text-gray-500 uppercase tracking-wide text-left font-medium"
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
