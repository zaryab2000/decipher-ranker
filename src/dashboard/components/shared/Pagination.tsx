import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

function buildHref(
  basePath: string,
  pageNum: number,
  searchParams?: Record<string, string>,
): string {
  const params = new URLSearchParams(searchParams ?? {});
  if (pageNum > 1) {
    params.set("page", String(pageNum));
  } else {
    params.delete("page");
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-6">
      {page > 1 && (
        <Link
          href={buildHref(basePath, page - 1, searchParams)}
          className="px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          Previous
        </Link>
      )}

      {start > 1 && (
        <>
          <Link
            href={buildHref(basePath, 1, searchParams)}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            1
          </Link>
          {start > 2 && (
            <span className="px-1 text-gray-600">...</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(basePath, p, searchParams)}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            p === page
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-medium"
              : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          }`}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-1 text-gray-600">...</span>
          )}
          <Link
            href={buildHref(basePath, totalPages, searchParams)}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            {totalPages}
          </Link>
        </>
      )}

      {page < totalPages && (
        <Link
          href={buildHref(basePath, page + 1, searchParams)}
          className="px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
