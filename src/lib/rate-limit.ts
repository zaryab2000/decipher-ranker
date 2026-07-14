import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting for the free (non-paid) routes. Paid routes are
 * economically throttled by their price and are intentionally not limited here.
 * Note `report/origin` is free but SIWX-authenticated — still IP-limited, since
 * wallets are cheap to mint and cannot be trusted as a rate-limit identity.
 *
 * Backed by the same Upstash KV already used for the cache and router state
 * (KV_REST_API_URL / KV_REST_API_TOKEN). The limiter is:
 *   - lazy: built on first use, one instance per distinct limit, reused after
 *   - no-op when KV is unconfigured (local dev without KV → requests pass)
 *   - fail-open: a KV error allows the request rather than taking the route down
 */

const DEFAULT_LIMIT = 15;
const WINDOW = "60 s" as const;

interface RateLimitOptions {
  /** Max requests per IP per 60s window. Defaults to 15. */
  limit?: number;
}

type RouteHandler = (request: NextRequest) => Promise<Response>;

// One limiter per distinct limit value. `undefined` means "KV unavailable →
// disabled"; cached so we only probe the env once.
const limiterCache = new Map<number, Ratelimit>();
let kvAvailable: boolean | undefined;

/** Build (or reuse) the limiter for a given limit, or null when KV is absent. */
function getLimiter(limit: number): Ratelimit | null {
  if (kvAvailable === undefined) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    kvAvailable = Boolean(url && token && !url.startsWith("mock"));
  }
  if (!kvAvailable) return null;

  const existing = limiterCache.get(limit);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(limit, WINDOW),
    // Per-limit prefix so buckets for different limits don't collide on the same IP.
    prefix: `ratelimit:decipher:${limit}`,
  });
  limiterCache.set(limit, limiter);
  return limiter;
}

/** Best-effort client IP from proxy headers; falls back to a shared bucket. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Wrap a route handler with per-IP rate limiting. Over the limit returns 429
 * with a Retry-After header; under the limit (or when the limiter is disabled /
 * errors) the wrapped handler runs normally.
 */
export function withRateLimit(
  handler: RouteHandler,
  options: RateLimitOptions = {},
): RouteHandler {
  const limit = options.limit ?? DEFAULT_LIMIT;
  return async (request: NextRequest): Promise<Response> => {
    const limiter = getLimiter(limit);
    if (!limiter) return handler(request);

    try {
      const { success, reset } = await limiter.limit(clientIp(request));
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return NextResponse.json(
          { error: "Rate limit exceeded. Please retry later." },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }
    } catch (error) {
      // Fail open: never let a KV blip take down a free route.
      console.error("Rate limit check failed (allowing request):", error);
    }

    return handler(request);
  };
}
