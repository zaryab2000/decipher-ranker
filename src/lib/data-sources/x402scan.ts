import { checkCache, setCache } from "@/lib/cache";

const X402SCAN_BASE_URL = "https://x402scan.com/api/x402";
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

  try {
    const url = `${X402SCAN_BASE_URL}/merchants/${address}/stats?timeframe=30&chain=${chain}`;
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return null;

    const data: X402MerchantStats = await response.json();
    await setCache(cacheKey, data, CACHE_TTL_SECONDS);
    return data;
  } catch {
    return null;
  }
}

export async function fetchMerchantTransactions(
  address: string,
  chain: string = "base",
  limit: number = 5,
): Promise<X402Transaction[]> {
  const cacheKey = `x402scan:txns:${address}:${chain}:${limit}`;
  const cached = await checkCache<X402Transaction[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${X402SCAN_BASE_URL}/merchants/${address}/transactions?page_size=${limit}&sort_by=amount&sort_order=desc&chain=${chain}`;
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return [];

    const data: X402Transaction[] = await response.json();
    await setCache(cacheKey, data, CACHE_TTL_SECONDS);
    return data;
  } catch {
    return [];
  }
}
