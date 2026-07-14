import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting for the free, unauthenticated routes. Paid routes are
 * economically throttled by their price and are intentionally not limited here.
 *
 * Backed by the same Upstash KV already used for the cache and router state
 * (KV_REST_API_URL / KV_REST_API_TOKEN). The limiter is:
 *   - lazy: built on first use, reused thereafter
 *   - no-op when KV is unconfigured (local dev without KV → requests pass)
 *   - fail-open: a KV error allows the request rather than taking the route down
 */

const LIMIT = 15;
const WINDOW = "60 s" as const;

type RouteHandler = (request: NextRequest) => Promise<Response>;

let cachedLimiter: Ratelimit | null | undefined;

/** Build the limiter once, or null when KV env is absent (rate limiting disabled). */
function getLimiter(): Ratelimit | null {
  if (cachedLimiter !== undefined) return cachedLimiter;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || url.startsWith("mock")) {
    cachedLimiter = null;
    return null;
  }

  cachedLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
    prefix: "ratelimit:decipher",
  });
  return cachedLimiter;
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
export function withRateLimit(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const limiter = getLimiter();
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
