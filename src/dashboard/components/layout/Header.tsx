"use client";

import Link from "next/link";
import { Search, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSearchSubmit } from "@/dashboard/lib/useSearchSubmit";
import { TAXONOMY } from "@/lib/analytics/taxonomy";

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  leaderboard: "Leaderboard",
  categories: "Categories",
  search: "Search",
  merchant: "Merchant",
  ...Object.fromEntries(TAXONOMY.map((c) => [c.slug, c.name])),
};

// A dynamic route segment is either a category slug ("climate-apis") or an
// encoded origin URL ("https%3A%2F%2Fapi.foo.com"). Slugs read fine title-cased;
// an origin should collapse to its hostname, not a capitalized full URL.
function labelForSegment(seg: string): string {
  const known = breadcrumbLabels[seg.toLowerCase()];
  if (known) return known;

  if (seg.includes("://") || seg.startsWith("http")) {
    try {
      return new URL(seg).hostname;
    } catch {
      return seg;
    }
  }

  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(And|Or|Of|The|In)\b/g, (c) => c.toLowerCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

function buildBreadcrumbs(pathname: string): { href: string; label: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [{ href: "/dashboard", label: "Dashboard" }];

  for (let i = 1; i < segments.length; i++) {
    const seg = decodeURIComponent(segments[i] ?? "");
    const label = labelForSegment(seg);
    crumbs.push({
      href: "/" + segments.slice(0, i + 1).join("/"),
      label: label.length > 20 ? `${label.slice(0, 20)}…` : label,
    });
  }

  return crumbs;
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { handleSubmit } = useSearchSubmit();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden inline-flex items-center justify-center w-11 h-11 -ml-2 text-gray-600 hover:text-gray-900 rounded-lg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-600 min-w-0">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-gray-300 shrink-0">/</span>}
              {i < crumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-gray-600 hover:text-gray-900 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-gray-900 font-medium truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="q"
            type="text"
            placeholder="Search..."
            aria-label="Search merchants"
            className="w-36 sm:w-48 md:w-64 pl-9 pr-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 hover:border-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
          />
        </div>
      </form>
    </header>
  );
}
