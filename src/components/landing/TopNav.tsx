"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, Menu, X } from "lucide-react";

const NAV_LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "x402scan",
    href: "https://www.x402scan.com/server/d683a3a0-e920-4ebb-9f5d-2f3e0fe25803",
    external: true,
  },
  { label: "API docs", href: "/openapi.json" },
  { label: "For agents", href: "#agents" },
];

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen, handleKeyDown]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <span className="text-base font-semibold text-gray-900">Decipher Ranker</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-150 text-sm font-medium inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
                >
                  {link.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-150 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
                >
                  {link.label}
                </Link>
              ),
            )}
            <a
              href="#search"
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Try now
            </a>
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 z-50 md:hidden transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal={menuOpen}
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
        inert={menuOpen ? undefined : true}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900">Decipher Ranker</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-3">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-gray-600 hover:text-gray-900 transition-colors duration-150 text-sm font-medium py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
                <ExternalLink className="w-3 h-3 inline ml-1" />
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="block text-gray-600 hover:text-gray-900 transition-colors duration-150 text-sm font-medium py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
          <a
            href="#search"
            className="block text-center px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors duration-150 mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            onClick={() => setMenuOpen(false)}
          >
            Try now
          </a>
        </nav>
      </div>
    </>
  );
}
