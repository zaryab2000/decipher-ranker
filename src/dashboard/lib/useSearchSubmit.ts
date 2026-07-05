"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export function useSearchSubmit() {
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("q") as HTMLInputElement;
    const query = input.value.trim();
    if (query) {
      router.push(`/dashboard/search?q=${encodeURIComponent(query)}`);
    }
  }

  return { handleSubmit };
}
