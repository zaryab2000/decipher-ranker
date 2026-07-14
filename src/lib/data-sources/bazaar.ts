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
  const payTo = resource.accepts[0].payTo;
  if (!payTo) return null;
  // EVM addresses are case-insensitive; store lowercase so checksummed and
  // lowercase forms of the same address collapse to one merchant row (and match
  // on lookup). Solana addresses are case-sensitive base58 — leave them as-is.
  return payTo.startsWith("0x") ? payTo.toLowerCase() : payTo;
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

// Canonical mainnet chain shorthands. Bazaar returns `network` in mixed formats
// (CAIP-2 `eip155:8453`, shorthand `base`, `base-sepolia`, `solana:<genesis>`,
// …). We normalize to a single shorthand so the same merchant/chain collapses to
// one row and address lookups match. Testnets and unsupported chains map to null
// and are dropped — a production ranker indexes mainnet services only.
const CHAIN_ALIASES: Record<string, SupportedChain> = {
  base: "base",
  "eip155:8453": "base",
  solana: "solana",
  "solana:5eykt4usfv8p8njdtrepy1vzqkqzkvdp": "solana",
  polygon: "polygon",
  "eip155:137": "polygon",
};

export type SupportedChain = "base" | "solana" | "polygon";

/** Map a raw Bazaar `network` string to a canonical mainnet shorthand, or null. */
export function normalizeChain(raw: string | null | undefined): SupportedChain | null {
  if (!raw) return null;
  return CHAIN_ALIASES[raw.toLowerCase()] ?? null;
}

/**
 * Canonical chain for a resource, or null when it is a testnet / unsupported
 * chain that should not be indexed.
 */
export function extractChain(resource: BazaarResource): SupportedChain | null {
  if (resource.accepts.length === 0) return null;
  return normalizeChain(resource.accepts[0].network);
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
