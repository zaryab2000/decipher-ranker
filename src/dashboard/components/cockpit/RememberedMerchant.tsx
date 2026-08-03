"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "dr:origin";

export function rememberOrigin(origin: string) {
  try {
    window.localStorage.setItem(KEY, origin);
  } catch {
    // Private browsing can throw on write. Remembering is a convenience, so
    // failing to remember is not worth surfacing.
  }
}

export function RememberedMerchant() {
  const [origin, setOrigin] = useState<string | null>(null);

  // Read after mount only — never during render — so the SSR output and the
  // first client render match and React does not report a hydration mismatch.
  useEffect(() => {
    try {
      setOrigin(window.localStorage.getItem(KEY));
    } catch {
      // ignore
    }
  }, []);

  if (!origin) return null;

  return (
    <Link
      href={`/dashboard?origin=${encodeURIComponent(origin)}`}
      className="text-sm text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
    >
      Continue as {origin} →
    </Link>
  );
}
