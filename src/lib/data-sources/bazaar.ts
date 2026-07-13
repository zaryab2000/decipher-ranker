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

// x402 stablecoins (USDC and peers) use 6 decimals. Bazaar amounts are in the
// asset's atomic units, so a $1,000 USDC price arrives as "1000000000".
const DEFAULT_ASSET_DECIMALS = 6;
// Any price above this after decoding is treated as malformed (non-USD asset or
// bad data) and dropped rather than stored — keeps a single bad row from
// poisoning a batch insert and keeps pricing analytics honest.
const MAX_REASONABLE_PRICE_USD = 1_000_000;

export function extractPriceUsd(resource: BazaarResource): number | null {
  if (resource.accepts.length === 0) return null;

  const accept = resource.accepts[0];
  const raw = parseFloat(accept.amount);
  if (isNaN(raw)) return null;

  const decimals = accept.extra?.decimals ?? DEFAULT_ASSET_DECIMALS;
  const priceUsd = raw / 10 ** decimals;

  if (priceUsd < 0 || priceUsd > MAX_REASONABLE_PRICE_USD) return null;
  return priceUsd;
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
