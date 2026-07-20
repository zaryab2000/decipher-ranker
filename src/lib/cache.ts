import { kv } from "@vercel/kv";

export async function checkCache<T>(key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache miss is non-fatal
  }
}

/**
 * Read-through cache: return the cached value for `key`, or run `fetcher`,
 * store its result under `key` for `ttlSeconds`, and return it.
 *
 * Every KV op is best-effort (see checkCache/setCache) — a KV outage or a
 * mock:// URL degrades to calling `fetcher` directly, never an error. Used to
 * keep repeated dashboard reads off Neon (public-network-transfer budget).
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await checkCache<T>(key);
  if (hit !== null) return hit;

  const value = await fetcher();
  await setCache(key, value, ttlSeconds);
  return value;
}
