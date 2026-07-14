import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Upstash SDK so no network/KV is touched. The Ratelimit double's
// limit() is driven per-test via mockLimit.
const mockLimit = vi.fn();
const mockSlidingWindow = vi.fn((..._args: unknown[]) => ({}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_config: unknown) {}
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(...args: unknown[]) {
      return mockSlidingWindow(...args);
    }
    limit = mockLimit;
  },
}));

function makeRequest(ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/leaderboard", {
    headers: { "x-forwarded-for": ip },
  });
}

const okHandler = vi.fn(async () => Response.json({ ok: true }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // Real-looking KV env so the limiter is constructed (not the no-op path).
  process.env.KV_REST_API_URL = "https://real.upstash.io";
  process.env.KV_REST_API_TOKEN = "token";
});

afterEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

describe("withRateLimit", () => {
  it("allows the request when under the limit", async () => {
    mockLimit.mockResolvedValueOnce({ success: true, reset: Date.now() + 60_000 });
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledOnce();
  });

  it("returns 429 with Retry-After when over the limit", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, reset: Date.now() + 30_000 });
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(429);
    expect(okHandler).not.toHaveBeenCalled();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);
  });

  it("fails open (allows the request) when the limiter throws", async () => {
    mockLimit.mockRejectedValueOnce(new Error("KV down"));
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledOnce();
  });

  it("keys the limit on the first x-forwarded-for IP", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    await wrapped(makeRequest("9.9.9.9, 10.0.0.1"));
    expect(mockLimit).toHaveBeenCalledWith("9.9.9.9");
  });

  it("is a no-op (never calls the limiter) when KV is unconfigured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    const res = await wrapped(makeRequest());
    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
    expect(okHandler).toHaveBeenCalledOnce();
  });

  it("is a no-op when KV url is a mock:// placeholder", async () => {
    process.env.KV_REST_API_URL = "mock://test";
    const { withRateLimit } = await import("@/lib/rate-limit");
    const wrapped = withRateLimit(okHandler);

    await wrapped(makeRequest());
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("defaults to a limit of 15", async () => {
    mockLimit.mockResolvedValueOnce({ success: true, reset: Date.now() + 60_000 });
    const { withRateLimit } = await import("@/lib/rate-limit");
    await withRateLimit(okHandler)(makeRequest());
    expect(mockSlidingWindow).toHaveBeenCalledWith(15, "60 s");
  });

  it("honors a custom limit", async () => {
    mockLimit.mockResolvedValueOnce({ success: true, reset: Date.now() + 60_000 });
    const { withRateLimit } = await import("@/lib/rate-limit");
    await withRateLimit(okHandler, { limit: 30 })(makeRequest());
    expect(mockSlidingWindow).toHaveBeenCalledWith(30, "60 s");
  });
});
