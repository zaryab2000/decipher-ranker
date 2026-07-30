"use client";

import Link from "next/link";
import { X, BarChart3 } from "lucide-react";
import { NavLinks } from "@/dashboard/components/layout/NavLinks";

export function MobileNav({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-50 lg:hidden transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={onClose}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-gray-900">Decipher Ranker</span>
          </Link>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLinks onClick={onClose} />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <a
            href="https://x402.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Powered by x402
          </a>
        </div>
      </aside>
    </>
  );
}
