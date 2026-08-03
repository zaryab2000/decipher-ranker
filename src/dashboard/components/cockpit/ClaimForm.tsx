"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rememberOrigin } from "@/dashboard/components/cockpit/RememberedMerchant";

export function ClaimForm({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const origin = value.trim();
    if (!origin) return;

    rememberOrigin(origin);
    router.push(`/dashboard?origin=${encodeURIComponent(origin)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <label htmlFor="claim-origin" className="sr-only">
        Your domain
      </label>
      <input
        id="claim-origin"
        name="origin"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="bitrefill.com"
        className="flex-1 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-3 text-base hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors duration-150"
      />
      <button
        type="submit"
        className="px-6 py-3 bg-brand-600 text-white text-base font-medium rounded-lg hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-colors duration-150 whitespace-nowrap"
      >
        Show my rank
      </button>
    </form>
  );
}
