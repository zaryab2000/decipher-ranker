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

const PAGE_LINK =
  "px-3 py-1.5 text-sm rounded-md border transition-colors focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

const PAGE_LINK_DEFAULT =
  `${PAGE_LINK} bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900`;

const PAGE_LINK_ACTIVE =
  `${PAGE_LINK} bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold`;

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
          className={PAGE_LINK_DEFAULT}
        >
          Previous
        </Link>
      )}

      {start > 1 && (
        <>
          <Link
            href={buildHref(basePath, 1, searchParams)}
            className={PAGE_LINK_DEFAULT}
          >
            1
          </Link>
          {start > 2 && (
            <span className="px-1 text-gray-400">...</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(basePath, p, searchParams)}
          className={p === page ? PAGE_LINK_ACTIVE : PAGE_LINK_DEFAULT}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-1 text-gray-400">...</span>
          )}
          <Link
            href={buildHref(basePath, totalPages, searchParams)}
            className={PAGE_LINK_DEFAULT}
          >
            {totalPages}
          </Link>
        </>
      )}

      {page < totalPages && (
        <Link
          href={buildHref(basePath, page + 1, searchParams)}
          className={PAGE_LINK_DEFAULT}
        >
          Next
        </Link>
      )}
    </nav>
  );
}
