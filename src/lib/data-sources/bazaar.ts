import type { BazaarResource, BazaarApiResponse } from "@/lib/types";

const BAZAAR_BASE_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const PAGE_LIMIT = 100;
const RATE_LIMIT_DELAY_MS = 100;

export async function fetchAllBazaarResources(): Promise<BazaarResource[]> {
  const all: BazaarResource[] = [];
  let offset = 0;

  while (true) {
    const url = `${BAZAAR_BASE_URL}?limit=${PAGE_LIMIT}&offset=${offset}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `Bazaar API error: ${res.status} ${res.statusText} at offset ${offset}`,
      );
    }

    const data: BazaarApiResponse = await res.json();
    all.push(...data.items);

    if (offset + PAGE_LIMIT >= data.pagination.total) break;
    offset += PAGE_LIMIT;

    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  return all;
}

export function extractPayeeAddress(resource: BazaarResource): string | null {
  if (resource.accepts.length === 0) return null;
  return resource.accepts[0].payTo;
}

export function extractPriceUsd(resource: BazaarResource): number | null {
  if (resource.accepts.length === 0) return null;
  const amount = parseFloat(resource.accepts[0].amount);
  return isNaN(amount) ? null : amount;
}

export function extractChain(resource: BazaarResource): string {
  if (resource.accepts.length === 0) return "base";
  return resource.accepts[0].network ?? "base";
}

export function hasInputSchema(resource: BazaarResource): boolean {
  return !!resource.extensions?.bazaar?.info?.input;
}

export function hasOutputSchema(resource: BazaarResource): boolean {
  return !!resource.extensions?.bazaar?.info?.output;
}

export function hasSchemaExample(resource: BazaarResource): boolean {
  return !!resource.extensions?.bazaar?.info?.output?.example;
}
