"use client";

import Link from "next/link";
import { X } from "lucide-react";
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
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-60 bg-gray-950 border-r border-gray-800 flex flex-col z-50 lg:hidden transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-gray-50"
            onClick={onClose}
          >
            decipher-ranker
          </Link>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLinks onClick={onClose} />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">Powered by x402</p>
        </div>
      </aside>
    </>
  );
}
