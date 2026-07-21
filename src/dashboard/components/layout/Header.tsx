"use client";

import Link from "next/link";
import { Search, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSearchSubmit } from "@/dashboard/lib/useSearchSubmit";

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  leaderboard: "Leaderboard",
  categories: "Categories",
  search: "Search",
  merchant: "Merchant",
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
    <header className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1 text-gray-400 hover:text-gray-200 rounded shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-gray-500 shrink-0">/</span>}
              {i < crumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-gray-500 hover:text-gray-300 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-50 font-medium truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            name="q"
            type="text"
            placeholder="Search..."
            className="w-36 sm:w-48 md:w-64 pl-9 pr-3 py-1.5 text-sm bg-gray-900 border border-gray-800 rounded-lg text-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>
      </form>
    </header>
  );
}
