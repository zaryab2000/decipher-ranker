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
