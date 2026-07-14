import { checkCache, setCache } from "@/lib/cache";
import { payAndFetch } from "@/lib/data-sources/x402scan-client";

// The apex domain 307-redirects to www; use www directly to avoid the hop.
// NOTE: x402scan's own API is x402-paid — these endpoints currently return 402
// to an unauthenticated fetch. Populating all-time stats end-to-end requires an
// outbound x402 payment client (AgentCash wallet); until that is wired,
// fetchMerchantStats returns null and the deep-dive reports
// allTimeStatsAvailable: false rather than fabricating zeros.
const X402SCAN_BASE_URL = "https://www.x402scan.com/api/x402";
const CACHE_TTL_SECONDS = 3600;

export interface X402MerchantStats {
  address: string;
  chain: string;
  totalTransactions: number;
  totalVolumeUsd: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  volume30d: number;
  txCount30d: number;
  buyers30d: number;
}

export interface X402Transaction {
  hash: string;
  from: string;
  to: string;
  amountUsd: number;
  timestamp: string;
  chain: string;
}

export async function fetchMerchantStats(
  address: string,
  chain: string = "base",
): Promise<X402MerchantStats | null> {
  const cacheKey = `x402scan:stats:${address}:${chain}`;
  const cached = await checkCache<X402MerchantStats>(cacheKey);
  if (cached) return cached;

  const url = `${X402SCAN_BASE_URL}/merchants/${address}/stats?timeframe=30&chain=${chain}`;
  const data = await payAndFetch<X402MerchantStats>(url);
  if (!data) return null;

  await setCache(cacheKey, data, CACHE_TTL_SECONDS);
  return data;
}

export async function fetchMerchantTransactions(
  address: string,
  chain: string = "base",
  limit: number = 5,
): Promise<X402Transaction[]> {
  const cacheKey = `x402scan:txns:${address}:${chain}:${limit}`;
  const cached = await checkCache<X402Transaction[]>(cacheKey);
  if (cached) return cached;

  const url = `${X402SCAN_BASE_URL}/merchants/${address}/transactions?page_size=${limit}&sort_by=amount&sort_order=desc&chain=${chain}`;
  const data = await payAndFetch<X402Transaction[]>(url);
  if (!data) return [];

  await setCache(cacheKey, data, CACHE_TTL_SECONDS);
  return data;
}
